const { app, BaseWindow, WebContentsView, session, Menu, ipcMain, clipboard, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { ElectronBlocker } = require('@ghostery/adblocker-electron');
const { normalizeUrl, displayHost } = require('./url');
const { createStore } = require('./storage/store');

const TOOLBAR_HEIGHT = 84;
const FIND_BAR_HEIGHT = 44;
const BRAIN_WIDTH = 380;
const NEW_TAB_URL = `file://${path.join(__dirname, 'ui', 'newtab.html')}`;
const HISTORY_LIMIT = 1000;

let mainWindow = null;
let toolbarView = null;
let toolbarAttached = false;
let findBarView = null;
let findBarVisible = false;
let brainView = null;
let brainVisible = false;
let blocker = null;
let store = null;

/** @type {{ id: number, view: WebContentsView, title: string, url: string, loading: boolean, fullscreen: boolean, zoom: number }[]} */
let tabs = [];
let activeTabId = null;
let nextTabId = 1;

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

function setupStore() {
  const storePath = path.join(app.getPath('userData'), 'hush-store.json');
  store = createStore(storePath, { bookmarks: [], history: [] });
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

// Toggles Picture-in-Picture on the most prominent <video> on the page.
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
    if (brainView) brainView.setVisible(false);
    return;
  }
  if (brainView) brainView.setVisible(brainVisible);

  if (toolbarView) toolbarView.setBounds({ x: 0, y: 0, width, height: TOOLBAR_HEIGHT });
  let contentTop = TOOLBAR_HEIGHT;
  if (findBarVisible && findBarView) {
    findBarView.setBounds({ x: 0, y: TOOLBAR_HEIGHT, width, height: FIND_BAR_HEIGHT });
    contentTop += FIND_BAR_HEIGHT;
  }
  const brainW = brainVisible ? Math.min(BRAIN_WIDTH, Math.max(240, Math.floor(width * 0.5))) : 0;
  const contentW = Math.max(0, width - brainW);
  active.view.setBounds({ x: 0, y: contentTop, width: contentW, height: Math.max(0, height - contentTop) });
  if (brainVisible && brainView) {
    brainView.setBounds({ x: contentW, y: TOOLBAR_HEIGHT, width: brainW, height: Math.max(0, height - TOOLBAR_HEIGHT) });
  }
}

function isBookmarked(url) {
  if (!url || url.startsWith('file://')) return false;
  const bookmarks = store.get('bookmarks') || [];
  return bookmarks.some((b) => b.url === url);
}

function sendTabsUpdate() {
  if (!toolbarView) return;
  const active = tabs.find((t) => t.id === activeTabId);
  toolbarView.webContents.send('tabs-updated', {
    tabs: tabs.map((t) => ({
      id: t.id, title: t.title, url: t.url, loading: t.loading,
      audible: t.audible, muted: t.muted,
    })),
    activeTabId,
    bookmarked: active ? isBookmarked(active.url) : false,
  });
  if (mainWindow) mainWindow.setTitle(active && active.title ? `${active.title} — Hush` : 'Hush');
}

function activeTab() {
  return tabs.find((t) => t.id === activeTabId) || null;
}

function activeWebContents() {
  const tab = activeTab();
  return tab ? tab.view.webContents : null;
}

function recordHistory(url, title) {
  if (!url || url.startsWith('file://') || url.startsWith('about:')) return;
  store.update('history', (list) => {
    const entries = list || [];
    const existingIdx = entries.findIndex((h) => h.url === url);
    if (existingIdx !== -1) entries.splice(existingIdx, 1);
    entries.unshift({ url, title: title || displayHost(url), ts: Date.now() });
    if (entries.length > HISTORY_LIMIT) entries.length = HISTORY_LIMIT;
    return entries;
  });
}

