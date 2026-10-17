'use strict';
// Verifies that fast Gemini TTS errors (503/429/streaming failure) correctly display the error notice
// and are NEVER overwritten by the Microsoft Edge voice recommendation hint in card or popup,
// and that any visible Edge hint is cleanly replaced by a subsequent error notice.
const { test, expect, inShadow, dragSelect, pressM, openRealPopup, VALID_KEY } = require('../support/ext-fixtures');

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

  test('Selection card: fast Gemini error retains error notice and does not get overwritten by Edge hint (error first then hint)', async ({ ext, stub }) => {
    const page = ext.article;
    await openCard(page);

    stub.setGeminiBusy(['gemini-2.5-flash-preview-tts']);
    await inShadow(page, '#makanSpeakBtn').click();

    const notice = inShadow(page, '.makan-voice-notice');
    // Notice must appear with the failure reason and Retry button
    await expect.poll(async () => notice.textContent(), { timeout: 25_000 }).toMatch(/busy|high demand/i);
    await expect(notice.locator('.makan-voice-retry', { hasText: 'Retry' })).toBeVisible();

    // Verify after delay that it was never replaced by Edge hint
    await page.waitForTimeout(600);
    expect(await notice.textContent()).not.toContain('Microsoft Edge has built-in natural voices');
    expect(await notice.textContent()).toMatch(/busy|high demand/i);
  });

  test('Popup: fast Gemini error retains error notice and does not get overwritten by Edge hint (error first then hint)', async ({ ext, stub }) => {
    const popup = await openRealPopup(ext);
    await translateInPopup(popup);

    stub.setGeminiBusy(['gemini-2.5-flash-preview-tts']);
    await popup.click('#pSpeakBtn');

    // Wait for error notice to appear in popup using expect.poll
    await expect.poll(async () => {
      return await popup.eval(`document.querySelector('.p-voice-notice')?.textContent || ''`);
    }, { timeout: 25_000 }).toMatch(/busy|high demand/i);

    const hasRetry = await popup.eval(`!!Array.from(document.querySelectorAll('.p-voice-retry')).find(b => b.textContent === 'Retry')`);
    expect(hasRetry).toBe(true);

    // Verify after delay that it is not replaced with Edge hint
    await new Promise(r => setTimeout(r, 600));
    const text = await popup.eval(`document.querySelector('.p-voice-notice')?.textContent || ''`);
    expect(text).not.toContain('Microsoft Edge has built-in natural voices');
    expect(text).toMatch(/busy|high demand/i);

    await popup.close();
  });

  test('Selection card: later error notice replaces visible Edge hint (hint first then error)', async ({ ext, stub }) => {
    const page = ext.article;
    await openCard(page);

    // Pre-display Edge hint
    await page.evaluate(() => {
      const root = document.querySelector('#makan-translate-root');
      const container = root.shadowRoot.querySelector('#makanCardBody') || root.shadowRoot.querySelector('.makan-card');
      let n = container.querySelector('.makan-voice-notice');
      if (!n) {
        n = document.createElement('div');
        n.className = 'makan-voice-notice';
        container.appendChild(n);
      }
      n.dataset.kind = 'hint';
      n.innerHTML = '<span>Microsoft Edge has built-in natural voices for this language.</span>';
    });

    stub.setGeminiBusy(['gemini-2.5-flash-preview-tts']);
    await inShadow(page, '#makanSpeakBtn').click();

    const notice = inShadow(page, '.makan-voice-notice');
    // Error notice replaces the hint
    await expect.poll(async () => notice.textContent(), { timeout: 25_000 }).toMatch(/busy|high demand/i);
    expect(await notice.textContent()).not.toContain('Microsoft Edge has built-in natural voices');
  });

  test('Popup: later error notice replaces visible Edge hint (hint first then error)', async ({ ext, stub }) => {
    const popup = await openRealPopup(ext);
    await translateInPopup(popup);

    // Pre-display Edge hint
    await popup.eval(`(() => {
      const wrap = document.getElementById('pOutputWrap');
      const n = document.createElement('div');
      n.className = 'p-voice-notice';
      n.dataset.kind = 'hint';
      n.innerHTML = '<span>Microsoft Edge has built-in natural voices for this language.</span>';
      wrap.appendChild(n);
    })()`);

    stub.setGeminiBusy(['gemini-2.5-flash-preview-tts']);
    await popup.click('#pSpeakBtn');

    // Error notice replaces the hint
    await expect.poll(async () => {
      return await popup.eval(`document.querySelector('.p-voice-notice')?.textContent || ''`);
    }, { timeout: 25_000 }).toMatch(/busy|high demand/i);

    const text = await popup.eval(`document.querySelector('.p-voice-notice')?.textContent || ''`);
    expect(text).not.toContain('Microsoft Edge has built-in natural voices');

    await popup.close();
  });
});
