'use strict';
// Item 3: More offline Piper voices from rhasspy/piper-voices.
// Verifies new female English voices (LJ Speech, Cori, Kristin) appear in the catalogue
// with correct language and gender labels, that unknown gender shows "unknown" (Ganji),
// and that they download through the existing download code with stubbed network/cache.
const { test, expect, onlyEngines, mouseClick } = require('../support/fixtures');
const { fakeDownloaded, openSettings, activateSettingsTab, row } = require('../support/model-helpers');

test.describe('Web app: offline Piper voice catalogue and confirmed gender labels', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), src: 'en', tgt: 'fa' } } });

  test('new voices appear in the catalogue with correct language and gender labels', async ({ app }) => {
    const { page } = app;
    await openSettings(page, 'trModels');
    await page.evaluate(() => mcRender());

    // Check MODEL_CATALOG structure directly
    const voices = await page.evaluate(() => MODEL_CATALOG.models.filter(m => m.kind === 'piper'));

    // 1. LJ Speech: English, female
    const lj = voices.find(v => v.id === 'tts-en-ljspeech');
    expect(lj).toBeTruthy();
    expect(lj.lang).toBe('en');
    expect(lj.name.en).toContain('female');
    expect(lj.name.fa).toContain('زن');

    // 2. Cori: English, female
    const cori = voices.find(v => v.id === 'tts-en-cori');
    expect(cori).toBeTruthy();
    expect(cori.lang).toBe('en');
    expect(cori.name.en).toContain('female');
    expect(cori.name.fa).toContain('زن');

    // 3. Kristin: English, female
    const kristin = voices.find(v => v.id === 'tts-en-kristin');
    expect(kristin).toBeTruthy();
    expect(kristin.lang).toBe('en');
    expect(kristin.name.en).toContain('female');
    expect(kristin.name.fa).toContain('زن');

    // Check rows rendered in the Offline settings catalogue
    await expect(row(page, 'tts-en-ljspeech')).toBeVisible();
    await expect(row(page, 'tts-en-ljspeech')).toContainText('female');
    await expect(row(page, 'tts-en-cori')).toBeVisible();
    await expect(row(page, 'tts-en-cori')).toContainText('female');
    await expect(row(page, 'tts-en-kristin')).toBeVisible();
    await expect(row(page, 'tts-en-kristin')).toContainText('female');
  });

  test('unknown gender shows "unknown" in catalogue and picker labels', async ({ app }) => {
    const { page } = app;
    await openSettings(page, 'trModels');
    await page.evaluate(() => mcRender());

    // Ganji's model card does not specify gender, so it must display (unknown)
    const ganji = await page.evaluate(() => MODEL_CATALOG.models.find(m => m.id === 'tts-fa-ganji'));
    expect(ganji).toBeTruthy();
    expect(ganji.name.en).toContain('unknown');
    expect(ganji.name.fa).toContain('نامشخص');

    // Check catalogue row
    await expect(row(page, 'tts-fa-ganji')).toContainText('unknown');

    // Check unified voice picker list
    await activateSettingsTab(page, 'voices');
    const pickerList = page.locator('#voicePickerList');
    await expect(pickerList).toContainText('unknown');
  });

  test('new voices download through the existing download code (stubbed cache)', async ({ app }) => {
    const { page } = app;

    // Fake download files for LJ Speech and Cori
    const cat = await page.evaluate(() => MODEL_CATALOG);
    const ljModel = cat.models.find(x => x.id === 'tts-en-ljspeech');
    expect(ljModel).toBeTruthy();
    await fakeDownloaded(page, ljModel.repo, ljModel.files);

    // Scan downloaded models
    await page.evaluate(async () => {
      await mcScan();
      mcRender();
      fillVoices();
    });

    // Check ready state in MC
    const isReady = await page.evaluate(() => mcReady(MC.models.find(x => x.id === 'tts-en-ljspeech')));
    expect(isReady).toBe(true);

    // In Speech settings dropdown for English, downloaded LJ Speech appears
    await page.evaluate(() => {
      $('tgt').value = 'en';
      fillVoices();
    });
    const voiceOpts = await page.locator('#voiceSel option').evaluateAll(list => list.map(o => o.text));
    expect(voiceOpts.some(t => t.includes('LJ Speech'))).toBe(true);

    // In compact voice picker, LJ Speech appears in the downloaded group
    await page.locator('#tVoicePickerBtn').click();
    const dlGroup = page.locator('#tVoicePickerList [data-group="offline-downloaded"]');
    await expect(dlGroup).toBeVisible();
    await expect(dlGroup).toContainText('LJ Speech');
  });
});