function createTab(url) {
  // Internal file:// pages (new tab, bookmarks, history) get Hush's own narrow preload
  // instead of the adblocker preload, so they can read local state without exposing
  // anything to remote sites.
  const isInternal = typeof url === 'string' && url.startsWith('file://');
  const preload = isInternal
    ? path.join(__dirname, 'internal-preload.js')
    : require.resolve('@ghostery/adblocker-electron-preload');
  const view = new WebContentsView({
    webPreferences: {
      preload,
      contextIsolation: true,
    },
  });

  const id = nextTabId++;
  const tab = { id, view, title: 'New Tab', url: url || NEW_TAB_URL, loading: true, fullscreen: false, zoom: 0, audible: false, muted: false };
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
    if (params.selectionText) {
      template.push({ label: 'Copy', click: () => clipboard.writeText(params.selectionText) });
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
    recordHistory(tab.url, title);
  });
  wc.on('did-navigate', (_e, navUrl) => {
    tab.url = navUrl;
    sendTabsUpdate();
    recordHistory(navUrl, tab.title);
  });
  wc.on('did-navigate-in-page', (_e, navUrl) => {
    tab.url = navUrl;
    sendTabsUpdate();
  });
  wc.on('dom-ready', () => {
    wc.executeJavaScript(PAGE_ENHANCEMENTS_SCRIPT).catch(() => {});
    wc.setZoomLevel(tab.zoom);
  });
  wc.on('audio-state-changed', (event) => {
    tab.audible = !!event.audible;
    sendTabsUpdate();
  });
  wc.on('found-in-page', (_e, result) => {
    if (!findBarView) return;
    findBarView.webContents.send('find:result', {
      current: result.activeMatchOrdinal,
      total: result.matches,
    });
  });

  wc.on('enter-html-full-screen', () => {
    tab.fullscreen = true;
    hideToolbar();
    hideFindBar();
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
  hideFindBar();
  // Use setVisible, not zero bounds. Zero-size views still participate in
  // compositing: on inactive PiP-source tabs, we were seeing the page bleed
  // through under the active tab after a switch.
  for (const t of tabs) t.view.setVisible(t.id === id);
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

function reorderTab(fromId, toId) {
  const fromIdx = tabs.findIndex((t) => t.id === fromId);
  const toIdx = tabs.findIndex((t) => t.id === toId);
  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
  const [moved] = tabs.splice(fromIdx, 1);
  tabs.splice(toIdx, 0, moved);
  sendTabsUpdate();
}

function cycleTab(dir) {
  if (tabs.length < 2) return;
  const idx = tabs.findIndex((t) => t.id === activeTabId);
  if (idx === -1) return;
  const next = tabs[(idx + dir + tabs.length) % tabs.length];
  switchTab(next.id);
}

function setZoom(delta) {
  const tab = activeTab();
  if (!tab) return;
  if (delta === 0) tab.zoom = 0;
  else tab.zoom = Math.max(-3, Math.min(5, tab.zoom + delta));
  tab.view.webContents.setZoomLevel(tab.zoom);
}

function toggleBookmark() {
  const tab = activeTab();
  if (!tab || !tab.url || tab.url.startsWith('file://')) return;
  store.update('bookmarks', (list) => {
    const bookmarks = list || [];
    const idx = bookmarks.findIndex((b) => b.url === tab.url);
    if (idx !== -1) bookmarks.splice(idx, 1);
    else bookmarks.unshift({ url: tab.url, title: tab.title || displayHost(tab.url), ts: Date.now() });
    return bookmarks;
  });
  sendTabsUpdate();
}

function showFindBar() {
  const tab = activeTab();
  if (!tab || tab.fullscreen || !mainWindow) return;
  if (!findBarView) {
    findBarView = new WebContentsView({
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
      },
    });
    findBarView.webContents.loadFile(path.join(__dirname, 'ui', 'find.html'));
  }
  if (!findBarVisible) {
    mainWindow.contentView.addChildView(findBarView);
    findBarVisible = true;
  }
  layout();
  findBarView.webContents.focus();
  findBarView.webContents.send('find:focus');
}

function hideFindBar() {
  if (findBarVisible && findBarView && mainWindow) {
    mainWindow.contentView.removeChildView(findBarView);
    findBarVisible = false;
    const wc = activeWebContents();
    if (wc) wc.stopFindInPage('clearSelection');
    layout();
  }
}

function toggleBrain() {
  if (!mainWindow) return;
  if (brainVisible) {
    if (brainView) mainWindow.contentView.removeChildView(brainView);
    brainVisible = false;
  } else {
    if (!brainView) {
      brainView = new WebContentsView({
        webPreferences: {
          preload: path.join(__dirname, 'ui', 'brain-preload.js'),
          contextIsolation: true,
          // WebGPU + inference run inside this view; everything stays local.
          sandbox: false,
        },
      });
      brainView.webContents.loadFile(path.join(__dirname, 'ui', 'brain.html'));
      // Links the model might include in its answers open in the active tab,
      // never in the brain panel itself.
      brainView.webContents.setWindowOpenHandler(({ url }) => {
        createTab(url);
        return { action: 'deny' };
      });
    }
    mainWindow.contentView.addChildView(brainView);
    brainVisible = true;
  }
  if (toolbarView) toolbarView.webContents.send('brain:state', brainVisible);
  layout();
}

function registerIpcHandlers() {
  ipcMain.on('nav:new-tab', (_e, url) => createTab(url || NEW_TAB_URL));
  ipcMain.on('nav:close-tab', (_e, id) => closeTab(id));
  ipcMain.on('nav:switch-tab', (_e, id) => switchTab(id));
  ipcMain.on('nav:reorder-tab', (_e, { fromId, toId }) => reorderTab(fromId, toId));
  ipcMain.on('nav:navigate', (_e, input) => {
    const wc = activeWebContents();
    if (wc) wc.loadURL(normalizeUrl(input, NEW_TAB_URL));
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
  ipcMain.on('tab:toggle-mute', (_e, id) => {
    const tab = tabs.find((t) => t.id === id);
    if (!tab) return;
    tab.muted = !tab.muted;
    tab.view.webContents.setAudioMuted(tab.muted);
    sendTabsUpdate();
  });

  ipcMain.on('bookmark:toggle', toggleBookmark);
  ipcMain.handle('bookmark:list', () => store.get('bookmarks') || []);
  ipcMain.on('bookmark:remove', (_e, url) => {
    store.update('bookmarks', (list) => (list || []).filter((b) => b.url !== url));
    sendTabsUpdate();
  });

  ipcMain.handle('history:list', () => store.get('history') || []);
  ipcMain.on('history:clear', () => {
    store.set('history', []);
  });

  ipcMain.on('find:query', (_e, { text, forward }) => {
    const wc = activeWebContents();
    if (!wc) return;
    if (!text) {
      wc.stopFindInPage('clearSelection');
      return;
    }
    wc.findInPage(text, { forward: forward !== false, findNext: false });
  });
  ipcMain.on('find:next', (_e, text) => {
    const wc = activeWebContents();
    if (wc && text) wc.findInPage(text, { forward: true, findNext: true });
  });
  ipcMain.on('find:prev', (_e, text) => {
    const wc = activeWebContents();
    if (wc && text) wc.findInPage(text, { forward: false, findNext: true });
  });
  ipcMain.on('find:close', hideFindBar);
  ipcMain.on('brain:toggle', toggleBrain);

  ipcMain.on('zoom:in', () => setZoom(0.5));
  ipcMain.on('zoom:out', () => setZoom(-0.5));
  ipcMain.on('zoom:reset', () => setZoom(0));
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const mod = isMac ? 'Cmd' : 'Ctrl';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Tab', accelerator: `${mod}+T`, click: () => createTab(NEW_TAB_URL) },
        { label: 'Close Tab', accelerator: `${mod}+W`, click: () => activeTabId != null && closeTab(activeTabId) },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Find on Page', accelerator: `${mod}+F`, click: showFindBar },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: `${mod}+R`, click: () => activeWebContents()?.reload() },
        { label: 'Stop', accelerator: 'Esc', click: () => activeWebContents()?.stop() },
        { type: 'separator' },
        { label: 'Zoom In', accelerator: `${mod}+=`, click: () => setZoom(0.5) },
        { label: 'Zoom Out', accelerator: `${mod}+-`, click: () => setZoom(-0.5) },
        { label: 'Actual Size', accelerator: `${mod}+0`, click: () => setZoom(0) },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'History',
      submenu: [
        { label: 'Back', accelerator: `${mod}+[`, click: () => { const wc = activeWebContents(); if (wc && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack(); } },
        { label: 'Forward', accelerator: `${mod}+]`, click: () => { const wc = activeWebContents(); if (wc && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward(); } },
        { type: 'separator' },
        { label: 'Show History', accelerator: `${mod}+Y`, click: () => createTab(`file://${path.join(__dirname, 'ui', 'history.html')}`) },
      ],
    },
    {
      label: 'Bookmarks',
      submenu: [
        { label: 'Bookmark This Page', accelerator: `${mod}+D`, click: toggleBookmark },
        { label: 'Show Bookmarks', accelerator: `${mod}+Shift+B`, click: () => createTab(`file://${path.join(__dirname, 'ui', 'bookmarks.html')}`) },
      ],
    },
    {
      label: 'Tab',
      submenu: [
        { label: 'Focus Address Bar', accelerator: `${mod}+L`, click: () => toolbarView?.webContents.send('toolbar:focus-address') },
        { label: 'Next Tab', accelerator: `${mod}+Alt+Right`, click: () => cycleTab(1) },
        { label: 'Previous Tab', accelerator: `${mod}+Alt+Left`, click: () => cycleTab(-1) },
      ],
    },
    {
      label: 'Tools',
      submenu: [
        { label: 'Toggle Brain Panel', accelerator: `${mod}+Shift+L`, click: toggleBrain },
      ],
    },
    { role: 'windowMenu' },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Hush on GitHub',
          click: () => require('electron').shell.openExternal('https://github.com/vishalmaheshkumar/hush'),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createMainWindow() {
  const iconPath = path.join(__dirname, 'ui', 'assets', 'icon.png');
  const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined;
  mainWindow = new BaseWindow({
    width: 1280,
    height: 860,
    minWidth: 640,
    minHeight: 420,
    title: 'Hush',
    icon,
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
    findBarView = null;
    findBarVisible = false;
    brainView = null;
    brainVisible = false;
    tabs = [];
    activeTabId = null;
  });

  createTab(NEW_TAB_URL);
  layout();
}

app.whenReady().then(async () => {
  setupStore();
  await setupAdblocker();
  blockDownloads();
  registerIpcHandlers();
  buildMenu();
  createMainWindow();

  if (process.env.HUSH_SMOKE === '1') {
    const active = activeTab();
    const done = () => {
      console.log('HUSH_SMOKE_READY');
      setTimeout(() => app.quit(), 100);
    };
    if (active && active.view.webContents.isLoadingMainFrame()) {
      active.view.webContents.once('did-finish-load', done);
    } else {
      done();
    }
  }
});

app.on('before-quit', () => {
  if (store) store.flush();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (!mainWindow) createMainWindow();
});

// Exported for test visibility; the app runs via `app.whenReady` above.
module.exports = { normalizeUrl, displayHost };
