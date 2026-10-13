'use strict';
const { test, expect } = require('../support/fixtures');
const { openSettings, activateSettingsTab } = require('../support/model-helpers');

test.describe('Item 2: Whisper controls and test speech model tab mapping', () => {
  test('#offWhisperSel and #testAsrRun belong to voiceModels tab and are visible when active', async ({ app }) => {
    const { page } = app;
    await openSettings(page, 'voiceModels');

    // Both controls must be inside #secVoiceModels and visible
    const offWhisperSel = page.locator('#secVoiceModels #offWhisperSel');
    const testAsrRun = page.locator('#secVoiceModels #testAsrRun');
    await expect(offWhisperSel).toBeVisible();
    await expect(testAsrRun).toBeVisible();

    // Inactive section #secTrModels must be hidden
    await expect(page.locator('#secTrModels')).toBeHidden();

    // Switching to trModels makes offWhisperSel hidden and offTrModelSel visible
    await activateSettingsTab(page, 'trModels');
    await expect(page.locator('#secTrModels #offTrModelSel')).toBeVisible();
    await expect(page.locator('#secVoiceModels #offWhisperSel')).toBeHidden();
    await expect(page.locator('#secVoiceModels #testAsrRun')).toBeHidden();
  });
});
