'use strict';
// Gemini: the app asks the key which models it may use, instead of trusting built-in names.
// Keys in Google's newer shape ("AQ.…") must work exactly like the old "AIza…" ones.
const { test, expect, onlyEngines, mouseClick } = require('../support/fixtures');
const { KEYS, findKeyLeaks } = require('../support/key-leaks');

const AQ_KEY = KEYS.gemini; // starts with "AQ."
const GEMINI = 'generativelanguage.googleapis.com';

test.describe('Web app: Gemini key in the new "AQ." shape and model discovery', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['gemini'], { gemini: AQ_KEY }), tMode: 'smart', src: 'en', tgt: 'fa' } } });

  async function translate(page, text) {
    await mouseClick(page, page.locator('#tIn'));
    await page.keyboard.type(text);
    await mouseClick(page, page.locator('#tGo'));
  }

  test('the key is shaped like an AQ. key', () => { expect(AQ_KEY.startsWith('AQ.')).toBe(true); });

  test('an AQ. key translates, travels only in the x-goog-api-key header, and never leaks', async ({ app }) => {
    const { page, stub } = app;
    await translate(page, 'Good morning');
    await expect(page.locator('#tMeta')).toContainText('Google Gemini', { timeout: 15_000 });
    const calls = stub.calls(GEMINI);
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      expect(c.headers['x-goog-api-key'], 'key header on ' + c.path).toBe(AQ_KEY);
      expect(c.path, 'key must not be in the address').not.toContain('key=');
    }
    expect(findKeyLeaks(stub)).toEqual([]);
  });

  test('the models the key can use are listed and a model that exists is chosen', async ({ app }) => {
    const { page, stub } = app;
    stub.setGeminiModels(['gemini-2.5-flash-lite', 'gemini-embedding-001']); // the old built-in names do not exist for this key
    await translate(page, 'Good morning');
    await expect(page.locator('#tMeta')).toContainText('Google Gemini', { timeout: 15_000 });
    expect(stub.calls(GEMINI).some(c => /\/v1beta\/models\/?(\?|$)/.test(c.path))).toBe(true);
    const used = stub.calls(GEMINI).filter(c => /:generateContent/.test(c.path)).map(c => c.path);
    expect(used.every(p => p.includes('gemini-2.5-flash-lite')), used.join(',')).toBe(true);
  });

  test('big models overloaded (503): a smaller model answers instead', async ({ app }) => {
    const { page, stub } = app;
    stub.setGeminiBusy(['gemini-2.5-flash', 'gemini-2.5-pro']);
    await translate(page, 'Good morning');
    await expect(page.locator('#tOut')).toHaveValue('[fa] Good morning', { timeout: 15_000 });
    await expect(page.locator('#tMeta')).toContainText('Google Gemini');
  });

  test('every model overloaded: a plain "busy" reason within a few seconds, not a silent wait', async ({ app }) => {
    const { page, stub } = app;
    stub.setGeminiBusy(['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite']);
    const t0 = Date.now();
    await translate(page, 'Good morning');
    await expect(page.locator('#toasts')).toContainText(/busy|high demand/i, { timeout: 10_000 });
    expect(Date.now() - t0).toBeLessThan(10_000);
    await expect(page.locator('#tGo')).toBeEnabled();
  });

  test('a slow answer shows "Waiting for Google Gemini" after a few seconds', async ({ app }) => {
    test.setTimeout(30_000);
    const { page, stub } = app;
    stub.delayHost(GEMINI, 6000);
    await translate(page, 'Good morning');
    await expect(page.locator('#tMeta')).toContainText(/Waiting for Google Gemini/, { timeout: 8000 });
    await expect(page.locator('#tOut')).toHaveValue('[fa] Good morning', { timeout: 25_000 });
  });

  test('a key with no usable translation model gets a plain "model not found" message', async ({ app }) => {
    const { page, stub } = app;
    stub.setGeminiModels(['gemini-embedding-001']);
    await translate(page, 'Good morning');
    await expect(page.locator('#toasts')).toContainText(/model not found/i, { timeout: 15_000 });
    await expect(page.locator('#tGo')).toBeEnabled();
  });

  test.describe('read-aloud', () => {
    test.use({ appOptions: { seed: { cfg: { ...onlyEngines(['gemini'], { gemini: AQ_KEY }), tts: { mode: 'gemini', voices: {}, rate: 1 } }, tMode: 'smart', src: 'en', tgt: 'fa' } } });

    test('the speech model comes from the key\'s own list (the built-in name is not available to it)', async ({ app }) => {
      const { page, stub } = app;
      stub.setGeminiModels(['gemini-2.5-flash', 'gemini-2.5-pro-preview-tts']);
      await translate(page, 'Hello');
      await expect(page.locator('#tOut')).not.toHaveValue('', { timeout: 15_000 });
      await mouseClick(page, page.locator('#tSpeak'));
      await expect.poll(() => stub.calls(GEMINI).filter(c => /GenerateContent|generateContent/.test(c.path) && c.body.includes('AUDIO')).length, { timeout: 15_000 }).toBeGreaterThan(0);
      const audio = stub.calls(GEMINI).filter(c => c.body.includes('AUDIO'));
      expect(audio.every(c => c.path.includes('gemini-2.5-pro-preview-tts')), audio.map(c => c.path).join(',')).toBe(true);
      expect(audio.every(c => c.headers['x-goog-api-key'] === AQ_KEY)).toBe(true);
    });

    test('no speech model for this key: a plain "model not found" message is shown', async ({ app }) => {
      const { page, stub } = app;
      stub.setGeminiModels(['gemini-2.5-flash']);
      await translate(page, 'Hello');
      await expect(page.locator('#tOut')).not.toHaveValue('', { timeout: 15_000 });
      await mouseClick(page, page.locator('#tSpeak'));
      await expect(page.locator('#toasts')).toContainText(/model not found/i, { timeout: 15_000 });
    });
  });
});
