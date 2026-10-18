'use strict';

/**
 * tests/web/document-translate-no-crash.spec.js
 * Verifies Document tab translation executes without throwing page errors (e.g. "docChosen is not defined"),
 * produces translated output, and enables the Download button when seeded via:
 * 1) store 'doc_engine'
 * 2) shared engine picker ('engine')
 */

const { test, expect, mouseClick, chooseFile, onlyEngines } = require('../support/fixtures');

test.describe('Document tab translation without crash', () => {

  test.describe('engine seeded through store "doc_engine"', () => {
    test.use({
      appOptions: {
        seed: {
          cfg: onlyEngines(['google', 'mymemory']),
          src: 'en',
          tgt: 'fa',
          doc_engine: 'google'
        }
      }
    });

    test('translates .txt successfully without pageerror and enables Download', async ({ app, files }) => {
      const { page } = app;
      const pageErrors = [];
      page.on('pageerror', err => {
        pageErrors.push(err.message || String(err));
      });

      await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
      await chooseFile(page, page.locator('#dDrop'), files.txt);
      await expect(page.locator('#dWork')).toBeVisible();

      await mouseClick(page, page.locator('#dGo'));

      await expect(page.locator('#dSave')).toBeEnabled({ timeout: 25_000 });
      await expect(page.locator('#dProgText')).toContainText(/Done|تمام شد/i);
      await expect(page.locator('#dOut')).not.toHaveValue('');

      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('engine seeded through shared engine picker', () => {
    test.use({
      appOptions: {
        seed: {
          cfg: onlyEngines(['google', 'mymemory']),
          src: 'en',
          tgt: 'fa',
          engine: 'google'
        }
      }
    });

    test('translates .txt successfully without pageerror and enables Download', async ({ app, files }) => {
      const { page } = app;
      const pageErrors = [];
      page.on('pageerror', err => {
        pageErrors.push(err.message || String(err));
      });

      await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
      await chooseFile(page, page.locator('#dDrop'), files.txt);
      await expect(page.locator('#dWork')).toBeVisible();

      await mouseClick(page, page.locator('#dGo'));

      await expect(page.locator('#dSave')).toBeEnabled({ timeout: 25_000 });
      await expect(page.locator('#dProgText')).toContainText(/Done|تمام شد/i);
      await expect(page.locator('#dOut')).not.toHaveValue('');

      expect(pageErrors).toEqual([]);
    });
  });

});
