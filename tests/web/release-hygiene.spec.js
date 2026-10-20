'use strict';

const { test, expect } = require('../support/fixtures');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

test.describe('Release Hygiene & Store Readiness', () => {
  test('ITEM 1 - LICENSE exists, contains "MIT License" and "Makan"', () => {
    const rootLicensePath = path.join(ROOT, 'LICENSE');
    expect(fs.existsSync(rootLicensePath), 'Root LICENSE file must exist').toBe(true);
    const content = fs.readFileSync(rootLicensePath, 'utf8');
    expect(content).toContain('MIT License');
    expect(content).toContain('Makan');

    const pkgPath = path.join(ROOT, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    expect(pkg.license).toBe('MIT');

    const extLicensePath = path.join(ROOT, 'extension', 'LICENSE');
    expect(fs.existsSync(extLicensePath), 'extension/LICENSE file must exist').toBe(true);
  });

  test('ITEM 2 - THIRD_PARTY.md lists every top-level folder/file under vendor/ and fonts/ and has no empty licence field', () => {
    const thirdPartyPath = path.join(ROOT, 'docs', 'THIRD_PARTY.md');
    expect(fs.existsSync(thirdPartyPath), 'docs/THIRD_PARTY.md must exist').toBe(true);
    const content = fs.readFileSync(thirdPartyPath, 'utf8');

    // Enumerate top-level items under vendor/
    const vendorPath = path.join(ROOT, 'vendor');
    const vendorEntries = fs.readdirSync(vendorPath);
    for (const entry of vendorEntries) {
      expect(content).toContain(entry);
    }

    // Enumerate top-level items under fonts/
    const fontsPath = path.join(ROOT, 'fonts');
    const fontsEntries = fs.readdirSync(fontsPath);
    for (const entry of fontsEntries) {
      expect(content).toContain(entry);
    }

    // Ensure no empty licence / license field
    const emptyLicencePattern = /(?:Licence|License)\s*:\s*(?:\r?\n|$)/i;
    expect(emptyLicencePattern.test(content)).toBe(false);

    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^[-*]?\s*\*{0,2}(?:Licence|License)\*{0,2}\s*:\s*(.*)$/i);
      if (match) {
        expect(match[1].trim().length).toBeGreaterThan(0);
      }
    }

    // Check link in web app index.html and extension options.html
    const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    expect(indexHtml).toContain('THIRD_PARTY.md');

    const optionsHtml = fs.readFileSync(path.join(ROOT, 'extension', 'options.html'), 'utf8');
    expect(optionsHtml).toContain('THIRD_PARTY.md');
  });
});
