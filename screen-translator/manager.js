/**
 * MAKAN Screen Translator - Lifecycle & Window Manager
 * Manages global hotkey, selection overlay, OCR execution, and floating translation panel.
 */

const { app, BrowserWindow, globalShortcut, screen, desktopCapturer, ipcMain, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const { OcrService } = require('./ocr-service');

class ScreenTranslatorManager {
  constructor(mainWindow, options = {}) {
    this.mainWindow = mainWindow;
    this.rootDir = options.rootDir || path.resolve(__dirname, '..');
    this.ocrService = new OcrService({ rootDir: this.rootDir });
    
    this.captureWindow = null;
    this.overlayWindow = null;
    this.isCapturing = false;
    this.isPinned = false;

    // Default configuration
    this.config = {
      enabled: true,
      hotkey: 'CommandOrControl+Shift+S',
      targetLang: 'fa',
      ocrLang: 'auto',
      engine: 'auto',
      autoCloseSeconds: 0,
      autoCopy: false,
      saveHistory: false,
      opacity: 0.96,
      fontSize: 14.5
    };

    try {
      this.configPath = path.join(app.getPath('userData'), 'screen-translator.json');
      this.loadConfig();
    } catch {
      this.configPath = null;
    }

    this._pendingTranslations = new Map();
    this._transIdCounter = 0;

    this.initIpc();
  }

  loadConfig() {
    try {
      if (this.configPath && fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.config = Object.assign(this.config, parsed);
        }
      }
    } catch (e) {
      console.warn('[ScreenTranslator] Could not load saved config:', e);
    }
  }

  saveConfig(newCfg) {
    if (newCfg && typeof newCfg === 'object') {
      const oldHotkey = this.config.hotkey;
      const oldEnabled = this.config.enabled;
      this.config = Object.assign(this.config, newCfg);

      if (oldHotkey !== this.config.hotkey || oldEnabled !== this.config.enabled) {
        this.registerHotkey();
      }

      if (this.configPath) {
        try {
          fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
        } catch (e) {
          console.warn('[ScreenTranslator] Could not write config to disk:', e);
        }
      }
    }
    return { ok: true, config: this.config };
  }

  /**
   * Initialize IPC handlers between main process and renderer windows.
   */
  initIpc() {
    ipcMain.handle('screen-trans:get-languages', async () => {
      try {
        return await this.ocrService.listLanguages();
      } catch (e) {
        return [{ tag: 'en-US', displayName: 'English (United States)', nativeName: 'English (United States)' }];
      }
    });

    ipcMain.handle('screen-trans:get-config', () => {
      return this.config;
    });

    ipcMain.handle('screen-trans:save-config', (event, newCfg) => {
      return this.saveConfig(newCfg);
    });

    ipcMain.on('screen-trans:start', () => {
      this.startCapture();
    });

    ipcMain.on('screen-trans:capture-complete', async (event, rect) => {
      await this.onCaptureComplete(rect);
    });

    ipcMain.on('screen-trans:capture-cancel', () => {
      this.closeCaptureWindow();
    });

    ipcMain.on('screen-trans:overlay-close', () => {
      this.closeOverlayWindow();
    });

    ipcMain.on('screen-trans:overlay-pin', (event, pinned) => {
      this.isPinned = !!pinned;
      if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        this.overlayWindow.setAlwaysOnTop(true, 'screen-saver');
      }
    });

    ipcMain.on('screen-trans:request-translate', (event, req) => {
      this.requestTranslationFromMain(req);
    });

    ipcMain.on('screen-trans:translation-response', (event, resp) => {
      if (resp && resp.id && this._pendingTranslations.has(resp.id)) {
        const resolve = this._pendingTranslations.get(resp.id);
        this._pendingTranslations.delete(resp.id);
        resolve(resp);
      }
    });

    ipcMain.on('screen-trans:open-in-app', (event, { text, src, tgt }) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        if (this.mainWindow.isMinimized()) this.mainWindow.restore();
        this.mainWindow.focus();
        this.mainWindow.webContents.send('load-translation-input', { text, src, tgt });
      }
    });
  }

  /**
   * Register global hotkey for screen translation.
   */
  registerHotkey() {
    try {
      globalShortcut.unregisterAll();
    } catch {}

    if (!this.config.enabled || !this.config.hotkey) return;

    try {
      const ok = globalShortcut.register(this.config.hotkey, () => {
        this.startCapture();
      });
      if (!ok) {
        console.warn(`[ScreenTranslator] Hotkey conflict: Could not register ${this.config.hotkey}`);
      } else {
        console.log(`[ScreenTranslator] Global hotkey registered: ${this.config.hotkey}`);
      }
    } catch (e) {
      console.error('[ScreenTranslator] Error registering hotkey:', e);
    }
  }

  unregister() {
    try {
      globalShortcut.unregisterAll();
    } catch {}
    this.closeCaptureWindow();
    this.closeOverlayWindow();
  }

  /**
   * Start region selection overlay across all monitors.
   */
  async startCapture() {
    if (this.isCapturing) return;
    this.isCapturing = true;

    // Hide existing overlay while selecting new region
    if (this.overlayWindow && !this.overlayWindow.isDestroyed() && !this.isPinned) {
      this.overlayWindow.hide();
    }

    const displays = screen.getAllDisplays();
    const minX = Math.min(...displays.map(d => d.bounds.x));
    const minY = Math.min(...displays.map(d => d.bounds.y));
    const maxX = Math.max(...displays.map(d => d.bounds.x + d.bounds.width));
    const maxY = Math.max(...displays.map(d => d.bounds.y + d.bounds.height));

    const totalWidth = maxX - minX;
    const totalHeight = maxY - minY;

    this.captureWindow = new BrowserWindow({
      x: minX,
      y: minY,
      width: totalWidth,
      height: totalHeight,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      hasShadow: false,
      enableLargerThanScreen: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload-capture.js')
      }
    });

    this.captureWindow.setAlwaysOnTop(true, 'screen-saver');
    this.captureWindow.loadFile(path.join(__dirname, 'capture.html'));

    this.captureWindow.on('closed', () => {
      this.captureWindow = null;
      this.isCapturing = false;
    });
  }

  closeCaptureWindow() {
    if (this.captureWindow && !this.captureWindow.isDestroyed()) {
      this.captureWindow.close();
    }
    this.captureWindow = null;
    this.isCapturing = false;
  }

  /**
   * Handles user completed selection rectangle.
   */
  async onCaptureComplete(rect) {
    this.closeCaptureWindow();
    if (!rect || rect.width < 8 || rect.height < 8) return;

    // Open floating overlay immediately near the region in loading state
    this.showOverlayNear(rect);

    try {
      // Capture the screen region
      const imageBuffer = await this.captureRegion(rect);
      if (!imageBuffer) {
        this.sendToOverlay('ocr-result', { ok: false, error: 'Could not capture screen region.' });
        return;
      }

      // Run Windows OCR
      const ocrResult = await this.ocrService.recognize(imageBuffer, this.config.ocrLang || 'auto');
      this.sendToOverlay('ocr-result', ocrResult);

      if (ocrResult.ok && ocrResult.text && this.config.autoCopy) {
        // If auto-copy raw or translation
      }
    } catch (err) {
      this.sendToOverlay('ocr-result', { ok: false, error: err.message || 'Capture failed.' });
    }
  }

  /**
   * Capture screen region using desktopCapturer thumbnail cropping or native fallback.
   */
  async captureRegion(rect) {
    try {
      const currentDisplay = screen.getDisplayNearestPoint({ x: rect.x, y: rect.y });
      const scale = currentDisplay.scaleFactor || 1;

      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: Math.round(currentDisplay.bounds.width * scale),
          height: Math.round(currentDisplay.bounds.height * scale)
        }
      });

      if (!sources || sources.length === 0) return null;

      // Find matching source by display_id if available, otherwise first
      const matchedSource = sources.find(s => s.display_id === String(currentDisplay.id)) || sources[0];
      const screenImage = matchedSource.thumbnail;

      const relX = rect.x - currentDisplay.bounds.x;
      const relY = rect.y - currentDisplay.bounds.y;

      const cropX = Math.max(0, Math.round(relX * scale));
      const cropY = Math.max(0, Math.round(relY * scale));
      const cropW = Math.min(screenImage.getSize().width - cropX, Math.round(rect.width * scale));
      const cropH = Math.min(screenImage.getSize().height - cropY, Math.round(rect.height * scale));

      if (cropW <= 0 || cropH <= 0) return null;

      const cropped = screenImage.crop({ x: cropX, y: cropY, width: cropW, height: cropH });
      return cropped.toPNG();
    } catch (e) {
      console.warn('[ScreenTranslator] desktopCapturer crop error, falling back:', e);
      return null;
    }
  }

  /**
   * Show or reposition floating translation overlay window near the selected box.
   */
  showOverlayNear(rect) {
    const overlayWidth = 420;
    const overlayHeight = 280;

    const currentDisplay = screen.getDisplayNearestPoint({ x: rect.x, y: rect.y });
    const bounds = currentDisplay.workArea;

    let posX = rect.x;
    let posY = rect.y + rect.height + 12;

    // If bottom overflow, place above selection
    if (posY + overlayHeight > bounds.y + bounds.height) {
      posY = Math.max(bounds.y + 8, rect.y - overlayHeight - 12);
    }

    // Horizontal clamp
    if (posX + overlayWidth > bounds.x + bounds.width) {
      posX = bounds.x + bounds.width - overlayWidth - 8;
    }
    if (posX < bounds.x + 8) {
      posX = bounds.x + 8;
    }

    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
      this.overlayWindow = new BrowserWindow({
        x: Math.round(posX),
        y: Math.round(posY),
        width: overlayWidth,
        height: overlayHeight,
        minWidth: 320,
        minHeight: 200,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: false,
        hasShadow: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, 'preload-overlay.js')
        }
      });

      this.overlayWindow.loadFile(path.join(__dirname, 'overlay.html'));

      this.overlayWindow.on('closed', () => {
        this.overlayWindow = null;
      });
    } else {
      this.overlayWindow.setPosition(Math.round(posX), Math.round(posY));
      this.overlayWindow.show();
    }

    this.overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  }

  closeOverlayWindow() {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.close();
    }
    this.overlayWindow = null;
  }

  sendToOverlay(channel, data) {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.webContents.send(channel, data);
    }
  }

  /**
   * Delegates translation to existing pipeline in main renderer (translateItems).
   */
  async requestTranslationFromMain(req) {
    const transId = ++this._transIdCounter;
    const payload = {
      id: transId,
      text: req.text,
      src: req.src || 'auto',
      tgt: req.tgt || this.config.targetLang || 'fa',
      engine: req.engine || this.config.engine || 'auto'
    };

    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      this.sendToOverlay('translation-result', { ok: false, error: 'MAKAN main window is not available.' });
      return;
    }

    const promise = new Promise((resolve) => {
      this._pendingTranslations.set(transId, resolve);
      setTimeout(() => {
        if (this._pendingTranslations.has(transId)) {
          this._pendingTranslations.delete(transId);
          resolve({ ok: false, error: 'Translation timed out.' });
        }
      }, 30000);
    });

    this.mainWindow.webContents.send('execute-screen-translation', payload);

    const result = await promise;
    this.sendToOverlay('translation-result', result);

    if (result && result.ok && result.translation && this.config.autoCopy) {
      clipboard.writeText(result.translation);
    }
  }
}

module.exports = { ScreenTranslatorManager };
