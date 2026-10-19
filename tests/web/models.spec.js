'use strict';
// Engines & keys → Offline: the model catalogue (Download, Delete, ready state, storage total),
// which downloaded model is used, and the guards around speech recognition.
// No real model is downloaded here: the browser's model storage is filled with small stand-in files,
// which is exactly what "downloaded" looks like to the page. Real downloads are checked by
// tools/model-check (see docs/MODELS.md).
const { test, expect, onlyEngines, mouseClick } = require('../support/fixtures');

const { CACHE, mb, fakeDownloaded, cacheKeys, openSettings, activateSettingsTab, row } = require('../support/model-helpers');

test.describe('Web app: offline model catalogue', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

  test('lists every model by job, with size, memory, WebGPU, languages and a one-line use', async ({ app }) => {
    const { page } = app;
    const cat = await page.evaluate(() => MODEL_CATALOG);
    await openSettings(page, 'trModels');
    await expect(page.locator('.mdl-grp')).toContainText([/Listening/, /Translation/]);
    expect(cat.models.length).toBeGreaterThan(5);
    // With WebGPU the app downloads other files for Tiny/Base/Small (gpuBytes): expect the size of the path this browser takes.
    const gpu = await page.evaluate(async () => { await checkWebGpu(); mcRender(); return hasWebGpu; });
    for (const m of cat.models) {
      const r = row(page, m.id);
      await expect(r, m.id).toHaveCount(1);
      await expect(r.locator('strong').first()).toHaveText(m.name.en || m.name);
      await expect(r.locator('.mdl-m')).toContainText(`Download ${mb(gpu && m.gpuBytes ? m.gpuBytes : m.bytes)}`);
      await expect(r.locator('.mdl-m')).toContainText('Memory ≈');
      await expect(r.locator('.mdl-m')).toContainText('WebGPU:');
      await expect(r.locator('.mdl-m')).toContainText('Languages:');
      await expect(r.locator('.mdl-g')).not.toBeEmpty();
      expect(m.bytes, `${m.id} size comes from the Hugging Face API`).toBeGreaterThan(1_000_000);
      expect(m.files.length, m.id).toBeGreaterThanOrEqual(2);       // model + settings at least
    }
  });

  test('Tiny, Base, Small and Large v3 Turbo are listed; Small and above are recommended for languages other than English', async ({ app }) => {
    const { page } = app;
    await openSettings(page, 'trModels');
    for (const k of ['tiny', 'base', 'small', 'large-v3-turbo']) await expect(row(page, 'asr-' + k)).toHaveCount(1);
    for (const k of ['small', 'large-v3-turbo']) await expect(row(page, 'asr-' + k).locator('.badge.rec')).toHaveCount(1);
    for (const k of ['tiny', 'base']) {
      await expect(row(page, 'asr-' + k).locator('.badge.rec')).toHaveCount(0);
      await expect(row(page, 'asr-' + k).locator('.badge.warn')).toHaveCount(1);
    }
  });

  test('Whisper Medium is not offered: in a real browser its engine cannot allocate the memory it needs (see docs/MODELS.md)', async ({ app }) => {
    const { page } = app;
    await openSettings(page, 'trModels');
    await expect(row(page, 'asr-medium')).toHaveCount(0);
  });

  test('nothing is downloaded: every row says so, the storage total is 0, and Download is offered', async ({ app }) => {
    const { page } = app;
    await openSettings(page, 'trModels');
    const rows = page.locator('[data-mdl]');
    const n = await rows.count();
    for (let i = 0; i < n; i++) {
      await expect(rows.nth(i)).toHaveAttribute('data-state', 'none');
      await expect(rows.nth(i).locator('[data-act="dl"]')).toBeVisible();
      await expect(rows.nth(i).locator('[data-act="rm"]')).toBeHidden();
    }
    await expect(page.locator('#mdlTotal')).toContainText('Stored on this device by these models: 0 MB (0)');
  });

  test('a downloaded model shows ready with its size; Delete empties the storage and the total; other models are untouched', async ({ app }) => {
    const { page } = app;
    const cat = await page.evaluate(() => MODEL_CATALOG);
    const small = cat.models.find(m => m.id === 'asr-small'), base = cat.models.find(m => m.id === 'asr-base');
    await page.evaluate(({ a, b }) => { store.set('mdl', { 'asr-small': { at: 1, files: a }, 'asr-base': { at: 1, files: b } }); }, { a: small.files.map(f => f[0]).filter(f => f.endsWith('.onnx')), b: base.files.map(f => f[0]).filter(f => f.endsWith('.onnx')) });
    await fakeDownloaded(page, small.repo, small.files);
    await fakeDownloaded(page, base.repo, base.files);
    await openSettings(page, 'trModels');
    await page.evaluate(() => offStatus());
    await expect(row(page, 'asr-small')).toHaveAttribute('data-state', 'ready');
    await expect(row(page, 'asr-small').locator('.mdl-h .meta')).toContainText('ready · ' + mb(small.bytes));
    await expect(row(page, 'asr-large-v3-turbo')).toHaveAttribute('data-state', 'none');
    await expect(page.locator('#mdlTotal')).toContainText(`${mb(small.bytes + base.bytes)} (2)`);

    await mouseClick(page, row(page, 'asr-small').locator('[data-act="rm"]'));
    await expect(row(page, 'asr-small')).toHaveAttribute('data-state', 'none');
    await expect(page.locator('#mdlTotal')).toContainText(`${mb(base.bytes)} (1)`);
    const left = await cacheKeys(page);
    expect(left.some(u => u.includes('whisper-small')), 'files of the deleted model').toBe(false);
    expect(left.some(u => u.includes('whisper-base')), 'files of the other model').toBe(true);
    await expect(row(page, 'asr-base')).toHaveAttribute('data-state', 'ready');
  });

  test('a model whose files vanished from browser storage is shown as not downloaded, even if it was marked done', async ({ app }) => {
    const { page } = app;
    await page.evaluate(() => { store.set('nllb', true); store.set('whisper_wasm', 'base'); store.set('whisper', 'base'); });
    await openSettings(page, 'trModels');
    await page.evaluate(() => offStatus());
    await expect(row(page, 'tr-nllb-600')).toHaveAttribute('data-state', 'none');
    await expect(row(page, 'asr-base')).toHaveAttribute('data-state', 'none');
    expect(await page.evaluate(() => trAnyReady())).toBe(false);
  });

  test('people who already downloaded the original two models keep them, with the same default choices', async ({ app }) => {
    const { page } = app;
    const cat = await page.evaluate(() => MODEL_CATALOG);
    const nllb = cat.models.find(m => m.id === 'tr-nllb-600'), base = cat.models.find(m => m.id === 'asr-base');
    // what version 1 of the app saved: only the old flags
    await page.evaluate(() => { store.set('nllb', true); store.set('whisper_wasm', 'base'); store.set('whisper', 'base'); });
    await fakeDownloaded(page, nllb.repo, nllb.files);
    await fakeDownloaded(page, base.repo, base.files);
    await openSettings(page, 'trModels');
    await page.evaluate(() => offStatus());
    await expect(row(page, 'tr-nllb-600')).toHaveAttribute('data-state', 'ready');
    await expect(row(page, 'asr-base')).toHaveAttribute('data-state', 'ready');
    const s = await page.evaluate(() => ({ whisper: cfg.whisper, tr: cfg.trModel, pair: cfg.trPair, ready: asrReady(), eng: why('nllb'), pick: pickTr('en', 'fa')?.id }));
    expect(s).toEqual({ whisper: 'base', tr: 'tr-nllb-600', pair: false, ready: true, eng: '', pick: 'tr-nllb-600' });
    await expect(row(page, 'asr-base').locator('input[data-act="use"]')).toBeChecked();
    await expect(row(page, 'tr-nllb-600').locator('input[data-act="use"]')).toBeChecked();
  });

  test('the original NLLB download button keeps its id', async ({ app }) => {
    const { page } = app;
    await openSettings(page, 'trModels');
    await expect(page.locator('#dlTr')).toBeVisible();
    await expect(page.locator('#dlTr')).toHaveText('Download');
  });

  test('a failed download is reported and leaves the model not downloaded', async ({ app }) => {
    test.setTimeout(60_000);
    const { page } = app;
    await openSettings(page, 'trModels');
    await mouseClick(page, row(page, 'asr-tiny').locator('[data-act="dl"]'));
    await expect(page.locator('.toast.err').first()).toBeVisible({ timeout: 30_000 });
    await expect(row(page, 'asr-tiny')).toHaveAttribute('data-state', 'failed');
    await expect(row(page, 'asr-tiny').locator('.hub-model-error')).toBeVisible();
    expect(await page.evaluate(() => store.get('mdl', {})['asr-tiny'])).toBeUndefined();
  });

  test('Use switches the listening model; the choice is saved', async ({ app }) => {
    const { page } = app;
    const cat = await page.evaluate(() => MODEL_CATALOG);
    for (const id of ['asr-base', 'asr-small']) {
      const m = cat.models.find(x => x.id === id);
      await page.evaluate(({ id, f }) => { const d = store.get('mdl', {}); d[id] = { at: 1, files: f }; store.set('mdl', d); }, { id, f: m.files.map(f => f[0]).filter(f => f.endsWith('.onnx')) });
      await fakeDownloaded(page, m.repo, m.files);
    }
    await openSettings(page, 'trModels');
    await page.evaluate(() => offStatus());
    await mouseClick(page, row(page, 'asr-small').locator('input[data-act="use"]'));
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mkt_cfg')).whisper)).toBe('small');
    await expect(row(page, 'asr-small')).toHaveClass(/inuse/);
    expect(await page.evaluate(() => asrModel().id)).toBe('asr-small');
  });

  test('the list and its labels follow the interface language', async ({ app }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#uiLang'));
    await openSettings(page, 'trModels');
    await expect(page.locator('.mdl-grp').first()).toContainText('شنیدن');
    await expect(row(page, 'asr-small').locator('.badge.rec')).toContainText('غیر از انگلیسی');
    await expect(row(page, 'asr-small').locator('[data-act="dl"]')).toHaveText('دانلود');
  });
});

