const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('makanDesktop', {
  isDesktop: true,
  startScreenTranslator: () => ipcRenderer.send('screen-trans:start'),
  getOcrLanguages: () => ipcRenderer.invoke('screen-trans:get-languages'),
  getOcrEngines: () => ipcRenderer.invoke('screen-trans:get-engines'),
  getScreenTransConfig: () => ipcRenderer.invoke('screen-trans:get-config'),
  saveScreenTransConfig: (cfg) => ipcRenderer.invoke('screen-trans:save-config', cfg),
  loadAppConfig: () => ipcRenderer.invoke('app:load-config'),
  saveAppConfig: (cfg) => ipcRenderer.invoke('app:save-config', cfg),
  saveOcrModelFiles: (data) => ipcRenderer.invoke('screen-trans:save-ocr-model', data),
  getDesktopAudioSource: () => ipcRenderer.invoke('app:get-desktop-audio-source'),
  onExecuteScreenTranslation: (handler) => {
    ipcRenderer.on('execute-screen-translation', (event, payload) => {
      if (typeof handler === 'function') handler(payload);
    });
  },
  sendScreenTranslationResponse: (response) => {
    ipcRenderer.send('screen-trans:translation-response', response);
  },
  onLoadTranslationInput: (handler) => {
    ipcRenderer.on('load-translation-input', (event, payload) => {
      if (typeof handler === 'function') handler(payload);
    });
  }
});
