const { app, BaseWindow, WebContentsView, session, Menu, ipcMain, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const { ElectronBlocker } = require('@ghostery/adblocker-electron');

const TOOLBAR_HEIGHT = 84;
const NEW_TAB_URL = `file://${path.join(__dirname, 'ui', 'newtab.html')}`;
const searchUrl = (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`;

let mainWindow = null;
let toolbarView = null;
let toolbarAttached = false;
let blocker = null;

/** @type {{ id: number, view: WebContentsView, title: string, url: string, loading: boolean }[]} */
let tabs = [];
let activeTabId = null;
let nextTabId = 1;

function looksLikeUrl(input) {
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(input)) return true;
  if (/^localhost(:\d+)?(\/.*)?$/.test(input)) return true;
  if (!/\s/.test(input) && /^[^/]+\.[a-zA-Z]{2,}(\/.*)?$/.test(input)) return true;
  return false;
}

function normalizeUrl(rawInput) {
  const input = (rawInput || '').trim();
  if (!input) return NEW_TAB_URL;
  if (looksLikeUrl(input)) {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(input)) return input;
    if (/^localhost(:\d+)?(\/.*)?$/.test(input)) return `http://${input}`;
    return `https://${input}`;
  }
  return searchUrl(input);
}

async function setupAdblocker() {
  const cachePath = path.join(app.getPath('userData'), 'adblocker-engine.bin');
  try {
    if (fs.existsSync(cachePath)) {
      blocker = ElectronBlocker.deserialize(fs.readFileSync(cachePath));
    } else {
      blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
      fs.writeFileSync(cachePath, blocker.serialize());
    }
    blocker.enableBlockingInSession(session.defaultSession);
  } catch (err) {
    console.error('[adblocker] failed to initialize, continuing without it:', err);
    blocker = null;
  }
}

// No website is allowed to save a file to disk: cancel every download outright.
function blockDownloads() {
  session.defaultSession.on('will-download', (event) => {
    event.preventDefault();
  });
}

// No website is allowed to read a local file: neutralize file-picker uploads on every page.
const BLOCK_UPLOADS_SCRIPT = `(() => {
  if (window.__uploadBlockInstalled) return;
  window.__uploadBlockInstalled = true;

  document.addEventListener('click', (e) => {
    const el = e.target && e.target.closest ? e.target.closest('input[type="file"]') : null;
    if (el) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  document.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  const nativeClick = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function (...args) {
    if (this.type === 'file') return undefined;
    return nativeClick.apply(this, args);
  };

  const blockedPicker = () => Promise.reject(new DOMException('Blocked by browser policy', 'SecurityError'));
  if (window.showOpenFilePicker) window.showOpenFilePicker = blockedPicker;
  if (window.showSaveFilePicker) window.showSaveFilePicker = blockedPicker;
  if (window.showDirectoryPicker) window.showDirectoryPicker = blockedPicker;
})();`;

// Fallback play/pause + seek/volume shortcuts for pages with no player JS of their own.
// Backs off whenever a site already handled the key (e.defaultPrevented) or has its own
// focused player widget, so it won't fight sites like YouTube that implement this themselves.
const MEDIA_SHORTCUTS_SCRIPT = `(() => {
  if (window.__mediaShortcutsInstalled) return;
  window.__mediaShortcutsInstalled = true;

  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const active = document.activeElement;
    const tag = active && active.tagName ? active.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || (active && active.isContentEditable)) return;
    if (!(tag === 'video' || tag === 'body' || tag === 'html' || !active)) return;

    const videos = Array.from(document.querySelectorAll('video'));
    if (!videos.length) return;
    const playing = videos.find((v) => !v.paused && !v.ended);
    const video = playing || videos.slice().sort((a, b) => (b.videoWidth * b.videoHeight) - (a.videoWidth * a.videoHeight))[0];
    if (!video) return;

    switch (e.key) {
      case ' ':
      case 'Spacebar':
      case 'k':
        e.preventDefault();
        if (video.paused) video.play(); else video.pause();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 5);
        break;
      case 'ArrowRight':
        e.preventDefault();
        video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 5);
        break;
      case 'ArrowUp':
        e.preventDefault();
        video.volume = Math.min(1, video.volume + 0.1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        video.volume = Math.max(0, Math.round((video.volume - 0.1) * 100) / 100);
        break;
      default:
        break;
    }
  }, false);
})();`;

