/**
 * MAKAN Screen Translator - Native Windows OCR Service
 * Interfaces with native Windows.Media.Ocr.OcrEngine via MakanOcr.exe (with PowerShell fallback).
 */

const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');

class OcrService {
  constructor(options = {}) {
    this.rootDir = options.rootDir || path.resolve(__dirname, '..');
    this._cachedLanguages = null;
  }

  /**
   * Locate MakanOcr.exe binary or fallback script.
   */
  getOcrBinary() {
    const candidates = [
      path.join(this.rootDir, 'tools', 'bin', 'MakanOcr.exe'),
      path.join(__dirname, '..', 'tools', 'bin', 'MakanOcr.exe'),
      path.join(process.resourcesPath || '', 'tools', 'bin', 'MakanOcr.exe'),
      path.join(process.resourcesPath || '', 'app-web', 'tools', 'bin', 'MakanOcr.exe'),
      path.join(__dirname, '..', '..', 'translator', 'tools', 'bin', 'MakanOcr.exe'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  getFallbackScript() {
    const candidates = [
      path.join(this.rootDir, 'tools', 'ocr-bridge', 'ocr-fallback.ps1'),
      path.join(__dirname, '..', 'tools', 'ocr-bridge', 'ocr-fallback.ps1'),
      path.join(process.resourcesPath || '', 'tools', 'ocr-bridge', 'ocr-fallback.ps1'),
      path.join(process.resourcesPath || '', 'app-web', 'tools', 'ocr-bridge', 'ocr-fallback.ps1'),
      path.join(__dirname, '..', '..', 'translator', 'tools', 'ocr-bridge', 'ocr-fallback.ps1'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  /**
   * List available Windows OCR recognizer languages.
   * @returns {Promise<Array<{tag: string, displayName: string, nativeName: string}>>}
   */
  async listLanguages() {
    if (this._cachedLanguages && this._cachedLanguages.length > 0) {
      return this._cachedLanguages;
    }

    const bin = this.getOcrBinary();
    if (bin) {
      try {
        const out = await new Promise((resolve, reject) => {
          execFile(bin, ['--list-languages'], { encoding: 'utf8', timeout: 5000 }, (err, stdout) => {
            if (err) return reject(err);
            resolve(stdout);
          });
        });
        const res = JSON.parse(out.trim());
        if (res.ok && Array.isArray(res.languages)) {
          this._cachedLanguages = res.languages;
          return res.languages;
        }
      } catch (e) {
        // Fallback to powershell below
      }
    }

    const script = this.getFallbackScript();
    if (script) {
      try {
        const out = await new Promise((resolve, reject) => {
          execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-ListLanguages'], {
            encoding: 'utf8',
            timeout: 8000
          }, (err, stdout) => {
            if (err) return reject(err);
            resolve(stdout);
          });
        });
        const res = JSON.parse(out.trim());
        if (res.ok && Array.isArray(res.languages)) {
          this._cachedLanguages = res.languages;
          return res.languages;
        }
      } catch (e) {
        // Fallback to default
      }
    }

    // Default minimum if Windows API call could not be completed
    return [{ tag: 'en-US', displayName: 'English (United States)', nativeName: 'English (United States)' }];
  }

  /**
   * Run OCR on an image buffer or file path.
   * @param {Buffer|string} input Image Buffer (PNG/BMP/JPEG) or file path.
   * @param {string} [langTag] Desired OCR language tag or 'auto'.
   * @returns {Promise<{ok: boolean, text?: string, angle?: number, language?: string, lines?: Array, error?: string, languageNotInstalled?: boolean, installationGuidance?: string}>}
   */
  async recognize(input, langTag = 'auto') {
    if (!input) {
      return { ok: false, error: 'No image input provided for OCR.' };
    }

    const isBuffer = Buffer.isBuffer(input);
    const bin = this.getOcrBinary();

    if (bin) {
      return await this._recognizeWithBinary(bin, input, langTag, isBuffer);
    }

    const script = this.getFallbackScript();
    if (script) {
      return await this._recognizeWithFallback(script, input, langTag, isBuffer);
    }

    return {
      ok: false,
      error: 'Native Windows OCR bridge binary or script was not found on this system.'
    };
  }

  _recognizeWithBinary(bin, input, langTag, isBuffer) {
    return new Promise((resolve) => {
      const args = [];
      if (isBuffer) {
        args.push('--stdin');
      } else {
        args.push(String(input));
      }

      if (langTag && langTag !== 'auto') {
        args.push('--lang', langTag);
      }

      const proc = spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', d => { stdout += d.toString('utf8'); });
      proc.stderr.on('data', d => { stderr += d.toString('utf8'); });

      proc.on('error', err => {
        resolve({ ok: false, error: 'Failed to start OCR process: ' + err.message });
      });

      proc.on('close', code => {
        try {
          const trimmed = stdout.trim();
          if (!trimmed) {
            return resolve({ ok: false, error: stderr.trim() || `OCR process exited with code ${code}` });
          }
          const parsed = JSON.parse(trimmed);
          resolve(parsed);
        } catch (e) {
          resolve({ ok: false, error: 'Invalid OCR response: ' + stdout.slice(0, 200) });
        }
      });

      if (isBuffer) {
        try {
          proc.stdin.write(input);
          proc.stdin.end();
        } catch (e) {
          resolve({ ok: false, error: 'Failed to write image buffer to OCR pipe: ' + e.message });
        }
      }
    });
  }

  async _recognizeWithFallback(script, input, langTag, isBuffer) {
    let tempPath = null;
    try {
      let filePath = input;
      if (isBuffer) {
        tempPath = path.join(require('os').tmpdir(), `makan_ocr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.png`);
        fs.writeFileSync(tempPath, input);
        filePath = tempPath;
      }

      return await new Promise((resolve) => {
        const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-ImagePath', filePath];
        if (langTag && langTag !== 'auto') {
          args.push('-Language', langTag);
        }

        execFile('powershell', args, { encoding: 'utf8', timeout: 15000 }, (err, stdout, stderr) => {
          try {
            const trimmed = stdout.trim();
            if (!trimmed) {
              return resolve({ ok: false, error: stderr.trim() || (err && err.message) || 'PowerShell OCR produced no output' });
            }
            const parsed = JSON.parse(trimmed);
            resolve(parsed);
          } catch (e) {
            resolve({ ok: false, error: 'Invalid output from PowerShell OCR: ' + stdout.slice(0, 200) });
          }
        });
      });
    } finally {
      if (tempPath && fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch {}
      }
    }
  }
}

module.exports = { OcrService };
