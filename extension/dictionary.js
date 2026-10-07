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

// The packs on offer come from a small generated list (dict/packs.json, made by build-dict-list.js from the folders
// under dict/). setPacks() takes that list; nothing about English or Persian is wired in here.
const PAIR_INFO = {};   // id -> { id, from, to, entries, phrases, bytes, dir, credits }
function setPacks(list) {
  for (const k of Object.keys(PAIR_INFO)) delete PAIR_INFO[k];
  for (const p of list || []) if (p && p.id && p.from && p.to) PAIR_INFO[p.id] = Object.assign({}, p);
}
const pairFor = (from, to) => (PAIR_INFO[from + '-' + to] ? from + '-' + to : null);
const reverseOf = pair => PAIR_INFO[pair] ? pairFor(PAIR_INFO[pair].to, PAIR_INFO[pair].from) : null;

// Words are looked up lower-cased; Persian additionally gets the normalisation the pack builder used for Persian:
// Arabic ye / alef maksura and kaf to the Persian letters, no zero-width non-joiner, no tatweel, no diacritics.
// Other languages (Arabic, German, ...) are NOT changed beyond case.
function normalize(word, lang) {
  let s = String(word == null ? '' : word).normalize('NFC').trim().replace(/\s+/g, ' ');
  s = s.toLowerCase();
  if (lang === 'fa') {
    s = s.replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\u200c\u0640]/g, '');
    s = s.replace(/\p{Mn}/gu, '');
  } else if (lang === 'en') {
    s = s.replace(/[\u2019\u2018]/g, "'");
  }
  return s;
}

// Arabic-script text: Persian if it has Persian-only letters, otherwise Arabic when an Arabic pack exists. Latin text: English first.
function scriptOf(text) {
  return /[\u0600-\u06ff\u0750-\u077f\ufb50-\ufdff\ufe70-\ufeff]/.test(String(text || '')) ? 'arabic' : 'latin';
}
function detectLang(text, haveFrom) {
  if (scriptOf(text) === 'latin') return 'en';
  const have = haveFrom || Object.values(PAIR_INFO).map(p => p.from);
  if (/[\u067e\u0686\u0698\u06af\u06a9\u06cc]/.test(text) || !have.includes('ar')) return 'fa';
  return have.includes('fa') && !/[\u0629\u0649\u064a]/.test(text) ? 'fa' : 'ar';
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

// Indexes: headword -> entries, inflected form -> headwords, whole meaning -> headwords, phrases.
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
      // Only a WHOLE meaning counts for cross-filling ("dog" means exactly dog), never a piece of a longer text.
      for (const g of e.meanings) if (g.length <= 40) addHead(m.gloss, normalize(g, info.to), e.lookup);
    }
    return m;
  })().catch(e => { delete memory[pair]; throw e; });
  return memory[pair];
}

const POS_ORDER = ['noun', 'verb', 'adj', 'adjective', 'adv', 'adverb', 'pron', 'pronoun', 'prep', 'preposition', 'conj', 'conjunction', 'intj', 'interjection', 'article', 'particle', 'num', 'numeral', 'name', 'phrase', 'prep_phrase'];
const posRank = p => (p === 'character' ? 200 : (POS_ORDER.indexOf(p) < 0 ? 99 : POS_ORDER.indexOf(p)));

// Meanings that only say "this is a variant / dialect / old / misspelt form" come after the standard ones.
const VARIANT_RE = /\b(alternative (form|spelling)|variant|dialectal|dialect|colloquial|obsolete|archaic|dated|misspelling|nonstandard|unhamzated|eye dialect|pronunciation spelling|informal spelling|filter-avoidance|form of)\b/i;
function variantPenalty(e) {
  if ([...e.headword].length === 1 || e.pos === 'character') return 3;
  if (e.meanings.length && e.meanings.every(m => VARIANT_RE.test(m))) return 2;
  return 0;
}

