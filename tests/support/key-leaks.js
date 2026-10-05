'use strict';
/**
 * Helpers to prove that an API key only ever travels to its own provider.
 *
 * Every provider gets its own, different key (stub-valid-key-gemini, ...), so
 * a key arriving at the wrong host is detectable. The stub records every
 * request the browser makes (to the app's own server and to the provider
 * imitations), including headers and body.
 */
const { VALID_KEY } = require('./stub-server');

/** Which hosts a key is allowed to reach. */
const PROVIDER_HOSTS = {
  gemini: ['generativelanguage.googleapis.com'],
  groq: ['api.groq.com'],
  openrouter: ['openrouter.ai'],
  mistral: ['api.mistral.ai'],
  cerebras: ['api.cerebras.ai'],
  openai: ['api.openai.com'],
  claude: ['api.anthropic.com']
};

/** One distinct key per provider. */
const KEYS = Object.fromEntries(Object.keys(PROVIDER_HOSTS).map(id => [id, `${VALID_KEY}-${id}`]));

/**
 * Look through every recorded request. Returns a list of plain-language
 * problems: a key sent to a host that is not its provider, or any key that
 * appears in a web address (addresses end up in logs, history and caches).
 */
function findKeyLeaks(stub, keys = KEYS) {
  const problems = [];
  const seen = new Set();
  for (const e of stub.log) {
    const addr = `${e.path}${e.query}`;
    const headers = JSON.stringify(e.headers || {});
    for (const [id, key] of Object.entries(keys)) {
      const where = [];
      if (addr.includes(key)) where.push('in the web address');
      if (headers.includes(key)) where.push('in a header');
      if ((e.body || '').includes(key)) where.push('in the request body');
      if (!where.length) continue;
      const allowed = PROVIDER_HOSTS[id] || [];
      const toWrongHost = !allowed.includes(e.host);
      const inUrl = where.includes('in the web address');
      if (!toWrongHost && !inUrl) continue;
      const msg = `${id} key ${where.join(' and ')}: ${e.method} ${e.host}${e.path}` + (toWrongHost ? '  (not that key\'s provider)' : '');
      if (!seen.has(msg)) { seen.add(msg); problems.push(msg); }
    }
  }
  return problems;
}

/** Look for a key inside arbitrary text (console output, messages, cache entries). */
function findKeysInText(label, text, keys = KEYS) {
  return Object.entries(keys).filter(([, k]) => String(text).includes(k)).map(([id]) => `${id} key found in ${label}`);
}

module.exports = { PROVIDER_HOSTS, KEYS, findKeyLeaks, findKeysInText };
