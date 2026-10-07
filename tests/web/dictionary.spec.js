'use strict';
// Offline dictionary in the web app: packs, lookup in both directions, forms, reverse meanings, word list, AI after, credits, Persian UI.
const { test, expect, onlyEngines, mouseClick, downloadOf, VALID_KEY } = require('../support/fixtures');

const installPacks = page => page.evaluate(async () => { await dictReady; for (const p of DICT_PAIRS) await MakanDict.install(p, { getBytes: dictBytes(p) }); return true; });

async function openDictionary(page) {
  await mouseClick(page, page.locator('#tabs button[data-tab="dict"]'));
  await expect(page.locator('#dcSearch')).toBeVisible();
}
async function search(page, word) {
  await mouseClick(page, page.locator('#dcSearch'));
  await page.keyboard.press('Control+A');
  await page.keyboard.type(word);
  await page.keyboard.press('Enter');
}

test.describe('Web app: offline dictionary', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), src: 'en', tgt: 'fa' } } });

  test('normalisation matches the pack builder: Arabic ye/kaf, zero-width joiner, diacritics, tatweel, case', async ({ app }) => {
    const { page } = app;
    const r = await page.evaluate(() => ({
      kaf: MakanDict.normalize('كتاب', 'fa') === MakanDict.normalize('کتاب', 'fa'),
      ye: MakanDict.normalize('ي', 'fa') === 'ی' && MakanDict.normalize('توپچى', 'fa') === 'توپچی',
      zwnj: MakanDict.normalize('می‌روم', 'fa'),
      marks: MakanDict.normalize('کِتاب', 'fa'),
      tatweel: MakanDict.normalize('کتـــاب', 'fa'),
      en: MakanDict.normalize('  Break  The Ice ', 'en'),
      detect: [MakanDict.detectLang('hello'), MakanDict.detectLang('سلام'), MakanDict.detectLang('خانه house')]
    }));
    expect(r.kaf).toBe(true);
    expect(r.ye).toBe(true);
    expect(r.zwnj).toBe('میروم');
    expect(r.marks).toBe('کتاب');
    expect(r.tatweel).toBe('کتاب');
    expect(r.en).toBe('break the ice');
    expect(r.detect).toEqual(['en', 'fa', 'fa']);
  });

  test('Engines & keys > Offline: each pack can be downloaded (size shown), is then ready, and can be removed', async ({ app }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#openSet'));
    await expect(page.locator('#dictSt-en-fa')).toHaveText(/not downloaded/i);
    await expect(page.locator('#ov')).toContainText('~1.0 MB');
    await mouseClick(page, page.locator('#dictDl-en-fa'));
    await expect(page.locator('#dictSt-en-fa')).toContainText(/ready/i, { timeout: 30_000 });
    await expect(page.locator('#dictDot-en-fa')).toHaveClass(/ok/);
    await expect(page.locator('#dictSt-fa-en')).toHaveText(/not downloaded/i);
    await mouseClick(page, page.locator('#dictRm-en-fa'));
    await expect(page.locator('#dictSt-en-fa')).toHaveText(/not downloaded/i);
  });

  test('without the pack the Dictionary tab says so and offers to get it', async ({ app }) => {
    const { page } = app;
    await openDictionary(page);
    await search(page, 'first');
    await expect(page.locator('#dcNoPackText')).toContainText('not downloaded');
    await mouseClick(page, page.locator('#dcOpenSettings'));
    await expect(page.locator('#ov')).toHaveClass(/\bon\b/);
  });

  test.describe('with the packs installed', () => {
    test('English word: every part of speech, meanings, example', async ({ app }) => {
      const { page } = app;
      await installPacks(page);
      await openDictionary(page);
      await search(page, 'first');
      await expect(page.locator('#dcResult .dict-pos').first()).toBeVisible();
      const pos = await page.locator('#dcResult .dict-pos').allTextContents();
      expect(pos).toEqual(expect.arrayContaining(['adjective', 'adverb']));
      await expect(page.locator('#dcResult .dict-meanings').first()).toContainText('اول');
    });

    test('an inflected form resolves to its headword', async ({ app }) => {
      const { page } = app;
      await installPacks(page);
      await openDictionary(page);
      await search(page, 'mice');
      await expect(page.locator('#dcResult .dict-head .w').first()).toHaveText('mouse');
      await expect(page.locator('#dcResult .dict-via').first()).toContainText('mice');
    });

    test('a Persian word is found in the other direction, also with Arabic letters and a joiner', async ({ app }) => {
      const { page } = app;
      await installPacks(page);
      await openDictionary(page);
      await search(page, 'در');
      await expect(page.locator('#dcResult .dict-meanings').first()).toContainText('door');
      const normalised = await page.evaluate(async () => (await MakanDict.lookup('كتاب', { pair: 'fa-en' })).groups.length === (await MakanDict.lookup('کتاب', { pair: 'fa-en' })).groups.length);
      expect(normalised).toBe(true);
    });

    test('an idioms and phrases section lists phrases containing the word', async ({ app }) => {
      const { page } = app;
      await installPacks(page);
      const r = await page.evaluate(async () => (await MakanDict.lookup('how do you do', { pair: 'en-fa' })).phrases.map(p => p.headword));
      expect(r).toContain('how do you do');
      await openDictionary(page);
      await search(page, 'know');
      await expect(page.locator('#dcResult')).toContainText('Idioms and phrases');
    });

    test('lower-ranked extra meanings come from the other pack when this one lacks the pair', async ({ app }) => {
      const { page } = app;
      await installPacks(page);
      const found = await page.evaluate(async () => {
        const words = ['water', 'house', 'book', 'friend', 'love', 'time', 'life', 'food', 'sun', 'moon', 'tree', 'city', 'road', 'night', 'day', 'sea', 'fire', 'bird', 'king', 'war', 'peace', 'door', 'eye', 'hand', 'heart', 'mother', 'father', 'dream', 'stone', 'garden'];
        for (const w of words) { const r = await MakanDict.lookup(w, { pair: 'en-fa' }); if (r && r.extra.length) return { w, extra: r.extra[0], meanings: r.groups.flatMap(g => g.entries.flatMap(e => e.meanings)) }; }
        return null;
      });
      expect(found, 'at least one common English word gains a meaning from the Persian pack').toBeTruthy();
      expect(found.meanings).not.toContain(found.extra.headword);
      expect(found.extra.source).toBe('reverse');
    });

    test('works with Offline mode on and the network down', async ({ app }) => {
      const { page, stub } = app;
      await installPacks(page);
      await page.evaluate(() => { cfg.offline = true; saveCfg(); });
      await page.context().setOffline(true);
      await openDictionary(page);
      stub.clearLog();
      await search(page, 'first');
      await expect(page.locator('#dcResult .dict-pos').first()).toBeVisible();
      expect(stub.log.filter(e => e.server === 'provider')).toEqual([]);
      await page.context().setOffline(false);
    });

    test('my words: save, list, export as CSV (with spreadsheet-formula protection), remove', async ({ app }) => {
      const { page } = app;
      await installPacks(page);
      await openDictionary(page);
      await search(page, 'first');
      await mouseClick(page, page.locator('#dcResult .dict-save').first());
      await expect(page.locator('#dcResult .dict-save').first()).toHaveText('Saved ✓');
      await expect(page.locator('#dcWords .my-word')).toHaveCount(1);
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mkt_words'))[0].w)).toBe('first');
      await page.evaluate(() => saveWord({ w: '=cmd()', pair: 'en-fa', pos: 'noun', meanings: ['a "quoted", meaning'] }));
      const out = await downloadOf(page, () => mouseClick(page, page.locator('#dcExport')));
      expect(out.name).toBe('makan-my-words.csv');
      const csv = out.bytes.toString('utf8').replace(/^﻿/, '');
      expect(csv.split('\r\n')[0]).toBe('word,pair,part_of_speech,meanings,saved_at');
      expect(csv).toContain("'=cmd()");
      expect(csv).toContain('"a ""quoted"", meaning"');
      await mouseClick(page, page.locator('#dcWords [data-rm]').first());
      await expect(page.locator('#dcWords .my-word')).toHaveCount(1);
    });

    test('Text tab: clicking a word in the result shows the dictionary card', async ({ app }) => {
      const { page } = app;
      await installPacks(page);
      await page.evaluate(() => { document.getElementById('tOut').value = 'the first list'; });
      const box = await page.locator('#tOut').boundingBox();
      await page.mouse.click(box.x + 40, box.y + 14); // inside "first" (about the 5th to 9th character)
      await page.evaluate(() => { const t = document.getElementById('tOut'); t.focus(); t.setSelectionRange(6, 6); });
      await page.locator('#tOut').dispatchEvent('click', { clientX: box.x + 40, clientY: box.y + 14 });
      await expect(page.locator('#wordCard')).toBeVisible();
      await expect(page.locator('#wordCard .dict-head .w').first()).toHaveText('first');
    });
  });

  test('credits: the About & credits box shows the Wiktionary attribution', async ({ app }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#creditsBtn'));
    await expect(page.locator('#creditsBox')).toContainText('Wiktionary (CC BY-SA 4.0');
    await expect(page.locator('#creditsBox a[href="dict/en-fa/credits.txt"]')).toBeVisible();
    const r = await page.evaluate(async () => (await fetch('dict/fa-en/credits.txt')).text());
    expect(r).toContain('CC BY-SA');
  });

  test('Persian interface: labels in Persian and the page runs right to left', async ({ app }) => {
    const { page } = app;
    await installPacks(page);
    await page.evaluate(() => { store.set('ui', 'fa'); });
    await page.reload();
    await mouseClick(page, page.locator('#tabs button[data-tab="dict"]'));
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('#dcGo')).toHaveText('جستجو');
    await search(page, 'first');
    await expect(page.locator('#dcResult .dict-save').first()).toHaveText('ذخیره‌ی واژه');
    await mouseClick(page, page.locator('#creditsBtn'));
    await expect(page.locator('#creditsBox')).toContainText('ویکی‌واژه');
  });
});

