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
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(16000, 24);
  buf.writeUInt32LE(32000, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(0, 40);
  return buf;
}

test.describe('Open in App protects Media tab work without unmounting or reloading', () => {

  test('delivering translation input fills Text tab and switches to it without resetting Media tab state', async ({ app }) => {
    const { page, context, errors } = app;

    // Inject mock desktop API before reloading so onLoadTranslationInput registers and Media mount is intercepted
    await context.addInitScript(() => {
      let realMediaTranslate = undefined;
      window.__mediaMountCount = 0;

      Object.defineProperty(window, 'MediaTranslate', {
        configurable: true,
        enumerable: true,
        get: () => realMediaTranslate,
        set: (val) => {
          realMediaTranslate = val;
          if (val && typeof val.mount === 'function' && !val.__wrappedForTest) {
            const origMount = val.mount;
            val.mount = function (...args) {
              window.__mediaMountCount = (window.__mediaMountCount || 0) + 1;
              return origMount.apply(this, args);
            };
            val.__wrappedForTest = true;
          }
        }
      });

      window.makanDesktop = {
        isDesktop: true,
        startScreenTranslator: () => {},
        getOcrLanguages: () => Promise.resolve([
          { tag: 'en-US', displayName: 'English', nativeName: 'English' },
          { tag: 'fa-IR', displayName: 'Persian', nativeName: 'فارسی' }
        ]),
        getOcrEngines: () => Promise.resolve([
          { id: 'windows', name: 'Windows Media OCR', available: true }
        ]),
        getScreenTransConfig: () => Promise.resolve({ enabled: true }),
        saveScreenTransConfig: () => Promise.resolve({ ok: true }),
        loadAppConfig: () => Promise.resolve({}),
        saveAppConfig: () => Promise.resolve({ ok: true }),
        getDesktopAudioSource: () => Promise.resolve(null),
        onExecuteScreenTranslation: () => {},
        sendScreenTranslationResponse: () => {},
        onLoadTranslationInput: (handler) => {
          window.__loadTranslationInputCb = handler;
        }
      };
    });

    await page.reload();
    await expect(page.locator('#tabs button').first()).toBeVisible();

    // 1. Mount the Media tab
    const mediaBtn = page.locator('#tabs button[data-tab="media"]');
    await expect(mediaBtn).toBeVisible();
    await mouseClick(page, mediaBtn);

    const mediaSection = page.locator('#tab-media');
    await expect(mediaSection).toBeVisible();
    await expect(mediaSection).toHaveClass(/\bon\b/);

    const rootMounts = page.locator('#tab-media .mt-root');
    await expect(rootMounts).toHaveCount(1);

    // 2. Load a small fake audio file into Media tab to establish active Media work
    const tinyWav = createTinyWav();
    const fileInput = mediaSection.locator('.mt-file-input');
    await fileInput.setInputFiles({
      name: 'protected-recording.wav',
      mimeType: 'audio/wav',
      buffer: tinyWav
    });

    const infoCard = mediaSection.locator('.mt-info');
    await expect(infoCard).toBeVisible();
    const fileName = infoCard.locator('.mt-info-name');
    await expect(fileName).toHaveText('protected-recording.wav');
    await expect(infoCard.locator('.mt-info-size')).toBeVisible();

    // Verify initial mount count is exactly 1
    const initialMountCount = await page.evaluate(() => window.__mediaMountCount || 1);
    expect(initialMountCount).toBe(1);

    // 3. Trigger "Open in App" by calling the stored callback
    await page.evaluate(() => {
      window.__loadTranslationInputCb({
        text: 'This is translation input sent from the extension.',
        src: 'en',
        tgt: 'fa'
      });
    });

    // 4. Assert the Text tab is now active and populated
    const textSection = page.locator('#tab-text');
    const textBtn = page.locator('#tabs button[data-tab="text"]');
    await expect(textSection).toBeVisible();
    await expect(textBtn).toHaveClass(/\bon\b/);

    const tIn = page.locator('#tIn');
    await expect(tIn).toHaveValue('This is translation input sent from the extension.');
    await expect(page.locator('#tgt')).toHaveValue('fa');

    // 5. Click the Media tab again
    await mouseClick(page, mediaBtn);
    await expect(mediaSection).toBeVisible();

    // 6. Assert Media state is still completely intact:
    // Info block is still visible, file name unchanged, and mount ran exactly once (no remount)
    await expect(infoCard).toBeVisible();
    await expect(fileName).toHaveText('protected-recording.wav');
    await expect(rootMounts).toHaveCount(1);

    const finalMountCount = await page.evaluate(() => window.__mediaMountCount || 1);
    expect(finalMountCount).toBe(1);

    // 7. Verify no unexpected errors occurred
    expect(errors).toEqual([]);
  });

});
