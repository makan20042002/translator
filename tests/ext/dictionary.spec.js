'use strict';
// Offline dictionary in the extension card: double-click a word, instant entry, no network; idioms; AI after.
const { test, expect, inShadow, dragSelect, pressM, dblclickText, VALID_KEY } = require('../support/ext-fixtures');

const HOSTS = ['clients5.google.com', 'translate.googleapis.com', 'api.mymemory.translated.net', 'generativelanguage.googleapis.com', 'api.openai.com', 'api.groq.com'];

test.describe('Extension: offline dictionary', () => {
  test.use({ extOptions: { preOpen: ['/__test/words.html'] } });

  test('double-click a word: the dictionary entry appears with every part of speech and no network call', async ({ ext, stub }) => {
    for (const h of HOSTS) stub.failHost(h, 'drop'); // the network is blocked
    const page = ext.article;
    await dblclickText(page, '#w2');
    await expect(inShadow(page, '.makan-dict-word')).toHaveText('first', { timeout: 20_000 });
    const pos = await inShadow(page, '.makan-dict-pos').allTextContents();
    expect(pos, 'every part of speech, not only the first').toEqual(expect.arrayContaining(['adjective', 'adverb']));
    await expect(inShadow(page, '.makan-dict-trans').first()).toContainText('اول');
    await expect(inShadow(page, '#makanEnginePill')).toHaveText('Offline dictionary');
    // (Chromium's own background traffic - spell-check files, Google accounts - is not the extension's.)
    expect(stub.calls().filter(c => HOSTS.includes(c.host)).map(c => c.host + c.path), 'requests to any translation provider').toEqual([]);
  });

  test('an inflected form resolves to its headword', async ({ ext }) => {
    const page = ext.article;
    await dblclickText(page, '#w1');
    await expect(inShadow(page, '.makan-dict-word')).toHaveText('mouse', { timeout: 20_000 });
    await expect(inShadow(page, '.makan-dict-form')).toContainText('mice → mouse');
  });

  test('a Persian word is looked up in the other direction', async ({ ext }) => {
    const page = ext.article;
    await dblclickText(page, '#w4');
    await expect(inShadow(page, '.makan-dict-word')).toHaveText('در', { timeout: 20_000 });
    await expect(inShadow(page, '.makan-dict-trans').first()).toContainText('door');
  });

  test('a selected phrase that is an idiom shows its meaning, marked as an idiom, instead of a literal translation', async ({ ext, stub }) => {
    const page = ext.article;
    await dragSelect(page, '#w3');
    await pressM(page);
    await expect(inShadow(page, '.makan-dict-badge')).toHaveText('Idiom', { timeout: 20_000 });
    await expect(inShadow(page, '.makan-idiom-meaning')).toContainText('از آشنایی شما خوشوقتم');
    expect(stub.calls('clients5.google.com'), 'no literal translation was requested').toEqual([]);
  });

  test('a phrase that is not an idiom is translated as before', async ({ ext }) => {
    const page = ext.article;
    await dragSelect(page, '#w6');
    await pressM(page);
    await expect(inShadow(page, '.makan-result-text')).toHaveText('[fa] This sentence is no idiom at all really.', { timeout: 20_000 });
  });

  test('a word that is not in the dictionary falls back to the normal translation', async ({ ext }) => {
    const page = ext.article;
    await dblclickText(page, '#w5');
    await expect(inShadow(page, '.makan-result-text')).toHaveText('[fa] Serendipity', { timeout: 20_000 });
  });

  test.describe('with an AI engine', () => {
    test.use({ extOptions: { preOpen: ['/__test/words.html'], config: { eng: { gemini: { on: true, key: VALID_KEY } } } } });
    test('the entry is shown first and the AI explanation is added after it', async ({ ext }) => {
      const page = ext.article;
      await dblclickText(page, '#w2');
      await expect(inShadow(page, '.makan-dict-word')).toHaveText('first', { timeout: 20_000 });
      await expect(inShadow(page, '#makanDictAi')).toBeVisible({ timeout: 20_000 });
      await expect(inShadow(page, '#makanDictAi .makan-dict-pos')).toHaveText('AI explanation');
    });
  });
});

test.describe('Extension: credits', () => {
  test('Options shows the Wiktionary attribution and links the credits files that ship with the packs', async ({ ext }) => {
    const page = await ext.context.newPage();
    await page.goto(ext.url('options.html'));
    await expect(page.locator('#creditsText')).toContainText('Wiktionary (CC BY-SA 4.0');
    const r = await page.evaluate(async () => (await (await fetch('dict/en-fa/credits.txt')).text()));
    expect(r).toContain('CC BY-SA');
    await page.locator('#optLangToggle').click();
    await expect(page.locator('#creditsText')).toContainText('ویکی‌واژه');
  });
});

test.describe('Extension: AI-recognised idioms', () => {
  test.use({ extOptions: { preOpen: ['/__test/words.html'], config: { eng: { gemini: { on: true, key: VALID_KEY } } } } });

  test('a selection that is not stored but is an idiom: the idiom explanation comes first, the literal translation second', async ({ ext }) => {
    const page = ext.article;
    await dragSelect(page, '#w7');
    await pressM(page);
    await expect(inShadow(page, '.makan-result-text')).toHaveText('[fa] He wants to break the ice', { timeout: 20_000 });
    const body = inShadow(page, '.makan-card-body');
    await expect(inShadow(page, '.makan-idiom-ai .makan-dict-badge')).toHaveText('Idiom (AI)', { timeout: 20_000 });
    await expect(inShadow(page, '.makan-idiom-ai .makan-idiom-meaning')).toContainText('to start a friendly conversation');
    await expect(inShadow(page, '.makan-idiom-ai')).toContainText('یخ را شکستن');
    const order = await body.evaluate(el => Array.from(el.children).map(c => c.className));
    expect(order.indexOf('makan-idiom-ai'), order.join(' | ')).toBeLessThan(order.findIndex(c => /makan-result-text/.test(c)));
    await expect(inShadow(page, '.makan-card-body > .makan-dict-pos')).toHaveText('Literal translation');
  });

  test('an ordinary sentence gets no idiom block', async ({ ext }) => {
    const page = ext.article;
    await dragSelect(page, '#w6');
    await pressM(page);
    await expect(inShadow(page, '.makan-result-text')).toHaveText('[fa] This sentence is no idiom at all really.', { timeout: 20_000 });
    await page.waitForTimeout(1500);
    await expect(inShadow(page, '.makan-idiom-ai')).toHaveCount(0);
  });
});
