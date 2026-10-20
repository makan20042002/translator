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
});
