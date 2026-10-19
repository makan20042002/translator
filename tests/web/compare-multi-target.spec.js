'use strict';

const { test, expect, onlyEngines, mouseClick } = require('../support/fixtures');

test.describe('Web app: Compare tab multi-target language support', () => {
  test.use({
    appOptions: {
      seed: {
        cfg: onlyEngines(['google', 'mymemory'])
      }
    }
  });

  test('two languages x two engines gives four boxes with the right target code in each request', async ({ app }) => {
    const { page, stub, errors } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="cmp"]'));

    // Check engines
    const boxes = page.locator('#cEng input[type=checkbox]');
    await expect(boxes).toHaveCount(2);
    await expect(boxes.nth(0)).toBeChecked();
    await expect(boxes.nth(1)).toBeChecked();

    // Verify source and target controls are present
    const srcSel = page.locator('#cmpSrc');
    await expect(srcSel).toBeVisible();

    // Add a second target language
    const addBtn = page.locator('#cmpAddTgt');
    await expect(addBtn).toBeVisible();
    await mouseClick(page, addBtn);

    const tgtItems = page.locator('#cmpTgtList .cmp-tgt-item');
    await expect(tgtItems).toHaveCount(2);

    // Set first target to 'fa' and second target to 'de'
    const sel0 = tgtItems.nth(0).locator('select');
    const sel1 = tgtItems.nth(1).locator('select');
    await sel0.selectOption('fa');
    await sel1.selectOption('de');

    // Type text and run compare
    await mouseClick(page, page.locator('#cIn'));
    await page.keyboard.type('Hello multi compare world');
    await mouseClick(page, page.locator('#cGo'));

    // Wait until Compare finishes
    await expect(page.locator('#cGo')).toBeEnabled({ timeout: 15_000 });

    // Assert 4 result boxes exist
    const resBoxes = page.locator('#cOut .res');
    await expect(resBoxes).toHaveCount(4);

    // Assert results grouped per target language with heading
    const groupHeadings = page.locator('#cOut .cmp-group-title');
    await expect(groupHeadings).toHaveCount(2);
    await expect(groupHeadings.nth(0)).toContainText('فارسی');
    await expect(groupHeadings.nth(1)).toContainText('Deutsch');

    // Assert Copy all buttons exist per group
    const copyAllBtns = page.locator('#cOut .cmp-copy-all');
    await expect(copyAllBtns).toHaveCount(2);

    // Verify stub calls: Google and MyMemory requests carry both 'fa' and 'de' target codes
    const googleCalls = stub.calls('clients5.google.com');
    expect(googleCalls.length).toBeGreaterThanOrEqual(2);
    const googleTgts = googleCalls.map(c => new URLSearchParams(c.query || c.body).get('tl') || (c.url ? new URL(c.url, 'http://stub').searchParams.get('tl') : null));
    expect(googleTgts).toContain('fa');
    expect(googleTgts).toContain('de');

    const mmCalls = stub.calls('api.mymemory.translated.net');
    expect(mmCalls.length).toBeGreaterThanOrEqual(2);
    const mmPairs = mmCalls.map(c => new URLSearchParams(c.query || c.body).get('langpair') || (c.url ? new URL(c.url, 'http://stub').searchParams.get('langpair') : null));
    expect(mmPairs.some(p => p && p.endsWith('|fa'))).toBe(true);
    expect(mmPairs.some(p => p && p.endsWith('|de'))).toBe(true);

    // Time and char count present in each box
    for (let i = 0; i < 4; i++) {
      const b = resBoxes.nth(i);
      const metaText = await b.locator('.meta').innerText();
      expect(metaText).toMatch(/\d+(\.\d+)?s/i);
      expect(metaText).toMatch(/\d+\s+chars/i);
    }

    expect(errors).toEqual([]);
  });

  test('add and remove language controls respect limit of 3', async ({ app }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="cmp"]'));

    const addBtn = page.locator('#cmpAddTgt');
    const tgtItems = page.locator('#cmpTgtList .cmp-tgt-item');

    // Initially 1 target language
    await expect(tgtItems).toHaveCount(1);
    // Remove button should be hidden or disabled when only 1
    await expect(tgtItems.nth(0).locator('.cmp-del-tgt')).toBeHidden();

    // Add 2nd
    await mouseClick(page, addBtn);
    await expect(tgtItems).toHaveCount(2);
    await expect(tgtItems.nth(0).locator('.cmp-del-tgt')).toBeVisible();
    await expect(tgtItems.nth(1).locator('.cmp-del-tgt')).toBeVisible();

    // Add 3rd
    await mouseClick(page, addBtn);
    await expect(tgtItems).toHaveCount(3);

    // At 3, add button should be hidden or disabled
    await expect(addBtn).toBeHidden();

    // Remove 2nd language
    await mouseClick(page, tgtItems.nth(1).locator('.cmp-del-tgt'));
    await expect(tgtItems).toHaveCount(2);
    await expect(addBtn).toBeVisible();
  });

  test('chosen compare languages persist after page reload', async ({ app }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="cmp"]'));

    // Change source to 'en'
    await page.locator('#cmpSrc').selectOption('en');

    // Set 2 targets: 'fr' and 'es'
    const addBtn = page.locator('#cmpAddTgt');
    const tgtItems = page.locator('#cmpTgtList .cmp-tgt-item');
    if (await tgtItems.count() < 2) {
      await mouseClick(page, addBtn);
    }
    await tgtItems.nth(0).locator('select').selectOption('fr');
    await tgtItems.nth(1).locator('select').selectOption('es');

    // Reload page
    await page.reload();
    await mouseClick(page, page.locator('#tabs button[data-tab="cmp"]'));

    // Assert persistence
    await expect(page.locator('#cmpSrc')).toHaveValue('en');
    const reloadedItems = page.locator('#cmpTgtList .cmp-tgt-item');
    await expect(reloadedItems).toHaveCount(2);
    await expect(reloadedItems.nth(0).locator('select')).toHaveValue('fr');
    await expect(reloadedItems.nth(1).locator('select')).toHaveValue('es');
  });

  test('Compare tab in FA (Persian) with RTL direction and i18n labels', async ({ app }) => {
    const { page } = app;
    // Switch UI language to Persian via language toggle button
    const langBtn = page.locator('#uiLang');
    await mouseClick(page, langBtn);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');

    await mouseClick(page, page.locator('#tabs button[data-tab="cmp"]'));

    // Check Add language button has Persian text
    await expect(page.locator('#cmpAddTgt')).toHaveText('+ افزودن زبان');

    // Run compare
    await mouseClick(page, page.locator('#cIn'));
    await page.keyboard.type('تست مقایسه');
    await mouseClick(page, page.locator('#cGo'));
    await expect(page.locator('#cGo')).toBeEnabled({ timeout: 15_000 });

    // Check Copy all has Persian text
    const copyAllBtn = page.locator('#cOut .cmp-copy-all').first();
    await expect(copyAllBtn).toHaveText('کپی همه');
  });

  test('light themes contrast >= 4.5 and layout at 360px and 1280px', async ({ app }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="cmp"]'));

    // Test viewports: 360px and 1280px
    for (const w of [360, 1280]) {
      await page.setViewportSize({ width: w, height: 700 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      expect(overflow, `No horizontal overflow at ${w}px`).toBe(true);
      await expect(page.locator('#cIn')).toBeVisible();
      await expect(page.locator('#cGo')).toBeVisible();
    }

    // Measure contrast in light theme (e.g. dawn or standard light)
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dawn');
    });

    const contrastOk = await page.evaluate(() => {
      function parseRgb(str) {
        if (!str) return null;
        const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (!m) return null;
        return { r: parseInt(m[1], 10), g: parseInt(m[2], 10), b: parseInt(m[3], 10), a: m[4] !== undefined ? parseFloat(m[4]) : 1 };
      }
      function sRGBtoLin(c) {
        const v = c / 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      }
      function luminance(rgb) {
        return 0.2126 * sRGBtoLin(rgb.r) + 0.7152 * sRGBtoLin(rgb.g) + 0.0722 * sRGBtoLin(rgb.b);
      }
      function contrastRatio(rgb1, rgb2) {
        const l1 = luminance(rgb1), l2 = luminance(rgb2);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      }
      function blend(fg, bg) {
        const a = fg.a;
        return {
          r: Math.round(fg.r * a + bg.r * (1 - a)),
          g: Math.round(fg.g * a + bg.g * (1 - a)),
          b: Math.round(fg.b * a + bg.b * (1 - a)),
          a: 1
        };
      }
      function computeEffectiveBg(el) {
        let cur = el;
        let bg = parseRgb(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
        const path = [];
        while (cur && cur !== document.documentElement) {
          path.unshift(cur);
          cur = cur.parentElement;
        }
        for (const node of path) {
          const cs = getComputedStyle(node);
          const c = parseRgb(cs.backgroundColor);
          if (c && c.a > 0) bg = blend(c, bg);
        }
        return bg;
      }

      const elements = [
        document.querySelector('#cmpAddTgt'),
        document.querySelector('#cGo'),
        document.querySelector('#cmpSrc'),
        document.querySelector('#cIn')
      ].filter(Boolean);

      return elements.every(el => {
        const fg = parseRgb(getComputedStyle(el).color);
        const bg = computeEffectiveBg(el);
        if (!fg || !bg) return true;
        const ratio = contrastRatio(fg, bg);
        return ratio >= 4.5;
      });
    });

    expect(contrastOk).toBe(true);
  });
});
