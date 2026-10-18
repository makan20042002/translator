'use strict';

const { test, expect, mouseClick } = require('../support/fixtures');
const { COLOR_HELPERS_SOURCE } = require('../support/color-helpers');

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

test.describe('Media tab: Whisper device and thread indicator line (ITEM 2)', () => {

  test('GPU case: shows "Running on: GPU (WebGPU)" in EN and Persian in FA', async ({ app }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await expect(page.locator('#tab-media')).toBeVisible();

    // Configure fake worker returning GPU WebGPU device
    await page.evaluate(() => {
      window.MediaTranslate.host.getWhisperChoice = () => ({
        repo: 'Xenova/whisper-tiny',
        name: 'Whisper Tiny',
        memMB: 500,
        ready: true,
        gpu: true
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
                if (cmd === 'init') {
                  self.onmessage({ data: { id, ok: true, res: true } });
                } else if (cmd === 'load') {
                  self.onmessage({
                    data: {
                      id,
                      ok: true,
                      res: {
                        device: 'webgpu',
                        threads: 4,
                        crossOriginIsolated: true,
                        gpuNote: ''
                      }
                    }
                  });
                } else if (cmd === 'asr') {
                  self.onmessage({
                    data: {
                      id,
                      ok: true,
                      res: {
                        text: 'GPU transcription result',
                        chunks: [{ text: 'GPU transcription result', timestamp: [0, 0.2] }],
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
      name: 'sample.wav',
      mimeType: 'audio/wav',
      buffer: wavBuffer
    });

    const transcribeBtn = page.locator('#tab-media .mt-transcribe');
    await expect(transcribeBtn).toBeVisible();
    await mouseClick(page, transcribeBtn);

    const deviceEl = page.locator('#tab-media .mt-asr-device');
    await expect(deviceEl).toBeVisible();
    await expect(deviceEl).toHaveText('Running on: GPU (WebGPU)');

    // Switch to Persian and assert translated device text
    const langBtn = page.locator('#uiLang');
    await mouseClick(page, langBtn);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
    await expect(deviceEl).toHaveText('محل اجرا: پردازنده گرافیکی (WebGPU)');

    // Switch back to English
    await mouseClick(page, langBtn);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(deviceEl).toHaveText('Running on: GPU (WebGPU)');
  });

  test('CPU multi-thread case: shows "Running on: CPU, N threads" in EN and FA', async ({ app }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await expect(page.locator('#tab-media')).toBeVisible();

    await page.evaluate(() => {
      window.MediaTranslate.host.getWhisperChoice = () => ({
        repo: 'Xenova/whisper-base',
        name: 'Whisper Base',
        memMB: 1000,
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
                if (cmd === 'init') {
                  self.onmessage({ data: { id, ok: true, res: true } });
                } else if (cmd === 'load') {
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
                  self.onmessage({
                    data: {
                      id,
                      ok: true,
                      res: {
                        text: 'Multi thread result',
                        chunks: [{ text: 'Multi thread result', timestamp: [0, 0.2] }],
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
      name: 'sample-multi.wav',
      mimeType: 'audio/wav',
      buffer: wavBuffer
    });

    const transcribeBtn = page.locator('#tab-media .mt-transcribe');
    await expect(transcribeBtn).toBeVisible();
    await mouseClick(page, transcribeBtn);

    const deviceEl = page.locator('#tab-media .mt-asr-device');
    await expect(deviceEl).toBeVisible();
    await expect(deviceEl).toHaveText('Running on: CPU, 4 threads');

    // Test FA localization
    const langBtn = page.locator('#uiLang');
    await mouseClick(page, langBtn);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
    await expect(deviceEl).toHaveText('محل اجرا: پردازنده (CPU)، 4 رشته پردازشی');

    await mouseClick(page, langBtn);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('CPU one-thread case: shows 1 thread and honest slow note when page is not cross-origin isolated', async ({ app }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await expect(page.locator('#tab-media')).toBeVisible();

    await page.evaluate(() => {
      window.MediaTranslate.host.getWhisperChoice = () => ({
        repo: 'Xenova/whisper-base',
        name: 'Whisper Base',
        memMB: 1000,
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
                if (cmd === 'init') {
                  self.onmessage({ data: { id, ok: true, res: true } });
                } else if (cmd === 'load') {
                  self.onmessage({
                    data: {
                      id,
                      ok: true,
                      res: {
                        device: 'wasm',
                        threads: 1,
                        crossOriginIsolated: false,
                        gpuNote: ''
                      }
                    }
                  });
                } else if (cmd === 'asr') {
                  self.onmessage({
                    data: {
                      id,
                      ok: true,
                      res: {
                        text: 'Single thread result',
                        chunks: [{ text: 'Single thread result', timestamp: [0, 0.2] }],
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
      name: 'sample-single.wav',
      mimeType: 'audio/wav',
      buffer: wavBuffer
    });

    const transcribeBtn = page.locator('#tab-media .mt-transcribe');
    await expect(transcribeBtn).toBeVisible();
    await mouseClick(page, transcribeBtn);

    const deviceEl = page.locator('#tab-media .mt-asr-device');
    await expect(deviceEl).toBeVisible();
    await expect(deviceEl).toContainText('Running on: CPU, 1 thread');
    await expect(deviceEl).toContainText('Slow: this page can use only one CPU thread.');

    // In Persian
    const langBtn = page.locator('#uiLang');
    await mouseClick(page, langBtn);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
    await expect(deviceEl).toContainText('محل اجرا: پردازنده (CPU)، ۱ رشته پردازشی');
    await expect(deviceEl).toContainText('کند: این صفحه فقط می‌تواند از یک رشته پردازنده استفاده کند.');

    await mouseClick(page, langBtn);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('GPU-failed-fallback case: shows plain reason in one short sentence when GPU was tried and failed', async ({ app }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await expect(page.locator('#tab-media')).toBeVisible();

    await page.evaluate(() => {
      window.MediaTranslate.host.getWhisperChoice = () => ({
        repo: 'Xenova/whisper-small',
        name: 'Whisper Small',
        memMB: 2000,
        ready: true,
        gpu: true
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
                if (cmd === 'init') {
                  self.onmessage({ data: { id, ok: true, res: true } });
                } else if (cmd === 'load') {
                  self.onmessage({
                    data: {
                      id,
                      ok: true,
                      res: {
                        device: 'wasm',
                        threads: 4,
                        crossOriginIsolated: true,
                        gpuNote: 'WebGPU is not available here'
                      }
                    }
                  });
                } else if (cmd === 'asr') {
                  self.onmessage({
                    data: {
                      id,
                      ok: true,
                      res: {
                        text: 'Fallback result',
                        chunks: [{ text: 'Fallback result', timestamp: [0, 0.2] }],
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
      name: 'sample-fallback.wav',
      mimeType: 'audio/wav',
      buffer: wavBuffer
    });

    const transcribeBtn = page.locator('#tab-media .mt-transcribe');
    await expect(transcribeBtn).toBeVisible();
    await mouseClick(page, transcribeBtn);

    const deviceEl = page.locator('#tab-media .mt-asr-device');
    await expect(deviceEl).toBeVisible();
    await expect(deviceEl).toContainText('Running on: CPU, 4 threads');
    await expect(deviceEl).toContainText('WebGPU is not available here');

    // In Persian
    const langBtn = page.locator('#uiLang');
    await mouseClick(page, langBtn);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
    await expect(deviceEl).toContainText('محل اجرا: پردازنده (CPU)، 4 رشته پردازشی');
    await expect(deviceEl).toContainText('پردازنده گرافیکی ناموفق بود (WebGPU is not available here)، بازگشت به پردازنده.');

    await mouseClick(page, langBtn);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('theme contrast >= 4.5 in light themes, makan-lab unchanged, and no RTL horizontal overflow at 360 and 1280 px', async ({ app }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await expect(page.locator('#tab-media')).toBeVisible();

    // Prepare and transcribe once so .mt-asr-device is rendered and visible
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
              setTimeout(() => {
                if (!self.onmessage) return;
                if (cmd === 'init') {
                  self.onmessage({ data: { id, ok: true, res: true } });
                } else if (cmd === 'load') {
                  self.onmessage({
                    data: {
                      id,
                      ok: true,
                      res: {
                        device: 'wasm',
                        threads: 1,
                        crossOriginIsolated: false,
                        gpuNote: ''
                      }
                    }
                  });
                } else if (cmd === 'asr') {
                  self.onmessage({
                    data: {
                      id,
                      ok: true,
                      res: {
                        text: 'Contrast test',
                        chunks: [{ text: 'Contrast test', timestamp: [0, 0.2] }],
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
      name: 'sample-theme.wav',
      mimeType: 'audio/wav',
      buffer: wavBuffer
    });

    const transcribeBtn = page.locator('#tab-media .mt-transcribe');
    await expect(transcribeBtn).toBeVisible();
    await mouseClick(page, transcribeBtn);

    const deviceEl = page.locator('#tab-media .mt-asr-device');
    await expect(deviceEl).toBeVisible();

    // Inject shared color helpers
    await page.addScriptTag({ content: COLOR_HELPERS_SOURCE });

    const THEMES = [
      'makan-lab',
      'platinum-blue',
      'dracula',
      'champagne-minimal',
      'rose-titanium',
      'royal-amethyst',
      'obsidian-gold'
    ];

    let makanLabCardBg = '';
    let makanLabText = '';
    const violations = [];

    for (const themeId of THEMES) {
      await page.evaluate((id) => {
        if (typeof applyTheme === 'function') {
          applyTheme(id);
        } else {
          document.documentElement.setAttribute('data-theme', id);
        }
      }, themeId);
      await page.waitForTimeout(60);

      const metrics = await page.evaluate(({ currentTheme }) => {
        const el = document.querySelector('.mt-asr-device');
        const card = document.querySelector('.mt-card.mt-asr');
        if (!el || !card) return { contrast: 0, cardBg: '', text: '' };

        const cs = window.getComputedStyle(el);
        const cardCs = window.getComputedStyle(card);
        const textRgb = window.__tc.parse(cs.color);
        const eff = window.__tc.effectiveBg(el);
        const ratio = window.__tc.ratio(textRgb, eff.bg);

        return {
          contrast: ratio,
          cardBg: cardCs.backgroundColor,
          text: cs.color
        };
      }, { currentTheme: themeId });

      if (themeId === 'platinum-blue' || themeId === 'champagne-minimal') {
        if (metrics.contrast < 4.5) {
          violations.push({
            theme: themeId,
            contrast: metrics.contrast
          });
        }
      }

      if (themeId === 'makan-lab') {
        makanLabCardBg = metrics.cardBg;
        makanLabText = metrics.text;
      }
    }

    expect(violations, 'Light themes must meet >= 4.5 contrast for .mt-asr-device').toEqual([]);

    // makan-lab values must remain locked to design tokens
    // Makan Lab: --panel is #071022 = rgb(7, 16, 34); --text is #F1F5F9 = rgb(241, 245, 249)
    expect(makanLabCardBg).toBe('rgb(7, 16, 34)');
    expect(makanLabText).toBe('rgb(241, 245, 249)');

    // Reset to makan-lab
    await page.evaluate(() => {
      if (typeof applyTheme === 'function') applyTheme('makan-lab');
    });

    // RTL responsiveness test: verify no horizontal overflow at 360 px and 1280 px
    for (const width of [360, 1280]) {
      await page.setViewportSize({ width, height: 740 });
      await page.evaluate(() => {
        document.documentElement.lang = 'fa';
        document.documentElement.dir = 'rtl';
        if (typeof setUILanguage === 'function') setUILanguage('fa');
        if (typeof applyI18n === 'function') applyI18n();
      });
      await page.waitForTimeout(60);

      const overflow = await page.evaluate(() => {
        const tab = document.getElementById('tab-media');
        const root = document.querySelector('.mt-root') || tab;
        const devEl = document.querySelector('.mt-asr-device');
        return {
          tabHasOverflow: tab.scrollWidth > tab.clientWidth + 1,
          rootHasOverflow: root.scrollWidth > root.clientWidth + 1,
          devHasOverflow: devEl ? devEl.scrollWidth > devEl.clientWidth + 1 : false
        };
      });

      expect(overflow.tabHasOverflow, `tab-media has horizontal overflow at ${width}px in RTL`).toBe(false);
      expect(overflow.rootHasOverflow, `.mt-root has horizontal overflow at ${width}px in RTL`).toBe(false);
      expect(overflow.devHasOverflow, `.mt-asr-device has horizontal overflow at ${width}px in RTL`).toBe(false);
    }
  });

});
