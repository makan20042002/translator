'use strict';
// Shared by the model catalogue tests: fake "downloaded" models and small page helpers.
const { expect, mouseClick } = require('./fixtures');

const CACHE = 'transformers-cache';
const mb = b => b >= 1073741824 ? (b / 1073741824).toFixed(1) + ' GB' : Math.max(1, Math.round(b / 1048576)) + ' MB';

/** Put stand-in files for a model into the storage the model library uses. */
async function fakeDownloaded(page, repo, files) {
  await page.evaluate(async ({ CACHE, repo, files }) => {
    const c = await caches.open(CACHE);
    for (const [name, size] of files) {
      await c.put(`https://huggingface.co/${repo}/resolve/main/${name}`, new Response(new Uint8Array(8), { headers: { 'content-length': String(size) } }));
    }
  }, { CACHE, repo, files });
}
const cacheKeys = page => page.evaluate(async CACHE => (await (await caches.open(CACHE)).keys()).map(r => r.url), CACHE);
const TAB_MAP = {
  engines: { btn: '#setTabBtnEngines', sec: '#secEngines' },
  secEngines: { btn: '#setTabBtnEngines', sec: '#secEngines' },
  '#secEngines': { btn: '#setTabBtnEngines', sec: '#secEngines' },
  setTabBtnEngines: { btn: '#setTabBtnEngines', sec: '#secEngines' },
  '#setTabBtnEngines': { btn: '#setTabBtnEngines', sec: '#secEngines' },

  voices: { btn: '#setTabBtnVoices', sec: '#secVoices' },
  secVoices: { btn: '#setTabBtnVoices', sec: '#secVoices' },
  '#secVoices': { btn: '#setTabBtnVoices', sec: '#secVoices' },
  setTabBtnVoices: { btn: '#setTabBtnVoices', sec: '#secVoices' },
  '#setTabBtnVoices': { btn: '#setTabBtnVoices', sec: '#secVoices' },

  voiceModels: { btn: '#setTabBtnVoiceModels', sec: '#secVoiceModels' },
  voicemodels: { btn: '#setTabBtnVoiceModels', sec: '#secVoiceModels' },
  speech: { btn: '#setTabBtnVoiceModels', sec: '#secVoiceModels' },
  secVoiceModels: { btn: '#setTabBtnVoiceModels', sec: '#secVoiceModels' },
  '#secVoiceModels': { btn: '#setTabBtnVoiceModels', sec: '#secVoiceModels' },
  setTabBtnVoiceModels: { btn: '#setTabBtnVoiceModels', sec: '#secVoiceModels' },
  '#setTabBtnVoiceModels': { btn: '#setTabBtnVoiceModels', sec: '#secVoiceModels' },

  trModels: { btn: '#setTabBtnTrModels', sec: '#secTrModels' },
  trmodels: { btn: '#setTabBtnTrModels', sec: '#secTrModels' },
  models: { btn: '#setTabBtnTrModels', sec: '#secTrModels' },
  modelHub: { btn: '#setTabBtnTrModels', sec: '#secTrModels' },
  modelhub: { btn: '#setTabBtnTrModels', sec: '#secTrModels' },
  hub: { btn: '#setTabBtnTrModels', sec: '#secTrModels' },
  offline: { btn: '#setTabBtnTrModels', sec: '#secTrModels' },
  secTrModels: { btn: '#setTabBtnTrModels', sec: '#secTrModels' },
  '#secTrModels': { btn: '#setTabBtnTrModels', sec: '#secTrModels' },
  setTabBtnTrModels: { btn: '#setTabBtnTrModels', sec: '#secTrModels' },
  '#setTabBtnTrModels': { btn: '#setTabBtnTrModels', sec: '#secTrModels' },

  ocr: { btn: '#setTabBtnOcr', sec: '#secOcr' },
  secOcr: { btn: '#setTabBtnOcr', sec: '#secOcr' },
  '#secOcr': { btn: '#setTabBtnOcr', sec: '#secOcr' },
  setTabBtnOcr: { btn: '#setTabBtnOcr', sec: '#secOcr' },
  '#setTabBtnOcr': { btn: '#setTabBtnOcr', sec: '#secOcr' },

  dict: { btn: '#setTabBtnDict', sec: '#secDict' },
  dictionary: { btn: '#setTabBtnDict', sec: '#secDict' },
  secDict: { btn: '#setTabBtnDict', sec: '#secDict' },
  '#secDict': { btn: '#setTabBtnDict', sec: '#secDict' },
  setTabBtnDict: { btn: '#setTabBtnDict', sec: '#secDict' },
  '#setTabBtnDict': { btn: '#setTabBtnDict', sec: '#secDict' }
};

async function activateSettingsTab(page, tab) {
  if (!tab) return;
  const info = TAB_MAP[tab] || { btn: tab.startsWith('#') ? tab : `#${tab}`, sec: '' };
  const btn = page.locator(info.btn);
  await mouseClick(page, btn);
  if (info.sec) {
    await expect(page.locator(info.sec)).toBeVisible();
  } else {
    const secId = await btn.getAttribute('data-sec');
    if (secId) await expect(page.locator(`#${secId}`)).toBeVisible();
  }
}

