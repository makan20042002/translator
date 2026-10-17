'use strict';

/**
 * Item 4 (b): Ensure the browser extension does not contain the Media module.
 * The extension must remain lightweight and isolated from Media Translate.
 * Asserts:
 * - build-manifests.js copy rules do not include 'media/' or copy media files.
 * - dist/chrome and dist/firefox contain no files or directories from media/.
 * - extension/ source folder contains no media/ assets.
 */

const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/ext-fixtures');

const ROOT = path.resolve(__dirname, '../..');

test.describe('Extension: No media module in extension distribution', () => {
  test('build-manifests.js copy rules and sources do not include media/', () => {
    const buildScriptPath = path.join(ROOT, 'build-manifests.js');
    expect(fs.existsSync(buildScriptPath), 'build-manifests.js must exist').toBe(true);

    const content = fs.readFileSync(buildScriptPath, 'utf8');
    // Ensure build-manifests does not copy media or reference media folder
    expect(content).not.toMatch(/['"]media['"]/);
    expect(content).not.toMatch(/['"]\.\/media/);
    expect(content).not.toMatch(/path\.join\([^)]*['"]media['"]/);
  });

  test('extension source directory does not contain media/ folder or media assets', () => {
    const extDir = path.join(ROOT, 'extension');
    expect(fs.existsSync(extDir), 'extension/ dir must exist').toBe(true);

    const extEntries = fs.readdirSync(extDir, { withFileTypes: true });
    const hasMediaDir = extEntries.some(e => e.name.toLowerCase() === 'media');
    expect(hasMediaDir, 'extension/ directory must not have a media folder').toBe(false);

    const mediaFiles = extEntries.filter(e => e.name.startsWith('media-') || e.name.startsWith('media.'));
    expect(mediaFiles.length, 'no media-* files directly inside extension/').toBe(0);
  });

  test('dist/chrome and dist/firefox distributions contain zero media files', () => {
    for (const target of ['chrome', 'firefox']) {
      const distTargetDir = path.join(ROOT, 'dist', target);
      if (!fs.existsSync(distTargetDir)) continue;

      const collectedFiles = [];
      function walk(currentDir) {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          const relPath = path.relative(distTargetDir, fullPath).replace(/\\/g, '/');
          if (entry.isDirectory()) {
            walk(fullPath);
          } else {
            collectedFiles.push(relPath);
          }
        }
      }
      walk(distTargetDir);

      const mediaEntries = collectedFiles.filter(f => f.startsWith('media/') || f.includes('/media/') || f.startsWith('media-') || f.startsWith('media.'));
      expect(mediaEntries, `dist/${target} must contain no media files`).toEqual([]);
    }
  });
});
