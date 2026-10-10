const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('makanCapture', {
  complete: (rect) => ipcRenderer.send('screen-trans:capture-complete', rect),
  cancel: () => ipcRenderer.send('screen-trans:capture-cancel')
});
