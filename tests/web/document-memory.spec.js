'use strict';
// Document tab: Translation Memory integration (Item 2).
const fs = require('fs');
const path = require('path');
const os = require('os');
const { test, expect, onlyEngines, mouseClick, chooseFile, downloadOf } = require('../support/fixtures');

function makeDocFile(content, ext = 'txt') {
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'makan-doc-tm-')), `test-doc.${ext}`);
  fs.writeFileSync(tmp, content, 'utf8');
  return tmp;
}

test.describe('Web app: Document tab translation memory (Item 2)', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), src: 'en', tgt: 'fa' } } });

  test.beforeEach(async ({ app }) => {
    const { page } = app;
    await page.evaluate(async () => {
      if (window.TranslationMemory) {
        await window.TranslationMemory.clear();
      }
    });
  });

  test('a document with repeated segments makes fewer engine calls', async ({ app, stub }) => {
    const { page } = app;
    const file = makeDocFile('Hello world\n\nRepeated sentence\n\nRepeated sentence\n\nGoodbye all');

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await chooseFile(page, page.locator('#dDrop'), file);
    await expect(page.locator('#dWork')).toBeVisible();

    await mouseClick(page, page.locator('#dGo'));
    await expect(page.locator('#dSave')).toBeEnabled({ timeout: 20_000 });

    // Second run with the same document
    stub.clearCalls();
    await mouseClick(page, page.locator('#dGo'));
    await expect(page.locator('#dSave')).toBeEnabled();

    // All segments hit memory: zero engine calls on second run
    const calls = stub.calls('clients5.google.com');
    expect(calls.length).toBe(0);
    await expect(page.locator('#dEngineUsed')).toContainText('from memory');
  });

  test('a re-run after a simulated failure translates only the missing segments', async ({ app, stub }) => {
    const { page } = app;
    const file = makeDocFile('Paragraph A\n\nParagraph B');

    // Pre-seed Paragraph A in memory
    await page.evaluate(async () => {
      await window.TranslationMemory.put({
        sourceText: 'Paragraph A',
        translatedText: '[fa] Paragraph A',
        src: 'en',
        tgt: 'fa',
        modeClass: 'fast',
        tone: '',
        subject: ''
      });
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await chooseFile(page, page.locator('#dDrop'), file);

    stub.clearCalls();
    await mouseClick(page, page.locator('#dGo'));
    await expect(page.locator('#dSave')).toBeEnabled();

    // Only Paragraph B was sent to the engine
    const calls = stub.calls('clients5.google.com');
    expect(calls.length).toBe(1);
    const sent = new URLSearchParams(calls[0].body).getAll('q');
    expect(sent).toEqual(['Paragraph B']);

    const output = await page.locator('#dOut').inputValue();
    expect(output).toContain('[fa] Paragraph A');
    expect(output).toContain('[fa] Paragraph B');
  });

  test('failed results are not saved', async ({ app, stub }) => {
    const { page } = app;
    const file = makeDocFile('Important content to translate');

    // Force network failure
    await page.route('**/translate_a/**', route => route.abort('failed'));
    await page.route('**/translate.googleapis.com/**', route => route.abort('failed'));

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await chooseFile(page, page.locator('#dDrop'), file);

    await mouseClick(page, page.locator('#dGo'));
    await expect(page.locator('.toast.err')).toBeVisible({ timeout: 15_000 });

    const count = await page.evaluate(async () => await window.TranslationMemory.count());
    expect(count).toBe(0);
  });

  test('output is identical for the same engine results', async ({ app }) => {
    const { page } = app;
    const content = '# Main Title\n\nFirst paragraph here.\n\nSecond paragraph here.';
    const file = makeDocFile(content, 'md');

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await chooseFile(page, page.locator('#dDrop'), file);

    await mouseClick(page, page.locator('#dGo'));
    await expect(page.locator('#dSave')).toBeEnabled();
    const firstOutput = await page.locator('#dOut').inputValue();

    // Re-run with memory populated
    await mouseClick(page, page.locator('#dGo'));
    await expect(page.locator('#dSave')).toBeEnabled();
    const secondOutput = await page.locator('#dOut').inputValue();

    expect(secondOutput).toBe(firstOutput);
    expect(secondOutput).toContain('[fa] First paragraph here.');
    expect(secondOutput).toContain('[fa] Second paragraph here.');
  });
});
