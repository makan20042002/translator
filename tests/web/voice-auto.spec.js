'use strict';
// Automatic voice choice in the web app: a language with no device voice (Persian on Windows Chrome) is spoken by
// Gemini without the user changing any setting; the voice in use is shown; failures say why and offer Retry.
const { test, expect, onlyEngines, mouseClick, VALID_KEY } = require('../support/fixtures');

const GEMINI = 'generativelanguage.googleapis.com';
const streamCalls = stub => stub.calls(GEMINI).filter(c => /:streamGenerateContent$/.test(c.path) || (/:generateContent$/.test(c.path) && c.body.includes('AUDIO')));

// A pretend speech engine with one English device voice and no Persian voice (what Chrome on Windows has).
const FAKE_VOICES = `(() => {
  const voices = [{ name: 'Test English Voice', lang: 'en-US', voiceURI: 'test-en', localService: true, default: true }];
  window.__spoken = [];
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; this.lang = ''; this.voice = null; this.rate = 1; } };
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
    getVoices: () => voices, speaking: false, cancel() {}, onvoiceschanged: null,
    speak(u) { window.__spoken.push({ text: u.text, voice: u.voice && u.voice.name }); setTimeout(() => u.onstart && u.onstart(), 20); setTimeout(() => u.onend && u.onend(), 400); }
  } });
})();`;

async function translateText(page, text) {
  await mouseClick(page, page.locator('#tIn'));
  await page.keyboard.type(text);
  await mouseClick(page, page.locator('#tGo'));
  await expect(page.locator('#tOut')).toHaveValue(/\[fa\]/, { timeout: 15_000 });
}

