'use strict';
// Verifies that fast Gemini TTS errors (503/429/streaming failure) correctly display the error notice
// and are NEVER overwritten by the Microsoft Edge voice recommendation hint in card or popup.
const { test, expect, inShadow, dragSelect, pressM, openRealPopup, VALID_KEY } = require('../support/ext-fixtures');

const GEMINI = 'generativelanguage.googleapis.com';

async function openCard(page) {
  await dragSelect(page, '#li1');
  await pressM(page);
  await expect(inShadow(page, '.makan-result-text')).toHaveText('[fa] First item in the list of things.', { timeout: 15_000 });
}

async function translateInPopup(popup) {
  await popup.click('#pInputText');
  await popup.eval(`document.getElementById('pInputText').value = 'Voice notice race test'`);
  await popup.click('#pTransBtn');
  await popup.waitFor(`document.getElementById('pOutputText').textContent.includes('[fa] Voice notice race test')`);
}

test.describe('Extension: Voice notice race condition prevention', () => {
  test.use({ extOptions: { config: { eng: { gemini: { on: true, key: VALID_KEY } } } } });

  test('Selection card: fast Gemini error retains error notice and does not get overwritten by Edge hint', async ({ ext, stub }) => {
    const page = ext.article;
    await openCard(page);

    stub.setGeminiBusy(['gemini-2.5-flash-preview-tts']);
    await inShadow(page, '#makanSpeakBtn').click();

    const notice = inShadow(page, '.makan-voice-notice');
    // Notice must appear with the failure reason and Retry button
    await expect(notice).toContainText(/busy|high demand/i, { timeout: 25_000 });
    await expect(notice.locator('.makan-voice-retry', { hasText: 'Retry' })).toBeVisible();

    // Give time for any delayed handler to run and verify notice was NOT overwritten by Edge hint
    await page.waitForTimeout(600);
    await expect(notice).not.toContainText('Microsoft Edge has built-in natural voices');
    await expect(notice).toContainText(/busy|high demand/i);
  });

  test('Popup: fast Gemini error retains error notice and does not get overwritten by Edge hint', async ({ ext, stub }) => {
    const popup = await openRealPopup(ext);
    await translateInPopup(popup);

    stub.setGeminiBusy(['gemini-2.5-flash-preview-tts']);
    await popup.click('#pSpeakBtn');

    // Wait for error notice to appear in popup
    await popup.waitFor(`Array.from(document.querySelectorAll('.p-voice-notice')).some(n => /busy|high demand/i.test(n.textContent))`);

    const hasRetry = await popup.eval(`!!Array.from(document.querySelectorAll('.p-voice-retry')).find(b => b.textContent === 'Retry')`);
    expect(hasRetry).toBe(true);

    // Verify it is not replaced with Edge hint
    const text = await popup.eval(`document.querySelector('.p-voice-notice')?.textContent || ''`);
    expect(text).not.toContain('Microsoft Edge has built-in natural voices');
    expect(text).toMatch(/busy|high demand/i);

    await popup.close();
  });
});
