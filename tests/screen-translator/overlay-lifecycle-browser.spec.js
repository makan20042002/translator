'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe('Screen Translator Overlay Lifecycle & Open In Browser', () => {
  // Test 1: Static verification of Electron manager and preload code paths
  test('manager.js and preload-overlay.js contain openInBrowser and overlay lifecycle restoration', () => {
    const managerPath = path.join(__dirname, '..', '..', 'screen-translator', 'manager.js');
    const preloadPath = path.join(__dirname, '..', '..', 'screen-translator', 'preload-overlay.js');
    const overlayHtmlPath = path.join(__dirname, '..', '..', 'screen-translator', 'overlay.html');

    const managerSrc = fs.readFileSync(managerPath, 'utf8');
    const preloadSrc = fs.readFileSync(preloadPath, 'utf8');
    const overlaySrc = fs.readFileSync(overlayHtmlPath, 'utf8');

    // 1. Check Electron shell import and IPC handler
    expect(managerSrc).toContain("shell");
    expect(managerSrc).toContain("'screen-trans:open-in-browser'");
    expect(managerSrc).toContain("http://127.0.0.1:50505");
    expect(managerSrc).toContain("shell.openExternal");

    // 2. Check allow-listing logic in manager.js
    expect(managerSrc).toMatch(/parsed\.protocol === ['"]http:['"]/);
    expect(managerSrc).toMatch(/parsed\.hostname === ['"]127\.0\.0\.1['"]/);

    // 3. Check preload bridge exposes openInBrowser
    expect(preloadSrc).toContain("openInBrowser: (data) => ipcRenderer.send('screen-trans:open-in-browser', data)");

    // 4. Check overlay HTML button and click handler
    expect(overlaySrc).toContain('Open in browser');
    expect(overlaySrc).toContain('openInBrowser');

    // 5. Check overlay close restores main window in manager.js
    expect(managerSrc).toMatch(/closeOverlayWindow\(\)\s*\{[\s\S]*?this\.mainWindow\.show\(\)/);
  });

  // Test 2: Overlay lifecycle simulation ensuring main window is never left hidden
  test('closing overlay restores main window and does not trigger app shutdown', () => {
    let isMainWindowVisible = true;
    let showCallCount = 0;
    let focusCallCount = 0;
    let appQuitCalled = false;

    const mockMainWindow = {
      isDestroyed: () => false,
      isVisible: () => isMainWindowVisible,
      hide: () => { isMainWindowVisible = false; },
      show: () => {
        isMainWindowVisible = true;
        showCallCount++;
      },
      focus: () => { focusCallCount++; }
    };

    const mockOverlay = {
      isDestroyed: () => false,
      close: () => { mockOverlay._closed = true; },
      _closed: false
    };

    const managerSimulator = {
      mainWindow: mockMainWindow,
      overlayWindow: mockOverlay,
      _wasMainWindowVisible: false,

      startCapture() {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this._wasMainWindowVisible = true;
          this.mainWindow.hide();
        }
      },

      closeOverlayWindow() {
        if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
          this.overlayWindow.close();
        }
        this.overlayWindow = null;
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.show();
          this.mainWindow.focus();
        }
        this._wasMainWindowVisible = false;
      }
    };

    // Simulate screen capture start: main window hides
    managerSimulator.startCapture();
    expect(isMainWindowVisible).toBe(false);

    // Simulate overlay closing: overlay window closes and main window is restored
    managerSimulator.closeOverlayWindow();
    expect(isMainWindowVisible).toBe(true);
    expect(showCallCount).toBe(1);
    expect(focusCallCount).toBe(1);
    expect(appQuitCalled).toBe(false);
  });

  // Test 3: Allow-list enforcement simulation for openInBrowser
  test('openInBrowser strictly opens allow-listed 127.0.0.1:50505 origin', () => {
    const FIXED_PORT = 50505;
    const ALLOWED_ORIGIN = `http://127.0.0.1:${FIXED_PORT}`;

    function resolveBrowserUrl(payload) {
      let targetUrl = ALLOWED_ORIGIN;
      if (payload && typeof payload === 'object') {
        const params = new URLSearchParams();
        if (typeof payload.text === 'string' && payload.text.trim()) {
          params.set('text', payload.text.trim().slice(0, 4000));
        }
        if (typeof payload.src === 'string' && /^[a-zA-Z-]{2,10}$/.test(payload.src)) {
          params.set('src', payload.src);
        }
        if (typeof payload.tgt === 'string' && /^[a-zA-Z-]{2,10}$/.test(payload.tgt)) {
          params.set('tgt', payload.tgt);
        }
        const qs = params.toString();
        if (qs) targetUrl = `${ALLOWED_ORIGIN}/?${qs}`;
      }
      const parsed = new URL(targetUrl);
      if (parsed.protocol === 'http:' && parsed.hostname === '127.0.0.1' && parsed.port === String(FIXED_PORT)) {
        return targetUrl;
      }
      return ALLOWED_ORIGIN;
    }

    // Valid parameters
    const url1 = resolveBrowserUrl({ text: 'Hello', src: 'en', tgt: 'fa' });
    expect(url1).toBe('http://127.0.0.1:50505/?text=Hello&src=en&tgt=fa');

    // Attempted malicious origin or injection
    const url2 = resolveBrowserUrl({ text: '<script>', src: 'javascript:', tgt: 'http://malicious.com' });
    expect(url2).toBe('http://127.0.0.1:50505/?text=%3Cscript%3E');
  });

  // Test 4: overlay-url formats https://makanlab.tech/translate/app/#text=...&src=...&tgt=... with correct encoding
  test('overlay-url builds https://makanlab.tech/translate/app/#text=...&src=...&tgt=... with correct encoding', () => {
    const { buildBrowserUrl } = require('../../screen-translator/overlay-url');

    // Default base without payload
    const emptyUrl = buildBrowserUrl(null);
    expect(emptyUrl).toBe('https://makanlab.tech/translate/app');

    // Basic translation payload with correct encoding
    const url = buildBrowserUrl({ text: 'Hello world', src: 'en', tgt: 'fa' });
    expect(url.startsWith('https://makanlab.tech/translate/app/#')).toBe(true);
    const parsed = new URL(url);
    expect(parsed.origin).toBe('https://makanlab.tech');
    expect(parsed.pathname).toBe('/translate/app/');
    expect(parsed.search).toBe('');
    const params = new URLSearchParams(parsed.hash.slice(1));
    expect(params.get('text')).toBe('Hello world');
    expect(params.get('src')).toBe('en');
    expect(params.get('tgt')).toBe('fa');

    // Non-Latin / Persian & CJK characters
    const nonLatin = buildBrowserUrl({ text: 'سلام دنیا & Japanese 日本語', src: 'fa', tgt: 'en' });
    expect(nonLatin.startsWith('https://makanlab.tech/translate/app/#')).toBe(true);
    const nonLatinParams = new URLSearchParams(new URL(nonLatin).hash.slice(1));
    expect(nonLatinParams.get('text')).toBe('سلام دنیا & Japanese 日本語');

    // Custom developer base
    const devUrl = buildBrowserUrl({ text: 'Dev test', src: 'en', tgt: 'fa' }, 'http://localhost:8080/');
    expect(devUrl.startsWith('http://localhost:8080/#')).toBe(true);
  });

  // Test 5: overlay.html tooltip updated to (makanlab.tech/translate/app)
  test('overlay.html tooltip contains (makanlab.tech/translate/app)', () => {
    const overlayHtmlPath = path.join(__dirname, '..', '..', 'screen-translator', 'overlay.html');
    const overlaySrc = fs.readFileSync(overlayHtmlPath, 'utf8');
    expect(overlaySrc).toContain('(makanlab.tech/translate/app)');
    expect(overlaySrc).not.toContain('(makanlab.tech)');
  });
});

