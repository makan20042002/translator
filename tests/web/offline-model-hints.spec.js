'use strict';
/**
 * Test Item 3: Visible offline model line under engine pickers across Document, Text, and Voice tabs.
 * Verifies that:
 * 1. The line is visible and contains the chosen model name (Document, Text, Voice).
 * 2. After switching the choice the text changes without reloading.
 * 3. With no model downloaded it shows the "No offline model downloaded" text.
 */
const { test, expect, mouseClick, onlyEngines } = require('../support/fixtures');

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
});
