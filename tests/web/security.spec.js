'use strict';
// Security: an API key may only ever be sent to its own provider.
const { test, expect, onlyEngines, mouseClick } = require('../support/fixtures');
const { KEYS, findKeyLeaks, findKeysInText } = require('../support/key-leaks');

const KEY_ENGINES = Object.keys(KEYS);

test.describe('Web app: API key safety', () => {
  test.use({
    appOptions: {
      seed: {
        cfg: { ...onlyEngines(['gemini', ...KEY_ENGINES.filter(e => e !== 'gemini'), 'google'], KEYS), stt: 'gemini', tts: { mode: 'gemini', voices: {}, rate: 1 } },
        src: 'en', tgt: 'fa'
      }
    }
  });

  test('no key is sent to any host except its own provider, and none appears in an address, message, log or cache', async ({ app }) => {
    test.setTimeout(150_000);
    const { page, stub } = app;
    const consoleLines = [];
    page.on('console', m => consoleLines.push(m.text()));
    // Remember every on-screen message, across reloads.
    await page.addInitScript(() => {
      const push = t => { const a = JSON.parse(sessionStorage.getItem('__toasts') || '[]'); if (!a.includes(t)) { a.push(t); sessionStorage.setItem('__toasts', JSON.stringify(a)); } };
      document.addEventListener('DOMContentLoaded', () => new MutationObserver(() => document.querySelectorAll('#toasts .toast').forEach(t => push(t.textContent)))
        .observe(document.getElementById('toasts'), { childList: true, subtree: true, characterData: true }));
    });
    await page.reload();
    await page.waitForTimeout(1500); // anything the page does on its own after loading

    // Engines & keys: Check connections, then "Test" and "Load models" for every provider.
    await mouseClick(page, page.locator('#openSet'));
    await mouseClick(page, page.locator('#btnCheckConn'));
    await expect(page.locator('#checkConnSummary')).toHaveText(/^\d+\/\d+ works$/, { timeout: 30_000 });
    for (const id of KEY_ENGINES) {
      for (const action of ['test', 'models']) {
        const btn = page.locator(`#engList .eng[data-id="${id}"] button[data-a="${action}"]`);
        await mouseClick(page, btn);
        await expect(btn).toBeEnabled({ timeout: 20_000 });
      }
    }
    await mouseClick(page, page.locator('#btnSaveDone'));
    await page.reload();
    await page.waitForTimeout(1000);

    // Text translation and read-aloud (Gemini voice).
    await mouseClick(page, page.locator('#tIn'));
    await page.keyboard.type('Good morning');
    await mouseClick(page, page.locator('#tGo'));
    await expect(page.locator('#tOut')).toHaveValue('[fa] Good morning');
    await mouseClick(page, page.locator('#tSpeak'));
    await expect.poll(() => stub.calls('generativelanguage.googleapis.com').some(c => /streamGenerateContent/.test(c.path))).toBe(true);

    // Voice: hold Talk (Gemini listens and translates), then Ask AI.
    await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));
    const box = await page.locator('#vPttBtn').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(2600);
    await page.mouse.up();
    await expect(page.locator('#bubbles .bub')).toHaveCount(1, { timeout: 20_000 });
    await mouseClick(page, page.locator('#vTabAsk'));
    await mouseClick(page, page.locator('#vAskIn'));
    await page.keyboard.type('Hello?');
    await page.keyboard.press('Enter');
    await expect(page.locator('#askBubbles .bub.b .bub-text')).toHaveText('This is the stub assistant answer.');
    await page.waitForTimeout(800);

    // Compare tab uses three more engines.
    await mouseClick(page, page.locator('#tabs button[data-tab="cmp"]'));
    await mouseClick(page, page.locator('#cIn'));
    await page.keyboard.type('Compare keys');
    await mouseClick(page, page.locator('#cGo'));
    await expect(page.locator('#cGo')).toBeEnabled({ timeout: 30_000 });

    // 1. Requests: wrong host, or key in an address.
    const requests = stub.log.filter(e => e.server === 'app' || e.server === 'provider');
    expect(requests.length, 'the scenario should have produced plenty of requests').toBeGreaterThan(30);
    expect(findKeyLeaks(stub), 'keys sent to the wrong place').toEqual([]);

    // 2. Console output, on-screen messages, the service worker's saved copies.
    const toasts = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__toasts') || '[]'));
    const cacheUrls = await page.evaluate(async () => {
      const urls = [];
      for (const name of await caches.keys()) for (const r of await (await caches.open(name)).keys()) urls.push(r.url);
      return urls;
    });
    const registered = await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()));
    expect(registered, 'the service worker must be active so its cache is part of this check').toBe(true);
    expect(cacheUrls.length).toBeGreaterThan(0);
    const textProblems = [
      ...findKeysInText('console output', consoleLines.join('\n')),
      ...findKeysInText('an on-screen message', toasts.join('\n')),
      ...findKeysInText('a cached web address', cacheUrls.join('\n'))
    ];
    expect(textProblems).toEqual([]);
  });

  test('the web app makes no request to its own server that carries user settings', async ({ app }) => {
    const { page, stub } = app;
    await page.waitForTimeout(1500);
    await mouseClick(page, page.locator('#openSet'));
    await mouseClick(page, page.locator('#btnSaveDone'));
    await page.waitForTimeout(500);
    const own = stub.log.filter(e => e.server === 'app' && e.method !== 'GET' && e.method !== 'HEAD');
    expect(own.map(e => `${e.method} ${e.path}`), 'non-GET requests to the web app\'s own server').toEqual([]);
  });

  test('a provider\'s address cannot be redirected by a saved setting, so its key cannot be sent elsewhere', async ({ app, stub: _unused }) => {
    // Another website cannot change this app's settings, but a settings file or old
    // stored value could carry a different "base" address for a fixed provider.
    const { page, stub } = app;
    await page.evaluate(k => {
      const cfg = JSON.parse(localStorage.getItem('mkt_cfg'));
      cfg.eng.openai.base = 'https://evil.example.test/v1';
      cfg.order = ['openai'];
      for (const id of Object.keys(cfg.eng)) cfg.eng[id].on = id === 'openai';
      localStorage.setItem('mkt_cfg', JSON.stringify(cfg));
    }, KEYS);
    await page.reload();
    await mouseClick(page, page.locator('#tIn'));
    await page.keyboard.type('Hello');
    await mouseClick(page, page.locator('#tGo'));
    await expect(page.locator('#tOut')).toHaveValue('[fa] Hello');
    expect(stub.log.filter(e => e.host === 'evil.example.test' || e.host.endsWith('.example.test')).map(e => e.host + e.path)).toEqual([]);
    expect(stub.calls('api.openai.com').length).toBeGreaterThan(0);
  });

  test('an error message from a provider that repeats the key is shown without the key', async ({ app }) => {
    const { page, stub } = app;
    stub.failHost('api.openai.com', 401, Infinity, { error: { message: `Incorrect API key provided: ${KEYS.openai}. You can find your API key at https://platform.openai.com/account/api-keys.` } });
    const messages = [];
    page.on('console', m => messages.push(m.text()));
    await mouseClick(page, page.locator('#openSet'));
    const btn = page.locator('#engList .eng[data-id="openai"] button[data-a="test"]');
    await mouseClick(page, btn);
    await expect(page.locator('#toasts')).toContainText('Incorrect API key provided');
    const shown = await page.locator('#toasts').innerText();
    expect(shown).not.toContain(KEYS.openai);
    expect(shown).toContain('[key hidden]');
    expect(messages.join('\n')).not.toContain(KEYS.openai);
  });
});
