'use strict';
// Dictionary: generated pack list and more language pairs, contrast, cross-fill rule, ranking, vulgar words.
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { buildList } = require('../../build-dict-list');
const { test, expect, onlyEngines, mouseClick, activateSettingsTab } = require('../support/fixtures');

const installPacks = page => page.evaluate(async () => { await dictReady; for (const p of DICT_PAIRS) await MakanDict.install(p, { getBytes: dictBytes(p) }); return true; });

test.describe('Dictionary pack list (generated)', () => {
  test('dict/packs.json is what the generator makes from the folders under dict/', () => {
    const committed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'dict', 'packs.json'), 'utf8'));
    expect(committed.packs).toEqual(buildList());
    expect(committed.packs.map(p => p.id)).toEqual(expect.arrayContaining(['en-fa', 'fa-en']));
  });

  test('a new language folder (en-ar, same format) appears in the list with no code change', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'makan-dict-'));
    const mk = (pair, count, size) => {
      const d = path.join(root, pair, `pack-${size}`);
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, 'pack.json'), JSON.stringify({ entry_count: count, phrase_count: 1, requested_size: size, compressed_bytes: 1234, files: [] }));
      fs.writeFileSync(path.join(root, pair, 'credits.txt'), 'credits');
    };
    mk('en-ar', 900, 30000); mk('ar-en', 700, 10000); mk('de-en', 100, 10000);
    fs.mkdirSync(path.join(root, 'not-a-pack'), { recursive: true });
    const list = buildList(root);
    expect(list.map(p => p.id)).toEqual(['ar-en', 'de-en', 'en-ar']);
    const enar = list.find(p => p.id === 'en-ar');
    expect(enar).toMatchObject({ from: 'en', to: 'ar', entries: 900, dir: 'en-ar/pack-30000', credits: 'en-ar/credits.txt' });
  });

  test('the generator fails if one language pair holds more than one pack size, and the repository holds one size each', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'makan-dict-'));
    for (const size of [10000, 30000]) {
      const d = path.join(root, 'en-ar', `pack-${size}`);
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, 'pack.json'), JSON.stringify({ entry_count: size / 100, requested_size: size, compressed_bytes: 1, files: [] }));
    }
    expect(() => buildList(root)).toThrow(/en-ar holds 2 pack sizes/);
    const real = path.join(__dirname, '..', '..', 'dict');
    for (const pair of fs.readdirSync(real).filter(n => /^[a-z]{2,3}-[a-z]{2,3}$/.test(n))) {
      expect(fs.readdirSync(path.join(real, pair)).filter(n => /^pack-\d+$/.test(n)), pair).toHaveLength(1);
    }
  });
});