test.describe('Web app: which offline translation model is used', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['nllb']) } } });

  async function ready(page, ids) {
    const cat = await page.evaluate(() => MODEL_CATALOG);
    for (const id of ids) {
      const m = cat.models.find(x => x.id === id);
      await page.evaluate(({ id, f }) => { const d = store.get('mdl', {}); d[id] = { at: 1, files: f }; store.set('mdl', d); }, { id, f: m.files.map(f => f[0]).filter(f => f.endsWith('.onnx')) });
      await fakeDownloaded(page, m.repo, m.files);
    }
    await page.evaluate(() => mcScan());
  }

  test('with only a pair model downloaded, it is used for its pair and the engine says no for any other pair', async ({ app }) => {
    const { page } = app;
    await ready(page, ['tr-opus-en-de']);
    const r = await page.evaluate(() => ({ any: trAnyReady(), deen: pickTr('en', 'de')?.id, enfa: pickTr('en', 'fa')?.id ?? null, ende_rev: pickTr('de', 'en')?.id ?? null }));
    expect(r).toEqual({ any: true, deen: 'tr-opus-en-de', enfa: null, ende_rev: null });
  });

  test('the multilingual model is used by default; the pair model only when the box is ticked', async ({ app }) => {
    const { page } = app;
    await ready(page, ['tr-nllb-600', 'tr-opus-en-de']);
    expect(await page.evaluate(() => pickTr('en', 'de').id)).toBe('tr-nllb-600');
    await openSettings(page, 'trModels');
    await page.evaluate(() => offStatus());
    await mouseClick(page, page.locator('#mdlPrefPair'));
    expect(await page.evaluate(() => pickTr('en', 'de').id)).toBe('tr-opus-en-de');
    expect(await page.evaluate(() => pickTr('en', 'fa').id), 'a pair without a pair model still uses the multilingual one').toBe('tr-nllb-600');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mkt_cfg')).trPair)).toBe(true);
  });

  test('another multilingual model can be chosen; only the languages it was tested with are offered', async ({ app }) => {
    const { page } = app;
    await ready(page, ['tr-nllb-600', 'tr-m2m100-418']);
    await page.evaluate(() => { cfg.trModel = 'tr-m2m100-418'; });
    expect(await page.evaluate(() => pickTr('en', 'fa').id)).toBe('tr-m2m100-418');
    expect(await page.evaluate(() => pickTr('en', 'ja').id), 'Japanese is not enabled for M2M-100').toBe('tr-nllb-600');
  });

  test('the request to the worker names the chosen model and uses the right language codes', async ({ app }) => {
    const { page } = app;
    await ready(page, ['tr-m2m100-418']);
    await page.evaluate(() => { cfg.trModel = 'tr-m2m100-418'; window.__sent = null; window.rpc2 = rpc; });
    const sent = await page.evaluate(async () => {
      // stand-in for the worker: record what would be sent
      const real = Worker.prototype.postMessage;
      let msg = null;
      Worker.prototype.postMessage = function (m) { msg = m; Worker.prototype.postMessage = real; };
      eNllb(['hi'], 'en', 'fa').catch(() => {});
      await new Promise(r => setTimeout(r, 300));
      return msg;
    });
    expect(sent.cmd).toBe('translate');
    expect(sent.a.spec).toEqual({ repo: 'Xenova/m2m100_418M', kind: 'm2m100' });
    expect([sent.a.src, sent.a.tgt]).toEqual(['en', 'fa']);
  });
});

