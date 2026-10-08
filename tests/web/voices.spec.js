'use strict';
// Offline voices: they appear in the catalogue, and speak by themselves when nothing else can.
// No real voice is downloaded here: browser storage is filled with small stand-in files and the voice
// worker is replaced by a stand-in. The real voices are checked by tools/model-check (see docs/MODELS.md).
const { test, expect, onlyEngines, mouseClick } = require('../support/fixtures');

const { CACHE, mb, fakeDownloaded, cacheKeys, openSettings, row } = require('../support/model-helpers');

test.describe('Web app: offline voices', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), tgt: 'fa' } } });

  /** A stand-in for piper-worker.js that answers like the real one, and a silent audio player. */
  async function standIn(page, { devices = [] } = {}) {
    await page.evaluate(devices => {
      window.__posted = [];
      window.Worker = class {
        constructor(url) { this.url = String(url); }
        postMessage(m) {
          window.__posted.push(m);
          setTimeout(() => {
            const send = d => this.onmessage && this.onmessage({ data: d });
            if (m.cmd === 'speak') send({ type: 'audio', id: m.id, index: 0, last: true, rate: 22050, pcm: Float32Array.from({ length: 4410 }, (_, i) => Math.sin(i / 9) * 0.3) });
            send({ id: m.id, ok: true, res: true });
          }, 5);
        }
      };
      HTMLMediaElement.prototype.play = function () { setTimeout(() => this.dispatchEvent(new Event('ended')), 20); return Promise.resolve(); };
      speechSynthesis.getVoices = () => devices.map(l => ({ name: 'Device ' + l, lang: l, voiceURI: 'dev-' + l, localService: true }));
    }, devices);
  }
  async function voiceReady(page, id) {
    const cat = await page.evaluate(() => MODEL_CATALOG);
    const m = cat.models.find(x => x.id === id);
    await fakeDownloaded(page, m.repo, m.files);
    await page.evaluate(() => mcScan());
    return m;
  }

  test('the catalogue has Persian and English voices, each with its size, memory and what it is good for', async ({ app }) => {
    const { page } = app;
    const cat = await page.evaluate(() => MODEL_CATALOG);
    const voices = cat.models.filter(m => m.job === 'speak');
    expect(voices.map(v => v.lang).sort()).toContain('fa');
    expect(voices.map(v => v.lang)).toContain('en');
    await openSettings(page);
    await expect(page.locator('.mdl-grp')).toContainText([/Listening/, /Translation/, /Speaking/]);
    for (const v of voices) {
      await expect(row(page, v.id).locator('.mdl-m')).toContainText(`Download ${mb(v.bytes)} (+${mb(v.extraBytes)} speech engine, once)`);
      await expect(row(page, v.id).locator('.mdl-g')).not.toBeEmpty();
    }
  });

  test('no device voice, no Gemini key: the downloaded Persian voice speaks by itself and its name is shown', async ({ app }) => {
    const { page } = app;
    await standIn(page);
    expect(await page.evaluate(() => resolveVoice('fa').kind)).toBe('none');
    const m = await voiceReady(page, 'tts-fa-amir');
    expect(await page.evaluate(() => resolveVoice('fa').kind)).toBe('piper');
    await page.evaluate(() => speak('سلام، این یک آزمایش است.', 'fa'));
    await expect(page.locator('.voice-used').first()).toHaveText(/Persian · Amir.*\(offline voice\)/);
    const sent = await page.evaluate(() => window.__posted.filter(p => p.cmd === 'speak'));
    expect(sent).toHaveLength(1);
    expect(sent[0].a.voice.path).toBe(m.voice);
    expect(sent[0].a.text).toContain('سلام');
    expect(await page.evaluate(() => piperStats.voice)).toBe('tts-fa-amir');
  });

  test('Offline mode turns Gemini off, so the offline voice is used even with a Gemini key; online, Gemini still comes first', async ({ app }) => {
    const { page } = app;
    await standIn(page);
    await voiceReady(page, 'tts-fa-amir');
    await page.evaluate(() => { cfg.eng.gemini.key = 'AIzaFAKEKEYFORTEST'; cfg.offline = false; });
    expect(await page.evaluate(() => resolveVoice('fa').kind)).toBe('gemini');
    await page.evaluate(() => { cfg.offline = true; });
    expect(await page.evaluate(() => resolveVoice('fa').kind)).toBe('piper');
  });

  test('a device voice for the language is still preferred; the offline voice is used only if chosen in the voice menu', async ({ app }) => {
    const { page } = app;
    await standIn(page, { devices: ['fa-IR'] });
    await voiceReady(page, 'tts-fa-amir');
    expect(await page.evaluate(() => resolveVoice('fa').kind)).toBe('device');
    await openSettings(page);
    await page.evaluate(() => fillVoices());
    await page.locator('#voiceSel').selectOption('piper:tts-fa-amir');
    expect(await page.evaluate(() => resolveVoice('fa').kind)).toBe('piper');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mkt_cfg')).tts.voices.fa)).toBe('piper:tts-fa-amir');
  });

  test('when Gemini fails, the offline voice takes over instead of staying silent', async ({ app }) => {
    const { page } = app;
    await standIn(page);
    await voiceReady(page, 'tts-fa-amir');
    await page.evaluate(() => { cfg.eng.gemini.key = 'AIzaFAKEKEYFORTEST'; });
    await page.evaluate(() => { const tok = ++speakTok; return speakResolved('سلام', 'fa', tok, () => {}, () => {}, true); });
    expect(await page.evaluate(() => window.__posted.filter(p => p.cmd === 'speak').length)).toBe(1);
    await expect(page.locator('.voice-used').first()).toContainText('offline voice');
  });

  test('without a downloaded voice the message points at the offline voices', async ({ app }) => {
    const { page } = app;
    await standIn(page);
    await page.evaluate(() => speak('سلام', 'fa'));
    await expect(page.locator('#speakNoticeText')).toContainText('Engines & keys → Offline');
    expect(await page.evaluate(() => window.__posted.length)).toBe(0);
  });

  test('Delete removes only that voice\'s files; the other voice of the same language stays ready', async ({ app }) => {
    const { page } = app;
    await standIn(page);
    await voiceReady(page, 'tts-fa-amir');
    await voiceReady(page, 'tts-fa-ganji');
    await openSettings(page);
    await page.evaluate(() => offStatus());
    await expect(row(page, 'tts-fa-amir')).toHaveAttribute('data-state', 'ready');
    await expect(row(page, 'tts-fa-ganji')).toHaveAttribute('data-state', 'ready');
    await mouseClick(page, row(page, 'tts-fa-amir').locator('[data-act="rm"]'));
    await expect(row(page, 'tts-fa-amir')).toHaveAttribute('data-state', 'none');
    await expect(row(page, 'tts-fa-ganji')).toHaveAttribute('data-state', 'ready');
    const keys = await cacheKeys(page);
    expect(keys.some(u => u.includes('fa_IR-amir'))).toBe(false);
    expect(keys.some(u => u.includes('fa_IR-ganji'))).toBe(true);
  });

  test('downloaded voices appear in the voice menu for their language only', async ({ app }) => {
    const { page } = app;
    await standIn(page);
    await voiceReady(page, 'tts-fa-amir');
    await voiceReady(page, 'tts-en-alba');
    await page.evaluate(() => fillVoices());                // target language is Persian
    const opts = await page.locator('#voiceSel optgroup[label="Offline voices (downloaded)"] option').allTextContents();
    expect(opts).toEqual(['Persian · Amir (male)']);
  });
});
