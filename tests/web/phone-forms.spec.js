'use strict';

const { test, expect, mouseClick } = require('../support/fixtures');

test.describe('ITEM 4: Compact header and touch-friendly forms on phones', () => {
  const PHONE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UD1A.230803.041) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36';
  const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  const viewports = [
    { name: '360px', width: 360, height: 740 },
    { name: '412px', width: 412, height: 915 }
  ];

  for (const vp of viewports) {
    for (const lang of ['en', 'fa']) {
      test(`phone layout at ${vp.name} in ${lang}: header <= 56px, no horizontal scroll, controls >= 44px, font >= 16px, primary buttons >= 48px`, async ({ webBrowser, stub }) => {
        const context = await webBrowser.newContext({
          viewport: { width: vp.width, height: vp.height },
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

        // 1. Header takes at most one row of 56px
        const header = page.locator('#topbar');
        await expect(header).toBeVisible();
        const headerBox = await header.boundingBox();
        expect(headerBox.height).toBeLessThanOrEqual(56);

        // Header controls: logo, language switch, settings visible; desktop items hidden
        await expect(page.locator('#phoneBrand')).toBeVisible();
        await expect(page.locator('#uiLang')).toBeVisible();
        await expect(page.locator('#topbarSettingsBtn')).toBeVisible();
        await expect(page.locator('.topbar-lead')).not.toBeVisible();
        await expect(page.locator('#btnScreenTrans')).not.toBeVisible();
        await expect(page.locator('#offBtn')).not.toBeVisible();
        await expect(page.locator('#openSet')).not.toBeVisible();

        // 2. No horizontal scroll on Text tab
        const noScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
        });
        expect(noScroll).toBe(true);

        // 3. Language pair row stays side by side with swap button between them
        const srcPicker = page.locator('#tab-text .trans-lang-grp .unified-lang-picker').first();
        const tgtPicker = page.locator('#tab-text .trans-lang-grp .unified-lang-picker').last();
        const swapBtn = page.locator('#swap');

        await expect(srcPicker).toBeVisible();
        await expect(tgtPicker).toBeVisible();
        await expect(swapBtn).toBeVisible();

        const srcBox = await srcPicker.boundingBox();
        const tgtBox = await tgtPicker.boundingBox();
        const swapBox = await swapBtn.boundingBox();

        // Swap is between source and target vertically aligned
        expect(Math.abs(srcBox.y - tgtBox.y)).toBeLessThan(15);
        expect(Math.abs(srcBox.y - swapBox.y)).toBeLessThan(15);
        expect(swapBox.width).toBeGreaterThanOrEqual(44);
        expect(swapBox.height).toBeGreaterThanOrEqual(44);

        // Language display text is not clipped/overflowed
        const langClipped = await page.evaluate(() => {
          const inners = Array.from(document.querySelectorAll('#tab-text .unified-lang-box .lang-display-inner'));
          return inners.some(el => el.scrollWidth > el.clientWidth + 2);
        });
        expect(langClipped).toBe(false);

        // 4. Selects (Mode, Tone) go in a 2-column grid
        const modeGrp = page.locator('#tModeGrp');
        const toneGrp = page.locator('#tToneGrp');
        await expect(modeGrp).toBeVisible();
        await expect(toneGrp).toBeVisible();

        const modeBox = await modeGrp.boundingBox();
        const toneBox = await toneGrp.boundingBox();
        expect(Math.abs(modeBox.y - toneBox.y)).toBeLessThan(10); // same horizontal row
        expect(modeBox.width).toBeGreaterThanOrEqual(130);
        expect(toneBox.width).toBeGreaterThanOrEqual(130);

        // 5. Subject field full width, at least 44px high, font-size 16px, placeholder not clipped
        const subj = page.locator('#tSubject');
        await expect(subj).toBeVisible();
        const subjBox = await subj.boundingBox();
        expect(subjBox.height).toBeGreaterThanOrEqual(44);
        expect(subjBox.width).toBeGreaterThanOrEqual(vp.width - 50);

        const subjFontSize = await subj.evaluate(el => parseFloat(window.getComputedStyle(el).fontSize));
        expect(subjFontSize).toBeGreaterThanOrEqual(16);

        // 6. Source and result cards use full width
        const srcCard = page.locator('.trans-card-source');
        const tgtCard = page.locator('.trans-card-target');
        const srcCardBox = await srcCard.boundingBox();
        const tgtCardBox = await tgtCard.boundingBox();
        expect(srcCardBox.width).toBeGreaterThanOrEqual(vp.width - 40);
        expect(tgtCardBox.width).toBeGreaterThanOrEqual(vp.width - 40);

        // 7. Primary buttons (Translate, Copy, Speak) in sticky action bar with height >= 48px
        const stickyBar = page.locator('#phoneTextStickyBar');
        await expect(stickyBar).toBeVisible();

        const tGo = page.locator('#tGo');
        const tCopy = page.locator('#tCopy');
        const tSpeak = page.locator('#tSpeak');

        await expect(tGo).toBeVisible();
        await expect(tCopy).toBeVisible();
        await expect(tSpeak).toBeVisible();

        const tGoBox = await tGo.boundingBox();
        const tCopyBox = await tCopy.boundingBox();
        const tSpeakBox = await tSpeak.boundingBox();

        expect(tGoBox.height).toBeGreaterThanOrEqual(48);
        expect(tCopyBox.height).toBeGreaterThanOrEqual(48);
        expect(tSpeakBox.height).toBeGreaterThanOrEqual(48);

        // Text fields and selects have font-size >= 16px to prevent iOS zoom
        const inputsValid = await page.evaluate(() => {
          const fields = Array.from(document.querySelectorAll('#tab-text input[type="text"], #tab-text select, #tab-text textarea'));
          return fields.every(el => {
            const fs = parseFloat(window.getComputedStyle(el).fontSize);
            return fs >= 15.5;
          });
        });
        expect(inputsValid).toBe(true);

        // Check horizontal scroll across all main tabs reachable on phone
        const tabsToCheck = ['voice', 'doc', 'media'];
        for (const tabName of tabsToCheck) {
          await mouseClick(page, page.locator(`#phoneBottomNav button[data-tab="${tabName}"]`));
          const hasScroll = await page.evaluate(() => {
            return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
          });
          expect(hasScroll, `Tab ${tabName} should have no horizontal scroll at ${vp.name}`).toBe(false);
        }
      });
    }
  }

  test('desktop user agent at 360px viewport: desktop header and layout remain intact, phone sticky bar hidden', async ({ webBrowser, stub }) => {
    const context = await webBrowser.newContext({
      viewport: { width: 360, height: 740 },
      userAgent: DESKTOP_UA,
      isMobile: false
    });
    const page = await context.newPage();
    await page.goto(stub.appUrl);

    // Should NOT have is-phone class
    await expect(page.locator('html')).not.toHaveClass(/is-phone/);

    // Desktop elements remain in header
    await expect(page.locator('#phoneBrand')).not.toBeVisible();
    await expect(page.locator('#phoneTextStickyBar')).not.toBeVisible();
    await expect(page.locator('#phoneBottomNav')).not.toBeVisible();

    // Primary buttons stay in their desktop containers
    const tGoParent = await page.evaluate(() => {
      return document.getElementById('tGo')?.parentElement?.className || '';
    });
    expect(tGoParent).toContain('trans-card-actions');
  });
});
