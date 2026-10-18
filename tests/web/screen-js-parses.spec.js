'use strict';

const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const { test, expect } = require('../support/fixtures');
const { auditAll } = require('../../tools/audit-symbols');

test.describe('Screen.js parsing and symbol audit regression', () => {

  test('parses js/screen.js with acorn parser and detects zero duplicate declarations', () => {
    const screenJsPath = path.resolve(__dirname, '../../js/screen.js');
    const screenJsCode = fs.readFileSync(screenJsPath, 'utf8');

    const ast = acorn.parse(screenJsCode, {
      ecmaVersion: 'latest',
      locations: true,
      sourceType: 'script'
    });

    expect(ast).toBeDefined();
    expect(ast.type).toBe('Program');
    expect(ast.body.length).toBeGreaterThan(0);

    const { issues } = auditAll();
    const screenIssues = issues.filter(issue =>
      (issue.defined && issue.defined.includes('screen.js')) ||
      (issue.firstUsed && issue.firstUsed.includes('screen.js'))
    );
    expect(screenIssues).toEqual([]);
  });

  test('loads js/screen.js through real app page without parse errors or console errors', async ({ app }) => {
    const { page, errors } = app;

    expect(errors).toEqual([]);

    const screenFunctionsDefined = await page.evaluate(() => {
      return typeof window.renderOcrModels === 'function' &&
             typeof window.updateActiveReadingStatus === 'function' &&
             typeof window.syncOcrModelDlBtn === 'function';
    });

    expect(screenFunctionsDefined).toBe(true);
  });

});
