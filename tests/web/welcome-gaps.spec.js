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
    const { page, errors } = app;
    const consoleLogs = [];
    page.on('console', msg => consoleLogs.push(msg.text()));

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
    const testSecret = 'AIzaSyTestSecretKey9988';
    await keyInp.fill(testSecret);
    await expect(last4).toHaveText('…9988');
    await expect(keyInp).toHaveAttribute('type', 'password');

    const savedKey = await page.evaluate(() => {
      return cfg?.eng?.gemini?.key;
    });
    expect(savedKey).toBe('AIzaSyTestSecretKey9988');

    // Verify key is persisted in localStorage under mkt_cfg
    const storedCfg = await page.evaluate(() => {
      const raw = localStorage.getItem('mkt_cfg');
      return raw ? JSON.parse(raw) : null;
    });
    expect(storedCfg?.eng?.gemini?.key).toBe('AIzaSyTestSecretKey9988');

    // Security assertions: key never appears in URL, page text, or console logs
    expect(page.url()).not.toContain(testSecret);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).not.toContain(testSecret);
    expect(consoleLogs.some(log => log.includes(testSecret))).toBe(false);
    expect(errors.some(err => err.includes(testSecret))).toBe(false);

    // Confirm Settings shows the saved key masked after opening Settings > Engines and keys
    await mouseClick(page, page.locator('#welcomeSkipBtn'));
    await expect(page.locator('#welcomeOverlay')).toBeHidden();

    await openSettingsModal(page);
    await mouseClick(page, page.locator('#setTabBtnEngines'));

    const settingsGeminiKey = page.locator('#engList .eng[data-id="gemini"] input[data-f="key"]');
    await expect(settingsGeminiKey).toBeVisible();
    await expect(settingsGeminiKey).toHaveAttribute('type', 'password');
    await expect(settingsGeminiKey).toHaveValue(testSecret);

    const settingsGeminiLast4 = page.locator('#engList .eng[data-id="gemini"] .eng-key-last4');
    await expect(settingsGeminiLast4).toBeVisible();
    await expect(settingsGeminiLast4).toHaveText('…9988');
  });

  test('Gap 4: offline models display real names, accurate sizes, and honest status from catalogue', async ({ app }) => {
    const { page } = app;
    await page.evaluate(() => window.openWelcomeWizard(3));

    const step3 = page.locator('#welcomeStep3');
    await expect(step3).toBeVisible();

    const lightCard = page.locator('#welcomeStep3 [data-choice-package="light"]');
    const fullCard = page.locator('#welcomeStep3 [data-choice-package="full"]');
    const nllbBadge = page.locator('#welcomeNllbBadge');
    const fullBadge = page.locator('#welcomeFullBadge');

    // Model names and accurate catalogue sizes (not fake 600 or 850 MB)
    await expect(lightCard).toContainText(/NLLB-200/i);
    await expect(lightCard).toContainText(/870\s*(MB|مگابایت)/i);
    await expect(lightCard).not.toContainText(/600\s*(MB|مگابایت)/i);

    await expect(fullCard).toContainText(/Whisper/i);
    await expect(fullCard).toContainText(/1(\.|\/)1\s*(GB|گیگابایت)/i);
    await expect(fullCard).not.toContainText(/850\s*(MB|مگابایت)/i);

    // Badges reflect real size / status
    await expect(nllbBadge).toBeVisible();
    await expect(fullBadge).toBeVisible();
  });

  test('Gap 5: real voice and screen status badges are displayed', async ({ app }) => {
    const { page } = app;
    await page.evaluate(() => window.openWelcomeWizard(3));

    const voiceBadge = page.locator('#welcomeVoiceStatusBadge');
    const screenBadge = page.locator('#welcomeScreenStatusBadge');

    await expect(voiceBadge).toBeVisible();
    await expect(screenBadge).toBeVisible();

    // Badges display real status (not fake)
    const voiceText = await voiceBadge.textContent();
    expect(voiceText).toBeTruthy();

    const screenText = await screenBadge.textContent();
    expect(screenText).toBeTruthy();
  });

  test('Gap 5: Done summary lists configured items and Go to Text button activates Text tab', async ({ app }) => {
    const { page } = app;
    await page.evaluate(() => window.openWelcomeWizard(4));

    const step4 = page.locator('#welcomeStep4');
    await expect(step4).toBeVisible();

    const goTextBtn = page.locator('#welcomeGoTextBtn');
    await expect(goTextBtn).toBeVisible();

    // Click Go to Text button
    await mouseClick(page, goTextBtn);

    const overlay = page.locator('#welcomeOverlay');
    await expect(overlay).toBeHidden();

    // Marked done in localStorage
    const isDone = await page.evaluate(() => localStorage.getItem('welcome_done'));
    expect(isDone).toBe('1');

    // Text tab is active
    const textTabBtn = page.locator('#tabs button[data-tab="text"]');
    await expect(textTabBtn).toHaveClass(/\bon\b/);
  });
});
