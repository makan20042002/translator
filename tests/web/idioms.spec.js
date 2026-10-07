'use strict';
// Idioms: the Idioms tab (stored entry first, AI explanation after), reverse search, marks in the Text tab, saved idioms.
const { test, expect, onlyEngines, mouseClick, downloadOf, VALID_KEY } = require('../support/fixtures');

const installPacks = page => page.evaluate(async () => { await dictReady; for (const p of DICT_PAIRS) await MakanDict.install(p, { getBytes: dictBytes(p) }); return true; });
const GEMINI = 'generativelanguage.googleapis.com';
async function openIdioms(page) { await mouseClick(page, page.locator('#tabs button[data-tab="idiom"]')); await expect(page.locator('#idSearch')).toBeVisible(); }
async function typeInto(page, sel, text) { await mouseClick(page, page.locator(sel)); await page.keyboard.press('Control+A'); await page.keyboard.type(text); await page.keyboard.press('Enter'); }

test.describe('Web app: Idioms tab without an AI engine', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), src: 'en', tgt: 'fa' } } });

  test('a stored idiom is shown at once, with a plain line that the AI explanation needs an engine', async ({ app }) => {
    const { page, stub } = app;
    await installPacks(page);
    await openIdioms(page);
    stub.clearLog();
    await typeInto(page, '#idSearch', 'time is money');
    await expect(page.locator('#idResult .dict-head .w')).toHaveText('time is money');
    await expect(page.locator('#idResult .dict-idiom')).toHaveText('Stored idiom');
    await expect(page.locator('#idResult .dict-meanings')).not.toBeEmpty();
    await expect(page.locator('#idResult .hint')).toContainText('No AI engine is available');
    expect(stub.calls(GEMINI)).toEqual([]);
  });

  test('a Persian idiom is found in the Persian pack', async ({ app }) => {
    const { page } = app;
    await installPacks(page);
    await openIdioms(page);
    await typeInto(page, '#idSearch', 'ماهی را هر وقت از آب بگیری تازه است');
    await expect(page.locator('#idResult .dict-head .w')).toContainText('ماهی');
    await expect(page.locator('#idResult .dict-meanings')).toContainText(/fresh/i);
  });

  test('not stored and no AI: a clear message, nothing invented', async ({ app }) => {
    const { page } = app;
    await installPacks(page);
    await openIdioms(page);
    await typeInto(page, '#idSearch', 'break the ice');
    await expect(page.locator('#idResult .hint')).toContainText('not in the stored idioms');
    await expect(page.locator('#idResult .dict-ai')).toHaveCount(0);
  });

  test('reverse search says plainly that it needs an AI engine', async ({ app }) => {
    const { page } = app;
    await openIdioms(page);
    await typeInto(page, '#idDescribe', 'someone who talks too much');
    await expect(page.locator('#idFindResult .hint')).toContainText('done by an AI engine, and none is available');
  });

  test('Text tab: stored idioms are underlined with no AI, plain greetings are not, and clicking opens the idiom card', async ({ app }) => {
    const { page } = app;
    await installPacks(page);
    await mouseClick(page, page.locator('#tIn'));
    await page.keyboard.type('Remember that time is money, I know.');
    await expect(page.locator('#tInBack mark')).toHaveCount(1, { timeout: 5000 });
    await expect(page.locator('#tInBack mark')).toHaveText('time is money');
    // Click inside the underlined words.
    await page.evaluate(() => { const t = document.getElementById('tIn'); t.focus(); t.setSelectionRange(20, 20); });
    await page.locator('#tIn').dispatchEvent('click', { clientX: 300, clientY: 300 });
    await expect(page.locator('#wordCard .dict-head .w')).toHaveText('time is money');
  });

  test('saved idioms go into My words, marked as idioms, and export with the part of speech "idiom"', async ({ app }) => {
    const { page } = app;
    await installPacks(page);
    await openIdioms(page);
    await typeInto(page, '#idSearch', 'time is money');
    await expect(page.locator('#idSave')).toBeVisible();
    await mouseClick(page, page.locator('#idSave'));
    await mouseClick(page, page.locator('#tabs button[data-tab="dict"]'));
    await expect(page.locator('#dcWords .my-word')).toHaveCount(1);
    await expect(page.locator('#dcWords .my-word .meta')).toHaveText('idiom');
    const out = await downloadOf(page, () => mouseClick(page, page.locator('#dcExport')));
    expect(out.bytes.toString('utf8')).toContain('time is money,idiom,idiom,');
  });

  test('Persian interface: the tab and its labels are Persian', async ({ app }) => {
    const { page } = app;
    await page.evaluate(() => store.set('ui', 'fa'));
    await page.reload();
    await expect(page.locator('#tabs button[data-tab="idiom"]')).toHaveText('اصطلاحات');
    await mouseClick(page, page.locator('#tabs button[data-tab="idiom"]'));
    await expect(page.locator('#idFind')).toHaveText('پیدا کردن اصطلاح');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });
});