test.describe('Web app: automatic voice for a language with no device voice', () => {
  test.describe('with a Gemini key and no device voice', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['gemini', 'google'], { gemini: VALID_KEY }), tMode: 'smart', src: 'en', tgt: 'fa' } } });

    test('Text tab: Persian is spoken by Gemini, the voice in use is shown, and the Speak button comes back', async ({ app }) => {
      const { page, stub } = app;
      await translateText(page, 'Good morning');
      await mouseClick(page, page.locator('#tSpeak'));
      await expect.poll(() => streamCalls(stub).length, { timeout: 15_000 }).toBeGreaterThan(0);
      await expect(page.locator('#tVoiceUsed')).toContainText('Gemini');
      await expect(page.locator('#tSpeak')).toHaveText('Speak', { timeout: 15_000 });
      expect(JSON.parse(streamCalls(stub)[0].body).generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe('Kore');
    });

    test('Edge hint: one calm dismissible line for a browser that is not Edge; dismissing keeps it away', async ({ app }) => {
      const { page } = app;
      await translateText(page, 'Good morning');
      await mouseClick(page, page.locator('#tSpeak'));
      await expect(page.locator('#speakNotice')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('#speakNoticeText')).toContainText('Microsoft Edge has built-in natural voices');
      await expect(page.locator('#speakNoticeRetry')).toBeHidden();
      await mouseClick(page, page.locator('#speakNoticeClose'));
      await expect(page.locator('#speakNotice')).toBeHidden();
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mkt_edgeHintOff')))).toBe(true);
    });

    test('Ask AI: the answer is spoken by Gemini without any setting changed', async ({ app }) => {
      const { page, stub } = app;
      await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));
      await mouseClick(page, page.locator('#vTabAsk'));
      await page.locator('#vAskLang').selectOption('fa');
      await mouseClick(page, page.locator('#vAskIn'));
      await page.keyboard.type('What is the capital of France?');
      await page.keyboard.press('Enter');
      await expect(page.locator('#askBubbles .bub.b .bub-text')).toHaveText('This is the stub assistant answer.');
      await expect.poll(() => streamCalls(stub).length, { timeout: 15_000 }).toBeGreaterThan(0);
      await expect(page.locator('#vVoiceUsed')).toContainText('Gemini');
    });

    test('Live mode keeps its fast device voice for languages that have one, but not at the price of silence for Persian', async ({ app }) => {
      test.setTimeout(60_000);
      const { page, stub } = app;
      await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));
      await expect(page.locator('#vLiveVoiceSpeed')).toHaveValue('fast'); // the default: prefer the fast device voice
      await mouseClick(page, page.locator('#vLiveBtn'));
      await expect(page.locator('#bubbles .bub .bub-text').first()).toBeVisible({ timeout: 25_000 });
      await expect.poll(() => streamCalls(stub).length, { timeout: 20_000 }).toBeGreaterThan(0);
      await mouseClick(page, page.locator('#vLiveBtn'));
    });
  });

  test.describe('no device voice and no key', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), src: 'en', tgt: 'fa' } } });

    test('a clear message, no sound request, and the button is not stuck on Stop', async ({ app }) => {
      const { page, stub } = app;
      await translateText(page, 'Good morning');
      await mouseClick(page, page.locator('#tSpeak'));
      await expect(page.locator('#speakNoticeText')).toContainText('no Gemini key is set');
      await expect(page.locator('#tSpeak')).toHaveText('Speak');
      expect(streamCalls(stub)).toEqual([]);
    });
  });

  test.describe('Gemini voice failing', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['gemini', 'google'], { gemini: VALID_KEY }), tMode: 'smart', src: 'en', tgt: 'fa' } } });

    test('503 "high demand": one plain line, Retry, and Retry works once Gemini recovers', async ({ app }) => {
      const { page, stub } = app;
      await translateText(page, 'Good morning');
      stub.setGeminiBusy(['gemini-2.5-flash-preview-tts']);
      await mouseClick(page, page.locator('#tSpeak'));
      await expect(page.locator('#speakNoticeText')).toContainText(/busy|high demand/i, { timeout: 20_000 });
      await expect(page.locator('#speakNoticeRetry')).toBeVisible();
      await expect(page.locator('#tSpeak'), 'must not stay on Stop').toHaveText('Speak');
      stub.setGeminiBusy([]);
      const before = streamCalls(stub).length;
      await mouseClick(page, page.locator('#speakNoticeRetry'));
      await expect.poll(() => streamCalls(stub).length, { timeout: 15_000 }).toBeGreaterThan(before);
      await expect(page.locator('#speakNotice')).toBeHidden();
      await expect(page.locator('#tSpeak')).toHaveText('Speak', { timeout: 15_000 });
    });

    test('429 "rate limited": one plain line and Retry', async ({ app }) => {
      const { page, stub } = app;
      await translateText(page, 'Good morning');
      stub.failHost(GEMINI, 429);
      await mouseClick(page, page.locator('#tSpeak'));
      await expect(page.locator('#speakNoticeText')).toContainText(/rate limited/i, { timeout: 20_000 });
      await expect(page.locator('#speakNoticeRetry')).toBeVisible();
      await expect(page.locator('#tSpeak')).toHaveText('Speak');
    });

    test('a rejected key is reported as such, not as silence', async ({ app }) => {
      const { page, stub } = app;
      await translateText(page, 'Good morning');
      stub.failHost(GEMINI, 400, Infinity, { error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } });
      await mouseClick(page, page.locator('#tSpeak'));
      await expect(page.locator('#speakNoticeText')).toContainText(/key rejected/i, { timeout: 20_000 });
      await expect(page.locator('#tSpeak')).toHaveText('Speak');
    });
  });

  test.describe('with a device voice for English only', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['gemini', 'google'], { gemini: VALID_KEY }), tMode: 'smart', src: 'fa', tgt: 'en' } } });

    test('the picker offers Automatic, the device voice and the Gemini voices; Automatic uses the device voice for English', async ({ app }) => {
      const { page, stub } = app;
      await page.addInitScript(FAKE_VOICES);
      await page.reload();
      await mouseClick(page, page.locator('#openSet'));
      await expect(page.locator('#ov')).toHaveClass(/\bon\b/);
      const options = await page.locator('#voiceSel option').allTextContents();
      expect(options[0]).toMatch(/^Auto/);
      expect(options).toContain('Test English Voice');
      for (const n of ['Kore', 'Puck', 'Charon', 'Fenrir', 'Aoede']) expect(options).toContain(`Gemini · ${n}`);
      // Automatic: the device voice speaks English.
      await mouseClick(page, page.locator('#btnSaveDone'));
      await page.evaluate(() => { document.getElementById('tOut').value = 'Good morning'; });
      await mouseClick(page, page.locator('#tSpeak'));
      await expect(page.locator('#tVoiceUsed')).toContainText('Test English Voice');
      expect(streamCalls(stub)).toEqual([]);
      // Choosing a Gemini voice for English overrides the device voice.
      await mouseClick(page, page.locator('#openSet'));
      await page.locator('#voiceSel').selectOption('gemini:Puck');
      await mouseClick(page, page.locator('#btnSaveDone'));
      await page.waitForTimeout(600);
      await mouseClick(page, page.locator('#tSpeak'));
      await expect.poll(() => streamCalls(stub).length, { timeout: 15_000 }).toBeGreaterThan(0);
      expect(JSON.parse(streamCalls(stub)[0].body).generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe('Puck');
      await expect(page.locator('#tVoiceUsed')).toContainText('Puck');
    });
  });
});
