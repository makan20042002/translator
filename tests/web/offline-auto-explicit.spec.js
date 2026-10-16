'use strict';
/**
 * Test Item 4: Make Auto option explicit with active model name and Used by Auto badge.
 * Verifies that:
 * 1. The Auto option text includes the real current model name (e.g. "Auto (now: NLLB-200 600M)").
 * 2. In Model Hub, the model card currently picked by Auto displays a "Used by Auto" badge.
 * 3. After seeding M2M100 as downloaded and NLLB deleted, the Auto option shows M2M-100
 *    and the "Used by Auto" badge moves to the M2M-100 card.
 * 4. With no model downloaded, it shows "Auto (no model downloaded)" and no badge.
 */
const { test, expect, onlyEngines } = require('../support/fixtures');

test.describe('Explicit Auto option and Used by Auto badge (Item 4)', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google', 'nllb']), src: 'en', tgt: 'fa' } } });

  test('Auto option includes real model name and badge moves when downloaded models change', async ({ app }) => {
    const { page } = app;

    // 1. Seed NLLB as downloaded
    await page.evaluate(() => {
      const cat = self.MODEL_CATALOG?.models || [];
      const nllb = cat.find(m => m.id === 'tr-nllb-600');
      const d = {};
      d['tr-nllb-600'] = { at: Date.now(), files: nllb.files.map(f => f[0]) };
      store.set('mdl', d);
      store.set('nllb', true);
      cfg.trModel = 'auto';
      if (typeof saveCfg === 'function') saveCfg();
      if (typeof mcRender === 'function') mcRender();
    });

    // Check Auto option in #offTrModelSel contains NLLB
    const autoOpt = page.locator('#offTrModelSel option[value="auto"]');
    await expect(autoOpt).toContainText('Auto (now:');
    await expect(autoOpt).toContainText('NLLB');

    // In Model Hub, NLLB card has the "Used by Auto" badge, M2M100 does not
    const nllbCard = page.locator('.hub-model-card[data-hub-mdl="tr-nllb-600"]');
    const m2mCard = page.locator('.hub-model-card[data-hub-mdl="tr-m2m100-418"]');

    await expect(nllbCard.locator('.auto-used')).toBeVisible();
    await expect(nllbCard.locator('.auto-used')).toContainText('Used by Auto');
    await expect(m2mCard.locator('.auto-used')).toHaveCount(0);

    // 2. Seed M2M100 as downloaded and NLLB deleted
    await page.evaluate(() => {
      const cat = self.MODEL_CATALOG?.models || [];
      const m2m = cat.find(m => m.id === 'tr-m2m100-418');
      const d = {};
      d['tr-m2m100-418'] = { at: Date.now(), files: m2m.files.map(f => f[0]) };
      store.set('mdl', d);
      store.set('nllb', false);
      cfg.trModel = 'auto';
      if (typeof saveCfg === 'function') saveCfg();
      if (typeof mcRender === 'function') mcRender();
    });

    // Auto option in #offTrModelSel now contains M2M-100 and not NLLB
    await expect(autoOpt).toContainText('M2M-100');
    await expect(autoOpt).not.toContainText('NLLB');

    // In Model Hub, the badge has moved to M2M100 card
    await expect(m2mCard.locator('.auto-used')).toBeVisible();
    await expect(m2mCard.locator('.auto-used')).toContainText('Used by Auto');
    await expect(nllbCard.locator('.auto-used')).toHaveCount(0);

    // 3. When no model is downloaded, shows "Auto (no model downloaded)" and no badge
    await page.evaluate(() => {
      store.set('mdl', {});
      store.set('nllb', false);
      cfg.trModel = 'auto';
      if (typeof saveCfg === 'function') saveCfg();
      if (typeof mcRender === 'function') mcRender();
    });

    await expect(autoOpt).toContainText('Auto (no model downloaded)');
    await expect(page.locator('.hub-model-card .auto-used')).toHaveCount(0);
  });
});
