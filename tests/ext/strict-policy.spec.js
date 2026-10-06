'use strict';
// A page with a very strict Content-Security-Policy (like addons.mozilla.org): the card must still work.
const { test, expect, inShadow, dragSelect, pressM, openRealPopup } = require('../support/ext-fixtures');

test.describe('Extension on a page with a strict Content-Security-Policy', () => {
  test.use({ extOptions: { preOpen: ['/__test/strict.html'] } });

  test('the test page really has the strict policy', async ({ ext }) => {
    const csp = await ext.article.evaluate(async () => (await fetch(location.href)).headers.get('content-security-policy'));
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("connect-src 'self'");
  });

  test('the card opens, is styled, and translates', async ({ ext }) => {
    const page = ext.article;
    const violations = [];
    await page.exposeFunction('__csp', v => violations.push(v));
    await page.evaluate(() => document.addEventListener('securitypolicyviolation', e => window.__csp(`${e.violatedDirective} ${e.blockedURI}`)));
    await dragSelect(page, '#li1');
    await pressM(page);
    await expect(inShadow(page, '.makan-result-text')).toHaveText('[fa] First item in the list of things.', { timeout: 15_000 });
    // Styled: the card is a floating box with a visible background, not unstyled text.
    const pos = await inShadow(page, '.makan-card').evaluate(el => getComputedStyle(el).position);
    expect(pos, 'card styles were applied').toBe('absolute');
    expect(violations, 'policy violations seen by the page').toEqual([]);
  });
});

test.describe('Extension failures always say why (strict page)', () => {
  test.use({ extOptions: { preOpen: ['/__test/strict.html'] } });

  test('the card is styled without any <link> or <style> element the policy could refuse', async ({ ext }) => {
    const page = ext.article;
    await dragSelect(page, '#li1');
    await pressM(page);
    await expect(inShadow(page, '.makan-result-text')).toBeVisible({ timeout: 15_000 });
    const inShadowRoot = await page.evaluate(() => {
      const root = document.querySelector('#makan-translate-root').shadowRoot;
      return { links: root.querySelectorAll('link').length, styles: root.querySelectorAll('style').length, inlineStyleAttrs: root.querySelectorAll('[style]').length, adopted: root.adoptedStyleSheets.length };
    });
    expect(inShadowRoot.links, 'link elements').toBe(0);
    expect(inShadowRoot.styles, 'style elements').toBe(0);
    expect(inShadowRoot.adopted, 'constructable stylesheets').toBe(1);
  });

  test('every engine unreachable: the card names the reason instead of a bare "Translation failed"', async ({ ext, stub }) => {
    for (const h of ['clients5.google.com', 'translate.googleapis.com', 'api.mymemory.translated.net']) stub.failHost(h, 'drop');
    const page = ext.article;
    await dragSelect(page, '#li1');
    await pressM(page);
    const body = inShadow(page, '.makan-card-body');
    await expect(body).toContainText(/unreachable|network/i, { timeout: 20_000 });
    expect((await body.textContent()).trim()).not.toBe('⚠️ Translation failed');
  });
});

