'use strict';
// No script may be loaded from another website unless it is on the allow-list below.
// Code loaded from outside runs with the same access as the app itself: it can read the API keys
// saved for the site. Every entry here is a decision the owner has made on purpose.
const { test, expect, onlyEngines, mouseClick, chooseFile } = require('../support/fixtures');

const ALLOWED_EXTERNAL_SCRIPTS = [
  // The offline translation and speech models run inside a worker (a separate thread that cannot read
  // the saved settings or keys). The library is pinned to one version.
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1'
];

const isAllowed = url => ALLOWED_EXTERNAL_SCRIPTS.some(prefix => url === prefix || url.startsWith(prefix + '/') || url.startsWith(prefix + '?'));

test.describe('Web app: scripts loaded from other websites', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

  test('only scripts on the explicit allow-list are loaded from another host', async ({ app, files }) => {
    test.setTimeout(90_000);
    const { page, context, stub } = app;
    const scripts = [];
    context.on('request', r => {
      const u = new URL(r.url());
      const external = u.origin !== new URL(stub.appOrigin).origin && !['data:', 'blob:', 'about:'].includes(u.protocol);
      const looksLikeScript = r.resourceType() === 'script' || /\.m?js$/i.test(u.pathname);
      if (external && looksLikeScript) scripts.push(r.url());
    });

    // Everything in the app that loads code: every tab, the settings window, and a Word file (needs JSZip).
    for (const tab of ['sub', 'doc', 'voice', 'cmp', 'gls', 'hist', 'text']) await mouseClick(page, page.locator(`#tabs button[data-tab="${tab}"]`));
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await chooseFile(page, page.locator('#dDrop'), files.docx);
    await expect(page.locator('#dWork')).toBeVisible();
    await expect(page.locator('#dInfo')).toHaveText(/\d+ segments/);
    // Starting the offline model download loads the worker library.
    await mouseClick(page, page.locator('#openSet'));
    await require('../support/fixtures').activateSettingsTab(page, 'trModels');
    await mouseClick(page, page.locator('#dlTr'));
    await page.waitForTimeout(2500);

    const notAllowed = [...new Set(scripts)].filter(u => !isAllowed(u));
    expect(notAllowed, 'scripts loaded from another host that are not on the allow-list').toEqual([]);
  });

  test('the page itself has no <script src> pointing at another host', async ({ app, stub }) => {
    const { page } = app;
    const srcs = await page.evaluate(() => [...document.querySelectorAll('script[src]')].map(s => s.src));
    const external = srcs.filter(u => new URL(u).origin !== new URL(stub.appOrigin).origin && !isAllowed(u));
    expect(external).toEqual([]);
  });
});

test.describe('Extension: scripts loaded from other websites', () => {
  test('the extension\'s pages load only their own scripts', async () => {
    const fs = require('fs'), path = require('path');
    const dir = path.resolve(__dirname, '../../extension');
    const offenders = [];
    for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.html'))) {
      for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/<script[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
        if (/^(https?:)?\/\//i.test(m[1])) offenders.push(`${f}: ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
