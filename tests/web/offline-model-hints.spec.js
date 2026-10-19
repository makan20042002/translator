'use strict';
/**
 * Test Item 3: Visible offline model line under engine pickers across Document, Text, and Voice tabs.
 * Verifies that:
 * 1. The line is visible and contains the chosen model name (Document, Text, Voice).
 * 2. After switching the choice the text changes without reloading.
 * 3. With no model downloaded it shows the "No offline model downloaded" text.
 */
const { test, expect, mouseClick, chooseFile, onlyEngines } = require('../support/fixtures');

test.describe('Offline model hint line across tabs (Item 3)', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google', 'nllb']), src: 'en', tgt: 'fa' } } });

  test('line is visible in Text, Document, Voice, updates without reload, and reflects download status', async ({ app }) => {
    const { page } = app;

    const tHint = page.locator('#tOfflineModelHint');
    const dPicker = page.locator('#docEnginePickerHost .engine-picker-select');
    const dSel = page.locator('#dEngineSel');
    const docEngineText = page.locator('#docEngineText');
    const vHint = page.locator('#vOfflineModelHint');

    // 1. Initial state: no model is downloaded
    await page.evaluate(() => {
      store.set('mdl', {});
      store.set('nllb', false);
      if (mcCache) {
        const cat = self.MODEL_CATALOG?.models || [];
        for (const m of cat) {
          if (m.job === 'translate' && m.repo) delete mcCache[m.repo];
        }
      }
      cfg.trModel = 'auto';
      if (typeof saveCfg === 'function') saveCfg();
      if (typeof mcRender === 'function') mcRender();
    });

    // Text tab assertion
    await mouseClick(page, page.locator('#tabs button[data-tab="text"]'));
    await expect(tHint).toBeAttached();
    await expect(tHint).toContainText('No offline model downloaded');

    // Document tab assertion
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await expect(dPicker).toBeVisible();
    await expect(dSel).toHaveAttribute('title', /No offline model downloaded/);

    // Voice tab assertion
    await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));
    await expect(vHint).toBeVisible();
    await expect(vHint).toContainText('No offline model downloaded');

    // 2. Seed M2M100 as downloaded and chosen (without page reload)
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
      if (typeof mcRender === 'function') mcRender();
    });

    // Document tab: should update immediately to show M2M-100
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await expect(dPicker).toBeVisible();
    await expect(dSel).toHaveAttribute('title', /M2M-100/);
    await dPicker.selectOption('nllb');
    await expect(docEngineText).toContainText('M2M-100');
    await dPicker.selectOption('auto');

    // Text tab: should show M2M-100 without reloading
    await mouseClick(page, page.locator('#tabs button[data-tab="text"]'));
    await expect(tHint).toBeAttached();
    await expect(tHint).toHaveText(/^Offline model:/);
    await expect(tHint).toContainText('M2M-100');

    // Voice tab: should show M2M-100 without reloading
    await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));
    await expect(vHint).toBeVisible();
    await expect(vHint).toContainText('M2M-100');

    // 3. Switch choice to NLLB (seed NLLB as downloaded too, keep M2M-100 cached, and switch cfg.trModel without reloading)
    await page.evaluate(() => {
      const cat = self.MODEL_CATALOG?.models || [];
      const nllb = cat.find(m => m.id === 'tr-nllb-600');
      const d = store.get('mdl', {});
      d['tr-nllb-600'] = { at: Date.now(), files: nllb.files.map(f => f[0]) };
      store.set('mdl', d);
      store.set('nllb', true);
      if (!mcCache) mcCache = {};
      mcCache[nllb.repo] = { bytes: 1000, files: new Map(nllb.files.map(f => [f[0], f[1]])) };
      cfg.trModel = 'tr-nllb-600';
      if (typeof saveCfg === 'function') saveCfg();
      if (typeof mcRender === 'function') mcRender();
    });

    // Voice tab updates to NLLB
    await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));
    await expect(vHint).toBeVisible();
    await expect(vHint).toContainText('NLLB');
    await expect(vHint).not.toContainText('M2M-100');

    // Text tab updates to NLLB
    await mouseClick(page, page.locator('#tabs button[data-tab="text"]'));
    await expect(tHint).toBeAttached();
    await expect(tHint).toHaveText(/^Offline model:/);
    await expect(tHint).toContainText('NLLB');
    await expect(tHint).not.toContainText('M2M-100');

    // Document tab updates to NLLB
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await expect(dPicker).toBeVisible();
    await expect(dSel).toHaveAttribute('title', /NLLB/);
    await expect(dSel).not.toHaveAttribute('title', /M2M-100/);
    await dPicker.selectOption('nllb');
    await expect(docEngineText).toContainText('NLLB');
    await expect(docEngineText).not.toContainText('M2M-100');
    await dPicker.selectOption('auto');

    // 4. With cfg.trModel='auto' and both models cached, Text hint shows Auto and NLLB name
    await page.evaluate(() => {
      cfg.trModel = 'auto';
      if (typeof saveCfg === 'function') saveCfg();
      if (typeof mcRender === 'function') mcRender();
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="text"]'));
    await expect(tHint).toBeAttached();
    await expect(tHint).toHaveText(/^Offline model:/);
    await expect(tHint).toContainText('Auto');
    await expect(tHint).toContainText('NLLB');
  });

  const layoutConfigs = [
    { vp: { width: 1280, height: 900 }, lang: 'en', doTranslation: true },
    { vp: { width: 1280, height: 900 }, lang: 'fa', doTranslation: true },
    { vp: { width: 700, height: 900 }, lang: 'en', doTranslation: false },
    { vp: { width: 700, height: 900 }, lang: 'fa', doTranslation: false },
    { vp: { width: 360, height: 700 }, lang: 'en', doTranslation: false },
    { vp: { width: 360, height: 700 }, lang: 'fa', doTranslation: false }
  ];

  for (const { vp, lang, doTranslation } of layoutConfigs) {
    test(`document hint layout at ${vp.width}x${vp.height} in ${lang.toUpperCase()}`, async ({ app, files }) => {
      const { page } = app;
      await page.setViewportSize(vp);

      // Navigate to doc tab
      await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

      const headerTop = page.locator('.doc-header-top');
      const headerControls = page.locator('.doc-header-controls');
      const dPicker = page.locator('#docEnginePickerHost .engine-picker-select');
      const dSel = page.locator('#dEngineSel');
      const docEngineText = page.locator('#docEngineText');

      // State 1: No offline model downloaded
      await page.evaluate(({ lang }) => {
        store.set('ui', lang);
        if (typeof ui !== 'undefined') ui = lang;
        document.documentElement.lang = lang;
        document.documentElement.dir = (lang === 'fa' ? 'rtl' : 'ltr');
        if (typeof applyUiLang === 'function') applyUiLang(lang);

        store.set('mdl', {});
        store.set('nllb', false);
        if (mcCache) {
          const cat = self.MODEL_CATALOG?.models || [];
          for (const m of cat) {
            if (m.job === 'translate' && m.repo) delete mcCache[m.repo];
          }
        }
        cfg.trModel = 'auto';
        if (typeof saveCfg === 'function') saveCfg();
        if (typeof updateOfflineModelHints === 'function') updateOfflineModelHints();
        if (typeof updateDocEngineInfo === 'function') updateDocEngineInfo();
      }, { lang });

      await dPicker.selectOption('nllb');

      const topBoxNoModel = await headerTop.boundingBox();
      const controlsBoxNoModel = await headerControls.boundingBox();
      expect(topBoxNoModel, 'header top bounding box with no model').not.toBeNull();
      expect(controlsBoxNoModel, 'header controls bounding box with no model').not.toBeNull();

      // State 2: Longest-named model (mBART-50 or M2M-100) chosen and downloaded
      await page.evaluate(({ lang }) => {
        const cat = self.MODEL_CATALOG?.models || [];
        const model = cat.find(m => m.id === 'tr-mbart50') || cat.find(m => m.id === 'tr-m2m100-418');
        if (model) {
          const d = store.get('mdl', {});
          d[model.id] = { at: Date.now(), files: model.files.map(f => f[0]) };
          store.set('mdl', d);
          if (!mcCache) mcCache = {};
          mcCache[model.repo] = { bytes: 1000, files: new Map(model.files.map(f => [f[0], f[1]])) };
          cfg.trModel = model.id;
          if (typeof saveCfg === 'function') saveCfg();
        }
        if (typeof updateOfflineModelHints === 'function') updateOfflineModelHints();
        if (typeof updateDocEngineInfo === 'function') updateDocEngineInfo();
      }, { lang });

      await dPicker.selectOption('nllb');

      const topBoxWithModel = await headerTop.boundingBox();
      const controlsBoxWithModel = await headerControls.boundingBox();
      expect(topBoxWithModel, 'header top bounding box with model').not.toBeNull();
      expect(controlsBoxWithModel, 'header controls bounding box with model').not.toBeNull();

      // Assert that .doc-header-controls height and .doc-header-top height are IDENTICAL in both states
      expect(controlsBoxWithModel.height, 'controls height identical in both states').toBe(controlsBoxNoModel.height);
      expect(topBoxWithModel.height, 'header top height identical in both states').toBe(topBoxNoModel.height);

      // Assert that the controls fit on the same number of lines (compare heights)
      expect(controlsBoxWithModel.height).toBe(controlsBoxNoModel.height);

      // Assert the Document hint text really contains the model name (read #docEngineText textContent and the select's title)
      const engineTextContent = await docEngineText.textContent();
      const selTitle = await dSel.getAttribute('title');
      expect(engineTextContent).toMatch(/mBART-50|M2M-100/);
      expect(selTitle).toMatch(/mBART-50|M2M-100/);

      // Reset picker to default for stubbed translation
      await dPicker.selectOption('auto');

      if (doTranslation) {
        await chooseFile(page, page.locator('#dDrop'), files.txt);
        await mouseClick(page, page.locator('#dGo'));

        const dSave = page.locator('#dSave');
        await expect(dSave).toBeEnabled({ timeout: 20_000 });

        const saveBox = await dSave.boundingBox();
        expect(saveBox, '#dSave bounding box').not.toBeNull();
        expect(saveBox.y + saveBox.height, '#dSave bottom must be <= viewport height at 1280x900').toBeLessThanOrEqual(vp.height);

        const onTop = await page.evaluate(({ x, y }) => {
          const e = document.elementFromPoint(x, y);
          return e ? (e.id || e.className || e.tagName) : null;
        }, { x: saveBox.x + saveBox.width / 2, y: saveBox.y + saveBox.height / 2 });
        expect(onTop).toBe('dSave');
      }
    });
  }
});

