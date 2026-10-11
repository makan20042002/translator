'use strict';
/**
 * Guard test for index.html split architecture:
 * 1. Every local <script src> and <link href> in index.html exists on disk and is in sw.js precache list.
 * 2. The web page loads with zero page errors and zero console errors.
 * 3. Required global names exist and are accessible in the page scope (store, pickTr, mcReady, L, esc).
 */
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/fixtures');

const ROOT = path.resolve(__dirname, '../..');

test.describe('Web app: split-guard architecture', () => {
  test('every <script src> and <link href> in index.html exists on disk and is in sw.js precache list', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

    // Extract SHELL array from sw.js
    const shellMatch = sw.match(/const\s+SHELL\s*=\s*\[([\s\S]*?)\];/);
    expect(shellMatch, 'sw.js must define SHELL precache array').toBeTruthy();
    const precacheList = shellMatch[1]
      .split(',')
      .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
      .map(p => p.replace(/^\.\//, ''));

    // 1. Check all <link rel="stylesheet" href="...">
    const linkMatches = [...html.matchAll(/<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi)];
    expect(linkMatches.length, 'index.html should have stylesheet links').toBeGreaterThan(0);

    for (const match of linkMatches) {
      const href = match[1];
      if (/^https?:\/\//i.test(href)) continue; // external CDN (if any)
      const normalizedPath = href.replace(/^\.\//, '');
      const filePath = path.join(ROOT, normalizedPath);
      expect(fs.existsSync(filePath), `CSS file ${href} exists on disk`).toBe(true);
      expect(precacheList.includes(normalizedPath), `CSS file ${href} is in sw.js precache list`).toBe(true);
    }

    // 2. Check all <script src="...">
    const scriptMatches = [...html.matchAll(/<script\s+[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi)];
    expect(scriptMatches.length, 'index.html should have script tags').toBeGreaterThan(0);

    for (const match of scriptMatches) {
      const src = match[1];
      if (/^https?:\/\//i.test(src)) continue; // external CDN scripts like jszip
      const normalizedPath = src.replace(/^\.\//, '');
      const filePath = path.join(ROOT, normalizedPath);
      expect(fs.existsSync(filePath), `Script file ${src} exists on disk`).toBe(true);
      expect(precacheList.includes(normalizedPath), `Script file ${src} is in sw.js precache list`).toBe(true);
    }
  });

  test('the page loads with zero page errors and zero console errors, and critical globals exist', async ({ app }) => {
    const { page, errors } = app;

    // Track uncaught page errors
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    // Reload page to observe fresh boot with zero errors
    await page.reload();
    await page.waitForTimeout(500);

    // Verify key globals exist in global/window scope
    const globals = await page.evaluate(() => ({
      hasStore: typeof store !== 'undefined' && store !== null,
      hasPickTr: typeof pickTr === 'function',
      hasMcReady: typeof mcReady === 'function',
      hasL: typeof L === 'function',
      hasEsc: typeof esc === 'function'
    }));

    expect(globals.hasStore, 'store exists in page scope').toBe(true);
    expect(globals.hasPickTr, 'pickTr exists in page scope').toBe(true);
    expect(globals.hasMcReady, 'mcReady exists in page scope').toBe(true);
    expect(globals.hasL, 'L exists in page scope').toBe(true);
    expect(globals.hasEsc, 'esc exists in page scope').toBe(true);

    expect(pageErrors, 'zero page errors on load').toEqual([]);
    expect(errors, 'zero console errors on load').toEqual([]);
  });
});
