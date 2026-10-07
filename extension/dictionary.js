/**
 * MAKAN Translate - offline dictionary (shared by the web app and the extension).
 *
 * Packs (English->Persian "en-fa", Persian->English "fa-en") are made from Wiktionary data (CC BY-SA, see dict/*\/credits.txt).
 * A pack is a pack.json (with the list of files), gzip-compressed chunk files of entries and a phrases file:
 *   entry = { headword, lookup (normalised), pos, meanings[], example, forms: [{form, tags[]}] }
 * install() reads a pack through a small getBytes(path) function (a web address in the web app, the extension's
 * own files in the extension) and stores it in IndexedDB; nothing is fetched again afterwards.
 * Words are looked up by their normalised form; inflected forms resolve to their headword; every part of speech is returned.
 */
(function (root) {
'use strict';

const PAIRS = { en: 'en-fa', fa: 'fa-en' };
const PAIR_INFO = {
  'en-fa': { from: 'en', to: 'fa', name: 'English → Persian', approxBytes: 1100000 },
  'fa-en': { from: 'fa', to: 'en', name: 'Persian → English', approxBytes: 850000 }
};

// The same normalisation the pack builder used for Persian: Arabic ye / alef maksura and kaf to the Persian letters,
// no zero-width non-joiner, no tatweel, no diacritics. Everything is lower-cased.
function normalize(word, lang) {
  let s = String(word == null ? '' : word).normalize('NFC').trim().replace(/\s+/g, ' ');
  s = s.toLowerCase();
  if (lang === 'fa') {
    s = s.replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[‌ـ]/g, '');
    s = s.replace(/\p{Mn}/gu, '');
  } else {
    s = s.replace(/[’‘]/g, "'");
  }
  return s;
}

// Persian or Arabic letters mean Persian; anything else is treated as English.
function detectLang(text) {
  return /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(String(text || '')) ? 'fa' : 'en';
}

const dbCache = {};
function openDb(pair) {
  if (dbCache[pair]) return dbCache[pair];
  dbCache[pair] = new Promise((resolve, reject) => {
    const req = indexedDB.open('makan-dict-' + pair, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('meta');
      db.createObjectStore('entries', { autoIncrement: true }).createIndex('lookup', 'lookup');
      db.createObjectStore('phrases', { autoIncrement: true }).createIndex('lookup', 'lookup');
      db.createObjectStore('forms', { keyPath: 'k' });
      db.createObjectStore('gloss', { keyPath: 'k' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { delete dbCache[pair]; reject(req.error); };
  });
  return dbCache[pair];
}
const wait = req => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
const done = tx => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });

async function gunzipJson(buf) {
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}

// Short glosses ("dog", "to run") of a meaning text, for the reverse index.
function glossesOf(meaning) {
  return String(meaning || '').split(/[;,،؛()]/).map(x => x.trim()).filter(x => x && x.length <= 32 && x.split(/\s+/).length <= 3);
}

async function install(pair, { getBytes, onProgress } = {}) {
  const info = PAIR_INFO[pair];
  if (!info) throw new Error('unknown dictionary pack: ' + pair);
  if (typeof getBytes !== 'function') throw new Error('no way to read the dictionary pack');
  const packMeta = JSON.parse(new TextDecoder().decode(await getBytes('pack.json')));
  const files = packMeta.files || [];
  const db = await openDb(pair);
  // Start clean so a half-finished earlier install cannot leave a mix.
  { const tx = db.transaction(['meta', 'entries', 'phrases', 'forms', 'gloss'], 'readwrite');
    ['meta', 'entries', 'phrases', 'forms', 'gloss'].forEach(n => tx.objectStore(n).clear()); await done(tx); }
  const forms = new Map(), gloss = new Map();
  const add = (map, k, head) => { if (!k) return; const a = map.get(k) || []; if (!a.includes(head) && a.length < 8) { a.push(head); map.set(k, a); } };
  let entries = 0, phrases = 0;
  for (let i = 0; i < files.length; i++) {
    const data = await gunzipJson(await getBytes(files[i]));
    const isPhrase = data.type === 'phrases-chunk' || /^phrases/.test(files[i]);
    const tx = db.transaction([isPhrase ? 'phrases' : 'entries'], 'readwrite');
    const store = tx.objectStore(isPhrase ? 'phrases' : 'entries');
    for (const e of data.entries || []) {
      store.add({ headword: e.headword, lookup: e.lookup, pos: e.pos, meanings: e.meanings || [], example: e.example || null, forms: e.forms || [] });
      if (isPhrase) { phrases++; continue; }
      entries++;
      for (const f of e.forms || []) add(forms, normalize(f.form, info.from), e.lookup);
      for (const m of e.meanings || []) for (const g of glossesOf(m)) add(gloss, normalize(g, info.to), e.lookup);
    }
    await done(tx);
    if (onProgress) onProgress((i + 1) / (files.length + 1));
  }
  for (const [name, map] of [['forms', forms], ['gloss', gloss]]) {
    const tx = db.transaction([name], 'readwrite');
    const store = tx.objectStore(name);
    for (const [k, heads] of map) store.put({ k, heads });
    await done(tx);
  }
  const meta = { pair, entries, phrases, version: packMeta.generated_at || '', installedAt: Date.now() };
  const tx = db.transaction(['meta'], 'readwrite');
  tx.objectStore('meta').put(meta, 'meta');
  await done(tx);
  if (onProgress) onProgress(1);
  return meta;
}

async function status(pair) {
  try { const db = await openDb(pair); return (await wait(db.transaction(['meta']).objectStore('meta').get('meta'))) || null; }
  catch { return null; }
}

async function remove(pair) {
  const db = await openDb(pair);
  const names = ['meta', 'entries', 'phrases', 'forms', 'gloss'];
  const tx = db.transaction(names, 'readwrite');
  names.forEach(n => tx.objectStore(n).clear());
  await done(tx);
}

async function byLookup(db, storeName, key) {
  return wait(db.transaction([storeName]).objectStore(storeName).index('lookup').getAll(key));
}
async function byKey(db, storeName, key) {
  return wait(db.transaction([storeName]).objectStore(storeName).get(key));
}

const POS_ORDER = ['noun', 'verb', 'adj', 'adjective', 'adv', 'adverb', 'pron', 'prep', 'conj', 'intj', 'article', 'particle', 'num', 'name', 'phrase', 'prep_phrase', 'character'];
const posRank = p => { const i = POS_ORDER.indexOf(p); return i < 0 ? 99 : i; };

/**
 * Look a word up. Returns null when the needed pack is not installed.
 * { query, lang, pair, groups: [{ pos, entries: [{ headword, meanings, example, forms, viaForm? }] }],
 *   extra: [{ headword, source: 'reverse' }]   // lower-ranked meanings found through the other pack
 *   phrases: [...] }                           // idioms / phrases that contain or equal the word
 */
async function lookup(word, options = {}) {
  const lang = options.lang || detectLang(word);
  const pair = PAIRS[lang], info = PAIR_INFO[pair];
  const meta = await status(pair);
  if (!meta) return null;
  const db = await openDb(pair);
  const norm = normalize(word, lang);
  if (!norm) return { query: word, lang, pair, groups: [], extra: [], phrases: [] };
  const found = [];
  const seen = new Set();
  const take = (list, via) => list.forEach(e => {
    const key = e.lookup + '|' + e.pos + '|' + e.meanings.join(';');
    if (seen.has(key)) return; seen.add(key);
    found.push(Object.assign({}, e, via ? { viaForm: via } : {}));
  });
  take(await byLookup(db, 'entries', norm));
  // Inflected forms: "ran" -> run, "mice" -> mouse. Shown after the exact matches, with the form's tags.
  const f = await byKey(db, 'forms', norm);
  if (f) for (const head of f.heads) {
    const list = await byLookup(db, 'entries', head);
    const tags = (list[0] && list[0].forms.find(x => normalize(x.form, lang) === norm) || {}).tags || [];
    take(list, { form: word, tags });
  }
  const groups = [];
  for (const e of found) {
    let g = groups.find(x => x.pos === e.pos);
    if (!g) { g = { pos: e.pos, entries: [] }; groups.push(g); }
    g.entries.push({ headword: e.headword, meanings: e.meanings, example: e.example, forms: e.forms, viaForm: e.viaForm || null });
  }
  groups.sort((a, b) => posRank(a.pos) - posRank(b.pos));

  // More coverage without new data: the other pack says which of its words mean this one.
  const extra = [];
  const other = PAIRS[info.to];
  if (other && (await status(other))) {
    const odb = await openDb(other);
    const g = await byKey(odb, 'gloss', norm);
    if (g) {
      const have = new Set(found.flatMap(e => e.meanings.flatMap(m => glossesOf(m).concat([m]).map(x => normalize(x, info.to)))));
      for (const head of g.heads) {
        if (have.has(normalize(head, info.to))) continue;
        const es = await byLookup(odb, 'entries', head);
        if (es[0]) extra.push({ headword: es[0].headword, pos: es[0].pos, source: 'reverse' });
      }
    }
  }
  const phrases = await phrasesFor(db, norm, lang);
  return { query: word, lang, pair, groups, extra, phrases };
}

async function phrasesFor(db, norm, lang) {
  const exact = await byLookup(db, 'phrases', norm);
  const out = exact.map(p => ({ headword: p.headword, pos: p.pos, meanings: p.meanings, example: p.example, exact: true }));
  if (norm.indexOf(' ') < 0 && norm.length > 1) {
    // Phrases that contain this single word (whole word), a few of them, for the idioms section.
    const all = await wait(db.transaction(['phrases']).objectStore('phrases').getAll());
    for (const p of all) {
      if (out.length >= 12) break;
      if (p.lookup !== norm && (' ' + p.lookup + ' ').includes(' ' + norm + ' ')) out.push({ headword: p.headword, pos: p.pos, meanings: p.meanings, example: p.example, exact: false });
    }
  }
  return out;
}

// For selected text of several words: the idiom or phrase entry that is exactly this text, if any.
async function lookupPhrase(text, options = {}) {
  const lang = options.lang || detectLang(text);
  const pair = PAIRS[lang];
  if (!(await status(pair))) return null;
  const db = await openDb(pair);
  const norm = normalize(text.replace(/[.,!?;:،؛؟"“”]+$/g, ''), lang);
  const exact = await byLookup(db, 'phrases', norm);
  if (!exact.length) return null;
  const p = exact[0];
  return { headword: p.headword, pos: p.pos, meanings: p.meanings, example: p.example, lang, pair };
}

root.MakanDict = { PAIRS, PAIR_INFO, normalize, detectLang, install, status, remove, lookup, lookupPhrase, glossesOf };
if (typeof module !== 'undefined' && module.exports) module.exports = root.MakanDict;
})(typeof self !== 'undefined' ? self : this);
