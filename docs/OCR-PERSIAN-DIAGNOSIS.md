# Screen Translator Persian OCR Diagnosis (ITEM 1)

## 1. Existing OCR Engines and Language Selection
- **Windows Media OCR (`windows`)**:
  - Uses native `Windows.Media.Ocr.OcrEngine` through `tools/bin/MakanOcr.exe` (with PowerShell fallback `tools/ocr-bridge/ocr-fallback.ps1`).
  - Evaluated in `screen-translator/ocr-service.js`.
  - Language is selected via `stOcrLang` in `index.html` settings, passed as `--lang <tag>` to `MakanOcr.exe` or `-Language <tag>` to `ocr-fallback.ps1`.
- **RapidOCR (`rapidocr`)**:
  - Uses PaddleOCR ONNX Runtime via `tools/ocr-bridge/rapidocr_bridge.py`.
  - In `screen-translator/ocr-service.js`, `_recognizeWithRapidOcr` only passed the image without any language tag or model parameter.
- **Dual Engine (`dual` / `auto`)**:
  - First queries installed Windows OCR recognizer languages. If Persian (`fa`) or Arabic (`ar`) is requested, it detects whether Windows OCR supports it. If missing, it routes to RapidOCR.

## 2. Behavior When Language is Persian (`fa`)
- **Windows OCR (`windows`)**:
  - Exact file & lines: `tools/ocr-bridge/Program.cs:L123-L142` and `tools/ocr-bridge/ocr-fallback.ps1:L61-L76`.
  - `Windows.Media.Ocr.OcrEngine.IsLanguageSupported(new Language("fa"))` returns `false` on standard Windows installations because Windows does not provide a Persian OCR language pack (Arabic `ar-SA` exists, but Persian `fa-IR` does not).
  - When `--lang fa` is explicitly requested, it returns `languageNotInstalled: true`.
  - When `langTag` is `'auto'` (default), `Program.cs:L144-L149` falls back to UserProfileLanguages and then `AvailableRecognizerLanguages.FirstOrDefault()`, which on English Windows silently falls back to `en-US`.
- **RapidOCR (`rapidocr`)**:
  - Exact file & lines: `tools/ocr-bridge/rapidocr_bridge.py:L16,L32`.
  - Instantiates `RapidOCR()` with no model path arguments, loading default `ch_PP-OCRv3_rec_infer.onnx`.
  - Does not use a Persian/Arabic-script model; it uses the Chinese/English model.
- **Dual / Auto mode**:
  - `screen-translator/ocr-service.js:L189-L200` routes Persian to RapidOCR, but RapidOCR's default model has no Persian glyphs.

## 3. Persian Text Detection Symptoms
- **Text Detection vs Recognition**:
  - RapidOCR detection (`ch_ppocr_v3_det`) identifies bounding boxes correctly because it detects high-contrast text regions regardless of alphabet.
  - Recognition (`ch_ppocr_v3_rec`): Default dictionary has 6,625 glyphs with 0 Persian characters. The CTC recognizer cannot map Persian glyphs, producing empty text or occasional spurious Latin punctuation.
  - Windows OCR (English fallback): Attempts to match Persian cursive script against Latin characters, producing garbled strings (e.g. `l.i...`, `..;`).
- **Right-to-Left (RTL)**:
  - PaddleOCR CTC models for Arabic script output left-to-right character indices. Visual vs logical string order must be handled.

## 4. Overlay Persian Display
- **Translated text (`.trans-content`)**:
  - Loads Google Font `Vazirmatn` and uses `Tahoma, sans-serif`.
  - Sets `dir="rtl"` when target language is `fa`, `ar`, etc.
- **Original OCR text (`.original-content`)**:
  - Formatted with `Consolas, 'JetBrains Mono', monospace`.
  - Lacks `dir="rtl"` attribute and Persian font fallback, so Persian source text appears left-aligned in a monospace font.

## 5. Exact Causes
1. **Windows OCR**: Windows does not provide a Persian OCR language pack. Silently falls back to English when in auto mode.
2. **RapidOCR**: Default model is Chinese/English only with zero Persian character coverage, and language selection was not wired to the bridge.
3. **Overlay Original Box**: Lacks `dir="rtl"` support and Persian font styling for source text.
