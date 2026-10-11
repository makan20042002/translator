'use strict';
/**
 * Test for Fonts and Logo Offline Verification:
 * - Vazirmatn woff2 font and SIL OFL licence exist locally under fonts/
 * - Page loads with zero requests to external font CDNs (fonts.googleapis.com / fonts.gstatic.com)
 * - Page favicon is linked to brand SVG artwork
 */
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/fixtures');

const ROOT = path.resolve(__dirname, '../..');

test.describe('Web app: Fonts and logo offline', () => {
  test('Vazirmatn font and OFL licence file exist locally on disk', () => {
    const fontPath = path.join(ROOT, 'fonts', 'Vazirmatn.woff2');
    const oflPath = path.join(ROOT, 'fonts', 'OFL.txt');

    expect(fs.existsSync(fontPath), 'fonts/Vazirmatn.woff2 must exist').toBe(true);
    expect(fs.statSync(fontPath).size, 'fonts/Vazirmatn.woff2 must be a non-empty font file').toBeGreaterThan(10000);
    expect(fs.existsSync(oflPath), 'fonts/OFL.txt licence must exist').toBe(true);
  });

  test('no external font or CDN request is made when loading the page', async ({ app }) => {
    const { page } = app;
    const requestedUrls = [];

    page.on('request', req => {
      requestedUrls.push(req.url());
    });

    await page.reload();
    await page.waitForTimeout(500);

    const externalFontRequests = requestedUrls.filter(u => {
      const parsed = new URL(u);
      return parsed.hostname.includes('fonts.googleapis.com') ||
             parsed.hostname.includes('fonts.gstatic.com') ||
             parsed.hostname.includes('typekit') ||
             parsed.hostname.includes('cdnjs');
    });

    expect(externalFontRequests, 'must make zero external font requests').toEqual([]);
  });

  test('favicon links point to brand vector artwork', async ({ app }) => {
    const { page } = app;
    const iconHref = await page.locator('link[rel="icon"]').getAttribute('href');
    expect(iconHref, 'favicon points to brand SVG').toBe('brand/makanlab-square-icon.svg');
    expect(fs.existsSync(path.join(ROOT, iconHref)), 'favicon file exists on disk').toBe(true);
  });
});
