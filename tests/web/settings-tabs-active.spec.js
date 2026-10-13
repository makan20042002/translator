'use strict';
/**
 * Item 1 verification test suite:
 * 1. For each Settings tab, a real mouse click activates it.
 * 2. ONLY its section is visible, and all inactive sections are hidden and inert.
 * 3. Controls inside each active tab can be clicked with a real mouse:
 *    - Translation engines & keys: TM checkbox toggle
 *    - Voices: Speech rate selection
 *    - Voice models: Silence wait selection
 *    - Translation models: Dictionary pack download and remove, model delete, radio selection
 *    - OCR: OCR enable selection
 * 4. Controls in inactive sections are NOT focusable with the Tab key.
 */
const { test, expect, onlyEngines, mouseClick } = require('../support/fixtures');
const { fakeDownloaded, openSettings, activateSettingsTab, row } = require('../support/model-helpers');

test.describe('Web app: Settings real tabs activation and isolation', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), tgt: 'fa' } } });

  const TABS = [
    { name: 'engines', btn: '#setTabBtnEngines', sec: '#secEngines' },
    { name: 'voices', btn: '#setTabBtnVoices', sec: '#secVoices' },
    { name: 'voiceModels', btn: '#setTabBtnVoiceModels', sec: '#secVoiceModels' },
    { name: 'trModels', btn: '#setTabBtnTrModels', sec: '#secTrModels' },
    { name: 'ocr', btn: '#setTabBtnOcr', sec: '#secOcr' },
    { name: 'dict', btn: '#setTabBtnDict', sec: '#secDict' }
  ];

  test('for each tab, a real mouse click activates it and ONLY its section is visible', async ({ app }) => {
    const { page } = app;
    await openSettings(page);

    for (const tab of TABS) {
      await mouseClick(page, page.locator(tab.btn));
      await expect(page.locator(tab.btn)).toHaveClass(/active/);
      await expect(page.locator(tab.btn)).toHaveAttribute('aria-selected', 'true');

      // The targeted section must be visible and not inert
      await expect(page.locator(tab.sec)).toBeVisible();
      await expect(page.locator(tab.sec)).not.toHaveAttribute('inert');
      await expect(page.locator(tab.sec)).toHaveAttribute('aria-hidden', 'false');

      // All other sections must be hidden and inert
      for (const other of TABS) {
        if (other.sec !== tab.sec) {
          await expect(page.locator(other.sec)).toBeHidden();
          await expect(page.locator(other.sec)).toHaveAttribute('inert', '');
          await expect(page.locator(other.sec)).toHaveAttribute('aria-hidden', 'true');
        }
      }
    }
  });

  test('controls in each tab can be clicked with a real mouse', async ({ app }) => {
    const { page } = app;
    const cat = await page.evaluate(() => MODEL_CATALOG);

    // Setup models for delete and radio tests
    const small = cat.models.find(m => m.id === 'asr-small');
    const amir = cat.models.find(m => m.id === 'tts-fa-amir');
    const nllb = cat.models.find(m => m.id === 'tr-nllb-600');
    const m2m = cat.models.find(m => m.id === 'tr-m2m100-418');

    await page.evaluate(({ smallFiles, m2mFiles }) => {
      store.set('mdl', {
        'asr-small': { at: 1, files: smallFiles },
        'tr-m2m100-418': { at: 1, files: m2mFiles }
      });
    }, {
      smallFiles: small.files.map(f => f[0]).filter(f => f.endsWith('.onnx')),
      m2mFiles: m2m.files.map(f => f[0]).filter(f => f.endsWith('.onnx'))
    });

    await fakeDownloaded(page, small.repo, small.files);
    await fakeDownloaded(page, amir.repo, amir.files);
    await fakeDownloaded(page, nllb.repo, nllb.files);
    await fakeDownloaded(page, m2m.repo, m2m.files);

    await openSettings(page);

    // 1. Engines: Toggle TM checkbox with real mouse click
    await activateSettingsTab(page, 'engines');
    const tmToggle = page.locator('#setTmToggle');
    await expect(tmToggle).toBeVisible();
    const wasChecked = await tmToggle.isChecked();
    await mouseClick(page, tmToggle);
    expect(await tmToggle.isChecked()).toBe(!wasChecked);

    // 2. Voices: Change speech rate with real mouse click
    await activateSettingsTab(page, 'voices');
    const speedSel = page.locator('#ttsSpeed');
    await expect(speedSel).toBeVisible();
    await mouseClick(page, speedSel);
    await speedSel.selectOption('1.25');
    expect(await page.evaluate(() => cfg.tts.rate)).toBe(1.25);

    // 3. Voice models: Silence wait dropdown selection
    await activateSettingsTab(page, 'voiceModels');
    const silWait = page.locator('#ov select#vSilenceWait');
    await expect(silWait).toBeVisible();
    await mouseClick(page, silWait);
    await silWait.selectOption('1500');
    expect(await silWait.inputValue()).toBe('1500');

    // 4. Translation models: Dictionary download & remove, radio, and delete
    await activateSettingsTab(page, 'trModels');
    await page.evaluate(() => { mcScan(); mcRender(); offStatus(); });

    // 4a. Dictionary download and remove
    const dlDict = page.locator('#dictDl-en-fa');
    await expect(dlDict).toBeVisible();
    await mouseClick(page, dlDict);
    await expect(page.locator('#dictSt-en-fa')).toContainText(/ready/i, { timeout: 30_000 });

    const rmDict = page.locator('#dictRm-en-fa');
    await expect(rmDict).toBeVisible();
    await mouseClick(page, rmDict);
    await expect(page.locator('#dictSt-en-fa')).toHaveText(/not downloaded/i);

    // 4b. Radio selection
    const nllbRadio = row(page, 'tr-nllb-600').locator('input[type="radio"]');
    await expect(nllbRadio).toBeVisible();
    await mouseClick(page, nllbRadio);
    expect(await page.evaluate(() => cfg.trModel)).toBe('tr-nllb-600');

    // 4c. Model delete
    const smallRow = row(page, 'asr-small');
    await expect(smallRow).toBeVisible();
    const rmSmall = smallRow.locator('[data-act="rm"]');
    await expect(rmSmall).toBeVisible();
    await mouseClick(page, rmSmall);
    await expect(smallRow).toHaveAttribute('data-state', 'none');

    // 5. OCR: Toggle OCR enabled setting
    await activateSettingsTab(page, 'ocr');
    const stEnable = page.locator('#stEnable');
    await expect(stEnable).toBeVisible();
    await mouseClick(page, stEnable);
    await stEnable.selectOption('0');
    expect(await page.evaluate(() => String(cfg.screenTrans?.enabled ?? 0))).toBe('0');
  });

  test('controls in inactive sections are not focusable with Tab key', async ({ app }) => {
    const { page } = app;
    await openSettings(page);

    // Switch to Voices tab
    await activateSettingsTab(page, 'voices');

    // Press Tab multiple times and verify focused element is NEVER in an inactive section
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      const focusedSec = await page.evaluate(() => {
        const el = document.activeElement;
        const sec = el ? el.closest('.set-section') : null;
        return sec ? { id: sec.id, active: sec.classList.contains('active'), inert: sec.hasAttribute('inert') } : null;
      });
      if (focusedSec) {
        expect(focusedSec.active, `Focused element in section ${focusedSec.id} must be active`).toBe(true);
        expect(focusedSec.id).toBe('secVoices');
        expect(focusedSec.inert).toBe(false);
      }
    }
  });
});
