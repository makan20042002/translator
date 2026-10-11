const { test, expect } = require('@playwright/test');

// Test window visibility behavior during screen capture in ScreenTranslatorManager
test.describe('Screen Translator Window Visibility and Return to App', () => {

  function createMockManager(config = {}) {
    let windowVisible = true;
    let windowShownCount = 0;
    let windowHiddenCount = 0;

    const mockMainWindow = {
      isDestroyed: () => false,
      isVisible: () => windowVisible,
      hide: () => {
        windowVisible = false;
        windowHiddenCount++;
      },
      show: () => {
        windowVisible = true;
        windowShownCount++;
      }
    };

    const state = {
      mainWindow: mockMainWindow,
      config: {
        returnToAppAfterCapture: false,
        ...config
      },
      _wasMainWindowVisible: false,
      overlayWindowShown: false,

      // Simulated startCapture window-hiding logic
      async startCapture() {
        this._wasMainWindowVisible = false;
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          const isVis = typeof this.mainWindow.isVisible === 'function' ? this.mainWindow.isVisible() : true;
          if (isVis) {
            this._wasMainWindowVisible = true;
            this.mainWindow.hide();
          }
        }
      },

      // Simulated cancel logic
      closeCaptureWindow() {
        if (this._wasMainWindowVisible && this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.show();
          this._wasMainWindowVisible = false;
        }
      },

      // Simulated capture complete logic
      async onCaptureComplete(rect) {
        const hadMainWindowVisible = this._wasMainWindowVisible;
        this._wasMainWindowVisible = false;
        this.closeCaptureWindow();

        if (!rect || rect.width < 8 || rect.height < 8) {
          if (hadMainWindowVisible && this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.show();
          }
          return;
        }

        // Overlay is displayed with OCR results
        this.overlayWindowShown = true;

        // Window must NOT jump back on top unless returnToAppAfterCapture is enabled
        if (this.config.returnToAppAfterCapture && this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.show();
        }
      }
    };

    return { state, getVis: () => windowVisible, getShownCount: () => windowShownCount, getHiddenCount: () => windowHiddenCount };
  }

  test('startCapture hides main window before capturing screen', async () => {
    const { state, getVis, getHiddenCount } = createMockManager({ returnToAppAfterCapture: false });
    expect(getVis()).toBe(true);

    await state.startCapture();
    expect(getVis()).toBe(false);
    expect(getHiddenCount()).toBe(1);
    expect(state._wasMainWindowVisible).toBe(true);
  });

  test('onCaptureComplete leaves main window hidden by default (returnToAppAfterCapture = false)', async () => {
    const { state, getVis, getShownCount } = createMockManager({ returnToAppAfterCapture: false });
    await state.startCapture();
    expect(getVis()).toBe(false);

    await state.onCaptureComplete({ x: 100, y: 100, width: 200, height: 100 });
    // Overlay is shown, but main window must NOT jump back on top
    expect(state.overlayWindowShown).toBe(true);
    expect(getVis()).toBe(false);
    expect(getShownCount()).toBe(0);
  });

  test('onCaptureComplete restores main window when returnToAppAfterCapture is enabled', async () => {
    const { state, getVis, getShownCount } = createMockManager({ returnToAppAfterCapture: true });
    await state.startCapture();
    expect(getVis()).toBe(false);

    await state.onCaptureComplete({ x: 100, y: 100, width: 200, height: 100 });
    expect(state.overlayWindowShown).toBe(true);
    expect(getVis()).toBe(true);
    expect(getShownCount()).toBe(1);
  });

  test('closeCaptureWindow restores main window if capture was cancelled without completing', async () => {
    const { state, getVis, getShownCount } = createMockManager({ returnToAppAfterCapture: false });
    await state.startCapture();
    expect(getVis()).toBe(false);

    state.closeCaptureWindow();
    expect(getVis()).toBe(true);
    expect(getShownCount()).toBe(1);
  });
});
