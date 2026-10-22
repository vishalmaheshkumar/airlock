const tabsEl = document.getElementById('tabs');
const addressEl = document.getElementById('address');
const backBtn = document.getElementById('back');
const forwardBtn = document.getElementById('forward');
const reloadBtn = document.getElementById('reload');
const newTabBtn = document.getElementById('newtab');
const pipBtn = document.getElementById('pip');
const starBtn = document.getElementById('star');
const brainBtn = document.getElementById('brain');
const engineChip = document.getElementById('engine-chip');
const engineChipLabel = document.getElementById('engine-chip-label');

let searchEngines = [];
let currentEngineId = null;

let draggingTabId = null;

function isInternalUrl(url) {
  return !url || url.startsWith('file://');
}

function render({ tabs, activeTabId, bookmarked }) {
  tabsEl.innerHTML = '';

  for (const tab of tabs) {
    const el = document.createElement('div');
    el.className = 'tab' + (tab.id === activeTabId ? ' active' : '');
    el.draggable = true;
    el.dataset.id = String(tab.id);
    el.onclick = () => window.browserAPI.switchTab(tab.id);

    el.addEventListener('dragstart', (e) => {
      draggingTabId = tab.id;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      // Firefox needs some payload.
      try { e.dataTransfer.setData('text/plain', String(tab.id)); } catch {}
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      draggingTabId = null;
      tabsEl.querySelectorAll('.tab.drag-over').forEach((n) => n.classList.remove('drag-over'));
    });
    el.addEventListener('dragover', (e) => {
      if (draggingTabId == null || draggingTabId === tab.id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      el.classList.add('drag-over');
    });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drag-over');
      if (draggingTabId != null && draggingTabId !== tab.id) {
        window.browserAPI.reorderTab(draggingTabId, tab.id);
      }
    });

    const favicon = document.createElement('span');
    favicon.className = 'tab-favicon' + (tab.loading ? ' loading' : '');
    el.appendChild(favicon);

    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = tab.loading && !tab.title ? 'Loading…' : (tab.title || tab.url || 'New Tab');
    el.appendChild(title);

    if (tab.audible || tab.muted) {
      const audio = document.createElement('button');
      audio.className = 'tab-audio' + (tab.muted ? ' muted' : '') + (tab.audible && !tab.muted ? ' live' : '');
      audio.title = tab.muted ? 'Unmute tab' : 'Mute tab';
      audio.setAttribute('aria-label', audio.title);
      if (tab.muted) {
        audio.innerHTML =
          '<svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">' +
          '<line x1="2" y1="4" x2="2" y2="8"/>' +
          '<line x1="5" y1="4" x2="5" y2="8"/>' +
          '<line x1="8" y1="4" x2="8" y2="8"/>' +
          '<line x1="1" y1="1" x2="11" y2="11" stroke-width="1.3"/>' +
          '</svg>';
      } else {
        audio.innerHTML =
          '<svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">' +
          '<line class="w1" x1="2" y1="4" x2="2" y2="8"/>' +
          '<line class="w2" x1="5" y1="3" x2="5" y2="9"/>' +
          '<line class="w3" x1="8" y1="5" x2="8" y2="7"/>' +
          '</svg>';
      }
      audio.onclick = (e) => {
        e.stopPropagation();
        window.browserAPI.toggleMute(tab.id);
      };
      el.appendChild(audio);
    }

    const close = document.createElement('span');
    close.className = 'tab-close';
    close.textContent = '×';
    close.onclick = (e) => {
      e.stopPropagation();
      window.browserAPI.closeTab(tab.id);
    };
    el.appendChild(close);

    tabsEl.appendChild(el);
  }

  const active = tabs.find((t) => t.id === activeTabId);
  if (active && document.activeElement !== addressEl) {
    addressEl.value = isInternalUrl(active.url) ? '' : active.url;
  }

  starBtn.classList.toggle('on', !!bookmarked);
  const starDisabled = !active || isInternalUrl(active.url);
  starBtn.disabled = starDisabled;
}

function applyEngine(id) {
  currentEngineId = id;
  const engine = searchEngines.find((e) => e.id === id);
  if (engine) {
    engineChipLabel.textContent = engine.short;
    engineChip.title = `Search engine: ${engine.name}`;
  }
}

// The dropdown is a native Electron popup menu, not an HTML element. HTML
// menus from the toolbar WebContentsView get clipped by its height — the
// native menu renders at the OS level and is keyboard-navigable for free.
engineChip.addEventListener('click', () => {
  const r = engineChip.getBoundingClientRect();
  window.browserAPI.showEngineMenu({ x: Math.round(r.left), y: Math.round(r.bottom + 2) });
});

async function initEngineUI() {
  try {
    const [list, active] = await Promise.all([
      window.browserAPI.listSearchEngines(),
      window.browserAPI.getSearchEngine(),
    ]);
    searchEngines = list || [];
    applyEngine(active);
  } catch (err) {
    console.error('[hush] engine init failed', err);
  }
}

window.browserAPI.onTabsUpdated((data) => {
  render(data);
  if (data.searchEngine && data.searchEngine !== currentEngineId) {
    applyEngine(data.searchEngine);
  }
});
window.browserAPI.onFocusAddress(() => {
  addressEl.focus();
  addressEl.select();
});

addressEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    window.browserAPI.navigate(addressEl.value);
    addressEl.blur();
  }
});
addressEl.addEventListener('focus', () => addressEl.select());

backBtn.addEventListener('click', () => window.browserAPI.back());
forwardBtn.addEventListener('click', () => window.browserAPI.forward());
reloadBtn.addEventListener('click', () => window.browserAPI.reload());
newTabBtn.addEventListener('click', () => window.browserAPI.newTab());
pipBtn.addEventListener('click', () => window.browserAPI.pip());
starBtn.addEventListener('click', () => {
  if (starBtn.disabled) return;
  window.browserAPI.toggleBookmark();
});
brainBtn.addEventListener('click', () => window.browserAPI.toggleBrain());

window.browserAPI.onBrainState?.((open) => {
  brainBtn.classList.toggle('on', !!open);
});

initEngineUI();
