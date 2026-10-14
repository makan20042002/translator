'use strict';
const { test, expect, mouseClick } = require('../support/fixtures');
const fs = require('fs');
const path = require('path');

test.describe('Desktop Bugs: OCR Picker, Capture Window Flow & Settings Dismissal (Item 4)', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const exeTranslatorDir = path.resolve(rootDir, '..', 'exe translator');
  const managerJsPath = path.join(rootDir, 'screen-translator', 'manager.js');
  const exeManagerJsPath = path.join(exeTranslatorDir, 'screen-translator', 'manager.js');
  const preloadPath = path.join(rootDir, 'screen-translator', 'preload-main.js');
  const exePreloadPath = path.join(exeTranslatorDir, 'screen-translator', 'preload-main.js');
  const mainJsPath = path.join(exeTranslatorDir, 'main.js');

  test.describe('Bug 10: OCR Picker & Screen Tab Integration', () => {
    test('static: preload-main exposes startScreenTranslator with options and required IPC methods', () => {
      [preloadPath, exePreloadPath].forEach((filePath) => {
        expect(fs.existsSync(filePath)).toBe(true);
        const src = fs.readFileSync(filePath, 'utf8');
        expect(src).toMatch(/startScreenTranslator:\s*\(opts\)\s*=>\s*ipcRenderer\.send\('screen-trans:start',\s*opts\)/);
        expect(src).toContain('getOcrLanguages');
        expect(src).toContain('getOcrEngines');
        expect(src).toContain('getScreenTransConfig');
        expect(src).toContain('saveScreenTransConfig');
      });
    });

    test('static: manager.js accepts opts in screen-trans:start and updates config', () => {
      [managerJsPath, exeManagerJsPath].forEach((filePath) => {
        expect(fs.existsSync(filePath)).toBe(true);
        const src = fs.readFileSync(filePath, 'utf8');
        expect(src).toMatch(/ipcMain\.on\('screen-trans:start',\s*\(event,\s*opts\)\s*=>/);
        expect(src).toMatch(/async\s+startCapture\(opts\s*=\s*\{\}\)/);
        expect(src).toContain('this.config.targetLang = opts.targetLang');
        expect(src).toContain('this.config.ocrLang = opts.ocrLang');
        expect(src).toContain('this.config.engine = opts.engine');
      });
    });

    test('web: Screen tab mode selection cards and reading status sync', async ({ app }) => {
      const { page } = app;

      // Navigate to Screen tab
      const tabScreenBtn = page.locator('#tabs button[data-tab="screen"]');
      if (await tabScreenBtn.count() > 0) {
        await mouseClick(page, tabScreenBtn);
      }

      // Check mode cards exist and setScreenMode is exposed
      const modeCards = page.locator('.screen-mode-card');
      expect(await modeCards.count()).toBeGreaterThanOrEqual(4);

      // Verify clicking freeze card activates it
      const freezeCard = page.locator('.screen-mode-card[data-mode="freeze"]');
      await mouseClick(page, freezeCard);
      await expect(freezeCard).toHaveClass(/on/);
      await expect(freezeCard).toHaveAttribute('aria-checked', 'true');

      // Verify reading status element exists on Screen tab and in Settings
      const screenActiveStatus = page.locator('#screenActiveReadingStatus');
      await expect(screenActiveStatus).toBeVisible();

      // Verify stTgtLang has options populated beyond just the default 2
      const stTgtLang = page.locator('#stTgtLang');
      const optionCount = await stTgtLang.locator('option').count();
      expect(optionCount).toBeGreaterThan(2);
    });
  });

  test.describe('Bug 11: Capture Hides App & Window Restoration Flow', () => {
    test('static: manager.js contains restoreMainWindowIfNeeded and invokes it across all terminal states', () => {
      [managerJsPath, exeManagerJsPath].forEach((filePath) => {
        expect(fs.existsSync(filePath)).toBe(true);
        const src = fs.readFileSync(filePath, 'utf8');

        // Check helper definition
        expect(src).toContain('restoreMainWindowIfNeeded(reason');
        expect(src).toContain('this.mainWindow.show()');
        expect(src).toContain('this.mainWindow.focus()');

        // Check invocation on cancellation / escape
        expect(src).toMatch(/closeCaptureWindow[\s\S]*?restoreMainWindowIfNeeded\('capture cancelled or closed'\)/);

        // Check invocation on invalid selection
        expect(src).toMatch(/!hasValidRect[\s\S]*?restoreMainWindowIfNeeded\('invalid selection rect'\)/);

        // Check invocation on buffer capture error
        expect(src).toMatch(/!imageBuffer[\s\S]*?restoreMainWindowIfNeeded\('capture buffer error'\)/);

        // Check invocation when OCR result is ready
        expect(src).toMatch(/processImageBuffer[\s\S]*?restoreMainWindowIfNeeded\('capture result ready'\)/);

        // Check invocation on translation timeout
        expect(src).toMatch(/restoreMainWindowIfNeeded\('translation timeout'\)/);

        // Check invocation when overlay window closes
        expect(src).toMatch(/closeOverlayWindow[\s\S]*?restoreMainWindowIfNeeded\('overlay closed'\)/);
      });
    });

    test('static: logging is present at every step without logging secrets or text', () => {
      [managerJsPath, exeManagerJsPath].forEach((filePath) => {
        const src = fs.readFileSync(filePath, 'utf8');
        expect(src).toContain('[ScreenTranslator] startCapture invoked');
        expect(src).toContain('[ScreenTranslator] Hiding mainWindow for screen capture');
        expect(src).toContain('[ScreenTranslator] onCaptureComplete, validRect:');
        expect(src).toContain('[ScreenTranslator] Closing overlay window');
        // Ensure raw OCR text or translation output is not printed in debug logs
        expect(src).not.toMatch(/console\.log\([^)]*ocrResult\.text/);
      });
    });

    test('static: window-all-closed in main.js does not quit while mainWindow is alive, and terminates app when all windows close', () => {
      expect(fs.existsSync(mainJsPath)).toBe(true);
      const src = fs.readFileSync(mainJsPath, 'utf8');
      // Verifies window-all-closed checks mainWindow alive before quitting
      expect(src).toMatch(/app\.on\('window-all-closed',[\s\S]*?if\s*\(\s*mainWindow\s*&&\s*!mainWindow\.isDestroyed\(\)\s*\)[\s\S]*?return;/);
      // Verifies cleanupAll and app.quit are called when all windows are closed
      expect(src).toMatch(/app\.on\('window-all-closed',[\s\S]*?cleanupAll\(\);[\s\S]*?app\.quit\(\);/);
      // Verifies mainWindow 'closed' event calls cleanupAll and app.quit
      expect(src).toMatch(/win\.on\('closed',[\s\S]*?mainWindow\s*=\s*null;[\s\S]*?cleanupAll\(\);[\s\S]*?app\.quit\(\);/);
    });
  });

  test.describe('Bug 12: Settings Modal Dismissal', () => {
    test('web: Settings closes via X button, Escape key, tab switch, and closeSettings API', async ({ app }) => {
      const { page } = app;
      const ov = page.locator('#ov');
      const openBtn = page.locator('#openSet');
      const closeBtn = page.locator('#closeSet');

      // 1. Open and close via X button
      await mouseClick(page, openBtn);
      await expect(ov).toHaveClass(/\bon\b/);
      await mouseClick(page, closeBtn);
      await expect(ov).not.toHaveClass(/\bon\b/);

      // 2. Open and close via Escape key
      await mouseClick(page, openBtn);
      await expect(ov).toHaveClass(/\bon\b/);
      await page.keyboard.press('Escape');
      await expect(ov).not.toHaveClass(/\bon\b/);

      // 3. Open and close when switching main tab in sidebar
      await mouseClick(page, openBtn);
      await expect(ov).toHaveClass(/\bon\b/);
      const tabDocBtn = page.locator('#tabs button[data-tab="doc"]');
      if (await tabDocBtn.count() > 0) {
        await mouseClick(page, tabDocBtn);
        await expect(ov).not.toHaveClass(/\bon\b/);
      }

      // 4. Open and close via closeSettings API
      await mouseClick(page, openBtn);
      await expect(ov).toHaveClass(/\bon\b/);
      await page.evaluate(() => {
        if (typeof window.closeSettings === 'function') window.closeSettings();
      });
      await expect(ov).not.toHaveClass(/\bon\b/);
    });
  });
});