test.describe('Web app: Idioms with an AI engine', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['gemini', 'google'], { gemini: VALID_KEY }), tMode: 'smart', src: 'en', tgt: 'fa' } } });

  test('stored entry first, then the AI explanation with meaning, literal wording, natural equivalent, register and two examples', async ({ app }) => {
    const { page } = app;
    await installPacks(page);
    await openIdioms(page);
    await typeInto(page, '#idSearch', 'break the ice');
    const box = page.locator('#idResult .idiom-box');
    await expect(box).toBeVisible({ timeout: 20_000 });
    await expect(box).toContainText('to start a friendly conversation');
    await expect(box.locator('dt')).toHaveText(['Meaning', 'Literal wording', 'Natural equivalent', 'Register', 'Examples']);
    await expect(box).toContainText('یخ را شکستن');
    await expect(box.locator('dd').last().locator('> div')).toHaveCount(4); // two examples, each with its translation
  });

  test('a stored idiom shows its entry immediately and the AI part afterwards', async ({ app }) => {
    const { page } = app;
    await installPacks(page);
    await openIdioms(page);
    await typeInto(page, '#idSearch', 'time is money');
    await expect(page.locator('#idResult .dict-head .w')).toHaveText('time is money');
    await expect(page.locator('#idResult .dict-ai')).toBeVisible();
  });

  test('an expression the AI does not consider an idiom is said so', async ({ app }) => {
    const { page } = app;
    await installPacks(page);
    await openIdioms(page);
    await typeInto(page, '#idSearch', 'the cat sat on the mat');
    await expect(page.locator('#idResult .dict-ai')).toContainText('does not think this is an idiom', { timeout: 20_000 });
  });

  test('reverse search: a described meaning gives idioms in both languages; clicking one searches it', async ({ app }) => {
    const { page } = app;
    await openIdioms(page);
    await typeInto(page, '#idDescribe', 'someone who talks too much');
    await expect(page.locator('#idFindResult .dict-pos')).toHaveText(['English', 'فارسی'], { timeout: 20_000 });
    await expect(page.locator('#idFindResult .id-hit')).toHaveCount(3);
    await mouseClick(page, page.locator('#idFindResult .id-hit').first());
    await expect(page.locator('#idSearch')).toHaveValue('talk the hind legs off a donkey');
  });

  test('Text tab: after an AI translation the idioms the AI finds are underlined; clicking opens the idiom card with the explanation', async ({ app }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tIn'));
    await page.keyboard.type('He told a joke to break the ice.');
    await mouseClick(page, page.locator('#tGo'));
    await expect(page.locator('#tOut')).toHaveValue(/\[fa\]/, { timeout: 20_000 });
    await expect(page.locator('#tInBack mark')).toHaveText('break the ice', { timeout: 20_000 });
    await page.evaluate(() => { const t = document.getElementById('tIn'); t.focus(); t.setSelectionRange(24, 24); });
    await page.locator('#tIn').dispatchEvent('click', { clientX: 300, clientY: 300 });
    await expect(page.locator('#wordCard .idiom-box')).toContainText('to start a friendly conversation', { timeout: 20_000 });
  });
});
