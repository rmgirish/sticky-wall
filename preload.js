const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadNotes: () => ipcRenderer.invoke('notes:load'),
  saveNotes: (notes) => ipcRenderer.invoke('notes:save', notes),
  toggleWall: () => ipcRenderer.send('wall:toggle'),
  hideTab: () => ipcRenderer.send('tab:hide'),
  onTabHover: (callback) => ipcRenderer.on('tab:hover', (_event, near) => callback(near)),
  onWallSet: (callback) => ipcRenderer.on('wall:set', (_event, open) => callback(open)),
  logError: (message) => ipcRenderer.send('log:error', message),
});