const PAGE_ENHANCEMENTS_SCRIPT = `${BLOCK_UPLOADS_SCRIPT}\n${MEDIA_SHORTCUTS_SCRIPT}`;

// Toggles Picture-in-Picture on the most prominent <video> on the page. Runs with a
// synthetic user gesture since requestPictureInPicture() requires one.
const PIP_SCRIPT = `(() => {
  if (document.pictureInPictureElement) {
    document.exitPictureInPicture().catch(() => {});
    return 'exited';
  }
  const videos = Array.from(document.querySelectorAll('video'));
  if (!videos.length) return 'no-video';
  const playing = videos.find((v) => !v.paused && !v.ended);
  const video = playing || videos.slice().sort((a, b) => (b.videoWidth * b.videoHeight) - (a.videoWidth * a.videoHeight))[0];
  if (!video || !video.requestPictureInPicture) return 'unsupported';
  video.requestPictureInPicture().catch(() => {});
  return 'requested';
})();`;

function hideToolbar() {
  if (toolbarAttached && toolbarView && mainWindow) {
    mainWindow.contentView.removeChildView(toolbarView);
    toolbarAttached = false;
  }
}

function showToolbar() {
  if (!toolbarAttached && toolbarView && mainWindow) {
    mainWindow.contentView.addChildView(toolbarView);
    toolbarAttached = true;
  }
}

function layout() {
  if (!mainWindow) return;
  const [width, height] = mainWindow.getContentSize();
  const active = tabs.find((t) => t.id === activeTabId);
  if (!active) return;

  if (active.fullscreen) {
    active.view.setBounds({ x: 0, y: 0, width, height });
  } else {
    if (toolbarView) toolbarView.setBounds({ x: 0, y: 0, width, height: TOOLBAR_HEIGHT });
    active.view.setBounds({ x: 0, y: TOOLBAR_HEIGHT, width, height: Math.max(0, height - TOOLBAR_HEIGHT) });
  }
}

function sendTabsUpdate() {
  if (!toolbarView) return;
  toolbarView.webContents.send('tabs-updated', {
    tabs: tabs.map((t) => ({ id: t.id, title: t.title, url: t.url, loading: t.loading })),
    activeTabId,
  });
  const active = tabs.find((t) => t.id === activeTabId);
  if (mainWindow) mainWindow.setTitle(active && active.title ? `${active.title} — Custom Browser` : 'Custom Browser');
}

function activeWebContents() {
  const tab = tabs.find((t) => t.id === activeTabId);
  return tab ? tab.view.webContents : null;
}

