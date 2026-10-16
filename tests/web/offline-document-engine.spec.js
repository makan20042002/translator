'use strict';
/**
 * Test Item 2: Document tab engine picker option and failure reporting for offline engine.
 * Verifies that when M2M100 is chosen and ready, the picker option and failure message
 * both contain "M2M-100" and neither contains "NLLB".
 */
const { test, expect, mouseClick, chooseFile, onlyEngines } = require('../support/fixtures');

test.describe('Document tab offline model names (Item 2 & 4)', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google', 'nllb']), src: 'en', tgt: 'fa' } } });

  test('with M2M100 chosen and ready, picker option and failure message contain M2M-100 and not NLLB', async ({ app }) => {
    const { page } = app;
    await page.evaluate(() => {
      const cat = self.MODEL_CATALOG?.models || [];
      const m2m = cat.find(m => m.id === 'tr-m2m100-418');
      const d = store.get('mdl', {});
      d['tr-m2m100-418'] = { at: Date.now(), files: m2m.files.map(f => f[0]) };
      store.set('mdl', d);
      if (!mcCache) mcCache = {};
      mcCache[m2m.repo] = { bytes: 1000, files: new Map(m2m.files.map(f => [f[0], f[1]])) };
      cfg.trModel = 'tr-m2m100-418';
      if (typeof saveCfg === 'function') saveCfg();
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

    const result = await page.evaluate(() => {
      buildDocEngineOptions();
      const sel = $('dEngineSel');
      const nllbOpt = sel ? Array.from(sel.options).find(o => o.value === 'nllb')?.textContent : '';

      // Check failure message when offline engine was chosen and failed
      $('dEngineSel').value = 'nllb';
      const failMsg = buildHonestFailureMessage(null, null, new Error('engine failure'));
      const displayName = getDocEngineDisplayName('nllb');

      return {
        nllbOptText: nllbOpt,
        failMsg,
        displayName
      };
    });

    // Option text contains "M2M-100" and does not contain "NLLB"
    expect(result.nllbOptText).toContain('M2M-100');
    expect(result.nllbOptText).not.toContain('NLLB');

    // Failure message contains "M2M-100" and does not contain "NLLB"
    expect(result.failMsg).toContain('M2M-100');
    expect(result.failMsg).not.toContain('NLLB');

    // Display name contains "M2M-100" and does not contain "NLLB"
    expect(result.displayName).toContain('M2M-100');
    expect(result.displayName).not.toContain('NLLB');
  });

  test('document and voice translations do not write to hist storage, and FA hint contains no English word Auto', async ({ app, files }) => {
    const { page } = app;

    // 1. Seed initial history and verify baseline
    const baselineHist = [
      { ts: 1000, src: 'en', tgt: 'fa', e: 'Google', i: 'initial text', o: 'متن اولیه' }
    ];
    await page.evaluate((b) => {
      store.set('hist', b);
    }, baselineHist);

    // 2. Perform stubbed Document translation
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await mouseClick(page, page.locator('#dGo'));

    const dSave = page.locator('#dSave');
    await expect(dSave).toBeEnabled({ timeout: 20_000 });

    // Assert that 'hist' is completely unchanged after Document translation
    const histAfterDoc = await page.evaluate(() => store.get('hist', []));
    expect(histAfterDoc.length).toBe(baselineHist.length);
    expect(histAfterDoc).toEqual(baselineHist);

    // 3. Perform stubbed Voice translation
    await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));
    const pttBtn = page.locator('#vPttBtn');
    const pttBox = await pttBtn.boundingBox();
    if (pttBox) {
      await page.mouse.move(pttBox.x + pttBox.width / 2, pttBox.y + pttBox.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(1000);
      await page.mouse.up();
      await page.waitForTimeout(500);
    }

    // Assert that 'hist' is still completely unchanged after Voice translation
    const histAfterVoice = await page.evaluate(() => store.get('hist', []));
    expect(histAfterVoice.length).toBe(baselineHist.length);
    expect(histAfterVoice).toEqual(baselineHist);

    // 4. In FA, verify the offline model hint contains no English word "Auto"
    const faHintText = await page.evaluate(() => {
      store.set('ui', 'fa');
      if (typeof ui !== 'undefined') ui = 'fa';
      document.documentElement.lang = 'fa';
      document.documentElement.dir = 'rtl';
      if (typeof applyUiLang === 'function') applyUiLang('fa');

      const cat = self.MODEL_CATALOG?.models || [];
      const nllb = cat.find(m => m.id === 'tr-nllb-600');
      if (nllb) {
        const d = store.get('mdl', {});
        d[nllb.id] = { at: Date.now(), files: nllb.files.map(f => f[0]) };
        store.set('mdl', d);
        if (!mcCache) mcCache = {};
        mcCache[nllb.repo] = { bytes: 1000, files: new Map(nllb.files.map(f => [f[0], f[1]])) };
      }
      cfg.trModel = 'auto';
      return formatOfflineModelHint('en', 'fa');
    });

    expect(faHintText).not.toMatch(/\bAuto\b/i);
    expect(faHintText).toContain('خودکار');
  });
});
