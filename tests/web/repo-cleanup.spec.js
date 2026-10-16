'use strict';
const { test, expect } = require('../support/fixtures');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');

test.describe('Repository cleanliness and obsolete artifact guards', () => {
  test('test-assets/ directory does not exist in the repository', () => {
    const testAssetsPath = path.join(ROOT, 'test-assets');
    const exists = fs.existsSync(testAssetsPath);
    expect(exists, 'test-assets/ directory must not exist in the repository').toBe(false);
  });

  test('broken "translator" gitlink or submodule does not exist in git', () => {
    // Check filesystem path
    const translatorPath = path.join(ROOT, 'translator');
    const fsExists = fs.existsSync(translatorPath);
    expect(fsExists, 'translator path must not exist in the working directory').toBe(false);

    // Check git index for submodule / gitlink mode 160000
    try {
      const gitLs = execSync('git ls-files -s translator', { cwd: ROOT, encoding: 'utf8' }).trim();
      expect(gitLs, 'translator gitlink must not exist in git index').toBe('');
    } catch {
      // If git command fails, index entry is absent
    }

    // Check .gitmodules does not reference translator if .gitmodules exists
    const gitmodulesPath = path.join(ROOT, '.gitmodules');
    if (fs.existsSync(gitmodulesPath)) {
      const gitmodulesContent = fs.readFileSync(gitmodulesPath, 'utf8');
      expect(gitmodulesContent.includes('translator')).toBe(false);
    }
  });
});