test.describe('Web app: speech recognition guards', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

  test('a transcript stuck in a loop is cut to one copy; normal repetition is left alone', async ({ app }) => {
    const { page } = app;
    const r = await page.evaluate(async () => {
      const g = await import('./asr-guard.js');
      return {
        loop: g.collapseRepeats('Thank you. '.repeat(40)),
        phrase: g.collapseRepeats('and then we went home and then we went home and then we went home and then we went home and then we slept'),
        normal: g.collapseRepeats('It was very very very good, no no no, I said no.'),
        persian: g.collapseRepeats('ممنون ' .repeat(30) + 'خداحافظ'),
        cjk: g.collapseRepeats('谢谢谢谢谢谢谢谢谢谢谢谢谢谢谢谢谢谢谢谢'),
        runaway: g.looksRunaway('word '.repeat(50)),
        fine: g.looksRunaway('A normal sentence about the weather today.'),
        empty: g.looksRunaway(''),
        tooMany: g.looksRunaway('a b c d e f g h i j k l m n o p q r s t', 2)
      };
    });
    expect(r.loop).toBe('Thank you.');
    expect(r.phrase).toBe('and then we went home and then we slept');
    expect(r.normal).toBe('It was very very very good, no no no, I said no.');
    expect(r.persian).toBe('ممنون خداحافظ');
    expect(r.cjk.length).toBeLessThan(10);
    expect(r.runaway).toBe(true);
    expect(r.fine).toBe(false);
    expect(r.empty).toBe(true);
    expect(r.tooMany).toBe(true);
  });

  test('the token limit and the waiting time both grow with the length of the audio', async ({ app }) => {
    const { page } = app;
    const r = await page.evaluate(async () => {
      const g = await import('./asr-guard.js');
      return {
        tokens: [3, 10, 30, 600].map(g.maxTokensFor),
        wait: [5, 30, 120, 600].map(s => g.asrBudgetMs(s, 1, false)),
        slow: g.asrBudgetMs(30, 3, false), fast: g.asrBudgetMs(30, 0.3, false),
        loadExtra: g.asrBudgetMs(10, 1, true) - g.asrBudgetMs(10, 1, false)
      };
    });
    expect(r.tokens[0]).toBeLessThan(r.tokens[1]);
    expect(r.tokens[1]).toBeLessThan(r.tokens[2]);
    expect(r.tokens[3]).toBe(r.tokens[2]);          // a recording is read in 30-second windows
    expect(r.tokens[2]).toBeLessThanOrEqual(448);
    for (let i = 1; i < r.wait.length; i++) expect(r.wait[i]).toBeGreaterThan(r.wait[i - 1]);
    expect(r.wait[0]).toBeGreaterThan(20_000);
    expect(r.wait[3]).toBeGreaterThan(10 * 60_000 / 2);
    expect(r.slow).toBeGreaterThan(r.fast);
    expect(r.loadExtra).toBeGreaterThan(0);
  });

  test('"working" is still cut off after 20 seconds by default, but a long job that reports progress is not', async ({ app }) => {
    const { page } = app;
    await page.clock.install();
    await page.evaluate(() => setVoiceState('working'));
    await page.clock.fastForward(21_000);
    expect(await page.evaluate(() => voiceState)).toBe('ready');

    await page.evaluate(() => { setVoiceState('working'); armWorking(180_000); });
    await page.clock.fastForward(100_000);
    expect(await page.evaluate(() => voiceState)).toBe('working');
    // progress from the worker keeps it alive and shows how far it is
    await page.evaluate(() => { asrJob = { id: 7, sec: 100 }; onAsrProg({ id: 7, frac: 0.4, chunk: 2, chunks: 5 }); });
    await expect(page.locator('#vStatusText')).toHaveText('Transcribing… 40% · 2/5');
    await page.clock.fastForward(50_000);
    expect(await page.evaluate(() => voiceState)).toBe('working');
    await page.clock.fastForward(20_000);                 // no news for more than a minute
    expect(await page.evaluate(() => voiceState)).toBe('ready');
  });
});

