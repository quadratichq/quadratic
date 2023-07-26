const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  maximizeCurrentWindow: () => ipcRenderer.send('maximize-current-window'),
  editorHasUnsavedChanges: (hasUnsavedChanges, where) =>
    ipcRenderer.send('has-unsaved-changes', hasUnsavedChanges, where),
});
