'use strict';

const { test, expect, mouseClick } = require('../support/fixtures');

test.describe('ITEM 5: Voice and Media screens on phones', () => {
  const PHONE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UD1A.230803.041) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36';
  const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  for (const lang of ['en', 'fa']) {
    test(`voice and media screens on phone at 360px in ${lang}: options collapse, large talk button, 1-line notice with fix link, stacked media controls, wrapping export buttons`, async ({ webBrowser, stub }) => {
      const context = await webBrowser.newContext({
        viewport: { width: 360, height: 740 },
        userAgent: PHONE_UA,
        isMobile: true
      });
      const page = await context.newPage();
      await page.goto(stub.appUrl);

      if (lang === 'fa') {
        await page.evaluate(() => {
          const uiBtn = document.getElementById('uiLang');
          if (uiBtn && !document.documentElement.classList.contains('fa')) {
            uiBtn.click();
          }
        });
        await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      }

      // --- VOICE TAB ---
      await mouseClick(page, page.locator('#phoneBottomNav button[data-tab="voice"]'));
      await expect(page.locator('#tab-voice')).toHaveClass(/on/);

      // 1. Settings rows collapsed behind "Options" button
      const optionsBtn = page.locator('#vPhoneOptionsBtn');
      await expect(optionsBtn).toBeVisible();
      const optionsBox = await optionsBtn.boundingBox();
      expect(optionsBox.height).toBeGreaterThanOrEqual(44);
      expect(optionsBox.width).toBeGreaterThanOrEqual(44);

      // Microphones, voices, save, settings hidden initially
      await expect(page.locator('#vMicSttPickerWrap')).not.toBeVisible();
      await expect(page.locator('#vConvVoicePickerWrap')).not.toBeVisible();
      await expect(page.locator('#vSaveConv')).not.toBeVisible();
      await expect(page.locator('#vToggleSettings')).not.toBeVisible();

      // Click Options button to expand
      await mouseClick(page, optionsBtn);
      await expect(page.locator('#vControlBar')).toHaveClass(/options-open/);
      await expect(page.locator('#vMicSttPickerWrap')).toBeVisible();
      await expect(page.locator('#vConvVoicePickerWrap')).toBeVisible();
      await expect(page.locator('#vSaveConv')).toBeVisible();
      await expect(page.locator('#vToggleSettings')).toBeVisible();

      // Click Options button to collapse back
      await mouseClick(page, optionsBtn);
      await expect(page.locator('#vControlBar')).not.toHaveClass(/options-open/);
      await expect(page.locator('#vMicSttPickerWrap')).not.toBeVisible();

      // 2. Large Talk button at the bottom
      const pttBtn = page.locator('#vPttBtn');
      await expect(pttBtn).toBeVisible();
      const pttBox = await pttBtn.boundingBox();
      expect(pttBox.width).toBeGreaterThanOrEqual(48);
      expect(pttBox.height).toBeGreaterThanOrEqual(48);

      // 3. Status notice as a single short line with its fix link
      // Set to not ready to inspect the "Not ready" notice
      await page.evaluate(() => {
        window.__micBlocked = true;
        if (typeof updateVoiceReadiness === 'function') updateVoiceReadiness();
      });

      const readyChip = page.locator('#vVoiceReadyChip');
      await expect(readyChip).toBeVisible();
      const fixLink = page.locator('#vVoiceFixLink');
      await expect(fixLink).toBeVisible();

      // Notice is a single line (white-space nowrap, height <= 44px)
      const chipBox = await readyChip.boundingBox();
      expect(chipBox.height).toBeLessThanOrEqual(44);

      const isSingleLine = await readyChip.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.whiteSpace === 'nowrap' && style.textOverflow === 'ellipsis';
      });
      expect(isSingleLine).toBe(true);

      // Reset mock state
      await page.evaluate(() => {
        delete window.__micBlocked;
        if (typeof updateVoiceReadiness === 'function') updateVoiceReadiness();
      });

      // No horizontal scroll on voice tab
      const voiceNoScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
      });
      expect(voiceNoScroll).toBe(true);

      // --- MEDIA TAB ---
      await mouseClick(page, page.locator('#phoneBottomNav button[data-tab="media"]'));
      await expect(page.locator('#tab-media')).toHaveClass(/on/);

      // Wait for media tab to mount
      const dropZone = page.locator('.mt-drop');
      await expect(dropZone).toBeVisible();
      const dropBox = await dropZone.boundingBox();
      expect(dropBox.width).toBeGreaterThanOrEqual(300);

      // Verify listWhisperModels on phone contains ONLY allowed Whisper models
      const modelsListed = await page.evaluate(() => {
        if (window.MediaTranslate?.host?.listWhisperModels) {
          return window.MediaTranslate.host.listWhisperModels().map(m => m.key);
        }
        return [];
      });
      expect(modelsListed).toEqual(['tiny', 'base', 'small']);

      // Check media action button sizes and stacking
      const actionBtns = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('.mt-tab .mt-btn'));
        return btns.map(b => ({
          height: b.offsetHeight,
          minHeight: parseFloat(window.getComputedStyle(b).minHeight)
        }));
      });
      for (const btn of actionBtns) {
        expect(btn.minHeight).toBeGreaterThanOrEqual(48);
      }

      // Check export buttons wrap in CSS
      const exportWrapStyle = await page.evaluate(() => {
        const exportActions = document.querySelector('.mt-pv-export .mt-actions');
        if (!exportActions) return null;
        const style = window.getComputedStyle(exportActions);
        return {
          flexWrap: style.flexWrap,
          display: style.display
        };
      });
      if (exportWrapStyle) {
        expect(exportWrapStyle.flexWrap).toBe('wrap');
      }

      // No horizontal overflow on media tab
      const mediaNoScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
      });
      expect(mediaNoScroll).toBe(true);
    });
  }

  test('desktop user agent at 360px: options button is hidden, voice settings rows visible by default', async ({ webBrowser, stub }) => {
    const context = await webBrowser.newContext({
      viewport: { width: 360, height: 740 },
      userAgent: DESKTOP_UA,
      isMobile: false
    });
    const page = await context.newPage();
    await page.goto(stub.appUrl);

    await page.evaluate(() => {
      document.querySelector('#tabs button[data-tab="voice"]')?.click();
    });

    // Options button is hidden on desktop
    await expect(page.locator('#vPhoneOptionsBtn')).not.toBeVisible();

    // Settings rows remain visible
    await expect(page.locator('#vMicSttPickerWrap')).toBeVisible();
    await expect(page.locator('#vConvVoicePickerWrap')).toBeVisible();
  });
});
