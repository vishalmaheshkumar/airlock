const tabsEl = document.getElementById('tabs');
const addressEl = document.getElementById('address');
const backBtn = document.getElementById('back');
const forwardBtn = document.getElementById('forward');
const reloadBtn = document.getElementById('reload');
const newTabBtn = document.getElementById('newtab');
const pipBtn = document.getElementById('pip');
const starBtn = document.getElementById('star');

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

window.browserAPI.onTabsUpdated(render);
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
