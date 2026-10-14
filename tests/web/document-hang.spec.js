'use strict';
// Tests for Document tab on-device hang recovery, availability timeout/skip, engine timeout, and stop behavior.
const { test, expect, onlyEngines, mouseClick, chooseFile } = require('../support/fixtures');

test.describe('Web app: Document tab hang & timeout recovery', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['chrome', 'google']), tMode: 'fast', src: 'en', tgt: 'fa' } } });

  test('fake on-device Translator whose availability() never resolves falls to next engine and finishes with Download enabled', async ({ app, files }) => {
    const { page } = app;
    await page.evaluate(() => {
      window.__chromeAvailTimeoutMs = 150;
      window.__docTimeoutMs = 1000;
      window.Translator = {
        availability: () => new Promise(() => {}) // never resolves
      };
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await expect(page.locator('#dWork')).toBeVisible();

    await mouseClick(page, page.locator('#dGo'));

    // Should fall back to Google within timeout and finish
    const saveBtn = page.locator('#dSave');
    await expect(saveBtn).toBeEnabled({ timeout: 10_000 });
    const progText = page.locator('#dProgText');
    await expect(progText).toContainText(/Done|انجام شد/);
    const statusChip = page.locator('#dStatusChip');
    await expect(statusChip).toHaveClass(/ok/);
  });

  test('fake on-device Translator reporting downloadable is skipped without download and next engine is used', async ({ app, files }) => {
    const { page } = app;
    await page.evaluate(() => {
      window.__createCalled = false;
      window.Translator = {
        availability: async () => 'downloadable',
        create: async () => {
          window.__createCalled = true;
          return { translate: async (s) => s };
        }
      };
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await expect(page.locator('#dWork')).toBeVisible();

    await mouseClick(page, page.locator('#dGo'));

    const saveBtn = page.locator('#dSave');
    await expect(saveBtn).toBeEnabled({ timeout: 10_000 });
    await expect(page.locator('#dProgText')).toContainText(/Done|انجام شد/);

    const createCalled = await page.evaluate(() => window.__createCalled);
    expect(createCalled, 'Translator.create() must not be called when downloadable').toBe(false);
  });

  test('fake on-device Translator whose translate() never resolves shows timeout line and uses next engine', async ({ app, files }) => {
    const { page } = app;
    await page.evaluate(() => {
      window.__chromeAvailTimeoutMs = 1000;
      window.__docTimeoutMs = 300;
      window.Translator = {
        availability: async () => 'available',
        create: async () => ({
          translate: () => new Promise(() => {}) // never resolves
        })
      };
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await expect(page.locator('#dWork')).toBeVisible();

    // Record every #dProgText text with a MutationObserver installed before clicking #dGo
    await page.evaluate(() => {
      window.__progressTexts = [];
      const progEl = document.getElementById('dProgText');
      if (progEl) {
        if (progEl.textContent) window.__progressTexts.push(progEl.textContent);
        const obs = new MutationObserver(() => {
          const txt = progEl.textContent;
          if (txt) window.__progressTexts.push(txt);
        });
        obs.observe(progEl, { childList: true, characterData: true, subtree: true });
      }
    });

    await mouseClick(page, page.locator('#dGo'));

    // Translation should continue with Google and finish with Download enabled
    const saveBtn = page.locator('#dSave');
    await expect(saveBtn).toBeEnabled({ timeout: 10_000 });
    const progText = page.locator('#dProgText');
    await expect(progText).toContainText(/Done|انجام شد/);

    // Assert that the timeout line appeared at least once
    const progressList = await page.evaluate(() => window.__progressTexts);
    const timeoutSeen = progressList.some(txt => /Chrome on-device (did not answer|پاسخی نداد)/.test(txt));
    expect(timeoutSeen, `timeout line must appear in progress text, recorded list: ${JSON.stringify(progressList)}`).toBe(true);
  });

  test('Stop clicked while an engine call hangs becomes Stopped within 2 seconds, re-enables Translate, and Download stays disabled', async ({ app, files }) => {
    const { page } = app;
    await page.evaluate(() => {
      window.__chromeAvailTimeoutMs = 20_000;
      window.__docTimeoutMs = 20_000;
      window.Translator = {
        availability: async () => 'available',
        create: async () => ({
          translate: () => new Promise(() => {}) // hangs
        })
      };
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await expect(page.locator('#dWork')).toBeVisible();

    await mouseClick(page, page.locator('#dGo'));

    const stopBtn = page.locator('#dStop');
    await expect(stopBtn).toBeVisible({ timeout: 3000 });

    const startTime = Date.now();
    await mouseClick(page, stopBtn);

    const progText = page.locator('#dProgText');
    const statusText = page.locator('#dStatusText');

    // Status becomes Stopped within 2 seconds
    await expect(progText).toContainText(/Stopped|متوقف شد/, { timeout: 2000 });
    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeLessThan(2000);

    // Translate is enabled again, stop button hidden
    await expect(page.locator('#dGo')).toBeEnabled();
    await expect(stopBtn).toBeHidden();

    // No "Done"
    await expect(progText).not.toContainText(/Done|انجام شد/);
    await expect(statusText).not.toContainText(/Done|انجام شد/);

    // Download stays disabled
    await expect(page.locator('#dSave')).toBeDisabled();
  });

  test('Stop clicked while availability() hangs becomes Stopped within 2 seconds with Download disabled', async ({ app, files }) => {
    const { page } = app;
    await page.evaluate(() => {
      window.__chromeAvailTimeoutMs = 20_000;
      window.__docTimeoutMs = 20_000;
      window.Translator = {
        availability: () => new Promise(() => {}) // hangs in availability
      };
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await expect(page.locator('#dWork')).toBeVisible();

    await mouseClick(page, page.locator('#dGo'));

    const stopBtn = page.locator('#dStop');
    await expect(stopBtn).toBeVisible({ timeout: 3000 });

    const startTime = Date.now();
    await mouseClick(page, stopBtn);

    const progText = page.locator('#dProgText');
    await expect(progText).toContainText(/Stopped|متوقف شد/, { timeout: 2000 });
    expect(Date.now() - startTime).toBeLessThan(2000);

    await expect(page.locator('#dGo')).toBeEnabled();
    await expect(stopBtn).toBeHidden();
    await expect(progText).not.toContainText(/Done|انجام شد/);
    await expect(page.locator('#dSave')).toBeDisabled();
  });

  test('late answer from an aborted call does not change result or enable download', async ({ app, files }) => {
    const { page } = app;
    await page.evaluate(() => {
      window.Translator = {
        availability: async () => 'available',
        create: async () => ({
          translate: () => new Promise((resolve) => {
            window.__lateResolve = resolve;
          })
        })
      };
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await expect(page.locator('#dWork')).toBeVisible();

    await mouseClick(page, page.locator('#dGo'));
    const stopBtn = page.locator('#dStop');
    await expect(stopBtn).toBeVisible();

    await mouseClick(page, stopBtn);
    await expect(page.locator('#dProgText')).toContainText(/Stopped|متوقف شد/);
    await expect(page.locator('#dSave')).toBeDisabled();

    // Trigger the late answer
    await page.evaluate(() => {
      if (window.__lateResolve) window.__lateResolve('Late Translated Text');
    });

    await page.waitForTimeout(200);
    await expect(page.locator('#dProgText')).toContainText(/Stopped|متوقف شد/);
    await expect(page.locator('#dProgText')).not.toContainText(/Done|انجام شد/);
    await expect(page.locator('#dSave')).toBeDisabled();
  });
});
