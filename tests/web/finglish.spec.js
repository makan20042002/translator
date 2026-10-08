'use strict';
// Finglish (Persian written in Latin letters): detecting it, the one-request conversion to Persian script, the Persian
// spelling shown above the translation, the plain message when no AI engine is available, and ordinary English, Turkish,
// German and French that must never be mistaken for it. The AI is the stub server's.
const { test, expect, onlyEngines, mouseClick, VALID_KEY } = require('../support/fixtures');

const GEMINI = 'generativelanguage.googleapis.com';
const FINGLISH = 'salam khoobi mikham harf bezanam';
const aiCalls = stub => stub.calls(GEMINI).filter(c => /:generateContent/.test(c.path));
const conversions = stub => aiCalls(stub).filter(c => /FINGLISH_TO_PERSIAN/.test(c.body));
const translations = stub => aiCalls(stub).filter(c => !/FINGLISH_TO_PERSIAN|IDIOM_|dictionary lexicographer|voice assistant/.test(c.body));
async function typeText(page, text) { await mouseClick(page, page.locator('#tIn')); await page.keyboard.press('Control+A'); await page.keyboard.type(text); }
const installPacks = page => page.evaluate(async () => { await dictReady; for (const p of DICT_PAIRS) await MakanDict.install(p, { getBytes: dictBytes(p) }); return true; });

const FINGLISH_SENTENCES = [
  'salam khoobi mikham harf bezanam', 'salam', 'Salam, chetori? Khoobam, mersi!', 'emrooz kheili khaste hastam', 'man nemidoonam chi bayad bokonam',
  'dooset daram azizam', 'farda miam khoone shoma', 'chera nemigi ke koja miri?', 'khodahafez, fardaa mibinamet'
];
const NOT_FINGLISH = {
  English: ['Hello, how are you today? I want to talk to you.', 'I am going to the market tomorrow and I will buy some bread.', 'The mission is a mirror of the midnight mice.', 'Please send me the report by Monday, thanks.', 'What is your age?'],
  Turkish: ['Merhaba, nasilsin? Seninle konusmak istiyorum.', 'Bugün hava çok güzel, parka gidiyoruz.', 'Yarin sabah erkenden yola cikacagiz ve aksam eve donecegiz.'],
  German: ['Ich möchte heute mit dir sprechen, aber ich habe keine Zeit.', 'Wir gehen morgen ins Kino und danach essen wir etwas.', 'Man kann nicht alles haben, aber man kann viel erreichen.'],
  French: ["Je voudrais te parler aujourd'hui, mais je n'ai pas le temps.", 'Bonjour, merci beaucoup pour votre aide.', "Ma chérie, je t'aime."]
};

test.describe('Web app: Finglish detection', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

  test('Finglish sentences are recognised with "Detect language" and with Persian as the source', async ({ app }) => {
    const { page } = app;
    for (const src of ['auto', 'fa']) {
      const r = await page.evaluate(({ list, src }) => list.map(t => [t, detectFinglish(t, src).finglish]), { list: FINGLISH_SENTENCES, src });
      expect(r.filter(x => !x[1]), `missed with source ${src}`).toEqual([]);
    }
  });

  test('English, Turkish, German and French are never taken for Finglish, with either source setting', async ({ app }) => {
    const { page } = app;
    for (const [lang, list] of Object.entries(NOT_FINGLISH)) {
      for (const src of ['auto', 'fa']) {
        const r = await page.evaluate(({ list, src }) => list.map(t => [t, detectFinglish(t, src).finglish]), { list, src });
        expect(r.filter(x => x[1]), `${lang} text taken for Finglish with source ${src}`).toEqual([]);
      }
    }
  });

  test('Persian script is never Finglish; a language other than Detect/Persian is never converted; the Finglish choice always is', async ({ app }) => {
    const { page } = app;
    const q = await page.evaluate(() => ({
      script: detectFinglish('سلام خوبی', 'auto').finglish,
      german: detectFinglish('salam khoobi mikham harf bezanam', 'de').finglish,
      forced: detectFinglish('bia berim', 'finglish').finglish,
      forcedScript: detectFinglish('سلام', 'finglish').finglish,
      empty: detectFinglish('   ', 'auto').finglish
    }));
    expect(q).toEqual({ script: false, german: false, forced: true, forcedScript: false, empty: false });
  });

  test('the source list has a Finglish choice, in English and in Persian', async ({ app }) => {
    const { page } = app;
    await expect(page.locator('#src option[value="finglish"]')).toHaveText('Finglish · Persian in Latin letters');
    await mouseClick(page, page.locator('#uiLang'));
    await expect(page.locator('#src option[value="finglish"]')).toHaveText('فینگلیش · فارسی با حروف لاتین');
  });
});

