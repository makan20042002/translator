/**
 * MAKAN Translate - Translation Memory Store
 * Local, offline-first translation cache backed by IndexedDB.
 * Text tab only. Never stores API keys, tokens, or engine settings.
 */
(function (root) {
  'use strict';

  const DB_NAME = 'makan-translation-memory';
  const DB_VERSION = 1;
  const STORE_NAME = 'translations';

  function normalizeText(text) {
    return String(text == null ? '' : text)
      .trim()
      .replace(/\s+/g, ' ');
  }

  function hashText(str) {
    let h1 = 0xdeadbeef ^ 0, h2 = 0x41c64e6d ^ 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
  }

  function normalizeTone(tone) {
    return String(tone || '').trim().toLowerCase();
  }

  function normalizeSubject(subject) {
    return String(subject || '').trim().toLowerCase();
  }

  function normalizeModeClass(modeClass) {
    const m = String(modeClass || '').trim().toLowerCase();
    return m === 'smart' ? 'smart' : 'fast';
  }

  function buildKey(params) {
    const text = normalizeText(params.text != null ? params.text : params.sourceText);
    const hasher = (typeof TranslationMemory !== 'undefined' && TranslationMemory.hashText) || hashText;
    const textHash = hasher(text);
    const src = String(params.src || '').trim().toLowerCase();
    const tgt = String(params.tgt || '').trim().toLowerCase();
    const modeClass = normalizeModeClass(params.modeClass);
    const tone = normalizeTone(params.tone);
    const subject = normalizeSubject(params.subject);

    return {
      key: `${textHash}:${src}:${tgt}:${modeClass}:${tone}:${subject}`,
      keyParts: {
        textHash,
        src,
        tgt,
        modeClass,
        tone,
        subject
      },
      normalizedText: text
    };
  }

  let dbPromise = null;
  function getDb() {
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          dbPromise = null;
          resolve(null);
        };
      } catch (e) {
        dbPromise = null;
        resolve(null);
      }
    });
    return dbPromise;
  }

  async function get(params) {
    if (!params) return null;
    const { key, normalizedText } = buildKey(params);
    const db = await getDb();
    if (!db) return null;

    return new Promise(resolve => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => {
          const record = req.result;
          if (!record) return resolve(null);
          // Collision check: verify stored normalized source text matches requested text
          if (normalizeText(record.sourceText) !== normalizedText) {
            return resolve(null);
          }
          // Update lastUsed timestamp
          const now = Date.now();
          record.lastUsed = now;
          try {
            store.put(record);
          } catch (_) {}
          resolve(record);
        };
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  async function put(entry) {
    if (!entry) return null;
    const sourceText = String(entry.sourceText != null ? entry.sourceText : (entry.text || ''));
    const translatedText = String(entry.translatedText != null ? entry.translatedText : (entry.translation || ''));
    if (!sourceText.trim() || !translatedText.trim()) return null;

    const { key, keyParts } = buildKey(entry);
    const db = await getDb();
    if (!db) return null;

    const now = Date.now();
    const record = {
      key,
      textHash: keyParts.textHash,
      src: keyParts.src,
      tgt: keyParts.tgt,
      modeClass: keyParts.modeClass,
      tone: keyParts.tone,
      subject: keyParts.subject,
      sourceText,
      translatedText,
      timestamp: entry.timestamp || now,
      lastUsed: now
    };

    return new Promise(resolve => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(record);
        req.onsuccess = () => resolve(record);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  async function count() {
    const db = await getDb();
    if (!db) return 0;
    return new Promise(resolve => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.count();
        req.onsuccess = () => resolve(req.result || 0);
        req.onerror = () => resolve(0);
      } catch (e) {
        resolve(0);
      }
    });
  }

  async function clear() {
    const db = await getDb();
    if (!db) return true;
    return new Promise(resolve => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  const TranslationMemory = {
    normalizeText,
    hashText,
    buildKey,
    get,
    put,
    count,
    clear,
    _getDb: getDb
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TranslationMemory;
  }
  root.TranslationMemory = TranslationMemory;
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
