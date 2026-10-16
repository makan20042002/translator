'use strict';
const { test, expect } = require('../support/fixtures');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

test.describe('Google Fonts CDN removal guard', () => {
  test('no file in the repo (excluding docs, tests, node_modules and sw.js static cache) references Google Fonts CDNs', () => {
    const skipDirs = new Set(['node_modules', 'dist', '.git', 'docs', 'tests', 'test_docs']);
    const hits = [];

    const walk = dir => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (skipDirs.has(e.name) || e.isSymbolicLink()) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          walk(full);
          continue;
        }
        // sw.js retains offline cache host whitelist tested in model-hosts.spec.js
        if (e.name === 'sw.js') continue;

        if (!/\.(html|css|js|mjs|json|webmanifest|md|txt|ps1|py|cs|csproj)$/i.test(e.name)) continue;

        const content = fs.readFileSync(full, 'utf8');
        if (/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(content)) {
          hits.push(path.relative(ROOT, full));
        }
      }
    };

    walk(ROOT);
    expect(hits, 'Expected zero references to fonts.googleapis.com or fonts.gstatic.com').toEqual([]);
  });
});
