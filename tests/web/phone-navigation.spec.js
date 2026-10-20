'use strict';

const { test, expect, mouseClick } = require('../support/fixtures');

test.describe('ITEM 3: Phone navigation', () => {
  const PHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UD1A.230803.041) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36';
  const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  test('phone UA: bottom nav replaces sidebar, every tab is reachable from bottom bar or More sheet, targets >= 48px', async ({ webBrowser, stub }) => {
    const context = await webBrowser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: PHONE_UA,
      isMobile: true
    });
    const page = await context.newPage();
    await page.goto(stub.appUrl);

    // Verify phone class applied and sidebar hidden
    await expect(page.locator('html')).toHaveClass(/is-phone/);
    await expect(page.locator('.sidebar')).not.toBeVisible();
    await expect(page.locator('#phoneBottomNav')).toBeVisible();

    // Verify 5 main tabs in bottom nav
    const bottomNav = page.locator('#phoneBottomNav');
    const textNavBtn = bottomNav.locator('button[data-tab="text"]');
    const voiceNavBtn = bottomNav.locator('button[data-tab="voice"]');
    const docNavBtn = bottomNav.locator('button[data-tab="doc"]');
    const mediaNavBtn = bottomNav.locator('button[data-tab="media"]');
    const moreNavBtn = page.locator('#phoneNavMoreBtn');

    await expect(textNavBtn).toBeVisible();
    await expect(voiceNavBtn).toBeVisible();
    await expect(docNavBtn).toBeVisible();
    await expect(mediaNavBtn).toBeVisible();
    await expect(moreNavBtn).toBeVisible();

    // Icons and short labels present
    await expect(textNavBtn.locator('.phone-nav-icon')).toBeVisible();
    await expect(textNavBtn.locator('.phone-nav-label')).toHaveText('Text');
    await expect(voiceNavBtn.locator('.phone-nav-icon')).toBeVisible();
    await expect(voiceNavBtn.locator('.phone-nav-label')).toHaveText('Voice');
    await expect(docNavBtn.locator('.phone-nav-icon')).toBeVisible();
    await expect(docNavBtn.locator('.phone-nav-label')).toHaveText('Document');
    await expect(mediaNavBtn.locator('.phone-nav-icon')).toBeVisible();
    await expect(mediaNavBtn.locator('.phone-nav-label')).toHaveText('Media');
    await expect(moreNavBtn.locator('.phone-nav-icon')).toBeVisible();
    await expect(moreNavBtn.locator('.phone-nav-label')).toHaveText('More');

    // Initial active tab is text
    await expect(textNavBtn).toHaveClass(/on/);
    await expect(page.locator('#tab-text')).toHaveClass(/on/);

    // Main content has bottom padding so nothing hides under the bottom nav
    const bottomPadding = await page.evaluate(() => {
      const el = document.getElementById('mainViewport') || document.querySelector('.main-viewport');
      return parseFloat(window.getComputedStyle(el).paddingBottom);
    });
    expect(bottomPadding).toBeGreaterThanOrEqual(64);

    // 1. Switch to Voice
    await mouseClick(page, voiceNavBtn);
    await expect(page.locator('#tab-voice')).toHaveClass(/on/);
    await expect(voiceNavBtn).toHaveClass(/on/);
    await expect(textNavBtn).not.toHaveClass(/on/);

    // 2. Switch to Document
    await mouseClick(page, docNavBtn);
    await expect(page.locator('#tab-doc')).toHaveClass(/on/);
    await expect(docNavBtn).toHaveClass(/on/);

    // 3. Switch to Media
    await mouseClick(page, mediaNavBtn);
    await expect(page.locator('#tab-media')).toHaveClass(/on/);
    await expect(mediaNavBtn).toHaveClass(/on/);

    // 4. Switch back to Text
    await mouseClick(page, textNavBtn);
    await expect(page.locator('#tab-text')).toHaveClass(/on/);
    await expect(textNavBtn).toHaveClass(/on/);

    // Open More sheet
    const moreSheet = page.locator('#phoneMoreSheet');
    await expect(moreSheet).not.toBeVisible();
    await mouseClick(page, moreNavBtn);
    await expect(moreSheet).toBeVisible();

    // Verify all sheet items exist and are at least 48px high
    const sheetTabs = [
      { tab: 'sub', id: '#tab-sub' },
      { tab: 'dict', id: '#tab-dict' },
      { tab: 'idiom', id: '#tab-idiom' },
      { tab: 'cmp', id: '#tab-cmp' },
      { tab: 'gls', id: '#tab-gls' },
      { tab: 'hist', id: '#tab-hist' },
      { tab: 'models', id: '#tab-models' }
    ];

    for (const item of sheetTabs) {
      const btn = moreSheet.locator(`.phone-sheet-item[data-tab="${item.tab}"]`);
      await expect(btn).toBeVisible();
      const box = await btn.boundingBox();
      expect(box.height, `Item ${item.tab} height should be at least 48px`).toBeGreaterThanOrEqual(48);
    }

    const settingsItem = moreSheet.locator('#phoneMoreSettingsBtn');
    await expect(settingsItem).toBeVisible();
    const settingsBox = await settingsItem.boundingBox();
    expect(settingsBox.height).toBeGreaterThanOrEqual(48);

    // Verify navigating to each tab from More sheet
    for (const item of sheetTabs) {
      // If sheet closed, open it
      if (!(await moreSheet.isVisible())) {
        await mouseClick(page, moreNavBtn);
        await expect(moreSheet).toBeVisible();
      }
      const btn = moreSheet.locator(`.phone-sheet-item[data-tab="${item.tab}"]`);
      await mouseClick(page, btn);
      // Sheet closes and target tab is active
      await expect(moreSheet).not.toBeVisible();
      await expect(page.locator(item.id)).toHaveClass(/on/);
      // More button is marked active because active tab is in More sheet
      await expect(moreNavBtn).toHaveClass(/on/);
    }

    // Settings item in sheet opens settings overlay
    await mouseClick(page, moreNavBtn);
    await expect(moreSheet).toBeVisible();
    await mouseClick(page, settingsItem);
    await expect(moreSheet).not.toBeVisible();
    await expect(page.locator('#setOv')).toHaveClass(/on/);

    // Close settings overlay
    await page.keyboard.press('Escape');

    await context.close();
  });

  test('phone UA in Persian: labels update properly', async ({ webBrowser, stub }) => {
    const context = await webBrowser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: ANDROID_UA,
      isMobile: true
    });
    const page = await context.newPage();
    await page.goto(stub.appUrl);

    // Switch to FA
    await mouseClick(page, page.locator('#uiLang'));
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    const bottomNav = page.locator('#phoneBottomNav');
    await expect(bottomNav.locator('button[data-tab="text"] .phone-nav-label')).toHaveText('متن');
    await expect(bottomNav.locator('button[data-tab="voice"] .phone-nav-label')).toHaveText('صدا');
    await expect(bottomNav.locator('button[data-tab="doc"] .phone-nav-label')).toHaveText('سند');
    await expect(bottomNav.locator('button[data-tab="media"] .phone-nav-label')).toHaveText('رسانه');
    await expect(page.locator('#phoneNavMoreBtn .phone-nav-label')).toHaveText('بیشتر');

    // Open More sheet and check Persian labels
    await mouseClick(page, page.locator('#phoneNavMoreBtn'));
    const moreSheet = page.locator('#phoneMoreSheet');
    await expect(moreSheet).toBeVisible();
    await expect(moreSheet.locator('.phone-sheet-item[data-tab="dict"] .phone-sheet-item-label')).toHaveText('فرهنگ لغت');
    await expect(moreSheet.locator('#phoneMoreSettingsBtn .phone-sheet-item-label')).toHaveText('تنظیمات');

    await context.close();
  });

  test('desktop UA at 360px: bottom nav and More sheet are not visible; desktop sidebar remains', async ({ webBrowser, stub }) => {
    const context = await webBrowser.newContext({
      viewport: { width: 360, height: 740 },
      userAgent: DESKTOP_UA,
      isMobile: false
    });
    const page = await context.newPage();
    await page.goto(stub.appUrl);

    await expect(page.locator('html')).not.toHaveClass(/is-phone/);
    await expect(page.locator('#phoneBottomNav')).not.toBeVisible();
    await expect(page.locator('#phoneMoreSheet')).not.toBeVisible();
    await expect(page.locator('.sidebar')).toBeAttached();

    await context.close();
  });
});
