'use strict';

/**
 * tests/web/engine-picker-document-text.spec.js
 * ITEM 2: Engine picker in Document and Text tabs.
 */

const { test, expect, mouseClick, chooseFile, onlyEngines } = require('../support/fixtures');

test.describe('Engine Picker in Document and Text (ITEM 2)', () => {

  test('picker exists and is in sync in Text, Document, Subtitle, and Media and survives reload', async ({ app }) => {
    const { page, errors } = app;

    // 1. Check existence in Text tab
    const textHost = page.locator('#textEnginePickerHost .engine-picker');
    await expect(textHost).toBeVisible();
    await expect(textHost.locator('.engine-picker-select')).toBeVisible();
    await expect(textHost.locator('.engine-picker-test-btn')).toBeVisible();

    // 2. Check existence in Document tab
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    const docHost = page.locator('#docEnginePickerHost .engine-picker');
    await expect(docHost).toBeVisible();
    await expect(docHost.locator('.engine-picker-select')).toBeVisible();
    await expect(docHost.locator('.engine-picker-test-btn')).toBeVisible();

    // 3. Check Subtitle tab
    await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
    const subHost = page.locator('#subEnginePickerHost .engine-picker');
    await expect(subHost).toBeVisible();

    // 4. Check Media tab
    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    const mediaHost = page.locator('.mt-engine-picker-host .engine-picker');
    await expect(mediaHost).toBeVisible();

    // Change choice to google in Text tab
    await mouseClick(page, page.locator('#tabs button[data-tab="text"]'));
    await textHost.locator('.engine-picker-select').selectOption('google');

    // Verify it changed in Document tab
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await expect(docHost.locator('.engine-picker-select')).toHaveValue('google');

    // Verify it changed in Subtitle tab
    await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
    await expect(subHost.locator('.engine-picker-select')).toHaveValue('google');

    // Verify it changed in Media tab
    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await expect(mediaHost.locator('.engine-picker-select')).toHaveValue('google');

    // Reload page and check Text tab retains google
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    const textSelectAfterReload = page.locator('#textEnginePickerHost .engine-picker-select');
    await expect(textSelectAfterReload).toHaveValue('google');

    expect(errors).toEqual([]);
  });

  test('Text tab translates with only the chosen engine', async ({ app, stub }) => {
    const { page } = app;

    stub.clearLog();

    // Set picker to google
    await page.locator('#textEnginePickerHost .engine-picker-select').selectOption('google');

    await page.locator('#tIn').fill('Hello world');
    await mouseClick(page, page.locator('#tGo'));

    await expect(page.locator('#tOut')).not.toHaveValue('', { timeout: 15_000 });

    const requests = stub.getLog();
    // Verify google request was made
    const googleReqs = requests.filter(r => r.url.includes('translate.googleapis.com'));
    expect(googleReqs.length).toBeGreaterThan(0);

    // Verify no requests were made to Gemini or MyMemory
    const geminiReqs = requests.filter(r => r.url.includes('generativelanguage.googleapis.com'));
    expect(geminiReqs.length).toBe(0);

    const mymemoryReqs = requests.filter(r => r.url.includes('api.mymemory.translated.net'));
    expect(mymemoryReqs.length).toBe(0);
  });

  test('Document tab translates with chosen engine only and shows notice for non-AI engine', async ({ app, files, stub }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    const docPicker = page.locator('#docEnginePickerHost .engine-picker-select');

    // Pick google (non-AI engine)
    await docPicker.selectOption('google');

    // Notice that notes and subject-aware translation need an AI engine is visible
    const notice = page.locator('#docEngineNotice');
    await expect(notice).toBeVisible();

    stub.clearLog();

    // Translate small .txt file
    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await expect(page.locator('#dWork')).toBeVisible();
    await mouseClick(page, page.locator('#dGo'));

    await expect(page.locator('#dSave')).toBeEnabled({ timeout: 25_000 });
    await expect(page.locator('#dProgText')).toContainText(/Done|تمام شد/i);

    // Verify only google was requested
    const requests = stub.getLog();
    const googleReqs = requests.filter(r => r.url.includes('translate.googleapis.com'));
    expect(googleReqs.length).toBeGreaterThan(0);

    const otherAiReqs = requests.filter(r => r.url.includes('generativelanguage.googleapis.com') || r.url.includes('api.anthropic.com'));
    expect(otherAiReqs.length).toBe(0);

    // Now test with small docx
    stub.clearLog();
    await mouseClick(page, page.locator('#dChangeFile'));
    await chooseFile(page, page.locator('#dDrop'), files.docx);
    await expect(page.locator('#dWork')).toBeVisible();
    await mouseClick(page, page.locator('#dGo'));

    await expect(page.locator('#dSave')).toBeEnabled({ timeout: 25_000 });
    const docxRequests = stub.getLog();
    const docxGoogle = docxRequests.filter(r => r.url.includes('translate.googleapis.com'));
    expect(docxGoogle.length).toBeGreaterThan(0);
  });

  test('shows Persian strings and has no horizontal overflow at 360px and 1280px in RTL', async ({ app }) => {
    const { page } = app;

    // Switch to Persian
    await mouseClick(page, page.locator('#uiLang'));

    // Check Text tab picker labels
    const textHost = page.locator('#textEnginePickerHost .engine-picker');
    await expect(textHost.locator('.engine-picker-label-text')).toHaveText('ترجمه با');
    await expect(textHost.locator('.engine-picker-test-btn')).toHaveText('آزمایش');

    // Check Document tab picker labels
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    const docHost = page.locator('#docEnginePickerHost .engine-picker');
    await expect(docHost.locator('.engine-picker-label-text')).toHaveText('ترجمه با');
    await expect(docHost.locator('.engine-picker-test-btn')).toHaveText('آزمایش');

    // 1. Check viewport 1280px
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(60);
    const overflow1280 = await page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollWidth > el.clientWidth;
    });
    expect(overflow1280).toBe(false);

    // 2. Check viewport 360px
    await page.setViewportSize({ width: 360, height: 740 });
    await page.waitForTimeout(60);
    const overflow360 = await page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollWidth > el.clientWidth;
    });
    expect(overflow360).toBe(false);
  });
});
