const { test, expect } = require('@playwright/test');

// Test geometric calculations used in ScreenTranslatorManager
test.describe('Screen Translator Coordinate and Placement Helpers', () => {

  function calculateOverlayPosition(rect, workArea, overlayWidth = 420, overlayHeight = 280) {
    let posX = rect.x;
    let posY = rect.y + rect.height + 12;

    // Flip above selection if overflowing bottom workArea
    if (posY + overlayHeight > workArea.y + workArea.height) {
      posY = Math.max(workArea.y + 8, rect.y - overlayHeight - 12);
    }

    // Clamp horizontal
    if (posX + overlayWidth > workArea.x + workArea.width) {
      posX = workArea.x + workArea.width - overlayWidth - 8;
    }
    if (posX < workArea.x + 8) {
      posX = workArea.x + 8;
    }

    return { x: Math.round(posX), y: Math.round(posY) };
  }

  function calculateCropRect(rect, displayBounds, scaleFactor = 1) {
    const relX = rect.x - displayBounds.x;
    const relY = rect.y - displayBounds.y;

    const cropX = Math.max(0, Math.round(relX * scaleFactor));
    const cropY = Math.max(0, Math.round(relY * scaleFactor));
    const cropW = Math.round(rect.width * scaleFactor);
    const cropH = Math.round(rect.height * scaleFactor);

    return { cropX, cropY, cropW, cropH };
  }

  test('positions overlay beneath selection when ample space exists', () => {
    const workArea = { x: 0, y: 0, width: 1920, height: 1080 };
    const rect = { x: 200, y: 200, width: 400, height: 100 };
    const pos = calculateOverlayPosition(rect, workArea);

    expect(pos.x).toBe(200);
    expect(pos.y).toBe(312); // 200 + 100 + 12
  });

  test('flips overlay above selection when bottom overflow occurs', () => {
    const workArea = { x: 0, y: 0, width: 1920, height: 1080 };
    const rect = { x: 200, y: 900, width: 400, height: 100 };
    const pos = calculateOverlayPosition(rect, workArea);

    // 900 - 280 - 12 = 608
    expect(pos.y).toBe(608);
  });

  test('clamps horizontal position when selection is near right edge of screen', () => {
    const workArea = { x: 0, y: 0, width: 1920, height: 1080 };
    const rect = { x: 1800, y: 200, width: 100, height: 50 };
    const pos = calculateOverlayPosition(rect, workArea);

    // Should clamp to 1920 - 420 - 8 = 1492
    expect(pos.x).toBe(1492);
  });

  test('handles multi-monitor negative coordinates correctly for secondary display', () => {
    // Left secondary monitor at x: -1920, y: 0
    const displayBounds = { x: -1920, y: 0, width: 1920, height: 1080 };
    const rect = { x: -1500, y: 300, width: 300, height: 150 };

    const crop = calculateCropRect(rect, displayBounds, 1.25); // 125% DPI
    // relX = -1500 - (-1920) = 420
    // relY = 300 - 0 = 300
    expect(crop.cropX).toBe(Math.round(420 * 1.25));
    expect(crop.cropY).toBe(Math.round(300 * 1.25));
    expect(crop.cropW).toBe(Math.round(300 * 1.25));
    expect(crop.cropH).toBe(Math.round(150 * 1.25));
  });
});
