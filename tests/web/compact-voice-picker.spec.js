'use strict';
// Compact voice picker next to speak buttons (Text tab, Conversation, Live, Ask AI):
// Lists grouped voices (device, offline downloaded, offline available, Gemini),
// Persian first for Persian text, each with Preview and Download for undownloaded voices.
// Synchronized two-way with speech settings (#voiceSel and #voicePickerList),
// controls the voice actually used, and survives reload.
const { test, expect, onlyEngines, mouseClick } = require('../support/fixtures');
const { fakeDownloaded, openSettings } = require('../support/model-helpers');

test.describe('Web app: compact voice picker where voices are used', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), tgt: 'fa' } } });

  /** Setup mock device voices and a mock piper worker */
  async function setupVoices(page, { devices = [] } = {}) {
    await page.evaluate(devs => {
      window.__posted = [];
      window.Worker = class {
        constructor(url) { this.url = String(url); }
        postMessage(m) {
          window.__posted.push(m);
          setTimeout(() => {
            const send = d => this.onmessage && this.onmessage({ data: d });
            if (m.cmd === 'speak') send({ type: 'audio', id: m.id, index: 0, last: true, rate: 22050, pcm: Float32Array.from({ length: 4410 }, () => 0) });
            send({ id: m.id, ok: true, res: true });
          }, 5);
        }
      };
      HTMLMediaElement.prototype.play = function () {
        setTimeout(() => this.dispatchEvent(new Event('ended')), 20);
        return Promise.resolve();
      };
      speechSynthesis.getVoices = () => devs.map(d => ({
        name: d.name || ('Voice ' + d.lang),
        lang: d.lang,
        voiceURI: d.voiceURI || ('uri-' + d.lang),
        localService: true
      }));
    }, devices);
  }

  async function mockPiperDownloaded(page, id) {
    const cat = await page.evaluate(() => MODEL_CATALOG);
    const m = cat.models.find(x => x.id === id);
    if (m) {
      await fakeDownloaded(page, m.repo, m.files);
      await page.evaluate(() => mcScan());
    }
    return m;
  }

  test('next to the speaker button in the Text tab, the compact selector lists all groups with previews and download', async ({ app }) => {
    const { page } = app;
    await setupVoices(page, {
      devices: [
        { name: 'Persian Dilnavaz', lang: 'fa-IR', voiceURI: 'dev-fa-dilnavaz' },
        { name: 'English David', lang: 'en-US', voiceURI: 'dev-en-david' }
      ]
    });
    await mockPiperDownloaded(page, 'tts-fa-amir');

    // The compact picker button is right next to #tSpeak in translation header
    const btn = page.locator('#tVoicePickerBtn');
    await expect(btn).toBeVisible();

    // Click to open popup
    await btn.click();
    const popup = page.locator('#tVoicePopup');
    await expect(popup).toBeVisible();

    const pickerList = page.locator('#tVoicePickerList');
    // Group 1: Device voices with Persian first
    const devGroup = pickerList.locator('[data-group="device"]');
    await expect(devGroup).toBeVisible();
    await expect(devGroup.locator('.voice-card').first()).toContainText('Persian Dilnavaz');

    // Group 2: Offline downloaded
    const dlGroup = pickerList.locator('[data-group="offline-downloaded"]');
    await expect(dlGroup).toBeVisible();
    await expect(dlGroup.locator('.voice-card')).toContainText(['Amir']);

    // Group 3: Offline available with Download button
    const availGroup = pickerList.locator('[data-group="offline-available"]');
    await expect(availGroup).toBeVisible();
    await expect(availGroup.locator('[data-act="dl-piper"]').first()).toBeVisible();

    // Group 4: Gemini voices
    const gemGroup = pickerList.locator('[data-group="gemini"]');
    await expect(gemGroup).toBeVisible();
    await expect(gemGroup.locator('.voice-card')).toContainText(['Kore', 'Puck']);

    // Previews are present in the cards
    await expect(pickerList.locator('[data-act="preview"]').first()).toBeVisible();
  });

  test('choosing a voice in the compact selector changes the settings picker and the reverse', async ({ app }) => {
    const { page } = app;
    await setupVoices(page, {
      devices: [
        { name: 'Persian Dilnavaz', lang: 'fa-IR', voiceURI: 'dev-fa-dilnavaz' }
      ]
    });

    // 1. Choose device voice in compact picker
    await page.locator('#tVoicePickerBtn').click();
    const devCard = page.locator('#tVoicePickerList .voice-card[data-voice="dev-fa-dilnavaz"]');
    await devCard.click();

    // Check setting saved
    expect(await page.evaluate(() => cfg.tts.voices.fa)).toBe('dev-fa-dilnavaz');

    // Settings dropdown #voiceSel is in sync
    expect(await page.locator('#voiceSel').inputValue()).toBe('dev-fa-dilnavaz');

    // Check label on compact button updated
    await expect(page.locator('#tVoiceCurLabel')).toContainText('Persian Dilnavaz');

    // 2. The reverse: change voice in settings picker to Gemini Puck
    await openSettings(page);
    await page.locator('#voiceSel').selectOption('gemini:Puck');
    await page.locator('#voiceSel').dispatchEvent('change');

    expect(await page.evaluate(() => cfg.tts.voices.fa)).toBe('gemini:Puck');
    await expect(page.locator('#tVoiceCurLabel')).toContainText('Puck');
  });

  test('the chosen voice is the one used to speak', async ({ app }) => {
    const { page } = app;
    await setupVoices(page, {
      devices: [
        { name: 'Persian Dilnavaz', lang: 'fa-IR', voiceURI: 'dev-fa-dilnavaz' }
      ]
    });

    // Select Persian Dilnavaz in compact picker
    await page.locator('#tVoicePickerBtn').click();
    await page.locator('#tVoicePickerList .voice-card[data-voice="dev-fa-dilnavaz"]').click();

    // resolveVoice uses this chosen voice
    const resolved = await page.evaluate(() => resolveVoice('fa'));
    expect(resolved.kind).toBe('device');
    expect(resolved.voice.voiceURI).toBe('dev-fa-dilnavaz');
  });

  test('the choice survives reload', async ({ app }) => {
    const { page } = app;
    await setupVoices(page);

    // Choose Gemini Kore via compact picker
    await page.locator('#tVoicePickerBtn').click();
    await page.locator('#tVoicePickerList .voice-card[data-voice="gemini:Kore"]').click();

    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mkt_cfg')).tts.voices.fa)).toBe('gemini:Kore');

    // Reload page
    await page.reload();

    // Check that button shows chosen voice and cfg preserves it
    expect(await page.evaluate(() => cfg.tts.voices.fa)).toBe('gemini:Kore');
    await expect(page.locator('#tVoiceCurLabel')).toContainText('Kore');
  });

  test('compact voice selectors also exist in Voice tab wherever answers are spoken (Ask AI, conversation, Live)', async ({ app }) => {
    const { page } = app;
    await setupVoices(page);

    // Switch to Voice tab
    await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));

    // 1. Conversation voice selector
    const convBtn = page.locator('#vConvVoicePickerBtn');
    await expect(convBtn).toBeVisible();
    await convBtn.click();
    await expect(page.locator('#vConvVoicePopup')).toBeVisible();
    await expect(page.locator('#vConvVoicePickerList [data-group="gemini"]')).toBeVisible();

    // 2. Live voice selector
    const liveBtn = page.locator('#vLiveVoicePickerBtn');
    await expect(liveBtn).toBeVisible();
    await liveBtn.click();
    await expect(page.locator('#vLiveVoicePopup')).toBeVisible();
    await expect(page.locator('#vLiveVoicePickerList [data-group="gemini"]')).toBeVisible();

    // 3. Ask AI voice selector
    await mouseClick(page, page.locator('#vTabAsk'));
    const askBtn = page.locator('#vAskVoicePickerBtn');
    await expect(askBtn).toBeVisible();
    await askBtn.click();
    await expect(page.locator('#vAskVoicePopup')).toBeVisible();
    await expect(page.locator('#vAskVoicePickerList [data-group="gemini"]')).toBeVisible();
  });
});
