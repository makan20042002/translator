'use strict';
/**
 * Loads the unpacked Chrome/Edge build (dist/chrome) into a real Chromium.
 *
 * How it is loaded: Chromium is started with no extension, any pages the test
 * wants "already open" are opened, and then the extension is installed with
 * the DevTools command Extensions.loadUnpacked. That is the same thing as
 * pressing "Load unpacked" on the extensions page, and it lets a test open a
 * tab before the extension exists.
 *
 * What is changed: the tests load a COPY of dist/chrome in which
 * background.js starts with a few lines (marked TEST HARNESS) that remember
 * the functions the extension registers for right-click menu clicks and
 * keyboard shortcuts. Chrome's native right-click menu cannot be clicked by
 * automation, so tests call the extension's own menu handler with the same
 * information Chrome would pass. Everything after that point (pinging the
 * tab, injecting the content script, opening the card) is the real code.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('@playwright/test');
const { chromiumNetworkArgs } = require('./stub-server');

const ROOT = path.resolve(__dirname, '..', '..');
const DIST_CHROME = path.join(ROOT, 'dist', 'chrome');
const TEST_COPY = path.resolve(__dirname, '..', '.generated', 'ext-chrome-under-test');

const SHIM = `// ---- TEST HARNESS (added by tests/support/extension.js to a test copy; not part of the product) ----
self.__makanTest = { menuListeners: [], commandListeners: [] };
for (const [ev, list] of [[chrome.contextMenus.onClicked, 'menuListeners'], [chrome.commands.onCommand, 'commandListeners']]) {
  const original = ev.addListener.bind(ev);
  ev.addListener = fn => { self.__makanTest[list].push(fn); return original(fn); };
}
// ---- END TEST HARNESS ----
`;

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

function prepareTestCopy() {
  if (!fs.existsSync(path.join(DIST_CHROME, 'manifest.json'))) {
    throw new Error('dist/chrome is missing. Run "node build-manifests.js" first (npm test does this for you).');
  }
  fs.rmSync(TEST_COPY, { recursive: true, force: true });
  copyDir(DIST_CHROME, TEST_COPY);
  const bg = path.join(TEST_COPY, 'background.js');
  fs.writeFileSync(bg, SHIM + fs.readFileSync(bg, 'utf8'));
  return TEST_COPY;
}

/**
 * Start Chromium, open `preOpen` URLs, then load the extension.
 * Returns helpers used by the extension tests.
 */
async function launchWithExtension({ stub, files, preOpen = [], extPath }) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'makan-ext-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true,
    args: [
      ...chromiumNetworkArgs(stub),
      '--enable-unsafe-extension-debugging',
      '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
      ...(files ? [`--use-file-for-fake-audio-capture=${files.wav}`] : [])
    ]
  });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: stub.appOrigin });

  const opened = [];
  for (const url of preOpen) {
    const p = await context.newPage();
    await p.goto(url);
    opened.push(p);
  }
  // Close the blank start tab Chromium opens.
  for (const p of context.pages()) if (p.url() === 'about:blank' && !opened.includes(p)) await p.close();

  const cdp = await context.browser().newBrowserCDPSession();
  const { id } = await cdp.send('Extensions.loadUnpacked', { path: extPath || TEST_COPY });

  const ext = {
    id, context, cdp, opened, userDataDir,
    url: p => `chrome-extension://${id}/${p}`,

    /** The extension's background service worker (waits for it to start). */
    async worker() {
      for (let i = 0; i < 100; i++) {
        const sw = context.serviceWorkers().find(w => w.url().startsWith(`chrome-extension://${id}/`));
        if (sw) return sw;
        if (i === 20) { // wake it by opening an extension page that sends a message
          const w = await context.newPage();
          await w.goto(ext.url('offscreen.html')).catch(() => {});
          await w.evaluate(() => chrome.runtime.sendMessage({ action: 'get-config' })).catch(() => {});
          await w.close();
        }
        await new Promise(r => setTimeout(r, 100));
      }
      throw new Error('extension service worker did not start');
    },

    /** Run fn(arg) inside an extension page (has chrome.* APIs). */
    async inExtension(fn, arg) {
      const p = await context.newPage();
      try {
        await p.goto(ext.url('offscreen.html'));
        return await p.evaluate(fn, arg);
      } finally { await p.close(); }
    },

    async getConfig() {
      return ext.inExtension(async () => (await chrome.storage.local.get('makan_cfg')).makan_cfg);
    },

    /** Merge settings into the stored config (test setup, not a UI test). */
    async patchConfig(patch) {
      return ext.inExtension(async patch => {
        const cur = (await chrome.storage.local.get('makan_cfg')).makan_cfg || {};
        const merged = Object.assign({}, cur, patch);
        if (patch.eng) {
          merged.eng = Object.assign({}, cur.eng);
          for (const [k, v] of Object.entries(patch.eng)) merged.eng[k] = Object.assign({}, cur.eng?.[k], v);
        }
        await chrome.storage.local.set({ makan_cfg: merged });
        return merged;
      }, patch);
    },

    /** Call the extension's real right-click menu handler for the tab showing `pageUrl`. */
    async clickContextMenu(menuItemId, pageUrl, selectionText) {
      const sw = await ext.worker();
      return sw.evaluate(async ({ menuItemId, pageUrl, selectionText }) => {
        const [tab] = await chrome.tabs.query({ url: pageUrl });
        if (!tab) throw new Error('tab not found: ' + pageUrl);
        const fns = self.__makanTest.menuListeners;
        if (!fns.length) throw new Error('no context-menu handler was registered by background.js');
        const info = { menuItemId, pageUrl: tab.url, editable: false };
        if (selectionText) info.selectionText = selectionText;
        await Promise.all(fns.map(fn => fn(info, tab)));
        return true;
      }, { menuItemId, pageUrl, selectionText });
    },

    /** Errors Chrome has recorded for the extension (the "Errors" button on the extensions page). */
    async chromeReportedErrors() {
      const p = await context.newPage();
      try {
        await p.goto('chrome://extensions');
        return await p.evaluate(id => new Promise(resolve => {
          chrome.developerPrivate.updateProfileConfiguration({ inDeveloperMode: true }, () => {
            chrome.developerPrivate.getExtensionInfo(id, info => resolve({
              state: info.state,
              runtimeErrors: info.runtimeErrors.map(e => e.message),
              manifestErrors: info.manifestErrors.map(e => e.message),
              warnings: info.installWarnings || []
            }));
          });
        }), id);
      } finally { await p.close(); }
    },

    async close() {
      await context.close();
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  };
  await ext.worker();
  return ext;
}

