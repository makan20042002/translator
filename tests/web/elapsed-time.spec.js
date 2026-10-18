'use strict';

const { test, expect, mouseClick } = require('../support/fixtures');

/**
 * Creates a valid 16 kHz mono PCM WAV Buffer of given duration.
 */
function createTestWav(durationSec = 0.25, sampleRate = 16000) {
  const numSamples = Math.floor(durationSec * sampleRate);
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  return buf;
}

test.describe('Elapsed time formatting and done message indicators (ITEM 2)', () => {

  test('formatter handles 0, 1, 59, 60, 61, 125, 3600 seconds in EN and FA', async ({ app }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await expect(page.locator('#tab-media')).toBeVisible();

    const results = await page.evaluate(() => {
      const fn = window.MediaTranslate?.formatElapsedTime;
      const testCases = [0, 1, 59, 60, 61, 125, 3600];
      return {
        en: testCases.map(s => fn(s, 'en')),
        fa: testCases.map(s => fn(s, 'fa'))
      };
    });

    // English expectations
    expect(results.en).toEqual([
      '0 s',
      '1 s',
      '59 s',
      '1 min',
      '1 min 1 s',
      '2 min 5 s',
      '60 min'
    ]);

    // Persian expectations with Latin digits
    expect(results.fa).toEqual([
      '0 ثانیه',
      '1 ثانیه',
      '59 ثانیه',
      '1 دقیقه',
      '1 دقیقه و 1 ثانیه',
      '2 دقیقه و 5 ثانیه',
      '60 دقیقه'
    ]);
  });

  test('Media transcription done message contains elapsed time in EN and FA', async ({ app }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await expect(page.locator('#tab-media')).toBeVisible();

    await page.evaluate(() => {
      // Mock Date.now so we can simulate 125 seconds of elapsed time without waiting
      let fakeTime = 1000000;
      const origDateNow = Date.now;
      window.__fakeDateNow = () => fakeTime;
      Date.now = () => fakeTime;

      window.MediaTranslate.host.getWhisperChoice = () => ({
        repo: 'Xenova/whisper-tiny',
        name: 'Whisper Tiny',
        memMB: 500,
        ready: true,
        gpu: false
      });

      window.MediaTranslate.host.engine = {
        libUrl: 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1',
        workerFactory: function () {
          const self = {
            onmessage: null,
            onerror: null,
            postMessage: function (data) {
              const { id, cmd } = data || {};
              setTimeout(() => {
                if (!self.onmessage) return;
                if (cmd === 'init' || cmd === 'load') {
                  self.onmessage({
                    data: {
                      id,
                      ok: true,
                      res: {
                        device: 'wasm',
                        threads: 4,
                        crossOriginIsolated: true,
                        gpuNote: ''
                      }
                    }
                  });
                } else if (cmd === 'asr') {
                  // Fast forward simulated clock by 125 seconds before returning
                  fakeTime += 125000;
                  self.onmessage({
                    data: {
                      id,
                      ok: true,
                      res: {
                        text: 'Test audio text',
                        chunks: [{ text: 'Test audio text', timestamp: [0, 0.2] }],
                        lang: 'en'
                      }
                    }
                  });
                } else {
                  self.onmessage({ data: { id, ok: true, res: true } });
                }
              }, 10);
            },
            terminate: function () {}
          };
          return self;
        }
      };
    });

    const wavBuffer = createTestWav(0.2, 16000);
    const fileInput = page.locator('#tab-media .mt-file-input');
    await fileInput.setInputFiles({
      name: 'sample-timer.wav',
      mimeType: 'audio/wav',
      buffer: wavBuffer
    });

    const transcribeBtn = page.locator('#tab-media .mt-transcribe');
    await expect(transcribeBtn).toBeVisible();
    await mouseClick(page, transcribeBtn);

    const asrOkEl = page.locator('#tab-media .mt-asr-ok');
    await expect(asrOkEl).toBeVisible();
    await expect(asrOkEl).toContainText('Done in 2 min 5 s:');
    await expect(asrOkEl).toContainText('1 segments');

    // Test FA localization
    const langBtn = page.locator('#uiLang');
    await mouseClick(page, langBtn);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
    await expect(asrOkEl).toContainText('انجام شد در 2 دقیقه و 5 ثانیه:');
    await expect(asrOkEl).toContainText('1 قطعه');

    await mouseClick(page, langBtn);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('Media translation done message contains elapsed time in EN and FA', async ({ app }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await expect(page.locator('#tab-media')).toBeVisible();

    await page.evaluate(() => {
      let fakeTime = 2000000;
      Date.now = () => fakeTime;

      // Mock translateCues on host to advance clock by 61 seconds
      window.MediaTranslate.host.translateCues = async (cues, opts) => {
        fakeTime += 61000;
        opts.onInfo?.({ name: 'Google', kind: 'online', model: '' });
        return cues.map(c => ({ s: c.s, e: c.e, o: c.o, t: 'Translated text' }));
      };
    });

    // Provide existing cues so Translation card is shown
    await page.evaluate(() => {
      const handle = window.__mtHandle; // or trigger through dummy cues
      // Trigger transcription to populate cues
      window.MediaTranslate.host.getWhisperChoice = () => ({
        repo: 'Xenova/whisper-tiny',
        name: 'Whisper Tiny',
        memMB: 500,
        ready: true,
        gpu: false
      });
      window.MediaTranslate.host.engine = {
        libUrl: 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1',
        workerFactory: function () {
          const self = {
            onmessage: null,
            onerror: null,
            postMessage: function (data) {
              const { id, cmd } = data || {};
              setTimeout(() => {
                if (!self.onmessage) return;
                if (cmd === 'init' || cmd === 'load') {
                  self.onmessage({ data: { id, ok: true, res: { device: 'wasm', threads: 1 } } });
                } else if (cmd === 'asr') {
                  self.onmessage({
                    data: {
                      id, ok: true,
                      res: {
                        text: 'Line 1',
                        chunks: [{ text: 'Line 1', timestamp: [0, 0.2] }],
                        lang: 'en'
                      }
                    }
                  });
                }
              }, 10);
            },
            terminate: function () {}
          };
          return self;
        }
      };
    });

    const wavBuffer = createTestWav(0.2, 16000);
    const fileInput = page.locator('#tab-media .mt-file-input');
    await fileInput.setInputFiles({
      name: 'sample-tr-timer.wav',
      mimeType: 'audio/wav',
      buffer: wavBuffer
    });

    const transcribeBtn = page.locator('#tab-media .mt-transcribe');
    await mouseClick(page, transcribeBtn);
    await expect(page.locator('#tab-media .mt-asr-ok')).toBeVisible();

    // Now start translation
    const trCard = page.locator('#tab-media .mt-tr-card');
    await expect(trCard).toBeVisible();

    const trTgtSel = page.locator('#tab-media .mt-tr-tgt');
    await trTgtSel.selectOption('fa');

    const translateBtn = page.locator('#tab-media .mt-tr-start');
    await expect(translateBtn).toBeEnabled();
    await mouseClick(page, translateBtn);

    const trOkEl = page.locator('#tab-media .mt-tr-ok');
    await expect(trOkEl).toBeVisible();
    await expect(trOkEl).toContainText('in 1 min 1 s.');

    // FA localization
    const langBtn = page.locator('#uiLang');
    await mouseClick(page, langBtn);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
    await expect(trOkEl).toContainText('در 1 دقیقه و 1 ثانیه ترجمه شد.');

    await mouseClick(page, langBtn);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('cancelled run shows no elapsed time in done message', async ({ app }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await expect(page.locator('#tab-media')).toBeVisible();

    await page.evaluate(() => {
      window.MediaTranslate.host.getWhisperChoice = () => ({
        repo: 'Xenova/whisper-tiny',
        name: 'Whisper Tiny',
        memMB: 500,
        ready: true,
        gpu: false
      });
      window.MediaTranslate.host.engine = {
        libUrl: 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1',
        workerFactory: function () {
          const self = {
            onmessage: null,
            onerror: null,
            postMessage: function (data) {
              const { id, cmd } = data || {};
              // Keep loading pending until cancelled
              if (cmd === 'init') {
                setTimeout(() => self.onmessage && self.onmessage({ data: { id, ok: true, res: true } }), 10);
              }
            },
            terminate: function () {}
          };
          return self;
        }
      };
    });

    const wavBuffer = createTestWav(0.2, 16000);
    const fileInput = page.locator('#tab-media .mt-file-input');
    await fileInput.setInputFiles({
      name: 'sample-cancel.wav',
      mimeType: 'audio/wav',
      buffer: wavBuffer
    });

    const transcribeBtn = page.locator('#tab-media .mt-transcribe');
    await expect(transcribeBtn).toBeVisible();
    await mouseClick(page, transcribeBtn);

    // Cancel transcribe while loading
    const cancelBtn = page.locator('#tab-media .mt-asr-cancel');
    await expect(cancelBtn).toBeVisible();
    await mouseClick(page, cancelBtn);

    const asrOkEl = page.locator('#tab-media .mt-asr-ok');
    await expect(asrOkEl).toBeVisible();
    await expect(asrOkEl).toHaveText('Cancelled.');
    // Confirm no time strings are present
    const text = await asrOkEl.textContent();
    expect(text).not.toContain('Done in');
    expect(text).not.toContain('min');
    expect(text).not.toMatch(/\d+\s*s/);
  });

});
