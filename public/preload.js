const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  maximizeCurrentWindow: () => ipcRenderer.send('maximize-current-window'),
});
