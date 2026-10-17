'use strict';

const { test, expect } = require('../support/fixtures');

test.describe('Web app: compact voice picker labels and error guard', () => {
  test('updateCompactVoiceButtons updates voice labels without error when custom voice is configured', async ({ app }) => {
    const { page } = app;

    // Collect uncaught page errors
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message || String(err)));

    const customVoice = 'gemini:Puck';

    // In the page, ensure no voices installed and cfg.tts.voices is set to a custom value for target language
    const expectedName = await page.evaluate((custom) => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.getVoices = () => [];
      }
      const tgtLang = (document.getElementById('tgt')?.value || 'fa').split('-')[0].toLowerCase();
      if (!cfg.tts) cfg.tts = {};
      if (!cfg.tts.voices) cfg.tts.voices = {};
      cfg.tts.voices[tgtLang] = custom;
      if (typeof saveCfg === 'function') saveCfg();

      // Call top-level updateCompactVoiceButtons()
      updateCompactVoiceButtons();

      return typeof getVoiceDisplayName === 'function'
        ? getVoiceDisplayName(custom, tgtLang)
        : custom;
    }, customVoice);

    // Assert: no page error was raised
    expect(pageErrors, 'no uncaught page errors when calling updateCompactVoiceButtons').toEqual([]);

    // Assert: #tVoiceCurLabel text equals its title and matches expected display name
    const tLabel = page.locator('#tVoiceCurLabel');
    const tText = await tLabel.textContent();
    const tTitle = await tLabel.getAttribute('title');
    expect(tText).toBe(tTitle);
    expect(tText).toBe(expectedName);

    // Assert: #vConvVoiceCurLabel text equals its title and matches expected display name
    const convLabel = page.locator('#vConvVoiceCurLabel');
    const convText = await convLabel.textContent();
    const convTitle = await convLabel.getAttribute('title');
    expect(convText).toBe(convTitle);
    expect(convText).toBe(expectedName);

    // Assert: #vLiveVoiceCurLabel text equals its title and matches expected display name
    const liveLabel = page.locator('#vLiveVoiceCurLabel');
    const liveText = await liveLabel.textContent();
    const liveTitle = await liveLabel.getAttribute('title');
    expect(liveText).toBe(liveTitle);
    expect(liveText).toBe(expectedName);
  });
});
