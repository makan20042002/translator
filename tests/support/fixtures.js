'use strict';
/**
 * Shared Playwright fixtures.
 *
 *  stub        one set of local servers per test worker (see stub-server.js)
 *  files       paths of the generated sample files
 *  webBrowser  Chromium with all internet traffic sent to the stub and a fake
 *              microphone that plays tests/.generated/speech-like.wav
 *  app         a fresh browser profile with index.html open, plus a list of
 *              console errors and page crashes seen while the test ran
 */
const base = require('@playwright/test');
const { chromium } = require('@playwright/test');
const { startStub, chromiumNetworkArgs, VALID_KEY, BAD_KEY } = require('./stub-server');
const { makeFixtures } = require('./make-fixtures');

const expect = base.expect;

/** Console messages that are expected and harmless in this test setup. */
const IGNORED_CONSOLE = [
  // The browser's own network log line for any failed request (for example an
  // engine without a key answering 401, or Ollama not running). These are
  // expected during connection checks; the app's own errors are still caught.
  /^Failed to load resource: /
];

function watchConsole(page, sink) {
  page.on('console', msg => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (IGNORED_CONSOLE.some(r => r.test(text))) return;
    sink.push(`console.error: ${text}`);
  });
  page.on('pageerror', err => sink.push(`uncaught: ${err.message}`));
}

/** Settings a test can pre-load into the web app's storage before the page starts. */
function seedScript(seed) {
  // Applied once per tab (sessionStorage survives reloads), so a test can change
  // a setting and reload without the starting values being put back.
  return `(() => { try {
    if (sessionStorage.getItem('__makan_seeded')) return;
    sessionStorage.setItem('__makan_seeded', '1');
    const seed = ${JSON.stringify(seed || {})};
    for (const [k, v] of Object.entries(seed)) localStorage.setItem('mkt_' + k, JSON.stringify(v));
  } catch (e) {} })();`;
}

const test = base.test.extend({
  stub: [async ({}, use) => {
    const stub = await startStub();
    await use(stub);
    await stub.close();
  }, { scope: 'worker' }],

  files: [async ({}, use) => { await use(await makeFixtures()); }, { scope: 'worker' }],

  webBrowser: [async ({ stub, files }, use) => {
    const browser = await chromium.launch({
      channel: 'chromium',
      headless: true,
      args: [
        ...chromiumNetworkArgs(stub),
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        `--use-file-for-fake-audio-capture=${files.wav}`
      ]
    });
    await use(browser);
    await browser.close();
  }, { scope: 'worker' }],

  /**
   * Open the web app. Options (set with test.use({ appOptions: ... })):
   *   seed: values for localStorage keys without the "mkt_" prefix
   */
  appOptions: [{}, { option: true }],

  app: async ({ webBrowser, stub, appOptions }, use) => {
    const context = await webBrowser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
    await context.grantPermissions(['microphone', 'clipboard-read', 'clipboard-write'], { origin: stub.appOrigin });
    await context.route(/(localhost|127\.0\.0\.1|\[::1\]):11434/, route => route.abort());
    if (appOptions.seed) await context.addInitScript(seedScript(appOptions.seed));
    const page = await context.newPage();
    const errors = [];
    watchConsole(page, errors);
    stub.clearLog();
    stub.resetModes();
    await page.goto(stub.appUrl);
    await expect(page.locator('#tabs button').first()).toBeVisible();
    await use({ page, context, errors, stub });
    await context.close();
  }
});

/** Engines-and-keys settings that switch everything off except the listed engines. */
function onlyEngines(enabled, keys = {}) {
  const all = ['gemini', 'openrouter', 'mistral', 'cerebras', 'openai', 'claude', 'ollama', 'custom', 'chrome', 'google', 'mymemory', 'nllb', 'groq'];
  const eng = {};
  for (const id of all) eng[id] = { on: enabled.includes(id), key: keys[id] || '' };
  return { order: [...enabled, ...all.filter(id => !enabled.includes(id))], eng, mmEmail: '' };
}

/** Real mouse click on the middle of an element. */
async function mouseClick(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error('element has no box (not visible?)');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/** Choose a file for an <input type=file> through the real file chooser that opens when the drop zone is clicked. */
async function chooseFile(page, dropZone, filePath) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), dropZone.click()]);
  await chooser.setFiles(filePath);
}

/** Wait for a download triggered by `action` and return its bytes. */
async function downloadOf(page, action) {
  const [dl] = await Promise.all([page.waitForEvent('download'), action()]);
  const stream = await dl.createReadStream();
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  return { name: dl.suggestedFilename(), bytes: Buffer.concat(chunks) };
}

async function activateSettingsTab(page, tab) {
  return require('./model-helpers').activateSettingsTab(page, tab);
}
async function openSettings(page, tab) {
  return require('./model-helpers').openSettings(page, tab);
}

module.exports = { test, expect, onlyEngines, mouseClick, chooseFile, downloadOf, watchConsole, VALID_KEY, BAD_KEY, activateSettingsTab, openSettings };
