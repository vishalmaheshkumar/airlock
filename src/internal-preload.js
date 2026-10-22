// Preload for Hush's internal pages (newtab, bookmarks, history).
// Exposes a narrow API only; it never ships to a remote site.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hush', {
  navigate: (input) => ipcRenderer.send('nav:navigate', input),
  openInNewTab: (url) => ipcRenderer.send('nav:new-tab', url),
  listBookmarks: () => ipcRenderer.invoke('bookmark:list'),
  removeBookmark: (url) => ipcRenderer.send('bookmark:remove', url),
  listHistory: () => ipcRenderer.invoke('history:list'),
  clearHistory: () => ipcRenderer.send('history:clear'),
});
