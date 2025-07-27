const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getLayout: () => ipcRenderer.send('get-layout'),
  onLayoutData: (callback) => ipcRenderer.on('layout-data', callback),
  getMediaPath: (relativePath) => ipcRenderer.invoke('get-media-path', relativePath),
  
  // Ayar penceresi API'leri
  testApiConnection: (apiUrl) => ipcRenderer.invoke('test-api-connection', apiUrl),
  saveConfig: (configData) => ipcRenderer.invoke('save-config', configData),
  getCurrentConfig: () => ipcRenderer.invoke('get-current-config')
});

