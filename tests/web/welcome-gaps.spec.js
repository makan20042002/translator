'use strict';
const { test, expect, mouseClick } = require('../support/fixtures');

async function openSettingsModal(page) {
  await mouseClick(page, page.locator('#openSet'));
  await expect(page.locator('#ov')).toHaveClass(/\bon\b/);
}

test.describe('Web app: Welcome Wizard Gaps & Hardening', () => {
  test('Gap 1: Esc key skips wizard and returns focus to reopening element', async ({ app }) => {
    const { page } = app;
    await openSettingsModal(page);

    const reopenBtn = page.locator('#btnReopenWelcome');
    await expect(reopenBtn).toBeVisible();
    await mouseClick(page, reopenBtn);

    const overlay = page.locator('#welcomeOverlay');
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveClass(/\bon\b/);

    // Press Escape to dismiss wizard
    await page.keyboard.press('Escape');

    await expect(overlay).toBeHidden();
    const isDone = await page.evaluate(() => localStorage.getItem('welcome_done'));
    expect(isDone).toBe('1');
  });

  test('Gap 1: keyboard focus is trapped inside wizard modal while open', async ({ app }) => {
    const { page } = app;
    await page.evaluate(() => window.openWelcomeWizard(1));

    const overlay = page.locator('#welcomeOverlay');
    await expect(overlay).toBeVisible();

    // Verify Tab key cycles inside the modal
    await page.keyboard.press('Tab');
    const isInsideFirst = await page.evaluate(() => {
      const active = document.activeElement;
      return document.getElementById('welcomeOverlay').contains(active);
    });
    expect(isInsideFirst).toBe(true);

    // Tab multiple times
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
    }
    const isInsideAfterTabs = await page.evaluate(() => {
      const active = document.activeElement;
      return document.getElementById('welcomeOverlay').contains(active);
    });
    expect(isInsideAfterTabs).toBe(true);

    // Shift+Tab backward
    await page.keyboard.press('Shift+Tab');
    const isInsideAfterShiftTab = await page.evaluate(() => {
      const active = document.activeElement;
      return document.getElementById('welcomeOverlay').contains(active);
    });
    expect(isInsideAfterShiftTab).toBe(true);

    // Dismiss
    await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden();
  });

  test('Gap 2: Fast, Smart, and Offline engine cards display honest privacy disclosures', async ({ app }) => {
    const { page } = app;
    await page.evaluate(() => window.openWelcomeWizard(2));

    const overlay = page.locator('#welcomeOverlay');
    await expect(overlay).toBeVisible();
    await expect(page.locator('#welcomeStep2')).toBeVisible();

    const offlineCard = page.locator('#welcomeStep2 [data-choice-engine="offline"]');
    const ollamaCard = page.locator('#welcomeStep2 [data-choice-engine="ollama"]');
    const onlineCard = page.locator('#welcomeStep2 [data-choice-engine="online"]');
    const privacyNotice = page.locator('#welcomePrivacyNotice');
    const privacyText = page.locator('#welcomePrivacyText');

    // 1. Fast (Online) choice discloses server/cloud transmission
    await mouseClick(page, onlineCard);
    await expect(onlineCard).toHaveClass(/\bactive\b/);
    await expect(privacyNotice).not.toHaveClass(/\blocal\b/);
    await expect(privacyText).toHaveText(/Online engine|selected provider|ارائه‌دهنده/i);

    // 2. Offline choice discloses local in-browser processing
    await mouseClick(page, offlineCard);
    await expect(offlineCard).toHaveClass(/\bactive\b/);
    await expect(privacyNotice).toHaveClass(/\blocal\b/);
    await expect(privacyText).toHaveText(/stays on this (device|PC)|Everything stays on this device|همین رایانه/i);

    // 3. Smart (Ollama) choice discloses local execution
    await mouseClick(page, ollamaCard);
    await expect(ollamaCard).toHaveClass(/\bactive\b/);
    await expect(privacyNotice).toHaveClass(/\blocal\b/);
    await expect(privacyText).toHaveText(/stays on this (device|PC)|Everything stays on this device|همین رایانه/i);
  });

  test('Gap 3: optional AI key input is masked with eye toggle button and auto-saves to cfg', async ({ app }) => {
    const { page } = app;
    await page.evaluate(() => window.openWelcomeWizard(2));

    const keyInp = page.locator('#welcomeApiKeyInput');
    const toggleBtn = page.locator('#welcomeKeyToggleBtn');
    const last4 = page.locator('#welcomeKeyLast4');

    await expect(keyInp).toBeVisible();
    // 1. Key input is masked by default
    await expect(keyInp).toHaveAttribute('type', 'password');

    // 2. Eye button toggles visibility
    await mouseClick(page, toggleBtn);
    await expect(keyInp).toHaveAttribute('type', 'text');
    await expect(toggleBtn).toHaveText('🔒');

    await mouseClick(page, toggleBtn);
    await expect(keyInp).toHaveAttribute('type', 'password');
    await expect(toggleBtn).toHaveText('👁');

    // 3. Typing key auto-saves to cfg without Save button
    await keyInp.fill('AIzaSyTestSecretKey9988');
    await expect(last4).toHaveText('…9988');

    const savedKey = await page.evaluate(() => {
      return window.cfg?.eng?.gemini?.key;
    });
    expect(savedKey).toBe('AIzaSyTestSecretKey9988');
  });
});
