/**
 * MAKAN Screen Translator - Multi-Engine OCR Service
 * Supports:
 *  1. Native Windows.Media.Ocr.OcrEngine via MakanOcr.exe (ultra-fast sub-50ms)
 *  2. PaddleOCR / RapidOCR (ONNX Deep Learning, robust multilingual & Persian/Farsi)
 *  3. Dual Engine (Instant Windows OCR with seamless Deep OCR fallback)
 */

const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');

class OcrService {
  constructor(options = {}) {
    this.rootDir = options.rootDir || path.resolve(__dirname, '..');
    this._cachedLanguages = null;
    this._cachedEngines = null;
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
   * Locate RapidOCR (PaddleOCR ONNX) python bridge script.
   */
  getRapidOcrBridge() {
    const candidates = [
      path.join(this.rootDir, 'tools', 'ocr-bridge', 'rapidocr_bridge.py'),
      path.join(__dirname, '..', 'tools', 'ocr-bridge', 'rapidocr_bridge.py'),
      path.join(process.resourcesPath || '', 'tools', 'ocr-bridge', 'rapidocr_bridge.py'),
      path.join(process.resourcesPath || '', 'app-web', 'tools', 'ocr-bridge', 'rapidocr_bridge.py'),
      path.join(__dirname, '..', '..', 'translator', 'tools', 'ocr-bridge', 'rapidocr_bridge.py'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  /**
   * List available OCR engines.
   */
  async listEngines() {
    if (this._cachedEngines) return this._cachedEngines;

    const hasWindows = Boolean(this.getOcrBinary() || this.getFallbackScript());
    const rapidBridge = this.getRapidOcrBridge();
    let hasRapid = false;

    if (rapidBridge) {
      try {
        const out = await new Promise((resolve) => {
          execFile('python', [rapidBridge, '--test'], { encoding: 'utf8', timeout: 4000 }, (err, stdout) => {
            if (err) return resolve('');
            resolve(stdout || '');
          });
        });
        const parsed = JSON.parse(out.trim());
        hasRapid = Boolean(parsed && parsed.available);
      } catch {
        hasRapid = false;
      }
    }

    const engines = [
      { id: 'windows', name: 'Windows Media OCR (Native, Ultra-Fast)', available: hasWindows },
      { id: 'rapidocr', name: 'PaddleOCR / RapidOCR (ONNX Deep Learning, Best Multilingual)', available: hasRapid },
      { id: 'dual', name: 'Dual Engine (Windows OCR + RapidOCR Fallback)', available: hasWindows && hasRapid }
    ];

    this._cachedEngines = engines;
    return engines;
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
   * @param {string} [engine] 'auto' | 'windows' | 'rapidocr' | 'dual'.
   * @returns {Promise<{ok: boolean, text?: string, angle?: number, language?: string, lines?: Array, error?: string, languageNotInstalled?: boolean, installationGuidance?: string, engine?: string}>}
   */
  async recognize(input, langTag = 'auto', engine = 'auto') {
    if (!input) {
      return { ok: false, error: 'No image input provided for OCR.' };
    }

    const isBuffer = Buffer.isBuffer(input);
    const selectedEngine = (engine || 'auto').toLowerCase();

    // 1. Direct RapidOCR (PaddleOCR ONNX) execution
    if (selectedEngine === 'rapidocr') {
      const rapidBridge = this.getRapidOcrBridge();
      if (rapidBridge) {
        return await this._recognizeWithRapidOcr(rapidBridge, input, isBuffer);
      }
      return { ok: false, error: 'RapidOCR (PaddleOCR ONNX) bridge was not found or is uninstalled.' };
    }

    // 2. Direct Windows Media OCR execution
    if (selectedEngine === 'windows') {
      return await this._recognizeWindowsOcr(input, langTag, isBuffer);
    }

    // 3. Dual Engine / Auto Mode:
    // If specific language requested is Persian or Arabic, check if Windows has the language pack.
    // If not, immediately route to RapidOCR (PaddleOCR ONNX) which excels at Persian/Arabic!
    const isPersianOrArabic = langTag && (langTag.toLowerCase().startsWith('fa') || langTag.toLowerCase().startsWith('ar'));
    const rapidBridge = this.getRapidOcrBridge();

    if (isPersianOrArabic && rapidBridge) {
      const installedLangs = await this.listLanguages();
      const hasWinPack = installedLangs.some(l => l.tag.toLowerCase().startsWith(langTag.toLowerCase().slice(0, 2)));
      if (!hasWinPack) {
        // Windows OCR lacks Persian pack; use RapidOCR
        const rapidRes = await this._recognizeWithRapidOcr(rapidBridge, input, isBuffer);
        if (rapidRes.ok) return rapidRes;
      }
    }

    // Attempt Windows OCR first
    const winResult = await this._recognizeWindowsOcr(input, langTag, isBuffer);

    // If Windows OCR succeeded with non-empty text, return it
    if (winResult.ok && winResult.text && winResult.text.trim().length > 0) {
      winResult.engine = 'windows';
      return winResult;
    }

    // If Windows OCR failed or returned empty text, and RapidOCR is available, auto-fallback to RapidOCR
    if (rapidBridge && (selectedEngine === 'dual' || selectedEngine === 'auto')) {
      const fallbackResult = await this._recognizeWithRapidOcr(rapidBridge, input, isBuffer);
      if (fallbackResult.ok && fallbackResult.text && fallbackResult.text.trim().length > 0) {
        fallbackResult.fallbackUsed = true;
        fallbackResult.primaryEngine = 'windows';
        return fallbackResult;
      }
    }

    return winResult;
  }

  async _recognizeWindowsOcr(input, langTag, isBuffer) {
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

  async _recognizeWithRapidOcr(script, input, isBuffer) {
    return new Promise((resolve) => {
      const args = [script];
      if (isBuffer) {
        args.push('--stdin');
      } else {
        args.push(String(input));
      }

      const proc = spawn('python', args, { stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', d => { stdout += d.toString('utf8'); });
      proc.stderr.on('data', d => { stderr += d.toString('utf8'); });

      proc.on('error', err => {
        resolve({ ok: false, error: 'Failed to start RapidOCR python process: ' + err.message });
      });

      proc.on('close', code => {
        try {
          const trimmed = stdout.trim();
          if (!trimmed) {
            return resolve({ ok: false, error: stderr.trim() || `RapidOCR exited with code ${code}` });
          }
          const parsed = JSON.parse(trimmed);
          resolve(parsed);
        } catch (e) {
          resolve({ ok: false, error: 'Invalid response from RapidOCR: ' + stdout.slice(0, 200) });
        }
      });

      if (isBuffer) {
        try {
          proc.stdin.write(input);
          proc.stdin.end();
        } catch (e) {
          resolve({ ok: false, error: 'Failed to write image buffer to RapidOCR pipe: ' + e.message });
        }
      }
    });
  }
}

module.exports = { OcrService };
