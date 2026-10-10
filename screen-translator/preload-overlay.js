const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('makanOverlay', {
  close: () => ipcRenderer.send('screen-trans:overlay-close'),
  setPinned: (pinned) => ipcRenderer.send('screen-trans:overlay-pin', pinned),
  requestTranslation: (req) => ipcRenderer.send('screen-trans:request-translate', req),
  openInMainApp: (data) => ipcRenderer.send('screen-trans:open-in-app', data),
  onOcrResult: (callback) => {
    ipcRenderer.on('ocr-result', (event, data) => {
      if (typeof callback === 'function') callback(data);
    });
  },
  onTranslationResult: (callback) => {
    ipcRenderer.on('translation-result', (event, data) => {
      if (typeof callback === 'function') callback(data);
    });
  }
});

