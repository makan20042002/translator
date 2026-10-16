'use strict';
/**
 * Test Item 2: Document tab engine picker option and failure reporting for offline engine.
 * Verifies that when M2M100 is chosen and ready, the picker option and failure message
 * both contain "M2M-100" and neither contains "NLLB".
 */
const { test, expect, mouseClick, onlyEngines } = require('../support/fixtures');

test.describe('Document tab offline model names (Item 2)', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google', 'nllb']), src: 'en', tgt: 'fa' } } });

  test('with M2M100 chosen and ready, picker option and failure message contain M2M-100 and not NLLB', async ({ app }) => {
    const { page } = app;
    await page.evaluate(() => {
      const cat = self.MODEL_CATALOG?.models || [];
      const m2m = cat.find(m => m.id === 'tr-m2m100-418');
      const d = store.get('mdl', {});
      d['tr-m2m100-418'] = { at: Date.now(), files: m2m.files.map(f => f[0]) };
      store.set('mdl', d);
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
});
