'use strict';
/**
 * Test Item 1: Shared offlineTrChoice and offlineTrLabel helpers.
 * Verifies model selection ('chosen' vs 'auto' vs null) and display label formatting across language pairs.
 */
const { test, expect, onlyEngines } = require('../support/fixtures');

test.describe('Offline translation model choice and label (Item 1)', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

  test('offlineTrChoice and offlineTrLabel return correct model and how mode', async ({ app }) => {
    const { page } = app;
    const result = await page.evaluate(async () => {
      const cat = self.MODEL_CATALOG?.models || [];
      const nllb = cat.find(m => m.id === 'tr-nllb-600');
      const m2m = cat.find(m => m.id === 'tr-m2m100-418');

      const markReady = (models) => {
        const d = store.get('mdl', {});
        for (const m of models) {
          d[m.id] = { at: Date.now(), files: m.files.map(f => f[0]) };
        }
        store.set('mdl', d);
      };

      // (d) nothing downloaded -> null, and label shows localized no-model
      store.set('mdl', {});
      cfg.trModel = 'auto';
      const resD_choice = offlineTrChoice('en', 'fa');
      const resD_label = offlineTrLabel('en', 'fa');

      // (a) NLLB only -> auto, NLLB
      markReady([nllb]);
      cfg.trModel = 'auto';
      const resA_choice = offlineTrChoice('en', 'fa');
      const resA_label = offlineTrLabel('en', 'fa');

      // (b) NLLB + M2M100, cfg.trModel='tr-m2m100-418' -> chosen, M2M-100
      markReady([nllb, m2m]);
      cfg.trModel = 'tr-m2m100-418';
      const resB_choice = offlineTrChoice('en', 'fa');
      const resB_label = offlineTrLabel('en', 'fa');

      // (c) chosen model not downloaded -> auto (falls back to NLLB)
      store.set('mdl', {});
      markReady([nllb]); // M2M not downloaded
      cfg.trModel = 'tr-m2m100-418';
      const resC_choice = offlineTrChoice('en', 'fa');
      const resC_label = offlineTrLabel('en', 'fa');

      // (e) chosen model does not cover the pair -> same model pickTr returns (NLLB covers en->ja, M2M doesn't)
      store.set('mdl', {});
      markReady([nllb, m2m]);
      cfg.trModel = 'tr-m2m100-418'; // M2M doesn't cover Japanese
      const resE_choice = offlineTrChoice('en', 'ja');
      const resE_pickTr = pickTr('en', 'ja');
      const resE_label = offlineTrLabel('en', 'ja');

      return {
        resA: { choice: resA_choice, label: resA_label },
        resB: { choice: resB_choice, label: resB_label },
        resC: { choice: resC_choice, label: resC_label },
        resD: { choice: resD_choice, label: resD_label },
        resE: { choice: resE_choice, pickTrId: resE_pickTr?.id, label: resE_label }
      };
    });

    // (a) NLLB only -> auto, NLLB
    expect(result.resA.choice.how).toBe('auto');
    expect(result.resA.choice.model.id).toBe('tr-nllb-600');
    expect(result.resA.label).toBe('Auto → NLLB-200 600M');

    // (b) NLLB + M2M100, cfg.trModel='tr-m2m100-418' -> chosen, M2M-100
    expect(result.resB.choice.how).toBe('chosen');
    expect(result.resB.choice.model.id).toBe('tr-m2m100-418');
    expect(result.resB.label).toBe('M2M-100 418M');

    // (c) chosen model not downloaded -> auto
    expect(result.resC.choice.how).toBe('auto');
    expect(result.resC.choice.model.id).toBe('tr-nllb-600');
    expect(result.resC.label).toBe('Auto → NLLB-200 600M');

    // (d) nothing downloaded -> null
    expect(result.resD.choice).toBeNull();
    expect(result.resD.label).toBe('No offline model downloaded');

    // (e) chosen model does not cover the pair -> same model pickTr returns
    expect(result.resE.choice.how).toBe('auto');
    expect(result.resE.choice.model.id).toBe(result.resE.pickTrId);
    expect(result.resE.choice.model.id).toBe('tr-nllb-600');
    expect(result.resE.label).toBe('Auto → NLLB-200 600M');
  });

  test('window.cfg is undefined on load and after a model is marked downloaded and mcRender runs', async ({ app }) => {
    const { page } = app;
    // (1) Assert typeof window.cfg === 'undefined' after the app has loaded
    const initialType = await page.evaluate(() => typeof window.cfg);
    expect(initialType).toBe('undefined');

    // (2) Assert typeof window.cfg === 'undefined' after a model has been marked downloaded and mcRender() has run
    const afterRenderType = await page.evaluate(async () => {
      const cat = self.MODEL_CATALOG?.models || [];
      const nllb = cat.find(m => m.id === 'tr-nllb-600');
      if (nllb) {
        const d = store.get('mdl', {});
        d[nllb.id] = { at: Date.now(), files: nllb.files.map(f => f[0]) };
        store.set('mdl', d);
        if (!mcCache) mcCache = {};
        mcCache[nllb.repo] = { bytes: 1000, files: new Map(nllb.files.map(f => [f[0], f[1]])) };
      }
      try {
        if (typeof mcRender === 'function') mcRender();
      } catch {}
      return typeof window.cfg;
    });
    expect(afterRenderType).toBe('undefined');
  });
});

