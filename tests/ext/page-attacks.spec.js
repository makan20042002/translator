'use strict';
// A web page's own scripts must not be able to start translation, reading aloud
// or anything else in the extension. Only real user actions (real mouse and
// keyboard input) and the extension's own pages may do that.
const { test, expect, inShadow, dragSelect, pressM } = require('../support/ext-fixtures');

const PROVIDER_HOSTS = ['clients5.google.com', 'translate.googleapis.com', 'api.mymemory.translated.net', 'generativelanguage.googleapis.com'];
const requests = stub => stub.calls().filter(c => PROVIDER_HOSTS.includes(c.host)).map(c => `${c.host}${c.path}`);
const ORIGINAL_P1 = 'The quick brown fox jumps over the lazy dog near the river bank.';

test.describe('Extension: a web page cannot drive the extension', () => {
  test('the page-readable "translate this page" and "open card" events do nothing', async ({ ext, stub }) => {
    const page = ext.article;
    stub.clearLog();
    await page.evaluate(() => {
      document.dispatchEvent(new Event('__makan_page_translate_action'));
      document.dispatchEvent(new Event('__makan_restore_page_action'));
      document.dispatchEvent(new CustomEvent('__makan_open_card_action', { detail: { rect: { left: 10, top: 10, right: 100, bottom: 30, width: 90, height: 20 }, text: 'Text the page chose', isDict: false } }));
      window.dispatchEvent(new CustomEvent('__makan_open_card_action', { detail: { text: 'Text the page chose' } }));
    });
    await page.waitForTimeout(1500);
    expect(requests(stub), 'translation requests started by the page').toEqual([]);
    await expect(inShadow(page, '.makan-card')).toHaveCount(0);
    await expect(page.locator('#p1')).toHaveText(ORIGINAL_P1);
  });

  test('messages a page posts to itself are ignored', async ({ ext, stub }) => {
    const page = ext.article;
    stub.clearLog();
    await page.evaluate(() => {
      for (const action of ['translate-text', 'translate-dict', 'play-gemini-tts', 'context-translate-selection', 'context-translate-page', 'page-translate-toggle', 'shortcut-translate-page']) {
        window.postMessage({ action, items: ['Text the page chose'], word: 'chosen', text: 'Text the page chose' }, '*');
        window.dispatchEvent(new MessageEvent('message', { data: { action, text: 'Text the page chose' } }));
      }
    });
    await page.waitForTimeout(1500);
    expect(requests(stub)).toEqual([]);
    await expect(inShadow(page, '.makan-card')).toHaveCount(0);
    await expect(page.locator('#p1')).toHaveText(ORIGINAL_P1);
  });

  test('a page that selects text and fakes a mouse release or double-click does not get the M button or a card', async ({ ext, stub }) => {
    const page = ext.article;
    stub.clearLog();
    await page.evaluate(() => {
      const p = document.getElementById('p1'), w = document.getElementById('p3');
      getSelection().selectAllChildren(p);
      p.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
      getSelection().selectAllChildren(w);
      w.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
      w.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    });
    await page.waitForTimeout(1200);
    await expect(inShadow(page, '.makan-btn-float')).toHaveCount(0);
    await expect(inShadow(page, '.makan-card')).toHaveCount(0);
    expect(requests(stub), 'translation requests started by faked mouse events').toEqual([]);
  });

  test('page scripts cannot press the buttons on the M bubble or on the card', async ({ ext, stub }) => {
    const page = ext.article;
    const press = ids => page.evaluate(ids => {
      const root = document.getElementById('makan-translate-root').shadowRoot;
      for (const sel of ids) { const el = root.querySelector(sel); if (el) el.click(); }
    }, ids);

    // The M button: shown after a real selection; a scripted click must not open the card.
    await dragSelect(page, '#li1');
    await expect(inShadow(page, '.makan-btn-float')).toBeVisible();
    stub.clearLog();
    await press(['.makan-btn-float']);
    await page.waitForTimeout(800);
    await expect(inShadow(page, '.makan-card')).toHaveCount(0);
    expect(requests(stub)).toEqual([]);

    // The card: opened by a real press, then scripted clicks on Swap, Speak, Copy and Close.
    await pressM(page);
    await expect(inShadow(page, '.makan-result-text')).toHaveText('[fa] First item in the list of things.');
    stub.clearLog();
    await press(['#makanSwapBtn', '#makanSpeakBtn', '#makanCopyBtn', '#makanCardClose']);
    await page.waitForTimeout(1200);
    await expect(inShadow(page, '.makan-card'), 'scripted click on Close').toHaveCount(1);
    await expect(inShadow(page, '#makanPairPill'), 'scripted click on Swap').toHaveText('AUTO → FA');
    await expect(inShadow(page, '#makanCopyBtn span'), 'scripted click on Copy').toHaveText('Copy');
    expect(requests(stub), 'requests started by scripted clicks (Swap translates, Speak asks Gemini)').toEqual([]);
  });
});
