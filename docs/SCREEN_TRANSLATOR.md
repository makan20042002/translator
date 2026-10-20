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

## Live Video mode (Planned for a later version — v2)

The Windows overlay contains architectural scaffolding for a continuous **Live Video** subtitle tracking mode (`screen-translator/overlay.html` `#btnLiveToggle`, `screen-translator/manager.js` `toggleLiveWatcher()` / `startLiveWatcher()` / `stopLiveWatcher()`).

> **v1 Status**: Live Video is disabled in v1 (`const LIVE_VIDEO_ENABLED = false;` in `screen-translator/constants.js`) and is **planned for a later version (v2)**. The overlay button is hidden from users and all toggle triggers/IPC calls are ignored in v1. The code is kept in place ready for v2 activation.

When activated in a later version (v2), it is designed for monitoring video players, live streams, and games, continuously extracting and translating subtitle text as dialogue changes on screen.

### 1. Test Coverage (v2 Design)

- **Automated Tests Covering Live Video (v2 preview)**:
  - `tests/web/screen-translator.spec.js`:
    - Asserts `#btnLiveToggle` is hidden/absent when `LIVE_VIDEO_ENABLED` is `false` in v1.
    - Test `'floating overlay Live Video button and watcher interactions when flag is overridden to true'`: overrides the flag to `true`, asserts `#btnLiveToggle` visibility, tests that clicking `#btnLiveToggle` triggers `window.makanOverlay.toggleLiveWatcher()`, and verifies that receiving `screen-trans:live-state` with `{ active: true }` adds `.active` styling and switches the button label to `'Live ON'`.
  - `tests/ext/screen-translator-responsive.spec.js`:
    - Tests: `overlay panel at <width>x<height> in <lang> fits viewport without clipping` — includes `toggleLiveWatcher: () => {}` in its mock bridge to ensure overlay button rendering and viewport responsiveness.
  - `tests/screen-translator/overlay-lifecycle-browser.spec.js`:
    - Verifies that `LIVE_VIDEO_ENABLED` is `false` by default and that manager ignores `screen-trans:toggle-live-watcher` when disabled.
- **What is NOT Covered by Any Test**:
  - **The recurring `tick()` loop**: No automated test runs or verifies the asynchronous frame loop in `ScreenTranslatorManager`.
  - **Screen capture polling**: `desktopCapturer.getSources({ types: ['screen'] })` recurring execution is not tested.
  - **Frame change detection**: No test exercises the 4-part buffer hash comparison (`${imgBuf.length}_${head}_${mid}_${tail}`).
  - **Continuous OCR execution**: No test verifies that differing frames invoke `ocrService.recognize()` repeatedly or that identical text strings are suppressed (`_lastWatchedText`).
  - **Timer cadence**: The 250 ms initial delay and 600 ms periodic polling timers are untested.
  - **Error recovery**: The `try/catch` error suppression and recovery loop inside `tick()` is not exercised.
  - **Automatic overlay pinning**: The overlay behavior that automatically sets `isPinned = true` when live state turns on (`overlay.html` line 996) is not verified by a dedicated assertion.
  - **Reselect zone fallback**: Triggering live mode without an existing region selection to force `reselectZone()` is untested.

### 2. Step-by-Step Operation

1. **Zone Validation & Initialization (`startLiveWatcher(rect)`)**:
   - The watcher uses the supplied bounding box `rect` or the previously captured screen box `this.lastCapturedRect`.
   - If no valid rectangle exists (or width/height < 10 px), the manager calls `this.reselectZone()` prompting the user to draw a new subtitle area on screen, and returns.
   - When valid, sets `this.isLiveWatching = true`, resets `_lastWatchedHash = ''` and `_lastWatchedText = ''`.
   - Positions the overlay panel near the zone (`this.showOverlayNear(...)`).
   - Dispatches IPC `'screen-trans:live-state'` `{ active: true, rect }` to `overlay.html`, which adds `.active` CSS, sets the button label to `'Live ON'`, and automatically pins the overlay so it remains floating on top of the playing video.
2. **Polling Timers**:
   - Any active `liveWatchTimer` is cleared.
   - An initial execution is scheduled with a 250 ms delay (`setTimeout(tick, 250)`).
   - Subsequent ticks run on a 600 ms cadence (`setTimeout(tick, 600)`).
