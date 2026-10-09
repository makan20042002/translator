'use strict';
// Unified voice picker in settings:
// Shows all voices grouped by source (device, offline downloaded, offline available, Gemini),
// Persian first, with previews, download buttons for undownloaded voices, and fallback to Auto.
const { test, expect, onlyEngines, mouseClick } = require('../support/fixtures');
const { fakeDownloaded, openSettings } = require('../support/model-helpers');

test.describe('Web app: unified voice picker', () => {
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

  test('the list shows each group: device voices, offline downloaded, offline available, and Gemini voices', async ({ app }) => {
    const { page } = app;
    await setupVoices(page, {
      devices: [
        { name: 'Persian Dilnavaz', lang: 'fa-IR', voiceURI: 'dev-fa-dilnavaz' },
        { name: 'English David', lang: 'en-US', voiceURI: 'dev-en-david' }
      ]
    });
    // Download Amir offline voice
    await mockPiperDownloaded(page, 'tts-fa-amir');

    await openSettings(page);
    await page.evaluate(() => fillVoices());

    const picker = page.locator('#voicePickerList');
    await expect(picker).toBeVisible();

    // Group 1: Device voices
    const devGroup = picker.locator('[data-group="device"]');
    await expect(devGroup).toBeVisible();
    await expect(devGroup.locator('.voice-card')).toHaveCount(2);
    // Persian device voice should be listed first among device voices
    const firstDevName = await devGroup.locator('.voice-card').first().textContent();
    expect(firstDevName).toContain('Persian Dilnavaz');

    // Group 2: Offline downloaded voices
    const dlGroup = picker.locator('[data-group="offline-downloaded"]');
    await expect(dlGroup).toBeVisible();
    await expect(dlGroup.locator('.voice-card')).toContainText(['Amir']);

    // Group 3: Offline available (not yet downloaded)
    const availGroup = picker.locator('[data-group="offline-available"]');
    await expect(availGroup).toBeVisible();
    await expect(availGroup.locator('.voice-card')).not.toHaveCount(0);

    // Group 4: Gemini voices
    const gemGroup = picker.locator('[data-group="gemini"]');
    await expect(gemGroup).toBeVisible();
    await expect(gemGroup.locator('.voice-card')).toContainText(['Kore', 'Puck', 'Charon']);

    // Check language and source labels exist
    await expect(devGroup.locator('.voice-card').first()).toContainText('Device');
    await expect(dlGroup.locator('.voice-card').first()).toContainText('Offline voice');
  });

  test('a not-downloaded voice offers Download', async ({ app }) => {
    const { page } = app;
    await setupVoices(page);

    await openSettings(page);
    await page.evaluate(() => fillVoices());

    const availGroup = page.locator('#voicePickerList [data-group="offline-available"]');
    await expect(availGroup).toBeVisible();

    // Look for download buttons on offline available cards
    const dlButtons = availGroup.locator('[data-act="dl-piper"]');
    await expect(dlButtons.first()).toBeVisible();
    await expect(dlButtons.first()).toHaveText(/Download|دریافت/);

    // Clicking download should trigger mcDownload
    await page.evaluate(() => {
      window.__mcDownloadCalled = [];
      const origDl = window.mcDownload;
      window.mcDownload = async m => {
        window.__mcDownloadCalled.push(m.id);
        return origDl ? origDl(m) : Promise.resolve();
      };
    });

    await dlButtons.first().click();
    const called = await page.evaluate(() => window.__mcDownloadCalled);
    expect(called.length).toBeGreaterThan(0);
  });

  test('choosing a voice is the one used', async ({ app }) => {
    const { page } = app;
    await setupVoices(page, {
      devices: [
        { name: 'Persian Dilnavaz', lang: 'fa-IR', voiceURI: 'dev-fa-dilnavaz' }
      ]
    });

    await openSettings(page);
    await page.evaluate(() => fillVoices());

    // Click the device voice card in the unified picker
    const devCard = page.locator('#voicePickerList .voice-card[data-voice="dev-fa-dilnavaz"]');
    await expect(devCard).toBeVisible();
    await devCard.click();

    // Check that choice is saved in settings
    const saved = await page.evaluate(() => cfg.tts.voices.fa);
    expect(saved).toBe('dev-fa-dilnavaz');

    // And synced to #voiceSel
    expect(await page.locator('#voiceSel').inputValue()).toBe('dev-fa-dilnavaz');

    // resolveVoice uses this chosen voice
    const resolved = await page.evaluate(() => resolveVoice('fa'));
    expect(resolved.kind).toBe('device');
    expect(resolved.voice.voiceURI).toBe('dev-fa-dilnavaz');
  });

  test('unavailable voice falls back with a message', async ({ app }) => {
    const { page } = app;
    await setupVoices(page);

    // Deliberately set an unavailable voice in settings
    await page.evaluate(() => {
      cfg.tts.voices.fa = 'dev-ghost-nonexistent';
      saveCfg();
    });

    // Test speech execution
    await page.evaluate(async () => {
      const tok = ++speakTok;
      await speakResolved('سلام', 'fa', tok, () => {}, () => {});
    });

    // resolveVoice should have fallen back to Auto (e.g. none, gemini or piper)
    const resolved = await page.evaluate(() => resolveVoice('fa'));
    expect(resolved.voice?.voiceURI).not.toBe('dev-ghost-nonexistent');

    // Visible message displayed
    const notice = page.locator('#speakNoticeText');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(/Selected voice is unavailable|صدای انتخاب‌شده در دسترس نیست/);
  });

  test('the choice survives reload', async ({ app }) => {
    const { page } = app;
    await setupVoices(page, {
      devices: [
        { name: 'Persian Dilnavaz', lang: 'fa-IR', voiceURI: 'dev-fa-dilnavaz' }
      ]
    });

    await openSettings(page);
    await page.evaluate(() => fillVoices());

    // Select Gemini voice Puck
    const gemCard = page.locator('#voicePickerList .voice-card[data-voice="gemini:Puck"]');
    await expect(gemCard).toBeVisible();
    await gemCard.click();

    // Verify localStorage has the choice
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('mkt_cfg')).tts.voices.fa);
    expect(stored).toBe('gemini:Puck');

    // Reload page
    await page.reload();

    // Open settings and verify voice remains chosen
    await openSettings(page);
    await page.evaluate(() => fillVoices());

    const isChecked = await page.locator('#voicePickerList input[name="voiceRadio"][value="gemini:Puck"]').isChecked();
    expect(isChecked).toBe(true);
    expect(await page.evaluate(() => cfg.tts.voices.fa)).toBe('gemini:Puck');
  });
});
