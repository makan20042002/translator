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
    stub.clearLog();
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

    stub.clearLog();
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

  test('no lookups and no saves when translation memory is switched off', async ({ app, stub }) => {
    const { page } = app;
    const file = makeDocFile('Preloaded doc segment\n\nBrand new doc segment');

    // Pre-populate memory
    await page.evaluate(async () => {
      await window.TranslationMemory.put({
        sourceText: 'Preloaded doc segment',
        translatedText: '[fa] Preloaded doc segment',
        src: 'en',
        tgt: 'fa',
        modeClass: 'fast',
        tone: '',
        subject: ''
      });
    });

    // Switch translation memory off in settings
    await mouseClick(page, page.locator('#openSet'));
    await page.locator('#tmToggle').uncheck();
    await mouseClick(page, page.locator('#btnSaveDone'));

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await chooseFile(page, page.locator('#dDrop'), file);

    stub.clearLog();
    await mouseClick(page, page.locator('#dGo'));
    await expect(page.locator('#dSave')).toBeEnabled();

    // Both segments must be sent to the engine (no lookup used)
    const calls = stub.calls('clients5.google.com');
    expect(calls.length).toBe(1);
    const sent = new URLSearchParams(calls[0].body).getAll('q');
    expect(sent).toEqual(['Preloaded doc segment', 'Brand new doc segment']);

    // Memory count must remain 1 (Brand new doc segment was not saved)
    const count = await page.evaluate(async () => await window.TranslationMemory.count());
    expect(count).toBe(1);
    const newEntry = await page.evaluate(async () => {
      return await window.TranslationMemory.get({
        text: 'Brand new doc segment',
        src: 'en',
        tgt: 'fa',
        modeClass: 'fast',
        tone: '',
        subject: ''
      });
    });
    expect(newEntry).toBeNull();
  });

  test('JSON document reuses repeated segments with fewer engine calls and identical output', async ({ app, stub }) => {
    const { page } = app;
    const jsonDoc = {
      greeting: 'Hello friend',
      repeat1: 'Good morning',
      repeat2: 'Good morning',
      closing: 'See you soon'
    };
    const file = makeDocFile(JSON.stringify(jsonDoc, null, 2), 'json');

    // Pre-populate memory with the repeated segment 'Good morning'
    await page.evaluate(async () => {
      await window.TranslationMemory.put({
        sourceText: 'Good morning',
        translatedText: '[fa] Good morning',
        src: 'en',
        tgt: 'fa',
        modeClass: 'fast',
        tone: '',
        subject: ''
      });
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await chooseFile(page, page.locator('#dDrop'), file);
    await expect(page.locator('#dWork')).toBeVisible();

    stub.clearLog();
    await mouseClick(page, page.locator('#dGo'));
    await expect(page.locator('#dSave')).toBeEnabled({ timeout: 20_000 });

    // 'Good morning' appears twice in the document but hit memory both times;
    // only the 2 missing segments were sent to Google
    const firstCalls = stub.calls('clients5.google.com');
    expect(firstCalls.length).toBe(1);
    const firstSent = new URLSearchParams(firstCalls[0].body).getAll('q');
    expect(firstSent).toEqual(['Hello friend', 'See you soon']);

    const firstDl = await downloadOf(page, () => mouseClick(page, page.locator('#dSave')));
    const firstResult = JSON.parse(firstDl.bytes.toString('utf8').replace(/^﻿/, ''));
    expect(firstResult.greeting).toBe('[fa] Hello friend');
    expect(firstResult.repeat1).toBe('[fa] Good morning');
    expect(firstResult.repeat2).toBe('[fa] Good morning');
    expect(firstResult.closing).toBe('[fa] See you soon');

    // Re-run: now all segments are in memory, so zero engine calls
    stub.clearLog();
    await mouseClick(page, page.locator('#dGo'));
    await expect(page.locator('#dSave')).toBeEnabled();

    const secondCalls = stub.calls('clients5.google.com');
    expect(secondCalls.length).toBe(0);
    await expect(page.locator('#dEngineUsed')).toContainText('from memory');

    const secondDl = await downloadOf(page, () => mouseClick(page, page.locator('#dSave')));
    const secondResult = JSON.parse(secondDl.bytes.toString('utf8').replace(/^﻿/, ''));
    expect(secondResult).toEqual(firstResult);
  });
});
