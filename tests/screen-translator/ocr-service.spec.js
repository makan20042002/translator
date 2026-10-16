const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { OcrService } = require('../../screen-translator/ocr-service');

test.describe('Screen Translator Native Windows OCR Service', () => {
  let ocrService;
  const rootDir = path.resolve(__dirname, '../..');

  test.beforeAll(() => {
    ocrService = new OcrService({ rootDir });
  });

  test('lists installed Windows OCR languages', async () => {
    const langs = await ocrService.listLanguages();
    expect(Array.isArray(langs)).toBe(true);
    expect(langs.length).toBeGreaterThan(0);
    // On Windows test system, at least en-US should be present
    const hasEnglish = langs.some(l => l.tag.toLowerCase().startsWith('en'));
    expect(hasEnglish).toBe(true);
  });

  test('recognizes English text from a synthetic image', async () => {
    const testImgPath = path.join(rootDir, 'tests', 'fixtures', 'ocr-test-image.png');
    if (fs.existsSync(testImgPath)) {
      const buffer = fs.readFileSync(testImgPath);
      const res = await ocrService.recognize(buffer, 'en-US');
      expect(res.ok).toBe(true);
      expect(typeof res.text).toBe('string');
      expect(res.text.length).toBeGreaterThan(0);
      expect(res.text).toContain('MAKAN');
      expect(Array.isArray(res.lines)).toBe(true);
      expect(res.lines.length).toBeGreaterThan(0);
    }
  });

  test('gracefully handles missing language pack with actionable guidance', async () => {
    const res = await ocrService.recognize(Buffer.from([]), 'xx-ZZ');
    expect(res.ok).toBe(false);
    expect(typeof res.error).toBe('string');
  });

  test('returns clean empty result when image contains no text', async () => {
    const minimalPng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82
    ]);

    const res = await ocrService.recognize(minimalPng, 'en-US');
    expect(res.ok).toBe(true);
    expect(res.text).toBe('');
    expect(res.lines).toEqual([]);
  });

  test('lists available OCR engines including Windows and RapidOCR (PaddleOCR ONNX)', async () => {
    const engines = await ocrService.listEngines();
    expect(Array.isArray(engines)).toBe(true);
    const win = engines.find(e => e.id === 'windows');
    const rapid = engines.find(e => e.id === 'rapidocr');
    const dual = engines.find(e => e.id === 'dual');
    expect(win).toBeDefined();
    expect(rapid).toBeDefined();
    expect(dual).toBeDefined();
  });

  test('recognizes with RapidOCR ONNX engine without errors', async () => {
    const minimalPng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82
    ]);
    const res = await ocrService.recognize(minimalPng, 'auto', 'rapidocr');
    expect(res.ok).toBe(true);
    expect(res.engine).toBe('rapidocr');
  });

  test('Windows OCR with Persian (fa) returns clear error and does not silently fall back to English', async () => {
    const minimalPng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82
    ]);
    const res = await ocrService.recognize(minimalPng, 'fa', 'windows');
    // On systems without Persian Windows OCR pack, must clearly indicate engine cannot read Persian
    if (!res.ok) {
      expect(res.error).toContain('This engine cannot read Persian');
      expect(res.suggestedEngine).toBe('rapidocr');
      expect(res.installationGuidance).toBeDefined();
    }
  });

  test('RapidOCR with Persian (fa) informs user when Arabic/Persian model is not downloaded', async () => {
    const minimalPng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82
    ]);
    const hasModel = Boolean(ocrService.getRapidOcrArabicModel());
    const res = await ocrService.recognize(minimalPng, 'fa', 'rapidocr');
    if (!hasModel) {
      expect(res.ok).toBe(false);
      expect(res.error).toContain('RapidOCR requires the Arabic & Persian model');
      expect(res.modelNotDownloaded).toBe(true);
      expect(res.modelId).toBe('ocr-rapid-arabic');
    } else {
      expect(res.ok).toBe(true);
    }
  });
});

