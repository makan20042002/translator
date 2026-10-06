'use strict';
// The Talk button must use the "Microphone engine" the user chose (Browser, Groq, Gemini, offline Whisper).
const { test, expect, onlyEngines, mouseClick } = require('../support/fixtures');
const { KEYS } = require('../support/key-leaks');

/** A stand-in for the browser's speech recognition: when stopped it "hears" a fixed sentence. */
function installFakeBrowserRecognition() {
  class FakeRecognition {
    constructor() { this.lang = ''; this.interimResults = false; this.continuous = false; }
    start() { window.__recognitionStarted = (window.__recognitionStarted || 0) + 1; window.__recognitionLang = this.lang; }
    stop() {
      setTimeout(() => {
        const result = { isFinal: true, length: 1, 0: { transcript: 'hello from browser recognition' } };
        if (this.onresult) this.onresult({ resultIndex: 0, results: [result] });
        if (this.onend) this.onend();
      }, 20);
    }
    abort() { if (this.onend) this.onend(); }
  }
  window.SpeechRecognition = FakeRecognition;
  window.webkitSpeechRecognition = FakeRecognition;
}

async function holdTalk(page, selector, ms) {
  const box = await page.locator(selector).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}
const offlineModelRequests = stub => stub.log.filter(e => (e.host === 'cdn.jsdelivr.net' && /transformers/.test(e.path)) || e.host === 'huggingface.co').map(e => e.host + e.path);

test.describe('Web app: the Talk button follows the Microphone engine setting', () => {
  test.describe('Browser', () => {
    test.use({ appOptions: { seed: { cfg: { ...onlyEngines(['google']), stt: 'browser' }, src: 'en', tgt: 'fa' } } });

    test('uses the browser\'s speech recognition: no recording is sent anywhere and no offline model is downloaded', async ({ app }) => {
      test.setTimeout(60_000);
      const { page, context, stub, errors } = app;
      await context.addInitScript(installFakeBrowserRecognition);
      await page.reload();
      await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));
      await holdTalk(page, '#vPttBtn', 1500);
      const bub = page.locator('#bubbles .bub').first();
      await expect(bub.locator('.bub-orig-text')).toHaveText('hello from browser recognition', { timeout: 20_000 });
      await expect(bub.locator('.bub-text')).toHaveText('[fa] hello from browser recognition');
      expect(await page.evaluate(() => window.__recognitionStarted)).toBe(1);
      expect(await page.evaluate(() => window.__recognitionLang), 'language the browser was asked to recognise').toBe('en');
      expect(offlineModelRequests(stub), 'offline model requests').toEqual([]);
      expect(stub.calls('generativelanguage.googleapis.com'), 'requests to Gemini').toEqual([]);
      expect(errors).toEqual([]);
    });

    test('in Ask AI too', async ({ app }) => {
      test.setTimeout(60_000);
      const { page, context, stub } = app;
      await context.addInitScript(installFakeBrowserRecognition);
      await page.reload();
      await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));
      await mouseClick(page, page.locator('#vTabAsk'));
      await holdTalk(page, '#vAskPttBtn', 1500);
      // Google is not an AI engine, so there is nobody to answer, but the question must be recognised by the browser.
      await expect.poll(() => page.evaluate(() => window.__recognitionStarted)).toBe(1);
      expect(offlineModelRequests(stub)).toEqual([]);
    });

    test('does not duplicate the first word when interim results arrive before final results', async ({ app }) => {
      test.setTimeout(60_000);
      const { page, context, stub, errors } = app;
      await context.addInitScript(() => {
        class FakeInterimThenFinalRecognition {
          constructor() { this.lang = ''; this.interimResults = false; this.continuous = false; }
          start() { window.__recognitionStarted = (window.__recognitionStarted || 0) + 1; }
          stop() {
            setTimeout(() => {
              // 1. Interim result with first word "set"
              if (this.onresult) {
                this.onresult({
                  resultIndex: 0,
                  results: [
                    Object.assign([{ transcript: 'set ' }], { isFinal: false, length: 1 })
                  ]
                });
              }
              // 2. Final result with complete sentence "set alarm"
              setTimeout(() => {
                if (this.onresult) {
                  this.onresult({
                    resultIndex: 0,
                    results: [
                      Object.assign([{ transcript: 'set alarm' }], { isFinal: true, length: 1 })
                    ]
                  });
                }
                if (this.onend) this.onend();
              }, 20);
            }, 20);
          }
          abort() { if (this.onend) this.onend(); }
        }
        window.SpeechRecognition = FakeInterimThenFinalRecognition;
        window.webkitSpeechRecognition = FakeInterimThenFinalRecognition;
      });
      await page.reload();
      await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));
      await holdTalk(page, '#vPttBtn', 1500);
      const bub = page.locator('#bubbles .bub').first();
      await expect(bub.locator('.bub-orig-text')).toHaveText('set alarm', { timeout: 20_000 });
      await expect(bub.locator('.bub-text')).toHaveText('[fa] set alarm');
      expect(errors).toEqual([]);
    });
  });

  test.describe('Groq', () => {
    test.use({ appOptions: { seed: { cfg: { ...onlyEngines(['google', 'groq'], { groq: KEYS.groq }), stt: 'groq' }, src: 'en', tgt: 'fa' } } });

    test('sends the recording to Groq to be turned into text, then translates it', async ({ app }) => {
      test.setTimeout(60_000);
      const { page, stub } = app;
      await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));
      await holdTalk(page, '#vPttBtn', 2600);
      const bub = page.locator('#bubbles .bub').first();
      await expect(bub.locator('.bub-orig-text')).toHaveText('hello from the fake microphone', { timeout: 20_000 });
      await expect(bub.locator('.bub-text')).toHaveText('[fa] hello from the fake microphone');
      const call = stub.calls('api.groq.com').find(c => /audio\/transcriptions$/.test(c.path));
      expect(call, 'request to Groq\'s transcription address').toBeTruthy();
      expect(call.headers['content-type']).toContain('multipart/form-data');
      expect(offlineModelRequests(stub)).toEqual([]);
    });

    test('in Ask AI the spoken question is transcribed by Groq and answered', async ({ app }) => {
      test.setTimeout(60_000);
      const { page, stub } = app;
      await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));
      await mouseClick(page, page.locator('#vTabAsk'));
      await holdTalk(page, '#vAskPttBtn', 2600);
      await expect(page.locator('#askBubbles .bub.b .bub-text')).toHaveText('This is the stub assistant answer.', { timeout: 30_000 });
      expect(stub.calls('api.groq.com').some(c => /audio\/transcriptions$/.test(c.path))).toBe(true);
      expect(offlineModelRequests(stub)).toEqual([]);
    });
  });

  test.describe('offline Whisper that has not been downloaded', () => {
    test.use({ appOptions: { seed: { cfg: { ...onlyEngines(['google']), stt: 'whisper' }, src: 'en', tgt: 'fa' } } });

    test('says the model must be downloaded first instead of silently starting a large download', async ({ app }) => {
      test.setTimeout(60_000);
      const { page, stub } = app;
      await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));
      await holdTalk(page, '#vPttBtn', 2600);
      const needDl = await page.evaluate(() => L('needDl'));
      await expect(page.locator('#toasts')).toContainText(needDl, { timeout: 20_000 });
      expect(offlineModelRequests(stub), 'offline model requests').toEqual([]);
      await expect(page.locator('#vStatusLine')).toHaveAttribute('data-state', /ready|error/);
    });
  });
});
