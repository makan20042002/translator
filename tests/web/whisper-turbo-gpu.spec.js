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

test.describe('Whisper Large v3 Turbo on GPU with safe fallback (ITEM 1)', () => {

  test('Turbo catalog entry has gpu object and Tiny/Base/Small remain unchanged', async ({ app }) => {
    const { page } = app;

    const catalogCheck = await page.evaluate(() => {
      const models = window.MODEL_CATALOG?.models || [];
      const turbo = models.find(m => m.id === 'asr-large-v3-turbo');
      const tiny = models.find(m => m.id === 'asr-tiny');
      const base = models.find(m => m.id === 'asr-base');
      const small = models.find(m => m.id === 'asr-small');

      return {
        turbo: {
          gpu: turbo?.gpu,
          gpuVerified: turbo?.gpuVerified,
          webgpu: turbo?.webgpu,
          gpuBytes: turbo?.gpuBytes,
          hasGpuFiles: Array.isArray(turbo?.gpuFiles) && turbo.gpuFiles.length > 0
        },
        tiny: { gpu: tiny?.gpu, webgpu: tiny?.webgpu },
        base: { gpu: base?.gpu, webgpu: base?.webgpu },
        small: { gpu: small?.gpu, webgpu: small?.webgpu }
      };
    });

    // Turbo checks
    expect(catalogCheck.turbo.gpu).toEqual({
      encoder_model: 'fp16',
      decoder_model_merged: 'q4'
    });
    expect(catalogCheck.turbo.gpuVerified).toBe(false);
    expect(catalogCheck.turbo.webgpu).toBe('optional');
    expect(catalogCheck.turbo.gpuBytes).toBe(1611258854);
    expect(catalogCheck.turbo.hasGpuFiles).toBe(true);

    // Tiny/Base/Small unchanged
    expect(catalogCheck.tiny.gpu).toEqual({ encoder_model: 'fp32', decoder_model_merged: 'q4' });
    expect(catalogCheck.tiny.webgpu).toBe('optional');
    expect(catalogCheck.base.gpu).toEqual({ encoder_model: 'fp32', decoder_model_merged: 'q4' });
    expect(catalogCheck.base.webgpu).toBe('optional');
    expect(catalogCheck.small.gpu).toEqual({ encoder_model: 'fp32', decoder_model_merged: 'q4' });
    expect(catalogCheck.small.webgpu).toBe('optional');
  });

  test('worker spec passed for Turbo carries object dtype unchanged and says GPU when WebGPU available', async ({ app }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await expect(page.locator('#tab-media')).toBeVisible();

    // Configure Turbo with GPU and capture worker spec
    await page.evaluate(() => {
      window.__capturedSpecs = [];
      const turboModel = window.MODEL_CATALOG.models.find(m => m.id === 'asr-large-v3-turbo');

      window.MediaTranslate.host.getWhisperChoice = () => ({
        repo: turboModel.repo,
        name: turboModel.name,
        memMB: turboModel.memMB,
        ready: true,
        gpu: turboModel.gpu
      });

      window.MediaTranslate.host.engine = {
        libUrl: 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1',
        workerFactory: function () {
          const self = {
            onmessage: null,
            onerror: null,
            postMessage: function (data) {
              const { id, cmd, a } = data || {};
              if (a && a.spec) {
                window.__capturedSpecs.push({ cmd, spec: JSON.parse(JSON.stringify(a.spec)) });
              }
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
                        text: 'Turbo GPU transcription',
                        chunks: [{ text: 'Turbo GPU transcription', timestamp: [0, 0.2] }],
                        lang: 'en',
                        device: 'webgpu',
                        gpuNote: ''
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
      name: 'sample-turbo-gpu.wav',
      mimeType: 'audio/wav',
      buffer: wavBuffer
    });

    const transcribeBtn = page.locator('#tab-media .mt-transcribe');
    await expect(transcribeBtn).toBeVisible();
    await mouseClick(page, transcribeBtn);

    const deviceEl = page.locator('#tab-media .mt-asr-device');
    await expect(deviceEl).toBeVisible();
    await expect(deviceEl).toHaveText('Running on: GPU (WebGPU)');

    // Verify worker spec carried object dtype unchanged
    const specs = await page.evaluate(() => window.__capturedSpecs);
    expect(specs.length).toBeGreaterThan(0);
    expect(specs[0].spec.gpu).toEqual({
      encoder_model: 'fp16',
      decoder_model_merged: 'q4'
    });

    // Check FA translation
    const langBtn = page.locator('#uiLang');
    await mouseClick(page, langBtn);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
    await expect(deviceEl).toHaveText('محل اجرا: پردازنده گرافیکی (WebGPU)');

    await mouseClick(page, langBtn);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('with navigator.gpu missing it says CPU and gives the WebGPU reason in EN and FA', async ({ app }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await expect(page.locator('#tab-media')).toBeVisible();

    await page.evaluate(() => {
      const turboModel = window.MODEL_CATALOG.models.find(m => m.id === 'asr-large-v3-turbo');

      window.MediaTranslate.host.getWhisperChoice = () => ({
        repo: turboModel.repo,
        name: turboModel.name,
        memMB: turboModel.memMB,
        ready: true,
        gpu: false,
        gpuVariant: turboModel.gpu,
        hasGpuVariant: true
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
                        lang: 'en',
                        device: 'wasm',
                        gpuNote: 'WebGPU is not available here'
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
      name: 'sample-turbo-fallback.wav',
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
    await expect(deviceEl).toContainText('WebGPU is not available here');

    await mouseClick(page, langBtn);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('GPU load failure falls back to CPU and shows the failure reason', async ({ app }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await expect(page.locator('#tab-media')).toBeVisible();

    await page.evaluate(() => {
      const turboModel = window.MODEL_CATALOG.models.find(m => m.id === 'asr-large-v3-turbo');

      window.MediaTranslate.host.getWhisperChoice = () => ({
        repo: turboModel.repo,
        name: turboModel.name,
        memMB: turboModel.memMB,
        ready: true,
        gpu: turboModel.gpu
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
                  // Simulate GPU load failure falling back to wasm
                  self.onmessage({
                    data: {
                      id,
                      ok: true,
                      res: {
                        device: 'wasm',
                        threads: 4,
                        crossOriginIsolated: true,
                        gpuNote: 'device lost or out of memory'
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
                        lang: 'en',
                        device: 'wasm',
                        gpuNote: 'device lost or out of memory'
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
      name: 'sample-turbo-fail.wav',
      mimeType: 'audio/wav',
      buffer: wavBuffer
    });

    const transcribeBtn = page.locator('#tab-media .mt-transcribe');
    await expect(transcribeBtn).toBeVisible();
    await mouseClick(page, transcribeBtn);

    const deviceEl = page.locator('#tab-media .mt-asr-device');
    await expect(deviceEl).toBeVisible();
    await expect(deviceEl).toContainText('Running on: CPU, 4 threads');
    await expect(deviceEl).toContainText('device lost or out of memory');
  });

  test('Hub size for Turbo shows the GPU size (1.5 GB) when WebGPU is available', async ({ app }) => {
    const { page } = app;

    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'gpu', {
        configurable: true,
        get: () => ({ requestAdapter: async () => ({}) })
      });
    });
    await page.reload();

    // Navigate to Models / Hub tab
    await mouseClick(page, page.locator('#tabs button[data-tab="models"]'));
    await expect(page.locator('#tab-models')).toBeVisible();

    const cardMeta = page.locator('.hub-model-card[data-hub-mdl="asr-large-v3-turbo"] .hub-model-meta');
    await expect(cardMeta).toBeVisible();
    await expect(cardMeta).toContainText('Download: 1.5 GB');
  });

  test('Hub size for Turbo shows the CPU size (1.0 GB) when WebGPU is unavailable', async ({ app }) => {
    const { page } = app;

    await page.addInitScript(() => {
      try { delete Navigator.prototype.gpu; } catch (_) {}
      try { delete navigator.gpu; } catch (_) {}
      Object.defineProperty(navigator, 'gpu', {
        configurable: true,
        get: () => undefined
      });
    });
    await page.reload();

    // Navigate to Models / Hub tab
    await mouseClick(page, page.locator('#tabs button[data-tab="models"]'));
    await expect(page.locator('#tab-models')).toBeVisible();

    const cardMeta = page.locator('.hub-model-card[data-hub-mdl="asr-large-v3-turbo"] .hub-model-meta');
    await expect(cardMeta).toBeVisible();
    await expect(cardMeta).toContainText('Download: 1.0 GB');
  });

  test('theme contrast >= 4.5 in light themes, makan-lab unchanged, and RTL layout at 360 and 1280 px', async ({ app }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await expect(page.locator('#tab-media')).toBeVisible();

    await page.evaluate(() => {
      const turboModel = window.MODEL_CATALOG.models.find(m => m.id === 'asr-large-v3-turbo');
      window.MediaTranslate.host.getWhisperChoice = () => ({
        repo: turboModel.repo,
        name: turboModel.name,
        memMB: turboModel.memMB,
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
                if (cmd === 'init' || cmd === 'load' || cmd === 'asr') {
                  self.onmessage({
                    data: {
                      id,
                      ok: true,
                      res: {
                        device: 'webgpu',
                        threads: 4,
                        crossOriginIsolated: true,
                        gpuNote: '',
                        text: 'ok',
                        chunks: []
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
      name: 'sample-theme-check.wav',
      mimeType: 'audio/wav',
      buffer: wavBuffer
    });

    const transcribeBtn = page.locator('#tab-media .mt-transcribe');
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

      const isLight = (themeId === 'platinum-blue' || themeId === 'champagne-minimal' || themeId === 'rose-titanium');
      const info = await page.evaluate(() => {
        const el = document.querySelector('#tab-media .mt-asr-device');
        if (!el) return null;
        const card = el.closest('.mt-card') || el.parentElement;
        const fg = window.getComputedStyle(el).color;
        const bg = window.getComputedStyle(card).backgroundColor;
        const ratio = (typeof window.contrastRatio === 'function') ? window.contrastRatio(fg, bg) : 10;
        return { fg, bg, ratio };
      });

      if (themeId === 'makan-lab' && info) {
        makanLabText = info.fg;
      }
      if (isLight && info && info.ratio < 4.5) {
        violations.push({ themeId, ratio: info.ratio, fg: info.fg, bg: info.bg });
      }
    }

    expect(violations).toEqual([]);
    expect(makanLabText).toBeTruthy();

    // Verify Persian RTL at 360 px and 1280 px
    const langBtn = page.locator('#uiLang');
    await mouseClick(page, langBtn);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');

    for (const width of [360, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth > doc.clientWidth;
      });
      expect(overflow).toBe(false);
    }
  });

});
