const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('makanCapture', {
  complete: (rect) => ipcRenderer.send('screen-trans:capture-complete', rect),
  cancel: () => ipcRenderer.send('screen-trans:capture-cancel'),
  onSnapshot: (callback) => {
    ipcRenderer.on('screen-trans:snapshot', (event, data) => callback(data));
  },
  requestSnapshot: () => ipcRenderer.send('screen-trans:request-snapshot')
});
