'use strict';
// Engines & keys → Offline: the model catalogue (Download, Delete, ready state, storage total),
// which downloaded model is used, and the guards around speech recognition.
// No real model is downloaded here: the browser's model storage is filled with small stand-in files,
// which is exactly what "downloaded" looks like to the page. Real downloads are checked by
// tools/model-check (see docs/MODELS.md).
const { test, expect, onlyEngines, mouseClick } = require('../support/fixtures');

const { CACHE, mb, fakeDownloaded, cacheKeys, openSettings, row } = require('../support/model-helpers');

test.describe('Web app: offline model catalogue', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

  test('lists every model by job, with size, memory, WebGPU, languages and a one-line use', async ({ app }) => {
    const { page } = app;
    const cat = await page.evaluate(() => MODEL_CATALOG);
    await openSettings(page);
    await expect(page.locator('.mdl-grp')).toContainText([/Listening/, /Translation/]);
    expect(cat.models.length).toBeGreaterThan(5);
    for (const m of cat.models) {
      const r = row(page, m.id);
      await expect(r, m.id).toHaveCount(1);
      await expect(r.locator('strong').first()).toHaveText(m.name.en || m.name);
      await expect(r.locator('.mdl-m')).toContainText(`Download ${mb(m.bytes)}`);
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
    await openSettings(page);
    for (const k of ['tiny', 'base', 'small', 'large-v3-turbo']) await expect(row(page, 'asr-' + k)).toHaveCount(1);
    for (const k of ['small', 'large-v3-turbo']) await expect(row(page, 'asr-' + k).locator('.badge.rec')).toHaveCount(1);
    for (const k of ['tiny', 'base']) {
      await expect(row(page, 'asr-' + k).locator('.badge.rec')).toHaveCount(0);
      await expect(row(page, 'asr-' + k).locator('.badge.warn')).toHaveCount(1);
    }
  });

  test('Whisper Medium is not offered: in a real browser its engine cannot allocate the memory it needs (see docs/MODELS.md)', async ({ app }) => {
    const { page } = app;
    await openSettings(page);
    await expect(row(page, 'asr-medium')).toHaveCount(0);
  });

  test('nothing is downloaded: every row says so, the storage total is 0, and Download is offered', async ({ app }) => {
    const { page } = app;
    await openSettings(page);
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
    await openSettings(page);
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
    await openSettings(page);
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
    await openSettings(page);
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
    await openSettings(page);
    await expect(page.locator('#dlTr')).toBeVisible();
    await expect(page.locator('#dlTr')).toHaveText('Download');
  });

  test('a failed download is reported and leaves the model not downloaded', async ({ app }) => {
    test.setTimeout(60_000);
    const { page } = app;
    await openSettings(page);
    await mouseClick(page, row(page, 'asr-tiny').locator('[data-act="dl"]'));
    await expect(page.locator('.toast.err').first()).toBeVisible({ timeout: 30_000 });
    await expect(row(page, 'asr-tiny')).toHaveAttribute('data-state', 'none');
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
    await openSettings(page);
    await page.evaluate(() => offStatus());
    await mouseClick(page, row(page, 'asr-small').locator('input[data-act="use"]'));
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mkt_cfg')).whisper)).toBe('small');
    await expect(row(page, 'asr-small')).toHaveClass(/inuse/);
    expect(await page.evaluate(() => asrModel().id)).toBe('asr-small');
  });

  test('the list and its labels follow the interface language', async ({ app }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#uiLang'));
    await openSettings(page);
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
    await openSettings(page);
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
    const labels = await page.evaluate(async () => {
      window.rpc2 = null;
      const real = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function (m) { setTimeout(() => this.onmessage({ data: { id: m.id, ok: true, res: m.a.items.map(t => 'X' + t) } }), 5); };
      const out = [];
      try {
        cfg.trPair = false; await eNllb(['hello'], 'en', 'de'); out.push(engLabel('nllb'));
        cfg.trPair = true; await eNllb(['hello'], 'en', 'de'); out.push(engLabel('nllb'));
      } finally { Worker.prototype.postMessage = real; }
      return out;
    });
    expect(labels[0]).toContain('NLLB-200 600M');
    expect(labels[1]).toContain('OPUS-MT EN → DE');
  });
});
