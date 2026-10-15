'use strict';
const { test, expect, mouseClick, chooseFile, onlyEngines } = require('../support/fixtures');

test.describe('Document tab load race condition under rapid clicks', () => {
  test.use({
    appOptions: {
      seed: {
        cfg: onlyEngines(['google', 'mymemory', 'ollama', 'nllb']),
        src: 'en',
        tgt: 'fa'
      }
    }
  });

  test.setTimeout(90000);

  test('rapid click on #dGo immediately after file chooser shows Tried: and never reverts to Ready to translate across 8 iterations', async ({ app, files, stub }) => {
    const { page } = app;
    stub.failHost('clients5.google.com', 500);
    stub.failHost('translate.googleapis.com', 500);

    for (let i = 0; i < 8; i++) {
      if (i === 0 || i % 2 === 0) {
        await page.goto(stub.appUrl);
        await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
        await mouseClick(page, page.locator('#offBtn'));
        await chooseFile(page, page.locator('#dDrop'), files.txt);
      } else {
        await chooseFile(page, page.locator('#dChangeFile'), files.txt);
      }

      await mouseClick(page, page.locator('#dGo'));

      const progText = page.locator('#dProgText');
      await expect(progText).toContainText('Tried:');

      // Poll #dProgText for 2 seconds and require that it contains "Tried:" and never goes back to "Ready to translate"
      const start = Date.now();
      while (Date.now() - start < 2000) {
        const text = await progText.textContent();
        expect(text).toContain('Tried:');
        expect(text).not.toContain('Ready to translate');
        await page.waitForTimeout(100);
      }
    }
  });

  test('variant where a second file is chosen right after the first', async ({ app, files, stub }) => {
    const { page } = app;
    stub.failHost('clients5.google.com', 500);
    stub.failHost('translate.googleapis.com', 500);

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await mouseClick(page, page.locator('#offBtn'));

    // Choose first file, then immediately choose second file
    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await chooseFile(page, page.locator('#dChangeFile'), files.txt);
    await mouseClick(page, page.locator('#dGo'));

    const progText = page.locator('#dProgText');
    await expect(progText).toContainText('Tried:');

    const start = Date.now();
    while (Date.now() - start < 2000) {
      const text = await progText.textContent();
      expect(text).toContain('Tried:');
      expect(text).not.toContain('Ready to translate');
      await page.waitForTimeout(100);
    }
  });

  test('Persian run shows Persian failure line and never reverts to ready text', async ({ app, files, stub }) => {
    const { page } = app;
    stub.failHost('clients5.google.com', 500);
    stub.failHost('translate.googleapis.com', 500);

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await mouseClick(page, page.locator('#offBtn'));
    await mouseClick(page, page.locator('#uiLang'));

    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await mouseClick(page, page.locator('#dGo'));

    const progText = page.locator('#dProgText');
    await expect(progText).toContainText('موتورهای امتحان‌شده:');
    await expect(progText).toContainText('خاموش در موتورها و کلیدها');

    const start = Date.now();
    while (Date.now() - start < 2000) {
      const text = await progText.textContent();
      expect(text).toContain('موتورهای امتحان‌شده:');
      expect(text).not.toContain('آماده ترجمه');
      expect(text).not.toContain('Ready to translate');
      await page.waitForTimeout(100);
    }
  });
});