const openSettings = async (page, tab) => {
  const ov = page.locator('#ov');
  const isOpen = await ov.evaluate(el => el.classList.contains('on')).catch(() => false);
  if (!isOpen) {
    await mouseClick(page, page.locator('#openSet'));
    await expect(ov).toHaveClass(/\bon\b/);
  }
  if (tab) {
    await activateSettingsTab(page, tab);
  }
};
const row = (page, id) => page.locator(`[data-mdl="${id}"]`);

/** Intercept ai-worker.js with a tiny fake worker matching the real message protocol */
async function fakeAiWorker(target, options = {}) {
  const context = (typeof target.context === 'function' ? target.context() : target);
  if (typeof target.evaluate === 'function') {
    await target.evaluate(async () => {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const reg of regs) await reg.unregister();
        } catch (_) {}
      }
    }).catch(() => {});
  }
  const prefix = options.prefix ?? '[fa] ';
  const workerRequests = [];
  await context.route('**/ai-worker.js', route => {
    workerRequests.push({
      url: route.request().url(),
      method: route.request().method()
    });
    if (typeof options.onRequest === 'function') {
      try { options.onRequest(route.request()); } catch (_) {}
    }
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        self.onmessage = (e) => {
          const { id, cmd, a } = e.data || {};
          if (cmd === 'translate') {
            const items = a?.items || a?.texts || [];
            const res = items.map(t => ${JSON.stringify(prefix)} + t);
            self.postMessage({ id, ok: true, res });
          } else if (cmd === 'loadTr' || cmd === 'loadAsr') {
            self.postMessage({ id, ok: true, res: true });
          } else if (cmd === 'stats') {
            self.postMessage({ id, ok: true, res: [] });
          } else if (cmd === 'unload') {
            self.postMessage({ id, ok: true, res: true });
          } else {
            self.postMessage({ id, ok: true, res: true });
          }
        };
      `
    });
  });
  return {
    requests: workerRequests,
    wasRequested: () => workerRequests.length > 0
  };
}

/**
 * Creates a valid 16 kHz mono PCM WAV Buffer of given duration with a non-silent sine tone.
 */
function createTestWav(durationSec = 3.0, sampleRate = 16000) {
  const numSamples = Math.floor(durationSec * sampleRate);
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < numSamples; i++) {
    const val = Math.round(Math.sin(2 * Math.PI * 440 * i / sampleRate) * 8000);
    buf.writeInt16LE(val, 44 + i * 2);
  }
  return buf;
}

/**
 * Configures window.MediaTranslate.host with getWhisperChoice, translateCues,
 * and a fake speech worker returning realistic chunks so subtitle cues and the
 * translation card (.mt-tr) are produced.
 */
async function fakeMediaTranscription(page) {
  await page.evaluate(() => {
    window.MediaTranslate = window.MediaTranslate || {};
    window.MediaTranslate.host = window.MediaTranslate.host || {};
    window.MediaTranslate.host.getWhisperChoice = () => ({
      repo: 'Xenova/whisper-tiny',
      name: 'Whisper Tiny',
      memMB: 500,
      ready: true,
      gpu: false
    });
    if (typeof window.MediaTranslate.host.translateCues !== 'function') {
      window.MediaTranslate.host.translateCues = async (cues) => cues.map(c => ({ s: c.s, e: c.e, o: c.o, t: '[fa] ' + (c.o || '') }));
    }
    window.MediaTranslate.host.engine = {
      libUrl: 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1',
      workerFactory: function () {
        const self = {
          onmessage: null,
          onerror: null,
          postMessage: function (data) {
            const { id, cmd } = data || {};
            setTimeout(() => {
              if (!self.onmessage) return;
              if (cmd === 'init') {
                self.onmessage({ data: { id, ok: true, res: true } });
              } else if (cmd === 'load') {
                self.onmessage({ data: { id, ok: true, res: { device: 'wasm', threads: 1 } } });
              } else if (cmd === 'asr') {
                self.onmessage({
                  data: {
                    id,
                    ok: true,
                    res: {
                      text: 'Hello world. Welcome to the media translator test.',
                      chunks: [
                        { text: 'Hello world.', timestamp: [0.0, 1.5] },
                        { text: 'Welcome to the media translator test.', timestamp: [1.5, 3.0] }
                      ],
                      lang: 'en'
                    }
                  }
                });
              } else {
                self.onmessage({ data: { id, ok: true, res: true } });
              }
            }, 10);
          },
          terminate: function () {}
        };
        return self;
      }
    };
  });
}

if (typeof global !== 'undefined') {
  global.activateSettingsTab = activateSettingsTab;
  global.openSettings = openSettings;
}

module.exports = { CACHE, mb, fakeDownloaded, cacheKeys, openSettings, activateSettingsTab, row, fakeAiWorker, createTestWav, fakeMediaTranscription };