3. **Region Capture**:
   - Each `tick` calls `await this.captureRegion(this.lastCapturedRect)`.
   - Electron's `desktopCapturer.getSources({ types: ['screen'] })` captures the display nearest the zone, applies monitor DPI scaling (`scaleFactor`), crops the bounding box from the screen thumbnail, and converts it to an in-memory PNG buffer (`cropped.toPNG()`).
4. **Change Detection (Lightweight Frame Hashing)**:
   - To avoid running computationally heavy OCR on unchanged video frames, the manager computes a fast composite signature:
     `${imgBuf.length}_${head}_${mid}_${tail}` (buffer length, first 16 bytes hex, middle 16 bytes hex, last 16 bytes hex).
   - If `hash === this._lastWatchedHash`, the frame is unchanged; the tick finishes immediately without calling OCR.
   - If the hash differs, `_lastWatchedHash` is updated and OCR is executed.
5. **OCR Recognition**:
   - Invokes `await this.ocrService.recognize(imgBuf, lang, engine, model)` using the configured OCR engine (Windows native WinRT OCR or fallback) and OCR language.
6. **Text Deduplication & Translation Trigger**:
   - If OCR succeeds (`ocrResult.ok && ocrResult.text`), the recognized text is trimmed (`cleanText`).
   - If `cleanText === this._lastWatchedText`, no translation is needed (suppresses redundant translations).
   - If `cleanText` is new, `this._lastWatchedText = cleanText` and the manager sends `'ocr-result'` to `overlay.html`.
   - The overlay's `'ocr-result'` listener updates the original text preview, updates the detected language pill, and calls `triggerTranslate()`.
   - `triggerTranslate()` dispatches `requestTranslation` IPC to the main renderer, which runs MAKAN's translation pipeline and returns the translated subtitles into `.trans-content`.
7. **Error Handling**:
   - If `captureRegion` or OCR throws an exception, the error is caught and logged (`console.warn('[ScreenTranslator] Live watcher tick error:', err)`).
   - The watcher does not crash or terminate; as long as `this.isLiveWatching` remains true, it safely schedules the next tick in 600 ms.
   - If OCR fails (`!ocrResult.ok`), no event is pushed to the overlay, preventing video artifacts or dark scenes from disrupting already-rendered subtitles.
8. **How It Stops (`stopLiveWatcher()`)**:
   - **Manual stop**: Clicking `#btnLiveToggle` in the overlay calls `toggleLiveWatcher()`, which triggers `stopLiveWatcher()`.
   - **Automatic stop**:
     - Overlay window is closed (`closeOverlayWindow()`).
     - Screen capture window closes or cancels (`closeCaptureWindow()`).
     - Screen translator unregisters / app quits (`unregister()`).
   - `stopLiveWatcher()` sets `this.isLiveWatching = false`, cancels `this.liveWatchTimer`, and emits `'screen-trans:live-state'` `{ active: false }`, restoring the button label to `'Live Video'` and removing the active indicator.

### 3. Known Limitations

- **CPU / Resource Utilization**:
  - Electron's `desktopCapturer.getSources({ types: ['screen'] })` grabs full-screen thumbnails before cropping the region. Polling full screen frames every 600 ms on 4K or multi-display configurations causes continuous CPU/GPU usage compared to native OS Direct3D / Desktop Duplication APIs.
- **Polling Interval & Latency**:
  - The fixed 600 ms interval combined with OCR processing (25–80 ms) and translation network roundtrip (50–300 ms) results in an end-to-end latency of ~700 ms to 1.2 s between video subtitle changes and translation rendering, which can lag behind fast dialogues.
- **Languages**:
  - Native Windows OCR is bounded by installed WinRT OCR language packs (e.g. `en-US`, `de-DE`). Subtitles in languages without installed Windows OCR packs (such as Persian `fa-IR`) cannot be recognized natively without configuring an external/cloud OCR provider.
- **Translation Engines Used**:
  - Live video generates rapid translation requests. Using rate-limited cloud engines (e.g. free tier Gemini, Groq, or public Google Translate) can quickly deplete quotas or trigger 429 / IP bans during longer videos. Local offline engines (Ollama, local NLLB models) avoid network limits but add significant local system compute.

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
