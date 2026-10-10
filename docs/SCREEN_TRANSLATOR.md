# MAKAN Screen Translator — Native Windows OCR + Translation Overlay

## Overview
MAKAN Screen Translator provides instant on-screen region capture, native Windows WinRT OCR text recognition (`Windows.Media.Ocr.OcrEngine`), and translation using MAKAN Translate's full suite of translation engines (Offline AI models, Ollama, Google Translate, Gemini, Groq, OpenRouter, and more) displayed in a floating, glassmorphic translation overlay.

---

## Architecture

```
[ Desktop Screen ]
       │  (Ctrl + Shift + S or UI trigger)
       ▼
[ Capture Window (Multi-Monitor Selection) ]
       │  (User selects region & releases mouse)
       ▼
[ ScreenTranslatorManager (Electron Main) ]
       │  (DesktopCapturer crops region in-memory as PNG buffer)
       ▼
[ Native Windows OCR Bridge (MakanOcr.exe) ]
       │  (Windows.Media.Ocr.OcrEngine via in-memory stdin pipe)
       ▼
[ Floating Overlay Window ] ───(Request)───► [ MAKAN Main Renderer (translateItems) ]
       │                                                      │
       ▼                                                      ▼
[ Polished Floating Panel ] ◄───(Translation Result)───────── [ Reused Provider Pipeline ]
  - English/Persian RTL Layout
  - Copy translation / Copy original
  - Retry / Engine selector
  - Expandable OCR preview
  - Pin & Reposition
```

---

## 1. Native Windows OCR (`Windows.Media.Ocr`)
- **API**: Uses Windows 10/11 native WinRT `Windows.Media.Ocr.OcrEngine`.
- **Implementation**:
  - `tools/bin/MakanOcr.exe`: High-performance C# WinRT CLI bridge compiled for `win-x64`. Supports `--list-languages`, file path input, and `--stdin` streaming (0 disk I/O, ~25 ms execution latency).
  - `tools/ocr-bridge/ocr-fallback.ps1`: Transparent PowerShell fallback if the compiled executable is absent.
  - `screen-translator/ocr-service.js`: Node service coordinating bridge execution, stream piping, language listing, and error formatting.
- **Language Detection & Pack Guidance**:
  - Detects installed Windows OCR languages at runtime (`listLanguages()`).
  - If a user selects a language without an installed OCR pack (e.g. Persian `fa-IR`), returns actionable instructions directing the user to Windows Language Settings (`ms-settings:regionlanguage`).

---

## 2. Multi-Monitor Screen Capture
- **Selection UI** (`screen-translator/capture.html`):
  - Spans all connected monitors (including negative screen coordinates).
  - Transparent darkened backdrop (`rgba(0, 5, 12, 0.42)`).
  - Crosshair cursor, blue selection rectangle with glow, real-time `W × H` dimension badge.
  - `Esc` key cancels selection.
- **Pixel Capture**:
  - Captured in-memory using Electron's `desktopCapturer`.
  - Calculates display-relative bounds and applies monitor-specific DPI scaling (`scaleFactor`).
  - No permanent screenshots saved to disk (preserving privacy).

---

## 3. Translation Engine Integration
- **Pipeline Reuse**: Reuses MAKAN Translate's existing `translateItems([text], opts)` function inside `index.html`.
- **Engine Support**: Automatically respects user preferences for:
  - Free web engines (Google Translate, MyMemory).
  - Local offline models (NLLB-200, WebGPU).
  - Local LLM servers (Ollama, LM Studio).
  - Cloud AI providers (Gemini, Groq, OpenRouter, Claude, Mistral).
  - Translation memory and user glossaries.
  - Rate limiting, automatic fallback, and retries.
- **Open in App**: Clicking "Open in App" populates the recognized OCR text directly into `#tIn` on the main Text tab.

---

## 4. Modern Floating Overlay Panel (`screen-translator/overlay.html`)
- **Aesthetics**: Glassmorphic dark styling matching MAKAN Translate design system with smooth backdrop blur, custom shadows, and rounded corners.
- **Persian RTL Layout**: Automatically applies `dir="rtl"` and right-aligned text formatting when target language is Persian, Arabic, Urdu, Hebrew, or Pashto.
- **Controls**:
  - Draggable title bar (`-webkit-app-region: drag`).
  - Source and target language selectors.
  - Engine switcher (Auto, Google, Gemini, Groq, Ollama, Offline).
  - Copy translation and copy original text buttons.
  - Retry button.
  - Collapsible original OCR text preview.
  - Pin toggle to keep overlay permanently on top.
  - Close button and `Esc` dismissal.

---

## 5. Configuration & Hotkeys
- **Default Hotkey**: `Ctrl + Shift + S` (registered globally across the operating system).
- **Settings Panel**: Integrated directly into MAKAN Translate's "Engines & keys" (`#ov`) modal:
  - Enable / disable Screen Translator.
  - Global shortcut display.
  - Windows OCR language selector (dynamically populated from installed packs).
  - Default target language.
  - Auto-copy translation toggle.
  - Save OCR translations to History toggle (privacy mode when off).
- **Persistence**: Configuration is automatically saved to `screen-translator.json` in user data directory.

---

## 6. Automated Testing
Run the Screen Translator test suite:
```powershell
npx playwright test tests/screen-translator/ tests/web/screen-translator.spec.js
```
The test suite validates:
1. Windows OCR language enumeration (`ocr-service.spec.js`).
2. Native OCR text recognition from in-memory buffers.
3. Missing language pack detection and guidance.
4. Empty image / whitespace OCR handling.
5. Coordinate geometry, multi-display bounds, negative offsets, and edge clamping (`manager-coords.spec.js`).
6. Desktop UI integration, settings synchronization, and translation delegation (`screen-translator.spec.js`).
7. Floating overlay Persian RTL layout, collapsible accordion, copy actions, and pinning.
