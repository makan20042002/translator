'use strict';
/**
 * Generates tests/fixtures/ocr-test-image.png with clear English text
 * ("MAKAN\nHello World OCR Test") for native OCR verification.
 * Dependency-free script using Windows System.Drawing or Python.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const FIXTURE_DIR = path.resolve(__dirname, '..', 'fixtures');
const FIXTURE_PATH = path.join(FIXTURE_DIR, 'ocr-test-image.png');

function makeOcrFixture(targetPath = FIXTURE_PATH) {
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 1. Try Windows built-in System.Drawing via PowerShell (zero external dependencies)
  try {
    const psCommand = `
      Add-Type -AssemblyName System.Drawing
      $bmp = New-Object System.Drawing.Bitmap 480, 160
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      $g.Clear([System.Drawing.Color]::White)
      $fontL = New-Object System.Drawing.Font('Arial', 32, [System.Drawing.FontStyle]::Bold)
      $fontS = New-Object System.Drawing.Font('Arial', 20, [System.Drawing.FontStyle]::Regular)
      $brush = [System.Drawing.Brushes]::Black
      $g.DrawString('MAKAN', $fontL, $brush, 30, 20)
      $g.DrawString('Hello World OCR Test', $fontS, $brush, 30, 85)
      $g.Dispose()
      $bmp.Save($env:OCR_FIXTURE_OUT, [System.Drawing.Imaging.ImageFormat]::Png)
      $bmp.Dispose()
    `;
    execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCommand], {
      env: { ...process.env, OCR_FIXTURE_OUT: targetPath },
      stdio: 'pipe'
    });
    if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 0) {
      return targetPath;
    }
  } catch (err) {
    // Fall back to Python if PowerShell failed
  }

  // 2. Fallback to Python with PIL if available
  try {
    const pyCode = `
import sys
from PIL import Image, ImageDraw, ImageFont
img = Image.new('RGB', (480, 160), color=(255, 255, 255))
draw = ImageDraw.Draw(img)
try:
    font_large = ImageFont.truetype('arial.ttf', 36)
    font_small = ImageFont.truetype('arial.ttf', 24)
except Exception:
    font_large = ImageFont.load_default()
    font_small = ImageFont.load_default()
draw.text((30, 25), 'MAKAN', fill=(0, 0, 0), font=font_large)
draw.text((30, 85), 'Hello World OCR Test', fill=(0, 0, 0), font=font_small)
img.save(sys.argv[1], 'PNG')
`;
    execFileSync('python', ['-c', pyCode, targetPath], { stdio: 'pipe' });
    if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 0) {
      return targetPath;
    }
  } catch (err) {
    // Both attempts failed
  }

  throw new Error(`Failed to generate OCR fixture at: ${targetPath}`);
}

module.exports = { makeOcrFixture, FIXTURE_PATH, FIXTURE_DIR };

if (require.main === module) {
  const generated = makeOcrFixture();
  console.log(`OCR fixture generated at: ${generated}`);
}
