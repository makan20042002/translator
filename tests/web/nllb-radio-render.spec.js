'use strict';
const { test, expect, mouseClick, onlyEngines } = require('../support/fixtures');
const { fakeDownloaded, openSettings, row } = require('../support/model-helpers');

test.describe('Item 4: tr-nllb-600 radio rendering and selection', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

  test('tr-nllb-600 renders a radio when downloaded and clicking it selects the model', async ({ app }) => {
    const { page } = app;
    const cat = await page.evaluate(() => MODEL_CATALOG);
    const nllb = cat.models.find(m => m.id === 'tr-nllb-600');

    await page.evaluate(({ nllbFiles }) => {
      store.set('mdl', {
        'tr-nllb-600': { at: 1, files: nllbFiles }
      });
    }, {
      nllbFiles: nllb.files.map(f => f[0]).filter(f => f.endsWith('.onnx'))
    });

    await fakeDownloaded(page, nllb.repo, nllb.files);
    await openSettings(page, 'trModels');
    await page.evaluate(() => { mcScan(); mcRender(); offStatus(); });

    const nllbRadio = row(page, 'tr-nllb-600').locator('input[type="radio"]');
    await expect(nllbRadio).toBeVisible();
    await mouseClick(page, nllbRadio);
    expect(await page.evaluate(() => cfg.trModel)).toBe('tr-nllb-600');
  });
});
