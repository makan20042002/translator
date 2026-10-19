'use strict';
// Speech recognition choice in the Voice tab near the mic:
// Lists downloaded offline Whisper models and online options (Browser, Gemini, Groq),
// marking which are offline and which online, with Download buttons for undownloaded models.
// Synchronized two-way with speech settings (#sttSel, #vSttChoice, #offWhisperSel / cfg.whisper),
// ensures the chosen model/engine is invoked and displayed in result bubbles, and survives reload.
const { test, expect, onlyEngines, mouseClick } = require('../support/fixtures');
const { fakeDownloaded, openSettings } = require('../support/model-helpers');

test.describe('Web app: speech recognition choice in Voice tab', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), src: 'en', tgt: 'fa' } } });

  function installFakeBrowserRecognition() {
    class FakeRecognition {
      constructor() { this.lang = ''; this.interimResults = false; this.continuous = false; }
      start() { window.__recognitionStarted = (window.__recognitionStarted || 0) + 1; }
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

  async function mockWhisperDownloaded(page, id) {
    const cat = await page.evaluate(() => MODEL_CATALOG);
    const m = cat.models.find(x => x.id === id);
    if (m) {
      await page.evaluate(({ id, f }) => {
        const d = store.get('mdl', {});
        d[id] = { at: Date.now(), files: f };
        store.set('mdl', d);
      }, { id: m.id, f: m.files.map(f => f[0]).filter(f => f.endsWith('.onnx')) });
      await fakeDownloaded(page, m.repo, m.files);
      await page.evaluate(() => mcScan());
      await page.evaluate(() => mcRender());
    }
    return m;
  }

  async function holdTalk(page, selector, ms) {
    const box = await page.locator(selector).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(ms);
    await page.mouse.up();
  }

  test('selector lists downloaded Whisper models and online options, marking offline and online', async ({ app }) => {
    const { page } = app;
    await mockWhisperDownloaded(page, 'asr-base');

    // Go to Voice tab
    await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));

    const btn = page.locator('#vMicSttBtn');
    await expect(btn).toBeVisible();
    await expect(page.locator('#vMicSttCurLabel')).toHaveText(/Auto|خودکار/);

    // Open popup
    await btn.click();
    const popup = page.locator('#vMicSttPopup');
    await expect(popup).toBeVisible();

    const list = page.locator('#vMicSttList');

    // 1. Auto option
    await expect(list.locator('[data-group="auto-stt"]')).toBeVisible();

    // 2. Offline Whisper group
    const offGroup = list.locator('[data-group="offline-whisper"]');
    await expect(offGroup).toBeVisible();

    // Downloaded Whisper Base is ready
    const baseCard = offGroup.locator('.voice-card[data-whisper="base"]');
    await expect(baseCard).toBeVisible();
    await expect(baseCard).toContainText('Whisper Base');
    await expect(baseCard.locator('.badge')).toHaveText(/Offline|آفلاین/);

    // Undownloaded Whisper Small shows Download button
    const smallCard = offGroup.locator('.voice-card[data-whisper="small"]');
    await expect(smallCard).toBeVisible();
    await expect(smallCard.locator('[data-act="dl-whisper"]')).toBeVisible();

    // 3. Online options group
    const onGroup = list.locator('[data-group="online-stt"]');
    await expect(onGroup).toBeVisible();
    await expect(onGroup.locator('.voice-card[data-stt="browser"]')).toContainText('Browser');
    await expect(onGroup.locator('.voice-card[data-stt="gemini"]')).toContainText('Gemini');
    await expect(onGroup.locator('.voice-card[data-stt="groq"]')).toContainText('Groq');
    await expect(onGroup.locator('.voice-card[data-stt="browser"] .badge')).toHaveText('Online');
  });

  test('choosing an option in the selector is invoked and displayed in the result bubble', async ({ app }) => {
    test.setTimeout(60_000);
    const { page, context } = app;
    await context.addInitScript(installFakeBrowserRecognition);
    await page.reload();

    await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));

    // Select Browser (online) from the compact mic STT picker
    await page.locator('#vMicSttBtn').click();
    await page.locator('#vMicSttList .voice-card[data-stt="browser"]').click();

    expect(await page.evaluate(() => cfg.stt)).toBe('browser');
    await expect(page.locator('#vMicSttCurLabel')).toHaveText('Browser');

    // Speak using the talk button
    await holdTalk(page, '#vPttBtn', 1500);

    const bub = page.locator('#bubbles .bub').first();
    await expect(bub.locator('.bub-orig-text')).toHaveText('hello from browser recognition', { timeout: 20_000 });

    // The result bubble tag shows Browser
    await expect(bub.locator('.bub-tag').first()).toContainText('Browser');
  });

  test('stays in sync with speech settings (#sttSel, #vSttChoice, and #offWhisperSel)', async ({ app }) => {
    const { page } = app;
    await mockWhisperDownloaded(page, 'asr-base');

    await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));

    // 1. Pick Whisper Base from the mic STT picker
    await page.locator('#vMicSttBtn').click();
    await page.locator('#vMicSttList .voice-card[data-whisper="base"]').click();

    expect(await page.evaluate(() => cfg.stt)).toBe('whisper');
    expect(await page.evaluate(() => cfg.whisper)).toBe('base');
    await expect(page.locator('#vMicSttCurLabel')).toHaveText('Whisper Base');

    // Settings dropdowns are in sync
    expect(await page.locator('#vSttChoice').inputValue()).toBe('whisper');
    expect(await page.locator('#sttSel').inputValue()).toBe('whisper');
    expect(await page.locator('#offWhisperSel').inputValue()).toBe('base');

    // 2. Reverse: changing settings dropdown updates mic STT picker
    await mouseClick(page, page.locator('#vToggleSettings'));
    await page.locator('#vSttChoice').selectOption('browser');
    await page.locator('#vSttChoice').dispatchEvent('change');

    expect(await page.evaluate(() => cfg.stt)).toBe('browser');
    await expect(page.locator('#vMicSttCurLabel')).toHaveText('Browser');
    expect(await page.locator('#sttSel').inputValue()).toBe('browser');

    // 3. Changing settings #sttSel to auto updates mic STT picker
    await openSettings(page, 'voiceModels');
    await page.locator('#sttSel').selectOption('auto');
    await page.locator('#sttSel').dispatchEvent('change');

    expect(await page.evaluate(() => cfg.stt)).toBe('auto');
    await expect(page.locator('#vMicSttCurLabel')).toHaveText(/Auto|خودکار/);
    expect(await page.locator('#vSttChoice').inputValue()).toBe('auto');
    expect(await page.locator('#offWhisperSel').inputValue()).toBe('base');
  });

  test('choice survives reload', async ({ app }) => {
    const { page } = app;
    await mockWhisperDownloaded(page, 'asr-base');

    await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));

    // Pick Whisper Base
    await page.locator('#vMicSttBtn').click();
    await page.locator('#vMicSttList .voice-card[data-whisper="base"]').click();

    expect(await page.evaluate(() => cfg.stt)).toBe('whisper');
    expect(await page.evaluate(() => cfg.whisper)).toBe('base');

    // Reload
    await page.reload();

    expect(await page.evaluate(() => cfg.stt)).toBe('whisper');
    expect(await page.evaluate(() => cfg.whisper)).toBe('base');
    await expect(page.locator('#vMicSttCurLabel')).toHaveText('Whisper Base');
  });

  test('Python helper options (Whisper large-v3 and Qwen3-ASR) are displayed and synchronized', async ({ app }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));

    // Open mic STT popup
    await page.locator('#vMicSttBtn').click();
    const list = page.locator('#vMicSttList');

    const helperGroup = list.locator('[data-group="helper-asr"]');
    await expect(helperGroup).toBeVisible();

    const whisperL3Card = helperGroup.locator('.voice-card[data-helper-model="whisper-large-v3"]');
    await expect(whisperL3Card).toBeVisible();
    await expect(whisperL3Card).toContainText('Whisper large-v3');

    const qwenCard = helperGroup.locator('.voice-card[data-helper-model="qwen3-asr"]');
    await expect(qwenCard).toBeVisible();
    await expect(qwenCard).toContainText('Qwen3-ASR');

    // Select Whisper Large v3
    await whisperL3Card.click();

    expect(await page.evaluate(() => cfg.stt)).toBe('helper');
    expect(await page.evaluate(() => cfg.helperModel)).toBe('whisper-large-v3');
    await expect(page.locator('#vMicSttCurLabel')).toHaveText('Whisper L3 (Helper)');
    expect(await page.locator('#helperSettingsWrap').getAttribute('hidden')).toBeNull();

    // Select Qwen3-ASR
    await page.locator('#vMicSttBtn').click();
    await qwenCard.click();

    expect(await page.evaluate(() => cfg.stt)).toBe('helper');
    expect(await page.evaluate(() => cfg.helperModel)).toBe('qwen3-asr');
    await expect(page.locator('#vMicSttCurLabel')).toHaveText('Qwen3-ASR (Helper)');

    // Reload and check persistence
    await page.reload();
    expect(await page.evaluate(() => cfg.stt)).toBe('helper');
    expect(await page.evaluate(() => cfg.helperModel)).toBe('qwen3-asr');
    await expect(page.locator('#vMicSttCurLabel')).toHaveText('Qwen3-ASR (Helper)');
  });

  test('Qwen3 displays "needs the helper, not included in v1" with no download button in picker and settings (ITEM 2)', async ({ app }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));

    // Open mic STT popup and check Qwen3 card in picker
    await page.locator('#vMicSttBtn').click();
    const list = page.locator('#vMicSttList');
    const helperGroup = list.locator('[data-group="helper-asr"]');
    await expect(helperGroup).toBeVisible();

    const qwenCard = helperGroup.locator('.voice-card[data-helper-model="qwen3-asr"]');
    await expect(qwenCard).toBeVisible();
    await expect(qwenCard).toContainText('needs the helper, not included in v1');
    await expect(qwenCard.locator('[data-act="dl-helper-model"]')).toHaveCount(0);

    // Click Qwen3 card to select it
    await qwenCard.click();
    expect(await page.evaluate(() => cfg.helperModel)).toBe('qwen3-asr');

    // Switch to Settings tab and check Helper model row
    await openSettings(page, 'voiceModels');

    const helperWrap = page.locator('#helperSettingsWrap');
    await expect(helperWrap).toBeVisible();

    const helperSel = page.locator('#helperModelSel');
    await expect(helperSel).toHaveValue('qwen3-asr');

    const qwenNotice = page.locator('#helperQwenNotice');
    await expect(qwenNotice).toBeVisible();
    await expect(qwenNotice).toHaveText('needs the helper, not included in v1');

    const dlBtn = page.locator('#btnDownloadHelperModel');
    await expect(dlBtn).toBeVisible();
  });

  test('helper model download sends selected whisper-large-v3 model in body and keeps cfg.helperModel as string (ITEM 1)', async ({ app }) => {
    const { page } = app;
    await openSettings(page, 'voiceModels');

    await page.evaluate(() => {
      cfg.stt = 'helper';
      cfg.helperModel = 'whisper-large-v3';
      saveCfg();
      updateHelperSettingsVisibility();
    });

    const helperWrap = page.locator('#helperSettingsWrap');
    await expect(helperWrap).toBeVisible();

    const helperSel = page.locator('#helperModelSel');
    await helperSel.selectOption('whisper-large-v3');

    let interceptedRequest = null;
    await page.route('http://127.0.0.1:8765/v1/models/load', async route => {
      interceptedRequest = route.request();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'loaded', model: 'whisper-large-v3' })
      });
    });

    const dlBtn = page.locator('#btnDownloadHelperModel');
    await expect(dlBtn).toBeVisible();
    await dlBtn.click();

    await expect.poll(() => interceptedRequest).not.toBeNull();
    expect(interceptedRequest.method()).toBe('POST');
    const reqBody = interceptedRequest.postDataJSON();
    expect(reqBody).toEqual({ model: 'whisper-large-v3' });

    const modelType = await page.evaluate(() => typeof cfg.helperModel);
    const modelVal = await page.evaluate(() => cfg.helperModel);
    expect(modelType).toBe('string');
    expect(modelVal).toBe('whisper-large-v3');
  });

  test('helper model download sends selected qwen3-asr model in body and keeps cfg.helperModel as string (ITEM 1)', async ({ app }) => {
    const { page } = app;
    await openSettings(page, 'voiceModels');

    await page.evaluate(() => {
      cfg.stt = 'helper';
      cfg.helperModel = 'whisper-large-v3';
      saveCfg();
      updateHelperSettingsVisibility();
    });

    const helperWrap = page.locator('#helperSettingsWrap');
    await expect(helperWrap).toBeVisible();

    const helperSel = page.locator('#helperModelSel');
    await helperSel.selectOption('qwen3-asr');

    let interceptedRequest = null;
    await page.route('http://127.0.0.1:8765/v1/models/load', async route => {
      interceptedRequest = route.request();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'loaded', model: 'qwen3-asr' })
      });
    });

    const dlBtn = page.locator('#btnDownloadHelperModel');
    await expect(dlBtn).toBeVisible();
    await dlBtn.click();

    await expect.poll(() => interceptedRequest).not.toBeNull();
    expect(interceptedRequest.method()).toBe('POST');
    const reqBody = interceptedRequest.postDataJSON();
    expect(reqBody).toEqual({ model: 'qwen3-asr' });

    const modelType = await page.evaluate(() => typeof cfg.helperModel);
    const modelVal = await page.evaluate(() => cfg.helperModel);
    expect(modelType).toBe('string');
    expect(modelVal).toBe('qwen3-asr');
  });

  test('helper model download displays HTTP 422 error detail in status line (EN) (ITEM 2)', async ({ app }) => {
    const { page } = app;
    await openSettings(page, 'voiceModels');

    await page.evaluate(() => {
      ui = 'en';
      applyI18n();
      cfg.stt = 'helper';
      cfg.helperModel = 'whisper-large-v3';
      saveCfg();
      updateHelperSettingsVisibility();
    });

    await page.route('http://127.0.0.1:8765/v1/models/load', async route => {
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Value error, invalid model' })
      });
    });

    const dlBtn = page.locator('#btnDownloadHelperModel');
    await dlBtn.click();

    const statusMsg = page.locator('#helperStatusMsg');
    await expect(statusMsg).toBeVisible();
    await expect(statusMsg).toContainText('HTTP 422');
    await expect(statusMsg).toContainText('Value error, invalid model');
    await expect(statusMsg).toContainText('Failed to load model');
    await expect(statusMsg).not.toContainText('Ensure helper server is running');
    await expect(statusMsg).not.toContainText('مطمئن شوید');
  });

  test('helper model download displays HTTP 422 error detail in status line (FA) (ITEM 2)', async ({ app }) => {
    const { page } = app;
    await openSettings(page, 'voiceModels');

    await page.evaluate(() => {
      ui = 'fa';
      applyI18n();
      cfg.stt = 'helper';
      cfg.helperModel = 'whisper-large-v3';
      saveCfg();
      updateHelperSettingsVisibility();
    });

    await page.route('http://127.0.0.1:8765/v1/models/load', async route => {
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Value error, invalid model' })
      });
    });

    const dlBtn = page.locator('#btnDownloadHelperModel');
    await dlBtn.click();

    const statusMsg = page.locator('#helperStatusMsg');
    await expect(statusMsg).toBeVisible();
    await expect(statusMsg).toContainText('HTTP 422');
    await expect(statusMsg).toContainText('Value error, invalid model');
    await expect(statusMsg).toContainText('بارگذاری مدل ناموفق بود');
    await expect(statusMsg).not.toContainText('Ensure helper server is running');
    await expect(statusMsg).not.toContainText('مطمئن شوید');
  });

  test('helper model download displays HTTP 500 error detail for missing module in status line (EN) (ITEM 2)', async ({ app }) => {
    const { page } = app;
    await openSettings(page, 'voiceModels');

    await page.evaluate(() => {
      ui = 'en';
      applyI18n();
      cfg.stt = 'helper';
      cfg.helperModel = 'qwen3-asr';
      saveCfg();
      updateHelperSettingsVisibility();
    });

    await page.route('http://127.0.0.1:8765/v1/models/load', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: "No module named 'qwen_asr'" })
      });
    });

    const dlBtn = page.locator('#btnDownloadHelperModel');
    await dlBtn.click();

    const statusMsg = page.locator('#helperStatusMsg');
    await expect(statusMsg).toBeVisible();
    await expect(statusMsg).toContainText('HTTP 500');
    await expect(statusMsg).toContainText("No module named 'qwen_asr'");
    await expect(statusMsg).toContainText('Failed to load model');
    await expect(statusMsg).not.toContainText('Ensure helper server is running');
    await expect(statusMsg).not.toContainText('مطمئن شوید');
  });

  test('helper model download displays HTTP 500 error detail for missing module in status line (FA) (ITEM 2)', async ({ app }) => {
    const { page } = app;
    await openSettings(page, 'voiceModels');

    await page.evaluate(() => {
      ui = 'fa';
      applyI18n();
      cfg.stt = 'helper';
      cfg.helperModel = 'qwen3-asr';
      saveCfg();
      updateHelperSettingsVisibility();
    });

    await page.route('http://127.0.0.1:8765/v1/models/load', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: "No module named 'qwen_asr'" })
      });
    });

    const dlBtn = page.locator('#btnDownloadHelperModel');
    await dlBtn.click();

    const statusMsg = page.locator('#helperStatusMsg');
    await expect(statusMsg).toBeVisible();
    await expect(statusMsg).toContainText('HTTP 500');
    await expect(statusMsg).toContainText("No module named 'qwen_asr'");
    await expect(statusMsg).toContainText('بارگذاری مدل ناموفق بود');
    await expect(statusMsg).not.toContainText('Ensure helper server is running');
    await expect(statusMsg).not.toContainText('مطمئن شوید');
  });

  test('helper model download displays generic hint only on network failure (EN) (ITEM 2)', async ({ app }) => {
    const { page } = app;
    await openSettings(page, 'voiceModels');

    await page.evaluate(() => {
      ui = 'en';
      applyI18n();
      cfg.stt = 'helper';
      cfg.helperModel = 'whisper-large-v3';
      saveCfg();
      updateHelperSettingsVisibility();
    });

    await page.route('http://127.0.0.1:8765/v1/models/load', async route => {
      await route.abort('failed');
    });

    const dlBtn = page.locator('#btnDownloadHelperModel');
    await dlBtn.click();

    const statusMsg = page.locator('#helperStatusMsg');
    await expect(statusMsg).toBeVisible();
    await expect(statusMsg).toContainText('Failed to load model');
    await expect(statusMsg).toContainText('Ensure helper server is running (python helper/server.py or desktop app).');
    await expect(statusMsg).not.toContainText('HTTP ');
  });

  test('helper model download displays generic hint only on network failure (FA) (ITEM 2)', async ({ app }) => {
    const { page } = app;
    await openSettings(page, 'voiceModels');

    await page.evaluate(() => {
      ui = 'fa';
      applyI18n();
      cfg.stt = 'helper';
      cfg.helperModel = 'whisper-large-v3';
      saveCfg();
      updateHelperSettingsVisibility();
    });

    await page.route('http://127.0.0.1:8765/v1/models/load', async route => {
      await route.abort('failed');
    });

    const dlBtn = page.locator('#btnDownloadHelperModel');
    await dlBtn.click();

    const statusMsg = page.locator('#helperStatusMsg');
    await expect(statusMsg).toBeVisible();
    await expect(statusMsg).toContainText('بارگذاری مدل ناموفق بود');
    await expect(statusMsg).toContainText('مطمئن شوید سرور کمکی در حال اجرا است (python helper/server.py یا برنامه دسکتاپ).');
    await expect(statusMsg).not.toContainText('HTTP ');
  });
});

