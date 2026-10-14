'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe('Desktop Packaging and Server Configuration (Item 2)', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const exeTranslatorDir = path.resolve(rootDir, '..', 'exe translator');
  const pkgPath = path.join(exeTranslatorDir, 'package.json');
  const mainJsPath = path.join(exeTranslatorDir, 'main.js');

  test('packaging config lists css/ and js/ and bundles all runtime web assets', () => {
    expect(fs.existsSync(pkgPath)).toBe(true);
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    expect(pkg.build).toBeDefined();
    expect(pkg.build.extraResources).toBeDefined();
    expect(Array.isArray(pkg.build.extraResources)).toBe(true);

    const resourceEntry = pkg.build.extraResources.find(r => r.to === 'app' || r.to === 'app-web');
    expect(resourceEntry).toBeDefined();

    const filters = resourceEntry.filter || [];
    const hasCss = filters.some(f => f.includes('css'));
    const hasJs = filters.some(f => f.includes('js'));
    const hasHtml = filters.some(f => f.includes('index.html') || f === '**/*');

    expect(hasCss).toBe(true);
    expect(hasJs).toBe(true);
    expect(hasHtml).toBe(true);
  });

  test('packaging config specifies portable and per-user NSIS installer with correct metadata', () => {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    expect(pkg.build.productName).toBe('MAKAN Translate');
    expect(pkg.build.appId).toBe('tech.makanlab.translate');
    expect(pkg.version).toBeDefined();

    // Windows targets
    const winTarget = pkg.build.win.target;
    const targets = Array.isArray(winTarget) ? winTarget : [winTarget];
    expect(targets).toContain('portable');
    expect(targets).toContain('nsis');

    // Icon path specified
    expect(pkg.build.win.icon).toBeDefined();
    expect(pkg.build.win.icon.endsWith('.ico')).toBe(true);
    const icoPath = path.join(exeTranslatorDir, pkg.build.win.icon);
    expect(fs.existsSync(icoPath)).toBe(true);

    // NSIS per-user install (not requiring admin), desktop + start-menu shortcuts
    expect(pkg.build.nsis).toBeDefined();
    expect(pkg.build.nsis.perMachine).toBe(false);
    expect(pkg.build.nsis.createDesktopShortcut).toBeTruthy();
    expect(pkg.build.nsis.createStartMenuShortcut).toBe(true);
  });

  test('no absolute C:\\Users user paths in Electron source or config', () => {
    const filesToCheck = [
      mainJsPath,
      pkgPath,
      path.join(exeTranslatorDir, 'screen-translator', 'manager.js'),
      path.join(exeTranslatorDir, 'screen-translator', 'ocr-service.js'),
      path.join(exeTranslatorDir, 'screen-translator', 'preload-main.js'),
      path.join(rootDir, 'screen-translator', 'manager.js'),
      path.join(rootDir, 'screen-translator', 'ocr-service.js'),
      path.join(rootDir, 'screen-translator', 'preload-main.js')
    ];

    for (const file of filesToCheck) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        expect(content).not.toMatch(/[a-zA-Z]:\\Users\\[a-zA-Z0-9_]+/i);
        expect(content).not.toMatch(/[a-zA-Z]:\/Users\/[a-zA-Z0-9_]+/i);
      }
    }
  });

  test('server web-root function handles both development and packaged cases', () => {
    expect(fs.existsSync(mainJsPath)).toBe(true);
    const mainSrc = fs.readFileSync(mainJsPath, 'utf8');

    // Asserts logic exists for both dev and packaged environments
    expect(mainSrc).toContain('app.isPackaged');
    expect(mainSrc).toMatch(/process\.resourcesPath/);
    expect(mainSrc).toMatch(/app\.getAppPath/);
    expect(mainSrc).toContain('function getWebRoot');
    expect(mainSrc).toMatch(/path\.join\(process\.resourcesPath,\s*['"]app['"]\)/);
  });

  test('static layout check: expected packaged layout computed from package.json matches getWebRoot resolution', () => {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const mainSrc = fs.readFileSync(mainJsPath, 'utf8');

    // 1. Compute expected packaged destination for web files from extraResources
    const webResourceEntry = pkg.build.extraResources.find(r => 
      r.filter && r.filter.some(f => f.includes('index.html') || f.includes('css'))
    );
    expect(webResourceEntry).toBeDefined();

    const expectedSubDir = webResourceEntry.to || '';
    const filters = webResourceEntry.filter;
    expect(filters.some(f => f.includes('index.html'))).toBe(true);
    expect(filters.some(f => f.includes('css'))).toBe(true);
    expect(filters.some(f => f.includes('js'))).toBe(true);

    // 2. Verify getWebRoot in main.js checks this exact computed destination
    if (expectedSubDir && expectedSubDir !== '.') {
      expect(mainSrc).toMatch(new RegExp(`path\\.join\\(\\s*process\\.resourcesPath\\s*,\\s*['"]${expectedSubDir}['"]\\s*\\)`));
    } else {
      expect(mainSrc).toContain('process.resourcesPath');
    }

    // 3. Verify getWebRoot checks for index.html at that location
    expect(mainSrc).toMatch(/fs\.existsSync\(path\.join\([^)]*index\.html[^)]*\)\)/);
  });
});
