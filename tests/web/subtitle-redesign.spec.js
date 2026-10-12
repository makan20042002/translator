'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { test, expect, mouseClick, chooseFile, downloadOf, onlyEngines } = require('../support/fixtures');

test.describe('Web app: Subtitle tab redesign', () => {
  test.describe('Item 1: Page header and entry cards', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

    test('header exists, #sDrop works, video card is disabled coming-soon without fake whisper, and no horizontal overflow at 360/700/1280 in EN and FA', async ({ app, files }) => {
      const { page } = app;
      await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));

      // Header exists with title and subtitle
      await expect(page.locator('.sub-page-title')).toHaveText('Subtitles');
      await expect(page.locator('.sub-page-sub')).toBeVisible();
      // Subtitle only mentions supported formats .srt and .vtt, not .ass
      const subText = await page.locator('.sub-page-sub').textContent();
      expect(subText).toContain('.srt');
      expect(subText).toContain('.vtt');
      expect(subText).not.toContain('.ass');

      // Card 1: format chips only for supported formats
      const chips = page.locator('#sDrop .sub-chip');
      await expect(chips).toHaveCount(2);
      await expect(chips.nth(0)).toHaveText('SRT');
      await expect(chips.nth(1)).toHaveText('VTT');

      // Card 2: honest coming soon, disabled button, no Whisper claim
      const videoCard = page.locator('#sVideoCard');
      await expect(videoCard).toBeVisible();
      await expect(videoCard.locator('.sub-coming-soon-badge')).toContainText(/coming soon/i);
      await expect(videoCard.locator('button')).toBeDisabled();
      const videoCardText = await videoCard.textContent();
      expect(videoCardText).not.toMatch(/whisper/i);

      // Verify no horizontal overflow at 360, 700, 1280 in English and Persian
      for (const lang of ['en', 'fa']) {
        if (lang === 'fa') {
          await page.evaluate(() => {
            ui = 'fa';
            document.documentElement.dir = 'rtl';
            document.documentElement.lang = 'fa';
            applyI18n();
          });
        }
        for (const w of [360, 700, 1280]) {
          await page.setViewportSize({ width: w, height: 800 });
          const dropBox = await page.locator('#sDrop').boundingBox();
          const strongBox = await page.locator('#sDrop strong').boundingBox();
          const videoBox = await page.locator('#sVideoCard').boundingBox();
          expect(dropBox, `sDrop exists at ${w}px in ${lang}`).toBeTruthy();
          expect(dropBox.x).toBeGreaterThanOrEqual(0);
          expect(dropBox.x + dropBox.width).toBeLessThanOrEqual(w + 1);
          expect(strongBox.x).toBeGreaterThanOrEqual(dropBox.x);
          expect(strongBox.x + strongBox.width).toBeLessThanOrEqual(dropBox.x + dropBox.width + 1);
          expect(videoBox.x).toBeGreaterThanOrEqual(0);
          expect(videoBox.x + videoBox.width).toBeLessThanOrEqual(w + 1);
        }
      }

      // Switch back to English and open a real file: #sDrop works, entry cards hide, #sWork shows
      await page.setViewportSize({ width: 1024, height: 800 });
      await page.evaluate(() => {
        ui = 'en';
        document.documentElement.dir = 'ltr';
        document.documentElement.lang = 'en';
        applyI18n();
      });
      await chooseFile(page, page.locator('#sDrop'), files.srt);
      await expect(page.locator('#sWork')).toBeVisible();
      await expect(page.locator('#sDrop')).toBeHidden();
      await expect(page.locator('#sVideoCard')).toBeHidden();
    });
  });

  test.describe('Item 2: File bar after file load', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

    test('shows cue count and file name; sGo, sSrt, sVtt exist with preserved IDs; export keeps identical timings', async ({ app, files }) => {
      const { page } = app;
      await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
      await chooseFile(page, page.locator('#sDrop'), files.srt);

      // Workspace is visible
      await expect(page.locator('#sWork')).toBeVisible();

      // File name is shown in bar
      await expect(page.locator('#sFileName')).toContainText('sample');
      // Cue count is shown in bar
      await expect(page.locator('#sCuesCount')).toContainText('5');
      // sInfo preserves exact line count
      await expect(page.locator('#sInfo')).toHaveText('sample · 0/5 lines');

      // Action controls are present with preserved IDs
      await expect(page.locator('#sGo')).toBeVisible();
      await expect(page.locator('#sRest')).toBeVisible();
      await expect(page.locator('#sSrt')).toBeVisible();
      await expect(page.locator('#sVtt')).toBeVisible();
      await expect(page.locator('#subStyle')).toBeVisible();
      await expect(page.locator('#sBi')).toBeAttached();

      // Translate file
      await mouseClick(page, page.locator('#sGo'));
      await expect(page.locator('#sInfo')).toHaveText('sample · 5/5 lines');

      // Download SRT and check timings identical to source
      const srt = await downloadOf(page, () => mouseClick(page, page.locator('#sSrt')));
      expect(srt.name).toBe('sample.fa.srt');
      expect(srt.bytes.toString('utf8')).toContain('00:00:01,000 --> 00:00:03,500');
      expect(srt.bytes.toString('utf8')).toContain('01:02:03,004 --> 01:02:05,006');

      // Download VTT and check timings identical (with dot separator)
      const vtt = await downloadOf(page, () => mouseClick(page, page.locator('#sVtt')));
      expect(vtt.name).toBe('sample.fa.vtt');
      expect(vtt.bytes.toString('utf8')).toContain('00:00:01.000 --> 00:00:03.500');
      expect(vtt.bytes.toString('utf8')).toContain('01:02:03.004 --> 01:02:05.006');
    });
  });

  test.describe('Item 3: Progress strip counters and translation memory', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), src: 'en', tgt: 'fa' } } });

    test('counters match real translated lines, and memory count appears only after a real memory hit', async ({ app, files, stub }) => {
      const { page } = app;
      // Start with clean translation memory
      await page.evaluate(async () => {
        if (window.TranslationMemory) {
          await window.TranslationMemory.clear();
        }
      });

      await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
      await chooseFile(page, page.locator('#sDrop'), files.srt);
      await expect(page.locator('#sWork')).toBeVisible();

      // Initial progress: 0 of 5, 0%, no memory count
      await expect(page.locator('#sBar')).toHaveCSS('width', '0px');
      await expect(page.locator('#sProgText')).toContainText('0 of 5');
      await expect(page.locator('#sProgText')).not.toContainText('from memory');

      // First run: fresh translation (no memory hits)
      await mouseClick(page, page.locator('#sGo'));
      await expect(page.locator('#sInfo')).toHaveText('sample · 5/5 lines');
      await expect(page.locator('#sBar')).toHaveCSS('width', /.+px/);
      await expect(page.locator('#sProgText')).toContainText('5 of 5');
      await expect(page.locator('#sProgText')).not.toContainText('from memory');
      await expect(page.locator('#sStatusText')).toHaveText('Ready');

      // Second run on same file: all 5 lines hit memory
      stub.clearLog();
      await mouseClick(page, page.locator('#sGo'));
      await expect(page.locator('#sInfo')).toHaveText('sample · 5/5 lines');

      // Zero network engine calls occurred on second run
      const calls = stub.calls('clients5.google.com');
      expect(calls.length).toBe(0);

      // Now "from memory" counter appears because there were real memory hits
      await expect(page.locator('#sProgText')).toContainText('5 of 5');
      await expect(page.locator('#sProgText')).toContainText('from memory');
    });
  });

  test.describe('Item 4: Subtitle table with sticky header, editable RTL cells, and memory badges', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), src: 'en', tgt: 'fa' } } });

    test.beforeEach(async ({ app }) => {
      const { page } = app;
      await page.evaluate(async () => {
        if (window.TranslationMemory) {
          await window.TranslationMemory.clear();
        }
      });
    });

    test('editing a line is kept in export, Persian cells are dir="rtl", and memory badge appears only on rows from memory', async ({ app, files }) => {
      const { page } = app;

      // 1. Pre-populate TranslationMemory with ONLY the first cue's text ('Hello there.')
      await page.evaluate(async () => {
        await window.TranslationMemory.put({
          sourceText: 'Hello there.',
          translatedText: '[fa] Hello there.',
          src: 'en',
          tgt: 'fa',
          modeClass: 'fast',
          tone: '',
          subject: '',
          subStyle: 'film'
        });
      });

      await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
      await chooseFile(page, page.locator('#sDrop'), files.srt);
      await expect(page.locator('#sWork')).toBeVisible();

      // Check sticky header presence
      const header = page.locator('#cues .cues-header');
      await expect(header).toBeVisible();
      await expect(header.locator('.tm')).toHaveText('Time');
      await expect(header.locator('.o')).toContainText('English');
      await expect(header.locator('.tr-hdr')).toContainText('Persian');

      // Translate subtitles: cue 0 will hit memory, cue 1+ will be translated by google
      await mouseClick(page, page.locator('#sGo'));
      await expect(page.locator('#sInfo')).toHaveText('sample · 5/5 lines');

      // Verify row 0 has memory badge visible
      const badge0 = page.locator('#cues .cue[data-i="0"] .cue-tm-badge');
      await expect(badge0).toBeVisible();
      await expect(badge0).toHaveText(/memory|حافظه/);

      // Verify row 1 does NOT have memory badge visible (freshly translated by engine)
      const badge1 = page.locator('#cues .cue[data-i="1"] .cue-tm-badge');
      await expect(badge1).toBeHidden();

      // Persian translation cells have dir="rtl"
      const cue0Tr = page.locator('#cues .tr[data-i="0"]');
      await expect(cue0Tr).toHaveAttribute('dir', 'rtl');

      // Edit line 4 (data-i="3") with keyboard
      const cue4 = page.locator('#cues .tr[data-i="3"]');
      await mouseClick(page, cue4);
      await page.keyboard.press('Control+A');
      await page.keyboard.type('Hand edited line 4');
      await expect(cue4).toHaveText('Hand edited line 4');

      // Export SRT and verify edited line is kept in export
      const srt = await downloadOf(page, () => mouseClick(page, page.locator('#sSrt')));
      expect(srt.name).toBe('sample.fa.srt');
      const srtText = srt.bytes.toString('utf8');
      expect(srtText).toContain('Hand edited line 4');
      expect(srtText).toContain('[fa] Hello there.');

      // Export VTT and verify edited line is kept in export
      const vtt = await downloadOf(page, () => mouseClick(page, page.locator('#sVtt')));
      expect(vtt.name).toBe('sample.fa.vtt');
      const vttText = vtt.bytes.toString('utf8');
      expect(vttText).toContain('Hand edited line 4');
    });
  });

  test.describe('Item 3: All counters agree on file with blank cue and repeated line', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), src: 'en', tgt: 'fa' } } });

    test.beforeEach(async ({ app }) => {
      const { page } = app;
      await page.evaluate(async () => {
        if (window.TranslationMemory) {
          await window.TranslationMemory.clear();
        }
      });
    });

    test('file bar, sInfo, sProgText, table rows, and export all agree on cue count', async ({ app }) => {
      const { page } = app;

      // Fixture with Cue 1 (valid), Cue 2 (blank cue with timing but no text), Cue 3 (repeated text)
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'makan-sub-agree-'));
      const srtPath = path.join(tmpDir, 'agree.srt');
      const srtContent = [
        '1',
        '00:00:01,000 --> 00:00:02,000',
        'Welcome to the show.',
        '',
        '2',
        '00:00:03,000 --> 00:00:04,000',
        '',
        '3',
        '00:00:05,000 --> 00:00:06,000',
        'Welcome to the show.',
        ''
      ].join('\r\n');
      fs.writeFileSync(srtPath, srtContent, 'utf8');

      await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
      await chooseFile(page, page.locator('#sDrop'), srtPath);
      await expect(page.locator('#sWork')).toBeVisible();

      // On load: blank cue is ignored by parser, so exactly 2 cues exist
      await expect(page.locator('#sCuesCount')).toHaveText('2 cues');
      await expect(page.locator('#sInfo')).toHaveText('agree · 0/2 lines');
      await expect(page.locator('#sProgText')).toContainText('0 of 2');
      await expect(page.locator('#cues .cue')).toHaveCount(2);

      // Translate
      await mouseClick(page, page.locator('#sGo'));

      // First run: both lines sent to engine since memory is populated after batch ends
      await expect(page.locator('#sCuesCount')).toHaveText('2 cues');
      await expect(page.locator('#sInfo')).toHaveText('agree · 2/2 lines');
      await expect(page.locator('#sProgText')).toContainText('2 of 2');
      await expect(page.locator('#sProgText')).not.toContainText('from memory');
      await expect(page.locator('#sStatusText')).toHaveText('Ready');
      await expect(page.locator('#cues .cue')).toHaveCount(2);
      await expect(page.locator('#cues .cue[data-i="0"] .cue-tm-badge')).toBeHidden();
      await expect(page.locator('#cues .cue[data-i="1"] .cue-tm-badge')).toBeHidden();

      // Second run on same file: lines are now served from translation memory
      await mouseClick(page, page.locator('#sGo'));
      await expect(page.locator('#sCuesCount')).toHaveText('2 cues');
      await expect(page.locator('#sInfo')).toHaveText('agree · 2/2 lines');
      await expect(page.locator('#sProgText')).toContainText('2 of 2');
      await expect(page.locator('#sProgText')).toContainText('from memory');
      await expect(page.locator('#cues .cue[data-i="0"] .cue-tm-badge')).toBeVisible();
      await expect(page.locator('#cues .cue[data-i="1"] .cue-tm-badge')).toBeVisible();

      // Export: exactly 2 cues in downloaded file
      const srt = await downloadOf(page, () => mouseClick(page, page.locator('#sSrt')));
      expect(srt.name).toBe('agree.fa.srt');
      const lines = srt.bytes.toString('utf8').trim().split(/\r?\n\r?\n/);
      expect(lines).toHaveLength(2);

      // Clean up tmp
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    });
  });

  test.describe('Item 3: Failed batch handling', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), src: 'en', tgt: 'fa' } } });

    test('failed lines are not counted as translated, status shows Error, and progress text does not say 100%', async ({ app, files, stub }) => {
      const { page } = app;
      await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
      await chooseFile(page, page.locator('#sDrop'), files.srt);
      await expect(page.locator('#sWork')).toBeVisible();

      // Pre-save cue 0 into translation memory so 1 cue succeeds from memory while engine batch fails
      await page.evaluate(async () => {
        if (window.TranslationMemory) {
          await window.TranslationMemory.clear();
          await window.TranslationMemory.put({
            sourceText: 'Hello there.',
            translatedText: '[fa] Hello there.',
            src: 'en',
            tgt: 'fa',
            modeClass: 'fast',
            tone: '',
            subject: '',
            subStyle: 'film'
          });
        }
      });

      // Force Google endpoint to fail
      stub.failHost('clients5.google.com', 500);

      // Translate
      await mouseClick(page, page.locator('#sGo'));

      // Error status is shown
      await expect(page.locator('#sStatusText')).toHaveText('Error');
      await expect(page.locator('#sStatusChip')).toHaveClass(/error/);

      // Failed lines are NOT counted as translated: 1 translated of 5 lines (20%)
      await expect(page.locator('#sInfo')).toHaveText('sample · 1/5 lines');
      await expect(page.locator('#sProgText')).toContainText('1 of 5');
      await expect(page.locator('#sProgText')).toContainText('20%');
      await expect(page.locator('#sProgText')).not.toContainText('100%');

      // Failed row has empty translation and not counted
      await expect(page.locator('#cues .tr[data-i="0"]')).toHaveText('[fa] Hello there.');
      await expect(page.locator('#cues .tr[data-i="1"]')).toHaveText('');
    });
  });
});