test.describe('Web app: the result says which offline model translated', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['nllb']) } } });

  test('the engine label names the downloaded model that was used', async ({ app }) => {
    const { page } = app;
    const cat = await page.evaluate(() => MODEL_CATALOG);
    for (const id of ['tr-nllb-600', 'tr-opus-en-de']) {
      const m = cat.models.find(x => x.id === id);
      await page.evaluate(({ id, f }) => { const d = store.get('mdl', {}); d[id] = { at: 1, files: f }; store.set('mdl', d); }, { id, f: m.files.map(f => f[0]).filter(f => f.endsWith('.onnx')) });
      await fakeDownloaded(page, m.repo, m.files);
    }
    await page.evaluate(() => mcScan());
    // stand-in worker that "translates" by marking the text
    // The stand-in replaces Worker before the app creates one: the real worker cannot start in the test and would report an error first.
    const labels = await page.evaluate(async () => {
      window.Worker = class {
        constructor(url) { this.url = String(url); }
        postMessage(m) { setTimeout(() => this.onmessage && this.onmessage({ data: { id: m.id, ok: true, res: m.a.items.map(t => 'X' + t) } }), 5); }
      };
      wk = null;                                   // drop any worker the app already made
      const out = [];
      cfg.trPair = false; await eNllb(['hello'], 'en', 'de'); out.push(engLabel('nllb'));
      cfg.trPair = true; await eNllb(['hello'], 'en', 'de'); out.push(engLabel('nllb'));
      return out;
    });
    expect(labels[0]).toContain('NLLB-200 600M');
    expect(labels[1]).toContain('OPUS-MT EN → DE');
  });
});

