const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('browserAPI', {
  newTab: () => ipcRenderer.send('nav:new-tab'),
  closeTab: (id) => ipcRenderer.send('nav:close-tab', id),
  switchTab: (id) => ipcRenderer.send('nav:switch-tab', id),
  navigate: (input) => ipcRenderer.send('nav:navigate', input),
  back: () => ipcRenderer.send('nav:back'),
  forward: () => ipcRenderer.send('nav:forward'),
  reload: () => ipcRenderer.send('nav:reload'),
  stop: () => ipcRenderer.send('nav:stop'),
  pip: () => ipcRenderer.send('nav:pip'),
  onTabsUpdated: (callback) => {
    ipcRenderer.on('tabs-updated', (_event, data) => callback(data));
  },
});
