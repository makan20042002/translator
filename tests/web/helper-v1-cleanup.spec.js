'use strict';
/**
 * tests/web/helper-v1-cleanup.spec.js
 * ITEM 3: v1 cleanup of the Python helper entries:
 * 1. Hide "Python ASR Helper" group in the Voice speech picker and helper block in Settings
 *    unless the helper answers GET /health at the saved helper address.
 * 2. Check only when the user opens that part of Settings and presses Check,
 *    never automatically and never in offline mode toward non-local hosts.
 * 3. Remove "needs the helper, not included in v1" from default UI.
 * 4. With a stubbed healthy /health after pressing Check, helper entries appear.
 * 5. Tested in EN and FA.
 */

const { test, expect, onlyEngines, mouseClick } = require('../support/fixtures');
const { openSettings } = require('../support/model-helpers');

test.describe('Python ASR Helper v1 Cleanup (ITEM 3)', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), src: 'en', tgt: 'fa' } } });

  test('with no helper running, Voice picker and Settings show no helper entries (EN)', async ({ app }) => {
    const { page } = app;

    // 1. Voice tab: speech picker lists no helper group or helper cards
    await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));
    await page.locator('#vMicSttBtn').click();
    const list = page.locator('#vMicSttList');
    await expect(list.locator('[data-group="helper-asr"]')).toBeHidden();
    await expect(list.locator('.voice-card[data-stt="helper"]')).toHaveCount(0);

    // 2. Settings: Voice models section shows no helper entries
    await openSettings(page, 'voiceModels');
    await expect(page.locator('#helperSettingsWrap')).toBeHidden();
    await expect(page.locator('#sttSel option[value="helper"]')).toBeHidden();
    await expect(page.locator('#vSttChoice option[value="helper"]')).toBeHidden();

    // 3. Honesty/cleanup: default UI does not state "needs the helper, not included in v1"
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('needs the helper, not included in v1');
  });

  test('with stubbed healthy /health after pressing Check, helper entries appear (EN)', async ({ app }) => {
    const { page } = app;

    let healthChecked = false;
    await page.route('http://127.0.0.1:8765/health', async route => {
      healthChecked = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', loaded_model: 'whisper-large-v3' })
      });
    });

    // Open Settings -> Voice models tab
    await openSettings(page, 'voiceModels');
    expect(healthChecked).toBe(false); // Never checked automatically!
    await expect(page.locator('#helperSettingsWrap')).toBeHidden();
    await expect(page.locator('#sttSel option[value="helper"]')).toBeHidden();

    // Press Check
    await page.locator('#btnCheckHelper').click();
    await expect.poll(() => healthChecked).toBe(true);

    // Helper entries appear in Settings
    await expect(page.locator('#helperSettingsWrap')).toBeVisible();
    await expect(page.locator('#sttSel option[value="helper"]')).toBeVisible();
    await expect(page.locator('#vSttChoice option[value="helper"]')).toBeVisible();
    await expect(page.locator('#helperStatusMsg')).toContainText('Connected');

    // Helper entries appear in Voice speech picker
    await mouseClick(page, page.locator('#closeSet'));
    await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));
    await page.locator('#vMicSttBtn').click();
    const helperGroup = page.locator('#vMicSttList [data-group="helper-asr"]');
    await expect(helperGroup).toBeVisible();
    await expect(helperGroup.locator('.voice-card[data-helper-model="whisper-large-v3"]')).toBeVisible();
    await expect(helperGroup.locator('.voice-card[data-helper-model="qwen3-asr"]')).toBeVisible();
  });

  test('with no helper running, Voice picker and Settings show no helper entries (FA)', async ({ app }) => {
    const { page } = app;

    await page.evaluate(() => {
      ui = 'fa';
      applyI18n();
    });

    // 1. Voice tab: speech picker lists no helper group
    await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));
    await page.locator('#vMicSttBtn').click();
    const list = page.locator('#vMicSttList');
    await expect(list.locator('[data-group="helper-asr"]')).toBeHidden();
    await expect(list.locator('.voice-card[data-stt="helper"]')).toHaveCount(0);

    // 2. Settings: Voice models section shows no helper entries
    await openSettings(page, 'voiceModels');
    await expect(page.locator('#helperSettingsWrap')).toBeHidden();
    await expect(page.locator('#sttSel option[value="helper"]')).toBeHidden();
    await expect(page.locator('#vSttChoice option[value="helper"]')).toBeHidden();

    // 3. Default Persian UI does not show v1 excluded notice
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('نیازمند برنامه کمکی، در نگارش ۱ گنجانده نشده');
  });

  test('with stubbed healthy /health after pressing Check, helper entries appear (FA)', async ({ app }) => {
    const { page } = app;

    await page.evaluate(() => {
      ui = 'fa';
      applyI18n();
    });

    let healthChecked = false;
    await page.route('http://127.0.0.1:8765/health', async route => {
      healthChecked = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', loaded_model: 'whisper-large-v3' })
      });
    });

    await openSettings(page, 'voiceModels');
    expect(healthChecked).toBe(false); // Never checked automatically!
    await expect(page.locator('#helperSettingsWrap')).toBeHidden();

    // Press Check
    await page.locator('#btnCheckHelper').click();
    await expect.poll(() => healthChecked).toBe(true);

    // Helper entries appear in Settings
    await expect(page.locator('#helperSettingsWrap')).toBeVisible();
    await expect(page.locator('#sttSel option[value="helper"]')).toBeVisible();
    await expect(page.locator('#vSttChoice option[value="helper"]')).toBeVisible();
    await expect(page.locator('#helperStatusMsg')).toContainText('متصل است');

    // Helper entries appear in Voice speech picker
    await mouseClick(page, page.locator('#closeSet'));
    await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));
    await page.locator('#vMicSttBtn').click();
    const helperGroup = page.locator('#vMicSttList [data-group="helper-asr"]');
    await expect(helperGroup).toBeVisible();
  });

  test('in offline mode toward non-local hosts, Check does not probe network', async ({ app }) => {
    const { page } = app;

    let probed = false;
    await page.route('**', async route => {
      if (route.request().url().includes('remote-helper.example.com')) {
        probed = true;
      }
      await route.continue();
    });

    await openSettings(page, 'voiceModels');

    await page.evaluate(() => {
      cfg.offline = true;
      $('helperUrlInput').value = 'http://remote-helper.example.com:8765';
    });

    await page.locator('#btnCheckHelper').click();

    expect(probed).toBe(false);
    await expect(page.locator('#helperStatusMsg')).toContainText('offline');
    await expect(page.locator('#helperSettingsWrap')).toBeHidden();
  });
});
