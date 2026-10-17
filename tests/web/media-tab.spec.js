'use strict';

const { test, expect, mouseClick } = require('../support/fixtures');

/**
 * Creates a valid 44-byte 16 kHz mono PCM WAV file header.
 */
function createTinyWav() {
  const buf = Buffer.alloc(44);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // subchunk1size (PCM = 16)
  buf.writeUInt16LE(1, 20);  // audioFormat (1 = PCM)
  buf.writeUInt16LE(1, 22);  // numChannels (1 = mono)
  buf.writeUInt32LE(16000, 24); // sampleRate (16 kHz)
  buf.writeUInt32LE(32000, 28); // byteRate (16000 * 1 * 2)
  buf.writeUInt16LE(2, 32);  // blockAlign (1 * 2)
  buf.writeUInt16LE(16, 34); // bitsPerSample (16)
  buf.write('data', 36);
  buf.writeUInt32LE(0, 40);  // subchunk2size (0 bytes of data)
  return buf;
}

test.describe('Web app: Media tab (ITEM 1)', () => {

  test('the Media tab button exists, opens section, mounts once, and resolves EN/FA strings with no console errors', async ({ app }) => {
    const { page, errors } = app;

    // 1. Sidebar button exists
    const mediaBtn = page.locator('#tabs button[data-tab="media"]');
    await expect(mediaBtn).toBeVisible();
    await expect(mediaBtn).toHaveAttribute('data-t', 'tabMedia');
    await expect(mediaBtn).toHaveText('Media');

    // 2. Open Media tab
    await mouseClick(page, mediaBtn);
    const mediaSection = page.locator('#tab-media');
    await expect(mediaSection).toBeVisible();
    await expect(mediaSection).toHaveClass(/\bon\b/);
    await expect(mediaBtn).toHaveClass(/\bon\b/);
    await expect(mediaBtn).toHaveAttribute('aria-selected', 'true');

    // Header title and subtitle are present and translated in English
    const titleEl = mediaSection.locator('.media-page-title');
    const subEl = mediaSection.locator('.media-page-sub');
    await expect(titleEl).toBeVisible();
    await expect(titleEl).toHaveText('Media Translate');
    await expect(subEl).toBeVisible();
    await expect(subEl).toHaveText('Turn speech in audio or video files into subtitles in any language.');

    // 3. Mount happens once
    const rootMounts = page.locator('#tab-media .mt-root');
    await expect(rootMounts).toHaveCount(1);
    await expect(mediaSection.locator('.mt-drop')).toBeVisible();

    // Switch to another tab (e.g. Text) and back to Media; mount still exactly once
    await mouseClick(page, page.locator('#tabs button[data-tab="text"]'));
    await expect(mediaSection).toBeHidden();
    await mouseClick(page, mediaBtn);
    await expect(mediaSection).toBeVisible();
    await expect(rootMounts).toHaveCount(1);

    // 4. Verify no raw "media..." keys visible in English
    const enRawKeys = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('#tab-media [data-mt-i18n], #tab-media [data-t]'));
      return nodes
        .map(n => n.textContent.trim())
        .filter(txt => /^media[A-Z0-9]/.test(txt));
    });
    expect(enRawKeys, 'No un-translated media keys visible in English').toEqual([]);

    // 5. Switching language refreshes Media tab
    const langBtn = page.locator('#uiLang');
    await mouseClick(page, langBtn); // switch to Persian
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
    await expect(titleEl).toHaveText('ترجمه رسانه');
    await expect(subEl).toHaveText('گفتار فایل‌های صوتی و تصویری را به زیرنویس در هر زبانی تبدیل کنید.');
    await expect(mediaBtn).toHaveText('رسانه');

    // In Persian: no raw "media..." keys visible either
    const faRawKeys = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('#tab-media [data-mt-i18n], #tab-media [data-t]'));
      return nodes
        .map(n => n.textContent.trim())
        .filter(txt => /^media[A-Z0-9]/.test(txt));
    });
    expect(faRawKeys, 'No un-translated media keys visible in Persian').toEqual([]);

    // Switch back to English
    await mouseClick(page, langBtn);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(titleEl).toHaveText('Media Translate');

    // 6. Dropping a tiny generated WAV shows the file card
    const tinyWav = createTinyWav();
    const fileInput = mediaSection.locator('.mt-file-input');
    await fileInput.setInputFiles({
      name: 'sample-speech.wav',
      mimeType: 'audio/wav',
      buffer: tinyWav
    });

    const infoCard = mediaSection.locator('.mt-info');
    await expect(infoCard).toBeVisible();
    await expect(infoCard.locator('.mt-info-name')).toHaveText('sample-speech.wav');

    // 7. Global pollution check: window.MediaTranslate is the ONLY new global
    const globalChecks = await page.evaluate(() => {
      return {
        hasMediaTranslate: typeof window.MediaTranslate === 'object' && window.MediaTranslate !== null,
        hasMediaHandle: 'mediaHandle' in window,
        hasMediaMounting: 'mediaMounting' in window,
        hasMT: 'MT' in window,
        hasEnsureMediaMounted: 'ensureMediaMounted' in window,
        hasGetMediaWhisperChoice: 'getMediaWhisperChoice' in window,
        hasMediaTranslateCues: 'mediaTranslateCues' in window,
        hasGetMediaTranslateChoice: 'getMediaTranslateChoice' in window
      };
    });

    expect(globalChecks.hasMediaTranslate, 'window.MediaTranslate must exist').toBe(true);
    expect(globalChecks.hasMediaHandle, 'window.mediaHandle must NOT be on window').toBe(false);
    expect(globalChecks.hasMediaMounting, 'window.mediaMounting must NOT be on window').toBe(false);
    expect(globalChecks.hasMT, 'window.MT must NOT be on window').toBe(false);
    expect(globalChecks.hasEnsureMediaMounted, 'window.ensureMediaMounted must NOT be on window').toBe(false);
    expect(globalChecks.hasGetMediaWhisperChoice, 'window.getMediaWhisperChoice must NOT be on window').toBe(false);
    expect(globalChecks.hasMediaTranslateCues, 'window.mediaTranslateCues must NOT be on window').toBe(false);
    expect(globalChecks.hasGetMediaTranslateChoice, 'window.getMediaTranslateChoice must NOT be on window').toBe(false);

    // 8. No console errors
    expect(errors, 'console errors during Media tab interaction').toEqual([]);
  });

});