/**
 * Open the extension's real toolbar popup (chrome.action.openPopup, the same
 * popup a click on the toolbar icon shows) for the tab that is in front, and
 * drive it with real mouse and keyboard events through the DevTools protocol.
 * Playwright does not list this popup as a page, so this small client talks
 * to it directly.
 */
async function openRealPopup(ext) {
  const sw = await ext.worker();
  const opened = await sw.evaluate(async () => { try { await chrome.action.openPopup(); return 'ok'; } catch (e) { return e.message; } });
  if (opened !== 'ok') throw new Error('chrome.action.openPopup failed: ' + opened);
  let target = null;
  for (let i = 0; i < 50 && !target; i++) {
    const { targetInfos } = await ext.cdp.send('Target.getTargets');
    target = targetInfos.find(t => t.type === 'page' && t.url === ext.url('popup.html'));
    if (!target) await new Promise(r => setTimeout(r, 100));
  }
  if (!target) throw new Error('popup did not appear');
  const { sessionId } = await ext.cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: false });
  let n = 0;
  const waiting = {};
  const consoleErrors = [];
  const onMsg = ev => {
    if (ev.sessionId !== sessionId) return;
    const m = JSON.parse(ev.message);
    if (m.id && waiting[m.id]) { waiting[m.id](m); delete waiting[m.id]; }
    if (m.method === 'Runtime.exceptionThrown') consoleErrors.push('uncaught: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') consoleErrors.push('console.error: ' + m.params.args.map(a => a.value ?? a.description).join(' '));
  };
  ext.cdp.on('Target.receivedMessageFromTarget', onMsg);
  let closed = false;
  ext.cdp.on('Target.detachedFromTarget', ev => { if (ev.sessionId === sessionId) closed = true; });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++n;
    waiting[id] = m => (m.error ? reject(new Error(method + ': ' + m.error.message)) : resolve(m.result));
    ext.cdp.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method, params }) }).catch(reject);
  });
  await send('Runtime.enable');

  const popup = {
    consoleErrors,
    isClosed: () => closed,
    async eval(expression) {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error('popup eval failed: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      return r.result.value;
    },
    async waitFor(expression, timeout = 10000) {
      const t0 = Date.now();
      let last;
      while (Date.now() - t0 < timeout) {
        if (closed) throw new Error('popup closed while waiting for: ' + expression);
        last = await popup.eval(expression).catch(e => e.message);
        if (last) return last;
        await new Promise(r => setTimeout(r, 100));
      }
      throw new Error(`timed out waiting for popup condition: ${expression} (last: ${last})`);
    },
    /** Real left-button press and release at the centre of the element. */
    async click(selector) {
      await popup.waitFor(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })()`);
      const { x, y } = await popup.eval(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 }).catch(() => {});
    },
    /** Real key presses for each character. */
    async type(text) {
      for (const ch of text) {
        await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, key: ch, unmodifiedText: ch });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
      }
    },
    async close() { if (!closed) await ext.cdp.send('Target.closeTarget', { targetId: target.targetId }).catch(() => {}); }
  };
  return popup;
}

/** Locator for something inside the extension's shadow root on a web page. */
const inShadow = (page, selector) => page.locator(`#makan-translate-root ${selector}`);

/** Select text with a real mouse drag from the start to the end of an element's text. */
async function dragSelect(page, selector) {
  const box = await page.evaluate(sel => {
    const el = document.querySelector(sel);
    const r = document.createRange();
    r.selectNodeContents(el);
    const rects = r.getClientRects();
    const first = rects[0], last = rects[rects.length - 1];
    return { x1: first.left + 1, y1: first.top + first.height / 2, x2: last.right - 1, y2: last.top + last.height / 2 };
  }, selector);
  const expected = await page.evaluate(sel => document.querySelector(sel).innerText.trim(), selector);
  await page.mouse.move(box.x1, box.y1);
  await page.mouse.down();
  await page.mouse.move((box.x1 + box.x2) / 2, (box.y1 + box.y2) / 2, { steps: 5 });
  await page.mouse.move(box.x2, box.y2, { steps: 5 });
  // Like a person, let go only once the whole text is highlighted (on a busy machine the browser can lag a moment).
  for (let i = 0; i < 40; i++) {
    if ((await page.evaluate(() => getSelection().toString().trim())) === expected) break;
    await page.waitForTimeout(50);
  }
  await page.mouse.up();
}

module.exports = { prepareTestCopy, launchWithExtension, openRealPopup, inShadow, dragSelect, TEST_COPY, DIST_CHROME };
