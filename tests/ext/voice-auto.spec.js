'use strict';
// Extension card and popup: no device voice for the language -> Gemini voice automatically (when a key is set),
// the voice in use is shown, failures say why with Retry, and Edge is suggested once.
const { test, expect, inShadow, dragSelect, pressM, openRealPopup, VALID_KEY } = require('../support/ext-fixtures');

const GEMINI = 'generativelanguage.googleapis.com';
const audioCalls = stub => stub.calls(GEMINI).filter(c => /:streamGenerateContent$/.test(c.path) || (/:generateContent$/.test(c.path) && c.body.includes('AUDIO')));

async function openCard(page) {
  await dragSelect(page, '#li1');
  await pressM(page);
  await expect(inShadow(page, '.makan-result-text')).toHaveText('[fa] First item in the list of things.');
}

test.describe('Extension card: automatic Gemini voice', () => {
  test.use({ extOptions: { config: { eng: { gemini: { on: true, key: VALID_KEY } } } } });

  test('no device voice: Gemini speaks Persian, the voice is shown, and the Edge hint can be dismissed for good', async ({ ext, stub }) => {
    const page = ext.article;
    await openCard(page);
    await inShadow(page, '#makanSpeakBtn').click();
    await expect.poll(() => audioCalls(stub).length, { timeout: 15_000 }).toBeGreaterThan(0);
    await expect(inShadow(page, '.makan-voice-used')).toContainText('Gemini');
    await expect(inShadow(page, '.makan-voice-notice')).toContainText('Microsoft Edge has built-in natural voices');
    await inShadow(page, '.makan-voice-notice .makan-voice-retry').click();
    await expect(inShadow(page, '.makan-voice-notice')).toHaveCount(0);
    await expect.poll(async () => (await ext.getConfig()).edgeHintOff).toBe(true);
  });

  test('Gemini busy (503): one plain line with Retry, the button is not stuck on Stop, and Retry works after recovery', async ({ ext, stub }) => {
    const page = ext.article;
    await openCard(page);
    stub.setGeminiBusy(['gemini-2.5-flash-preview-tts']);
    await inShadow(page, '#makanSpeakBtn').click();
    const notice = inShadow(page, '.makan-voice-notice');
    await expect(notice).toContainText(/busy|high demand/i, { timeout: 25_000 });
    await expect(notice.locator('.makan-voice-retry', { hasText: 'Retry' })).toBeVisible();
    await expect(inShadow(page, '#makanSpeakBtn span')).toHaveText('Speak');
    stub.setGeminiBusy([]);
    const before = audioCalls(stub).length;
    await notice.locator('.makan-voice-retry', { hasText: 'Retry' }).click();
    await expect.poll(() => audioCalls(stub).length, { timeout: 15_000 }).toBeGreaterThan(before);
  });

  test('Gemini rate limited (429): one plain line with Retry', async ({ ext, stub }) => {
    const page = ext.article;
    await openCard(page);
    stub.failHost(GEMINI, 429);
    await inShadow(page, '#makanSpeakBtn').click();
    await expect(inShadow(page, '.makan-voice-notice')).toContainText(/rate limited/i, { timeout: 25_000 });
    await expect(inShadow(page, '#makanSpeakBtn span')).toHaveText('Speak');
  });
});

test.describe('Extension popup: automatic Gemini voice', () => {
  test.use({ extOptions: { config: { eng: { gemini: { on: true, key: VALID_KEY } } } } });

  async function translateInPopup(popup) {
    await popup.click('#pInputText');
    await popup.eval(`document.getElementById('pInputText').value = 'Hello popup'`);
    await popup.click('#pTransBtn');
    await popup.waitFor(`document.getElementById('pOutputText').textContent.includes('[fa] Hello popup')`);
  }

  test('no device voice: Gemini speaks, the voice is shown', async ({ ext, stub }) => {
    const popup = await openRealPopup(ext);
    await translateInPopup(popup);
    await popup.click('#pSpeakBtn');
    await popup.waitFor(`document.querySelector('.p-voice-used') && document.querySelector('.p-voice-used').textContent.includes('Gemini')`);
    await expect.poll(() => audioCalls(stub).length, { timeout: 15_000 }).toBeGreaterThan(0);
    await popup.close();
  });

  test('Gemini busy (503): one plain line with a Retry button', async ({ ext, stub }) => {
    const popup = await openRealPopup(ext);
    await translateInPopup(popup);
    stub.setGeminiBusy(['gemini-2.5-flash-preview-tts']);
    await popup.click('#pSpeakBtn');
    await popup.waitFor(`Array.from(document.querySelectorAll('.p-voice-notice')).some(n => /busy|high demand/i.test(n.textContent))`);
    expect(await popup.eval(`!!Array.from(document.querySelectorAll('.p-voice-retry')).find(b => b.textContent === 'Retry')`)).toBe(true);
    await popup.close();
  });
});
