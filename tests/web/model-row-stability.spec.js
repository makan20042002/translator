'use strict';
const { test, expect, mouseClick, onlyEngines } = require('../support/fixtures');
const { fakeDownloaded, openSettings, row } = require('../support/model-helpers');

test.describe('Item 7: Model row stability and DOM node preservation', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

  test('tr-nllb-600 row element remains the exact same DOM node across animation frames after mcRender and offStatus', async ({ app }) => {
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

    // Initial render and trigger offStatus
    await page.evaluate(() => {
      mcScan();
      mcRender();
      offStatus();
    });

    // Capture initial DOM node reference of tr-nllb-600 row
    await page.evaluate(() => {
      window.__initialRowNode = document.querySelector('[data-mdl="tr-nllb-600"]');
    });

    // Wait across two animation frames and trigger another mcRender/offStatus cycle
    const isSameNode = await page.evaluate(async () => {
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (typeof offStatus === 'function') {
        await offStatus();
      } else {
        mcRender();
      }
      const currentNode = document.querySelector('[data-mdl="tr-nllb-600"]');
      return {
        hasInitial: !!window.__initialRowNode,
        hasCurrent: !!currentNode,
        sameNode: window.__initialRowNode && currentNode ? window.__initialRowNode.isSameNode(currentNode) : false
      };
    });

    expect(isSameNode.hasInitial).toBe(true);
    expect(isSameNode.hasCurrent).toBe(true);
    expect(isSameNode.sameNode).toBe(true);

    // Verify radio exists on the stable element and can be clicked
    const nllbRadio = row(page, 'tr-nllb-600').locator('input[type="radio"]');
    await expect(nllbRadio).toBeVisible();
    await mouseClick(page, nllbRadio);
    expect(await page.evaluate(() => cfg.trModel)).toBe('tr-nllb-600');
  });
});
