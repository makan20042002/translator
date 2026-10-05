'use strict';
/**
 * Fixtures for the extension tests: a fresh Chromium profile per test with
 * the unpacked extension loaded (see extension.js for how).
 *
 * Options (test.use({ extOptions: ... })):
 *   preOpen: paths on the test site to open BEFORE the extension is loaded
 *            (default: ['/__test/article.html'])
 *   config:  settings merged into the extension's stored settings after
 *            install (test setup only; the options-page tests use the UI)
 */
const { test: base, expect, watchConsole, VALID_KEY, BAD_KEY } = require('./fixtures');
const { prepareTestCopy, launchWithExtension, openRealPopup, inShadow, dragSelect } = require('./extension');

const test = base.extend({
  extOptions: [{}, { option: true }],

  extCopy: [async ({}, use) => { await use(prepareTestCopy()); }, { scope: 'worker' }],

  ext: async ({ stub, files, extCopy, extOptions }, use) => {
    stub.clearLog();
    stub.resetModes();
    const preOpen = (extOptions.preOpen || ['/__test/article.html']).map(p => stub.appOrigin + p);
    const ext = await launchWithExtension({ stub, files, preOpen, extPath: extCopy });
    if (extOptions.config) {
      await ext.patchConfig(extOptions.config);
      // Pages read settings when they load; reload the pre-opened ones.
      for (const p of ext.opened) await p.reload();
    }
    ext.pageErrors = [];
    for (const p of ext.opened) watchConsole(p, ext.pageErrors);
    ext.article = ext.opened[0];
    if (ext.article) await ext.article.bringToFront();
    await use(ext);
    await ext.close();
  }
});

/**
 * Run an expression inside the extension's content-script world on `page`
 * (the private JavaScript world Chrome gives extensions on each web page).
 */
async function inContentScriptWorld(ext, page, expression) {
  const s = await ext.context.newCDPSession(page);
  const contexts = [];
  s.on('Runtime.executionContextCreated', e => contexts.push(e.context));
  await s.send('Runtime.enable');
  await new Promise(r => setTimeout(r, 200));
  const ctx = contexts.find(c => c.auxData?.type === 'isolated' && c.auxData?.isDefault === false &&
    (String(c.origin).includes(ext.id) || c.name === 'MAKAN Translate'));
  if (!ctx) throw new Error('content-script world not found; contexts: ' + contexts.map(c => `${c.name}|${c.origin}|${JSON.stringify(c.auxData)}`).join(', '));
  const r = await s.send('Runtime.evaluate', { expression, contextId: ctx.id, returnByValue: true, awaitPromise: true });
  await s.detach();
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

/**
 * Real mouse press-and-release on the M button, after a human-like pause
 * (people need ~300 ms to see the button and move to it; pressing within a
 * few milliseconds can hit a button the page is about to replace).
 */
async function pressM(page) {
  const m = inShadow(page, '.makan-btn-float');
  await expect(m).toBeVisible();
  await page.waitForTimeout(300);
  await expect(m).toHaveCount(1);
  const b = await m.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.up();
}

/** Real double-click in the middle of the text of an element (on the word itself, not empty space). */
async function dblclickText(page, selector) {
  const r = await page.evaluate(sel => {
    const range = document.createRange();
    range.selectNodeContents(document.querySelector(sel));
    const b = range.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  }, selector);
  await page.mouse.dblclick(r.x, r.y);
}

/** Real right-button press on an element (no native menu appears in automation). */
async function rightClick(page, selector) {
  const b = await page.locator(selector).boundingBox();
  await page.mouse.click(b.x + Math.min(30, b.width / 2), b.y + b.height / 2, { button: 'right' });
  await page.waitForTimeout(150);
}

async function expectNoExtensionErrors(ext) {
  const info = await ext.chromeReportedErrors();
  expect(info.state).toBe('ENABLED');
  expect({ runtimeErrors: info.runtimeErrors, manifestErrors: info.manifestErrors }, 'errors listed for the extension on chrome://extensions').toEqual({ runtimeErrors: [], manifestErrors: [] });
}

module.exports = { test, expect, inShadow, dragSelect, dblclickText, pressM, rightClick, openRealPopup, inContentScriptWorld, expectNoExtensionErrors, VALID_KEY, BAD_KEY };
