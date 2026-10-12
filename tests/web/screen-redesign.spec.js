'use strict';
/**
 * Tests for Stage 1: Screen Tab Redesign (Screen 5)
 * Checks real behavior, preserved IDs, mode switching, overlay toggling,
 * conditional privacy claims, copy/open actions, and responsive layout.
 */
const { test, expect, mouseClick } = require('../support/fixtures');

test.describe('Web app: Screen tab redesign (Stage 1)', () => {
  test('header exists, preserved IDs present, and no country flags anywhere', async ({ app }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="screen"]'));

    // Check tab section
    const screenTab = page.locator('#tab-screen');
    await expect(screenTab).toBeVisible();

    // Check header
    await expect(page.locator('.screen-page-title')).toHaveText(/Screen|صفحه نمایش/);
    await expect(page.locator('.screen-page-sub')).toBeVisible();

    // Preserved critical IDs
    await expect(page.locator('#tabScreenLaunchBtn')).toBeVisible();
    await expect(page.locator('#tabScreenOpenOcrBtn')).toBeVisible();

    // Verify absence of country flag images or emojis in language controls
    const hasFlags = await page.locator('.screen-ctrl-group').evaluate(el => {
      const text = el.textContent || '';
      const flagEmoji = /[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/.test(text);
      const flagImg = !!el.querySelector('img, svg.flag');
      return flagEmoji || flagImg;
    });
    expect(hasFlags).toBe(false);
  });

  test('language pair swap updates values and mode switcher toggles state', async ({ app }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="screen"]'));

    const src = page.locator('#screenSrcLang');
    const tgt = page.locator('#screenTgtLang');
    await src.selectOption('en');
    await tgt.selectOption('fa');

    // Click swap
    await mouseClick(page, page.locator('#screenSwapBtn'));
    await expect(src).toHaveValue('fa');
    await expect(tgt).toHaveValue('en');

    // Test capture mode switching
    const freezeCard = page.locator('.screen-mode-card[data-mode="freeze"]');
    const regionCard = page.locator('.screen-mode-card[data-mode="region"]');

    await mouseClick(page, freezeCard);
    await expect(freezeCard).toHaveClass(/\bon\b/);
    await expect(freezeCard).toHaveAttribute('aria-checked', 'true');
    await expect(regionCard).not.toHaveClass(/\bon\b/);
    await expect(regionCard).toHaveAttribute('aria-checked', 'false');
  });

  test('privacy claim is strictly conditional on engine selection', async ({ app }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="screen"]'));

    const engSelect = page.locator('#screenTransEngine');
    const privText = page.locator('#screenPrivacyText');

    // Select offline engine -> must claim processing stays on PC
    await engSelect.selectOption('offline');
    await expect(privText).toHaveText(/Processing stays on this PC|پردازش در همین رایانه انجام می‌شود/);

    // Select online engine (Google) -> must NOT claim staying on PC
    await engSelect.selectOption('google');
    const text = await privText.textContent();
    expect(text).not.toContain('Processing stays on this PC');
    expect(text).toMatch(/Online engine|موتور آنلاین/);
  });

  test('overlay toggle hides and shows result overlay, and Open in App transfers text', async ({ app }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="screen"]'));

    const overlay = page.locator('#screenResultOverlay');
    const toggle = page.locator('#screenOverlayToggle');

    // Initially visible
    await expect(overlay).toBeVisible();

    // Toggle off by clicking the visible switch label/slider (as in tmToggle tests)
    const switchLbl = page.locator('.switch-lbl[for="screenOverlayToggle"]');
    await mouseClick(page, switchLbl);
    await expect(toggle).not.toBeChecked();
    await expect(overlay).toBeHidden();

    // Toggle on
    await mouseClick(page, switchLbl);
    await expect(toggle).toBeChecked();
    await expect(overlay).toBeVisible();

    // Click "Open in App" button from overlay
    const openBtn = page.locator('#screenOvOpenInAppBtn');
    await mouseClick(page, openBtn);

    // Verify switched to text tab with text transferred to #tIn
    await expect(page.locator('#tab-text')).toHaveClass(/\bon\b/);
    const tInVal = await page.locator('#tIn').inputValue();
    expect(tInVal.length).toBeGreaterThan(0);
  });

  test('recent captures list can be cleared', async ({ app }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="screen"]'));

    const items = page.locator('#screenCapturesList .screen-capture-item');
    await expect(items.first()).toBeVisible();

    // Clear history
    await mouseClick(page, page.locator('#screenClearHistBtn'));
    await expect(page.locator('.screen-empty-captures')).toBeVisible();
  });

  test('no horizontal scroll at 360px, 700px, 1100px, 1440px viewports', async ({ app }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="screen"]'));

    const widths = [360, 700, 1100, 1440];
    for (const w of widths) {
      await page.setViewportSize({ width: w, height: 800 });
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth, `No horizontal scroll at ${w}px`).toBeLessThanOrEqual(clientWidth + 1);
    }
  });
});
