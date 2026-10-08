'use strict';
// Extension: dictionary pairs that are not bundled are offered in Options ("More dictionaries"), downloaded on
// demand from the web app's dict/ address, stored in the browser, usable by the extension, and deletable.
// The real packs under dict/ are used: the test copy of the extension leaves fa-en OUT of its bundle, so fa-en
// behaves exactly like a pair that was never bundled.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/ext-fixtures');
const { watchConsole, mouseClick } = require('../support/fixtures');

const LIST = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'dict', 'packs.json'), 'utf8'));
const FA_EN = LIST.packs.find(p => p.id === 'fa-en');
const mb = b => (b / 1048576).toFixed(1) + ' MB';

async function openOptions(ext, stub, webAppUrl) {
  await ext.patchConfig({ webAppUrl: webAppUrl || stub.appOrigin });
  const page = await ext.context.newPage();
  const errors = [];
  watchConsole(page, errors);
  await page.goto(ext.url('options.html'));
  await expect(page.locator('#optEngineList .opt-eng-row').first()).toBeVisible();
  return { page, errors };
}
const row = page => page.locator('#dictPackRows .opt-dict-row[data-pack="fa-en"]');
const lookup = (page, word) => page.evaluate(w => chrome.runtime.sendMessage({ action: 'dict-lookup', word: w }), word);
const stored = page => page.evaluate(async () => (await chrome.storage.local.get('makanDictExtra')).makanDictExtra || []);

test.describe('Extension: the build bundles only en-fa and fa-en', () => {
  test('dist/chrome and dist/firefox hold the two bundled packs and nothing else, and stay small', () => {
    for (const target of ['chrome', 'firefox']) {
      const dir = path.join(__dirname, '..', '..', 'dist', target, 'dict');
      const list = JSON.parse(fs.readFileSync(path.join(dir, 'packs.json'), 'utf8'));
      expect(list.packs.map(p => p.id).sort(), target).toEqual(['en-fa', 'fa-en']);
      const folders = fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort();
      expect(folders, target).toEqual(['en-fa', 'fa-en']);
      let total = 0;
      const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); e.isDirectory() ? walk(f) : total += fs.statSync(f).size; } };
      walk(path.join(dir, '..'));
      expect(total, `${target} size in bytes`).toBeLessThan(5 * 1024 * 1024);
    }
  });
});

test.describe('Extension: More dictionaries in Options (fa-en not bundled)', () => {
  test.use({ extOptions: { dropPairs: ['fa-en'] } });

  test('the pair that is not bundled is offered with its size and "Not downloaded"; the bundled pair is not', async ({ ext, stub }) => {
    const { page, errors } = await openOptions(ext, stub);
    await expect(page.locator('#secDictPacks')).toHaveText('More dictionaries');
    await expect(row(page)).toBeVisible();
    await expect(row(page).locator('strong')).toHaveText('Persian → English');
    await expect(row(page).locator('.opt-dict-size')).toHaveText(mb(FA_EN.bytes));
    await expect(row(page).locator('.opt-dict-state')).toHaveText('Not downloaded');
    await expect(row(page).locator('button')).toHaveText('Download');
    await expect(page.locator('#dictPackRows .opt-dict-row')).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('Download fetches the real pack from the web app address, shows Ready, and the extension can look words up', async ({ ext, stub }) => {
    const { page, errors } = await openOptions(ext, stub);
    const before = await lookup(page, 'کتاب');
    expect(before.ok && before.result, 'nothing to find before the download').toBeFalsy();
    await mouseClick(page, row(page).locator('button'));
    await expect(row(page).locator('.opt-dict-state')).toHaveText('Ready', { timeout: 30_000 });
    await expect(row(page).locator('button')).toHaveText('Delete');
    const extra = await stored(page);
    expect(extra.map(p => p.id)).toEqual(['fa-en']);
    expect(extra[0]).toMatchObject({ from: 'fa', to: 'en', dir: FA_EN.dir, bytes: FA_EN.bytes });
    const after = await lookup(page, 'کتاب');
    expect(after.ok).toBe(true);
    expect(after.result && after.result.groups.length, 'a Persian word is found in the downloaded pack').toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test('Ready survives closing and reopening Options; Delete removes the pack and the lookups stop', async ({ ext, stub }) => {
    const { page } = await openOptions(ext, stub);
    await mouseClick(page, row(page).locator('button'));
    await expect(row(page).locator('.opt-dict-state')).toHaveText('Ready', { timeout: 30_000 });
    await page.close();
    const again = await openOptions(ext, stub);
    await expect(row(again.page).locator('.opt-dict-state')).toHaveText('Ready');
    await mouseClick(again.page, row(again.page).locator('button'));
    await expect(row(again.page).locator('.opt-dict-state')).toHaveText('Not downloaded', { timeout: 15_000 });
    await expect(row(again.page).locator('button')).toHaveText('Download');
    expect(await stored(again.page)).toEqual([]);
    const gone = await lookup(again.page, 'کتاب');
    expect(gone.ok && gone.result, 'no result after Delete').toBeFalsy();
  });

  test('a failed download is reported, nothing is kept, and the row offers Download again', async ({ ext, stub }) => {
    const { page } = await openOptions(ext, stub);
    await page.route('**/dict/fa-en/**/chunk-*', r => r.abort());
    await mouseClick(page, row(page).locator('button'));
    await expect(page.locator('#optToasts')).toContainText('Download failed');
    await expect(row(page).locator('.opt-dict-state')).toHaveText('Not downloaded');
    expect(await stored(page)).toEqual([]);
  });

  test('the same section in Persian', async ({ ext, stub }) => {
    const { page } = await openOptions(ext, stub);
    await mouseClick(page, page.locator('#optLangToggle'));
    await expect(page.locator('#secDictPacks')).toHaveText('دیکشنری‌های بیشتر');
    await expect(row(page).locator('.opt-dict-state')).toHaveText('دانلود نشده');
    await expect(row(page).locator('button')).toHaveText('دانلود');
  });

  test('when the web app address cannot be reached, a plain line says so', async ({ ext, stub }) => {
    const { page } = await openOptions(ext, stub, 'http://127.0.0.1:9');
    await expect(page.locator('#dictPackRows')).toContainText('could not be reached');
  });
});

test.describe('Extension: More dictionaries with the normal bundle', () => {
  test('both packs are bundled, so the web app offers nothing more', async ({ ext, stub }) => {
    const { page } = await openOptions(ext, stub);
    await expect(page.locator('#dictPackRows')).toContainText('offers no other dictionaries');
  });
});
