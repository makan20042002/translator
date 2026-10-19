'use strict';
const { test, expect, mouseClick } = require('../support/fixtures');
const { openSettings } = require('../support/model-helpers');

test.describe('Model Hub and Settings model rows rendering stability across all states (ITEM 2)', () => {

  test('renders Model Hub and Settings rows in ready state (EN and FA, WebGPU present and absent)', async ({ app }) => {
    const { page } = app;
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message || String(err)));

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // 1. Ready state, EN, WebGPU present
    await page.evaluate(() => {
      ui = 'en';
      applyI18n();
      hasWebGpu = true;
      const d = store.get('mdl', {});
      d['asr-large-v3'] = { at: Date.now(), files: ['decoder_model_merged_quantized.onnx'] };
      store.set('mdl', d);
      mcScan();
      mcRender();
      renderModelHub();
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="models"]'));
    await expect(page.locator('#tab-models')).toBeVisible();
    await expect(page.locator('.hub-model-card[data-hub-mdl="asr-large-v3"]')).toBeVisible();
    await expect(page.locator('.hub-model-card[data-hub-mdl="asr-large-v3"] .hub-pill.ready')).toBeVisible();

    await openSettings(page, 'voiceModels');
    await expect(page.locator('.mdl[data-mdl="asr-large-v3"]')).toBeVisible();

    // 2. Ready state, FA, WebGPU absent
    await page.evaluate(() => {
      ui = 'fa';
      applyI18n();
      hasWebGpu = false;
      mcRender();
      renderModelHub();
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="models"]'));
    await expect(page.locator('#tab-models')).toBeVisible();
    await expect(page.locator('.hub-model-card[data-hub-mdl="asr-large-v3"] .hub-pill.ready')).toBeVisible();

    expect(pageErrors, 'Expected zero page errors in ready state').toEqual([]);
  });

  test('renders Model Hub and Settings rows in busy state (EN and FA)', async ({ app }) => {
    const { page } = app;
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message || String(err)));

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // 1. Busy state, EN
    await page.evaluate(() => {
      ui = 'en';
      applyI18n();
      mcDownloading['asr-large-v3'] = { files: { 'encoder_model.onnx': [500, 1000] } };
      mcRender();
      renderModelHub();
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="models"]'));
    await expect(page.locator('#tab-models')).toBeVisible();
    await expect(page.locator('.hub-model-card[data-hub-mdl="asr-large-v3"] .hub-pill.busy')).toBeVisible();

    await openSettings(page, 'voiceModels');
    await expect(page.locator('.mdl[data-mdl="asr-large-v3"][data-state="busy"]')).toBeVisible();

    // 2. Busy state, FA
    await page.evaluate(() => {
      ui = 'fa';
      applyI18n();
      mcRender();
      renderModelHub();
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="models"]'));
    await expect(page.locator('#tab-models')).toBeVisible();
    await expect(page.locator('.hub-model-card[data-hub-mdl="asr-large-v3"] .hub-pill.busy')).toBeVisible();

    expect(pageErrors, 'Expected zero page errors in busy state').toEqual([]);
  });

  test('renders Model Hub and Settings rows failed with details, file and url (EN and FA)', async ({ app }) => {
    const { page } = app;
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message || String(err)));

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // 1. Failed with details/file/url, EN
    await page.evaluate(() => {
      ui = 'en';
      applyI18n();
      const errObj = new String('Download failed: 404 Not Found');
      errObj.message = 'Download failed: 404 Not Found';
      errObj.details = 'HTTP 404: File not found on remote HuggingFace repository';
      errObj.file = 'decoder_model_merged_quantized.onnx';
      errObj.url = 'https://huggingface.co/onnx-community/whisper-large-v3-ONNX/resolve/main/decoder_model_merged_quantized.onnx';
      mcFailed['asr-large-v3'] = errObj;
      mcRender();
      renderModelHub();
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="models"]'));
    await expect(page.locator('#tab-models')).toBeVisible();
    const hubCard = page.locator('.hub-model-card[data-hub-mdl="asr-large-v3"]');
    await expect(hubCard).toBeVisible();
    await expect(hubCard.locator('.hub-model-error')).toBeVisible();
    await expect(hubCard.locator('.hub-error-msg')).toContainText('Download failed: 404 Not Found');
    await expect(hubCard.locator('.hub-error-file')).toContainText('decoder_model_merged_quantized.onnx');
    await expect(hubCard.locator('.hub-error-url')).toHaveAttribute('href', /decoder_model_merged_quantized\.onnx/);
    await expect(hubCard.locator('.hub-error-details')).toContainText('HTTP 404');

    await openSettings(page, 'voiceModels');
    const settingsRow = page.locator('.mdl[data-mdl="asr-large-v3"]');
    await expect(settingsRow).toBeVisible();
    await expect(settingsRow.locator('.hub-model-error')).toBeVisible();

    // 2. Failed with details/file/url, FA
    await page.evaluate(() => {
      ui = 'fa';
      applyI18n();
      mcRender();
      renderModelHub();
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="models"]'));
    await expect(page.locator('#tab-models')).toBeVisible();
    await expect(page.locator('.hub-model-card[data-hub-mdl="asr-large-v3"] .hub-model-error')).toBeVisible();

    expect(pageErrors, 'Expected zero page errors in failed with details state').toEqual([]);
  });

  test('renders Model Hub and Settings rows failed with plain string (EN and FA)', async ({ app }) => {
    const { page } = app;
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message || String(err)));

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // 1. Failed with plain string, EN
    await page.evaluate(() => {
      ui = 'en';
      applyI18n();
      mcFailed['asr-large-v3'] = 'network / blocked';
      mcRender();
      renderModelHub();
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="models"]'));
    await expect(page.locator('#tab-models')).toBeVisible();
    const hubCard = page.locator('.hub-model-card[data-hub-mdl="asr-large-v3"]');
    await expect(hubCard).toBeVisible();
    await expect(hubCard.locator('.hub-error-msg')).toContainText('network / blocked');

    await openSettings(page, 'voiceModels');
    const settingsRow = page.locator('.mdl[data-mdl="asr-large-v3"]');
    await expect(settingsRow).toBeVisible();
    await expect(settingsRow.locator('.hub-error-msg')).toContainText('network / blocked');

    // 2. Failed with plain string, FA
    await page.evaluate(() => {
      ui = 'fa';
      applyI18n();
      mcRender();
      renderModelHub();
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="models"]'));
    await expect(page.locator('#tab-models')).toBeVisible();
    await expect(page.locator('.hub-model-card[data-hub-mdl="asr-large-v3"] .hub-error-msg')).toContainText('network / blocked');

    expect(pageErrors, 'Expected zero page errors in failed with plain string state').toEqual([]);
  });

  test('renders Model Hub and Settings rows with GPU fallback reason set (EN and FA, WebGPU present and absent)', async ({ app }) => {
    const { page } = app;
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message || String(err)));

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // 1. GPU fallback reason set, EN, WebGPU present
    await page.evaluate(() => {
      ui = 'en';
      applyI18n();
      hasWebGpu = true;
      window.gpuFallbacks = {
        'onnx-community/whisper-large-v3-ONNX': 'Device lost or out of memory during WebGPU allocation'
      };
      mcRender();
      renderModelHub();
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="models"]'));
    await expect(page.locator('#tab-models')).toBeVisible();
    const hubCard = page.locator('.hub-model-card[data-hub-mdl="asr-large-v3"]');
    await expect(hubCard).toBeVisible();
    const hubFallback = hubCard.locator('.hub-gpu-fallback');
    await expect(hubFallback).toBeVisible();
    await expect(hubFallback).toContainText('Device lost or out of memory');

    await openSettings(page, 'voiceModels');
    const settingsRow = page.locator('.mdl[data-mdl="asr-large-v3"]');
    await expect(settingsRow).toBeVisible();
    const settingsFallback = settingsRow.locator('.hub-gpu-fallback');
    await expect(settingsFallback).toBeVisible();
    await expect(settingsFallback).toContainText('Device lost or out of memory');

    // 2. GPU fallback reason set, FA, WebGPU absent
    await page.evaluate(() => {
      ui = 'fa';
      applyI18n();
      hasWebGpu = false;
      mcRender();
      renderModelHub();
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="models"]'));
    await expect(page.locator('#tab-models')).toBeVisible();
    await expect(page.locator('.hub-model-card[data-hub-mdl="asr-large-v3"] .hub-gpu-fallback')).toBeVisible();

    expect(pageErrors, 'Expected zero page errors with GPU fallback reason set').toEqual([]);
  });

  test('with offline mode on, opening Model Hub and Settings model tabs makes zero requests to Ollama port 11434 (ITEM 1)', async ({ app }) => {
    const { page } = app;
    const ollamaCalls = [];
    await page.route(/(localhost|127\.0\.0\.1|\[::1\]):11434/, route => {
      ollamaCalls.push(route.request().url());
      route.abort('connectionrefused');
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    await page.evaluate(() => {
      cfg.offline = true;
      saveCfg();
      if (typeof offStatus === 'function') offStatus();
    });

    const offBtn = page.locator('#offBtn');
    await expect(offBtn).toHaveClass(/\bon\b/);

    // Open Model Hub
    await mouseClick(page, page.locator('#tabs button[data-tab="models"]'));
    await expect(page.locator('#tab-models')).toBeVisible();

    // Open Settings translation models tab
    await openSettings(page, 'trModels');
    await expect(page.locator('#secTrModels')).toBeVisible();

    // Open Settings voice models tab
    await openSettings(page, 'voiceModels');
    await expect(page.locator('#secVoiceModels')).toBeVisible();

    // Fixed assertion: zero requests to Ollama port 11434
    expect(ollamaCalls).toEqual([]);
  });
});
