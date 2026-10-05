'use strict';
// Read-aloud in the extension: the Speak button's state, and stopping.
const { test, expect, inShadow, dragSelect, pressM, openRealPopup, VALID_KEY } = require('../support/ext-fixtures');

async function openCard(page) {
  await dragSelect(page, '#li1');
  await pressM(page);
  await expect(inShadow(page, '.makan-result-text')).toHaveText('[fa] First item in the list of things.');
}

test.describe('Extension card: the Speak button follows the speech and stops it', () => {
  test.use({ extOptions: { config: { eng: { gemini: { on: true, key: VALID_KEY } } } } });

  test('shows "Stop" for as long as Gemini voice plays; a second press stops it; it can then be started again', async ({ ext, stub }) => {
    const page = ext.article;
    await openCard(page);
    const label = inShadow(page, '#makanSpeakBtn span');
    const streams = () => stub.calls('generativelanguage.googleapis.com').filter(c => /:streamGenerateContent$/.test(c.path)).length;

    await inShadow(page, '#makanSpeakBtn').click();
    await expect.poll(streams).toBe(1);
    // The audio lasts about 1.6 s. The label must say "Stop" the whole time, not flip back after a moment.
    await expect(label).toHaveText('Stop', { timeout: 1000 });
    for (let i = 0; i < 5; i++) { await page.waitForTimeout(200); await expect(label, `after ${(i + 1) * 200} ms`).toHaveText('Stop'); }

    // Second press stops it, and a late message from the stopped speech must not change the button again.
    await inShadow(page, '#makanSpeakBtn').click();
    await expect(label).toHaveText('Speak');
    await page.waitForTimeout(2000);
    await expect(label).toHaveText('Speak');
    expect(streams(), 'only one speech was started').toBe(1);

    // Pressing again plays it again (this time from the audio already received, so there is no new request),
    // the button shows "Stop" while it plays and goes back to "Speak" when it ends.
    await inShadow(page, '#makanSpeakBtn').click();
    await expect(label).toHaveText('Stop', { timeout: 1000 });
    await expect(label, 'the second speech should end by itself').toHaveText('Speak', { timeout: 15_000 });
  });

  test('the popup\'s speaker button stays in its playing state while Gemini voice plays, and stops on a second press', async ({ ext, stub }) => {
    const popup = await openRealPopup(ext);
    await popup.click('#pInputText');
    await popup.type('Hello');
    await popup.click('#pTransBtn');
    await popup.waitFor(`document.getElementById('pOutputText').textContent === '[fa] Hello'`);
    const active = `(() => { const c = document.getElementById('pSpeakBtn').classList; return c.contains('preparing') || c.contains('playing'); })()`;
    await popup.click('#pSpeakBtn');
    await popup.waitFor(active);
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 200));
      expect(await popup.eval(active), `speaker button active after ${(i + 1) * 200} ms`).toBe(true);
    }
    await popup.click('#pSpeakBtn');
    await popup.waitFor(`!(${active})`);
    await new Promise(r => setTimeout(r, 1500));
    expect(await popup.eval(active), 'speaker button after a late message from the stopped speech').toBe(false);
    await popup.close();
  });
});
