'use strict';
// Extension (Chrome/Edge build) on a web page: selection → M button → card,
// card controls, double-click dictionary.
const { test, expect, inShadow, dragSelect, dblclickText, pressM, inContentScriptWorld, expectNoExtensionErrors, VALID_KEY } = require('../support/ext-fixtures');

const card = page => inShadow(page, '.makan-card');

test.describe('Extension: selection card', () => {
  test('loads with no errors on the extensions page', async ({ ext }) => {
    await expectNoExtensionErrors(ext);
    const info = await ext.chromeReportedErrors();
    expect(info.warnings).toEqual([]);
  });

  test('drag-selecting text shows the M button; a real mouse press on it opens a translated card', async ({ ext, stub }) => {
    const page = ext.article;
    await dragSelect(page, '#p1');
    await pressM(page);
    await expect(card(page)).toBeVisible();
    await expect(inShadow(page, '.makan-result-text')).toHaveText('[fa] The quick brown fox jumps over the lazy dog near the river bank.');
    await expect(inShadow(page, '#makanEnginePill')).toHaveText('Google Translate');
    await expect(inShadow(page, '.makan-result-text')).toHaveAttribute('dir', 'rtl');
    // The M button is gone once the card is open, and the page selection is untouched.
    await expect(inShadow(page, '.makan-btn-float')).toHaveCount(0);
    // The translation went through the background worker to Google.
    expect(new URLSearchParams(stub.calls('clients5.google.com')[0].body).getAll('q')).toEqual(['The quick brown fox jumps over the lazy dog near the river bank.']);
    expect(ext.pageErrors).toEqual([]);
    await expectNoExtensionErrors(ext);
  });

  test('selecting inside a text box does not show the M button', async ({ ext }) => {
    const page = ext.article;
    await page.locator('#name').click({ clickCount: 3 });
    await page.waitForTimeout(400);
    await expect(inShadow(page, '.makan-btn-float')).toHaveCount(0);
  });

  test('card controls: Copy, Swap, close button and Escape', async ({ ext }) => {
    const page = ext.article;
    await ext.context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(page.url()).origin });
    await dragSelect(page, '#li1');
    await pressM(page);
    const result = inShadow(page, '.makan-result-text');
    await expect(result).toHaveText('[fa] First item in the list of things.');

    // Copy
    await inShadow(page, '#makanCopyBtn').click();
    await expect(inShadow(page, '#makanCopyBtn span')).toHaveText('Copied!');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('[fa] First item in the list of things.');

    // Swap: translates the translation back the other way.
    await inShadow(page, '#makanSwapBtn').click();
    await expect(inShadow(page, '#makanPairPill')).toHaveText('FA → EN');
    await expect(result).toHaveText('[en] [fa] First item in the list of things.');
    await expect(result).toHaveAttribute('dir', 'ltr');

    // Close button
    await inShadow(page, '#makanCardClose').click();
    await expect(card(page)).toHaveCount(0);

    // Escape key
    await dragSelect(page, '#li2');
    await pressM(page);
    await expect(card(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(card(page)).toHaveCount(0);

    // Clicking elsewhere on the page closes it too.
    await page.mouse.click(5, 5); // first clear the old selection, as a user would
    await dragSelect(page, '#p1');
    await pressM(page);
    await expect(card(page)).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(card(page)).toHaveCount(0);
    expect(ext.pageErrors).toEqual([]);
  });

  test('"Detected" shows FA when Persian text is selected', async ({ ext }) => {
    const page = ext.article;
    await dragSelect(page, '#fa1');
    await pressM(page);
    await expect(inShadow(page, '.makan-result-text')).toBeVisible();
    await expect(inShadow(page, '#makanDetectedPill')).toHaveText('Detected: FA');
  });

  test('"Open in App" links to the web app with the text and languages', async ({ ext }) => {
    const page = ext.article;
    await dragSelect(page, '#li1');
    await pressM(page);
    await expect(inShadow(page, '.makan-result-text')).toBeVisible();
    const href = await inShadow(page, '#makanOpenApp').getAttribute('href');
    const u = new URL(href);
    expect(u.origin).toBe('http://localhost:8080');
    const params = u.searchParams.get('text') ? u.searchParams : new URLSearchParams(u.hash.replace(/^#/, ''));
    expect(params.get('text')).toBe('First item in the list of things.');
    expect(params.get('tgt')).toBe('fa');
  });

  test.describe('Speak button', () => {
    test('without a Gemini key or a device voice, Speak shows a clear "no voice" message', async ({ ext }) => {
      const page = ext.article;
      const voices = await page.evaluate(() => speechSynthesis.getVoices().length);
      test.info().annotations.push({ type: 'device voices in this browser', description: String(voices) });
      await dragSelect(page, '#li1');
      await pressM(page);
      await expect(inShadow(page, '.makan-result-text')).toBeVisible();
      await inShadow(page, '#makanSpeakBtn').click();
      await expect(inShadow(page, '.makan-voice-notice')).toContainText(/voice installed/i);
    });

    test('the card can use the computer\'s own voices (voice helpers are available to the content script)', async ({ ext }) => {
      // content.js only uses device voices when pickBestVoice() exists in its
      // world; otherwise it never calls speechSynthesis and always asks Gemini.
      const page = ext.article;
      const r = await inContentScriptWorld(ext, page, `({ pickBestVoice: typeof pickBestVoice, splitTextForSpeech: typeof splitTextForSpeech, getNoVoiceMessage: typeof getNoVoiceMessage })`);
      expect(r).toEqual({ pickBestVoice: 'function', splitTextForSpeech: 'function', getNoVoiceMessage: 'function' });
    });
  });

  test.describe('with a Gemini key', () => {
    test.use({ extOptions: { config: { eng: { gemini: { on: true, key: VALID_KEY } } } } });

    test('Speak plays Gemini voice through the background and shows the playing state', async ({ ext, stub }) => {
      const page = ext.article;
      await dragSelect(page, '#li1');
      await pressM(page);
      await expect(inShadow(page, '.makan-result-text')).toHaveText('[fa] First item in the list of things.');
      await inShadow(page, '#makanSpeakBtn').click();
      await expect.poll(() => stub.calls('generativelanguage.googleapis.com').filter(c => /:streamGenerateContent$/.test(c.path)).length, { message: 'streamed voice request' }).toBeGreaterThan(0);
      const tts = stub.calls('generativelanguage.googleapis.com').find(c => /:streamGenerateContent$/.test(c.path));
      expect(JSON.parse(tts.body).contents[0].parts[0].text).toBe('[fa] First item in the list of things.');
      // While the ~1.6 s of audio plays, the button should offer "Stop" (a second press stops speech).
      await expect(inShadow(page, '#makanSpeakBtn span'), 'Speak button label while audio is playing').toHaveText('Stop', { timeout: 1000 });
      // It finishes on its own (the stub's audio is under a second) and the button returns to "Speak".
      await expect(inShadow(page, '#makanSpeakBtn span')).toHaveText('Speak', { timeout: 15_000 });
      await expectNoExtensionErrors(ext);
    });

    test('double-clicking a single word opens a dictionary card', async ({ ext, stub }) => {
      const page = ext.article;
      await dblclickText(page, '#p3');
      await expect(inShadow(page, '.makan-dict-word')).toHaveText('Serendipity');
      await expect(inShadow(page, '.makan-dict-phonetic')).toHaveText('/wɜːd/');
      await expect(inShadow(page, '.makan-dict-pos')).toHaveText('noun');
      await expect(inShadow(page, '.makan-dict-trans')).toContainText('[fa] Serendipity');
      await expect(inShadow(page, '#makanEnginePill')).toHaveText('Google Gemini');
      const req = stub.calls('generativelanguage.googleapis.com')[0];
      expect(req.headers['x-goog-api-key']).toBe(VALID_KEY);
    });

    test('three-way mode choice (Both, Fast, Smart) in selection card', async ({ ext, stub }) => {
      const page = ext.article;
      await dragSelect(page, '#li1');
      await pressM(page);
      await expect(card(page)).toBeVisible();
      const modeSel = inShadow(page, '#makanModeSel');
      await expect(modeSel).toBeVisible();
      await expect(modeSel).toHaveValue('both');
      await expect(inShadow(page, '#makanEnginePill')).toHaveText('Google Gemini');

      // Switch to Fast mode
      await modeSel.selectOption('fast');
      await expect(inShadow(page, '.makan-result-text')).toHaveText('[fa] First item in the list of things.');
      await expect(inShadow(page, '#makanEnginePill')).toHaveText('Google Translate');
    });
  });

  test('double-click without an AI key falls back to a plain translation', async ({ ext }) => {
    const page = ext.article;
    await dblclickText(page, '#p3');
    await expect(inShadow(page, '.makan-result-text')).toHaveText('[fa] Serendipity');
    await expect(inShadow(page, '#makanEnginePill')).toHaveText('Google Translate');
  });
});
