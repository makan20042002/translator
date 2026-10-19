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

  test('static test: all files loaded by relative path with no folder prefix in index.html, js/*.js, sw.js are matched by extraResources filter and server types', () => {
    const minimatchModule = require('minimatch');
    const minimatch = typeof minimatchModule === 'function' ? minimatchModule : minimatchModule.minimatch;

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const resourceEntry = pkg.build.extraResources.find(r => r.to === 'app' || r.to === 'app-web');
    expect(resourceEntry, 'extraResources app entry must exist').toBeDefined();
    const filters = resourceEntry.filter || [];

    // Helper: matches any filter pattern using minimatch
    const isPackaged = (relFile) => filters.some(pattern => minimatch(relFile, pattern, { dot: true }));

    const discoveredRootFiles = new Set(['index.html']);

    // 1. Scan index.html for root-level files (no slash or backslash in path)
    const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const attrRegex = /\b(?:src|href)=["']([^"':]+)["']/gi;
    let m;
    while ((m = attrRegex.exec(indexHtml)) !== null) {
      const val = m[1].trim();
      if (!val || val.startsWith('#') || val.startsWith('data:') || val.includes('/') || val.includes('\\')) continue;
      discoveredRootFiles.add(val);
    }

    // 2. Scan js/*.js for root-level file references (workers, dynamic script loads, serviceWorker, etc.)
    const jsDir = path.join(rootDir, 'js');
    const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));
    for (const jsFile of jsFiles) {
      const content = fs.readFileSync(path.join(jsDir, jsFile), 'utf8');

      // new Worker('file.js')
      const workerMatches = content.matchAll(/new\s+Worker\s*\(\s*['"]([^'"]+)['"]/g);
      for (const wm of workerMatches) {
        const target = wm[1].replace(/^\.\//, '');
        if (!target.includes('/') && !target.includes('\\')) discoveredRootFiles.add(target);
      }

      // script.src = 'file.js'
      const srcMatches = content.matchAll(/\.src\s*=\s*['"]([^'"]+)['"]/g);
      for (const sm of srcMatches) {
        const target = sm[1].replace(/^\.\//, '');
        if (!target.includes('/') && !target.includes('\\') && !target.startsWith('http')) discoveredRootFiles.add(target);
      }

      // serviceWorker.register('file.js')
      const swMatches = content.matchAll(/serviceWorker\.register\s*\(\s*['"]([^'"]+)['"]/g);
      for (const swm of swMatches) {
        const target = swm[1].replace(/^\.\//, '');
        if (!target.includes('/') && !target.includes('\\')) discoveredRootFiles.add(target);
      }
    }

    // 3. Scan sw.js SHELL precache array
    const swPath = path.join(rootDir, 'sw.js');
    if (fs.existsSync(swPath)) {
      discoveredRootFiles.add('sw.js');
      const swContent = fs.readFileSync(swPath, 'utf8');
      const shellMatch = swContent.match(/const\s+SHELL\s*=\s*\[([\s\S]*?)\];/);
      if (shellMatch) {
        const items = shellMatch[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
        for (const item of items) {
          const stripped = item.replace(/^\.\//, '');
          if (stripped && !stripped.includes('/') && !stripped.includes('\\')) {
            discoveredRootFiles.add(stripped);
          }
        }
      }
    }

    // 4. Scan ai-worker.js for local root imports (e.g. asr-guard.js)
    const aiWorkerPath = path.join(rootDir, 'ai-worker.js');
    if (fs.existsSync(aiWorkerPath)) {
      const aiContent = fs.readFileSync(aiWorkerPath, 'utf8');
      const importMatches = aiContent.matchAll(/from\s+['"]\.\/([^'"]+)['"]/g);
      for (const im of importMatches) {
        const target = im[1];
        if (!target.includes('/') && !target.includes('\\')) discoveredRootFiles.add(target);
      }
    }

    // 5. Scan manifest.webmanifest for icons
    const manifestPath = path.join(rootDir, 'manifest.webmanifest');
    if (fs.existsSync(manifestPath)) {
      discoveredRootFiles.add('manifest.webmanifest');
      try {
        const manifestObj = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (Array.isArray(manifestObj.icons)) {
          for (const icon of manifestObj.icons) {
            const src = (icon.src || '').replace(/^\.\//, '');
            if (src && !src.includes('/') && !src.includes('\\')) discoveredRootFiles.add(src);
          }
        }
      } catch (e) {}
    }

    // Mandatory known root files that must be present
    const mandatoryFiles = [
      'jszip.min.js',
      'models-catalog.js',
      'translation-memory.js',
      'ai-worker.js',
      'asr-guard.js',
      'piper-worker.js',
      'sw.js',
      'manifest.webmanifest',
      'icon-192.png',
      'icon-512.png',
      'index.html'
    ];
    for (const mf of mandatoryFiles) {
      discoveredRootFiles.add(mf);
    }

    // Verify every discovered file exists on disk in translator root and is matched by extraResources filter
    for (const relFile of discoveredRootFiles) {
      const filePath = path.join(rootDir, relFile);
      expect(fs.existsSync(filePath), `Root file "${relFile}" must exist in web root`).toBe(true);

      const matched = isPackaged(relFile);
      expect(matched, `Root file "${relFile}" must be matched by extraResources filter in exe translator/package.json`).toBe(true);
    }

    // 6. Verify main.js / isolation-headers.js server types dictionary handles all packaged file extensions
    const mainSrc = fs.readFileSync(mainJsPath, 'utf8');
    const isolationPath = path.join(exeTranslatorDir, 'isolation-headers.js');
    const serverSrc = fs.existsSync(isolationPath) ? (mainSrc + '\n' + fs.readFileSync(isolationPath, 'utf8')) : mainSrc;
    expect(serverSrc).toMatch(/const\s+(?:types|TYPES)\s*=\s*\{/);
    expect(serverSrc).toMatch(/['"]\.js['"]\s*:\s*['"]text\/javascript['"]/);
    expect(serverSrc).toMatch(/['"]\.html['"]\s*:\s*['"]text\/html/);
    expect(serverSrc).toMatch(/['"]\.css['"]\s*:\s*['"]text\/css['"]/);
    expect(serverSrc).toMatch(/['"]\.webmanifest['"]\s*:/);
    expect(serverSrc).toMatch(/path\.extname\(file\)\.toLowerCase\(\)/);

    // 7. If unpacked build exists (dist/win-unpacked/resources/app), verify jszip.min.js is present
    const unpackedAppDir = path.join(exeTranslatorDir, 'dist', 'win-unpacked', 'resources', 'app');
    if (fs.existsSync(unpackedAppDir)) {
      expect(
        fs.existsSync(path.join(unpackedAppDir, 'jszip.min.js')),
        'jszip.min.js must be present in dist/win-unpacked/resources/app'
      ).toBe(true);
    }
  });
});