test.describe('Web app: dictionary language pairs and normalisation per language', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), src: 'en', tgt: 'fa' } } });

  // An Arabic -> English pack made on the fly and served in place of the real list (no real Arabic pack exists yet).
  async function withFakeArabicPack(page) {
    const real = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'dict', 'packs.json'), 'utf8'));
    // Only the two packs this test needs from the real list, so the number of real packs (ten or two) does not matter.
    const small = real.packs.filter(p => p.id === 'en-fa' || p.id === 'fa-en');
    expect(small.map(p => p.id).sort()).toEqual(['en-fa', 'fa-en']);
    const list = { format: 'makan-dictionary-list', packs: [...small, { id: 'ar-en', from: 'ar', to: 'en', entries: 2, phrases: 0, bytes: 300, dir: 'ar-en/pack-1', credits: null }] };
    const chunk = zlib.gzipSync(JSON.stringify({ type: 'dictionary-chunk', entries: [
      { headword: 'كتاب', lookup: 'كتاب', pos: 'noun', meanings: ['book'], example: null, forms: [] },
      { headword: 'ياسمين', lookup: 'ياسمين', pos: 'noun', meanings: ['jasmine'], example: null, forms: [] }
    ] }));
    await page.route('**/dict/packs.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(list) }));
    await page.route('**/dict/ar-en/pack-1/pack.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ files: ['chunk-0001.json.gz'], generated_at: 'test' }) }));
    await page.route('**/dict/ar-en/pack-1/chunk-0001.json.gz', r => r.fulfill({ contentType: 'application/gzip', body: chunk }));
    // The app's service worker would answer the request itself; let the page talk to the network so the test can serve the fake list.
    await page.evaluate(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); });
    await page.reload();
    await page.waitForFunction(() => typeof DICT_PAIRS !== 'undefined' && DICT_PAIRS.length === 3, null, { timeout: 15_000 });
  }

  test('every pack in the list is offered for download and in the pair menu; Persian rules are not applied to Arabic', async ({ app }) => {
    const { page } = app;
    await withFakeArabicPack(page);
    await mouseClick(page, page.locator('#openSet'));
    await activateSettingsTab(page, 'trModels');
    await expect(page.locator('#dictDl-ar-en')).toBeVisible();
    await expect(page.locator('#dictPackRows')).toContainText('Arabic');
    await mouseClick(page, page.locator('#dictDl-ar-en'));
    await expect(page.locator('#dictSt-ar-en')).toContainText(/ready/i, { timeout: 20_000 });
    await mouseClick(page, page.locator('#btnSaveDone'));
    expect(await page.locator('#dcPair option').allTextContents()).toEqual(expect.arrayContaining(['Auto (detect language)', 'English → Persian', 'Persian → English', 'Arabic → English']));
    const r = await page.evaluate(async () => ({
      arabicKaf: (await MakanDict.lookup('كتاب', { pair: 'ar-en' })).groups.length,
      persianKafOnArabicPack: (await MakanDict.lookup('کتاب', { pair: 'ar-en' })).groups.length,
      arabicYe: (await MakanDict.lookup('ياسمين', { pair: 'ar-en' })).groups.length,
      normFa: MakanDict.normalize('ي', 'fa'), normAr: MakanDict.normalize('ي', 'ar')
    }));
    expect(r.arabicKaf).toBe(1);
    expect(r.persianKafOnArabicPack, 'Persian kaf must not match an Arabic-kaf headword').toBe(0);
    expect(r.arabicYe).toBe(1);
    expect(r.normFa).toBe('ی');
    expect(r.normAr).toBe('ي');
  });

  test('the pair menu decides which pack answers', async ({ app }) => {
    const { page } = app;
    await installPacks(page);
    await mouseClick(page, page.locator('#tabs button[data-tab="dict"]'));
    await page.locator('#dcPair').selectOption('fa-en');
    await mouseClick(page, page.locator('#dcSearch'));
    await page.keyboard.type('در');
    await page.keyboard.press('Enter');
    await expect(page.locator('#dcResult .dict-meanings').first()).toContainText('door');
  });

  test('the search box is readable: text contrast against its background is at least 4.5:1 in both interface languages', async ({ app }) => {
    const { page } = app;
    const ratio = () => page.evaluate(() => {
      const el = document.getElementById('dcSearch');
      const cs = getComputedStyle(el);
      const rgb = c => c.match(/[\d.]+/g).slice(0, 3).map(Number);
      const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const a = lum(rgb(cs.color)) + 0.05, b = lum(rgb(cs.backgroundColor)) + 0.05;
      return { ratio: Math.max(a, b) / Math.min(a, b), color: cs.color, bg: cs.backgroundColor };
    });
    await mouseClick(page, page.locator('#tabs button[data-tab="dict"]'));
    const en = await ratio();
    expect(en.ratio, JSON.stringify(en)).toBeGreaterThanOrEqual(4.5);
    await page.evaluate(() => store.set('ui', 'fa'));
    await page.reload();
    await mouseClick(page, page.locator('#tabs button[data-tab="dict"]'));
    const fa = await ratio();
    expect(fa.ratio, JSON.stringify(fa)).toBeGreaterThanOrEqual(4.5);
  });

  test.describe('with the real packs', () => {
    test('cross-fill only when the other pack\'s WHOLE meaning is the word, and it comes last', async ({ app }) => {
      const { page } = app;
      await installPacks(page);
      const r = await page.evaluate(async () => {
        const out = {};
        for (const w of ['water', 'house', 'book', 'friend', 'bread', 'door', 'time', 'city']) {
          const res = await MakanDict.lookup(w, { pair: 'en-fa', showVulgar: true });
          const proofs = [];
          for (const x of res.extra) {
            const back = await MakanDict.lookup(x.headword, { pair: 'fa-en', showVulgar: true });
            proofs.push(back.groups.some(g => g.entries.some(e => e.headword === x.headword && e.meanings.some(m => MakanDict.normalize(m, 'en') === w))));
          }
          out[w] = { extra: res.extra.map(x => x.headword), allExact: proofs.every(Boolean), nExtra: res.extra.length };
        }
        return out;
      });
      for (const [w, v] of Object.entries(r)) expect(v.allExact, `${w}: ${JSON.stringify(v)}`).toBe(true);
      expect(r.water.extra, 'no unrelated word (such as bread) for "water"').not.toContain('نان');
      expect(Object.values(r).some(v => v.nExtra > 0), 'cross-fill still finds something').toBe(true);
    });

    test('standard meanings and parts of speech come first, single-letter and variant-looking entries last', async ({ app }) => {
      const { page } = app;
      await installPacks(page);
      const r = await page.evaluate(async () => {
        const res = await MakanDict.lookup('و', { pair: 'fa-en' });
        const doors = await MakanDict.lookup('در', { pair: 'fa-en' });
        return { pos: res.groups.map(g => g.pos), first: doors.groups[0].entries[0].meanings[0] };
      });
      expect(r.pos[0]).toBe('conjunction');
      expect(r.pos[r.pos.length - 1]).toBe('character');
      expect(r.first).toMatch(/door|lid/);
    });

    test('vulgar words: they ARE in the packs, hidden by default with a clear message, shown with the switch', async ({ app }) => {
      const { page } = app;
      await installPacks(page);
      const r = await page.evaluate(async () => {
        const a = await MakanDict.lookup('fuck', { pair: 'en-fa' });
        const b = await MakanDict.lookup('fuck', { pair: 'en-fa', showVulgar: true });
        const c = await MakanDict.lookup('کیر', { pair: 'fa-en' });
        const d = await MakanDict.lookup('کیر', { pair: 'fa-en', showVulgar: true });
        const e = await MakanDict.lookup('dick', { pair: 'en-fa' });
        return { hiddenEn: [a.groups.length, a.hidden], shownEn: b.groups.length, hiddenFa: [c.groups.length, c.hidden], shownFa: d.groups.length, dick: e.groups.length };
      });
      expect(r.hiddenEn).toEqual([0, expect.any(Number)]);
      expect(r.hiddenEn[1]).toBeGreaterThan(0);
      expect(r.shownEn).toBeGreaterThan(0);
      expect(r.hiddenFa[0]).toBe(0);
      expect(r.shownFa).toBeGreaterThan(0);
      expect(r.dick).toBe(0);
      await mouseClick(page, page.locator('#tabs button[data-tab="dict"]'));
      await expect(page.locator('#dcVulgar')).not.toBeChecked();
      await mouseClick(page, page.locator('#dcSearch'));
      await page.keyboard.type('fuck');
      await page.keyboard.press('Enter');
      await expect(page.locator('#dcResult')).toContainText('marked as vulgar and hidden');
      await mouseClick(page, page.locator('#dcVulgar'));
      await expect(page.locator('#dcResult .dict-head .w').first()).toHaveText('fuck');
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mkt_showVulgar')))).toBe(true);
    });

    test('ordinary words are not affected by the vulgar filter', async ({ app }) => {
      const { page } = app;
      await installPacks(page);
      const r = await page.evaluate(async () => (await MakanDict.lookup('first', { pair: 'en-fa' })).groups.length);
      expect(r).toBeGreaterThan(0);
    });
  });
});
