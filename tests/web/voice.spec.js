'use strict';
// Voice tab with a fake microphone (Chromium plays tests/.generated/speech-like.wav
// as if it came from a microphone). Gemini is imitated by the local stub, so
// "speech recognition" returns a fixed sentence. Real microphones, real speech
// recognition and the voices installed in Windows / Edge are NOT tested here.
const { test, expect, onlyEngines, mouseClick, VALID_KEY } = require('../support/fixtures');

/** Start recording every value the status line's data-state takes. */
async function recordVoiceStates(page) {
  await page.evaluate(() => {
    const el = document.getElementById('vStatusLine');
    window.__states = [el.dataset.state];
    new MutationObserver(() => {
      if (window.__states[window.__states.length - 1] !== el.dataset.state) window.__states.push(el.dataset.state);
    }).observe(el, { attributes: true, attributeFilter: ['data-state'] });
  });
}
const states = page => page.evaluate(() => window.__states);

test.describe('Web app: Voice tab', () => {
  test.describe('with a Gemini key', () => {
    test.use({ appOptions: { seed: { cfg: { ...onlyEngines(['gemini', 'google'], { gemini: VALID_KEY }), stt: 'gemini' }, src: 'en', tgt: 'fa' } } });

    test('holding Talk goes ready → listening → working → speaking → ready and adds a translated bubble', async ({ app }) => {
      test.setTimeout(90_000);
      const { page, stub, errors } = app;
      await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));
      const line = page.locator('#vStatusLine');
      await expect(line).toHaveAttribute('data-state', 'ready');
      await expect(page.locator('#vStatusText')).toHaveText('Ready · Hold to speak');
      await recordVoiceStates(page);

      const btn = page.locator('#vPttBtn');
      const box = await btn.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await expect(line).toHaveAttribute('data-state', 'listening');
      await expect(page.locator('#vStatusText')).toHaveText('Listening…');
      await page.waitForTimeout(2600); // "speak" for 2.6 s
      await page.mouse.up();

      await expect(page.locator('#bubbles .bub')).toHaveCount(1, { timeout: 20_000 });
      const bub = page.locator('#bubbles .bub').first();
      await expect(bub.locator('.bub-orig-text')).toHaveText('hello from the fake microphone');
      await expect(bub.locator('.bub-text')).toHaveText('[fa] hello from the fake microphone');
      await expect(line).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });

      const seen = await states(page);
      for (const s of ['listening', 'working', 'speaking']) expect(seen, `states seen: ${seen.join(' → ')}`).toContain(s);
      expect(seen.indexOf('listening')).toBeLessThan(seen.indexOf('working'));
      expect(seen.indexOf('working')).toBeLessThan(seen.indexOf('speaking'));
      expect(seen[seen.length - 1]).toBe('ready');

      // The recording really reached "Gemini" as WAV audio of a sensible length.
      const interp = stub.calls('generativelanguage.googleapis.com').find(c => c.body.includes('bilingual interpreter'));
      expect(interp, 'interpreter request').toBeTruthy();
      const audio = JSON.parse(interp.body).contents[0].parts[1].inlineData;
      expect(audio.mimeType).toBe('audio/wav');
      const wavBytes = Buffer.from(audio.data, 'base64');
      expect(wavBytes.slice(0, 4).toString()).toBe('RIFF');
      expect(wavBytes.length, 'about 2.6 s of 16 kHz 16-bit audio').toBeGreaterThan(16000 * 2 * 1.5);
      // The answer was read aloud with Gemini voice (no device voice for Persian in this browser).
      expect(stub.calls('generativelanguage.googleapis.com').some(c => /:streamGenerateContent$/.test(c.path))).toBe(true);
      expect(errors).toEqual([]);
    });

    test('Ask AI: a typed question gets a spoken answer', async ({ app }) => {
      const { page, errors } = app;
      await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));
      await mouseClick(page, page.locator('#vTabAsk'));
      await expect(page.locator('#vAskNoAi')).toBeHidden();
      await recordVoiceStates(page);
      await mouseClick(page, page.locator('#vAskIn'));
      await page.keyboard.type('What is the capital of France?');
      await page.keyboard.press('Enter');
      const answer = page.locator('#askBubbles .bub.b .bub-text');
      await expect(answer).toHaveText('This is the stub assistant answer.');
      await expect(page.locator('#vAskStatusLine')).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
      const seen = await states(page);
      expect(seen, `states seen: ${seen.join(' → ')}`).toContain('working');
      expect(seen).toContain('speaking');
      expect(errors).toEqual([]);
    });
  });

  test.describe('saved microphone setting', () => {
    test.use({ appOptions: { seed: { cfg: { ...onlyEngines(['google']), stt: 'browser' } } } });

    test('the Voice panel\'s "Microphone engine" menu shows the saved choice', async ({ app }) => {
      const { page } = app;
      await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));
      await mouseClick(page, page.locator('#vToggleSettings'));
      await expect(page.locator('#sttSel'), 'the same setting in Engines & keys').toHaveValue('browser');
      await expect(page.locator('#vSttChoice'), 'the Voice panel menu').toHaveValue('browser');
    });
  });

  test.describe('without any AI key', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), src: 'en', tgt: 'fa' } } });

    test('with "Microphone engine: Browser", Talk does not start downloading the offline Whisper model', async ({ app }) => {
      test.setTimeout(60_000);
      const { page, stub } = app;
      await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));
      await mouseClick(page, page.locator('#vToggleSettings'));
      await page.locator('#vSttChoice').selectOption('browser');
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mkt_cfg')).stt)).toBe('browser');
      const btn = page.locator('#vPttBtn');
      const box = await btn.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await expect(page.locator('#vStatusLine')).toHaveAttribute('data-state', 'listening');
      await page.waitForTimeout(2000);
      await page.mouse.up();
      await page.waitForTimeout(4000);
      const modelFetches = stub.log.filter(e => e.host === 'cdn.jsdelivr.net' && e.path.includes('huggingface') || e.host === 'huggingface.co');
      expect(modelFetches.map(e => e.host + e.path), 'requests for the offline AI library / Whisper model').toEqual([]);
    });
  });
});