test.describe('Extension failures: reasons and Open Options', () => {
  test('key missing in Smart mode shows the reason and a button that opens Options', async ({ ext }) => {
    await ext.patchConfig({ order: ['gemini'], transMode: 'smart', eng: { gemini: { on: true, key: '' }, ollama: { on: false }, google: { on: false }, mymemory: { on: false } } });
    const page = ext.article;
    await page.reload();
    await dragSelect(page, '#li1');
    await pressM(page);
    await inShadow(page, '#makanModeSel').selectOption('smart');
    await expect(inShadow(page, '.makan-card-body')).toContainText('key missing');
    const optionsOpened = ext.context.waitForEvent('page', { timeout: 10_000 });
    await inShadow(page, '#makanErrOptions').click();
    const opts = await optionsOpened;
    await opts.waitForLoadState();
    expect(opts.url()).toContain('options.html');
  });

  test('the popup shows a reason too, and an Open Options button for fixable ones', async ({ ext }) => {
    await ext.patchConfig({ order: ['gemini'], eng: { gemini: { on: true, key: '' }, ollama: { on: false }, google: { on: false }, mymemory: { on: false } }, transMode: 'smart' });
    const popup = await openRealPopup(ext);
    await popup.click('#pInputText');
    await popup.eval(`document.getElementById('pInputText').value = 'Hello'`);
    await popup.click('#pTransBtn');
    await popup.waitFor(`/key missing/.test(document.getElementById('pOutputText').textContent)`);
    expect(await popup.eval(`!!document.getElementById('pErrOptions')`)).toBe(true);
    await popup.close();
  });

  test('popup on a browser-internal page says in one line that extensions are not allowed', async ({ ext }) => {
    const internal = await ext.context.newPage();
    await internal.goto('chrome://version');
    await internal.bringToFront();
    const popup = await openRealPopup(ext);
    const text = await popup.eval(`(() => { const b = document.getElementById('pRestricted'); return b.hidden ? '' : b.textContent.trim(); })()`);
    expect(text).toMatch(/doesn't allow extensions on this page/);
    await popup.close();
  });
});

test.describe('Options: diagnostics, reset, and the self-check', () => {
  async function openOptions(ext) {
    const page = await ext.context.newPage();
    await page.goto(ext.url('options.html'));
    await expect(page.locator('#optEngineList .opt-eng-row').first()).toBeVisible();
    return page;
  }

  test('"Copy diagnostics" copies a report with yes/no for keys and never a key', async ({ ext }) => {
    await ext.patchConfig({ eng: { gemini: { on: true, key: 'AQ.diagnostics-secret-value-123456' } } });
    const page = await openOptions(ext);
    // Catch what is written to the clipboard (extension pages cannot be granted clipboard permission in a test).
    await page.evaluate(() => { window.__copied = ''; navigator.clipboard.writeText = async t => { window.__copied = t; }; });
    await page.locator('#btnCopyDiagnostics').click();
    await expect(page.locator('#optToasts')).toContainText('Diagnostics copied');
    const report = await page.evaluate(() => window.__copied);
    expect(report).toMatch(/MAKAN Translate extension \d/);
    expect(report).toMatch(/Browser: .*Chrome/);
    expect(report).toMatch(/Google Gemini: on, key: yes, model: /);
    expect(report).toMatch(/OpenAI: .*key: no/);
    expect(report).not.toContain('diagnostics-secret-value');
  });

  test('"Reset extension settings" needs a second click and then erases the settings and keys', async ({ ext }) => {
    await ext.patchConfig({ eng: { gemini: { on: true, key: 'AQ.reset-me-123456789' } }, tgt: 'de' });
    const page = await openOptions(ext);
    await page.locator('#btnResetSettings').click();
    expect((await ext.getConfig()).eng.gemini.key, 'one click must not erase').toBe('AQ.reset-me-123456789');
    await page.locator('#btnResetSettings').click();
    await expect.poll(async () => { const c = await ext.getConfig(); return c ? [c.tgt, c.eng?.gemini?.key || ''] : null; }).toBeNull();
  });

  test('the Site Compatibility Self-Check looks at the web page, not at the Options page', async ({ ext }) => {
    await ext.article.bringToFront();
    const page = await openOptions(ext);
    await page.locator('#btnRefreshSiteCheck').click();
    await expect(page.locator('#siteCheckBadge')).toHaveText('Active & Ready', { timeout: 10_000 });
    await expect(page.locator('#siteCheckUrl')).toContainText('/__test/article.html');
  });
});

test.describe('What a strict page policy governs is not used by the on-page code', () => {
  const fs = require('fs'), path = require('path');
  const read = f => fs.readFileSync(path.join(__dirname, '..', '..', 'extension', f), 'utf8');

  test('content.js makes no network call, plays no audio, and writes no inline style markup; content.css loads nothing', () => {
    const js = read('content.js');
    expect(js, 'fetch from the page').not.toMatch(/\bfetch\s*\(/);
    expect(js, 'XMLHttpRequest').not.toMatch(/XMLHttpRequest|WebSocket|sendBeacon/);
    expect(js, 'audio played by the page').not.toMatch(/new Audio\s*\(/);
    expect(js, 'inline style attributes in markup').not.toMatch(/style="/);
    expect(js, '<style> elements').not.toMatch(/createElement\(['"]style['"]\)|<style[ >]\s*[^\s]*\s*<\/style>|`<style/);
    const css = read('content.css');
    expect(css, 'images, fonts or imports').not.toMatch(/url\(|@import|@font-face/);
  });
});
