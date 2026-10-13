'use strict';
/**
 * Tests verifying that with the correct Settings tab active,
 * real mouse clicks work reliably for:
 * 1. Dictionary download and remove
 * 2. Model delete
 * 3. Voice delete
 * 4. Radio selection
 * 5. OCR controls
 */
const { test, expect, onlyEngines, mouseClick } = require('../support/fixtures');
const { CACHE, fakeDownloaded, openSettings, row } = require('../support/model-helpers');

test.describe('Web app: Settings tab controls with correct tab active', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), tgt: 'fa' } } });

  test('Dictionary download and remove succeed via real mouse clicks when Translation models / Dictionary tab is active', async ({ app }) => {
    const { page } = app;
    await openSettings(page);

    // Switch to Translation models tab
    await mouseClick(page, page.locator('#setTabBtnTrModels'));
    await expect(page.locator('#secTrModels')).toHaveClass(/active/);

    const dlBtn = page.locator('#dictDl-en-fa');
    await expect(dlBtn).toBeVisible();
    await expect(page.locator('#dictSt-en-fa')).toHaveText(/not downloaded/i);

    // Real mouse click to download
    await mouseClick(page, dlBtn);
    await expect(page.locator('#dictSt-en-fa')).toContainText(/ready/i, { timeout: 30_000 });
    await expect(page.locator('#dictDot-en-fa')).toHaveClass(/ok/);

    // Real mouse click to remove
    const rmBtn = page.locator('#dictRm-en-fa');
    await expect(rmBtn).toBeVisible();
    await mouseClick(page, rmBtn);
    await expect(page.locator('#dictSt-en-fa')).toHaveText(/not downloaded/i);
  });

  test('Model delete succeeds via real mouse click when Voice models tab is active', async ({ app }) => {
    const { page } = app;
    const cat = await page.evaluate(() => MODEL_CATALOG);
    const small = cat.models.find(m => m.id === 'asr-small');

    await page.evaluate(({ a }) => {
      store.set('mdl', { 'asr-small': { at: 1, files: a } });
    }, { a: small.files.map(f => f[0]).filter(f => f.endsWith('.onnx')) });
    await fakeDownloaded(page, small.repo, small.files);

    await openSettings(page);

    // Switch to Voice models tab
    await mouseClick(page, page.locator('#setTabBtnVoiceModels'));
    await expect(page.locator('#secVoiceModels')).toHaveClass(/active/);

    await page.evaluate(() => offStatus());
    const smallRow = row(page, 'asr-small');
    await expect(smallRow).toHaveAttribute('data-state', 'ready');

    const rmBtn = smallRow.locator('[data-act="rm"]');
    await expect(rmBtn).toBeVisible();

    // Real mouse click to delete model
    await mouseClick(page, rmBtn);
    await expect(smallRow).toHaveAttribute('data-state', 'none');
  });

  test('Voice delete succeeds via real mouse click when Voices tab is active', async ({ app }) => {
    const { page } = app;
    const cat = await page.evaluate(() => MODEL_CATALOG);
    const amir = cat.models.find(m => m.id === 'tts-fa-amir');

    await fakeDownloaded(page, amir.repo, amir.files);
    await page.evaluate(() => mcScan());

    await openSettings(page);

    // Switch to Voices tab
    await mouseClick(page, page.locator('#setTabBtnVoices'));
    await expect(page.locator('#secVoices')).toHaveClass(/active/);

    await page.evaluate(() => offStatus());
    const amirRow = row(page, 'tts-fa-amir');
    await expect(amirRow).toHaveAttribute('data-state', 'ready');

    const rmBtn = amirRow.locator('[data-act="rm"]');
    await expect(rmBtn).toBeVisible();

    // Real mouse click to delete voice
    await mouseClick(page, rmBtn);
    await expect(amirRow).toHaveAttribute('data-state', 'none');
  });

  test('Radio selection succeeds via real mouse click when Translation models tab is active', async ({ app }) => {
    const { page } = app;
    const cat = await page.evaluate(() => MODEL_CATALOG);
    for (const id of ['tr-nllb-600', 'tr-m2m100-418']) {
      const m = cat.models.find(x => x.id === id);
      await page.evaluate(({ id, f }) => {
        const d = store.get('mdl', {});
        d[id] = { at: 1, files: f };
        store.set('mdl', d);
      }, { id, f: m.files.map(f => f[0]).filter(f => f.endsWith('.onnx')) });
      await fakeDownloaded(page, m.repo, m.files);
    }
    await page.evaluate(() => mcScan());

    await openSettings(page);

    // Switch to Translation models tab
    await mouseClick(page, page.locator('#setTabBtnTrModels'));
    await expect(page.locator('#secTrModels')).toHaveClass(/active/);

    await page.evaluate(() => mcRender());

    // Select tr-m2m100-418 first
    await page.locator('#offTrModelSel').selectOption('tr-m2m100-418');
    await expect(row(page, 'tr-m2m100-418').locator('input[type="radio"]')).toBeChecked();

    // Click radio of tr-nllb-600 with real mouse click
    const radioBtn = row(page, 'tr-nllb-600').locator('input[type="radio"]');
    await mouseClick(page, radioBtn);

    await expect(page.locator('#offTrModelSel')).toHaveValue('tr-nllb-600');
    expect(await page.evaluate(() => cfg.trModel)).toBe('tr-nllb-600');
  });

  test('OCR controls respond to real mouse click when Screen reading (OCR) tab is active', async ({ app }) => {
    const { page } = app;
    await openSettings(page);

    // Switch to OCR tab
    await mouseClick(page, page.locator('#setTabBtnOcr'));
    await expect(page.locator('#secOcr')).toHaveClass(/active/);

    // Check Persian status card
    const ocrCard = page.locator('#stPersianModelCard');
    await expect(ocrCard).toBeVisible();

    // Change OCR setting via dropdown
    const stEnable = page.locator('#stEnable');
    await expect(stEnable).toBeVisible();
    await stEnable.selectOption('0');
    expect(await page.evaluate(() => String(cfg.screenTrans?.enabled ?? 0))).toBe('0');

    await stEnable.selectOption('1');
    expect(await page.evaluate(() => String(cfg.screenTrans?.enabled ?? 1))).toBe('1');
  });
});
