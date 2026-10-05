'use strict';
// Read-aloud in the extension card with the computer's own (device) voices.
const { test, expect, inShadow, dragSelect, pressM, inContentScriptWorld } = require('../support/ext-fixtures');

/**
 * This Chromium has no voices, so the tests give the content script a pretend
 * speech engine (in its own private world, where the extension's code runs).
 * It lists voices, records what it is asked to say and with which voice, and
 * "speaks" for about 0.8 s.
 */
const fakeSpeech = voices => `(() => {
  window.__spoken = [];
  const voices = ${JSON.stringify(voices)};
  class FakeUtterance { constructor(text) { this.text = text; this.voice = null; this.lang = ''; this.rate = 1; } }
  window.SpeechSynthesisUtterance = FakeUtterance;
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
    getVoices: () => voices, speaking: false,
    cancel() { window.__cancelled = (window.__cancelled || 0) + 1; },
    speak(u) {
      window.__spoken.push({ text: u.text, voice: u.voice && u.voice.name, lang: u.lang });
      setTimeout(() => u.onstart && u.onstart(), 20);
      setTimeout(() => u.onend && u.onend(), 800);
    }
  } });
  return true;
})()`;

const PERSIAN = { name: 'Microsoft Dariush Online (Natural) - Persian (Iran)', lang: 'fa-IR', voiceURI: 'dariush', localService: false, default: false };
const ENGLISH = { name: 'Microsoft Aria Online (Natural) - English (United States)', lang: 'en-US', voiceURI: 'aria', localService: false, default: true };
const spoken = (ext, page) => inContentScriptWorld(ext, page, 'JSON.stringify(window.__spoken)').then(JSON.parse);

async function openCard(page) {
  await dragSelect(page, '#li1');
  await pressM(page);
  await expect(inShadow(page, '.makan-result-text')).toHaveText('[fa] First item in the list of things.');
}

test.describe('Extension card: read aloud with the computer\'s voices', () => {
  test('uses an installed voice for the translation\'s language and does not ask Gemini', async ({ ext, stub }) => {
    const page = ext.article;
    await inContentScriptWorld(ext, page, fakeSpeech([ENGLISH, PERSIAN]));
    await openCard(page);
    await inShadow(page, '#makanSpeakBtn').click();
    await expect.poll(() => spoken(ext, page)).toEqual([{ text: '[fa] First item in the list of things.', voice: PERSIAN.name, lang: 'fa-IR' }]);
    await expect(inShadow(page, '#makanSpeakBtn span')).toHaveText('Stop');
    await expect(inShadow(page, '#makanSpeakBtn span')).toHaveText('Speak', { timeout: 5000 });
    await expect(inShadow(page, '.makan-voice-notice')).toHaveCount(0);
    expect(stub.calls('generativelanguage.googleapis.com').filter(c => /generateContent/i.test(c.path) && c.body.includes('AUDIO'))).toEqual([]);
  });

  test('never speaks with a voice of another language; says which voice is missing instead', async ({ ext }) => {
    const page = ext.article;
    await inContentScriptWorld(ext, page, fakeSpeech([ENGLISH]));
    await openCard(page);
    await inShadow(page, '#makanSpeakBtn').click();
    await expect(inShadow(page, '.makan-voice-notice')).toContainText('No browser voice installed for Persian');
    expect(await spoken(ext, page)).toEqual([]);
  });
});