// Words many people find vulgar or offensive. The packs carry no such flag, so this short list (normalised words)
// is what "Show vulgar words" switches. A headword on the list hides its entries; a meaning that is itself on the
// list (in the pack's target language) is hidden from other entries.
const VULGAR = {
  en: new Set(['fuck', 'fucker', 'motherfucker', 'shit', 'cunt', 'dick', 'cock', 'prick', 'pussy', 'bitch', 'bastard', 'whore', 'slut', 'asshole', 'arse', 'arsehole', 'piss', 'wank', 'wanker', 'twat', 'faggot', 'nigger', 'retard', 'bollocks', 'jerk off', 'blow job', 'son of a bitch']),
  fa: new Set(['کیر', 'کس', 'کص', 'کون', 'کونی', 'جنده', 'کسکش', 'کصکش', 'جاکش', 'مادرجنده', 'مادر جنده', 'گاییدن', 'گائیدن', 'گایید', 'گه', 'ریدن', 'ریدم', 'کیرم', 'کسخل', 'حرامزاده', 'خارکسه', 'مادرقحبه', 'لاشی', 'بیناموس', 'ننه جنده', 'کوس', 'کوص'])
};
const isVulgarWord = (text, lang) => !!(VULGAR[lang] && VULGAR[lang].has(normalize(text, lang)));
function cleanVulgar(entries, info) {
  const out = [];
  let hidden = 0;
  for (const e of entries) {
    if (isVulgarWord(e.headword, info.from)) { hidden++; continue; }
    const meanings = e.meanings.filter(m => !isVulgarWord(m, info.to) && !glossesOf(m).some(x => isVulgarWord(x, info.to)));
    if (!meanings.length) { hidden++; continue; }
    out.push(meanings.length === e.meanings.length ? e : Object.assign({}, e, { meanings }));
  }
  return { entries: out, hidden };
}

async function installedPairs() {
  const out = [];
  for (const id of Object.keys(PAIR_INFO)) if (await status(id)) out.push(id);
  return out;
}
// Which pack answers a word typed without choosing a language pair.
async function guessPair(text, hints = {}) {
  const have = await installedPairs();
  if (!have.length) return null;
  const from = detectLang(text, have.map(id => PAIR_INFO[id].from));
  const cands = have.filter(id => PAIR_INFO[id].from === from);
  if (!cands.length) return null;
  const pref = hints.to && cands.find(id => PAIR_INFO[id].to === hints.to);
  return pref || cands.find(id => PAIR_INFO[id].to === 'fa' || PAIR_INFO[id].to === 'en') || cands[0];
}

/**
 * Look a word up (options: pair, showVulgar, hints). Returns null when the needed pack is not installed.
 * { query, lang, pair, groups: [{ pos, entries: [{ headword, meanings, example, forms, viaForm? }] }],
 *   extra: [{ headword, source: 'reverse' }]   // last-ranked: the other pack has a word whose whole meaning is this word
 *   phrases: [...], hidden: n }                // hidden = entries left out because they are on the vulgar list
 */
