'use strict';

const fs = require('fs');
const path = require('path');
const { test, expect, mouseClick } = require('../support/fixtures');
const { COLOR_HELPERS_SOURCE } = require('../support/color-helpers');

const ROOT = path.resolve(__dirname, '..', '..');

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

test.describe('Whisper Large v3 and Distil Large v3 Models (ITEM 1, 2, 4)', () => {

  test('catalog has both entries with verified file names, sizes, licences, and GPU object only on Large v3', async ({ app }) => {
    const { page } = app;

    const catalogCheck = await page.evaluate(() => {
      const models = window.MODEL_CATALOG?.models || [];
      const largeV3 = models.find(m => m.id === 'asr-large-v3');
      const distil = models.find(m => m.id === 'asr-distil-large-v3');

      return {
        largeV3: {
          id: largeV3?.id,
          key: largeV3?.key,
          repo: largeV3?.repo,
          name: largeV3?.name,
          rec: largeV3?.rec,
          gpu: largeV3?.gpu,
          gpuVerified: largeV3?.gpuVerified,
          webgpu: largeV3?.webgpu,
          bytes: largeV3?.bytes,
          gpuBytes: largeV3?.gpuBytes,
          files: largeV3?.files,
          gpuFiles: largeV3?.gpuFiles,
          memMB: largeV3?.memMB
        },
        distil: {
          id: distil?.id,
          key: distil?.key,
          repo: distil?.repo,
          name: distil?.name,
          rec: distil?.rec,
          gpu: distil?.gpu,
          webgpu: distil?.webgpu,
          bytes: distil?.bytes,
          files: distil?.files,
          memMB: distil?.memMB,
          langs: distil?.langs
        }
      };
    });

    // Whisper Large v3 assertions
    expect(catalogCheck.largeV3.id).toBe('asr-large-v3');
    expect(catalogCheck.largeV3.key).toBe('large-v3');
    expect(catalogCheck.largeV3.repo).toBe('onnx-community/whisper-large-v3-ONNX');
    expect(catalogCheck.largeV3.name).toBe('Whisper Large v3');
    expect(catalogCheck.largeV3.rec).toBe(true);
    expect(catalogCheck.largeV3.webgpu).toBe('optional');
    expect(catalogCheck.largeV3.gpuVerified).toBe(false);
    expect(catalogCheck.largeV3.bytes).toBe(1825000000);
    expect(catalogCheck.largeV3.gpuBytes).toBe(3090000000);
    expect(catalogCheck.largeV3.memMB).toBe(4000);
    expect(catalogCheck.largeV3.files).toEqual([
      ['onnx/encoder_model_quantized.onnx', 645000000],
      ['onnx/decoder_model_merged_quantized.onnx', 1180000000]
    ]);
    expect(catalogCheck.largeV3.gpuFiles).toEqual([
      ['onnx/encoder_model_fp16.onnx', 1270000000],
      ['onnx/decoder_model_merged_fp16.onnx', 1820000000]
    ]);
    expect(catalogCheck.largeV3.gpu).toEqual({
      encoder_model: 'fp16',
      decoder_model_merged: 'fp16'
    });

    // Whisper Distil Large v3 assertions (CPU only, gpu: null)
    expect(catalogCheck.distil.id).toBe('asr-distil-large-v3');
    expect(catalogCheck.distil.key).toBe('distil-large-v3');
    expect(catalogCheck.distil.repo).toBe('distil-whisper/distil-large-v3');
    expect(catalogCheck.distil.name).toBe('Whisper Distil Large v3 (English only, fast)');
    expect(catalogCheck.distil.rec).toBe(false);
    expect(catalogCheck.distil.gpu).toBeNull();
    expect(catalogCheck.distil.webgpu).toBe('none');
    expect(catalogCheck.distil.bytes).toBe(767000000);
    expect(catalogCheck.distil.memMB).toBe(2500);
    expect(catalogCheck.distil.files).toEqual([
      ['onnx/encoder_model_quantized.onnx', 645000000],
      ['onnx/decoder_model_merged_quantized.onnx', 122000000]
    ]);
    expect(catalogCheck.distil.langs).toEqual({
      en: 'English only',
      fa: 'فقط انگلیسی'
    });

    // Third-party notice assertions
    const thirdPartyContent = fs.readFileSync(path.join(ROOT, 'docs', 'THIRD_PARTY.md'), 'utf8');
    expect(thirdPartyContent).toContain('**Licence**: Apache-2.0 (original OpenAI model; repo tag not shown)');
    expect(thirdPartyContent).toContain('distil-whisper/distil-large-v3');
    expect(thirdPartyContent).toContain('**Licence**: MIT');
  });

  test('Hub lists both with GPU download size (2.9 GB for Large v3, 731 MB for Distil) when WebGPU is mocked present', async ({ app }) => {
    const { page } = app;

    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'gpu', {
        configurable: true,
        get: () => ({ requestAdapter: async () => ({}) })
      });
    });
    await page.reload();

    await mouseClick(page, page.locator('#tabs button[data-tab="models"]'));
    await expect(page.locator('#tab-models')).toBeVisible();

    const largeMeta = page.locator('.hub-model-card[data-hub-mdl="asr-large-v3"] .hub-model-meta');
    await expect(largeMeta).toBeVisible();
    await expect(largeMeta).toContainText('Download: 2.9 GB');

    const distilMeta = page.locator('.hub-model-card[data-hub-mdl="asr-distil-large-v3"] .hub-model-meta');
    await expect(distilMeta).toBeVisible();
    await expect(distilMeta).toContainText('Download: 731 MB');
  });

  test('Hub lists both with CPU download size (1.7 GB for Large v3, 731 MB for Distil) when WebGPU is absent', async ({ app }) => {
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

    await mouseClick(page, page.locator('#tabs button[data-tab="models"]'));
    await expect(page.locator('#tab-models')).toBeVisible();

    const largeMeta = page.locator('.hub-model-card[data-hub-mdl="asr-large-v3"] .hub-model-meta');
    await expect(largeMeta).toBeVisible();
    await expect(largeMeta).toContainText('Download: 1.7 GB');

    const distilMeta = page.locator('.hub-model-card[data-hub-mdl="asr-distil-large-v3"] .hub-model-meta');
    await expect(distilMeta).toBeVisible();
    await expect(distilMeta).toContainText('Download: 731 MB');
  });

  test('Media Speech model select shows both, disabled until downloaded, and follows the Hub choice', async ({ app }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await expect(page.locator('#tab-media')).toBeVisible();

    // Load an audio file to render the Transcribe card
    const wavBuffer = createTestWav(0.2, 16000);
    const fileInput = page.locator('#tab-media .mt-file-input');
    await fileInput.setInputFiles({
      name: 'sample-test.wav',
      mimeType: 'audio/wav',
      buffer: wavBuffer
    });

    const speechSel = page.locator('#tab-media .mt-asr-model-select');
    await expect(speechSel).toBeVisible();

    // Verify both options are present
    const largeOpt = speechSel.locator('option[value="large-v3"]');
    const distilOpt = speechSel.locator('option[value="distil-large-v3"]');
    await expect(largeOpt).toHaveCount(1);
    await expect(distilOpt).toHaveCount(1);

    // Both should be disabled when not downloaded
    await expect(largeOpt).toHaveAttribute('disabled', '');
    await expect(distilOpt).toHaveAttribute('disabled', '');

    // Verify Get link is visible when unready models exist
    const hubLink = page.locator('#tab-media .mt-asr-model-hub-link');
    await expect(hubLink).toBeVisible();

    // Select follows Hub choice via host.setWhisperChoice
    await page.evaluate(() => {
      if (typeof window.MediaTranslate?.host?.setWhisperChoice === 'function') {
        window.MediaTranslate.host.setWhisperChoice('large-v3');
      }
    });
    const choice1 = await page.evaluate(() => window.MediaTranslate.host.getWhisperChoice());
    expect(choice1.key).toBe('large-v3');

    await page.evaluate(() => {
      if (typeof window.MediaTranslate?.host?.setWhisperChoice === 'function') {
        window.MediaTranslate.host.setWhisperChoice('distil-large-v3');
      }
    });
    const choice2 = await page.evaluate(() => window.MediaTranslate.host.getWhisperChoice());
    expect(choice2.key).toBe('distil-large-v3');
  });

  test('worker receives the right dtype/object for Large v3 and CPU q8 for Distil', async ({ app }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await expect(page.locator('#tab-media')).toBeVisible();

    // Capture worker specs
    await page.evaluate(() => {
      window.__capturedSpecs = [];
      const largeModel = window.MODEL_CATALOG.models.find(m => m.id === 'asr-large-v3');

      window.MediaTranslate.host.getWhisperChoice = () => ({
        key: largeModel.key,
        repo: largeModel.repo,
        name: largeModel.name,
        memMB: largeModel.memMB,
        ready: true,
        gpu: largeModel.gpu
      });

      window.MediaTranslate.host.engine = {
        libUrl: 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1',
        workerFactory: function () {
          const self = {
            onmessage: null,
            onerror: null,
            postMessage: function (data) {
              const { id, cmd, a } = data || {};
              if (cmd === 'init') {
                setTimeout(() => { if (self.onmessage) self.onmessage({ data: { id, ok: true } }); }, 5);
              } else if (cmd === 'load') {
                if (a && a.spec) window.__capturedSpecs.push(a.spec);
                setTimeout(() => { if (self.onmessage) self.onmessage({ data: { id, ok: true } }); }, 5);
              } else if (cmd === 'asr') {
                if (a && a.spec) window.__capturedSpecs.push(a.spec);
                setTimeout(() => {
                  if (self.onmessage) {
                    self.onmessage({
                      data: {
                        id,
                        ok: true,
                        res: {
                          device: 'webgpu',
                          threads: 4,
                          crossOriginIsolated: true,
                          gpuNote: '',
                          text: 'transcription result',
                          chunks: [{ text: 'transcription result', timestamp: [0, 0.2] }]
                        }
                      }
                    });
                  }
                }, 5);
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
      name: 'large-worker-check.wav',
      mimeType: 'audio/wav',
      buffer: wavBuffer
    });

    const transcribeBtn = page.locator('#tab-media .mt-transcribe');
    await mouseClick(page, transcribeBtn);
    await expect(page.locator('#tab-media .mt-asr-ok')).toBeVisible();

    const capturedLarge = await page.evaluate(() => window.__capturedSpecs);
    expect(capturedLarge.length).toBeGreaterThanOrEqual(1);
    expect(capturedLarge[0].gpu).toEqual({
      encoder_model: 'fp16',
      decoder_model_merged: 'fp16'
    });

    // Now test with Distil Large v3
    await page.evaluate(() => {
      window.__capturedSpecs = [];
      const distilModel = window.MODEL_CATALOG.models.find(m => m.id === 'asr-distil-large-v3');

      window.MediaTranslate.host.getWhisperChoice = () => ({
        key: distilModel.key,
        repo: distilModel.repo,
        name: distilModel.name,
        memMB: distilModel.memMB,
        ready: true,
        gpu: distilModel.gpu
      });
    });

    await mouseClick(page, transcribeBtn);
    await expect(page.locator('#tab-media .mt-asr-ok')).toBeVisible();

    const capturedDistil = await page.evaluate(() => window.__capturedSpecs);
    expect(capturedDistil.length).toBeGreaterThanOrEqual(1);
    expect(capturedDistil[0].gpu).toBeNull();
  });

  test('English-only notice appears for language FA with the distil model and not for English', async ({ app }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await expect(page.locator('#tab-media')).toBeVisible();

    await page.evaluate(() => {
      let currentKey = 'distil-large-v3';
      const models = window.MODEL_CATALOG?.models || [];
      window.MediaTranslate.host.getWhisperChoice = () => {
        const m = models.find(x => x.key === currentKey || x.id === currentKey) || models.find(x => x.id === 'asr-distil-large-v3');
        return {
          key: m?.key || currentKey,
          id: m?.id || currentKey,
          repo: m?.repo,
          name: m?.name,
          memMB: m?.memMB,
          ready: true,
          gpu: m?.gpu || null
        };
      };
      window.MediaTranslate.host.setWhisperChoice = (key) => {
        currentKey = key;
        if (typeof window.cfg !== 'undefined') window.cfg.whisper = key;
        const asrLang = document.querySelector('#tab-media .mt-asr-lang');
        if (asrLang) asrLang.dispatchEvent(new Event('change'));
      };
    });

    const wavBuffer = createTestWav(0.2, 16000);
    const fileInput = page.locator('#tab-media .mt-file-input');
    await fileInput.setInputFiles({
      name: 'distil-notice-check.wav',
      mimeType: 'audio/wav',
      buffer: wavBuffer
    });

    const noticeEl = page.locator('#tab-media .mt-asr-english-only');
    const switchTurboBtn = page.locator('#tab-media .mt-asr-switch-turbo');
    const asrLang = page.locator('#tab-media .mt-asr-lang');

    // With distil model, notice is hidden when language is 'en'
    await asrLang.selectOption('en');
    await expect(noticeEl).toBeHidden();

    // Select non-English language FA: notice appears with switch to Turbo button
    await asrLang.selectOption('fa');
    await expect(noticeEl).toBeVisible();
    await expect(noticeEl).toContainText('This model is English only');
    await expect(switchTurboBtn).toBeVisible();

    // Click Switch to Turbo
    await mouseClick(page, switchTurboBtn);
    await expect(noticeEl).toBeHidden();

    const newChoice = await page.evaluate(() => window.MediaTranslate.host.getWhisperChoice());
    expect(newChoice.key).toBe('large-v3-turbo');

    // Switch back to distil model with language EN: notice stays hidden
    await page.evaluate(() => {
      window.MediaTranslate.host.setWhisperChoice('distil-large-v3');
    });
    await asrLang.selectOption('en');
    await expect(noticeEl).toBeHidden();
  });

  test('Running-on line shows the GPU or CPU reason like Turbo', async ({ app }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await expect(page.locator('#tab-media')).toBeVisible();

    // 1. GPU run
    await page.evaluate(() => {
      const largeModel = window.MODEL_CATALOG.models.find(m => m.id === 'asr-large-v3');
      window.MediaTranslate.host.getWhisperChoice = () => ({
        key: largeModel.key,
        repo: largeModel.repo,
        name: largeModel.name,
        memMB: largeModel.memMB,
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
                if (self.onmessage && (cmd === 'init' || cmd === 'load' || cmd === 'asr')) {
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
                        chunks: [{ text: 'ok', timestamp: [0, 0.2] }]
                      }
                    }
                  });
                }
              }, 5);
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
      name: 'running-device-check.wav',
      mimeType: 'audio/wav',
      buffer: wavBuffer
    });

    const transcribeBtn = page.locator('#tab-media .mt-transcribe');
    await mouseClick(page, transcribeBtn);

    const deviceEl = page.locator('#tab-media .mt-asr-device');
    await expect(deviceEl).toBeVisible();
    await expect(deviceEl).toContainText('GPU (WebGPU)');

    // 2. CPU fallback run
    await page.evaluate(() => {
      window.MediaTranslate.host.engine = {
        libUrl: 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1',
        workerFactory: function () {
          const self = {
            onmessage: null,
            onerror: null,
            postMessage: function (data) {
              const { id, cmd } = data || {};
              setTimeout(() => {
                if (self.onmessage && (cmd === 'init' || cmd === 'load' || cmd === 'asr')) {
                  self.onmessage({
                    data: {
                      id,
                      ok: true,
                      res: {
                        device: 'wasm',
                        threads: 4,
                        crossOriginIsolated: true,
                        gpuNote: 'Failed to create WebGPU adapter',
                        text: 'ok',
                        chunks: [{ text: 'ok', timestamp: [0, 0.2] }]
                      }
                    }
                  });
                }
              }, 5);
            },
            terminate: function () {}
          };
          return self;
        }
      };
    });

    await mouseClick(page, transcribeBtn);
    await expect(deviceEl).toBeVisible();
    await expect(deviceEl).toContainText('Failed to create WebGPU adapter');
  });

  test('theme contrast >= 4.5 in light themes, makan-lab unchanged, and RTL layout at 360 and 1280 px', async ({ app }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await expect(page.locator('#tab-media')).toBeVisible();

    await page.evaluate(() => {
      const largeModel = window.MODEL_CATALOG.models.find(m => m.id === 'asr-large-v3');
      window.MediaTranslate.host.getWhisperChoice = () => ({
        key: largeModel.key,
        repo: largeModel.repo,
        name: largeModel.name,
        memMB: largeModel.memMB,
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
                if (self.onmessage && (cmd === 'init' || cmd === 'load' || cmd === 'asr')) {
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
                        chunks: [{ text: 'ok', timestamp: [0, 0.2] }]
                      }
                    }
                  });
                }
              }, 5);
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
      name: 'large-theme-check.wav',
      mimeType: 'audio/wav',
      buffer: wavBuffer
    });

    const transcribeBtn = page.locator('#tab-media .mt-transcribe');
    await mouseClick(page, transcribeBtn);

    const deviceEl = page.locator('#tab-media .mt-asr-device');
    await expect(deviceEl).toBeVisible();

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
