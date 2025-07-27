const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getLayout: () => ipcRenderer.send('get-layout'),
  onLayoutData: (callback) => ipcRenderer.on('layout-data', callback),
  getMediaPath: (relativePath) => ipcRenderer.invoke('get-media-path', relativePath)
});

