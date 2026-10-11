const { contextBridge, ipcRenderer } = require('electron');

let ocrCallback = null;
let bufferedOcrData = null;

let transCallback = null;
let bufferedTransData = null;

ipcRenderer.on('ocr-result', (event, data) => {
  if (typeof ocrCallback === 'function') {
    ocrCallback(data);
  } else {
    bufferedOcrData = data;
  }
});

ipcRenderer.on('translation-result', (event, data) => {
  if (typeof transCallback === 'function') {
    transCallback(data);
  } else {
    bufferedTransData = data;
  }
});

contextBridge.exposeInMainWorld('makanOverlay', {
  close: () => ipcRenderer.send('screen-trans:overlay-close'),
  setPinned: (pinned) => ipcRenderer.send('screen-trans:overlay-pin', pinned),
  requestTranslation: (req) => ipcRenderer.send('screen-trans:request-translate', req),
  openInMainApp: (data) => ipcRenderer.send('screen-trans:open-in-app', data),
  ready: () => ipcRenderer.send('screen-trans:overlay-ready'),
  toggleLiveWatcher: () => ipcRenderer.send('screen-trans:toggle-live-watcher'),
  reselectZone: () => ipcRenderer.send('screen-trans:reselect-zone'),
  onLiveState: (callback) => {
    ipcRenderer.on('screen-trans:live-state', (event, state) => {
      if (typeof callback === 'function') callback(state);
    });
  },
  onOcrResult: (callback) => {
    ocrCallback = callback;
    if (bufferedOcrData && typeof callback === 'function') {
      const data = bufferedOcrData;
      bufferedOcrData = null;
      callback(data);
    }
  },
  onTranslationResult: (callback) => {
    transCallback = callback;
    if (bufferedTransData && typeof callback === 'function') {
      const data = bufferedTransData;
      bufferedTransData = null;
      callback(data);
    }
  }
});
