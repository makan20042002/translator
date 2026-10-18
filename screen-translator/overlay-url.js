'use strict';

/**
 * Builds the Web App URL for opening a translation in an external browser.
 * Format matches the Web App fragment format: base/#text=...&src=...&tgt=...
 *
 * @param {Object} payload - Translation payload { text, src, tgt }
 * @param {string} [webAppUrl='https://makanlab.tech/'] - Base web app URL
 * @returns {string} The formatted URL with hash parameters
 */
function buildBrowserUrl(payload, webAppUrl = 'https://makanlab.tech/') {
  const base = String(webAppUrl || 'https://makanlab.tech/').replace(/\/+$/, '');
  const params = new URLSearchParams();
  if (payload && typeof payload === 'object') {
    if (typeof payload.text === 'string' && payload.text.trim()) {
      params.set('text', payload.text.trim().slice(0, 4000));
    }
    if (typeof payload.src === 'string' && /^[a-zA-Z-]{2,10}$/.test(payload.src)) {
      params.set('src', payload.src);
    }
    if (typeof payload.tgt === 'string' && /^[a-zA-Z-]{2,10}$/.test(payload.tgt)) {
      params.set('tgt', payload.tgt);
    }
  }
  const hash = params.toString();
  return hash ? `${base}/#${hash}` : base;
}

module.exports = {
  buildBrowserUrl
};
