'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { test, expect, mouseClick, chooseFile, downloadOf, onlyEngines } = require('../support/fixtures');

test.describe('Web app: Document tab redesign', () => {
  test.describe('Item 1: Header and drop area', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

    test('header exists, #dDrop works, chips match the 7 real supported formats (no PDF), and no horizontal overflow at 360/700/1280 in EN and FA', async ({ app, files }) => {
      const { page } = app;
      await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

      // Header exists with title and subtitle
      await expect(page.locator('.doc-page-title')).toHaveText('Documents');
      await expect(page.locator('.doc-page-sub')).toBeVisible();

      // Subtitle only mentions supported formats, never "keep the layout" or "PDF"
      const subText = await page.locator('.doc-page-sub').textContent();
      expect(subText).toContain('Word');
      expect(subText).toContain('PowerPoint');
      expect(subText).toContain('Excel');
      expect(subText).toContain('Markdown');
      expect(subText).toContain('CSV');
      expect(subText).toContain('JSON');
      expect(subText).not.toMatch(/keep the layout/i);
      expect(subText).not.toMatch(/\bpdf\b/i);

      // Chips list ONLY the 7 formats the app really reads today: DOCX, PPTX, XLSX, TXT, MD, CSV, JSON
      const chips = page.locator('#dDrop .doc-chip');
      await expect(chips).toHaveCount(7);
      const chipTexts = (await chips.allTextContents()).map(s => s.trim());
      expect(chipTexts).toEqual(['DOCX', 'PPTX', 'XLSX', 'TXT', 'MD', 'CSV', 'JSON']);
      expect(chipTexts).not.toContain('PDF');

      // Verify no horizontal overflow at 360, 700, 1280 in English and Persian
      for (const lang of ['en', 'fa']) {
        if (lang === 'fa') {
          await page.evaluate(() => {
            ui = 'fa';
            document.documentElement.dir = 'rtl';
            document.documentElement.lang = 'fa';
            applyI18n();
          });
          await expect(page.locator('.doc-page-title')).toHaveText('اسناد');
          const faSub = await page.locator('.doc-page-sub').textContent();
          expect(faSub).not.toContain('PDF');
          expect(faSub).not.toContain('حفظ چیدمان');
        } else {
          await page.evaluate(() => {
            ui = 'en';
            document.documentElement.dir = 'ltr';
            document.documentElement.lang = 'en';
            applyI18n();
          });
        }
        for (const w of [360, 700, 1280]) {
          await page.setViewportSize({ width: w, height: 800 });
          const dropBox = await page.locator('#dDrop').boundingBox();
          const strongBox = await page.locator('#dDrop strong').boundingBox();
          expect(dropBox, `dDrop exists at ${w}px in ${lang}`).toBeTruthy();
          expect(dropBox.x).toBeGreaterThanOrEqual(0);
          expect(dropBox.x + dropBox.width).toBeLessThanOrEqual(w + 1);
          expect(strongBox.x).toBeGreaterThanOrEqual(dropBox.x);
          expect(strongBox.x + strongBox.width).toBeLessThanOrEqual(dropBox.x + dropBox.width + 1);

          const { scrollWidth, clientWidth } = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth
          }));
          expect(scrollWidth, `no horizontal scroll at ${w}px in ${lang}`).toBeLessThanOrEqual(clientWidth + 1);
        }
      }

      // Restore LTR English state and test that #dDrop works with a real file
      await page.setViewportSize({ width: 1024, height: 800 });
      await page.evaluate(() => {
        ui = 'en';
        document.documentElement.dir = 'ltr';
        document.documentElement.lang = 'en';
        applyI18n();
      });
      await chooseFile(page, page.locator('#dDrop'), files.txt);
      await expect(page.locator('#dWork')).toBeVisible();
    });
  });
});
