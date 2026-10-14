'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe('Desktop Window Shell, Tray and Lifecycle (Item 3)', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const exeTranslatorDir = path.resolve(rootDir, '..', 'exe translator');
  const mainJsPath = path.join(exeTranslatorDir, 'main.js');

  test('brand icon assets exist and contain multi-size ICO and PNGs', () => {
    const icoPath = path.join(rootDir, 'assets', 'icon.ico');
    const pngPath = path.join(rootDir, 'assets', 'icon.png');
    const trayPath = path.join(rootDir, 'assets', 'tray.png');

    expect(fs.existsSync(icoPath)).toBe(true);
    expect(fs.existsSync(pngPath)).toBe(true);
    expect(fs.existsSync(trayPath)).toBe(true);

    // Multi-size ICO must be at least 10KB (contains 16, 24, 32, 48, 64, 128, 256)
    const icoStat = fs.statSync(icoPath);
    expect(icoStat.size).toBeGreaterThan(15000);

    // Verify exe translator assets directory is also populated
    expect(fs.existsSync(path.join(exeTranslatorDir, 'assets', 'icon.ico'))).toBe(true);
    expect(fs.existsSync(path.join(exeTranslatorDir, 'assets', 'icon.png'))).toBe(true);
    expect(fs.existsSync(path.join(exeTranslatorDir, 'assets', 'tray.png'))).toBe(true);
  });

  test('single-instance lock is enforced and focuses existing window on second launch', () => {
    expect(fs.existsSync(mainJsPath)).toBe(true);
    const mainSrc = fs.readFileSync(mainJsPath, 'utf8');

    expect(mainSrc).toContain('app.requestSingleInstanceLock()');
    expect(mainSrc).toMatch(/second-instance/);
    expect(mainSrc).toMatch(/restore\(\)/);
    expect(mainSrc).toMatch(/focus\(\)/);
  });

  test('BrowserWindow shell has dark navy background, title, min size, and hidden menu bar', () => {
    const mainSrc = fs.readFileSync(mainJsPath, 'utf8');

    expect(mainSrc).toMatch(/title:\s*['"]MAKAN Translate['"]/);
    expect(mainSrc).toMatch(/backgroundColor:\s*['"]#05070D['"]/i);
    expect(mainSrc).toMatch(/minWidth:\s*900/);
    expect(mainSrc).toMatch(/minHeight:\s*600/);
    expect(mainSrc).toMatch(/autoHideMenuBar:\s*true/);
    expect(mainSrc).toMatch(/Menu\.setApplicationMenu\(null\)/);
    expect(mainSrc).toMatch(/icon:\s*/);
  });

  test('system tray is configured with menu, minimize-to-tray handling, and clean process termination', () => {
    const mainSrc = fs.readFileSync(mainJsPath, 'utf8');

    expect(mainSrc).toContain('Tray');
    expect(mainSrc).toMatch(/minimizeToTray/);
    expect(mainSrc).toMatch(/tray\.setToolTip/);
    expect(mainSrc).toMatch(/tray\.setContextMenu/);

    // Verify cleanup stops helper process, server, and destroys tray
    expect(mainSrc).toMatch(/function cleanupAll/);
    expect(mainSrc).toMatch(/stopPythonHelper/);
    expect(mainSrc).toMatch(/screenTranslator.*unregister/);
    expect(mainSrc).toMatch(/tray.*destroy/);
    expect(mainSrc).toMatch(/app\.on\(['"]before-quit['"]/);
    expect(mainSrc).toMatch(/app\.on\(['"]will-quit['"]/);
  });
});