test.describe('Web app: Finglish with an AI engine', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['gemini'], { gemini: VALID_KEY }), tgt: 'en', tMode: 'smart' } } });

  test('Text tab: one request converts it, the Persian spelling is shown with Copy, and the translation starts from it', async ({ app }) => {
    const { page, stub, errors } = app;
    await page.locator('#tMode').selectOption('smart');
    await typeText(page, FINGLISH);
    stub.clearLog();
    await page.keyboard.press('Control+Enter');
    await expect(page.locator('#tOut')).toHaveValue(`[en] فارسی(${FINGLISH})`);
    await expect(page.locator('#tFinglish')).toBeVisible();
    await expect(page.locator('#tFinglish .fg-t')).toHaveText(`فارسی(${FINGLISH})`);
    await expect(page.locator('#tFinglish .lbl')).toHaveText('Persian spelling');
    expect(conversions(stub)).toHaveLength(1);
    // the translation request carries the Persian text, never the Latin letters
    const tr = translations(stub);
    expect(tr.length).toBeGreaterThan(0);
    for (const c of tr) { expect(c.body).toContain(`فارسی(${FINGLISH})`.replace(/"/g, '\\"')); }
    expect(stub.calls('clients5.google.com')).toHaveLength(0);
    // Copy puts the Persian spelling on the clipboard
    await mouseClick(page, page.locator('#tFinglish button'));
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`فارسی(${FINGLISH})`);
    expect(errors).toEqual([]);
  });

  test('target Persian: the conversion is the result, and nothing is translated', async ({ app }) => {
    const { page, stub } = app;
    await page.locator('#tgt').selectOption('fa');
    await page.locator('#tMode').selectOption('smart');
    await typeText(page, FINGLISH);
    stub.clearLog();
    await page.keyboard.press('Control+Enter');
    await expect(page.locator('#tOut')).toHaveValue(`فارسی(${FINGLISH})`);
    await expect(page.locator('#tFinglish')).toBeVisible();
    await expect(page.locator('#tMeta')).toContainText('Finglish → Persian');
    expect(conversions(stub)).toHaveLength(1);
    expect(translations(stub)).toHaveLength(0);
  });

  test('"Finglish" chosen as the source converts text that detection would miss', async ({ app }) => {
    const { page, stub } = app;
    await page.locator('#tMode').selectOption('smart');
    await page.locator('#src').selectOption('finglish');
    await typeText(page, 'bia berim biroon');
    stub.clearLog();
    await page.keyboard.press('Control+Enter');
    await expect(page.locator('#tFinglish .fg-t')).toHaveText('فارسی(bia berim biroon)');
    await expect(page.locator('#tOut')).toHaveValue('[en] فارسی(bia berim biroon)');
    expect(conversions(stub)).toHaveLength(1);
    // the same text with "Detect language" is not recognised, so it is translated as it is typed
    await page.locator('#src').selectOption('auto');
    stub.clearLog();
    await page.keyboard.press('Control+Enter');
    await expect(page.locator('#tOut')).toHaveValue('[en] bia berim biroon');
    expect(conversions(stub)).toHaveLength(0);
  });

  test('with Persian as the source, Latin letters that look like Persian are converted', async ({ app }) => {
    const { page, stub } = app;
    await page.locator('#tMode').selectOption('smart');
    await page.locator('#src').selectOption('fa');
    await typeText(page, 'kheili khoobe');
    stub.clearLog();
    await page.keyboard.press('Control+Enter');
    await expect(page.locator('#tFinglish .fg-t')).toHaveText('فارسی(kheili khoobe)');
    expect(conversions(stub)).toHaveLength(1);
  });

  for (const [lang, list] of Object.entries(NOT_FINGLISH)) {
    test(`ordinary ${lang} is translated as before: no conversion, no Persian spelling`, async ({ app }) => {
      const { page, stub } = app;
      await page.locator('#tMode').selectOption('smart');
      for (const sentence of list.slice(0, 2)) {
        await typeText(page, sentence);
        stub.clearLog();
        await page.keyboard.press('Control+Enter');
        await expect(page.locator('#tOut')).toHaveValue(`[en] ${sentence}`);
        await expect(page.locator('#tFinglish')).toBeHidden();
        expect(conversions(stub), sentence).toHaveLength(0);
      }
    });
  }

  test('Voice tab, typed question: Finglish is converted first and the assistant gets the Persian text', async ({ app }) => {
    const { page, stub } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));
    await page.evaluate(() => { document.getElementById('vViewAsk') && (document.getElementById('vViewAsk').hidden = false); });
    stub.clearLog();
    await page.evaluate(text => doAsk(text), 'salam khoobi mikham harf bezanam');
    await expect(page.locator('#askBubbles')).toContainText('فارسی(salam khoobi mikham harf bezanam)');
    expect(conversions(stub)).toHaveLength(1);
    const assistant = aiCalls(stub).filter(c => /voice assistant/.test(c.body));
    expect(assistant).toHaveLength(1);
    expect(assistant[0].body).toContain('فارسی(salam khoobi mikham harf bezanam)');
  });

  test('Dictionary: a Finglish word is converted and its Persian spelling shown above the entry', async ({ app }) => {
    const { page, stub } = app;
    await installPacks(page);
    await mouseClick(page, page.locator('#tabs button[data-tab="dict"]'));
    await mouseClick(page, page.locator('#dcSearch'));
    stub.clearLog();
    await page.keyboard.type('salam');
    await page.keyboard.press('Enter');
    await expect(page.locator('#dcResult .fg-t')).toHaveText('سلام');
    expect(conversions(stub)).toHaveLength(1);
    await expect(page.locator('#dcResult')).toContainText('سلام');
  });

  test('Dictionary: an ordinary English word is not converted', async ({ app }) => {
    const { page, stub } = app;
    await installPacks(page);
    await mouseClick(page, page.locator('#tabs button[data-tab="dict"]'));
    await mouseClick(page, page.locator('#dcSearch'));
    stub.clearLog();
    await page.keyboard.type('age');
    await page.keyboard.press('Enter');
    await expect(page.locator('#dcResult')).not.toBeEmpty();
    expect(conversions(stub)).toHaveLength(0);
    await expect(page.locator('#dcResult .fg-box')).toHaveCount(0);
  });

  test('Idioms: a Finglish search is converted and its Persian spelling shown', async ({ app }) => {
    const { page, stub } = app;
    await installPacks(page);
    await mouseClick(page, page.locator('#tabs button[data-tab="idiom"]'));
    await mouseClick(page, page.locator('#idSearch'));
    stub.clearLog();
    await page.keyboard.type('khoobi mikham');
    await page.keyboard.press('Enter');
    await expect(page.locator('#idResult .fg-t')).toHaveText('فارسی(khoobi mikham)');
    expect(conversions(stub)).toHaveLength(1);
    expect(aiCalls(stub).some(c => /IDIOM_EXPLAIN/.test(c.body) && c.body.includes('فارسی(khoobi mikham)'))).toBe(true);
  });
});

