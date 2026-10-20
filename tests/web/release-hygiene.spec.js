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

  test('ITEM 3 - Scan finds no secret keys, personal paths, or unauthorized emails outside tests/ and docs/TEST-REPORT.md', () => {
    const ignoreDirs = new Set(['node_modules', 'dist', 'test-results', 'tests', '.git']);
    const violations = [];
    const textExts = new Set(['.js', '.mjs', '.cjs', '.html', '.css', '.json', '.md', '.txt', '.py', '.ps1', '.sh', '.bat', '.cmd', '.yml', '.yaml', '.webmanifest']);

    function scan(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (ignoreDirs.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(full);
        } else if (entry.isFile()) {
          const rel = path.relative(ROOT, full).replace(/\\/g, '/');
          if (rel === 'docs/TEST-REPORT.md') continue;
          const ext = path.extname(full).toLowerCase();
          if (!textExts.has(ext)) continue;

          const content = fs.readFileSync(full, 'utf8');
          const lines = content.split(/\r?\n/);
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNum = i + 1;

            if (/AIza[0-9A-Za-z\-_]{20,}/.test(line)) violations.push(`${rel}:${lineNum} API key shape (AIza...)`);
            if (/sk-[0-9A-Za-z\-_]{20,}/.test(line)) violations.push(`${rel}:${lineNum} API key shape (sk-...)`);
            if (/ghp_[0-9A-Za-z]{30,}/.test(line)) violations.push(`${rel}:${lineNum} API key shape (ghp_...)`);
            if (/xox[baprs]-[0-9A-Za-z\-_]{10,}/.test(line)) violations.push(`${rel}:${lineNum} API key shape (xox...)`);
            if (/Bearer\s+[A-Za-z0-9_\-\.]{20,}/.test(line)) violations.push(`${rel}:${lineNum} Bearer token`);
            if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(line)) violations.push(`${rel}:${lineNum} Private key block`);
            if (/[a-zA-Z]:[\\/]users[\\/]makan/i.test(line)) violations.push(`${rel}:${lineNum} Personal path (C:\\Users\\Makan)`);
            if (/\/Users\//.test(line)) violations.push(`${rel}:${lineNum} Personal path (/Users/)`);

            const emailMatches = line.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g);
            if (emailMatches) {
              for (const em of emailMatches) {
                const lower = em.toLowerCase();
                if (lower === 'makan20042002@gmail.com' || lower === 'makan-translate@makanlab.tech') continue;
                if (lower.endsWith('@example.com')) continue;
                if (rel === 'docs/THIRD_PARTY.md' && lower === 'saber.rastikerdar@gmail.com') continue;
                if (rel === 'package-lock.json') continue;
                violations.push(`${rel}:${lineNum} Personal email (${lower})`);
              }
            }
          }
        }
      }
    }

    scan(ROOT);
    expect(violations, `Found violations: ${violations.join(', ')}`).toEqual([]);
  });
});
