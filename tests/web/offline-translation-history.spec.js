'use strict';
/**
 * Test Item 5: Result summary, history, and M2M100/mBART end to end.
 * Verifies with the fake Worker:
 * 1. Translating a short text in the Text tab with each of the three models selected (NLLB, M2M100, mBART-50).
 * 2. The worker receives the right repo for that model.
 * 3. The result line (#tMeta) shows that model's name.
 * 4. The new hist entry (store 'hist', field e) contains that model's name.
 */
const { test, expect, onlyEngines } = require('../support/fixtures');

test.describe('Offline translation worker repo and history reporting (Item 5)', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['nllb']), src: 'en', tgt: 'fa' } } });

  test('translates with NLLB, M2M100, mBART: right repo sent to worker, result line shows model, history records model', async ({ app }) => {
    const { page } = app;

    // 1. Seed all three models as downloaded and ready
    await page.evaluate(() => {
      const cat = self.MODEL_CATALOG?.models || [];
      const d = store.get('mdl', {});
      for (const id of ['tr-nllb-600', 'tr-m2m100-418', 'tr-mbart50']) {
        const m = cat.find(x => x.id === id);
        if (m) {
          d[id] = { at: Date.now(), files: m.files.map(f => f[0]) };
        }
      }
      store.set('mdl', d);
      store.set('nllb', true);
      store.set('hist', []);
      cfg.order = ['nllb'];
      cfg.eng = { nllb: true };
      if (typeof saveCfg === 'function') saveCfg();
      if (typeof mcRender === 'function') mcRender();
    });

    // 2. Install MockWorker
    await page.evaluate(() => {
      window.__lastWorkerTranslate = null;
      class MockWorker {
        constructor() {
          this.role = 'translate';
        }
        postMessage(data) {
          const { id, cmd, a } = data;
          if (cmd === 'translate') {
            window.__lastWorkerTranslate = a;
            setTimeout(() => {
              this.onmessage?.({ data: { id, ok: true, res: ['سلام دنیا'] } });
            }, 10);
          } else {
            setTimeout(() => {
              this.onmessage?.({ data: { id, ok: true, res: true } });
            }, 5);
          }
        }
        terminate() {}
      }
      window.Worker = MockWorker;
    });

    const modelsToTest = [
      {
        id: 'tr-nllb-600',
        repo: 'Xenova/nllb-200-distilled-600M',
        nameStr: 'NLLB'
      },
      {
        id: 'tr-m2m100-418',
        repo: 'Xenova/m2m100_418M',
        nameStr: 'M2M-100'
      },
      {
        id: 'tr-mbart50',
        repo: 'Xenova/mbart-large-50-many-to-many-mmt',
        nameStr: 'mBART-50'
      }
    ];

    for (const item of modelsToTest) {
      // Select the model
      await page.evaluate((modelId) => {
        window.__lastWorkerTranslate = null;
        if (typeof window.terminateAiWorker === 'function') {
          window.terminateAiWorker('translate');
        }
        cfg.trModel = modelId;
        if (typeof saveCfg === 'function') saveCfg();
        if (typeof mcRender === 'function') mcRender();
      }, item.id);

      // Perform translation in Text tab
      await page.locator('#tIn').fill(`hello ${item.id}`);
      await page.locator('#tGo').click();

      // Verify translation output is displayed
      await expect(page.locator('#tOut')).toHaveValue(/سلام دنیا/);

      // Assert 1: The worker received the right repo
      const sentRepo = await page.evaluate(() => window.__lastWorkerTranslate?.spec?.repo);
      expect(sentRepo).toBe(item.repo);

      // Assert 2: The result line shows that model's name
      const meta = page.locator('#tMeta');
      await expect(meta).toContainText(item.nameStr);

      // Assert 3: The new history entry contains that model's name
      const latestHistoryEntry = await page.evaluate(() => {
        const h = store.get('hist', []);
        return h[0]?.e || '';
      });
      expect(latestHistoryEntry).toContain(item.nameStr);
    }
  });
});
