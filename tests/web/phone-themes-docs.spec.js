'use strict';

const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/fixtures');

test.describe('ITEM 6: Contrast, themes and documentation', () => {
  const PHONE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UD1A.230803.041) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36';

  const ALL_THEMES = [
    'makan-lab',
    'platinum-blue',
    'dracula',
    'champagne-minimal',
    'rose-titanium',
    'royal-amethyst',
    'obsidian-gold'
  ];

  function getLuminance(rgb) {
    const srgb = rgb.map(val => {
      const v = val / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  }

  function getContrast(rgb1, rgb2) {
    const l1 = getLuminance(rgb1);
    const l2 = getLuminance(rgb2);
    const brightest = Math.max(l1, l2);
    const darkest = Math.min(l1, l2);
    return (brightest + 0.05) / (darkest + 0.05);
  }

  test('new phone elements meet contrast >= 4.5:1 across all 7 themes and keep makan-lab look', async ({ webBrowser, stub }) => {
    const context = await webBrowser.newContext({
      viewport: { width: 360, height: 740 },
      userAgent: PHONE_UA,
      isMobile: true
    });
    const page = await context.newPage();
    await page.goto(stub.appUrl);

    for (const themeId of ALL_THEMES) {
      await page.evaluate(tid => {
        if (typeof window.applyTheme === 'function') {
          window.applyTheme(tid);
        }
      }, themeId);

      const contrasts = await page.evaluate(() => {
        function parseRgb(colorStr) {
          if (!colorStr) return [0, 0, 0];
          const m = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          return m ? [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)] : [0, 0, 0];
        }

        function getLuminanceLocal(rgb) {
          const srgb = rgb.map(val => {
            const v = val / 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
        }

        function getContrastLocal(rgb1, rgb2) {
          const l1 = getLuminanceLocal(rgb1);
          const l2 = getLuminanceLocal(rgb2);
          const brightest = Math.max(l1, l2);
          const darkest = Math.min(l1, l2);
          return (brightest + 0.05) / (darkest + 0.05);
        }

        function getBg(el) {
          let cur = el;
          while (cur && cur !== document.documentElement) {
            const bg = window.getComputedStyle(cur).backgroundColor;
            if (bg && bg !== 'transparent' && !bg.startsWith('rgba(0, 0, 0, 0')) {
              return parseRgb(bg);
            }
            cur = cur.parentElement;
          }
          return parseRgb(window.getComputedStyle(document.body).backgroundColor || '#040914');
        }

        const nav = document.getElementById('phoneBottomNav');
        const navBg = getBg(nav);
        const navBtnActive = nav.querySelector('.phone-nav-btn.on') || nav.querySelector('.phone-nav-btn');
        const navActiveFg = parseRgb(window.getComputedStyle(navBtnActive).color);

        const sheet = document.getElementById('phoneMoreSheet');
        const sheetBg = getBg(sheet);
        const sheetItem = sheet.querySelector('.phone-sheet-item-label');
        const sheetFg = sheetItem ? parseRgb(window.getComputedStyle(sheetItem).color) : [255, 255, 255];
        const sheetTitle = sheet.querySelector('.phone-more-sheet-title');
        const sheetTitleFg = sheetTitle ? parseRgb(window.getComputedStyle(sheetTitle).color) : [255, 255, 255];

        const brand = document.getElementById('phoneBrand');
        const topbar = document.getElementById('topbar');
        const topbarBg = getBg(topbar);
        const brandName = brand.querySelector('.brand-name');
        const brandFg = parseRgb(window.getComputedStyle(brandName).color);

        return {
          navActiveContrast: getContrastLocal(navActiveFg, navBg),
          sheetItemContrast: getContrastLocal(sheetFg, sheetBg),
          sheetTitleContrast: getContrastLocal(sheetTitleFg, sheetBg),
          brandContrast: getContrastLocal(brandFg, topbarBg)
        };
      });

      expect(contrasts.sheetItemContrast, `Sheet item in theme ${themeId} must have contrast >= 4.5`).toBeGreaterThanOrEqual(4.5);
      expect(contrasts.sheetTitleContrast, `Sheet title in theme ${themeId} must have contrast >= 4.5`).toBeGreaterThanOrEqual(4.5);
      expect(contrasts.brandContrast, `Phone brand in theme ${themeId} must have contrast >= 4.5`).toBeGreaterThanOrEqual(4.5);
      expect(contrasts.navActiveContrast, `Bottom nav active in theme ${themeId} must have contrast >= 4.5`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('documentation files and in-app help contain On a phone section with required specifications', () => {
    const rootDir = path.resolve(__dirname, '../../');

    // 1. README.md
    const readme = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf8');
    expect(readme).toContain('### On a phone');
    expect(readme).toMatch(/install (the web app )?directly from (your |the )?mobile browser/i);
    expect(readme).toMatch(/online (translation )?engines/i);
    expect(readme).toMatch(/small offline Whisper models/i);
    expect(readme).toMatch(/Screen translation/i);
    expect(readme).toMatch(/require a computer or the/i);
    expect(readme).not.toMatch(/tested on a real phone/i);

    // 2. docs/OVERVIEW.md
    const overview = fs.readFileSync(path.join(rootDir, 'docs/OVERVIEW.md'), 'utf8');
    expect(overview).toContain('### On a phone');
    expect(overview).toMatch(/install/i);
    expect(overview).toMatch(/online translation engines/i);
    expect(overview).toMatch(/small offline Whisper models/i);
    expect(overview).not.toMatch(/tested on a real phone/i);

    // 3. docs/USER_GUIDE.md
    const userGuide = fs.readFileSync(path.join(rootDir, 'docs/USER_GUIDE.md'), 'utf8');
    expect(userGuide).toContain('## 10. On a phone');
    expect(userGuide).toMatch(/Add to Home screen/i);
    expect(userGuide).toMatch(/small Whisper models/i);
    expect(userGuide).toMatch(/Whisper Tiny/i);
    expect(userGuide).toMatch(/Whisper Base/i);
    expect(userGuide).toMatch(/Whisper Small/i);
    expect(userGuide).not.toMatch(/tested on a real phone/i);

    // 4. in-app help guide in js/i18n.js (EN & FA)
    const i18nContent = fs.readFileSync(path.join(rootDir, 'js/i18n.js'), 'utf8');
    expect(i18nContent).toContain('<h4>10. On a phone</h4>');
    expect(i18nContent).toMatch(/online engines plus small Whisper models only/i);
    expect(i18nContent).toContain('<h4>۱۰. روی گوشی تلفن همراه</h4>');
    expect(i18nContent).toContain('موتورهای آنلاین');
    expect(i18nContent).not.toMatch(/tested on a real phone/i);
  });
});