test.describe('Web app: Offline translation model dropdown (Item 1)', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['nllb']) } } });

  async function ready(page, ids) {
    const cat = await page.evaluate(() => MODEL_CATALOG);
    for (const id of ids) {
      const m = cat.models.find(x => x.id === id);
      await page.evaluate(({ id, f }) => { const d = store.get('mdl', {}); d[id] = { at: 1, files: f }; store.set('mdl', d); }, { id, f: m.files.map(f => f[0]).filter(f => f.endsWith('.onnx')) });
      await fakeDownloaded(page, m.repo, m.files);
    }
    await page.evaluate(() => mcScan());
  }

  test('dropdown lists only downloaded models plus Auto', async ({ app }) => {
    const { page } = app;
    await ready(page, ['tr-nllb-600', 'tr-m2m100-418']);
    await openSettings(page, 'trModels');
    await page.evaluate(() => mcRender());
    const sel = page.locator('#offTrModelSel');
    await expect(sel).toBeVisible();
    const opts = await sel.locator('option').evaluateAll(list => list.map(o => ({ value: o.value, text: o.textContent })));
    expect(opts.map(o => o.value)).toEqual(['auto', 'tr-nllb-600', 'tr-m2m100-418']);
    expect(opts[0].text).toMatch(/خودکار|Auto/);
  });

  test('Auto behaves as before: multilingual chosen, or OPUS-MT when pair preferred', async ({ app }) => {
    const { page } = app;
    await ready(page, ['tr-nllb-600', 'tr-opus-en-de']);
    await page.evaluate(() => { cfg.trModel = 'auto'; cfg.trPair = false; });
    expect(await page.evaluate(() => pickTr('en', 'de').id)).toBe('tr-nllb-600');
    await page.evaluate(() => { cfg.trPair = true; });
    expect(await page.evaluate(() => pickTr('en', 'de').id)).toBe('tr-opus-en-de');
    expect(await page.evaluate(() => pickTr('en', 'fa').id)).toBe('tr-nllb-600');
  });

  test('chosen model is the one invoked in worker', async ({ app }) => {
    const { page } = app;
    await ready(page, ['tr-nllb-600', 'tr-m2m100-418']);
    await page.evaluate(() => { cfg.trModel = 'tr-m2m100-418'; });
    const sent = await page.evaluate(async () => {
      let msg = null;
      window.Worker = class {
        constructor() { }
        postMessage(m) {
          msg = m;
          setTimeout(() => this.onmessage && this.onmessage({ data: { id: m.id, ok: true, res: ['سلام'] } }), 5);
        }
      };
      wk = null;
      await eNllb(['hi'], 'en', 'fa');
      return msg;
    });
    expect(sent.a.spec.repo).toBe('Xenova/m2m100_418M');
  });

  test('unsupported pair falls back to Auto with a visible message', async ({ app }) => {
    const { page } = app;
    await ready(page, ['tr-nllb-600', 'tr-m2m100-418']);
    await openSettings(page, 'trModels');
    await page.evaluate(() => { cfg.trModel = 'tr-m2m100-418'; mcRender(); });
    // tr-m2m100-418 does not cover en -> ja, but tr-nllb-600 does
    const res = await page.evaluate(async () => {
      window.Worker = class {
        constructor() {}
        postMessage(m) {
          setTimeout(() => this.onmessage && this.onmessage({ data: { id: m.id, ok: true, res: ['こんにちは'] } }), 5);
        }
      };
      wk = null;
      const trans = await eNllb(['hello'], 'en', 'ja');
      return { trans, used: offlineUsed };
    });
    expect(res.used).toContain('NLLB-200 600M'); // fell back to auto
    const notice = page.locator('#offFallbackNotice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('M2M-100');
  });

  test('choice survives reload', async ({ app }) => {
    const { page } = app;
    await ready(page, ['tr-nllb-600', 'tr-m2m100-418']);
    await openSettings(page, 'trModels');
    await page.locator('#offTrModelSel').selectOption('tr-m2m100-418');
    expect(await page.evaluate(() => store.get('cfg').trModel)).toBe('tr-m2m100-418');
    await page.reload();
    await openSettings(page, 'trModels');
    await expect(page.locator('#offTrModelSel')).toHaveValue('tr-m2m100-418');
  });

  test('changing the dropdown updates the radios and the reverse', async ({ app }) => {
    const { page } = app;
    await ready(page, ['tr-nllb-600', 'tr-m2m100-418']);
    await openSettings(page, 'trModels');
    await page.evaluate(() => mcRender());

    // Changing dropdown updates radio
    await page.locator('#offTrModelSel').selectOption('tr-m2m100-418');
    await expect(row(page, 'tr-m2m100-418').locator('input[type="radio"]')).toBeChecked();
    await expect(row(page, 'tr-nllb-600').locator('input[type="radio"]')).not.toBeChecked();

    // Clicking radio updates dropdown
    await mouseClick(page, row(page, 'tr-nllb-600').locator('input[type="radio"]'));
    await expect(page.locator('#offTrModelSel')).toHaveValue('tr-nllb-600');
    expect(await page.evaluate(() => cfg.trModel)).toBe('tr-nllb-600');

    // Selecting Auto unchecks radios
    await page.locator('#offTrModelSel').selectOption('auto');
    await expect(row(page, 'tr-nllb-600').locator('input[type="radio"]')).not.toBeChecked();
    await expect(row(page, 'tr-m2m100-418').locator('input[type="radio"]')).not.toBeChecked();
    expect(await page.evaluate(() => cfg.trModel)).toBe('auto');
  });
});

