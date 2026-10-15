'use strict';
const { test, expect, mouseClick, onlyEngines } = require('../support/fixtures');

test.describe('Document tab engine picker persistence across reloads and rebuilds', () => {

  test.describe('seeded with mymemory', () => {
    test.use({
      appOptions: {
        seed: {
          cfg: onlyEngines(['google', 'mymemory', 'ollama', 'nllb']),
          src: 'en',
          tgt: 'fa',
          doc_engine: 'mymemory'
        }
      }
    });

    test('seeded doc_engine survives page load, document tab open, and late model refresh', async ({ app }) => {
      const { page } = app;
      await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

      // Wait 2 seconds so any late model-list refresh can run
      await page.waitForTimeout(2000);

      const picker = page.locator('#dEngineSel');
      await expect(picker).toHaveValue('mymemory');

      const stored = await page.evaluate(() => store.get('doc_engine', ''));
      expect(stored).toBe('mymemory');
    });
  });

  test.describe('seeded with google', () => {
    test.use({
      appOptions: {
        seed: {
          cfg: onlyEngines(['google', 'mymemory', 'ollama', 'nllb']),
          src: 'en',
          tgt: 'fa',
          doc_engine: 'google'
        }
      }
    });

    test('seeded doc_engine stays selected across interface language toggle and picker model refresh', async ({ app }) => {
      const { page } = app;
      await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

      const picker = page.locator('#dEngineSel');
      await expect(picker).toHaveValue('google');

      // Switch interface language to Persian and back
      await mouseClick(page, page.locator('#uiLang'));
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.locator('html')).toHaveAttribute('lang', 'fa');

      await mouseClick(page, page.locator('#uiLang'));
      await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');

      // Click on #dEngineSel (model refresh)
      await mouseClick(page, picker);
      await page.waitForTimeout(500);

      await expect(picker).toHaveValue('google');
      const stored = await page.evaluate(() => store.get('doc_engine', ''));
      expect(stored).toBe('google');
    });
  });

  test.describe('interactive user selection', () => {
    test.use({
      appOptions: {
        seed: {
          cfg: onlyEngines(['google', 'mymemory', 'ollama', 'nllb']),
          src: 'en',
          tgt: 'fa'
        }
      }
    });

    test('engine chosen through picker as a user survives reload and document tab open', async ({ app }) => {
      const { page } = app;
      await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

      const picker = page.locator('#dEngineSel');
      await picker.selectOption('mymemory');
      await expect(picker).toHaveValue('mymemory');

      const storedBeforeReload = await page.evaluate(() => store.get('doc_engine', ''));
      expect(storedBeforeReload).toBe('mymemory');

      // Reload the page
      await page.reload();

      // Open the Document tab
      await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

      // Value restored
      await expect(picker).toHaveValue('mymemory');
      const storedAfterReload = await page.evaluate(() => store.get('doc_engine', ''));
      expect(storedAfterReload).toBe('mymemory');
    });
  });

});
