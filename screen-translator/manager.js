/**
 * MAKAN Screen Translator - Lifecycle & Window Manager
 * Manages global hotkey, freeze-frame selection overlay, multi-engine OCR execution,
 * clipboard watcher, and floating translation panel.
 */

const electron = require('electron');
const { app, BrowserWindow, globalShortcut, screen, desktopCapturer, ipcMain, clipboard, shell } =
  (typeof electron === 'object' && electron !== null && electron.app) ? electron : (typeof electron === 'object' && electron !== null ? electron : {});
const path = require('path');
const fs = require('fs');
const { OcrService } = require('./ocr-service');
const { buildBrowserUrl } = require('./overlay-url');
const { LIVE_VIDEO_ENABLED } = require('./constants');

class ScreenTranslatorManager {
  constructor(mainWindow, options = {}) {
    this.mainWindow = mainWindow;
    this.rootDir = options.rootDir || path.resolve(__dirname, '..');
    this.ocrService = new OcrService({ rootDir: this.rootDir });
    
    this.captureWindow = null;
    this.overlayWindow = null;
    this.isCapturing = false;
    this.isPinned = false;

    this._frozenSnapshot = null;
    this._clipboardTimer = null;
    this._lastClipboardHash = null;
    this._clipboardInitialized = false;

    // Live video subtitle watcher state
    this.lastCapturedRect = null;
    this.isLiveWatching = false;
    this.liveWatchTimer = null;
    this._lastWatchedHash = '';
    this._lastWatchedText = '';
    this._pendingLiveStartAfterCapture = false;
    this.liveVideoEnabled = LIVE_VIDEO_ENABLED;

    // Default configuration
    this.config = {
      enabled: true,
      hotkey: 'CommandOrControl+Shift+S',
      targetLang: 'fa',
      ocrLang: 'auto',
      ocrEngine: 'auto', // 'auto' | 'windows' | 'rapidocr' | 'dual'
      ocrModel: 'ocr-rapid-arabic', // Chosen OCR recognition model
      returnToAppAfterCapture: false, // Return to app after capture (default off)
      freezeFrame: true, // Freeze screen snapshot while snipping
      clipboardWatcher: false, // Auto-translate screenshots from Win+Shift+S / Snipping Tool
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
    this.initClipboardWatcher();
  }

  isLiveVideoEnabled() {
    if (typeof this.liveVideoEnabled === 'boolean') {
      return this.liveVideoEnabled;
    }
    return LIVE_VIDEO_ENABLED;
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
      const oldWatcher = this.config.clipboardWatcher;

      this.config = Object.assign(this.config, newCfg);

      if (oldHotkey !== this.config.hotkey || oldEnabled !== this.config.enabled) {
        this.registerHotkey();
      }

      if (oldWatcher !== this.config.clipboardWatcher || oldEnabled !== this.config.enabled) {
        this.initClipboardWatcher();
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

    ipcMain.handle('screen-trans:get-engines', async () => {
      try {
        return await this.ocrService.listEngines();
      } catch (e) {
        return [
          { id: 'windows', name: 'Windows Media OCR (Native, Ultra-Fast)', available: true },
          { id: 'rapidocr', name: 'PaddleOCR / RapidOCR (ONNX Deep Learning)', available: true },
          { id: 'dual', name: 'Dual Engine (Windows + RapidOCR)', available: true }
        ];
      }
    });

    ipcMain.handle('screen-trans:get-config', () => {
      return this.config;
    });

    ipcMain.handle('screen-trans:save-config', (event, newCfg) => {
      return this.saveConfig(newCfg);
    });

    ipcMain.handle('screen-trans:save-ocr-model', async (event, payload) => {
      try {
        if (!payload || !payload.files) return { ok: false, error: 'No files provided' };
        let targetDir = path.join(this.rootDir, 'models', 'rapidocr');
        try {
          if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
          fs.accessSync(targetDir, fs.constants.W_OK);
        } catch {
          const baseAppData = process.env.APPDATA || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData', 'Roaming') : os.tmpdir());
          targetDir = path.join(baseAppData, 'makan-translate-desktop', 'models', 'rapidocr');
          if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        }
        for (const [fname, byteArr] of Object.entries(payload.files)) {
          const dest = path.join(targetDir, fname);
          fs.writeFileSync(dest, Buffer.from(byteArr));
        }
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    });

    ipcMain.on('screen-trans:start', (event, opts) => {
      console.log('[ScreenTranslator] Received screen-trans:start IPC with options:', opts ? JSON.stringify(opts) : 'none');
      this.startCapture(opts);
    });

    ipcMain.on('screen-trans:capture-complete', async (event, rect) => {
      await this.onCaptureComplete(rect);
    });

    ipcMain.on('screen-trans:capture-cancel', () => {
      this.closeCaptureWindow();
    });

    ipcMain.on('screen-trans:request-snapshot', () => {
      if (this._frozenSnapshot && this.captureWindow && !this.captureWindow.isDestroyed()) {
        this.captureWindow.webContents.send('screen-trans:snapshot', {
          dataUrl: this._frozenSnapshot.dataUrl
        });
      }
    });

    ipcMain.on('screen-trans:overlay-close', () => {
      console.log('[ScreenTranslator] Received screen-trans:overlay-close IPC');
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

    ipcMain.on('screen-trans:overlay-ready', () => {
      if (this._lastOcrResult) {
        this.sendToOverlay('ocr-result', this._lastOcrResult);
      }
    });

    ipcMain.on('screen-trans:open-in-browser', (event, payload) => {
      console.log('[ScreenTranslator] Received screen-trans:open-in-browser IPC');
      // Local dev fallback URL: http://127.0.0.1:50505
      const FIXED_PORT = 50505;
      const targetUrl = buildBrowserUrl(payload, 'https://makanlab.tech/translate/app/');
      try {
        const parsed = new URL(targetUrl);
        if (parsed.protocol === 'https:' && (parsed.hostname === 'makanlab.tech' || parsed.hostname.endsWith('.makanlab.tech'))) {
          console.log('[ScreenTranslator] Opening allow-listed URL in external browser:', targetUrl);
          shell.openExternal(targetUrl);
        } else if (parsed.protocol === 'http:' && parsed.hostname === '127.0.0.1' && (parsed.port === String(FIXED_PORT) || parsed.port === '8080')) {
          console.log('[ScreenTranslator] Opening allow-listed URL in external browser:', targetUrl);
          shell.openExternal(targetUrl);
        } else {
          console.warn('[ScreenTranslator] Blocked non-allow-listed URL attempt:', targetUrl);
        }
      } catch (err) {
        console.error('[ScreenTranslator] Failed to open external browser:', err);
      }
    });

    ipcMain.on('screen-trans:open-in-app', (event, { text, src, tgt }) => {
      console.log('[ScreenTranslator] Received screen-trans:open-in-app IPC');
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.show();
        if (this.mainWindow.isMinimized()) this.mainWindow.restore();
        this.mainWindow.focus();
        this.mainWindow.webContents.send('load-translation-input', { text, src, tgt });
      }
    });

    if (ipcMain && typeof ipcMain.on === 'function') {
      ipcMain.on('screen-trans:toggle-live-watcher', () => {
        if (!this.isLiveVideoEnabled()) return;
        this.toggleLiveWatcher();
      });

      ipcMain.on('screen-trans:reselect-zone', () => {
        if (!this.isLiveVideoEnabled()) return;
        this.reselectZone();
      });
    }
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

  /**
   * Clipboard Watcher: Automatically detects new images placed on clipboard
   * (e.g. from Windows Snipping Tool Win+Shift+S) and invokes OCR translation.
   */
  initClipboardWatcher() {
    if (this._clipboardTimer) {
      clearInterval(this._clipboardTimer);
      this._clipboardTimer = null;
    }

    if (!this.config.enabled || !this.config.clipboardWatcher) return;

    this._clipboardInitialized = false;
    this._lastClipboardHash = null;

    this._clipboardTimer = setInterval(() => {
      try {
        if (!this.config.enabled || !this.config.clipboardWatcher || this.isCapturing) return;

        const img = clipboard.readImage();
        if (!img || img.isEmpty()) return;

        const size = img.getSize();
        if (size.width < 25 || size.height < 25) return;

        const pngBuf = img.toPNG();
        const hash = `${size.width}x${size.height}_${pngBuf.length}_${pngBuf.slice(0, 16).toString('hex')}`;

        if (this._lastClipboardHash === hash) return;
        this._lastClipboardHash = hash;

        // Skip the very first existing image on startup
        if (!this._clipboardInitialized) {
          this._clipboardInitialized = true;
          return;
        }

        const cursorPoint = screen.getCursorScreenPoint ? screen.getCursorScreenPoint() : { x: 200, y: 200 };
        this.processImageBuffer(pngBuf, { x: cursorPoint.x, y: cursorPoint.y, width: 220, height: 120 });
      } catch (err) {
        // Suppress clipboard polling errors
      }
    }, 750);
  }

  unregister() {
    try {
      globalShortcut.unregisterAll();
    } catch {}
    if (this._clipboardTimer) {
      clearInterval(this._clipboardTimer);
      this._clipboardTimer = null;
    }
    this.stopLiveWatcher();
    this.closeCaptureWindow();
    this.closeOverlayWindow();
  }

  restoreMainWindowIfNeeded(reason = 'operation completed') {
    if (this._wasMainWindowVisible && this.mainWindow && !this.mainWindow.isDestroyed()) {
      console.log(`[ScreenTranslator] Restoring mainWindow (${reason})`);
      this.mainWindow.show();
      if (this.mainWindow.isMinimized()) this.mainWindow.restore();
      this.mainWindow.focus();
      this._wasMainWindowVisible = false;
    }
  }

  /**
   * Start region selection overlay across all monitors.
   */
  async startCapture(opts = {}) {
    console.log('[ScreenTranslator] startCapture invoked');
    if (this.isCapturing) {
      console.log('[ScreenTranslator] Already capturing, ignoring');
      return;
    }
    this.isCapturing = true;

    if (opts && typeof opts === 'object') {
      if (opts.targetLang) this.config.targetLang = opts.targetLang;
      if (opts.ocrLang) this.config.ocrLang = opts.ocrLang;
      if (opts.engine) this.config.engine = opts.engine;
      if (opts.freezeFrame !== undefined) this.config.freezeFrame = Boolean(opts.freezeFrame);
    }

    // Hide main app window (and settings modal inside it) before capturing screen
    this._wasMainWindowVisible = false;
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      const isVis = typeof this.mainWindow.isVisible === 'function' ? this.mainWindow.isVisible() : true;
      if (isVis) {
        this._wasMainWindowVisible = true;
        console.log('[ScreenTranslator] Hiding mainWindow for screen capture');
        this.mainWindow.hide();
        // Give window manager a moment to clear the window from the display buffer
        await new Promise(r => setTimeout(r, 150));
      } else {
        console.log('[ScreenTranslator] mainWindow was already hidden');
      }
    }

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

    // Pre-capture freeze-frame snapshot if enabled
    this._frozenSnapshot = null;
    if (this.config.freezeFrame !== false) {
      try {
        const primaryDisplay = screen.getPrimaryDisplay();
        const scale = primaryDisplay.scaleFactor || 1;
        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: {
            width: Math.round(primaryDisplay.bounds.width * scale),
            height: Math.round(primaryDisplay.bounds.height * scale)
          }
        });
        if (sources && sources.length > 0) {
          const matched = sources.find(s => s.display_id === String(primaryDisplay.id)) || sources[0];
          this._frozenSnapshot = {
            image: matched.thumbnail,
            display: primaryDisplay,
            scale,
            dataUrl: matched.thumbnail.toDataURL()
          };
        }
      } catch (e) {
        console.warn('[ScreenTranslator] Could not create freeze snapshot:', e);
      }
    }

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

    this.captureWindow.webContents.once('did-finish-load', () => {
      if (this._frozenSnapshot && this.captureWindow && !this.captureWindow.isDestroyed()) {
        this.captureWindow.webContents.send('screen-trans:snapshot', {
          dataUrl: this._frozenSnapshot.dataUrl
        });
      }
    });

    this.captureWindow.on('closed', () => {
      this.captureWindow = null;
      this.isCapturing = false;
      this._frozenSnapshot = null;
    });
  }

  closeCaptureWindow(keepMainWindowHidden = false) {
    console.log('[ScreenTranslator] Closing capture window, keepMainWindowHidden:', keepMainWindowHidden);
    if (this.captureWindow && !this.captureWindow.isDestroyed()) {
      this.captureWindow.close();
    }
    this.captureWindow = null;
    this.isCapturing = false;
    this._frozenSnapshot = null;
    if (!keepMainWindowHidden) {
      this.restoreMainWindowIfNeeded('capture cancelled or closed');
    }
  }

  /**
   * Handles user completed selection rectangle.
   */
  async onCaptureComplete(rect) {
    const frozen = this._frozenSnapshot;
    const hasValidRect = Boolean(rect && rect.width >= 8 && rect.height >= 8);
    console.log('[ScreenTranslator] onCaptureComplete, validRect:', hasValidRect, 'dimensions:', rect ? `${rect.width}x${rect.height}` : 'null');
    this.closeCaptureWindow(hasValidRect);

    if (!hasValidRect) {
      this.restoreMainWindowIfNeeded('invalid selection rect');
      return;
    }

    this.lastCapturedRect = rect;

    if (this._pendingLiveStartAfterCapture) {
      this._pendingLiveStartAfterCapture = false;
      if (this.isLiveVideoEnabled()) {
        this.startLiveWatcher(rect);
        return;
      }
    }

    let imageBuffer = null;

    // Crop from in-memory freeze snapshot if available (sub-millisecond instant crop)
    if (frozen && frozen.image) {
      try {
        const scale = frozen.scale || 1;
        const cropX = Math.max(0, Math.round(rect.x * scale));
        const cropY = Math.max(0, Math.round(rect.y * scale));
        const cropW = Math.min(frozen.image.getSize().width - cropX, Math.round(rect.width * scale));
        const cropH = Math.min(frozen.image.getSize().height - cropY, Math.round(rect.height * scale));

        if (cropW > 0 && cropH > 0) {
          const cropped = frozen.image.crop({ x: cropX, y: cropY, width: cropW, height: cropH });
          imageBuffer = cropped.toPNG();
        }
      } catch (e) {
        imageBuffer = null;
      }
    }

    // Fallback to desktopCapturer crop if freeze crop wasn't obtained
    if (!imageBuffer) {
      imageBuffer = await this.captureRegion(rect);
    }

    if (!imageBuffer) {
      console.log('[ScreenTranslator] Error: could not capture screen region buffer');
      this.showOverlayNear(rect);
      this.sendToOverlay('ocr-result', { ok: false, error: 'Could not capture screen region.' });
      this.restoreMainWindowIfNeeded('capture buffer error');
      return;
    }

    await this.processImageBuffer(imageBuffer, rect);

    // Make sure main window always comes back after result is ready
    this.restoreMainWindowIfNeeded('capture result ready');
  }

  /**
   * Processes an image buffer through OCR service and updates the floating overlay.
   */
  async processImageBuffer(imageBuffer, rect) {
    this.showOverlayNear(rect);

    try {
      const selectedEngine = this.config.ocrEngine || 'auto';
      const ocrResult = await this.ocrService.recognize(
        imageBuffer,
        this.config.ocrLang || 'auto',
        selectedEngine,
        this.config.ocrModel || 'ocr-rapid-arabic'
      );

      this._lastOcrResult = ocrResult;
      this.sendToOverlay('ocr-result', ocrResult);

      if (ocrResult.ok && ocrResult.text && this.config.autoCopy) {
        clipboard.writeText(ocrResult.text);
      }
    } catch (err) {
      this.sendToOverlay('ocr-result', { ok: false, error: err.message || 'Capture failed.' });
    }
  }

  /**
   * Capture screen region using desktopCapturer thumbnail cropping.
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
    const overlayWidth = 460;
    const overlayHeight = 300;

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
        minWidth: 360,
        minHeight: 220,
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
        console.log('[ScreenTranslator] overlayWindow on(closed) event fired');
        this.overlayWindow = null;
        this.restoreMainWindowIfNeeded('overlay closed');
      });
    } else {
      this.overlayWindow.setPosition(Math.round(posX), Math.round(posY));
      this.overlayWindow.show();
    }

    this.overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  }

  closeOverlayWindow() {
    console.log('[ScreenTranslator] Closing overlay window');
    this.stopLiveWatcher();
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.close();
    }
    this.overlayWindow = null;
    this.restoreMainWindowIfNeeded('overlay closed');
  }

  sendToOverlay(channel, data) {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      if (this.overlayWindow.webContents.isLoading()) {
        this.overlayWindow.webContents.once('did-finish-load', () => {
          if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
            this.overlayWindow.webContents.send(channel, data);
          }
        });
      } else {
        this.overlayWindow.webContents.send(channel, data);
      }
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
          console.log('[ScreenTranslator] Translation timed out after 15s');
          this.restoreMainWindowIfNeeded('translation timeout');
          resolve({ ok: false, error: 'Translation timed out. Please retry or click Open in App.' });
        }
      }, 15000);
    });

    this.mainWindow.webContents.send('execute-screen-translation', payload);

    const result = await promise;
    this.sendToOverlay('translation-result', result);

    if (result && result.ok && result.translation && this.config.autoCopy) {
      clipboard.writeText(result.translation);
    }
  }

  /**
   * Reselects screen zone for live subtitle watcher.
   */
  reselectZone() {
    if (!this.isLiveVideoEnabled()) return;
    this.stopLiveWatcher();
    this._pendingLiveStartAfterCapture = true;
    this.startCapture();
  }

  /**
   * Toggles live video subtitle watcher.
   */
  toggleLiveWatcher() {
    if (!this.isLiveVideoEnabled()) return;
    if (this.isLiveWatching) {
      this.stopLiveWatcher();
    } else {
      this.startLiveWatcher();
    }
  }

  /**
   * Starts continuously monitoring the subtitle zone, running OCR upon frame changes.
   */
  startLiveWatcher(rect = null) {
    if (!this.isLiveVideoEnabled()) return;
    const targetRect = rect || this.lastCapturedRect;
    if (!targetRect || targetRect.width < 10 || targetRect.height < 10) {
      this.reselectZone();
      return;
    }

    this.lastCapturedRect = targetRect;
    this.isLiveWatching = true;
    this._lastWatchedHash = '';
    this._lastWatchedText = '';

    this.showOverlayNear(this.lastCapturedRect);
    this.sendToOverlay('screen-trans:live-state', { active: true, rect: this.lastCapturedRect });

    if (this.liveWatchTimer) {
      clearTimeout(this.liveWatchTimer);
      this.liveWatchTimer = null;
    }

    const tick = async () => {
      if (!this.isLiveWatching || !this.lastCapturedRect) return;

      try {
        const imgBuf = await this.captureRegion(this.lastCapturedRect);
        if (imgBuf && imgBuf.length > 0) {
          const midIdx = Math.floor(imgBuf.length / 2);
          const head = imgBuf.slice(0, 16).toString('hex');
          const mid = imgBuf.slice(midIdx, midIdx + 16).toString('hex');
          const tail = imgBuf.slice(-16).toString('hex');
          const hash = `${imgBuf.length}_${head}_${mid}_${tail}`;

          if (hash !== this._lastWatchedHash) {
            this._lastWatchedHash = hash;

            const engine = this.config.ocrEngine || 'auto';
            const lang = this.config.ocrLang || 'auto';
            const ocrResult = await this.ocrService.recognize(imgBuf, lang, engine, this.config.ocrModel || 'ocr-rapid-arabic');

            if (this.isLiveWatching && ocrResult && ocrResult.ok && ocrResult.text) {
              const cleanText = ocrResult.text.trim();
              if (cleanText && cleanText !== this._lastWatchedText) {
                this._lastWatchedText = cleanText;
                this.sendToOverlay('ocr-result', ocrResult);
              }
            }
          }
        }
      } catch (err) {
        console.warn('[ScreenTranslator] Live watcher tick error:', err);
      }

      if (this.isLiveWatching) {
        this.liveWatchTimer = setTimeout(tick, 600);
      }
    };

    this.liveWatchTimer = setTimeout(tick, 250);
  }

  /**
   * Stops live video watcher.
   */
  stopLiveWatcher() {
    this.isLiveWatching = false;
    if (this.liveWatchTimer) {
      clearTimeout(this.liveWatchTimer);
      this.liveWatchTimer = null;
    }
    this.sendToOverlay('screen-trans:live-state', { active: false });
  }
}

module.exports = { ScreenTranslatorManager };
