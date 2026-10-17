'use strict';

/**
 * Item 5: Third-party licenses, documentation, and overview validation.
 * Asserts:
 * - docs/THIRD_PARTY.md documents Whisper models, Transformers.js, ONNX Runtime Web,
 *   NLLB non-commercial notice (CC BY-NC 4.0), M2M-100, mBART-50, and FFmpeg not bundled.
 * - docs/THIRD_PARTY.md preserves existing entries (PDF.js, Piper, JSZip, Vazirmatn).
 * - docs/OVERVIEW.md documents the Media tab and states the extension excludes it.
 * - README.md tab list includes the Media tab.
 * - docs/media-merge/ reference documents remain intact.
 */

const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/fixtures');

const ROOT = path.resolve(__dirname, '../..');

test.describe('Documentation & Third-Party Licences (Media module)', () => {
  test('docs/THIRD_PARTY.md documents Whisper, NLLB non-commercial, Transformers.js, and other media runtime parts', () => {
    const thirdPartyPath = path.join(ROOT, 'docs', 'THIRD_PARTY.md');
    expect(fs.existsSync(thirdPartyPath), 'docs/THIRD_PARTY.md must exist').toBe(true);

    const content = fs.readFileSync(thirdPartyPath, 'utf8');

    // 1. Whisper models
    expect(content).toMatch(/Whisper/i);
    expect(content).toMatch(/OpenAI/i);

    // 2. NLLB non-commercial note
    expect(content).toMatch(/NLLB-200/i);
    expect(content).toMatch(/CC BY-NC 4\.0|Non-Commercial/i);

    // 3. Transformers.js and ONNX Runtime Web
    expect(content).toMatch(/Transformers\.js/i);
    expect(content).toMatch(/ONNX Runtime Web/i);

    // 4. M2M-100 and mBART-50
    expect(content).toMatch(/M2M-100/i);
    expect(content).toMatch(/mBART-50/i);

    // 5. FFmpeg not bundled
    expect(content).toMatch(/FFmpeg/i);
    expect(content).toMatch(/NOT bundled|NOT distributed|not included/i);

    // 6. Existing third-party entries must not have been removed
    expect(content).toMatch(/PDF\.js/i);
    expect(content).toMatch(/Piper/i);
    expect(content).toMatch(/JSZip/i);
    expect(content).toMatch(/Vazirmatn/i);
  });

  test('docs/OVERVIEW.md has Media tab section and notes extension exclusion', () => {
    const overviewPath = path.join(ROOT, 'docs', 'OVERVIEW.md');
    expect(fs.existsSync(overviewPath), 'docs/OVERVIEW.md must exist').toBe(true);

    const content = fs.readFileSync(overviewPath, 'utf8');

    // Media tab section
    expect(content).toMatch(/###.*Media tab/i);
    expect(content).toMatch(/Whisper/i);
    expect(content).toMatch(/translateItems/i);
    expect(content).toMatch(/media\/media-ui\.js/i);

    // Extension does not include media module
    expect(content).toMatch(/extension does not include/i);
  });

  test('README.md lists Media tab in web app description', () => {
    const readmePath = path.join(ROOT, 'README.md');
    expect(fs.existsSync(readmePath), 'README.md must exist').toBe(true);

    const content = fs.readFileSync(readmePath, 'utf8');
    expect(content).toMatch(/Media/i);
  });

  test('docs/media-merge/ reference documents are kept in the repository', () => {
    const mergeGuidePath = path.join(ROOT, 'docs', 'media-merge', 'MERGE_GUIDE.md');
    const mergeOverviewPath = path.join(ROOT, 'docs', 'media-merge', 'OVERVIEW.md');
    const mergeThirdPartyPath = path.join(ROOT, 'docs', 'media-merge', 'THIRD_PARTY.md');

    expect(fs.existsSync(mergeGuidePath), 'MERGE_GUIDE.md must exist').toBe(true);
    expect(fs.existsSync(mergeOverviewPath), 'OVERVIEW.md must exist').toBe(true);
    expect(fs.existsSync(mergeThirdPartyPath), 'THIRD_PARTY.md must exist').toBe(true);
  });
});
