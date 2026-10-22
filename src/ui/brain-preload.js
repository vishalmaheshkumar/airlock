// Preload for the brain panel. It is a browser-y page that runs web-llm, so
// it only needs a very small bridge back to the browser proper.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hushBrain', {
  close: () => ipcRenderer.send('brain:toggle'),
  openInActiveTab: (url) => ipcRenderer.send('nav:navigate', url),
  openInNewTab: (url) => ipcRenderer.send('nav:new-tab', url),
});
