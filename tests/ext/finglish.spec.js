'use strict';
// Extension: Finglish (Persian written in Latin letters) in the selection card and in the toolbar popup.
// The AI is the stub server's. The card and the popup call the same background step as the web app's logic in engine.js.
const { test, expect, inShadow, dragSelect, pressM, openRealPopup, expectNoExtensionErrors } = require('../support/ext-fixtures');
const { VALID_KEY } = require('../support/stub-server');

const GEMINI = 'generativelanguage.googleapis.com';
const FINGLISH = 'salam khoobi mikham harf bezanam';
const ai = stub => stub.calls(GEMINI).filter(c => /:generateContent/.test(c.path));
const conversions = stub => ai(stub).filter(c => /FINGLISH_TO_PERSIAN/.test(c.body));
const setText = (page, text) => page.evaluate(t => { document.querySelector('#p1').textContent = t; }, text);

test.describe('Extension: Finglish with an AI engine', () => {
  test.use({ extOptions: { config: { transMode: 'smart', tgt: 'en', eng: { gemini: { on: true, key: VALID_KEY }, google: { on: true } } } } });

  test('card: the Persian spelling is shown above the translation, with Copy, after one conversion request', async ({ ext, stub }) => {
    const page = ext.article;
    await ext.context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(page.url()).origin });
    await setText(page, FINGLISH);
    await dragSelect(page, '#p1');
    await pressM(page);
    await expect(inShadow(page, '.makan-result-text')).toHaveText(`[en] فارسی(${FINGLISH})`, { timeout: 20_000 });
    await expect(inShadow(page, '#makanFg')).toBeVisible();
    await expect(inShadow(page, '#makanFg .makan-fg-text')).toHaveText(`فارسی(${FINGLISH})`);
    await expect(inShadow(page, '#makanFg .makan-fg-lab')).toHaveText('Persian spelling');
    expect(conversions(stub)).toHaveLength(1);
    expect(stub.calls('clients5.google.com')).toHaveLength(0);
    await inShadow(page, '#makanFg button').click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`فارسی(${FINGLISH})`);
    await expectNoExtensionErrors(ext);
  });

  test('card: ordinary English is translated as before, with no conversion and no Persian spelling', async ({ ext, stub }) => {
    const page = ext.article;
    await setText(page, 'Please send me the report by Monday, thanks.');
    await dragSelect(page, '#p1');
    await pressM(page);
    await expect(inShadow(page, '.makan-result-text')).toHaveText('[en] Please send me the report by Monday, thanks.', { timeout: 20_000 });
    await expect(inShadow(page, '#makanFg')).toBeHidden();
    expect(conversions(stub)).toHaveLength(0);
  });

  test('card: the source list has a Finglish choice', async ({ ext }) => {
    const page = ext.article;
    await dragSelect(page, '#p1');
    await pressM(page);
    await expect(inShadow(page, '#makanSrcSel option[value="finglish"]')).toHaveText('Finglish · Persian in Latin letters');
  });

  test('popup: typed Finglish shows the Persian spelling, then the translation', async ({ ext, stub }) => {
    const popup = await openRealPopup(ext);
    await popup.waitFor(`document.getElementById('pTgtLang').value === 'en'`);
    await popup.click('#pInputText');
    await popup.type(FINGLISH);
    stub.clearLog();
    await popup.click('#pTransBtn');
    await popup.waitFor(`document.getElementById('pOutputText').textContent === '[en] فارسی(${FINGLISH})'`);
    expect(await popup.eval(`document.getElementById('pFg').hidden`)).toBe(false);
    expect(await popup.eval(`document.querySelector('#pFg .p-fg-text').textContent`)).toBe(`فارسی(${FINGLISH})`);
    expect(await popup.eval(`document.querySelector('#pFg .p-fg-lab').textContent`)).toBe('Persian spelling');
    expect(conversions(stub)).toHaveLength(1);
    expect(popup.consoleErrors).toEqual([]);
    await popup.close();
  });

  test('popup: ordinary German is translated as before', async ({ ext, stub }) => {
    const popup = await openRealPopup(ext);
    await popup.waitFor(`document.getElementById('pTgtLang').value === 'en'`);
    await popup.click('#pInputText');
    await popup.type('Ich möchte heute mit dir sprechen, aber ich habe keine Zeit.');
    stub.clearLog();
    await popup.click('#pTransBtn');
    await popup.waitFor(`document.getElementById('pOutputText').textContent.startsWith('[en] Ich m')`);
    expect(await popup.eval(`document.getElementById('pFg').hidden`)).toBe(true);
    expect(conversions(stub)).toHaveLength(0);
    await popup.close();
  });
});

test.describe('Extension: Finglish with Persian as the target', () => {
  test.use({ extOptions: { config: { transMode: 'smart', tgt: 'fa', eng: { gemini: { on: true, key: VALID_KEY }, google: { on: true } } } } });

  test('card: the conversion is the result and nothing is translated', async ({ ext, stub }) => {
    const page = ext.article;
    await setText(page, FINGLISH);
    await dragSelect(page, '#p1');
    await pressM(page);
    await expect(inShadow(page, '.makan-result-text')).toHaveText(`فارسی(${FINGLISH})`, { timeout: 20_000 });
    await expect(inShadow(page, '#makanEnginePill')).toContainText('Finglish → Persian');
    expect(conversions(stub)).toHaveLength(1);
    expect(ai(stub).filter(c => !/FINGLISH_TO_PERSIAN|IDIOM_/.test(c.body))).toHaveLength(0);
  });
});

test.describe('Extension: Finglish without an AI engine', () => {
  test.use({ extOptions: { config: { transMode: 'fast', tgt: 'en', eng: { google: { on: true } } } } });

  test('card: one line says Finglish needs an AI engine; nothing is sent to Google as English', async ({ ext, stub }) => {
    const page = ext.article;
    await setText(page, FINGLISH);
    await dragSelect(page, '#p1');
    await pressM(page);
    await expect(inShadow(page, '.makan-err')).toHaveText('Finglish (Persian written in Latin letters) needs an AI engine. Add a free Gemini or Groq key in Options.');
    expect(stub.calls('clients5.google.com')).toHaveLength(0);
    expect(ai(stub)).toHaveLength(0);
  });

  test('popup: the same line, in the popup', async ({ ext, stub }) => {
    const popup = await openRealPopup(ext);
    await popup.waitFor(`document.getElementById('pTgtLang').value === 'en'`);
    await popup.click('#pInputText');
    await popup.type(FINGLISH);
    stub.clearLog();
    await popup.click('#pTransBtn');
    await popup.waitFor(`document.getElementById('pOutputText').textContent.startsWith('Finglish (Persian written in Latin letters) needs an AI engine')`);
    expect(stub.calls('clients5.google.com')).toHaveLength(0);
    await popup.close();
  });
});
