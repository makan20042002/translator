'use strict';

/**
 * tests/web/model-picker.spec.js
 * ITEM 3: Model-level picker next to the engine picker and Media speech model selector.
 */

const { test, expect, mouseClick, chooseFile, onlyEngines } = require('../support/fixtures');
const { fakeDownloaded } = require('../support/model-helpers');

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

test.describe('Model-level Picker (ITEM 3)', () => {

  test('Gemini model change in the picker equals the value in Settings and survives reload', async ({ app, files }) => {
    const { page, errors } = app;

    // Seed Gemini key so Gemini is usable
    await page.evaluate(() => {
      if (!cfg.eng) cfg.eng = {};
      if (!cfg.eng.gemini) cfg.eng.gemini = {};
      cfg.eng.gemini.key = 'test-gemini-key';
      cfg.eng.gemini.model = 'gemini-2.5-flash';
      saveCfg();
      if (typeof ENG !== 'undefined' && typeof ENG.updateEnginePickers === 'function') {
        ENG.updateEnginePickers();
      }
    });

    // Go to Subtitle tab
    await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
    await chooseFile(page, page.locator('#sDrop'), files.srt);
    const picker = page.locator('#subEnginePickerHost .engine-picker');
    await expect(picker).toBeVisible();

    const engineSelect = picker.locator('.engine-picker-select');
    await engineSelect.selectOption('gemini');

    const modelSelect = picker.locator('.engine-picker-model-select');
    await expect(modelSelect).toBeVisible();
    await expect(modelSelect).toHaveValue('gemini-2.5-flash');

    // Change model to gemini-2.5-pro in the picker
    await modelSelect.selectOption('gemini-2.5-pro');

    // Check config updated
    const savedCfgModel = await page.evaluate(() => cfg.eng.gemini.model);
    expect(savedCfgModel).toBe('gemini-2.5-pro');

    // Open Settings and verify input[data-f="model"] for gemini has gemini-2.5-pro
    await mouseClick(page, page.locator('#openSet'));
    await mouseClick(page, page.locator('#setTabBtnEngines'));
    const setGeminiModel = page.locator('#engList .eng[data-id="gemini"] input[data-f="model"]');
    await expect(setGeminiModel).toHaveValue('gemini-2.5-pro');

    // Reload page and verify it survives reload
    await page.reload();
    await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
    await chooseFile(page, page.locator('#sDrop'), files.srt);
    const pickerReloaded = page.locator('#subEnginePickerHost .engine-picker');
    const modelSelectReloaded = pickerReloaded.locator('.engine-picker-model-select');
    await expect(modelSelectReloaded).toBeVisible();
    await expect(modelSelectReloaded).toHaveValue('gemini-2.5-pro');

    expect(errors).toEqual([]);
  });

  test('Ollama list from stubbed /api/tags fills the select, and unreachable Ollama shows "not running"', async ({ app, files }) => {
    const { page, errors } = app;

    // Stub Ollama API on network level
    await page.route('**/api/tags', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          models: [
            { name: 'llama3.2:3b' },
            { name: 'qwen2.5:7b' }
          ]
        })
      });
    });

    await page.evaluate(() => {
      if (!cfg.eng) cfg.eng = {};
      if (!cfg.eng.ollama) cfg.eng.ollama = {};
      cfg.eng.ollama.model = 'llama3.2:3b';
      saveCfg();
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
    await chooseFile(page, page.locator('#sDrop'), files.srt);
    const picker = page.locator('#subEnginePickerHost .engine-picker');
    const engineSelect = picker.locator('.engine-picker-select');
    await engineSelect.selectOption('ollama');

    const modelSelect = picker.locator('.engine-picker-model-select');
    await expect(modelSelect).toBeVisible();
    await expect(modelSelect.locator('option')).toHaveCount(2);
    await expect(modelSelect.locator('option').first()).toHaveText('llama3.2:3b');
    await expect(modelSelect.locator('option').nth(1)).toHaveText('qwen2.5:7b');
    await expect(modelSelect).toHaveValue('llama3.2:3b');

    // Unroute and stub as unreachable (abort)
    await page.unroute('**/api/tags');
    await page.route('**/api/tags', route => route.abort());
    await page.route('**/models', route => route.abort());

    // Switch engine away and back to re-trigger fetch
    await engineSelect.selectOption('auto');
    await engineSelect.selectOption('ollama');

    await expect(modelSelect.locator('option')).toHaveCount(1);
    const notRunningOpt = modelSelect.locator('option').first();
    await expect(notRunningOpt).toHaveAttribute('disabled', '');
    expect(await notRunningOpt.evaluate(el => el.disabled)).toBe(true);
    const optText = await notRunningOpt.textContent();
    expect(optText.toLowerCase()).toContain('not running');

    // Saved value in cfg must be preserved!
    const preservedModel = await page.evaluate(() => cfg.eng.ollama.model);
    expect(preservedModel).toBe('llama3.2:3b');

    expect(errors).toEqual([]);
  });

  test('offline: choosing M2M in the picker changes Hub choice and host.getTranslateChoice, not-downloaded models disabled', async ({ app, files }) => {
    const { page, errors } = app;

    // Seed NLLB and M2M so they are ready, but mBART is not
    const modelData = await page.evaluate(() => {
      const cat = self.MODEL_CATALOG?.models || [];
      const nllb = cat.find(m => m.id === 'tr-nllb-600');
      const m2m = cat.find(m => m.id === 'tr-m2m100-418');
      const d = store.get('mdl', {});
      if (nllb) d[nllb.id] = { at: Date.now(), files: nllb.files.map(f => f[0]) };
      if (m2m) d[m2m.id] = { at: Date.now(), files: m2m.files.map(f => f[0]) };
      store.set('mdl', d);
      store.set('nllb', true);
      return {
        nllb: nllb ? { repo: nllb.repo, files: nllb.files } : null,
        m2m: m2m ? { repo: m2m.repo, files: m2m.files } : null
      };
    });
    if (modelData.nllb) await fakeDownloaded(page, modelData.nllb.repo, modelData.nllb.files);
    if (modelData.m2m) await fakeDownloaded(page, modelData.m2m.repo, modelData.m2m.files);
    await page.evaluate(async () => {
      if (typeof mcScan === 'function') await mcScan();
      if (typeof mcRender === 'function') mcRender();
      if (typeof ENG !== 'undefined' && typeof ENG.updateEnginePickers === 'function') {
        ENG.updateEnginePickers();
      }
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
    await chooseFile(page, page.locator('#sDrop'), files.srt);
    const picker = page.locator('#subEnginePickerHost .engine-picker');
    const engineSelect = picker.locator('.engine-picker-select');
    await engineSelect.selectOption('nllb');

    const modelSelect = picker.locator('.engine-picker-model-select');
    await expect(modelSelect).toBeVisible();

    // Check options: NLLB and M2M should be enabled, mBART should be disabled
    const nllbOpt = modelSelect.locator('option[value="tr-nllb-600"]');
    const m2mOpt = modelSelect.locator('option[value="tr-m2m100-418"]');
    const mbartOpt = modelSelect.locator('option[value="tr-mbart50"]');

    await expect(nllbOpt).not.toHaveAttribute('disabled');
    await expect(m2mOpt).not.toHaveAttribute('disabled');
    await expect(mbartOpt).toHaveAttribute('disabled', '');
    expect(await mbartOpt.evaluate(el => el.disabled)).toBe(true);

    // Licence note check for NLLB
    const nllbText = await nllbOpt.textContent();
    expect(nllbText).toContain('CC BY-NC 4.0');

    // Hub link should be visible next to model select
    const hubLink = picker.locator('.engine-picker-hub-link');
    await expect(hubLink).toBeVisible();

    // Choosing M2M in the picker
    await modelSelect.selectOption('tr-m2m100-418');

    // Verify cfg.trModel updated
    const savedTrModel = await page.evaluate(() => cfg.trModel);
    expect(savedTrModel).toBe('tr-m2m100-418');

    // Verify host.getTranslateChoice returns M2M-100
    const trChoice = await page.evaluate(() => {
      return window.MediaTranslate?.host?.getTranslateChoice();
    });
    expect(trChoice).toBeTruthy();
    expect(trChoice.model).toContain('M2M-100');

    // Verify Settings / Hub offTrModelSel follows
    await mouseClick(page, page.locator('#openSet'));
    await mouseClick(page, page.locator('#setTabBtnTrModels'));
    const offTrSel = page.locator('#offTrModelSel');
    await expect(offTrSel).toHaveValue('tr-m2m100-418');

    expect(errors).toEqual([]);
  });

  test('Media speech model select follows the Hub and shows not-downloaded sizes disabled', async ({ app }) => {
    const { page, errors } = app;

    // Fake audio file and mock cache with Tiny ready, base/small/turbo unready
    await page.evaluate(() => {
      const cat = self.MODEL_CATALOG?.models || [];
      const tiny = cat.find(m => m.key === 'tiny' || m.id === 'asr-tiny');
      const d = store.get('mdl', {});
      if (tiny) d[tiny.id] = { at: Date.now(), files: tiny.files.map(f => f[0]) };
      store.set('mdl', d);
      if (!mcCache) mcCache = {};
      if (tiny) mcCache[tiny.repo] = { bytes: 75000000, files: new Map(tiny.files.map(f => [f[0], f[1]])) };
      if (typeof mcRender === 'function') mcRender();
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await expect(page.locator('#tab-media')).toBeVisible();

    // Supply a valid wav file so transcribe card opens
    const wavBuffer = createTestWav(0.2, 16000);
    const fileInput = page.locator('#tab-media .mt-file-input');
    await fileInput.setInputFiles({
      name: 'sample.wav',
      mimeType: 'audio/wav',
      buffer: wavBuffer
    });

    const asrCard = page.locator('.mt-asr');
    await expect(asrCard).toBeVisible({ timeout: 5000 });

    const speechSel = asrCard.locator('.mt-asr-model-select');
    await expect(speechSel).toBeVisible();

    // Check options: Tiny enabled, small and turbo disabled
    const tinyOpt = speechSel.locator('option[value="tiny"]');
    const smallOpt = speechSel.locator('option[value="small"]');
    const turboOpt = speechSel.locator('option[value="large-v3-turbo"]');

    await expect(tinyOpt).not.toHaveAttribute('disabled');
    await expect(smallOpt).toHaveAttribute('disabled', '');
    await expect(turboOpt).toHaveAttribute('disabled', '');
    expect(await smallOpt.evaluate(el => el.disabled)).toBe(true);
    expect(await turboOpt.evaluate(el => el.disabled)).toBe(true);

    // Get link to Hub should be visible because there are unready sizes
    const hubLink = asrCard.locator('.mt-asr-model-hub-link');
    await expect(hubLink).toBeVisible();

    // Changing speech model in the Hub reflects in Media tab
    await page.evaluate(() => {
      if (typeof window.MediaTranslate?.host?.setWhisperChoice === 'function') {
        window.MediaTranslate.host.setWhisperChoice('tiny');
      }
    });

    const ch = await page.evaluate(() => window.MediaTranslate.host.getWhisperChoice());
    expect(ch.key).toBe('tiny');

    expect(errors).toEqual([]);
  });

  test('picker UI works with EN and FA strings, RTL at 360px and 1280px', async ({ app, files }) => {
    const { page, errors } = app;

    // Set viewport to 1280px
    await page.setViewportSize({ width: 1280, height: 800 });

    // Open Subtitle tab
    await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
    await chooseFile(page, page.locator('#sDrop'), files.srt);
    const picker = page.locator('#subEnginePickerHost .engine-picker');
    await expect(picker).toBeVisible();

    // Switch to FA
    await mouseClick(page, page.locator('#uiLang'));
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');

    // Verify RTL direction
    const dir = await page.locator('html').getAttribute('dir');
    expect(dir).toBe('rtl');

    // Label in FA
    const labelText = await picker.locator('.engine-picker-label-text').textContent();
    expect(labelText).toContain('ترجمه با');

    // Switch to 360px viewport
    await page.setViewportSize({ width: 360, height: 640 });
    await expect(picker).toBeVisible();

    // Ensure model label in FA when choosing Gemini
    const engineSelect = picker.locator('.engine-picker-select');
    await engineSelect.selectOption('gemini');

    const modelLabel = picker.locator('.engine-picker-model-label-text');
    await expect(modelLabel).toBeVisible();
    const modelText = await modelLabel.textContent();
    expect(modelText).toContain('مدل');

    // Switch back to EN
    await mouseClick(page, page.locator('#uiLang'));
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    const dirEn = await page.locator('html').getAttribute('dir');
    expect(dirEn).toBe('ltr');

    expect(errors).toEqual([]);
  });
});
