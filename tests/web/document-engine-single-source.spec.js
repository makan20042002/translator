'use strict';

/**
 * tests/web/document-engine-single-source.spec.js
 * Verifies single source of truth for the Document tab engine picker:
 * (a) Seed store 'doc_engine' = 'google' and 'engine' = 'auto': after load, 'engine' is 'google' and 'doc_engine' is cleared.
 * (b) Pick Gemini in Document picker, reload, translate a .txt with stub: only Gemini receives requests.
 * (c) A stale hidden #dEngineSel value never overrides the picker.
 */

const { test, expect, mouseClick, chooseFile, onlyEngines, VALID_KEY } = require('../support/fixtures');

test.describe('Document engine single source of truth (ITEM 3)', () => {

  test.describe('(a) startup migration from legacy doc_engine to shared engine', () => {
    test.use({
      appOptions: {
        seed: {
          cfg: onlyEngines(['google', 'gemini'], { gemini: VALID_KEY }),
          src: 'en',
          tgt: 'fa',
          doc_engine: 'google',
          engine: 'auto'
        }
      }
    });

    test('after load, engine is google and doc_engine is cleared', async ({ app }) => {
      const { page } = app;
      await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

      const storedEngine = await page.evaluate(() => store.get('engine', ''));
      const storedDocEngine = await page.evaluate(() => store.get('doc_engine', ''));

      expect(storedEngine).toBe('google');
      expect(storedDocEngine).toBe('');

      const picker = page.locator('#docEnginePickerHost .engine-picker-select');
      await expect(picker).toHaveValue('google');
    });
  });

  test.describe('(b) pick Gemini in Document picker, reload, and translate', () => {
    test.use({
      appOptions: {
        seed: {
          cfg: onlyEngines(['google', 'gemini'], { gemini: VALID_KEY }),
          src: 'en',
          tgt: 'fa'
        }
      }
    });

    test('pick Gemini in Document picker, reload, translate .txt: only Gemini receives requests', async ({ app, files, stub }) => {
      const { page } = app;
      await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

      const picker = page.locator('#docEnginePickerHost .engine-picker-select');
      await picker.selectOption('gemini');
      await expect(picker).toHaveValue('gemini');

      // Reload page
      await page.reload();

      // Verify picker on Document tab retained Gemini
      await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
      await expect(page.locator('#docEnginePickerHost .engine-picker-select')).toHaveValue('gemini');

      stub.clearLog();

      // Translate a .txt file
      await chooseFile(page, page.locator('#dDrop'), files.txt);
      await expect(page.locator('#dWork')).toBeVisible();
      await mouseClick(page, page.locator('#dGo'));

      await expect(page.locator('#dSave')).toBeEnabled({ timeout: 25_000 });
      await expect(page.locator('#dProgText')).toContainText(/Done|تمام شد/i);

      // Verify only Gemini received requests
      const geminiCalls = stub.calls('generativelanguage.googleapis.com');
      expect(geminiCalls.length).toBeGreaterThan(0);

      const googleCalls = stub.calls('clients5.google.com').concat(stub.calls('translate.googleapis.com'));
      expect(googleCalls.length).toBe(0);
    });
  });

  test.describe('(c) stale hidden #dEngineSel never overrides the picker', () => {
    test.use({
      appOptions: {
        seed: {
          cfg: onlyEngines(['google', 'gemini'], { gemini: VALID_KEY }),
          src: 'en',
          tgt: 'fa'
        }
      }
    });

    test('stale hidden #dEngineSel value never overrides the picker', async ({ app, files, stub }) => {
      const { page } = app;
      await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

      // Pick Gemini in the shared picker
      const picker = page.locator('#docEnginePickerHost .engine-picker-select');
      await picker.selectOption('gemini');
      await expect(picker).toHaveValue('gemini');

      // Force a stale value onto the hidden #dEngineSel and in store.doc_engine
      await page.evaluate(() => {
        const hiddenSel = document.getElementById('dEngineSel');
        if (hiddenSel) {
          hiddenSel.value = 'google';
          hiddenSel.dispatchEvent(new Event('change'));
        }
        store.set('doc_engine', 'google');
      });

      stub.clearLog();

      // Translate .txt file
      await chooseFile(page, page.locator('#dDrop'), files.txt);
      await expect(page.locator('#dWork')).toBeVisible();
      await mouseClick(page, page.locator('#dGo'));

      await expect(page.locator('#dSave')).toBeEnabled({ timeout: 25_000 });
      await expect(page.locator('#dProgText')).toContainText(/Done|تمام شد/i);

      // Verify Gemini was used despite stale #dEngineSel
      const geminiCalls = stub.calls('generativelanguage.googleapis.com');
      expect(geminiCalls.length).toBeGreaterThan(0);

      // Google must NOT have received translation requests
      const googleCalls = stub.calls('clients5.google.com').concat(stub.calls('translate.googleapis.com'));
      expect(googleCalls.length).toBe(0);
    });
  });

});