test.describe('Web app: Offline speech model dropdown (Item 2)', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

  async function ready(page, ids) {
    const cat = await page.evaluate(() => MODEL_CATALOG);
    for (const id of ids) {
      const m = cat.models.find(x => x.id === id);
      await page.evaluate(({ id, f }) => { const d = store.get('mdl', {}); d[id] = { at: 1, files: f }; store.set('mdl', d); }, { id, f: m.files.map(f => f[0]).filter(f => f.endsWith('.onnx')) });
      await fakeDownloaded(page, m.repo, m.files);
    }
    await page.evaluate(() => mcScan());
  }

  test('dropdown lists only downloaded Whisper models plus Auto', async ({ app }) => {
    const { page } = app;
    await ready(page, ['asr-base', 'asr-small']);
    await openSettings(page, 'voiceModels');
    await page.evaluate(() => mcRender());
    const sel = page.locator('#offWhisperSel');
    await expect(sel).toBeVisible();
    const opts = await sel.locator('option').evaluateAll(list => list.map(o => o.value));
    expect(opts).toEqual(['auto', 'base', 'small']);
  });

  test('Auto behaves as before, chosen model is invoked', async ({ app }) => {
    const { page } = app;
    await ready(page, ['asr-base', 'asr-small']);
    await page.evaluate(() => { cfg.whisper = 'auto'; });
    expect(await page.evaluate(() => asrModel().key)).toBe('base');
    await page.evaluate(() => { cfg.whisper = 'small'; });
    expect(await page.evaluate(() => asrModel().key)).toBe('small');
  });

  test('choice survives reload', async ({ app }) => {
    const { page } = app;
    await ready(page, ['asr-base', 'asr-small']);
    await openSettings(page, 'voiceModels');
    await page.locator('#offWhisperSel').selectOption('small');
    expect(await page.evaluate(() => store.get('cfg').whisper)).toBe('small');
    await page.reload();
    await openSettings(page, 'voiceModels');
    await expect(page.locator('#offWhisperSel')).toHaveValue('small');
  });

  test('changing dropdown updates radios and the reverse', async ({ app }) => {
    const { page } = app;
    await ready(page, ['asr-base', 'asr-small']);
    await openSettings(page, 'voiceModels');
    await page.evaluate(() => mcRender());

    // Changing dropdown updates radio
    await page.locator('#offWhisperSel').selectOption('small');
    await expect(row(page, 'asr-small').locator('input[type="radio"]')).toBeChecked();
    await expect(row(page, 'asr-base').locator('input[type="radio"]')).not.toBeChecked();

    // Clicking radio updates dropdown
    await activateSettingsTab(page, 'trModels');
    await mouseClick(page, row(page, 'asr-base').locator('input[type="radio"]'));
    await activateSettingsTab(page, 'voiceModels');
    await expect(page.locator('#offWhisperSel')).toHaveValue('base');
    expect(await page.evaluate(() => cfg.whisper)).toBe('base');

    // Selecting Auto clears inuse radios
    await page.locator('#offWhisperSel').selectOption('auto');
    await expect(row(page, 'asr-base').locator('input[type="radio"]')).not.toBeChecked();
    await expect(row(page, 'asr-small').locator('input[type="radio"]')).not.toBeChecked();
    expect(await page.evaluate(() => cfg.whisper)).toBe('auto');
  });

  test('Voice tab uses chosen model and shows model name next to the result', async ({ app }) => {
    const { page } = app;
    await ready(page, ['asr-small']);
    await page.evaluate(() => {
      cfg.whisper = 'small';
      cfg.stt = 'whisper';
      addBubble($('bubbles'), 'a', 'salam', 'hello world', 'fa', 'en', {
        stt: 'Whisper',
        sttModel: mcText(asrModel().name)
      });
    });
    const bub = page.locator('#bubbles .bub').first();
    await expect(bub.locator('.bub-tag').first()).toContainText('Whisper · Whisper Small');
  });
});

