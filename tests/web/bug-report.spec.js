'use strict';

/**
 * tests/web/bug-report.spec.js
 * Comprehensive tests for web app bug reporting dialog and diagnostics (ITEM 1).
 */

const { test, expect, mouseClick } = require('../support/fixtures');

test.describe('Web App: Bug Report Dialog & Diagnostics (ITEM 1)', () => {

  test('the button opens the dialog from About and from Help with focus return and Esc close', async ({ app }) => {
    const { page } = app;

    // 1. Open from About window
    await mouseClick(page, page.locator('#creditsBtn'));
    await expect(page.locator('#creditsBox')).toBeVisible();

    const aboutBugBtn = page.locator('#aboutBugReportBtn');
    await expect(aboutBugBtn).toBeVisible();
    await mouseClick(page, aboutBugBtn);

    const modal = page.locator('#bugReportModal');
    await expect(modal).toBeVisible();

    // Verify focus is inside modal
    const focusedInModal = await page.evaluate(() => {
      const modalEl = document.getElementById('bugReportModal');
      return modalEl && modalEl.contains(document.activeElement);
    });
    expect(focusedInModal).toBe(true);

    // Close via close button and verify focus returns to opener
    await mouseClick(page, page.locator('#bugReportClose'));
    await expect(modal).toBeHidden();
    const activeAfterClose = await page.evaluate(() => document.activeElement ? document.activeElement.id : null);
    expect(activeAfterClose).toBe('aboutBugReportBtn');

    // 2. Open from Help section inside About/Help
    const helpBugBtn = page.locator('#helpBugReportBtn');
    await expect(helpBugBtn).toBeVisible();
    await mouseClick(page, helpBugBtn);
    await expect(modal).toBeVisible();

    // Close via Escape key and verify focus returns to opener
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
    const activeAfterEsc = await page.evaluate(() => document.activeElement ? document.activeElement.id : null);
    expect(activeAfterEsc).toBe('helpBugReportBtn');

    // Close credits
    await mouseClick(page, page.locator('#creditsClose'));
    await expect(page.locator('#creditsBox')).toBeHidden();
  });

  test('focus trap keeps keyboard navigation inside the bug report modal', async ({ app }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#creditsBtn'));
    await mouseClick(page, page.locator('#aboutBugReportBtn'));
    const modal = page.locator('#bugReportModal');
    await expect(modal).toBeVisible();

    // Focus the first interactive field
    await page.locator('#bugWhatHappened').focus();

    // Tab multiple times and verify activeElement is ALWAYS inside #bugReportModal
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => {
        const m = document.getElementById('bugReportModal');
        return m && m.contains(document.activeElement);
      });
      expect(inside).toBe(true);
    }

    // Shift+Tab backwards
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Shift+Tab');
      const inside = await page.evaluate(() => {
        const m = document.getElementById('bugReportModal');
        return m && m.contains(document.activeElement);
      });
      expect(inside).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
  });

  test('diagnostics preview contains version, language, tab, and enabled engine names', async ({ app }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#creditsBtn'));
    await mouseClick(page, page.locator('#aboutBugReportBtn'));

    const preview = page.locator('#bugDiagPreview');
    await expect(preview).toBeVisible();

    const previewText = await preview.textContent();
    expect(previewText).toContain('App Version: 1.0.0');
    expect(previewText).toContain('Interface Language: en');
    expect(previewText).toContain('Active Tab: text');
    expect(previewText).toContain('Enabled Engines:');
    expect(previewText).toContain('Google Translate');

    await page.keyboard.press('Escape');
  });

  test('seeded fake API keys, custom server URLs, and source text never appear in preview, mailto link, or clipboard', async ({ app }) => {
    const { page, context, stub } = app;
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: stub.appOrigin });

    const FAKE_KEY = 'AIzaSyFAKEKEY000000000000000000000000000';
    const CUSTOM_URL = 'http://192.168.1.100:8000/v1';
    const USER_SECRET_TEXT = 'TOP SECRET CONFIDENTIAL USER TEXT 12345';

    // Seed configuration with fake key and custom server URL, and fill Text tab
    await page.evaluate(({ key, url, text }) => {
      if (typeof cfg !== 'undefined') {
        if (!cfg.eng) cfg.eng = {};
        if (!cfg.eng.gemini) cfg.eng.gemini = { on: true };
        cfg.eng.gemini.key = key;
        if (!cfg.eng.custom) cfg.eng.custom = { on: true };
        cfg.eng.custom.base = url;
      }
      const srcInput = document.getElementById('srcText');
      if (srcInput) srcInput.value = text;
    }, { key: FAKE_KEY, url: CUSTOM_URL, text: USER_SECRET_TEXT });

    // Open bug report modal
    await mouseClick(page, page.locator('#creditsBtn'));
    await mouseClick(page, page.locator('#aboutBugReportBtn'));

    const preview = page.locator('#bugDiagPreview');
    const previewText = await preview.textContent();

    // Check preview
    expect(previewText).not.toContain(FAKE_KEY);
    expect(previewText).not.toContain('192.168.1.100');
    expect(previewText).not.toContain(USER_SECRET_TEXT);

    // Check mailto link href
    const mailtoHref = await page.locator('#bugSendEmail').getAttribute('href');
    expect(mailtoHref).toBeTruthy();
    expect(mailtoHref).not.toContain(FAKE_KEY);
    expect(mailtoHref).not.toContain('192.168.1.100');
    expect(mailtoHref).not.toContain(USER_SECRET_TEXT);

    // Check clipboard
    await mouseClick(page, page.locator('#bugCopyReport'));
    const copiedText = await page.evaluate(() => navigator.clipboard.readText());
    expect(copiedText).not.toContain(FAKE_KEY);
    expect(copiedText).not.toContain('192.168.1.100');
    expect(copiedText).not.toContain(USER_SECRET_TEXT);

    await page.keyboard.press('Escape');
  });

  test('error messages containing fake Bearer tokens and API keys are redacted in diagnostics', async ({ app }) => {
    const { page } = app;

    // Simulate an uncaught error containing a Bearer token, query string, and email
    await page.evaluate(() => {
      const fakeMsg = 'AuthFailure: Bearer secret-token-xyz123 rejected with AIzaSyFAKEKEY000000000000000000000000000 at http://api.internal/v1?token=querysecret&user=leak@example.com';
      window.dispatchEvent(new ErrorEvent('error', { message: fakeMsg }));
    });

    await mouseClick(page, page.locator('#creditsBtn'));
    await mouseClick(page, page.locator('#aboutBugReportBtn'));

    const previewText = await page.locator('#bugDiagPreview').textContent();
    expect(previewText).toContain('Bearer [REDACTED_TOKEN]');
    expect(previewText).toContain('[REDACTED_KEY]');
    expect(previewText).toContain('[REDACTED_QUERY]');
    expect(previewText).toContain('[REDACTED_EMAIL]');

    // Ensure raw secrets are NOT present
    expect(previewText).not.toContain('secret-token-xyz123');
    expect(previewText).not.toContain('AIzaSyFAKEKEY000000000000000000000000000');
    expect(previewText).not.toContain('querysecret');
    expect(previewText).not.toContain('leak@example.com');

    await page.keyboard.press('Escape');
  });

  test('the mailto link starts with mailto:makan20042002@gmail.com and body stays under 1800 characters even with 5 long errors', async ({ app }) => {
    const { page } = app;

    // Dispatch 5 long error messages (each > 500 characters)
    await page.evaluate(() => {
      for (let i = 1; i <= 5; i++) {
        const longMessage = `Error ${i}: ` + 'X'.repeat(600);
        window.dispatchEvent(new ErrorEvent('error', { message: longMessage }));
      }
    });

    await mouseClick(page, page.locator('#creditsBtn'));
    await mouseClick(page, page.locator('#aboutBugReportBtn'));

    const mailtoLink = page.locator('#bugSendEmail');
    const href = await mailtoLink.getAttribute('href');
    expect(href).toBeTruthy();
    expect(href.startsWith('mailto:makan20042002@gmail.com')).toBe(true);

    // Decode URL and inspect body length
    const parsed = new URL(href);
    const bodyParam = parsed.searchParams.get('body');
    expect(bodyParam).toBeTruthy();
    expect(bodyParam.length).toBeLessThan(1800);
    expect(bodyParam).toContain('[Diagnostics truncated to fit email client limit]');

    // Preview also reflects the truncation notice
    const previewText = await page.locator('#bugDiagPreview').textContent();
    expect(previewText).toContain('[Diagnostics truncated to fit email client limit]');

    await page.keyboard.press('Escape');
  });

  test('Copy report button puts the same report text on clipboard with visible confirmation', async ({ app }) => {
    const { page, context, stub } = app;
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: stub.appOrigin });

    await mouseClick(page, page.locator('#creditsBtn'));
    await mouseClick(page, page.locator('#aboutBugReportBtn'));

    // Fill optional fields
    await page.locator('#bugWhatHappened').fill('Translation stalled on paragraph 3');
    await page.locator('#bugWhatExpected').fill('Should complete without network timeout');

    // Click Copy report
    const copyBtn = page.locator('#bugCopyReport');
    await mouseClick(page, copyBtn);

    // Check visible confirmation
    const statusEl = page.locator('#bugCopyStatus');
    await expect(statusEl).toBeVisible();
    await expect(statusEl).toHaveText(/Copied to clipboard/i);

    // Read clipboard
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('MAKAN Translate Bug Report v1.0.0');
    expect(clipboardText).toContain('Translation stalled on paragraph 3');
    expect(clipboardText).toContain('Should complete without network timeout');
    expect(clipboardText).toContain('App Version: 1.0.0');

    // Compare with mailto body (when decoded)
    const href = await page.locator('#bugSendEmail').getAttribute('href');
    const parsed = new URL(href);
    const mailBody = parsed.searchParams.get('body');
    expect(clipboardText).toBe(mailBody);

    await page.keyboard.press('Escape');
  });

  test('English and Persian localization strings are displayed without horizontal overflow in RTL at 360px and 1280px', async ({ app }) => {
    const { page } = app;

    // Switch to Persian (FA)
    await mouseClick(page, page.locator('#uiLang'));
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    await mouseClick(page, page.locator('#creditsBtn'));
    const aboutBugBtn = page.locator('#aboutBugReportBtn');
    await expect(aboutBugBtn).toHaveText('گزارش باگ');
    const helpBugBtn = page.locator('#helpBugReportBtn');
    await expect(helpBugBtn).toHaveText('گزارش باگ');

    await mouseClick(page, aboutBugBtn);
    const modal = page.locator('#bugReportModal');
    await expect(modal).toBeVisible();

    const titleFa = page.locator('#bugReportTitle');
    await expect(titleFa).toHaveText('گزارش مشکل');

    // 1. Verify layout at 360px width
    await page.setViewportSize({ width: 360, height: 640 });
    await page.waitForTimeout(100);
    const overflow360 = await page.evaluate(() => {
      const modalEl = document.getElementById('bugReportModal');
      if (!modalEl) return true;
      return modalEl.scrollWidth > modalEl.clientWidth + 2;
    });
    expect(overflow360).toBe(false);

    // 2. Verify layout at 1280px width
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(100);
    const overflow1280 = await page.evaluate(() => {
      const modalEl = document.getElementById('bugReportModal');
      if (!modalEl) return true;
      return modalEl.scrollWidth > modalEl.clientWidth + 2;
    });
    expect(overflow1280).toBe(false);

    await page.keyboard.press('Escape');
    await mouseClick(page, page.locator('#creditsClose'));
  });

});
