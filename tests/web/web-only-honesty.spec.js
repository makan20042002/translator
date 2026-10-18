'use strict';

/**
 * tests/web/web-only-honesty.spec.js
 * Verifies honesty of desktop-only features in the plain web browser vs desktop app:
 * - In plain browser (no desktop host):
 *     1. Screen Translator header button (#btnScreenTrans) is hidden.
 *     2. Screen reading (OCR) settings (#screenTransSettingsBlock) is visible with Persian model status, and launch controls (#btnTestScreenTrans) disabled with honesty notice.
 *     3. Screen tab primary capture button (#tabScreenLaunchBtn) is disabled with a visible notice (#screenBrowserBanner) in both EN and FA.
 *     4. Subtitles tab video-to-subtitles button (#subVideoBtn) is disabled with a visible helper note in both EN and FA.
 *     5. Python ASR helper settings show an explicit honesty notice (#helperHonestyNotice) in both EN and FA.
 *     6. Media tab "save next to file" option (.mt-pv-nextrow) is hidden without a desktop filesystem host.
 * - With desktop host fixture (window.makanDesktop injected):
 *     1. Screen Translator button (#btnScreenTrans) is visible.
 *     2. Screen Translator settings (#screenTransSettingsBlock) is visible.
 *     3. Screen tab primary capture button (#tabScreenLaunchBtn) is enabled.
 *     4. Browser banner (#screenBrowserBanner) is hidden.
 */

const { test, expect, mouseClick, watchConsole, activateSettingsTab } = require('../support/fixtures');

