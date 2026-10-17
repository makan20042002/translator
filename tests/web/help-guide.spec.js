'use strict';

/**
 * tests/web/help-guide.spec.js
 * Validates the capability, limits, and hardware guide (ITEM 4b):
 * - The Help section exists in #creditsBox in both English and Persian.
 * - Every model name in the hardware table exists in models-catalog.js.
 * - Every size shown equals the catalog value formatted the same way (mcSize).
 * - No number appears for speed ("speed not measured yet" placeholder).
 * - docs/USER_GUIDE.md exists and mentions all tabs in the real #tabs list.
 * - README.md links to docs/USER_GUIDE.md.
 */

const { test, expect } = require('../support/fixtures');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// Read models-catalog.js to verify model names and sizes
const catalogPath = path.join(REPO_ROOT, 'models-catalog.js');
const catalogCode = fs.readFileSync(catalogPath, 'utf-8');
const sandbox = { self: {} };
new Function('self', catalogCode)(sandbox.self);
const catalog = sandbox.self.MODEL_CATALOG;

const mcSize = b => b <= 0 ? '0 MB' : b >= 1073741824 ? (b / 1073741824).toFixed(1) + ' GB' : Math.max(1, Math.round(b / 1048576)) + ' MB';

test.describe('Help & User Guide (ITEM 4b)', () => {
  test('docs/USER_GUIDE.md exists, links from README.md, and mentions all real tabs', () => {
    const guidePath = path.join(REPO_ROOT, 'docs', 'USER_GUIDE.md');
    expect(fs.existsSync(guidePath), 'docs/USER_GUIDE.md must exist').toBe(true);

    const guideContent = fs.readFileSync(guidePath, 'utf-8');

    // Read real tabs list from index.html
    const indexPath = path.join(REPO_ROOT, 'index.html');
    const indexHtml = fs.readFileSync(indexPath, 'utf-8');
    const tabMatches = Array.from(indexHtml.matchAll(/data-tab=["']([^"']+)["']/g)).map(m => m[1]);
    const uniqueTabs = Array.from(new Set(tabMatches));
    expect(uniqueTabs.length).toBeGreaterThanOrEqual(13);

    for (const tab of uniqueTabs) {
      expect(guideContent, `docs/USER_GUIDE.md must mention tab: ${tab}`).toContain(tab);
    }

    // Verify README.md links to docs/USER_GUIDE.md
    const readmeContent = fs.readFileSync(path.join(REPO_ROOT, 'README.md'), 'utf-8');
    expect(readmeContent).toContain('docs/USER_GUIDE.md');
  });

  test('docs/USER_GUIDE.md hardware table uses real catalog models, sizes, and has no speed numbers', () => {
    const guidePath = path.join(REPO_ROOT, 'docs', 'USER_GUIDE.md');
    const guideContent = fs.readFileSync(guidePath, 'utf-8');

    // Expected models in the table
    const tableModels = [
      'Whisper Tiny',
      'Whisper Base',
      'Whisper Small',
      'Whisper Large v3 Turbo',
      'NLLB-200 600M (default)',
      'M2M-100 418M',
      'mBART-50 many-to-many',
      'OPUS-MT EN → AR'
    ];

    for (const name of tableModels) {
      const foundInCatalog = catalog.models.some(m => m.name === name);
      expect(foundInCatalog, `Model "${name}" must exist in models-catalog.js`).toBe(true);
      expect(guideContent, `docs/USER_GUIDE.md must include model "${name}"`).toContain(name);

      // Verify size shown matches catalog formatted size
      const catModel = catalog.models.find(m => m.name === name);
      const expectedSize = mcSize(catModel.bytes);
      expect(guideContent, `Size ${expectedSize} for ${name} must appear in guide`).toContain(expectedSize);
    }

    // Verify speed has no numeric values, only "speed not measured yet"
    expect(guideContent).toContain('speed not measured yet');
    expect(guideContent).toContain('Measured on:');

    // Speed section must not contain numeric speeds like "0.43" or "7.46" or "12 s"
    const speedLines = guideContent.split('\n').filter(l => l.includes('Speed:'));
    for (const line of speedLines) {
      expect(line).not.toMatch(/\b\d+(\.\d+)?\s*(s|sec|seconds|x)\b/i);
    }
  });

  test('Help window section exists in UI with hardware table in both EN and FA', async ({ app }) => {
    const { page } = app;

    // --- 1. Test in English ---
    await page.locator('#creditsBtn').click();
    await expect(page.locator('#creditsBox')).toBeVisible();

    const helpSection = page.locator('#helpGuideSection');
    await expect(helpSection).toBeVisible();

    const titleEn = page.locator('#helpGuideTitle');
    await expect(titleEn).toHaveText('What it can do, limits, and what computer you need');

    const helpHtml = await page.locator('#helpGuideContent').innerHTML();

    // Verify model names exist in models-catalog.js
    const requiredModels = [
      'Whisper Tiny',
      'Whisper Base',
      'Whisper Small',
      'Whisper Large v3 Turbo',
      'NLLB-200 600M (default)',
      'M2M-100 418M',
      'mBART-50 many-to-many',
      'OPUS-MT EN → AR'
    ];

    for (const name of requiredModels) {
      expect(catalog.models.some(m => m.name === name)).toBe(true);
      expect(helpHtml).toContain(name);

      const catModel = catalog.models.find(m => m.name === name);
      const expectedSize = mcSize(catModel.bytes);
      expect(helpHtml).toContain(expectedSize);
    }

    // Verify no number appears for speed
    expect(helpHtml).toContain('speed not measured yet');
    expect(helpHtml).toContain('Measured on:');

    // Close credits
    await page.locator('#creditsClose').click();
    await expect(page.locator('#creditsBox')).toBeHidden();

    // --- 2. Switch to Persian (FA) via toggle button ---
    await page.locator('#uiLang').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('#uiLang')).toHaveText('English');

    await page.locator('#creditsBtn').click();
    await expect(page.locator('#creditsBox')).toBeVisible();
    await expect(page.locator('#helpGuideSection')).toBeVisible();

    const titleFa = page.locator('#helpGuideTitle');
    await expect(titleFa).toHaveText('قابلیت‌ها، محدودیت‌ها و سخت‌افزار مورد نیاز');

    const helpHtmlFa = await page.locator('#helpGuideContent').innerHTML();

    for (const name of requiredModels) {
      expect(helpHtmlFa).toContain(name);
      const catModel = catalog.models.find(m => m.name === name);
      const expectedSize = mcSize(catModel.bytes);
      expect(helpHtmlFa).toContain(expectedSize);
    }

    expect(helpHtmlFa).toContain('speed not measured yet');
    expect(helpHtmlFa).toContain('Measured on:');

    await page.locator('#creditsClose').click();
    await expect(page.locator('#creditsBox')).toBeHidden();

    // --- 3. Switch back to English and verify ---
    await page.locator('#uiLang').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('#uiLang')).toHaveText('فارسی');

    await page.locator('#creditsBtn').click();
    await expect(page.locator('#creditsBox')).toBeVisible();
    await expect(page.locator('#helpGuideSection')).toBeVisible();
    await expect(page.locator('#helpGuideTitle')).toHaveText('What it can do, limits, and what computer you need');
    await page.locator('#creditsClose').click();
    await expect(page.locator('#creditsBox')).toBeHidden();
  });
});
