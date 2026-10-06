'use strict';
/**
 * Checks against the REAL translation services. They are skipped unless you
 * switch them on, because they need internet access and (for Gemini) a key:
 *
 *   MAKAN_LIVE=1            real Google Translate (no key needed)
 *   MAKAN_GEMINI_KEY=...    real Gemini translation and Gemini read-aloud
 *
 * Windows (PowerShell):  $env:MAKAN_GEMINI_KEY="your key"; npm test
 *
 * The key is only placed in the test browser's storage; it is never printed.
 */
const { test: base, expect } = require('@playwright/test');
const { chromium } = require('@playwright/test');
const { startStub } = require('../support/stub-server');
const { onlyEngines, mouseClick } = require('../support/fixtures');

const GEMINI_KEY = process.env.MAKAN_GEMINI_KEY || '';
const LIVE = process.env.MAKAN_LIVE === '1' || !!GEMINI_KEY;

const test = base.extend({
  live: async ({}, use) => {
    const site = await startStub(); // only its local web server is used here
    const browser = await chromium.launch({ channel: 'chromium', headless: true });
    await use({ site, browser });
    await browser.close();
    await site.close();
  }
});

async function openApp(live, seed) {
  const context = await live.browser.newContext();
  await context.addInitScript(s => { for (const [k, v] of Object.entries(s)) localStorage.setItem('mkt_' + k, JSON.stringify(v)); }, seed);
  const page = await context.newPage();
  await page.goto(live.site.appUrl);
  return page;
}

test.describe('Live services (real internet)', () => {
  test('real Google Translate translates a sentence', async ({ live }) => {
    test.skip(!LIVE, 'skipped: needs live service (set MAKAN_LIVE=1 to run)');
    test.setTimeout(60_000);
    const page = await openApp(live, { cfg: onlyEngines(['google']), src: 'en', tgt: 'fa' });
    await mouseClick(page, page.locator('#tIn'));
    await page.keyboard.type('Good morning');
    await mouseClick(page, page.locator('#tGo'));
    await expect(page.locator('#tOut')).not.toHaveValue('', { timeout: 30_000 });
    expect(await page.locator('#tOut').inputValue()).not.toBe('Good morning');
    await expect(page.locator('#tMeta')).toContainText('Google');
  });

  test('real Gemini translates a sentence', async ({ live }) => {
    test.skip(!GEMINI_KEY, 'skipped: needs key (set MAKAN_GEMINI_KEY to run)');
    test.setTimeout(60_000);
    const page = await openApp(live, { cfg: onlyEngines(['gemini'], { gemini: GEMINI_KEY }), tMode: 'smart', src: 'en', tgt: 'fa' });
    await mouseClick(page, page.locator('#tIn'));
    await page.keyboard.type('Good morning, how are you?');
    await mouseClick(page, page.locator('#tGo'));
    await expect(page.locator('#tOut')).toHaveValue(/[؀-ۿ]/, { timeout: 40_000 });
    await expect(page.locator('#tMeta')).toContainText('Google Gemini', { timeout: 10_000 });
  });

  test('real Gemini result replaces the Fast result in Both mode (waits for the Smart result)', async ({ live }) => {
    test.skip(!GEMINI_KEY, 'skipped: needs key (set MAKAN_GEMINI_KEY to run)');
    test.setTimeout(90_000);
    const page = await openApp(live, { cfg: onlyEngines(['gemini'], { gemini: GEMINI_KEY }), tMode: 'both', src: 'en', tgt: 'fa' });
    await mouseClick(page, page.locator('#tIn'));
    await page.keyboard.type('Good morning, how are you?');
    await mouseClick(page, page.locator('#tGo'));
    // The Fast result (Google web) shows first; the Smart one arrives later, so wait long for it.
    await expect(page.locator('#tMeta')).toContainText('Google Gemini', { timeout: 60_000 });
    await expect(page.locator('#tOut')).toHaveValue(/[؀-ۿ]/);
  });

  test('real Gemini: the key lists models, and a speech model and a translation model are found', async () => {
    test.skip(!GEMINI_KEY, 'skipped: needs key (set MAKAN_GEMINI_KEY to run)');
    test.setTimeout(60_000);
    const engine = require('../../extension/engine.js');
    const text = await engine.geminiModelOrder(GEMINI_KEY, 'text', 'no-such-model-name');
    const tts = await engine.geminiModelOrder(GEMINI_KEY, 'tts', 'no-such-model-name');
    expect(text.length, 'translation models this key can use').toBeGreaterThan(0);
    expect(tts.length, 'speech models this key can use').toBeGreaterThan(0);
    expect(text).not.toContain('no-such-model-name');
  });

  test('real Gemini read-aloud returns audio', async ({ live }) => {
    test.skip(!GEMINI_KEY, 'skipped: needs key (set MAKAN_GEMINI_KEY to run)');
    test.setTimeout(60_000);
    const page = await openApp(live, { cfg: { ...onlyEngines(['gemini'], { gemini: GEMINI_KEY }), tts: { mode: 'gemini', voices: {}, rate: 1 } }, src: 'en', tgt: 'fa' });
    const audio = page.waitForResponse(r => /generativelanguage\.googleapis\.com\/.*(streamGenerateContent|generateContent)/.test(r.url()) && r.request().postData()?.includes('AUDIO'), { timeout: 30_000 });
    await mouseClick(page, page.locator('#tIn'));
    await page.keyboard.type('Hello');
    await mouseClick(page, page.locator('#tGo'));
    await expect(page.locator('#tOut')).not.toHaveValue('', { timeout: 30_000 });
    await mouseClick(page, page.locator('#tSpeak'));
    expect((await audio).status()).toBe(200);
  });

  test('real Gemini translates in extension Smart mode', async () => {
    test.skip(!GEMINI_KEY, 'skipped: needs key (set MAKAN_GEMINI_KEY to run)');
    test.setTimeout(60_000);
    const engine = require('../../extension/engine.js');
    const cfg = {
      order: ['gemini'],
      eng: { gemini: { on: true, key: GEMINI_KEY, model: 'gemini-2.5-flash' } },
      src: 'en',
      tgt: 'fa'
    };
    const res = await engine.translateItemsWithFallback(['Good morning, how are you?'], { mode: 'smart', src: 'en', tgt: 'fa' }, cfg);
    expect(res.results[0]).toMatch(/[؀-ۿ]/);
    expect(res.engineName).toBe('Google Gemini');
  });
});

