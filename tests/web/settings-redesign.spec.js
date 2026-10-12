'use strict';
const { test, expect, mouseClick, VALID_KEY } = require('../support/fixtures');

async function openSettings(page) {
  await mouseClick(page, page.locator('#openSet'));
  await expect(page.locator('#ov')).toHaveClass(/\bon\b/);
}

test.describe('Web app: Settings Redesign (Stage 2)', () => {
  test('engines have initial honest status pills, masked key with last-4 and toggle eye, and default Ollama URL', async ({ app }) => {
    const { page } = app;
    await openSettings(page);

    // Initial status badges are populated for engines
    const googleStatus = page.locator('#engList .eng[data-id="google"] .eng-status');
    await expect(googleStatus).toBeVisible();
    await expect(googleStatus).toHaveText(/free/i);

    // Ollama has default URL field
    const ollamaBase = page.locator('#engList .eng[data-id="ollama"] input[data-f="base"]');
    await expect(ollamaBase).toBeVisible();
    await expect(ollamaBase).toHaveValue('http://localhost:11434/v1');

    // Gemini key input is masked and shows show-last-4
    const geminiInput = page.locator('#engList .eng[data-id="gemini"] input[data-f="key"]');
    await expect(geminiInput).toHaveAttribute('type', 'password');

    // Type a key
    await mouseClick(page, geminiInput);
    await page.keyboard.press('Control+A');
    await page.keyboard.type(VALID_KEY);

    // Show-last-4 snippet appears
    const last4El = page.locator('#engList .eng[data-id="gemini"] .eng-key-last4');
    await expect(last4El).toBeVisible();
    await expect(last4El).toHaveText(new RegExp(`…${VALID_KEY.slice(-4)}$`));

    // Eye toggle button toggles visibility
    const eyeBtn = page.locator('#engList .eng[data-id="gemini"] .eng-key-toggle-btn');
    await expect(eyeBtn).toBeVisible();
    await mouseClick(page, eyeBtn);
    await expect(geminiInput).toHaveAttribute('type', 'text');
    await mouseClick(page, eyeBtn);
    await expect(geminiInput).toHaveAttribute('type', 'password');
  });

  test('voices show license notes, speech rate works and auto-saves', async ({ app }) => {
    const { page } = app;
    await openSettings(page);

    // Switch to Voices tab
    await mouseClick(page, page.locator('#setTabBtnVoices'));
    await expect(page.locator('#secVoices')).toBeVisible();

    // Check license notes in voice picker list
    const licNotes = page.locator('#voicePickerList .voice-lic-note');
    const licCount = await licNotes.count();
    expect(licCount).toBeGreaterThan(0);

    // Speech rate selection
    const speedSel = page.locator('#ttsSpeed');
    await expect(speedSel).toBeVisible();
    await speedSel.selectOption('1.25');

    // Auto-save notice appears
    const autoSaveNotice = page.locator('#settingsAutoSaveNotice');
    await expect(autoSaveNotice).toBeVisible();

    const storedRate = await page.evaluate(() => cfg.tts.rate);
    expect(storedRate).toBe(1.25);
  });

  test('OCR shows honest Persian model status and syncing of #setTmToggle with #tmToggle', async ({ app }) => {
    const { page } = app;
    await openSettings(page);

    // Switch to OCR tab
    await mouseClick(page, page.locator('#setTabBtnOcr'));
    await expect(page.locator('#secOcr')).toBeVisible();

    // Honest Persian model status card
    const ocrCard = page.locator('#stPersianModelCard');
    await expect(ocrCard).toBeVisible();
    const badge = page.locator('#stPersianStatusBadge');
    await expect(badge).toBeVisible();
    // In mock browser without downloaded Persian model, reports Not installed
    await expect(badge).toHaveText(/Not installed|Ready/i);

    // TM toggles stay in sync
    const setTmToggle = page.locator('#setTmToggle');
    await expect(setTmToggle).toBeChecked();
    await setTmToggle.uncheck();

    const mainTmToggle = page.locator('#tmToggle');
    await expect(mainTmToggle).not.toBeChecked();

    // Recheck sync
    await setTmToggle.check();
    await expect(mainTmToggle).toBeChecked();
  });
});
