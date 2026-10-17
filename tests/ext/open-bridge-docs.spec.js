'use strict';

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

test.describe('Documentation: Open Bridge check specifications', () => {
  test('docs/OVERVIEW.md specifies POST method and X-Makan-Open trust header for ping check', () => {
    const overviewPath = path.resolve(__dirname, '../../docs/OVERVIEW.md');
    const content = fs.readFileSync(overviewPath, 'utf8');

    expect(content).toContain('/__makan/ping');
    expect(content).toMatch(/POST\s+(?:http:\/\/127\.0\.0\.1:50505)?\/__makan\/ping/);
    expect(content).toContain('X-Makan-Open');
    expect(content).toMatch(/X-Makan-Open[:\s]+'?1'?/);
  });
});
