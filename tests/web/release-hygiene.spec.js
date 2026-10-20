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

  test('ITEM 4 - .gitignore contains node_modules, dist, test-results, tests/.results, scratch, *.log, *.zip, and big local model caches', () => {
    const gitignorePath = path.join(ROOT, '.gitignore');
    expect(fs.existsSync(gitignorePath), '.gitignore must exist').toBe(true);
    const content = fs.readFileSync(gitignorePath, 'utf8');

    const requiredEntries = [
      'node_modules',
      'dist',
      'test-results',
      'tests/.results',
      'scratch',
      '*.log',
      '*.zip',
      'models'
    ];

    for (const entry of requiredEntries) {
      expect(content).toContain(entry);
    }
  });

  test('ITEM 5 - version.js, package.json, extension/manifest.json, manifest.chrome.json, and manifest.firefox.json all show the same version string', () => {
    const pkgPath = path.join(ROOT, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const expectedVersion = pkg.version;
    expect(expectedVersion).toBeTruthy();

    const versionJsPath = path.join(ROOT, 'js', 'version.js');
    expect(fs.existsSync(versionJsPath), 'js/version.js must exist').toBe(true);
    const versionJsContent = fs.readFileSync(versionJsPath, 'utf8');
    const versionJsMatch = versionJsContent.match(/var\s+v\s*=\s*['"]([^'"]+)['"]/);
    expect(versionJsMatch, 'js/version.js must declare version in var v').toBeTruthy();
    expect(versionJsMatch[1]).toBe(expectedVersion);
    expect(versionJsContent).toContain('MAKAN_VERSION');

    const baseManifestPath = path.join(ROOT, 'extension', 'manifest.json');
    const baseManifest = JSON.parse(fs.readFileSync(baseManifestPath, 'utf8'));
    expect(baseManifest.version).toBe(expectedVersion);

    const chromeManifestPath = path.join(ROOT, 'extension', 'manifest.chrome.json');
    const chromeManifest = JSON.parse(fs.readFileSync(chromeManifestPath, 'utf8'));
    expect(chromeManifest.version).toBe(expectedVersion);

    const firefoxManifestPath = path.join(ROOT, 'extension', 'manifest.firefox.json');
    const firefoxManifest = JSON.parse(fs.readFileSync(firefoxManifestPath, 'utf8'));
    expect(firefoxManifest.version).toBe(expectedVersion);
  });

  test('ITEM 6 - Each new i18n key exists in every language file (web js/i18n.js and extension _locales)', () => {
    // 1. Web app js/i18n.js
    const i18nJsPath = path.join(ROOT, 'js', 'i18n.js');
    expect(fs.existsSync(i18nJsPath), 'js/i18n.js must exist').toBe(true);
    const i18nContent = fs.readFileSync(i18nJsPath, 'utf8');

    const vm = require('vm');
    const sandbox = {
      window: { MediaTranslate: {} },
      store: { get: () => 'en' },
      $: () => null,
      document: { documentElement: {}, querySelectorAll: () => [] }
    };
    const ctx = vm.createContext(sandbox);
    vm.runInContext(i18nContent.replace('const I18N=', 'var I18N='), ctx);
    const I18N = sandbox.I18N;
    expect(I18N).toBeDefined();
    expect(I18N.en).toBeDefined();
    expect(I18N.fa).toBeDefined();

    const newWebKeys = [
      'docEngineTurnedOffPrompt',
      'clipboardBlocked',
      'noSubLines',
      'noTermsToAdd',
      'nothingTranslatedYet',
      'couldNotReadFile'
    ];
    for (const key of newWebKeys) {
      expect(key in I18N.en, `Key "${key}" must exist in I18N.en`).toBe(true);
      expect(key in I18N.fa, `Key "${key}" must exist in I18N.fa`).toBe(true);
      expect(typeof I18N.en[key]).toBe('string');
      expect(typeof I18N.fa[key]).toBe('string');
      expect(I18N.en[key].length).toBeGreaterThan(0);
      expect(I18N.fa[key].length).toBeGreaterThan(0);
    }

    // Check complete parity between en and fa
    const enKeys = Object.keys(I18N.en);
    const faKeys = Object.keys(I18N.fa);
    const missingInFa = enKeys.filter(k => !(k in I18N.fa));
    const missingInEn = faKeys.filter(k => !(k in I18N.en));
    expect(missingInFa, 'All en keys must exist in fa').toEqual([]);
    expect(missingInEn, 'All fa keys must exist in en').toEqual([]);

    // 2. Extension _locales
    const extEnPath = path.join(ROOT, 'extension', '_locales', 'en', 'messages.json');
    const extFaPath = path.join(ROOT, 'extension', '_locales', 'fa', 'messages.json');
    expect(fs.existsSync(extEnPath), 'extension/_locales/en/messages.json must exist').toBe(true);
    expect(fs.existsSync(extFaPath), 'extension/_locales/fa/messages.json must exist').toBe(true);

    const extEn = JSON.parse(fs.readFileSync(extEnPath, 'utf8'));
    const extFa = JSON.parse(fs.readFileSync(extFaPath, 'utf8'));

    const newExtKeys = [
      'error',
      'showDetails',
      'openOptions',
      'retry',
      'copy',
      'copied',
      'speak',
      'stop',
      'aiExplanation',
      'idiomAi',
      'literalTranslation',
      'offlineDictionary',
      'siteCheckChecking',
      'siteCheckActiveReady',
      'siteCheckUnavailable',
      'siteCheckRestricted',
      'siteCheckDisabledOnSite',
      'siteCheckNotInjected',
      'siteCheckInjectNow',
      'siteCheckInjecting',
      'resetSettingsArm',
      'resetSettingsLabel'
    ];
    for (const key of newExtKeys) {
      expect(key in extEn, `Message "${key}" must exist in extension/_locales/en/messages.json`).toBe(true);
      expect(key in extFa, `Message "${key}" must exist in extension/_locales/fa/messages.json`).toBe(true);
      expect(extEn[key].message && extEn[key].message.length > 0).toBe(true);
      expect(extFa[key].message && extFa[key].message.length > 0).toBe(true);
    }

    const extEnKeys = Object.keys(extEn);
    const extFaKeys = Object.keys(extFa);
    const missingInExtFa = extEnKeys.filter(k => !(k in extFa));
    const missingInExtEn = extFaKeys.filter(k => !(k in extEn));
    expect(missingInExtFa, 'All extension en messages must exist in fa').toEqual([]);
    expect(missingInExtEn, 'All extension fa messages must exist in en').toEqual([]);
  });

  test('ITEM 7 - screen-translator/ocr-service.js in translator and exe translator are identical copies', () => {
    const srcOcrPath = path.join(ROOT, 'screen-translator', 'ocr-service.js');
    expect(fs.existsSync(srcOcrPath), 'translator/screen-translator/ocr-service.js must exist').toBe(true);
    const srcContent = fs.readFileSync(srcOcrPath, 'utf8');

    const exeOcrPath = path.resolve(ROOT, '..', 'exe translator', 'screen-translator', 'ocr-service.js');
    expect(fs.existsSync(exeOcrPath), 'exe translator/screen-translator/ocr-service.js must exist').toBe(true);
    const exeContent = fs.readFileSync(exeOcrPath, 'utf8');

    const norm = s => s.replace(/\r\n/g, '\n').trim();
    expect(norm(srcContent), 'ocr-service.js in exe translator must be identical to source in translator').toBe(norm(exeContent));
  });

  test('ITEM 8 - Store-readiness: manifests are valid JSON, icons exist, gecko id is correct, description <=132 chars', () => {
    const extDir = path.join(ROOT, 'extension');
    const chromeManifestPath = path.join(extDir, 'manifest.chrome.json');
    const firefoxManifestPath = path.join(extDir, 'manifest.firefox.json');

    expect(fs.existsSync(chromeManifestPath), 'manifest.chrome.json must exist').toBe(true);
    expect(fs.existsSync(firefoxManifestPath), 'manifest.firefox.json must exist').toBe(true);

    const chromeManifest = JSON.parse(fs.readFileSync(chromeManifestPath, 'utf8'));
    const firefoxManifest = JSON.parse(fs.readFileSync(firefoxManifestPath, 'utf8'));

    // Check icons exist on disk
    for (const manifest of [chromeManifest, firefoxManifest]) {
      expect(manifest.icons).toBeDefined();
      for (const [size, relPath] of Object.entries(manifest.icons)) {
        const fullIconPath = path.join(extDir, relPath);
        expect(fs.existsSync(fullIconPath), `Icon ${size} at ${fullIconPath} must exist`).toBe(true);
      }
    }

    // Check gecko id
    expect(firefoxManifest.browser_specific_settings).toBeDefined();
    expect(firefoxManifest.browser_specific_settings.gecko).toBeDefined();
    expect(firefoxManifest.browser_specific_settings.gecko.id).toBe('makan-translate@makanlab.tech');

    // Check descriptions <= 132 chars
    const enLocalePath = path.join(extDir, '_locales', 'en', 'messages.json');
    const faLocalePath = path.join(extDir, '_locales', 'fa', 'messages.json');
    const enLocale = JSON.parse(fs.readFileSync(enLocalePath, 'utf8'));
    const faLocale = JSON.parse(fs.readFileSync(faLocalePath, 'utf8'));

    expect(enLocale.extensionDescription).toBeDefined();
    expect(enLocale.extensionDescription.message.length).toBeLessThanOrEqual(132);

    expect(faLocale.extensionDescription).toBeDefined();
    expect(faLocale.extensionDescription.message.length).toBeLessThanOrEqual(132);

    // Check docs/STORE_LISTING.md exists and contains short description, gecko ID, etc.
    const storeListingPath = path.join(ROOT, 'docs', 'STORE_LISTING.md');
    expect(fs.existsSync(storeListingPath), 'docs/STORE_LISTING.md must exist').toBe(true);
    const storeListingContent = fs.readFileSync(storeListingPath, 'utf8');
    expect(storeListingContent).toContain('makan-translate@makanlab.tech');
    expect(storeListingContent).toContain(enLocale.extensionDescription.message);
  });

  test('ITEM 9 - GPL component section in docs/THIRD_PARTY.md and GPL licence text file exists on disk', () => {
    const thirdPartyPath = path.join(ROOT, 'docs', 'THIRD_PARTY.md');
    expect(fs.existsSync(thirdPartyPath), 'docs/THIRD_PARTY.md must exist').toBe(true);
    const content = fs.readFileSync(thirdPartyPath, 'utf8');

    // Section "GPL component" exists in docs/THIRD_PARTY.md
    expect(content).toMatch(/##\s+GPL component/i);
    expect(content).toContain('eSpeak NG');
    expect(content).toContain('vendor/piper');
    expect(content).toContain('piper-worker.js');

    // GPL licence text file exists on disk
    const gplFilePaths = [
      path.join(ROOT, 'vendor', 'piper', 'LICENSE-GPL.txt'),
      path.join(ROOT, 'vendor', 'piper', 'LICENSE-GPL'),
      path.join(ROOT, 'vendor', 'piper', 'COPYING'),
      path.join(ROOT, 'vendor', 'piper', 'LICENSE'),
      path.join(ROOT, 'LICENSES', 'GPL-3.0.txt')
    ];
    const foundGplFile = gplFilePaths.find(p => fs.existsSync(p));
    expect(foundGplFile, 'A GPL licence text file must exist in vendor/piper/ or LICENSES/').toBeDefined();

    const gplContent = fs.readFileSync(foundGplFile, 'utf8');
    expect(gplContent).toContain('GNU GENERAL PUBLIC LICENSE');
  });

  test('ITEM 10 - Firefox manifest includes required data_collection_permissions and Chrome does not', () => {
    const extDir = path.join(ROOT, 'extension');
    const firefoxManifest = JSON.parse(fs.readFileSync(path.join(extDir, 'manifest.firefox.json'), 'utf8'));
    const chromeManifest = JSON.parse(fs.readFileSync(path.join(extDir, 'manifest.chrome.json'), 'utf8'));
    const distFirefoxManifestPath = path.join(ROOT, 'dist', 'firefox', 'manifest.json');

    const gecko = firefoxManifest.browser_specific_settings?.gecko;
    expect(gecko).toBeDefined();
    expect(gecko.data_collection_permissions).toBeDefined();
    expect(gecko.data_collection_permissions.required).toBeDefined();
    expect(gecko.data_collection_permissions.required).toContain('websiteContent');
    expect(gecko.data_collection_permissions.required).not.toContain('none');

    expect(chromeManifest.browser_specific_settings).toBeUndefined();

    expect(fs.existsSync(distFirefoxManifestPath), 'dist/firefox/manifest.json must exist').toBe(true);
    const distFirefoxManifest = JSON.parse(fs.readFileSync(distFirefoxManifestPath, 'utf8'));
    const distGecko = distFirefoxManifest.browser_specific_settings?.gecko;
    expect(distGecko).toBeDefined();
    expect(distGecko.data_collection_permissions).toBeDefined();
    expect(distGecko.data_collection_permissions.required).toContain('websiteContent');
    expect(distGecko.data_collection_permissions.required).not.toContain('none');
  });

  test('ITEM 11 - Honesty: no shipped doc or UI string claims encryption of keys', () => {
    const shippedDirs = ['docs', 'extension', 'js'];
    const shippedFiles = ['index.html', 'README.md'];
    const scannedFiles = [];

    for (const f of shippedFiles) {
      const fullPath = path.join(ROOT, f);
      if (fs.existsSync(fullPath)) scannedFiles.push(fullPath);
    }

    function collectFiles(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'vendor') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          collectFiles(full);
        } else if (entry.isFile() && /\.(html|js|json|md|txt)$/i.test(entry.name)) {
          scannedFiles.push(full);
        }
      }
    }

    for (const d of shippedDirs) {
      const fullDir = path.join(ROOT, d);
      if (fs.existsSync(fullDir)) collectFiles(fullDir);
    }

    const falseEncryptionRegex = /(?:encrypt(?:ed|ion)?|رمزگذاری)\s*(?:inside|in|within|for)?\s*(?:(?:the|your|local)?\s*(?:browser(?:'s)?|local\s*storage|storage|device|disk))?.*(?:api\s*keys?|keys?)|(?:api\s*keys?|keys?)\s*(?:are|stay|remain|is)?\s*(?:stored|kept)?\s*(?:encrypted|رمزگذاری)/i;
    const violations = [];

    for (const file of scannedFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (falseEncryptionRegex.test(line)) {
          if (line.includes('no shipped doc') || line.includes('does not encrypt')) continue;
          violations.push(`${path.relative(ROOT, file)}:${i + 1} "${line.trim()}"`);
        }
      }
    }

    expect(violations, `Found false claims of key encryption: ${violations.join(', ')}`).toEqual([]);
  });

  test('ITEM 12 - Packaging: package:extensions produces deterministic zips with root manifest', async () => {
    const JSZip = require('jszip');
    const { packageExtensions, buildZipFromDir } = require('../../tools/package-extensions');
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

    const result = await packageExtensions({ rootDir: ROOT });

    expect(fs.existsSync(result.chromeZipPath)).toBe(true);
    expect(fs.existsSync(result.firefoxZipPath)).toBe(true);

    for (const [platform, zipPath] of [['chrome', result.chromeZipPath], ['firefox', result.firefoxZipPath]]) {
      const data = fs.readFileSync(zipPath);
      const zip = await JSZip.loadAsync(data);

      // Has manifest.json at the root
      const manifestFile = zip.file('manifest.json');
      expect(manifestFile, `${platform} zip must contain manifest.json at the root`).not.toBeNull();

      const manifestContent = JSON.parse(await manifestFile.async('string'));
      expect(manifestContent.version).toBe(pkg.version);

      // Has no file matching tests/ or .map or .md dev files
      const zipFiles = Object.keys(zip.files);
      for (const filePath of zipFiles) {
        expect(filePath).not.toMatch(/^tests\//);
        expect(filePath).not.toMatch(/\/tests\//);
        expect(filePath).not.toMatch(/\.map$/i);
        expect(filePath).not.toMatch(/\.md$/i);
      }
    }

    // Building twice gives identical bytes
    const build1 = await buildZipFromDir(path.join(ROOT, 'dist', 'chrome'));
    const build2 = await buildZipFromDir(path.join(ROOT, 'dist', 'chrome'));
    expect(build1.content.equals(build2.content), 'Chrome zip build output must be byte-for-byte deterministic').toBe(true);

    const ffBuild1 = await buildZipFromDir(path.join(ROOT, 'dist', 'firefox'));
    const ffBuild2 = await buildZipFromDir(path.join(ROOT, 'dist', 'firefox'));
    expect(ffBuild1.content.equals(ffBuild2.content), 'Firefox zip build output must be byte-for-byte deterministic').toBe(true);
  });

  test('ITEM 13 - Chrome Web Store: extension contains no remote code or eval', () => {
    const extDir = path.join(ROOT, 'extension');
    const violations = [];

    function scanDir(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(full);
        } else if (entry.isFile()) {
          const rel = path.relative(ROOT, full).replace(/\\/g, '/');
          const ext = path.extname(entry.name).toLowerCase();
          const content = fs.readFileSync(full, 'utf8');

          if (ext === '.html') {
            const scriptSrcRegex = /<script\b[^>]*\bsrc\s*=\s*["'](https?:|\/\/)/gi;
            let match;
            while ((match = scriptSrcRegex.exec(content)) !== null) {
              violations.push(`${rel}: Remote script tag detected: ${match[0]}`);
            }
          }

          if (ext === '.js') {
            const lines = content.split(/\r?\n/);
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              const trimmed = line.trim();
              if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

              // Check: no import() or importScripts of http(s) URLs
              if (/\b(?:importScripts|import)\s*\(\s*["'`]https?:/i.test(line)) {
                violations.push(`${rel}:${i + 1}: Remote import/importScripts: ${trimmed}`);
              }

              // Check: no eval
              if (/\beval\s*\(/.test(line)) {
                violations.push(`${rel}:${i + 1}: eval() detected: ${trimmed}`);
              }

              // Check: no new Function
              if (/\bnew\s+Function\s*\(/.test(line)) {
                violations.push(`${rel}:${i + 1}: new Function() detected: ${trimmed}`);
              }

              // Check: no setTimeout/setInterval with a string literal
              if (/\b(?:setTimeout|setInterval)\s*\(\s*["'`]/.test(line)) {
                violations.push(`${rel}:${i + 1}: setTimeout/setInterval with string detected: ${trimmed}`);
              }
            }
          }
        }
      }
    }

    scanDir(extDir);

    expect(violations, `Remote code or eval violations found in extension:\n${violations.join('\n')}`).toEqual([]);
  });

  test('ITEM 14 - README integrity: links, targets exist on disk, no Live Video promise', () => {
    const readmePath = path.join(ROOT, 'README.md');
    expect(fs.existsSync(readmePath), 'README.md must exist').toBe(true);
    const content = fs.readFileSync(readmePath, 'utf8');

    // README links to LICENSE, docs/THIRD_PARTY.md, extension/PRIVACY.md
    expect(content).toMatch(/\[.*?\]\((?:.\/)?LICENSE\)/);
    expect(content).toMatch(/\[.*?\]\((?:.\/)?docs\/THIRD_PARTY\.md\)/);
    expect(content).toMatch(/\[.*?\]\((?:.\/)?extension\/PRIVACY\.md\)/);

    // Mentions no Live Video promise (if mentioned, must be flagged as planned)
    if (/live video/i.test(content)) {
      expect(content).toMatch(/live video[^\n]*(?:planned|not in v1|later version)/i);
      expect(content).not.toMatch(/live video translation (?:is supported|is available|works)/i);
    }

    // Screenshots section has exact line and no broken images
    expect(content).toContain('Screenshots: docs/screenshots/ (added at release)');
    const imageMatches = content.match(/!\[.*?\]\((.*?)\)/g) || [];
    for (const img of imageMatches) {
      const src = img.replace(/^!\[.*?\]\((.*?)\)$/, '$1').trim();
      if (!/^https?:\/\//i.test(src)) {
        const resolved = path.resolve(ROOT, src.split('#')[0]);
        expect(fs.existsSync(resolved), `Broken image link in README: ${src}`).toBe(true);
      }
    }

    // Every relative link/target in README exists on disk
    const linkRegex = /\[.*?\]\((?!https?:\/\/|mailto:)(.*?)\)/g;
    let match;
    const missingTargets = [];
    while ((match = linkRegex.exec(content)) !== null) {
      const rawTarget = match[1].trim();
      const targetPath = rawTarget.split('#')[0];
      if (targetPath) {
        const resolved = path.resolve(ROOT, targetPath);
        if (!fs.existsSync(resolved)) {
          missingTargets.push(rawTarget);
        }
      }
    }
    expect(missingTargets, `Missing relative link targets: ${missingTargets.join(', ')}`).toEqual([]);

    // Explicit check that docs/screenshots exists on disk
    expect(fs.existsSync(path.join(ROOT, 'docs', 'screenshots')), 'docs/screenshots/ must exist on disk').toBe(true);

    // No personal paths or sensitive keys
    expect(content).not.toMatch(/[a-zA-Z]:\\Users\\/i);
    expect(content).not.toMatch(/\/Users\//i);
    expect(content).not.toMatch(/AIzaSy[A-Za-z0-9_-]{33}/);
    expect(content).not.toMatch(/sk-[A-Za-z0-9_-]{20,}/);
  });
});



