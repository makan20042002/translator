'use strict';
/**
 * Guard tests: ensure critical structural invariants and that loading every tab
 * throws no page errors or console errors.
 */
const { test, expect, mouseClick } = require('../support/fixtures');
const { fakeDownloaded } = require('../support/model-helpers');

test.describe('Web app: stability and structural guard', () => {
  test('loading and switching every tab throws zero page errors or console errors', async ({ app }) => {
    const { page, errors } = app;

    // Listen specifically for uncaught page errors
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    // Get all tab buttons defined in the DOM
    const tabBtns = page.locator('#tabs button[data-tab]');
    const count = await tabBtns.count();
    expect(count).toBeGreaterThanOrEqual(7);

    for (let i = 0; i < count; i++) {
      const btn = tabBtns.nth(i);
      const tabId = await btn.getAttribute('data-tab');
      await mouseClick(page, btn);
      await expect(page.locator(`#tab-${tabId}`)).toBeVisible();
      await expect(btn).toHaveClass(/\bon\b/);
    }

    // Open and close Settings modal
    await mouseClick(page, page.locator('#openSet'));
    await expect(page.locator('#ov')).toHaveClass(/\bon\b/);
    await mouseClick(page, page.locator('#closeSet'));
    await expect(page.locator('#ov')).not.toHaveClass(/\bon\b/);

    // Open and close Credits
    await mouseClick(page, page.locator('#creditsBtn'));
    await expect(page.locator('#creditsBox')).toBeVisible();
    await mouseClick(page, page.locator('#creditsClose'));
    await expect(page.locator('#creditsBox')).toBeHidden();

    // Settle late async timers
    await page.waitForTimeout(500);

    expect(pageErrors, 'uncaught page errors while switching tabs').toEqual([]);
    expect(errors, 'console errors while switching tabs').toEqual([]);
  });

  test('global notification and dialog elements are not trapped inside settings overlay', async ({ app }) => {
    const { page } = app;

    // Verify that toasts, wordCard, creditsBox, and speakNotice are siblings of #ov, not descendants of #ov or .modal
    const trapped = await page.evaluate(() => {
      const ov = document.getElementById('ov');
      const ids = ['creditsBox', 'wordCard', 'speakNotice', 'toasts'];
      return ids.filter(id => {
        const el = document.getElementById(id);
        return el && ov && ov.contains(el);
      });
    });

    expect(trapped, 'elements incorrectly nested inside #ov').toEqual([]);
  });

  test('offline model picker correctly identifies ready translation models without null error', async ({ app }) => {
    const { page } = app;

    // Set up ready NLLB model in store and cache
    const nllb = await page.evaluate(() => MODEL_CATALOG.models.find(m => m.id === 'tr-nllb-600'));
    await page.evaluate(({ id, files }) => {
      const mockDone = { [id]: { at: Date.now(), files } };
      store.set('mdl', mockDone);
    }, { id: nllb.id, files: nllb.files.map(f => f[0]) });
    await fakeDownloaded(page, nllb.repo, nllb.files);
    await page.evaluate(() => mcScan());

    const result = await page.evaluate(() => {
      try {
        const model = pickTr('en', 'fa');
        return { ok: true, modelId: model ? model.id : null };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    });

    expect(result.ok).toBe(true);
    expect(result.modelId).toBe('tr-nllb-600');
  });
});