test.describe('Web app: Finglish without an AI engine', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), tgt: 'en' } } });

  test('one plain line says Finglish needs an AI engine; the text is not sent to Google as English', async ({ app }) => {
    const { page, stub } = app;
    await typeText(page, FINGLISH);
    stub.clearLog();
    await page.keyboard.press('Control+Enter');
    await expect(page.locator('#tMeta')).toHaveText('Finglish (Persian written in Latin letters) needs an AI engine. Add a free Gemini or Groq key in Engines & keys.');
    await expect(page.locator('#tOut')).toHaveValue('');
    await expect(page.locator('#tFinglish')).toBeHidden();
    expect(stub.calls('clients5.google.com')).toHaveLength(0);
    expect(stub.calls('translate.googleapis.com')).toHaveLength(0);
    expect(stub.calls('api.mymemory.translated.net')).toHaveLength(0);
    expect(aiCalls(stub)).toHaveLength(0);
    // and the button works again afterwards
    await expect(page.locator('#tGo')).toBeEnabled();
  });

  test('the message is in Persian when the interface is Persian', async ({ app }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#uiLang'));
    await typeText(page, FINGLISH);
    await page.keyboard.press('Control+Enter');
    await expect(page.locator('#tMeta')).toContainText('فینگلیش (فارسی با حروف لاتین) به یک موتور هوش مصنوعی نیاز دارد');
  });

  test('ordinary English still goes to the normal engine', async ({ app }) => {
    const { page, stub } = app;
    await page.locator('#tgt').selectOption('fa');
    await typeText(page, 'Hello, how are you today? I want to talk to you.');
    stub.clearLog();
    await page.keyboard.press('Control+Enter');
    await expect(page.locator('#tOut')).toHaveValue('[fa] Hello, how are you today? I want to talk to you.');
    expect(stub.calls('clients5.google.com')).toHaveLength(1);
  });
});
