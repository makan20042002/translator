'use strict';
const { test, expect, mouseClick, onlyEngines } = require('../support/fixtures');
const { fakeDownloaded } = require('../support/model-helpers');

const GEMINI = 'generativelanguage.googleapis.com';
const streamCalls = stub => stub.calls(GEMINI).filter(c => /:streamGenerateContent$/.test(c.path) || (/:generateContent$/.test(c.path) && c.body.includes('AUDIO')));

async function translateText(page, text) {
  await mouseClick(page, page.locator('#tIn'));
  await page.keyboard.type(text);
  await mouseClick(page, page.locator('#tGo'));
  await expect(page.locator('#tOut')).toHaveValue(/\[fa\]/, { timeout: 15_000 });
}

test.describe('Web app: Text tab redesign', () => {
  test.describe('Item 1: Page header and language bar', () => {
    test('all controls exist with identical IDs and labels', async ({ app }) => {
      const { page } = app;

      // Header exists with title and subtitle
      await expect(page.locator('.trans-page-title')).toHaveText('Translate');
      await expect(page.locator('.trans-page-sub')).toBeVisible();

      // Bar controls exist with preserved IDs
      await expect(page.locator('#src')).toBeVisible();
      await expect(page.locator('#swap')).toBeVisible();
      await expect(page.locator('#tgt')).toBeVisible();
      await expect(page.locator('#tMode')).toBeVisible();
      await expect(page.locator('#engine')).toBeAttached();
      await expect(page.locator('#textEnginePickerHost .engine-picker-select')).toBeVisible();
      await expect(page.locator('#tone')).toBeVisible();
      await expect(page.locator('#tSubject')).toBeVisible();
      await expect(page.locator('.switch-lbl[for="tmToggle"]')).toBeVisible();
      await expect(page.locator('#tmToggle')).toBeAttached();

      // Check translation memory toggle default and interaction in the bar via visible switch
      await expect(page.locator('#tmToggle')).toBeChecked();
      await mouseClick(page, page.locator('.switch-lbl[for="tmToggle"]'));
      await expect(page.locator('#tmToggle')).not.toBeChecked();

      const cfgSaved = await page.evaluate(() => store.get('cfg', {}).tm);
      expect(cfgSaved).toBe(false);

      // Re-enable
      await mouseClick(page, page.locator('.switch-lbl[for="tmToggle"]'));
      await expect(page.locator('#tmToggle')).toBeChecked();
    });

    test('memory switch responds to real click in bar and Settings, and toggles via keyboard with Space', async ({ app }) => {
      const { page, errors } = app;

      // Assert zero page errors or uncaught exceptions on load (fails if any "X is not defined" occurs)
      expect(errors, 'zero page errors or uncaught exceptions on load').toEqual([]);

      const barSwitchLbl = page.locator('.switch-lbl[for="tmToggle"]');
      const barToggle = page.locator('#tmToggle');
      await expect(barSwitchLbl).toBeVisible();
      await expect(barToggle).toBeChecked();

      // Real mouse click on the visible bar switch toggles it off
      await mouseClick(page, barSwitchLbl);
      await expect(barToggle).not.toBeChecked();

      // Open Settings and verify #setTmToggle is synchronized
      await mouseClick(page, page.locator('#openSet'));
      await expect(page.locator('#ov')).toHaveClass(/\bon\b/);
      const setToggle = page.locator('#setTmToggle');
      await expect(setToggle).not.toBeChecked();

      // Click the visible Settings toggle label to re-enable
      const setLbl = page.locator('label.chk:has(#setTmToggle)');
      await expect(setLbl).toBeVisible();
      await mouseClick(page, setLbl);
      await expect(setToggle).toBeChecked();

      // Close Settings and verify bar switch is synced back to checked
      await mouseClick(page, page.locator('#closeSet'));
      await expect(page.locator('#ov')).not.toHaveClass(/\bon\b/);
      await expect(barToggle).toBeChecked();

      // Keyboard toggling on #tmToggle using Space key
      await barToggle.focus();
      await page.keyboard.press('Space');
      await expect(barToggle).not.toBeChecked();

      // Toggle back on with Space key
      await page.keyboard.press('Space');
      await expect(barToggle).toBeChecked();
    });

    test('bar does not cause horizontal overflow at 360, 700, and 1280px in English and Persian', async ({ app }) => {
      const { page } = app;
      const widths = [360, 700, 1280];

      for (const width of widths) {
        await page.setViewportSize({ width, height: 800 });
        await page.waitForTimeout(50);

        for (const lang of ['en', 'fa']) {
          if (lang === 'fa') {
            await page.evaluate(() => {
              ui = 'fa';
              document.documentElement.dir = 'rtl';
              document.documentElement.lang = 'fa';
              applyI18n();
            });
            await expect(page.locator('.trans-page-title')).toHaveText('ترجمه');
          } else {
            await page.evaluate(() => {
              ui = 'en';
              document.documentElement.dir = 'ltr';
              document.documentElement.lang = 'en';
              applyI18n();
            });
            await expect(page.locator('.trans-page-title')).toHaveText('Translate');
          }

          await page.waitForTimeout(50);

          const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
          const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
          expect(scrollWidth, `no horizontal overflow at ${width}px in ${lang}`).toBeLessThanOrEqual(clientWidth + 1);

          // Bar itself is within viewport
          const barBox = await page.locator('.bar.trans-bar').boundingBox();
          expect(barBox).toBeTruthy();
          expect(barBox.x).toBeGreaterThanOrEqual(-1);
          expect(barBox.x + barBox.width).toBeLessThanOrEqual(width + 2);
        }
      }
    });
  });

  test.describe('Item 2: Source and target cards', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

    test('live word count and character count update when typing', async ({ app }) => {
      const { page } = app;
      await mouseClick(page, page.locator('#tIn'));
      await page.keyboard.type('Hello world, this is a test');

      await expect(page.locator('#tCount')).toContainText('27 characters');
      await expect(page.locator('#tWordCount')).toHaveText('6 words');

      await mouseClick(page, page.locator('#tClear'));
      await expect(page.locator('#tCount')).toContainText('0 characters');
      await expect(page.locator('#tWordCount')).toHaveText('0 words');
    });

    test('Persian result has dir="rtl" and Vazirmatn font', async ({ app }) => {
      const { page } = app;
      await page.locator('#tgt').selectOption('fa');

      // Verify direction attribute and computed font on #tOut
      await expect(page.locator('#tOut')).toHaveAttribute('dir', 'rtl');

      const fontFamily = await page.locator('#tOut').evaluate(el => window.getComputedStyle(el).fontFamily);
      expect(fontFamily).toContain('Vazirmatn');
    });

    test('the from-memory badge appears ONLY after a real memory hit and not on a fresh translation', async ({ app }) => {
      const { page } = app;

      // Clean memory initial translation
      await mouseClick(page, page.locator('#tIn'));
      await page.keyboard.type('First time translated');
      await mouseClick(page, page.locator('#tGo'));

      // Output exists and meta has engine used, but NO .pill-tm badge
      await expect(page.locator('#tOut')).toHaveValue('[fa] First time translated');
      await expect(page.locator('#tMeta')).toContainText('Google Translate (web)');
      await expect(page.locator('#tMeta .pill-tm')).toHaveCount(0);
      await expect(page.locator('#tStatusChip')).toBeVisible();

      // Clear source and translate the identical text again to trigger memory lookup
      await mouseClick(page, page.locator('#tClear'));
      await mouseClick(page, page.locator('#tIn'));
      await page.keyboard.type('First time translated');
      await mouseClick(page, page.locator('#tGo'));

      // Now it hits memory: badge appears
      await expect(page.locator('#tMeta .pill-tm')).toBeVisible();
      await expect(page.locator('#tMeta')).toContainText('from memory');
    });

    test('listen button is enabled when no voice is installed, and clicking it shows a clear notice', async ({ app }) => {
      const { page, stub } = app;
      await page.evaluate(() => {
        cfg.tts = { mode: 'device', voices: {} };
        window.speechSynthesis = { getVoices: () => [] };
      });
      await page.locator('#tgt').selectOption('fa');

      // #tSpeak stays enabled and has text "Speak"
      await expect(page.locator('#tSpeak')).toBeEnabled();
      await expect(page.locator('#tSpeak')).toHaveText('Speak');

      // Translate text so #tOut is populated before attempting to speak
      await translateText(page, 'Good morning');

      // Clicking it triggers the notice in #speakNotice / #speakNoticeText
      await mouseClick(page, page.locator('#tSpeak'));
      await expect(page.locator('#speakNotice')).toBeVisible();
      await expect(page.locator('#speakNoticeText')).toBeVisible();
      await expect(page.locator('#speakNoticeText')).toContainText('no Gemini key is set');
      await expect(page.locator('#tSpeak')).toHaveText('Speak');
      expect(streamCalls(stub)).toEqual([]);
    });
  });

  test.describe('Item 3: Recent translations strip', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

    test('shows empty state when history is empty, shows real items after translating, and clicking an item loads it', async ({ app }) => {
      const { page } = app;

      // Initially empty history
      await page.evaluate(() => store.set('hist', []));
      await page.evaluate(() => renderRecentTranslations());

      await expect(page.locator('#tRecentEmpty')).toBeVisible();
      await expect(page.locator('#tRecentList .trans-recent-tile')).toHaveCount(0);

      // Perform a translation
      await mouseClick(page, page.locator('#tIn'));
      await page.keyboard.type('Recent test phrase');
      await mouseClick(page, page.locator('#tGo'));
      await expect(page.locator('#tOut')).toHaveValue('[fa] Recent test phrase');

      // Now recent translations strip has 1 real tile
      await expect(page.locator('#tRecentEmpty')).not.toBeVisible();
      await expect(page.locator('#tRecentList .trans-recent-tile')).toHaveCount(1);
      const tile = page.locator('#tRecentList .trans-recent-tile').first();
      await expect(tile.locator('.trans-recent-src-text')).toHaveText('Recent test phrase');
      await expect(tile.locator('.trans-recent-tgt-text')).toHaveText('[fa] Recent test phrase');

      // Clear the text cards
      await mouseClick(page, page.locator('#tClear'));
      await expect(page.locator('#tIn')).toHaveValue('');
      await expect(page.locator('#tOut')).toHaveValue('');

      // Click the recent tile to reload it into the cards
      await mouseClick(page, tile);
      await expect(page.locator('#tIn')).toHaveValue('Recent test phrase');
      await expect(page.locator('#tOut')).toHaveValue('[fa] Recent test phrase');

      // Clear button empties history and returns to honest empty state
      await mouseClick(page, page.locator('#tRecentClear'));
      await expect(page.locator('#tRecentEmpty')).toBeVisible();
      await expect(page.locator('#tRecentList .trans-recent-tile')).toHaveCount(0);

      const histInStore = await page.evaluate(() => store.get('hist', []));
      expect(histInStore).toEqual([]);
    });

    test('See all button opens the History tab', async ({ app }) => {
      const { page } = app;
      await mouseClick(page, page.locator('#tRecentViewAll'));
      await expect(page.locator('#tab-hist')).toBeVisible();
      await expect(page.locator('#tabs button[data-tab="hist"]')).toHaveClass(/on/);
    });

    test('History tab, Glossary tab, and Recent strip work with zero page errors after translating twice, clearing history, adding a glossary term', async ({ app }) => {
      const { page, errors } = app;

      // 1. Translate twice to populate history and recent translations strip
      await mouseClick(page, page.locator('#tIn'));
      await page.keyboard.type('First phrase');
      await mouseClick(page, page.locator('#tGo'));
      await expect(page.locator('#tOut')).toHaveValue('[fa] First phrase');

      await mouseClick(page, page.locator('#tClear'));
      await mouseClick(page, page.locator('#tIn'));
      await page.keyboard.type('Second phrase');
      await mouseClick(page, page.locator('#tGo'));
      await expect(page.locator('#tOut')).toHaveValue('[fa] Second phrase');

      // Recent translations strip displays 2 tiles
      await expect(page.locator('#tRecentList .trans-recent-tile')).toHaveCount(2);

      // 2. Open History tab and verify history items render without errors
      await mouseClick(page, page.locator('#tabs button[data-tab="hist"]'));
      await expect(page.locator('#tab-hist')).toBeVisible();

      // 3. Clear history via Recent strip button after switching back to Text tab
      await mouseClick(page, page.locator('#tabs button[data-tab="text"]'));
      await mouseClick(page, page.locator('#tRecentClear'));
      await expect(page.locator('#tRecentEmpty')).toBeVisible();

      // 4. Open Glossary tab and add a term
      await mouseClick(page, page.locator('#tabs button[data-tab="gls"]'));
      await expect(page.locator('#tab-gls')).toBeVisible();
      await mouseClick(page, page.locator('#gAdd'));
      await page.keyboard.type('TestTerm');
      await page.keyboard.press('Tab');
      await page.keyboard.type('واژه');
      await expect(page.locator('#gList .gl')).toHaveCount(1);

      // Verify zero uncaught errors occurred across all steps
      expect(errors).toEqual([]);
    });
  });

  test.describe('Item 4: Status strip', () => {
    test('reflects not-ready and ready states truthfully without inventing anything', async ({ app }) => {
      const { page } = app;

      // Status strip is present
      const strip = page.locator('#tStatusStrip');
      await expect(strip).toBeVisible();

      // No Whisper on the Text tab (Whisper is an STT/speech model, not translate)
      await expect(strip).not.toContainText('Whisper');

      // In initial state where models are not downloaded:
      // Offline translation model shows warning (amber dot) and "not downloaded"
      const trItem = strip.locator('.trans-status-item').first();
      await expect(trItem.locator('.status-dot')).toHaveClass(/warn/);
      await expect(trItem).toContainText('not downloaded');
      await expect(trItem.locator('bdi')).toContainText('NLLB');
      await expect(trItem.locator('bdi')).not.toContainText('(default)');
      await expect(trItem.locator('span[title]')).toHaveAttribute('title', /default/i);

      // Now simulate NLLB downloaded (mcReady becomes true)
      const cat = await page.evaluate(() => MODEL_CATALOG);
      const nllb = cat.models.find(x => x.id === 'tr-nllb-600');
      await fakeDownloaded(page, nllb.repo, nllb.files);
      await page.evaluate(async () => {
        store.set('nllb', true);
        const d = store.get('mdl', {});
        d['tr-nllb-600'] = { at: Date.now(), files: [] };
        store.set('mdl', d);
        await mcScan();
        if (typeof updateStatusPill === 'function') {
          updateStatusPill();
        }
      });

      // Now translation model shows ready (green dot)
      await expect(trItem.locator('.status-dot')).toHaveClass(/ok/);
      await expect(trItem).toContainText('ready');

      // Switch UI to Persian: Latin name stays inside <bdi> and Persian text is shown
      await page.evaluate(() => {
        ui = 'fa';
        document.documentElement.dir = 'rtl';
        document.documentElement.lang = 'fa';
        applyI18n();
      });

      await expect(trItem.locator('bdi')).toContainText('NLLB');
      await expect(trItem.locator('bdi')).not.toContainText('(default)');
      await expect(trItem).toContainText('آماده');
      await expect(trItem.locator('span[title]')).toHaveAttribute('title', /default/i);

      // Offline mode toggling updates info note
      await mouseClick(page, page.locator('#offBtn'));
      await expect(strip.locator('.trans-status-info')).toContainText('حالت آفلاین');
    });
  });
});

