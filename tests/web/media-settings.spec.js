'use strict';

/**
 * Item 2 (addition): Subtitle style persistence and WebGPU choice for Whisper.
 * Asserts:
 * - host.saveSubtitleStyle() saves the style under store key starting with 'media_' ('media_subtitle_style').
 * - Reloading the page and reopening the Media tab restores the saved subtitle style via host.loadSubtitleStyle().
 * - Saving the subtitle style key does NOT touch any other store / localStorage key.
 * - getWhisperChoice().gpu reflects existing Voice/Model Hub WebGPU setting when WebGPU is available.
 * - When WebGPU is not available (e.g. no navigator.gpu), getWhisperChoice().gpu is strictly false.
 * - Neither cfg nor store is exposed on window.
 */

const { test, expect, mouseClick } = require('../support/fixtures');

test.describe('Web app: Media settings persistence and GPU choice', () => {

  test('neither store nor cfg is exposed on window', async ({ app }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await expect(page.locator('#tab-media')).toBeVisible();

    const exposed = await page.evaluate(() => ({
      hasWindowStore: typeof window.store !== 'undefined',
      hasWindowCfg: typeof window.cfg !== 'undefined'
    }));

    expect(exposed.hasWindowStore, 'store must not be exposed on window').toBe(false);
    expect(exposed.hasWindowCfg, 'cfg must not be exposed on window').toBe(false);
  });

  test('saving subtitle style persists under media_ key without touching other store keys, and restores after reload', async ({ app }) => {
    const { page } = app;

    // 1. Open Media tab
    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await expect(page.locator('#tab-media')).toBeVisible();

    // 2. Snapshot existing localStorage keys that do not start with mkt_media_
    const beforeOtherKeys = await page.evaluate(() => {
      const other = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k.startsWith('mkt_media_')) {
          other[k] = localStorage.getItem(k);
        }
      }
      return other;
    });

    const testStyle = {
      font: 'vazir',
      size: 30,
      color: '#ffcc00',
      bg: 'black'
    };

    // 3. Save style via host.saveSubtitleStyle
    await page.evaluate((st) => {
      window.MediaTranslate.host.saveSubtitleStyle(st);
    }, testStyle);

    // 4. Assert that the style was saved under a key beginning with "media_" (in localStorage: mkt_media_subtitle_style)
    const storedItem = await page.evaluate(() => {
      return localStorage.getItem('mkt_media_subtitle_style');
    });
    expect(storedItem, 'style must be saved in localStorage under mkt_media_subtitle_style').toBeTruthy();
    const parsed = JSON.parse(storedItem);
    expect(parsed.size).toBe(30);
    expect(parsed.color).toBe('#ffcc00');
    expect(parsed.font).toBe('vazir');

    // 5. Assert that no other keys in localStorage were modified
    const afterOtherKeys = await page.evaluate(() => {
      const other = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k.startsWith('mkt_media_')) {
          other[k] = localStorage.getItem(k);
        }
      }
      return other;
    });
    expect(afterOtherKeys).toEqual(beforeOtherKeys);

    // 6. Reload page to test full reload survival
    await page.reload();
    await page.waitForTimeout(100);

    // 7. Reopen Media tab
    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await expect(page.locator('#tab-media')).toBeVisible();

    // 8. Verify host.loadSubtitleStyle() retrieves the exact saved style
    const restoredStyle = await page.evaluate(() => {
      return window.MediaTranslate.host.loadSubtitleStyle();
    });
    expect(restoredStyle).toEqual(testStyle);
  });

  test('getWhisperChoice().gpu follows existing Voice/Model Hub setting when WebGPU is available', async ({ app }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await expect(page.locator('#tab-media')).toBeVisible();

    // Test with simulated WebGPU available
    const gpuResults = await page.evaluate(async () => {
      // Mock navigator.gpu to represent WebGPU available
      const origGpu = navigator.gpu;
      try {
        Object.defineProperty(navigator, 'gpu', {
          configurable: true,
          get: () => ({ requestAdapter: async () => ({}) })
        });

        // Case A: Base model with WebGPU -> gpu is true
        if (typeof window.MediaTranslate?.host?.setWhisperChoice === 'function') {
          window.MediaTranslate.host.setWhisperChoice('base');
        }
        store.set('whisper_webgpu', 'base');
        store.set('whisper_wasm', '');
        const choiceGpu = window.MediaTranslate.host.getWhisperChoice();

        // Case B: Model Hub has whisper_wasm set -> gpu should be false (WASM/CPU forced)
        store.set('whisper_webgpu', '');
        store.set('whisper_wasm', 'base');
        const choiceWasm = window.MediaTranslate.host.getWhisperChoice();

        // Case C: Large v3 model with WebGPU -> gpu is dtype object per worker contract
        if (typeof window.MediaTranslate?.host?.setWhisperChoice === 'function') {
          window.MediaTranslate.host.setWhisperChoice('large-v3');
        }
        store.set('whisper_webgpu', 'large-v3');
        store.set('whisper_wasm', '');
        const choiceLargeGpu = window.MediaTranslate.host.getWhisperChoice();

        return {
          gpuWithWebGpuSetting: choiceGpu ? choiceGpu.gpu : null,
          gpuWithWasmSetting: choiceWasm ? choiceWasm.gpu : null,
          gpuLargeSetting: choiceLargeGpu ? choiceLargeGpu.gpu : null
        };
      } finally {
        Object.defineProperty(navigator, 'gpu', {
          configurable: true,
          get: () => origGpu
        });
      }
    });

    expect(gpuResults.gpuWithWebGpuSetting).toBe(true);
    expect(gpuResults.gpuWithWasmSetting).toBe(false);
    expect(typeof gpuResults.gpuLargeSetting).toBe('object');
    expect(gpuResults.gpuLargeSetting).toHaveProperty('encoder_model');
    expect(gpuResults.gpuLargeSetting).toHaveProperty('decoder_model_merged');
    expect(gpuResults.gpuLargeSetting).toEqual({ encoder_model: 'fp16', decoder_model_merged: 'q4f16' });
  });

  test('getWhisperChoice contract distinguishes base models (boolean true) and dtype models (object)', async ({ app }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await expect(page.locator('#tab-media')).toBeVisible();

    const res = await page.evaluate(async () => {
      const origGpu = navigator.gpu;
      try {
        Object.defineProperty(navigator, 'gpu', {
          configurable: true,
          get: () => ({ requestAdapter: async () => ({}) })
        });

        // 1. Base model with GPU on -> boolean true
        window.MediaTranslate.host.setWhisperChoice('base');
        store.set('whisper_webgpu', 'base');
        store.set('whisper_wasm', '');
        const baseChoice = window.MediaTranslate.host.getWhisperChoice();

        // 2. Large v3 (dtype model) with GPU on -> dtype object
        window.MediaTranslate.host.setWhisperChoice('large-v3');
        store.set('whisper_webgpu', 'large-v3');
        store.set('whisper_wasm', '');
        const largeChoice = window.MediaTranslate.host.getWhisperChoice();

        // 3. Large v3 Turbo (dtype model) with GPU on -> dtype object
        window.MediaTranslate.host.setWhisperChoice('large-v3-turbo');
        store.set('whisper_webgpu', 'large-v3-turbo');
        store.set('whisper_wasm', '');
        const turboChoice = window.MediaTranslate.host.getWhisperChoice();

        return {
          baseGpu: baseChoice?.gpu,
          largeGpu: largeChoice?.gpu,
          turboGpu: turboChoice?.gpu
        };
      } finally {
        Object.defineProperty(navigator, 'gpu', {
          configurable: true,
          get: () => origGpu
        });
      }
    });

    expect(res.baseGpu).toBe(true);
    expect(res.largeGpu).toEqual({ encoder_model: 'fp16', decoder_model_merged: 'q4f16' });
    expect(res.turboGpu).toEqual({ encoder_model: 'fp16', decoder_model_merged: 'q4' });
  });

  test('with no WebGPU, getWhisperChoice().gpu is strictly false', async ({ app }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await expect(page.locator('#tab-media')).toBeVisible();

    // Test with navigator.gpu undefined / unavailable
    const choiceNoGpu = await page.evaluate(async () => {
      const origGpu = navigator.gpu;
      try {
        if (typeof window.MediaTranslate?.host?.setWhisperChoice === 'function') {
          window.MediaTranslate.host.setWhisperChoice('base');
        }
        // Even if whisper_webgpu was previously set in store
        store.set('whisper_webgpu', 'base');
        store.set('whisper_wasm', '');

        // Remove navigator.gpu to simulate browser environment without WebGPU
        Object.defineProperty(navigator, 'gpu', {
          configurable: true,
          get: () => undefined
        });

        const choice = window.MediaTranslate.host.getWhisperChoice();
        return choice ? choice.gpu : null;
      } finally {
        Object.defineProperty(navigator, 'gpu', {
          configurable: true,
          get: () => origGpu
        });
      }
    });

    expect(choiceNoGpu).toBe(false);
  });

});
