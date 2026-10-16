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
const { test, expect, mouseClick, onlyEngines } = require('../support/fixtures');
const { openSettings } = require('../support/model-helpers');

test.describe('Explicit Auto option and Used by Auto badge (Item 4)', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google', 'nllb']), src: 'en', tgt: 'fa' } } });

  test('Auto option includes real model name and badge moves when downloaded models change', async ({ app }) => {
    const { page } = app;

    // Switch to Model Hub tab so #tab-models is active
    await mouseClick(page, page.locator('#tabs button[data-tab="models"]'));

    // Open Settings and the Model Hub tab
    await openSettings(page, 'modelHub');

    // 1. Seed NLLB as downloaded
    await page.evaluate(() => {
      document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x.id === 'tab-models'));
      if (typeof hubActiveCat !== 'undefined') hubActiveCat = 'all';
      const cat = self.MODEL_CATALOG?.models || [];
      const nllb = cat.find(m => m.id === 'tr-nllb-600');
      const d = {};
      d['tr-nllb-600'] = { at: Date.now(), files: nllb.files.map(f => f[0]) };
      store.set('mdl', d);
      store.set('nllb', true);
      if (!mcCache) mcCache = {};
      mcCache[nllb.repo] = { bytes: 1000, files: new Map(nllb.files.map(f => [f[0], f[1]])) };
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
      document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x.id === 'tab-models'));
      if (typeof hubActiveCat !== 'undefined') hubActiveCat = 'all';
      const cat = self.MODEL_CATALOG?.models || [];
      const m2m = cat.find(m => m.id === 'tr-m2m100-418');
      const d = {};
      d['tr-m2m100-418'] = { at: Date.now(), files: m2m.files.map(f => f[0]) };
      store.set('mdl', d);
      store.set('nllb', false);
      if (!mcCache) mcCache = {};
      const nllb = cat.find(m => m.id === 'tr-nllb-600');
      if (nllb) delete mcCache[nllb.repo];
      mcCache[m2m.repo] = { bytes: 1000, files: new Map(m2m.files.map(f => [f[0], f[1]])) };
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
      document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x.id === 'tab-models'));
      if (typeof hubActiveCat !== 'undefined') hubActiveCat = 'all';
      store.set('mdl', {});
      store.set('nllb', false);
      if (mcCache) {
        const cat = self.MODEL_CATALOG?.models || [];
        for (const m of cat) if (m.job === 'translate') delete mcCache[m.repo];
      }
      cfg.trModel = 'auto';
      if (typeof saveCfg === 'function') saveCfg();
      if (typeof mcRender === 'function') mcRender();
    });

    await expect(autoOpt).toContainText('Auto (no model downloaded)');
    await expect(page.locator('.hub-model-card .auto-used')).toHaveCount(0);
  });

  test('for all combinations of trModel, trPair, and model sets, pickAutoTr equals pickTr(auto) and badge matches', async ({ app }) => {
    const { page } = app;
    const modelSets = [
      { name: 'NLLB', ids: ['tr-nllb-600'] },
      { name: 'NLLB+M2M100', ids: ['tr-nllb-600', 'tr-m2m100-418'] },
      { name: 'NLLB+opus-en-de', ids: ['tr-nllb-600', 'tr-opus-en-de'] },
      { name: 'M2M100 only', ids: ['tr-m2m100-418'] }
    ];
    const trModelValues = ['auto', 'tr-m2m100-418'];
    const trPairValues = [true, false];

    for (const mSet of modelSets) {
      for (const trModel of trModelValues) {
        for (const trPair of trPairValues) {
          const evalResult = await page.evaluate(async ({ mIds, trModel, trPair }) => {
            const cat = self.MODEL_CATALOG?.models || [];
            const d = {};
            if (!mcCache) mcCache = {};
            for (const m of cat) {
              if (m.job === 'translate') {
                delete mcCache[m.repo];
              }
            }
            for (const id of mIds) {
              const m = cat.find(x => x.id === id);
              if (m) {
                d[m.id] = { at: Date.now(), files: m.files.map(f => f[0]) };
                mcCache[m.repo] = { bytes: 1000, files: new Map(m.files.map(f => [f[0], f[1]])) };
              }
            }
            store.set('mdl', d);
            store.set('nllb', mIds.includes('tr-nllb-600'));
            cfg.trModel = trModel;
            cfg.trPair = trPair;

            // Target pair en -> de to exercise opus-en-de, NLLB, and M2M100
            if (typeof $ === 'function') {
              if ($('src')) $('src').value = 'en';
              if ($('tgt')) $('tgt').value = 'de';
            }

            const autoM = pickAutoTr('en', 'de');
            const trM = pickTr('en', 'de');

            let renderThrew = false;
            try {
              if (typeof mcRender === 'function') mcRender();
              if (typeof renderModelHub === 'function') renderModelHub();
            } catch (e) {
              renderThrew = e.message || String(e);
            }

            const badges = Array.from(document.querySelectorAll('.hub-model-card .auto-used-badge'))
              .map(el => el.closest('.hub-model-card')?.getAttribute('data-hub-mdl'))
              .filter(Boolean);

            return {
              autoMId: autoM?.id || null,
              trMId: trM?.id || null,
              renderThrew,
              badges
            };
          }, { mIds: mSet.ids, trModel, trPair });

          expect(evalResult.renderThrew, `mcRender/renderModelHub threw for ${mSet.name}, trModel=${trModel}, trPair=${trPair}`).toBe(false);

          if (trModel === 'auto') {
            expect(evalResult.autoMId).toBe(evalResult.trMId);
          }

          if (evalResult.autoMId) {
            expect(evalResult.badges).toContain(evalResult.autoMId);
            expect(evalResult.badges.length).toBe(1);
          } else {
            expect(evalResult.badges.length).toBe(0);
          }
        }
      }
    }
  });
});