async function lookup(word, options = {}) {
  const pair = options.pair || await guessPair(word, options.hints);
  if (!pair || !PAIR_INFO[pair]) return null;
  const info = PAIR_INFO[pair], lang = info.from;
  if (!(await status(pair))) return null;
  const mem = await load(pair);
  const norm = normalize(word, lang);
  if (!norm) return { query: word, lang, pair, from: info.from, to: info.to, groups: [], extra: [], phrases: [], hidden: 0 };
  let found = [];
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
  let hidden = 0;
  if (!options.showVulgar) { const c = cleanVulgar(found, info); found = c.entries; hidden = c.hidden; }
  // Standard meanings first inside an entry; variant-looking entries last.
  found = found.map(e => {
    const std = e.meanings.filter(m => !VARIANT_RE.test(m)), odd = e.meanings.filter(m => VARIANT_RE.test(m));
    return odd.length && std.length ? Object.assign({}, e, { meanings: [...std, ...odd] }) : e;
  });
  const groups = [];
  for (const e of found) {
    let g = groups.find(x => x.pos === e.pos);
    if (!g) { g = { pos: e.pos, entries: [], penalty: 9 }; groups.push(g); }
    g.penalty = Math.min(g.penalty, variantPenalty(e));
    g.entries.push({ headword: e.headword, meanings: e.meanings, example: e.example, forms: e.forms, viaForm: e.viaForm || null, penalty: variantPenalty(e) });
  }
  for (const g of groups) g.entries.sort((a, b) => a.penalty - b.penalty);
  groups.sort((a, b) => (a.penalty >= 2) - (b.penalty >= 2) || posRank(a.pos) - posRank(b.pos));
  groups.forEach(g => { delete g.penalty; g.entries.forEach(e => delete e.penalty); });

  // More coverage without new data, ranked last: a word of the other pack whose WHOLE meaning is the looked-up word.
  const extra = [];
  const other = reverseOf(pair);
  if (other && (await status(other))) {
    const omem = await load(other);
    const g = omem.gloss.get(norm);
    if (g) {
      const have = new Set(found.flatMap(e => e.meanings.map(m => normalize(m, info.to))));
      for (const head of g) {
        if (have.has(normalize(head, info.to))) continue;
        const es = omem.entries.get(head) || [];
        if (es[0] && !(!options.showVulgar && isVulgarWord(es[0].headword, info.to))) extra.push({ headword: es[0].headword, pos: es[0].pos, source: 'reverse' });
      }
    }
  }
  let phrases = phrasesFor(mem, norm);
  if (!options.showVulgar) phrases = phrases.filter(p => !isVulgarWord(p.headword, lang) && !p.headword.split(' ').some(w => isVulgarWord(w, lang)));
  if (!options.showVulgar && isVulgarWord(norm, lang)) {
    // The word itself is on the vulgar list: show nothing but the fact that something is hidden.
    return { query: word, lang, pair, from: info.from, to: info.to, groups: [], extra: [], phrases: [], hidden: Math.max(hidden, 1) };
  }
  return { query: word, lang, pair, from: info.from, to: info.to, groups, extra, phrases, hidden };
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
  const pair = options.pair || await guessPair(text, options.hints);
  if (!pair || !PAIR_INFO[pair] || !(await status(pair))) return null;
  const lang = PAIR_INFO[pair].from;
  const mem = await load(pair);
  const norm = normalize(text.replace(/[.,!?;:،؛؟"“”]+$/g, ''), lang);
  const exact = mem.phraseByLookup.get(norm) || [];
  if (!exact.length) return null;
  const p = exact[0];
  if (!options.showVulgar && (isVulgarWord(p.headword, lang) || p.headword.split(' ').some(w => isVulgarWord(w, lang)))) return null;
  return { headword: p.headword, pos: p.pos, meanings: p.meanings, example: p.example, lang, pair, to: PAIR_INFO[pair].to };
}

// Every phrase of the installed pack for a language, for marking idioms inside a text (longest match wins).
async function phraseIndex(pair, options = {}) {
  if (!pair || !PAIR_INFO[pair] || !(await status(pair))) return null;
  const mem = await load(pair);
  const lang = PAIR_INFO[pair].from;
  return { lang, byLookup: mem.phraseByLookup, maxWords: 6 };
}

root.MakanDict = { PAIR_INFO, setPacks, pairFor, reverseOf, normalize, detectLang, scriptOf, install, status, remove, installedPairs, guessPair, lookup, lookupPhrase, phraseIndex, isVulgarWord, glossesOf };
if (typeof module !== 'undefined' && module.exports) module.exports = root.MakanDict;
})(typeof self !== 'undefined' ? self : this);
