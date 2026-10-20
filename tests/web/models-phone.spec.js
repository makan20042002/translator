'use strict';

const { test, expect, mouseClick } = require('../support/fixtures');

const HIDDEN_MODEL_IDS = [
  'tr-nllb-600',
  'tr-nllb-1.3b',
  'tr-m2m100-418',
  'tr-m2m100-1.2b',
  'tr-mbart50-large',
  'asr-large-v3-turbo',
  'asr-large-v3',
  'asr-distil-large-v3',
  'fa_IR-amir-medium',
  'fa_IR-ganji-medium',
  'en_GB-alba-medium',
  'en_US-cori-medium',
  'en_US-kristin-medium',
  'en_US-libritts_r-medium',
  'en_US-ljspeech-medium',
  'ocr-rapidocr-det',
  'ocr-rapidocr-rec',
  'ocr-rapidocr-rec-fa',
  'opus-en-fa',
  'opus-fa-en'
];

test.describe('ITEM 2: Only online + small Whisper on phones', () => {
  test('phone UA: hidden models are not in DOM or not visible, only 3 Whisper models listed with RAM note on Small', async ({ webBrowser, stub }) => {
    const context = await webBrowser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      isMobile: true
    });
    const page = await context.newPage();
    const modelRequests = [];
    page.on('request', req => {
      const u = req.url();
      if (/huggingface\.co/i.test(u)) {
        modelRequests.push(u);
      }
    });

    await page.goto(stub.appUrl);
    await expect(page.locator('html')).toHaveClass(/is-phone/);

    // Switch to Model Hub tab
    await mouseClick(page, page.locator('#tabs button[data-tab="models"]'));
    await expect(page.locator('#modelHubCatalog')).toBeVisible();

    // Check each hidden model ID is NOT visible in Model Hub
    for (const id of HIDDEN_MODEL_IDS) {
      const card = page.locator(`#modelHubCatalog [data-hub-mdl="${id}"]`);
      await expect(card, `model ${id} must not be visible on phone`).not.toBeVisible();
    }

    // Verify exactly the three Whisper models are visible
    const tinyCard = page.locator('#modelHubCatalog [data-hub-mdl="asr-tiny"]');
    const baseCard = page.locator('#modelHubCatalog [data-hub-mdl="asr-base"]');
    const smallCard = page.locator('#modelHubCatalog [data-hub-mdl="asr-small"]');

    await expect(tinyCard).toBeVisible();
    await expect(baseCard).toBeVisible();
    await expect(smallCard).toBeVisible();

    // Check plain RAM note on Whisper Small in English
    const smallTextEn = await smallCard.textContent();
    expect(smallTextEn).toContain('Needs a recent phone with about 8 GB RAM');

    // Switch to Persian and verify note in FA
    await mouseClick(page, page.locator('#uiLang'));
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
    const smallTextFa = await smallCard.textContent();
    expect(smallTextFa).toContain('به یک گوشی جدید با حدود ۸ گیگابایت رم نیاز دارد');

    // Zero requests made for any hidden model host
    expect(modelRequests, 'zero model download requests triggered automatically').toEqual([]);

    await context.close();
  });

  test('phone UA: stored hidden choice falls back to best available Whisper or online engine with no error', async ({ webBrowser, stub }) => {
    const context = await webBrowser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      isMobile: true
    });
    // Seed storage with hidden models
    await context.addInitScript(() => {
      localStorage.setItem('mkt_whisper', JSON.stringify('large-v3-turbo'));
      localStorage.setItem('mkt_engine', JSON.stringify('nllb'));
      localStorage.setItem('mkt_trModel', JSON.stringify('tr-nllb-600'));
      localStorage.setItem('mkt_voiceTransEngine', JSON.stringify('nllb'));
    });

    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(stub.appUrl);
    await expect(page.locator('html')).toHaveClass(/is-phone/);

    // Verify fallbacks
    const fallbackEngine = await page.evaluate(() => store.get('engine'));
    const fallbackWhisper = await page.evaluate(() => store.get('whisper'));
    const asrResult = await page.evaluate(() => {
      const m = typeof asrModel === 'function' ? asrModel() : null;
      return m ? m.key : null;
    });

    expect(fallbackEngine).not.toBe('nllb');
    expect(fallbackWhisper).not.toBe('large-v3-turbo');
    expect(['tiny', 'base', 'small']).toContain(asrResult);
    expect(errors).toEqual([]);

    await context.close();
  });

  test('desktop user agent: hidden models are all present and accessible', async ({ app }) => {
    const { page } = app;
    // Even at narrow 360 px viewport, desktop browser has all models
    await page.setViewportSize({ width: 360, height: 740 });

    await expect(page.locator('html')).not.toHaveClass(/is-phone/);

    await mouseClick(page, page.locator('#tabs button[data-tab="models"]'));
    await expect(page.locator('#modelHubCatalog')).toBeVisible();

    // Key desktop models are present
    await expect(page.locator('#modelHubCatalog [data-hub-mdl="tr-nllb-600"]')).toBeVisible();
    await expect(page.locator('#modelHubCatalog [data-hub-mdl="asr-large-v3-turbo"]')).toBeVisible();
    await expect(page.locator('#modelHubCatalog [data-hub-mdl="fa_IR-amir-medium"]')).toBeVisible();
  });
});
