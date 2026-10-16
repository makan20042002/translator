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
    const dHint = page.locator('#dOfflineModelHint');
    const vHint = page.locator('#vOfflineModelHint');

    // 1. Initial state: no model is downloaded
    await page.evaluate(() => {
      store.set('mdl', {});
      store.set('nllb', false);
      cfg.trModel = 'auto';
      if (typeof saveCfg === 'function') saveCfg();
      if (typeof mcRender === 'function') mcRender();
    });

    // Text tab assertion
    await expect(tHint).toBeVisible();
    await expect(tHint).toContainText('No offline model downloaded');

    // Document tab assertion
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await expect(dHint).toBeVisible();
    await expect(dHint).toContainText('No offline model downloaded');

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
      cfg.trModel = 'tr-m2m100-418';
      if (typeof saveCfg === 'function') saveCfg();
      if (typeof mcRender === 'function') mcRender();
    });

    // Document tab: should update immediately to show M2M-100
    await expect(dHint).toBeVisible();
    await expect(dHint).toContainText('M2M-100');

    // Text tab: should show M2M-100 without reloading
    await mouseClick(page, page.locator('#tabs button[data-tab="text"]'));
    await expect(tHint).toBeVisible();
    await expect(tHint).toContainText('M2M-100');

    // Voice tab: should show M2M-100 without reloading
    await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));
    await expect(vHint).toBeVisible();
    await expect(vHint).toContainText('M2M-100');

    // 3. Switch choice to NLLB (seed NLLB as downloaded too and switch cfg.trModel without reloading)
    await page.evaluate(() => {
      const cat = self.MODEL_CATALOG?.models || [];
      const nllb = cat.find(m => m.id === 'tr-nllb-600');
      const d = store.get('mdl', {});
      d['tr-nllb-600'] = { at: Date.now(), files: nllb.files.map(f => f[0]) };
      store.set('mdl', d);
      store.set('nllb', true);
      cfg.trModel = 'tr-nllb-600';
      if (typeof saveCfg === 'function') saveCfg();
      if (typeof mcRender === 'function') mcRender();
    });

    // Voice tab updates to NLLB
    await expect(vHint).toBeVisible();
    await expect(vHint).toContainText('NLLB');
    await expect(vHint).not.toContainText('M2M-100');

    // Text tab updates to NLLB
    await mouseClick(page, page.locator('#tabs button[data-tab="text"]'));
    await expect(tHint).toBeVisible();
    await expect(tHint).toContainText('NLLB');
    await expect(tHint).not.toContainText('M2M-100');

    // Document tab updates to NLLB
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await expect(dHint).toBeVisible();
    await expect(dHint).toContainText('NLLB');
    await expect(dHint).not.toContainText('M2M-100');
  });

  const layoutConfigs = [
    { vp: { width: 1280, height: 900 }, lang: 'en', doTranslation: true },
    { vp: { width: 1280, height: 900 }, lang: 'fa', doTranslation: true },
    { vp: { width: 360, height: 700 }, lang: 'en', doTranslation: false },
    { vp: { width: 360, height: 700 }, lang: 'fa', doTranslation: false }
  ];

  for (const { vp, lang, doTranslation } of layoutConfigs) {
    test(`document hint layout at ${vp.width}x${vp.height} in ${lang.toUpperCase()}`, async ({ app, files }) => {
      const { page } = app;
      await page.setViewportSize(vp);

      // Navigate to doc tab
      await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

      // Set UI language and seed a model so the hint displays text
      await page.evaluate(({ lang }) => {
        store.set('ui', lang);
        if (typeof ui !== 'undefined') ui = lang;
        document.documentElement.lang = lang;
        document.documentElement.dir = (lang === 'fa' ? 'rtl' : 'ltr');
        if (typeof applyUiLang === 'function') applyUiLang(lang);

        const cat = self.MODEL_CATALOG?.models || [];
        const nllb = cat.find(m => m.id === 'tr-nllb-600');
        if (nllb) {
          const d = store.get('mdl', {});
          d[nllb.id] = { at: Date.now(), files: nllb.files.map(f => f[0]) };
          store.set('mdl', d);
          if (!mcCache) mcCache = {};
          mcCache[nllb.repo] = { bytes: 1000, files: new Map(nllb.files.map(f => [f[0], f[1]])) };
        }
        if (typeof updateOfflineModelHints === 'function') updateOfflineModelHints();
        if (typeof updateDocEngineInfo === 'function') updateDocEngineInfo();
      }, { lang });

      const dHint = page.locator('#dOfflineModelHint');
      const dSel = page.locator('#dEngineSel');

      await expect(dHint).toBeVisible();
      await expect(dSel).toBeVisible();

      const hintBox = await dHint.boundingBox();
      const selBox = await dSel.boundingBox();
      expect(hintBox, 'hint bounding box').not.toBeNull();
      expect(selBox, 'select bounding box').not.toBeNull();

      // (a) Document hint is on the same horizontal band as #dEngineSel (its box top is within the select's box top/bottom)
      expect(hintBox.y).toBeGreaterThanOrEqual(selBox.y);
      expect(hintBox.y).toBeLessThanOrEqual(selBox.y + selBox.height);

      // (b) its right edge is inside the viewport
      expect(hintBox.x + hintBox.width).toBeLessThanOrEqual(vp.width);
      expect(hintBox.x).toBeGreaterThanOrEqual(0);

      // (c) after a stubbed translation of a small .txt the Download button bottom is <= viewport height and nothing covers it
      if (doTranslation) {
        await chooseFile(page, page.locator('#dDrop'), files.txt);
        await mouseClick(page, page.locator('#dGo'));

        const dSave = page.locator('#dSave');
        await expect(dSave).toBeEnabled({ timeout: 20_000 });

        const saveBox = await dSave.boundingBox();
        expect(saveBox, '#dSave bounding box').not.toBeNull();
        expect(saveBox.y + saveBox.height).toBeLessThanOrEqual(vp.height);

        const onTop = await page.evaluate(({ x, y }) => {
          const e = document.elementFromPoint(x, y);
          return e ? (e.id || e.className || e.tagName) : null;
        }, { x: saveBox.x + saveBox.width / 2, y: saveBox.y + saveBox.height / 2 });
        expect(onTop).toBe('dSave');
      }
    });
  }
});

