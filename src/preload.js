const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('browserAPI', {
  newTab: (url) => ipcRenderer.send('nav:new-tab', url),
  closeTab: (id) => ipcRenderer.send('nav:close-tab', id),
  switchTab: (id) => ipcRenderer.send('nav:switch-tab', id),
  reorderTab: (fromId, toId) => ipcRenderer.send('nav:reorder-tab', { fromId, toId }),
  navigate: (input) => ipcRenderer.send('nav:navigate', input),
  back: () => ipcRenderer.send('nav:back'),
  forward: () => ipcRenderer.send('nav:forward'),
  reload: () => ipcRenderer.send('nav:reload'),
  stop: () => ipcRenderer.send('nav:stop'),
  pip: () => ipcRenderer.send('nav:pip'),
  toggleMute: (id) => ipcRenderer.send('tab:toggle-mute', id),

  toggleBookmark: () => ipcRenderer.send('bookmark:toggle'),
  listBookmarks: () => ipcRenderer.invoke('bookmark:list'),
  removeBookmark: (url) => ipcRenderer.send('bookmark:remove', url),

  listHistory: () => ipcRenderer.invoke('history:list'),
  clearHistory: () => ipcRenderer.send('history:clear'),

  find: (text, forward) => ipcRenderer.send('find:query', { text, forward }),
  findNext: (text) => ipcRenderer.send('find:next', text),
  findPrev: (text) => ipcRenderer.send('find:prev', text),
  findClose: () => ipcRenderer.send('find:close'),
  onFindResult: (cb) => ipcRenderer.on('find:result', (_e, result) => cb(result)),
  onFindFocus: (cb) => ipcRenderer.on('find:focus', () => cb()),

  zoomIn: () => ipcRenderer.send('zoom:in'),
  zoomOut: () => ipcRenderer.send('zoom:out'),
  zoomReset: () => ipcRenderer.send('zoom:reset'),

  onTabsUpdated: (cb) => ipcRenderer.on('tabs-updated', (_e, data) => cb(data)),
  onFocusAddress: (cb) => ipcRenderer.on('toolbar:focus-address', () => cb()),
});
