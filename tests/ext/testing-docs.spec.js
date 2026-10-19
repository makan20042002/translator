'use strict';

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

test.describe('Documentation: Extension testing guidelines', () => {
  test('docs/OVERVIEW.md notes that extension tests opening extra tabs must use unique addresses', () => {
    const overviewPath = path.resolve(__dirname, '../../docs/OVERVIEW.md');
    const content = fs.readFileSync(overviewPath, 'utf8');

    expect(content).toContain('Writing extension tests: tab disambiguation');
    expect(content).toContain('Extension tests which open extra tabs must use unique addresses');
    expect(content).toContain('clickContextMenu');
    expect(content).toMatch(/resolves?\s+tabs?\s+by\s+address/i);
  });

  test('docs/OVERVIEW.md documents whole-page translate target language reading and retranslate after stop', () => {
    const overviewPath = path.resolve(__dirname, '../../docs/OVERVIEW.md');
    const content = fs.readFileSync(overviewPath, 'utf8');

    expect(content).toContain('Whole-page translation');
    expect(content).toMatch(/reads the saved target language on every start/i);
    expect(content).toMatch(/retranslate after Stop only re-translates the units that were already done/i);
  });
});
