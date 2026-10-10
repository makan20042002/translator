'use strict';
const { test, expect, mouseClick } = require('../support/fixtures');
const path = require('path');

test.describe('Screen Translator Desktop Web Integration', () => {
  test('initializes desktop UI, populates OCR languages and settings', async ({ app }) => {
    const { page, context } = app;

    // Inject mock desktop API before reloading page
    await context.addInitScript(() => {
      window.__startCaptured = 0;
      window.__savedConfigs = [];
      window.__sentResponses = [];

      window.makanDesktop = {
        isDesktop: true,
        startScreenTranslator: () => {
          window.__startCaptured++;
        },
        getOcrLanguages: () => Promise.resolve([
          { tag: 'en-US', displayName: 'English (United States)', nativeName: 'English' },
          { tag: 'fa-IR', displayName: 'Persian', nativeName: 'فارسی' }
        ]),
        getScreenTransConfig: () => Promise.resolve({
          enabled: true,
          hotkey: 'CommandOrControl+Shift+S',
          targetLang: 'fa',
          ocrLang: 'en-US',
          autoCopy: false,
          saveHistory: true
        }),
        saveScreenTransConfig: (cfg) => {
          window.__savedConfigs.push(cfg);
          return Promise.resolve({ ok: true, config: cfg });
        },
        onExecuteScreenTranslation: (handler) => {
          window.__execTransHandler = handler;
        },
        sendScreenTranslationResponse: (resp) => {
          window.__sentResponses.push(resp);
        },
        onLoadTranslationInput: (handler) => {
          window.__loadInputHandler = handler;
        }
      };
    });

    await page.reload();


    // 1. Verify Screen Translator nav button is visible in desktop mode
    const btnScreen = page.locator('#btnScreenTrans');
    await expect(btnScreen).toBeVisible();

    // 2. Click nav button and ensure startScreenTranslator is invoked
    await mouseClick(page, btnScreen);
    const startCount = await page.evaluate(() => window.__startCaptured);
    expect(startCount).toBe(1);

    // 3. Open settings modal
    await mouseClick(page, page.locator('#openSet'));
    await expect(page.locator('#ov')).toHaveClass(/\bon\b/);

    // 4. Verify Screen Translator settings section is visible
    const stBlock = page.locator('#screenTransSettingsBlock');
    await expect(stBlock).toBeVisible();

    // 5. Verify OCR language dropdown populated
    const ocrOptions = page.locator('#stOcrLang option');
    await expect(ocrOptions).toHaveCount(3); // auto, en-US, fa-IR
    await expect(page.locator('#stOcrLang')).toHaveValue('en-US');
    await expect(page.locator('#stTgtLang')).toHaveValue('fa');

    // 6. Test onExecuteScreenTranslation integration with MAKAN translate pipeline
    await page.evaluate(async () => {
      if (window.__execTransHandler) {
        await window.__execTransHandler({
          id: 42,
          text: 'Hello world',
          src: 'en',
          tgt: 'fa',
          engine: 'google'
        });
      }
    });

    // Check response received from translation pipeline
    const responses = await page.evaluate(() => window.__sentResponses);
    expect(responses.length).toBeGreaterThan(0);
    const lastResp = responses[0];
    expect(lastResp.id).toBe(42);
    expect(lastResp.ok).toBe(true);
    expect(typeof lastResp.translation).toBe('string');
    expect(lastResp.translation.length).toBeGreaterThan(0);

    // 7. Test "Open in App" handler
    await page.evaluate(() => {
      if (window.__loadInputHandler) {
        window.__loadInputHandler({
          text: 'Recognized OCR Sample Text',
          src: 'en',
          tgt: 'fa'
        });
      }
    });

    await expect(page.locator('#tIn')).toHaveValue('Recognized OCR Sample Text');
  });

  test('floating overlay page supports Persian RTL, actions, and collapsible OCR text', async ({ page }) => {
    // Navigate directly to the overlay HTML file
    const overlayPath = 'file:///' + path.resolve(__dirname, '../../screen-translator/overlay.html').replace(/\\/g, '/');
    
    // Inject mock overlay APIs
    await page.addInitScript(() => {
      window.__overlayTranslations = [];
      window.__overlayCloses = 0;
      window.__overlayPinned = false;

      window.makanOverlay = {
        close: () => { window.__overlayCloses++; },
        setPinned: (p) => { window.__overlayPinned = p; },
        requestTranslation: (req) => { window.__overlayTranslations.push(req); },
        openInMainApp: () => {},
        onOcrResult: (cb) => { window.__ocrCb = cb; },
        onTranslationResult: (cb) => { window.__transCb = cb; }
      };
    });

    await page.goto(overlayPath);

    // Verify elements exist
    await expect(page.locator('#btnClose')).toBeVisible();
    await expect(page.locator('#btnCopyTrans')).toBeVisible();
    await expect(page.locator('#btnRetry')).toBeVisible();

    // Simulate OCR result received from native Windows OCR
    await page.evaluate(() => {
      if (window.__ocrCb) {
        window.__ocrCb({
          ok: true,
          text: 'Welcome to MAKAN Screen Translator',
          language: 'en-US'
        });
      }
    });

    // Verify original text accordion shows OCR text
    await expect(page.locator('#originalContent')).toHaveText('Welcome to MAKAN Screen Translator');

    // Simulate Translation result received
    await page.evaluate(() => {
      if (window.__transCb) {
        window.__transCb({
          ok: true,
          translation: 'به مترجم صفحه ماکان خوش آمدید',
          detectedSrc: 'en'
        });
      }
    });

    // Verify Persian translation is visible and has RTL direction
    const transContent = page.locator('#transContent');
    await expect(transContent).toBeVisible();
    await expect(transContent).toHaveAttribute('dir', 'rtl');
    await expect(transContent).toHaveText('به مترجم صفحه ماکان خوش آمدید');

    // Test pin toggle
    await mouseClick(page, page.locator('#btnPin'));
    const isPinned = await page.evaluate(() => window.__overlayPinned);
    expect(isPinned).toBe(true);

    // Test close
    await mouseClick(page, page.locator('#btnClose'));
    const closeCount = await page.evaluate(() => window.__overlayCloses);
    expect(closeCount).toBe(1);
  });
});
