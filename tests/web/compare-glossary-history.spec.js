'use strict';
// Compare, Glossary and History tabs.
const { test, expect, onlyEngines, mouseClick, chooseFile, VALID_KEY } = require('../support/fixtures');

async function translateText(page, text) {
  await mouseClick(page, page.locator('#tabs button[data-tab="text"]'));
  await mouseClick(page, page.locator('#tClear'));
  await mouseClick(page, page.locator('#tIn'));
  await page.keyboard.type(text);
  await mouseClick(page, page.locator('#tGo'));
  await expect(page.locator('#tGo')).toBeEnabled();
}

test.describe('Web app: Compare tab', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google', 'mymemory']) } } });

  test('shows one result card per ticked engine', async ({ app }) => {
    const { page, stub, errors } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="cmp"]'));
    const boxes = page.locator('#cEng input[type=checkbox]');
    await expect(boxes).toHaveCount(2);
    await expect(boxes.nth(0)).toBeChecked();
    await expect(boxes.nth(1)).toBeChecked();
    await mouseClick(page, page.locator('#cIn'));
    await page.keyboard.type('Compare this sentence');
    await mouseClick(page, page.locator('#cGo'));
    await expect(page.locator('#c_google p')).toHaveText('[fa] Compare this sentence');
    await expect(page.locator('#c_mymemory p')).toHaveText('[fa] Compare this sentence');
    await expect(page.locator('#c_google h4')).toContainText('Google Translate (web)');
    await expect(page.locator('#c_mymemory h4')).toContainText('MyMemory');
    expect(stub.calls('clients5.google.com')).toHaveLength(1);
    expect(stub.calls('api.mymemory.translated.net')).toHaveLength(1);

    // Unticking an engine leaves only the other one.
    await mouseClick(page, boxes.nth(1));
    await mouseClick(page, page.locator('#cGo'));
    await expect(page.locator('#cOut .res')).toHaveCount(1);
    expect(errors).toEqual([]);
  });
});

test.describe('Web app: Glossary tab', () => {
  test.describe('with Google', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

    test('a term added by typing is applied to translations and kept after a reload', async ({ app }) => {
      const { page, stub, errors } = app;
      await mouseClick(page, page.locator('#tabs button[data-tab="gls"]'));
      await mouseClick(page, page.locator('#gAdd'));
      await page.keyboard.type('MAKAN');      // the new row's first box has focus
      await page.keyboard.press('Tab');
      await page.keyboard.type('ماکان');
      await expect(page.locator('#gList .gl')).toHaveCount(1);

      await translateText(page, 'MAKAN works well');
      // For non-AI engines the term is swapped in before sending.
      const sent = new URLSearchParams(stub.calls('clients5.google.com')[0].body).getAll('q');
      expect(sent).toEqual(['ماکان works well']);
      await expect(page.locator('#tOut')).toHaveValue('[fa] ماکان works well');

      await page.reload();
      await mouseClick(page, page.locator('#tabs button[data-tab="gls"]'));
      await expect(page.locator('#gList .gl input[data-k="s"]')).toHaveValue('MAKAN');
      await expect(page.locator('#gList .gl input[data-k="t"]')).toHaveValue('ماکان');

      // The ✕ button removes it.
      await mouseClick(page, page.locator('#gList .gl button'));
      await expect(page.locator('#gList .gl')).toHaveCount(0);
      await page.reload();
      await mouseClick(page, page.locator('#tabs button[data-tab="gls"]'));
      await expect(page.locator('#gList .gl')).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  });

  test.describe('with Gemini', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['gemini'], { gemini: VALID_KEY }), gls: [{ s: 'MAKAN', t: 'ماکان' }] } } });

    test('AI engines receive the glossary in their instructions', async ({ app }) => {
      const { page, stub } = app;
      await translateText(page, 'MAKAN works well');
      const body = JSON.parse(stub.calls('generativelanguage.googleapis.com').filter(c => c.method === 'POST')[0].body);
      expect(body.systemInstruction.parts[0].text).toContain('Always use this glossary: "MAKAN" → "ماکان"');
    });

    test('"+ Add to Glossary" in the Document tab keeps the terms after a reload', async ({ app, files }) => {
      const { page } = app;
      await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
      await chooseFile(page, page.locator('#dDrop'), files.docx);
      // The AI suggests the document's subject and key terms.
      await expect(page.locator('#docSubjectField')).toHaveValue('Software / Testing');
      await expect(page.locator('#docTermsList .doc-term-s')).toHaveValue('cache');
      await mouseClick(page, page.locator('#docAddToGlossaryBtn'));
      await expect(page.locator('#toasts .toast').last()).toContainText('1 ');
      await mouseClick(page, page.locator('#tabs button[data-tab="gls"]'));
      await expect(page.locator('#gList .gl')).toHaveCount(2);
      expect(await page.locator('#gList input[data-k="s"]').evaluateAll(els => els.map(e => e.value))).toEqual(['MAKAN', 'cache']);
      await page.reload();
      await mouseClick(page, page.locator('#tabs button[data-tab="gls"]'));
      await expect(page.locator('#gList .gl'), 'glossary rows after reload (MAKAN from before + cache from the document)').toHaveCount(2);
    });
  });
});

test.describe('Web app: History tab', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

  test('lists translations newest first and "Clear history" empties it', async ({ app }) => {
    const { page, errors } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="hist"]'));
    await expect(page.locator('#hList')).toContainText('Nothing here yet.');
    await translateText(page, 'First entry');
    await translateText(page, 'Second entry');
    await mouseClick(page, page.locator('#tabs button[data-tab="hist"]'));
    await expect(page.locator('#hList .item')).toHaveCount(2);
    await expect(page.locator('#hList .item').nth(0).locator('.a')).toHaveText('Second entry');
    await expect(page.locator('#hList .item').nth(1).locator('.b')).toHaveText('[fa] First entry');
    await expect(page.locator('#hList .item').nth(0).locator('.meta')).toContainText('auto → fa · Google Translate (web)');
    await page.reload();
    await mouseClick(page, page.locator('#tabs button[data-tab="hist"]'));
    await expect(page.locator('#hList .item')).toHaveCount(2);
    await mouseClick(page, page.locator('#hClear'));
    await expect(page.locator('#hList')).toContainText('Nothing here yet.');
    expect(errors).toEqual([]);
  });
});
