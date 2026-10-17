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
async function fakeAiWorker(page, options = {}) {
  const prefix = options.prefix ?? '[fa] ';
  await page.route('**/ai-worker.js', route => {
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
}

if (typeof global !== 'undefined') {
  global.activateSettingsTab = activateSettingsTab;
  global.openSettings = openSettings;
}

module.exports = { CACHE, mb, fakeDownloaded, cacheKeys, openSettings, activateSettingsTab, row, fakeAiWorker };

