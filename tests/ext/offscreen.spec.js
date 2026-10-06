'use strict';
// What a web page (or its content script) can learn about, or do to, the extension's own files and pages.
const { test, expect, inContentScriptWorld } = require('../support/ext-fixtures');

test.describe('Extension: the hidden audio player', () => {
  test('the hidden audio player ignores messages that do not come from the extension itself', async ({ ext }) => {
    // A content script (inside a web page) can broadcast runtime messages that every extension page hears.
    const page = ext.article;
    const probe = `(async () => {
      try { return JSON.stringify(await chrome.runtime.sendMessage({ target: 'makan-offscreen', action: 'play-audio', audioUrl: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=', token: 99 })); } catch (e) { return 'ERR ' + e.message; }
    })()`;
    const player = await ext.context.newPage();
    await player.goto(ext.url('offscreen.html'));
    await player.evaluate(() => { window.__heard = 0; const orig = Audio; window.Audio = function (...a) { window.__heard++; return new orig(...a); }; });
    await inContentScriptWorld(ext, page, probe);
    await page.waitForTimeout(800);
    expect(await player.evaluate(() => window.__heard), 'audio started by a message from a web page\'s content script').toBe(0);
  });
});