function createTab(url) {
  const view = new WebContentsView({
    webPreferences: {
      preload: require.resolve('@ghostery/adblocker-electron-preload'),
      contextIsolation: true,
    },
  });

  const id = nextTabId++;
  const tab = { id, view, title: 'New Tab', url: url || NEW_TAB_URL, loading: true, fullscreen: false };
  tabs.push(tab);

  const wc = view.webContents;

  // Block every popup / new-window request (window.open, target="_blank", etc.)
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));

  wc.on('context-menu', (_event, params) => {
    const template = [];
    if (params.linkURL) {
      template.push({ label: 'Open Link in New Tab', click: () => createTab(params.linkURL) });
      template.push({ label: 'Copy Link Address', click: () => clipboard.writeText(params.linkURL) });
      template.push({ type: 'separator' });
    }
    template.push({ label: 'Reload', click: () => wc.reload() });
    template.push({ label: 'Back', click: () => wc.navigationHistory.canGoBack() && wc.navigationHistory.goBack() });
    if (template.length) Menu.buildFromTemplate(template).popup();
  });

  wc.on('did-start-loading', () => {
    tab.loading = true;
    sendTabsUpdate();
  });
  wc.on('did-stop-loading', () => {
    tab.loading = false;
    sendTabsUpdate();
  });
  wc.on('page-title-updated', (_e, title) => {
    tab.title = title;
    sendTabsUpdate();
  });
  wc.on('did-navigate', (_e, navUrl) => {
    tab.url = navUrl;
    sendTabsUpdate();
  });
  wc.on('did-navigate-in-page', (_e, navUrl) => {
    tab.url = navUrl;
    sendTabsUpdate();
  });
  wc.on('dom-ready', () => {
    wc.executeJavaScript(PAGE_ENHANCEMENTS_SCRIPT).catch(() => {});
  });

  // Video sites manage "fullscreen" via the HTML Fullscreen API, which by default only
  // fills our sub-view (below the toolbar). Take it over so the tab covers the whole window.
  wc.on('enter-html-full-screen', () => {
    tab.fullscreen = true;
    hideToolbar();
    layout();
  });
  wc.on('leave-html-full-screen', () => {
    tab.fullscreen = false;
    showToolbar();
    layout();
  });

  mainWindow.contentView.addChildView(view);
  wc.loadURL(tab.url);

  switchTab(id);
  return tab;
}

function switchTab(id) {
  if (!tabs.some((t) => t.id === id)) return;
  activeTabId = id;
  for (const t of tabs) {
    if (t.id !== id) t.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  }
  layout();
  sendTabsUpdate();
}

function closeTab(id) {
  const idx = tabs.findIndex((t) => t.id === id);
  if (idx === -1) return;
  const [tab] = tabs.splice(idx, 1);
  if (tab.fullscreen) showToolbar();
  mainWindow.contentView.removeChildView(tab.view);
  tab.view.webContents.close();

  if (tabs.length === 0) {
    createTab(NEW_TAB_URL);
    return;
  }
  if (activeTabId === id) {
    const next = tabs[idx] || tabs[idx - 1];
    switchTab(next.id);
  } else {
    sendTabsUpdate();
  }
}

function registerIpcHandlers() {
  ipcMain.on('nav:new-tab', () => createTab(NEW_TAB_URL));
  ipcMain.on('nav:close-tab', (_e, id) => closeTab(id));
  ipcMain.on('nav:switch-tab', (_e, id) => switchTab(id));
  ipcMain.on('nav:navigate', (_e, input) => {
    const wc = activeWebContents();
    if (wc) wc.loadURL(normalizeUrl(input));
  });
  ipcMain.on('nav:back', () => {
    const wc = activeWebContents();
    if (wc && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
  });
  ipcMain.on('nav:forward', () => {
    const wc = activeWebContents();
    if (wc && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
  });
  ipcMain.on('nav:reload', () => activeWebContents()?.reload());
  ipcMain.on('nav:stop', () => activeWebContents()?.stop());
  ipcMain.on('nav:pip', () => {
    activeWebContents()?.executeJavaScript(PIP_SCRIPT, true).catch(() => {});
  });
}

function createMainWindow() {
  mainWindow = new BaseWindow({
    width: 1280,
    height: 860,
    minWidth: 640,
    minHeight: 420,
    title: 'Custom Browser',
  });

  toolbarView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });
  mainWindow.contentView.addChildView(toolbarView);
  toolbarAttached = true;
  toolbarView.webContents.loadFile(path.join(__dirname, 'ui', 'index.html'));

  mainWindow.on('resize', layout);
  mainWindow.on('closed', () => {
    mainWindow = null;
    toolbarView = null;
    toolbarAttached = false;
    tabs = [];
    activeTabId = null;
  });

  createTab(NEW_TAB_URL);
  layout();
}

app.whenReady().then(async () => {
  await setupAdblocker();
  blockDownloads();
  registerIpcHandlers();
  createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (!mainWindow) createMainWindow();
});
