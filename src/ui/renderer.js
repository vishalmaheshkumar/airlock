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
const engineMenu = document.getElementById('engine-menu');

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
  renderEngineMenu();
}

function renderEngineMenu() {
  engineMenu.innerHTML = '';
  for (const e of searchEngines) {
    const item = document.createElement('button');
    item.className = 'engine-menu-item' + (e.id === currentEngineId ? ' active' : '');
    item.setAttribute('role', 'menuitemradio');
    item.setAttribute('aria-checked', String(e.id === currentEngineId));

    const mark = document.createElement('span');
    mark.className = 'engine-mark';
    mark.textContent = e.short;

    const name = document.createElement('span');
    name.textContent = e.name;

    const check = document.createElement('span');
    check.className = 'engine-check';
    check.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

    item.appendChild(mark);
    item.appendChild(name);
    item.appendChild(check);
    item.onclick = () => {
      window.browserAPI.setSearchEngine(e.id);
      applyEngine(e.id);
      closeEngineMenu();
    };
    engineMenu.appendChild(item);
  }
}

function openEngineMenu() {
  engineMenu.hidden = false;
  engineChip.setAttribute('aria-expanded', 'true');
  // Delay so the click that opened it doesn't immediately close.
  setTimeout(() => document.addEventListener('click', onOutsideClick), 0);
  document.addEventListener('keydown', onMenuKey);
}

function closeEngineMenu() {
  engineMenu.hidden = true;
  engineChip.setAttribute('aria-expanded', 'false');
  document.removeEventListener('click', onOutsideClick);
  document.removeEventListener('keydown', onMenuKey);
}

function onOutsideClick(e) {
  if (!engineMenu.contains(e.target) && e.target !== engineChip && !engineChip.contains(e.target)) {
    closeEngineMenu();
  }
}

function onMenuKey(e) {
  if (e.key === 'Escape') closeEngineMenu();
}

engineChip.addEventListener('click', (e) => {
  e.stopPropagation();
  if (engineMenu.hidden) openEngineMenu();
  else closeEngineMenu();
});

async function initEngineUI() {
  try {
    [searchEngines, currentEngineId] = await Promise.all([
      window.browserAPI.listSearchEngines(),
      window.browserAPI.getSearchEngine(),
    ]);
    applyEngine(currentEngineId);
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