test.describe('Web-only Honesty Controls (ITEM 4)', () => {
  test('in plain browser, desktop-only features are hidden or disabled with clear explanations in EN and FA', async ({ app }) => {
    const { page } = app;

    // --- English Mode ---
    // 1. Header button is hidden in browser
    await expect(page.locator('#btnScreenTrans')).toBeHidden();

    // 2. Settings: Screen reading (OCR) section is visible, launch control disabled with notice
    await page.locator('#openSet').click();
    await activateSettingsTab(page, 'ocr');
    await expect(page.locator('#secOcr')).toBeVisible();
    await expect(page.locator('#screenTransSettingsBlock')).toBeVisible();
    await expect(page.locator('#stPersianModelCard')).toBeVisible();
    await expect(page.locator('#btnTestScreenTrans')).toBeDisabled();
    const btnTestTitle = await page.locator('#btnTestScreenTrans').getAttribute('title');
    expect(btnTestTitle).toContain('Native screen capture requires');
    await expect(page.locator('#stOcrStatusHint')).toContainText('Native screen capture requires the MAKAN Windows desktop app');

    // 3. Helper honesty notice in Settings
    const helperNotice = page.locator('#helperHonestyNotice');
    await expect(helperNotice).toContainText('Python ASR Helper requires running the local helper server');
    await page.locator('#closeSet').click();

    // 4. Screen tab: capture button disabled, browser banner visible with explanation
    await page.locator('#tabs button[data-tab="screen"]').click();
    await expect(page.locator('#screenBrowserBanner')).toBeVisible();
    await expect(page.locator('#screenBrowserBanner')).toContainText('Native screen capture requires the MAKAN Windows desktop app');
    await expect(page.locator('#tabScreenLaunchBtn')).toBeDisabled();
    const titleAttr = await page.locator('#tabScreenLaunchBtn').getAttribute('title');
    expect(titleAttr).toContain('Native screen capture requires');

    // 5. Subtitles tab: subVideoBtn is disabled with speech helper note
    await page.locator('#tabs button[data-tab="sub"]').click();
    await expect(page.locator('.sub-video-btn')).toBeDisabled();
    await expect(page.locator('.sub-video-note')).toBeVisible();
    await expect(page.locator('.sub-video-note')).toContainText('Requires the local speech helper desktop app');

    // 6. Media tab: save next to file is hidden
    await page.locator('#tabs button[data-tab="media"]').click();
    await expect(page.locator('.mt-pv-nextrow')).toBeHidden();

    // --- Switch to Persian (FA) Mode via toggle button ---
    await page.locator('#uiLang').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');

    // Verify Screen tab in Persian
    await page.locator('#tabs button[data-tab="screen"]').click();
    await expect(page.locator('#screenBrowserBanner')).toBeVisible();
    await expect(page.locator('#screenBrowserBanner')).toContainText('تصویربرداری بومی از صفحه به برنامه ویندوز MAKAN نیاز دارد');
    await expect(page.locator('#tabScreenLaunchBtn')).toBeDisabled();

    // Verify Subtitles tab in Persian
    await page.locator('#tabs button[data-tab="sub"]').click();
    await expect(page.locator('.sub-video-btn')).toBeDisabled();
    await expect(page.locator('.sub-video-note')).toContainText('نیاز به دستیار گفتار محلی دارد');

    // Verify OCR settings & Helper notice in Persian
    await page.locator('#openSet').click();
    await activateSettingsTab(page, 'ocr');
    await expect(page.locator('#secOcr')).toBeVisible();
    await expect(page.locator('#btnTestScreenTrans')).toBeDisabled();
    const btnTestTitleFa = await page.locator('#btnTestScreenTrans').getAttribute('title');
    expect(btnTestTitleFa).toContain('تصویربرداری بومی از صفحه');
    await expect(page.locator('#stOcrStatusHint')).toContainText('تصویربرداری بومی از صفحه');
    await expect(page.locator('#helperHonestyNotice')).toContainText('دستیار گفتار پایتون نیاز به اجرای سرور کمکی محلی');
    await page.locator('#closeSet').click();
  });

  test('disabled-button tooltips in web mode update dynamically when switching interface language (EN -> FA -> EN)', async ({ app }) => {
    const { page } = app;

    const launchBtn = page.locator('#tabScreenLaunchBtn');
    const testBtn = page.locator('#btnTestScreenTrans');

    // 1. Initial English state
    await page.locator('#tabs button[data-tab="screen"]').click();
    await expect(launchBtn).toBeDisabled();
    expect(await launchBtn.getAttribute('title')).toContain('Native screen capture requires');

    await page.locator('#openSet').click();
    await activateSettingsTab(page, 'ocr');
    await expect(testBtn).toBeDisabled();
    expect(await testBtn.getAttribute('title')).toContain('Native screen capture requires');
    await page.locator('#closeSet').click();

    // 2. Switch to Persian via real #uiLang button
    await page.locator('#uiLang').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');

    expect(await launchBtn.getAttribute('title')).toContain('تصویربرداری بومی از صفحه');

    await page.locator('#openSet').click();
    await activateSettingsTab(page, 'ocr');
    expect(await testBtn.getAttribute('title')).toContain('تصویربرداری بومی از صفحه');
    await page.locator('#closeSet').click();

    // 3. Switch back to English via real #uiLang button
    await page.locator('#uiLang').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    expect(await launchBtn.getAttribute('title')).toContain('Native screen capture requires');

    await page.locator('#openSet').click();
    await activateSettingsTab(page, 'ocr');
    expect(await testBtn.getAttribute('title')).toContain('Native screen capture requires');
    await page.locator('#closeSet').click();
  });

  test('with real-shaped desktop host fixture (what exe preload exposes today), Media filesystem/ffmpeg controls stay hidden', async ({ webBrowser, stub }) => {
    const context = await webBrowser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
    await context.grantPermissions(['microphone', 'clipboard-read', 'clipboard-write'], { origin: stub.appOrigin });
    await context.route(/(localhost|127\.0\.0\.1|\[::1\]):11434/, route => route.abort());

    // Inject the real-shaped desktop API mock matching exe preload-main.js (no Media filesystem methods)
    await context.addInitScript(() => {
      window.makanDesktop = {
        isDesktop: true,
        startScreenTranslator: () => {},
        getOcrLanguages: () => Promise.resolve([
          { tag: 'en-US', displayName: 'English (United States)', nativeName: 'English' },
          { tag: 'fa-IR', displayName: 'Persian', nativeName: 'فارسی' }
        ]),
        getOcrEngines: () => Promise.resolve([
          { id: 'windows', name: 'Windows Media OCR', available: true },
          { id: 'rapidocr', name: 'PaddleOCR / RapidOCR (ONNX)', available: true },
          { id: 'dual', name: 'Dual Engine', available: true }
        ]),
        getScreenTransConfig: () => Promise.resolve({
          enabled: true,
          hotkey: 'CommandOrControl+Shift+S',
          targetLang: 'fa',
          ocrLang: 'en-US',
          ocrEngine: 'windows',
          freezeFrame: true,
          clipboardWatcher: false,
          autoCopy: false,
          saveHistory: true
        }),
        saveScreenTransConfig: (cfg) => Promise.resolve({ ok: true, config: cfg }),
        loadAppConfig: () => Promise.resolve({}),
        saveAppConfig: () => Promise.resolve({ ok: true }),
        saveOcrModelFiles: () => Promise.resolve({ ok: true }),
        getDesktopAudioSource: () => Promise.resolve(null),
        onExecuteScreenTranslation: () => {},
        sendScreenTranslationResponse: () => {},
        onLoadTranslationInput: () => {}
      };
    });

    const page = await context.newPage();
    const errors = [];
    watchConsole(page, errors);
    stub.clearLog();
    stub.resetModes();
    await page.goto(stub.appUrl);
    await expect(page.locator('#tabs button').first()).toBeVisible();

    // 1. Header Screen Translator button is visible in desktop mode
    await expect(page.locator('#btnScreenTrans')).toBeVisible();

    // 2. Settings: Screen reading (OCR) block is visible in desktop mode and test button enabled
    await page.locator('#openSet').click();
    await activateSettingsTab(page, 'ocr');
    await expect(page.locator('#screenTransSettingsBlock')).toBeVisible();
    await expect(page.locator('#btnTestScreenTrans')).toBeEnabled();
    await page.locator('#closeSet').click();

    // 3. Screen tab: banner is hidden and capture button is enabled
    await page.locator('#tabs button[data-tab="screen"]').click();
    await expect(page.locator('#screenBrowserBanner')).toBeHidden();
    await expect(page.locator('#tabScreenLaunchBtn')).toBeEnabled();

    // 4. Media tab: with real-shaped desktop (lacks saveNextTo/ffmpeg), controls stay hidden
    await page.locator('#tabs button[data-tab="media"]').click();
    await expect(page.locator('#tab-media')).toBeVisible();
    await expect(page.locator('.mt-ff')).toBeHidden();
    await page.evaluate(() => {
      const card = document.querySelector('.mt-pv');
      if (window.MediaTranslate?.preview && card && window.MediaTranslate.host) {
        const pv = window.MediaTranslate.preview.create({ card, host: window.MediaTranslate.host });
        pv.update({
          visible: true,
          cues: [{ s: 0, e: 1, o: 'Hello', t: 'سلام' }],
          file: new File(['audio'], 'clip.mp4', { type: 'video/mp4' }),
          kind: 'video',
          version: 1
        });
      }
    });
    await expect(page.locator('.mt-pv-nextrow')).toBeHidden();

    // 5. Helper-dependent controls available in desktop mode
    await page.locator('#tabs button[data-tab="sub"]').click();
    await expect(page.locator('#tab-sub')).toBeVisible();
    await expect(page.locator('.sub-video-note')).toBeVisible();

    await context.close();
  });

  test('with full Media desktop contract mock, save next to file option (.mt-pv-nextrow) becomes visible', async ({ webBrowser, stub }) => {
    const context = await webBrowser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
    await context.grantPermissions(['microphone', 'clipboard-read', 'clipboard-write'], { origin: stub.appOrigin });
    await context.route(/(localhost|127\.0\.0\.1|\[::1\]):11434/, route => route.abort());

    // Inject desktop mock with Media module contract
    await context.addInitScript(() => {
      window.makanDesktop = {
        isDesktop: true,
        saveNextTo: () => Promise.resolve({ ok: true }),
        extractAudio: () => Promise.resolve(new Float32Array(0)),
        ffmpeg: () => Promise.resolve({ ok: true, path: 'C:\\ffmpeg\\ffmpeg.exe' })
      };
    });

    const page = await context.newPage();
    const errors = [];
    watchConsole(page, errors);
    stub.clearLog();
    stub.resetModes();
    await page.goto(stub.appUrl);
    await expect(page.locator('#tabs button').first()).toBeVisible();

    await page.locator('#tabs button[data-tab="media"]').click();
    await expect(page.locator('#tab-media')).toBeVisible();

    await page.evaluate(() => {
      const card = document.querySelector('.mt-pv');
      if (window.MediaTranslate?.preview && card && window.MediaTranslate.host) {
        const container = document.createElement('div');
        container.id = 'test-pv-isolated-container';
        const clone = card.cloneNode(true);
        clone.hidden = false;
        container.appendChild(clone);
        document.body.appendChild(container);

        const pv = window.MediaTranslate.preview.create({ card: clone, host: window.MediaTranslate.host });
        pv.update({
          visible: true,
          cues: [{ s: 0, e: 1, o: 'Hello', t: 'سلام' }],
          file: new File(['audio'], 'clip.mp4', { type: 'video/mp4' }),
          kind: 'video',
          version: 1
        });
      }
    });
    await expect(page.locator('#test-pv-isolated-container .mt-pv-nextrow')).toBeVisible();

    await context.close();
  });
});