test.describe('Web app: dictionary with an AI engine', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['gemini', 'google'], { gemini: VALID_KEY }), tMode: 'smart', src: 'en', tgt: 'fa' } } });

  test('"Explain with AI" adds usage details below the entry', async ({ app }) => {
    const { page } = app;
    await installPacks(page);
    await openDictionary(page);
    await search(page, 'first');
    await expect(page.locator('#dcResult .dict-pos').first()).toBeVisible();
    await mouseClick(page, page.locator('#dcExplain'));
    await expect(page.locator('#dcResult .dict-ai')).not.toHaveText('Asking the AI…', { timeout: 20_000 });
    await expect(page.locator('#dcResult .dict-ai')).not.toBeEmpty();
  });

  test('Text tab card: the entry is there first, the AI detail follows', async ({ app }) => {
    const { page } = app;
    await installPacks(page);
    await page.evaluate(() => { document.getElementById('tOut').value = 'first'; });
    await page.evaluate(() => { const t = document.getElementById('tOut'); t.focus(); t.setSelectionRange(2, 2); });
    await page.locator('#tOut').dispatchEvent('click', { clientX: 200, clientY: 300 });
    await expect(page.locator('#wordCard .dict-head .w').first()).toHaveText('first');
    await expect(page.locator('#wordCard .dict-ai')).toBeVisible({ timeout: 20_000 });
  });
});
