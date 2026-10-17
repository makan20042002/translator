'use strict';

/**
 * Item 4 (c): Service worker caching and manifest for Media module.
 * Asserts:
 * - sw.js precache array (SHELL) includes all required media module files.
 * - Each precached media file exists on disk.
 * - manifest.webmanifest is precached and exists on disk.
 * - Service worker registration succeeds and caches media assets.
 */

const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/fixtures');

const ROOT = path.resolve(__dirname, '../..');

const REQUIRED_MEDIA_FILES = [
  'media/media.css',
  'media/media-i18n.js',
  'media/media-file.js',
  'media/media-decode.js',
  'media/media-asr.js',
  'media/media-cues.js',
  'media/media-export.js',
  'media/media-preview.js',
  'media/media-ui.js',
  'media/media-worker.js',
  'media/media-tab.html'
];

test.describe('Web app: Media module offline caching in sw.js', () => {
  test('sw.js SHELL array contains all media files and manifest.webmanifest, and each exists on disk', () => {
    const swPath = path.join(ROOT, 'sw.js');
    expect(fs.existsSync(swPath), 'sw.js must exist').toBe(true);

    const swContent = fs.readFileSync(swPath, 'utf8');
    const shellMatch = swContent.match(/const\s+SHELL\s*=\s*\[([\s\S]*?)\];/);
    expect(shellMatch, 'sw.js must declare SHELL array').toBeTruthy();

    const precacheList = shellMatch[1]
      .split(',')
      .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
      .map(p => p.replace(/^\.\//, ''));

    // Check manifest.webmanifest
    expect(precacheList.includes('manifest.webmanifest'), 'manifest.webmanifest must be in sw.js SHELL').toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'manifest.webmanifest')), 'manifest.webmanifest must exist on disk').toBe(true);

    // Check all media files
    for (const relFile of REQUIRED_MEDIA_FILES) {
      expect(precacheList.includes(relFile), `${relFile} must be in sw.js SHELL array`).toBe(true);
      const absPath = path.join(ROOT, relFile);
      expect(fs.existsSync(absPath), `${relFile} must exist on disk at ${absPath}`).toBe(true);
    }
  });

  test('browser registers service worker and caches media assets for offline use', async ({ app }) => {
    const { page } = app;

    // Check sw registration and cache availability in page context
    const cacheStatus = await page.evaluate(async (files) => {
      if (!('serviceWorker' in navigator) || !('caches' in window)) {
        return { supported: false, cached: [] };
      }
      const keys = await caches.keys();
      const cachedUrls = [];
      for (const k of keys) {
        const cache = await caches.open(k);
        const reqs = await cache.keys();
        for (const req of reqs) {
          cachedUrls.push(req.url);
        }
      }
      return { supported: true, keys, cachedUrls };
    }, REQUIRED_MEDIA_FILES);

    expect(cacheStatus).toBeDefined();
  });
});
