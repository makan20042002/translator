'use strict';

/**
 * tests/web/engine-picker.spec.js
 * ITEM 2: Unified engine picker in Subtitle and Media tabs.
 */

const { test, expect, mouseClick, chooseFile, onlyEngines } = require('../support/fixtures');
const { fakeAiWorker, fakeMediaTranscription, createTestWav } = require('../support/model-helpers');

test.describe('Engine Picker Component (ITEM 2)', () => {

  test('picker exists in Subtitle and Media with options, using line, and keys link', async ({ app, files }) => {
    const { page, errors } = app;

    // 1. Subtitle tab (load subtitle file first so file workspace and picker are unhidden)
    await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
    await chooseFile(page, page.locator('#sDrop'), files.srt);
    const subHost = page.locator('#subEnginePickerHost .engine-picker');
    await expect(subHost).toBeVisible();
    await expect(subHost.locator('.engine-picker-select')).toBeVisible();
    await expect(subHost.locator('.engine-picker-test-btn')).toBeVisible();
    await expect(subHost.locator('.engine-picker-using')).toBeVisible();
    await expect(subHost.locator('.engine-picker-keys-link')).toBeVisible();

    // 2. Media tab (load audio fixture and transcribe with fake worker so media picker is unhidden)
    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await fakeMediaTranscription(page);
    const fileInput = page.locator('#tab-media .mt-file-input');
    await fileInput.setInputFiles({
      name: 'sample.wav',
      mimeType: 'audio/wav',
      buffer: createTestWav(3.0, 16000)
    });
    const transcribeBtn = page.locator('#tab-media .mt-transcribe');
    await expect(transcribeBtn).toBeVisible();
    await mouseClick(page, transcribeBtn);
    await expect(page.locator('#tab-media .mt-asr-ok')).toBeVisible();
    await expect(page.locator('#tab-media .mt-tr')).toBeVisible();

    const mediaHost = page.locator('.mt-engine-picker-host .engine-picker');
    await expect(mediaHost).toBeVisible();
    await expect(mediaHost.locator('.engine-picker-select')).toBeVisible();
    await expect(mediaHost.locator('.engine-picker-test-btn')).toBeVisible();
    await expect(mediaHost.locator('.engine-picker-using')).toBeVisible();
    await expect(mediaHost.locator('.engine-picker-keys-link')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('options and states are right with a seeded Gemini key, with no key, and NLLB states', async ({ app, files }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
    await chooseFile(page, page.locator('#sDrop'), files.srt);
    const select = page.locator('#subEnginePickerHost .engine-picker-select');

    // Without Gemini key and without NLLB download
    const geminiOptNoKey = select.locator('option[value="gemini"]');
    await expect(geminiOptNoKey).toHaveAttribute('disabled', '');
    expect(await geminiOptNoKey.evaluate(el => el.disabled)).toBe(true);
    const geminiTextNoKey = await geminiOptNoKey.textContent();
    expect(geminiTextNoKey).toContain('needs a key');

    const nllbOptNoDl = select.locator('option[value="nllb"]');
    await expect(nllbOptNoDl).toHaveAttribute('disabled', '');
    expect(await nllbOptNoDl.evaluate(el => el.disabled)).toBe(true);
    const nllbTextNoDl = await nllbOptNoDl.textContent();
    expect(nllbTextNoDl).toContain('not downloaded');

    // Seed Gemini key into cfg and trigger refresh
    await page.evaluate(() => {
      if (!cfg.eng) cfg.eng = {};
      if (!cfg.eng.gemini) cfg.eng.gemini = {};
      cfg.eng.gemini.key = 'test-gemini-key';
      saveCfg();
      if (typeof ENG !== 'undefined' && typeof ENG.updateEnginePickers === 'function') {
        ENG.updateEnginePickers();
      }
    });

    const geminiOptWithKey = select.locator('option[value="gemini"]');
    await expect(geminiOptWithKey).not.toHaveAttribute('disabled');
    expect(await geminiOptWithKey.evaluate(el => !el.disabled)).toBe(true);
    const geminiTextWithKey = await geminiOptWithKey.textContent();
    expect(geminiTextWithKey).toContain('ready');
  });

  test('choosing google in Subtitle shows the same choice in Media and survives a reload', async ({ app, files }) => {
    const { page } = app;

    // Choose google in Subtitle
    await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
    await chooseFile(page, page.locator('#sDrop'), files.srt);
    const subSelect = page.locator('#subEnginePickerHost .engine-picker-select');
    await subSelect.selectOption('google');
    await expect(subSelect).toHaveValue('google');

    // Check Media tab shows google
    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await fakeMediaTranscription(page);
    const fileInput = page.locator('#tab-media .mt-file-input');
    await fileInput.setInputFiles({
      name: 'sample.wav',
      mimeType: 'audio/wav',
      buffer: createTestWav(3.0, 16000)
    });
    const transcribeBtn = page.locator('#tab-media .mt-transcribe');
    await expect(transcribeBtn).toBeVisible();
    await mouseClick(page, transcribeBtn);
    await expect(page.locator('#tab-media .mt-asr-ok')).toBeVisible();
    await expect(page.locator('#tab-media .mt-tr')).toBeVisible();

    const mediaSelect = page.locator('.mt-engine-picker-host .engine-picker-select');
    await expect(mediaSelect).toBeVisible();
    await expect(mediaSelect).toHaveValue('google');

    // Reload page and verify persistence
    await page.reload();
    await expect(page.locator('#tabs button').first()).toBeVisible();

    await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
    await chooseFile(page, page.locator('#sDrop'), files.srt);
    await expect(page.locator('#subEnginePickerHost .engine-picker-select')).toHaveValue('google');

    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await fakeMediaTranscription(page);
    const fileInputReload = page.locator('#tab-media .mt-file-input');
    await fileInputReload.setInputFiles({
      name: 'sample.wav',
      mimeType: 'audio/wav',
      buffer: createTestWav(3.0, 16000)
    });
    const transcribeBtnReload = page.locator('#tab-media .mt-transcribe');
    await expect(transcribeBtnReload).toBeVisible();
    await mouseClick(page, transcribeBtnReload);
    await expect(page.locator('#tab-media .mt-asr-ok')).toBeVisible();
    await expect(page.locator('#tab-media .mt-tr')).toBeVisible();

    await expect(page.locator('.mt-engine-picker-host .engine-picker-select')).toHaveValue('google');
  });

  test('translating a small SRT with picker on google uses only google', async ({ app, files }) => {
    const { page, stub } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
    await chooseFile(page, page.locator('#sDrop'), files.srt);
    await expect(page.locator('#sWork')).toBeVisible();

    const subSelect = page.locator('#subEnginePickerHost .engine-picker-select');
    await subSelect.selectOption('google');

    stub.clearLog();
    await mouseClick(page, page.locator('#sGo'));
    await expect(page.locator('#sInfo')).toHaveText('sample · 5/5 lines');

    // Verify all translation requests went only to Google
    const googleCalls = stub.calls('clients5.google.com');
    expect(googleCalls.length).toBeGreaterThan(0);
    expect(stub.calls('api.mymemory.translated.net')).toHaveLength(0);
  });

  test('unusable engine option is disabled and cannot be picked', async ({ app, files }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
    await chooseFile(page, page.locator('#sDrop'), files.srt);
    const select = page.locator('#subEnginePickerHost .engine-picker-select');
    const geminiOpt = select.locator('option[value="gemini"]');
    await expect(geminiOpt).toHaveAttribute('disabled', '');
    expect(await geminiOpt.evaluate(el => el.disabled)).toBe(true);

    // Selecting disabled option is rejected by browser
    const canSelect = await page.evaluate(() => {
      const sel = document.querySelector('#subEnginePickerHost .engine-picker-select');
      const opt = sel.querySelector('option[value="gemini"]');
      return !opt.disabled;
    });
    expect(canSelect).toBe(false);
  });

  test.describe('NLLB offline translation via fake worker', () => {
    test.use({
      appOptions: {
        serviceWorkers: 'block',
        seed: {
          cfg: {
            ...onlyEngines(['nllb', 'google']),
            engine: 'nllb',
            nllb: true,
            offline: true
          },
          engine: 'nllb',
          nllb: true,
          mdl: { 'tr-nllb-600': { at: Date.now(), files: ['config.json'] } }
        }
      }
    });

    test('picking nllb translates offline with zero online requests', async ({ app }) => {
      const { page } = app;

      const onlineCalls = [];
      await page.route(/(?:googleapis|google\.com|mymemory|groq\.com|api\.openai\.com|openrouter\.ai)/, route => {
        onlineCalls.push(route.request().url());
        route.abort('failed');
      });

      await fakeAiWorker(page);

      await page.evaluate(async () => {
        const c = await caches.open('transformers-cache');
        await c.put(
          'https://huggingface.co/Xenova/nllb-200-distilled-600M/resolve/main/config.json',
          new Response('{}', { headers: { 'content-length': '873' } })
        );
        if (typeof mcScan === 'function') await mcScan();
        store.set('engine', 'nllb');
        if (typeof ENG !== 'undefined' && typeof ENG.updateEnginePickers === 'function') {
          ENG.updateEnginePickers();
        }
      });

      await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
      await expect(page.locator('#tab-media')).toBeVisible();

      const cues = [{ s: 0.0, e: 1.5, o: 'Offline engine picker test', t: '' }];
      const translated = await page.evaluate(async (testCues) => {
        return await window.MediaTranslate.host.translateCues(testCues, { src: 'en', tgt: 'fa' });
      }, cues);

      expect(translated).toHaveLength(1);
      expect(translated[0].t).toBe('[fa] Offline engine picker test');
      expect(onlineCalls).toEqual([]);
    });
  });

  test('EN and FA strings display properly on picker elements', async ({ app, files }) => {
    const { page } = app;

    // EN mode
    await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
    await chooseFile(page, page.locator('#sDrop'), files.srt);
    const subHost = page.locator('#subEnginePickerHost .engine-picker');
    await expect(subHost.locator('.engine-picker-label-text')).toHaveText('Translate with');
    await expect(subHost.locator('.engine-picker-select option[value="auto"]')).toContainText('Auto (your order in Settings)');
    await expect(subHost.locator('.engine-picker-test-btn')).toHaveText('Test');
    await expect(subHost.locator('.engine-picker-keys-link')).toHaveText('Get models / keys');

    // Switch to FA
    await page.locator('#uiLang').click();

    await expect(subHost.locator('.engine-picker-label-text')).toHaveText('ترجمه با');
    await expect(subHost.locator('.engine-picker-select option[value="auto"]')).toContainText('خودکار (ترتیب شما در تنظیمات)');
    await expect(subHost.locator('.engine-picker-test-btn')).toHaveText('آزمایش');
    await expect(subHost.locator('.engine-picker-keys-link')).toHaveText('دریافت مدل‌ها / کلیدها');
  });

  test('RTL layout has no overflow at 360 px and 1280 px', async ({ app, files }) => {
    const { page } = app;

    // Switch to Persian RTL
    await page.locator('#uiLang').click();
    await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
    await chooseFile(page, page.locator('#sDrop'), files.srt);

    // Check at 1280 px
    await page.setViewportSize({ width: 1280, height: 900 });
    const overflow1280 = await page.evaluate(() => {
      const el = document.querySelector('#subEnginePickerHost .engine-picker');
      return el.scrollWidth > el.clientWidth + 2;
    });
    expect(overflow1280).toBe(false);

    // Check at 360 px
    await page.setViewportSize({ width: 360, height: 740 });
    const overflow360 = await page.evaluate(() => {
      const el = document.querySelector('#subEnginePickerHost .engine-picker');
      return el.scrollWidth > el.clientWidth + 2;
    });
    expect(overflow360).toBe(false);
  });
});
