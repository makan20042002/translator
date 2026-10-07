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
    const req = indexedDB.open('makan-dict-' + pair, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const n of Array.from(db.objectStoreNames)) db.deleteObjectStore(n);
      db.createObjectStore('meta');
      db.createObjectStore('chunks', { autoIncrement: true }); // whole chunk files: few, big records install fast
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
  return String(meaning || '').split(/[;,\u060c\u061b()]/).map(x => x.trim()).filter(x => x && x.length <= 32 && x.split(/\s+/).length <= 3);
}

const memory = {}; // pair -> indexes built from the stored chunks (kept for the session)

async function install(pair, { getBytes, onProgress } = {}) {
  const info = PAIR_INFO[pair];
  if (!info) throw new Error('unknown dictionary pack: ' + pair);
  if (typeof getBytes !== 'function') throw new Error('no way to read the dictionary pack');
  const packMeta = JSON.parse(new TextDecoder().decode(await getBytes('pack.json')));
  const files = packMeta.files || [];
  const db = await openDb(pair);
  delete memory[pair];
  // Read everything first, then replace the old copy in one step, so a failed download leaves the old pack intact.
  const chunks = [];
  let entries = 0, phrases = 0;
  for (let i = 0; i < files.length; i++) {
    const data = await gunzipJson(await getBytes(files[i]));
    const isPhrase = data.type === 'phrases-chunk' || /^phrases/.test(files[i]);
    chunks.push({ phrases: isPhrase, entries: (data.entries || []).map(e => ({ headword: e.headword, lookup: e.lookup, pos: e.pos, meanings: e.meanings || [], example: e.example || null, forms: e.forms || [] })) });
    if (isPhrase) phrases += chunks[chunks.length - 1].entries.length; else entries += chunks[chunks.length - 1].entries.length;
    if (onProgress) onProgress((i + 1) / (files.length + 1));
  }
  const meta = { pair, entries, phrases, version: packMeta.generated_at || '', installedAt: Date.now() };
  const tx = db.transaction(['meta', 'chunks'], 'readwrite');
  tx.objectStore('meta').clear();
  const store = tx.objectStore('chunks');
  store.clear();
  chunks.forEach(c => store.add(c));
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
  delete memory[pair];
  const tx = db.transaction(['meta', 'chunks'], 'readwrite');
  tx.objectStore('meta').clear();
  tx.objectStore('chunks').clear();
  await done(tx);
}

// Indexes: headword -> entries, inflected form -> headwords, short gloss -> headwords, phrases.
async function load(pair) {
  if (memory[pair]) return memory[pair];
  memory[pair] = (async () => {
    const info = PAIR_INFO[pair];
    const db = await openDb(pair);
    const chunks = await wait(db.transaction(['chunks']).objectStore('chunks').getAll());
    const m = { entries: new Map(), forms: new Map(), gloss: new Map(), phrases: [], phraseByLookup: new Map() };
    const push = (map, k, v) => { const a = map.get(k); if (a) a.push(v); else map.set(k, [v]); };
    const addHead = (map, k, head) => { if (!k) return; const a = map.get(k); if (!a) map.set(k, [head]); else if (a.length < 8 && !a.includes(head)) a.push(head); };
    for (const c of chunks) for (const e of c.entries) {
      if (c.phrases) { m.phrases.push(e); push(m.phraseByLookup, e.lookup, e); continue; }
      push(m.entries, e.lookup, e);
      for (const f of e.forms) addHead(m.forms, normalize(f.form, info.from), e.lookup);
      for (const g of e.meanings) for (const x of glossesOf(g)) addHead(m.gloss, normalize(x, info.to), e.lookup);
    }
    return m;
  })().catch(e => { delete memory[pair]; throw e; });
  return memory[pair];
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
  const mem = await load(pair);
  const norm = normalize(word, lang);
  if (!norm) return { query: word, lang, pair, groups: [], extra: [], phrases: [] };
  const found = [];
  const seen = new Set();
  const take = (list, via) => list.forEach(e => {
    const key = e.lookup + '|' + e.pos + '|' + e.meanings.join(';');
    if (seen.has(key)) return; seen.add(key);
    found.push(Object.assign({}, e, via ? { viaForm: via } : {}));
  });
  take(mem.entries.get(norm) || []);
  // Inflected forms: "ran" -> run, "mice" -> mouse. Shown after the exact matches, with the form's tags.
  const f = mem.forms.get(norm);
  if (f) for (const head of f) {
    const list = mem.entries.get(head) || [];
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
    const omem = await load(other);
    const g = omem.gloss.get(norm);
    if (g) {
      const have = new Set(found.flatMap(e => e.meanings.flatMap(m => glossesOf(m).concat([m]).map(x => normalize(x, info.to)))));
      for (const head of g) {
        if (have.has(normalize(head, info.to))) continue;
        const es = omem.entries.get(head) || [];
        if (es[0]) extra.push({ headword: es[0].headword, pos: es[0].pos, source: 'reverse' });
      }
    }
  }
  const phrases = phrasesFor(mem, norm);
  return { query: word, lang, pair, groups, extra, phrases };
}

function phrasesFor(mem, norm) {
  const out = (mem.phraseByLookup.get(norm) || []).map(p => ({ headword: p.headword, pos: p.pos, meanings: p.meanings, example: p.example, exact: true }));
  if (norm.indexOf(' ') < 0 && norm.length > 1) {
    // Phrases that contain this single word (whole word), a few of them, for the idioms section.
    for (const p of mem.phrases) {
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
  const mem = await load(pair);
  const norm = normalize(text.replace(/[.,!?;:،؛؟"“”]+$/g, ''), lang);
  const exact = mem.phraseByLookup.get(norm) || [];
  if (!exact.length) return null;
  const p = exact[0];
  return { headword: p.headword, pos: p.pos, meanings: p.meanings, example: p.example, lang, pair };
}

root.MakanDict = { PAIRS, PAIR_INFO, normalize, detectLang, install, status, remove, lookup, lookupPhrase, glossesOf };
if (typeof module !== 'undefined' && module.exports) module.exports = root.MakanDict;
})(typeof self !== 'undefined' ? self : this);