test.describe('Web app: Test models panel (Item 3)', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['nllb', 'ollama']) } } });

  test.beforeEach(async ({ page }) => {
    // Isolate tests from any live Ollama instance running on localhost:11434.
    await page.route('http://localhost:11434/api/tags', route => route.abort());
    await page.route('http://localhost:11434/v1/models', route => route.abort());
  });

  async function ready(page, ids) {
    const cat = await page.evaluate(() => MODEL_CATALOG);
    for (const id of ids) {
      const m = cat.models.find(x => x.id === id);
      await page.evaluate(({ id, f }) => { const d = store.get('mdl', {}); d[id] = { at: 1, files: f }; store.set('mdl', d); }, { id, f: m.files.map(f => f[0]).filter(f => f.endsWith('.onnx')) });
      await fakeDownloaded(page, m.repo, m.files);
    }
    await page.evaluate(() => mcScan());
  }

  test('all downloaded translation models run in order and results appear', async ({ app }) => {
    const { page } = app;
    await ready(page, ['tr-nllb-600', 'tr-m2m100-418']);
    await openSettings(page, 'trModels');
    await page.evaluate(() => {
      window.Worker = class {
        constructor() {}
        postMessage(m) {
          setTimeout(() => {
            this.onmessage && this.onmessage({
              data: { id: m.id, ok: true, res: ['[trans:' + m.a.spec.kind + '] ' + m.a.items[0]] }
            });
          }, 30);
        }
      };
      wk = null;
      mcRender();
    });

    await page.locator('#testMdlText').fill('Good morning');
    await page.locator('#testMdlSrc').selectOption('en');
    await page.locator('#testMdlTgt').selectOption('fa');

    await mouseClick(page, page.locator('#testTrRun'));

    const rows = page.locator('#testTrResults tbody tr');
    await expect(rows).toHaveCount(2, { timeout: 10_000 });
    await expect(rows.nth(0)).toContainText('NLLB-200 600M');
    await expect(rows.nth(0)).toContainText('[trans:nllb] Good morning');
    await expect(rows.nth(0).locator('.test-row-time')).toContainText('s');

    await expect(rows.nth(1)).toContainText('M2M-100');
    await expect(rows.nth(1)).toContainText('[trans:m2m100] Good morning');
    await expect(rows.nth(1).locator('.test-row-time')).toContainText('s');
  });

  test('if Ollama is reachable, lists installed models and includes them in the run', async ({ app }) => {
    const { page } = app;
    await ready(page, ['tr-nllb-600']);
    await page.route('http://localhost:11434/v1/models', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ id: 'gemma3:latest' }] })
      });
    });
    await page.route('http://localhost:11434/v1/chat/completions', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{ message: { content: 'صبح بخیر از اولاما' } }]
        })
      });
    });

    await openSettings(page, 'trModels');
    await page.evaluate(() => {
      window.Worker = class {
        constructor() {}
        postMessage(m) {
          setTimeout(() => {
            this.onmessage && this.onmessage({ data: { id: m.id, ok: true, res: ['NLLB trans'] } });
          }, 30);
        }
      };
      wk = null;
      mcRender();
    });

    await page.locator('#testMdlText').fill('Good morning');
    await mouseClick(page, page.locator('#testTrRun'));

    const rows = page.locator('#testTrResults tbody tr');
    await expect(rows).toHaveCount(2, { timeout: 10_000 });
    await expect(rows.nth(0)).toContainText('NLLB-200 600M');
    await expect(rows.nth(1)).toContainText('Ollama (gemma3:latest)');
    await expect(rows.nth(1)).toContainText('صبح بخیر از اولاما');
  });

  test('one failing model does not stop the others', async ({ app }) => {
    const { page } = app;
    await ready(page, ['tr-nllb-600', 'tr-m2m100-418']);
    await openSettings(page, 'trModels');
    await page.evaluate(() => {
      let callCount = 0;
      window.Worker = class {
        constructor() {}
        postMessage(m) {
          callCount++;
          setTimeout(() => {
            if (callCount === 1) {
              this.onmessage && this.onmessage({ data: { id: m.id, ok: false, err: 'Engine crash simulated' } });
            } else {
              this.onmessage && this.onmessage({ data: { id: m.id, ok: true, res: ['Success second model'] } });
            }
          }, 20);
        }
      };
      wk = null;
      mcRender();
    });

    await page.locator('#testMdlText').fill('Test failure resilience');
    await mouseClick(page, page.locator('#testTrRun'));

    const rows = page.locator('#testTrResults tbody tr');
    await expect(rows).toHaveCount(2, { timeout: 10_000 });
    await expect(rows.nth(0)).toContainText('Engine crash simulated');
    await expect(rows.nth(1)).toContainText('Success second model');
    await expect(page.locator('#testTrStatus')).toContainText(/تکمیل|Done|Finished/i);
  });

  test('Stop button works', async ({ app }) => {
    const { page } = app;
    await ready(page, ['tr-nllb-600', 'tr-m2m100-418']);
    await openSettings(page, 'trModels');
    await page.evaluate(() => {
      window.Worker = class {
        constructor() {}
        postMessage(m) {
          setTimeout(() => {
            this.onmessage && this.onmessage({ data: { id: m.id, ok: true, res: ['Slow result'] } });
          }, 3000);
        }
      };
      wk = null;
      mcRender();
    });

    await page.locator('#testMdlText').fill('Testing stop button');
    await mouseClick(page, page.locator('#testTrRun'));
    await expect(page.locator('#testTrStop')).toBeVisible();
    await mouseClick(page, page.locator('#testTrStop'));
    await expect(page.locator('#testTrStatus')).toContainText(/متوقف شد|Stopped/);
    await expect(page.locator('#testTrRun')).toBeVisible();
  });

  test('results are NOT written to translation memory or history', async ({ app }) => {
    const { page } = app;
    await ready(page, ['tr-nllb-600']);
    await openSettings(page, 'trModels');
    await page.evaluate(() => {
      store.set('tm', []);
      store.set('hist', []);
      window.Worker = class {
        constructor() {}
        postMessage(m) {
          setTimeout(() => {
            this.onmessage && this.onmessage({ data: { id: m.id, ok: true, res: ['Secret test phrase'] } });
          }, 20);
        }
      };
      wk = null;
      mcRender();
    });

    await page.locator('#testMdlText').fill('Top Secret Phrase');
    await mouseClick(page, page.locator('#testTrRun'));
    await expect(page.locator('#testTrResults tbody tr').first()).toContainText('Secret test phrase');

    const storage = await page.evaluate(() => ({
      tm: store.get('tm', []),
      hist: store.get('hist', [])
    }));
    expect(storage.tm).toEqual([]);
    expect(storage.hist).toEqual([]);
  });

  test('speech test runs downloaded Whisper models', async ({ app }) => {
    const { page } = app;
    await ready(page, ['asr-base']);
    await openSettings(page, 'voiceModels');
    await page.evaluate(() => {
      window.record = async () => new Blob([new Uint8Array(2000)], { type: 'audio/webm' });
      window.to16k = async () => new Float32Array(1600);
      window.Worker = class {
        constructor() {}
        postMessage(m) {
          setTimeout(() => {
            this.onmessage && this.onmessage({ data: { id: m.id, ok: true, res: { text: 'Transcribed test speech' } } });
          }, 20);
        }
      };
      wk = null;
      mcRender();
    });

    await mouseClick(page, page.locator('#testAsrRun'));
    const rows = page.locator('#testAsrResults tbody tr');
    await expect(rows).toHaveCount(1, { timeout: 10_000 });
    await expect(rows.first()).toContainText('Whisper Base');
    await expect(rows.first()).toContainText('Transcribed test speech');
  });
});
