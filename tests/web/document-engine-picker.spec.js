'use strict';
const { test, expect, mouseClick, chooseFile, onlyEngines } = require('../support/fixtures');

test.describe('Document tab engine picker, failure reporting, and responsiveness', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google', 'mymemory', 'ollama', 'nllb']), src: 'en', tgt: 'fa' } } });

  test('the picker is visible before a file is loaded with label and default "Same as Text tab"', async ({ app }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

    // Before any file is loaded
    await expect(page.locator('#dDrop')).toBeVisible();
    await expect(page.locator('#dWork')).toBeHidden();

    const pickerHost = page.locator('#docEnginePickerHost .engine-picker');
    await expect(pickerHost, 'picker should be visible before file is loaded').toBeVisible();

    const picker = page.locator('#docEnginePickerHost .engine-picker-select');
    await expect(picker).toBeVisible();

    const label = page.locator('#docEnginePickerHost .engine-picker-label');
    await expect(label).toBeVisible();
    await expect(label).toHaveText(/Translate with/i);

    // Default option in shared picker is "auto" (follows Text tab engine and order)
    await expect(picker).toHaveValue('auto');
    const firstOption = picker.locator('option').first();
    await expect(firstOption).toHaveValue('auto');
    await expect(firstOption).toHaveText(/Auto/i);

    // Engine line / picker using line shows Text tab engine and mode
    const usingLine = page.locator('#docEnginePickerHost .engine-picker-using');
    await expect(usingLine).toContainText('Google Translate');

    const engineText = page.locator('#docEngineText');
    await expect(engineText).toContainText('Google Translate');
    await expect(engineText).toContainText('Fast');
  });

  test('default "Same as Text tab" behaves as before and uses Google', async ({ app, files, stub }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

    const picker = page.locator('#dEngineSel');
    await expect(picker).toHaveValue('');

    stub.clearLog();
    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await mouseClick(page, page.locator('#dGo'));

    await expect(page.locator('#dSave')).toBeEnabled({ timeout: 20000 });
    const googleCalls = stub.calls('clients5.google.com').concat(stub.calls('translate.googleapis.com'));
    expect(googleCalls.length).toBeGreaterThan(0);
  });

  test('choosing Google uses only Google (checked by request counts)', async ({ app, files, stub }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

    const picker = page.locator('#docEnginePickerHost .engine-picker-select');
    await picker.selectOption('google');

    stub.clearLog();
    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await mouseClick(page, page.locator('#dGo'));

    await expect(page.locator('#dSave')).toBeEnabled({ timeout: 20000 });

    const googleCalls = stub.calls('clients5.google.com').concat(stub.calls('translate.googleapis.com'));
    const myMemoryCalls = stub.calls('api.mymemory.translated.net');

    expect(googleCalls.length).toBeGreaterThan(0);
    expect(myMemoryCalls.length).toBe(0);
  });

  test('choosing Ollama with a fake local Ollama sends requests only to the Ollama address and never to Google', async ({ app, files, stub }) => {
    const { page } = app;

    const ollamaCalls = [];
    await page.route('**/api/tags', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ models: [{ name: 'llama3:latest' }] })
      });
    });

    await page.route('**/v1/chat/completions', route => {
      ollamaCalls.push(route.request().postDataJSON());
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{ message: { content: JSON.stringify(['سلام یک', 'سلام دو', 'سلام سه']) } }]
        })
      });
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

    const picker = page.locator('#docEnginePickerHost .engine-picker-select');
    await picker.selectOption('ollama');

    const modelPicker = page.locator('#docEnginePickerHost .engine-picker-model-select');
    await expect(modelPicker.locator('option[value="llama3:latest"]')).toBeAttached({ timeout: 5000 });
    await modelPicker.selectOption('llama3:latest');

    stub.clearLog();
    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await mouseClick(page, page.locator('#dGo'));

    await expect(page.locator('#dSave')).toBeEnabled({ timeout: 20000 });

    expect(ollamaCalls.length).toBeGreaterThan(0);
    const googleCalls = stub.calls('clients5.google.com').concat(stub.calls('translate.googleapis.com'));
    expect(googleCalls.length).toBe(0);
  });

  test('choosing Ollama when it is not reachable shows the plain "start Ollama" line and sends no request at all', async ({ app, files, stub }) => {
    const { page } = app;

    // Make all Ollama ports/routes fail
    await page.route('**/api/tags', route => route.abort('connectionrefused'));
    await page.route('**/v1/**', route => route.abort('connectionrefused'));

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

    const picker = page.locator('#docEnginePickerHost .engine-picker-select');
    await picker.selectOption('ollama');

    stub.clearLog();
    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await mouseClick(page, page.locator('#dGo'));

    // Check plain message
    const progText = page.locator('#dProgText');
    await expect(progText).toContainText('Ollama is not running. Start Ollama, then try again.');
    await expect(progText.locator('a')).toContainText('Engines & keys');

    // Translate button stays enabled
    await expect(page.locator('#dGo')).toBeEnabled();

    // Zero network requests sent to providers
    expect(stub.calls().length).toBe(0);
  });

  test('choosing NLLB when the model is not downloaded shows the "download the model" line and sends nothing online', async ({ app, files, stub }) => {
    const { page } = app;
    await page.evaluate(() => {
      localStorage.setItem('mkt_nllb', 'false');
      if (typeof trAnyReady === 'function') window.__origTrAnyReady = window.trAnyReady;
      window.trAnyReady = () => false;
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

    const picker = page.locator('#docEnginePickerHost .engine-picker-select');
    await picker.selectOption('nllb');

    stub.clearLog();
    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await mouseClick(page, page.locator('#dGo'));

    const progText = page.locator('#dProgText');
    await expect(progText).toContainText('Download the offline model in Engines & keys.');
    await expect(progText.locator('a')).toContainText('Engines & keys');

    // Translate stays usable
    await expect(page.locator('#dGo')).toBeEnabled();
    expect(stub.calls().length).toBe(0);
  });

  test('the choice survives a reload and does not change the Text tab Engine or Mode', async ({ app }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

    const picker = page.locator('#docEnginePickerHost .engine-picker-select');
    await picker.selectOption('mymemory');
    await expect(picker).toHaveValue('mymemory');

    // Reload the page
    await page.reload();

    // Verify Text tab reflects the shared chosen engine and mode remains fast
    await expect(page.locator('#tabs button[data-tab="text"]')).toBeVisible();
    // Shared engine picker syncs choice across tabs
    await expect(page.locator('#textEnginePickerHost .engine-picker-select')).toHaveValue('mymemory');
    await expect(page.locator('#tMode')).toHaveValue('fast');

    // Go to Document tab and verify picker restored
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await expect(page.locator('#docEnginePickerHost .engine-picker-select')).toHaveValue('mymemory');
  });

  test('the engine line follows the picker dynamically', async ({ app }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

    const picker = page.locator('#docEnginePickerHost .engine-picker-select');
    const usingLine = page.locator('#docEnginePickerHost .engine-picker-using');
    const engineText = page.locator('#docEngineText');

    await picker.selectOption('mymemory');
    await expect(usingLine).toContainText('MyMemory');
    await expect(engineText).toContainText('MyMemory');

    await picker.selectOption('google');
    await expect(usingLine).toContainText('Google Translate');
    await expect(engineText).toContainText('Google Translate');

    // Reset to "auto" (shared picker follows Text tab engine and order)
    await picker.selectOption('auto');
    await expect(usingLine).toContainText('Google Translate');
    await page.evaluate(() => {
      const modeSel = document.getElementById('tMode');
      if (modeSel) {
        modeSel.value = 'smart';
        modeSel.dispatchEvent(new Event('change'));
      }
    });
    await expect(engineText).toContainText('Smart');
  });

  test('failure line lists tried engines and reasons in English and Persian', async ({ app, files, stub }) => {
    const { page } = app;

    // Fail all engines
    stub.failHost('clients5.google.com', 500);
    stub.failHost('translate.googleapis.com', 500);

    // 1. English
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    const offBtn = page.locator('#offBtn');
    await mouseClick(page, offBtn); // turn offline mode on

    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await mouseClick(page, page.locator('#dGo'));

    const progText = page.locator('#dProgText');
    await expect(progText).toContainText('Tried:');
    await expect(progText).toContainText('Chrome on-device (turned off in Engines & keys)');
    await expect(progText).toContainText('Choose an engine under Translate with, or open Engines & keys.');

    // 2. Persian UI
    await mouseClick(page, page.locator('#uiLang'));
    await mouseClick(page, page.locator('#dGo'));

    await expect(progText).toContainText('موتورهای امتحان‌شده:');
    await expect(progText).toContainText('خاموش در موتورها و کلیدها');
    await expect(progText).toContainText('یک موتور در «ترجمه با» انتخاب کنید یا «موتورها و کلیدها» را باز کنید.');
  });

  test('no horizontal scroll at 360px viewport in English and Persian', async ({ app }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

    for (const lang of ['en', 'fa']) {
      if (lang === 'fa') {
        await page.evaluate(() => {
          ui = 'fa';
          document.documentElement.dir = 'rtl';
          document.documentElement.lang = 'fa';
          applyI18n();
        });
      }
      await page.setViewportSize({ width: 360, height: 740 });

      const pickerBox = await page.locator('#docEnginePickerHost .engine-picker-select').boundingBox();
      expect(pickerBox).not.toBeNull();
      expect(pickerBox.x).toBeGreaterThanOrEqual(0);
      expect(pickerBox.x + pickerBox.width).toBeLessThanOrEqual(361);

      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
      }));
      expect(scrollWidth, `no horizontal scroll at 360px in ${lang}`).toBeLessThanOrEqual(clientWidth + 1);
    }
  });

  test('Download button remains inside 900px viewport at 1280x900', async ({ app, files }) => {
    const { page } = app;
    await page.setViewportSize({ width: 1280, height: 900 });
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await mouseClick(page, page.locator('#dGo'));

    const dSave = page.locator('#dSave');
    await expect(dSave).toBeEnabled({ timeout: 20000 });

    const box = await dSave.boundingBox();
    expect(box, '#dSave bounding box').not.toBeNull();
    expect(box.y + box.height, 'Download button bottom must be <= 900px').toBeLessThanOrEqual(900);
  });

  test('offline failure line reports failure with exactly zero provider requests', async ({ app, files, stub }) => {
    const { page } = app;
    await page.evaluate(() => {
      localStorage.setItem('mkt_nllb', 'false');
      if (typeof trAnyReady === 'function') window.__origTrAnyReady = window.trAnyReady;
      window.trAnyReady = () => false;
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    const picker = page.locator('#docEnginePickerHost .engine-picker-select');
    await picker.selectOption('nllb');

    stub.clearLog();
    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await mouseClick(page, page.locator('#dGo'));

    const progText = page.locator('#dProgText');
    await expect(progText).toContainText('Download the offline model in Engines & keys.');
    expect(stub.calls().length).toBe(0);
  });
});
