const tabsEl = document.getElementById('tabs');
const addressEl = document.getElementById('address');
const backBtn = document.getElementById('back');
const forwardBtn = document.getElementById('forward');
const reloadBtn = document.getElementById('reload');
const newTabBtn = document.getElementById('newtab');
const pipBtn = document.getElementById('pip');

function isInternalUrl(url) {
  return !url || url.startsWith('file://');
}

function render({ tabs, activeTabId }) {
  tabsEl.innerHTML = '';

  for (const tab of tabs) {
    const el = document.createElement('div');
    el.className = 'tab' + (tab.id === activeTabId ? ' active' : '');
    el.onclick = () => window.browserAPI.switchTab(tab.id);

    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = tab.loading ? 'Loading…' : tab.title || tab.url || 'New Tab';
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
}

window.browserAPI.onTabsUpdated(render);

addressEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    window.browserAPI.navigate(addressEl.value);
    addressEl.blur();
  }
});

backBtn.addEventListener('click', () => window.browserAPI.back());
forwardBtn.addEventListener('click', () => window.browserAPI.forward());
reloadBtn.addEventListener('click', () => window.browserAPI.reload());
newTabBtn.addEventListener('click', () => window.browserAPI.newTab());
pipBtn.addEventListener('click', () => window.browserAPI.pip());
