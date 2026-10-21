# MAKAN Translate — Capability, Limits and Hardware Guide

This comprehensive guide details the capabilities, technical constraints, recommended hardware configurations, and practical usage tips for **MAKAN Translate**.

---

## 1. Capabilities and Known Limits by Tab

The MAKAN Translate interface provides 13 dedicated functional tabs. Below is the exact operational scope and known limitations of each tab.

### 1. Text (`text`)
- **What it can do**: Translates plain text between 99+ supported languages using multi-engine fallback (Gemini, Google Web, MyMemory, Groq, Ollama, and offline models). Features auto language detection, Finglish detection, live swap, copy, and text-to-speech pronunciation.
- **What it cannot do**: Does not preserve rich text styles (bold, font sizes) or format complex tables.
- **Limits**: Very long passages (over 5,000 characters) are automatically batched or truncated depending on provider token windows.
- **Online / Offline**: Fully functional offline when an offline model (such as NLLB-200 or M2M-100) or local Ollama is selected; online engines require network access and API keys.

### 2. Subtitle (`sub`)
- **What it can do**: Imports, parses, translates, and exports subtitle files (`.srt` and `.vtt`) with millisecond timestamp preservation.
- **What it cannot do**: Does not burn subtitles into video pixels directly (use the Media tab or a video editor for burning).
- **Limits**: Supports UTF-8 encoded text subtitles up to 10 MB. Subtitle lines are translated in contextual batches.
- **Online / Offline**: Works with all online engines and downloaded offline translation models.

### 3. Document (`doc`)
- **What it can do**: Translates full documents in DOCX (Word), PPTX (PowerPoint), XLSX (Excel), PDF, TXT, Markdown, CSV, and JSON while retaining document structure and tables.
- **What it cannot do**: Does not translate scanned PDF images without OCR (use the Screen / OCR tab or desktop app for image-based PDFs).
- **Limits**: Document files up to 25 MB. Complex embedded macros and password-protected files are not supported.
- **Online / Offline**: Functions online with cloud engines or offline with local models.

### 4. Voice (`voice`)
- **What it can do**: Live microphone dictation, speech recognition, translation, and synthetic voice read-aloud. Supports hands-free auto-stop and live conversation mode.
- **What it cannot do**: Does not isolate voices in noisy environments without proper hardware filtering.
- **Limits**: Browser speech recognition depends on microphone permissions and browser SpeechRecognition API support or Whisper models.
- **Online / Offline**: Works offline using downloaded Whisper speech models and Piper neural voices.

### 5. Screen (`screen`)
- **What it can do**: Allows configuring OCR reading settings, testing preview translations, and viewing capture history.
- **What it cannot do in browser**: Native window and screen capture is restricted in standard web browsers.
- **Limits**: *Experimental in web browser*. Direct screen snipping requires the MAKAN Windows desktop app (which integrates Windows Media OCR and RapidOCR). In browser mode, native capture buttons are honestly disabled with explanatory notices. Continuous Live Video subtitle tracking is planned for a later version (v2) and is disabled in v1.
- **Online / Offline**: Configuration and preview translation work offline if an offline model is active.

### 6. Media (`media`)
- **What it can do**: Transcribes and translates audio and video files (`.mp3`, `.mp4`, `.wav`, `.webm`, `.m4a`), generates synchronized subtitles, offers customizable subtitle styling (fonts, colors, sizes, backgrounds), and exports to `.srt`, `.vtt`, `.ass`, and `.txt`.
- **What it cannot do**: In browser mode, cannot decode proprietary video formats (such as MKV or AVI) that HTML5 Web Audio cannot decode.
- **Limits**: In browser mode, files are decoded entirely in RAM via Web Audio API. Recommended file duration: up to 30–40 minutes on laptops with 8 GB RAM. Files exceeding memory limits require the Windows desktop app with ffmpeg.
- **CPU Multi-threading Note**: On `makanlab.tech`, Whisper runs on a single CPU thread unless the optional `.htaccess.threads-optional` headers are enabled (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: credentialless`). The MAKAN Windows desktop app enables these headers automatically on its local server, enabling multi-core CPU transcription.
- **Online / Offline**: Speech recognition and translation run completely offline using in-browser Whisper models.

### 7. Dictionary (`dict`)
- **What it can do**: Instant bilingual dictionary lookup powered by Wiktionary data (CC BY-SA), normalized word search, custom vocabulary list ("My Words"), and local CSV export.
- **What it cannot do**: Does not provide full sentence grammar analysis without an AI engine.
- **Limits**: Downloaded packs are stored in browser IndexedDB (~1.1 MB for en-fa, ~0.9 MB for fa-en).
- **Online / Offline**: 100% offline once the dictionary pack is downloaded.

### 8. Idioms (`idiom`)
- **What it can do**: Look up idioms, proverbs, and colloquial expressions. Allows "reverse lookup" (describing an intended meaning to find the natural cultural idiom).
- **What it cannot do**: Reverse idiom search requires an LLM engine and cannot run on dictionary data alone.
- **Limits**: Built-in curated idiom database works instantly; generative explanations require an active AI engine.
- **Online / Offline**: Curated entries work offline; AI deep explanations require an online provider or local Ollama.

### 9. Compare (`cmp`)
- **What it can do**: Translates the same text side-by-side using multiple translation engines simultaneously (e.g. Google vs Gemini vs NLLB) to compare accuracy, fluency, and tone.
- **What it cannot do**: Cannot run comparisons on engines whose API keys are not supplied.
- **Limits**: Dependent on individual engine rate limits and network latency.
- **Online / Offline**: Can compare offline models with online engines simultaneously.

### 10. Glossary (`gls`)
- **What it can do**: Manages user-defined translation term rules (e.g. enforce "Widget" → "ابزارک"). Pre-processes and post-processes text across translation calls.
- **What it cannot do**: Does not modify pre-trained weights inside neural models.
- **Limits**: Stored locally in browser storage.
- **Online / Offline**: Functions identically online and offline across all translation tabs.

### 11. History (`hist`)
- **What it can do**: Automatically records past translations with timestamp, source text, translation, source language, target language, and engine used. Allows search, copy, re-use, and CSV export.
- **What it cannot do**: Does not sync across separate computers without manual export/import.
- **Limits**: Stores up to 500 recent items in browser local storage.
- **Online / Offline**: 100% local and offline.

### 12. Games (`games`)
- **What it can do**: Interactive language learning games and vocabulary drills (flashcards, matching, quiz drills) based on dictionary and translation history.
- **What it cannot do**: *Experimental feature*. Does not replace a full curriculum language course.
- **Limits**: Content derived from installed dictionary packs and saved vocabulary.
- **Online / Offline**: Operates completely offline.

### 13. Model Hub (`models`)
- **What it can do**: Inspect, download, verify, test, and delete on-device AI speech recognition (Whisper), neural translation (NLLB, M2M-100, mBART, OPUS-MT), and offline voices (Piper).
- **What it cannot do**: Cannot download models without initial internet access.
- **Limits**: Download size varies from 42 MB to 1.0 GB per model. Models are stored in browser Cache Storage (`transformers-cache`).
- **Online / Offline**: Model catalogue inspection works offline; downloading requires connection to Hugging Face.

---

## 2. Which Setup Should I Choose?

| Computer Profile | Recommended Speech Model | Recommended Translation Engine | Expected Download Size | What to Avoid | Trade-Off |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Weak Laptop**<br>(4 GB RAM, No GPU) | **Whisper Tiny**<br>(42 MB download, 1000 MB RAM) or Web Speech API | **OPUS-MT EN → AR**<br>(112 MB download, 1000 MB RAM) or Cloud engines (Google, Gemini, Groq) | Total ~154 MB | Avoid **NLLB-200 600M (default)** (870 MB download, 4.1 GB RAM), **mBART-50 many-to-many** (848 MB download, 3.4 GB RAM), and **Whisper Large v3 Turbo** (1.0 GB download, 3.3 GB RAM). | Whisper Tiny is fast and light but weak in Persian and non-English accents. Small OPUS-MT language pairs are light but only exist for the pairs in the catalog (no Persian OPUS pair). Cloud engines need almost no hardware but send text using your API key. |
| **Normal Laptop**<br>(8 GB RAM, Integrated GPU) | **Whisper Small**<br>(240 MB download, 3.2 GB RAM) or **Whisper Base**<br>(76 MB download, 1.4 GB RAM) | **NLLB-200 600M (default)**<br>(870 MB download, 4.1 GB RAM) or **M2M-100 418M**<br>(610 MB download, 2.1 GB RAM) | Total ~1.1 GB | Avoid running Whisper Large and NLLB simultaneously without closing other browser tabs. Avoid uncompressed 1-hour media files in browser. | Whisper Small is the first size that handles Persian, Arabic, and Turkish accurately. NLLB-200 provides high offline quality across 200 languages but uses several GB of RAM. |
| **Strong PC**<br>(16 GB+ RAM, GPU with WebGPU) | **Whisper Large v3** (most accurate, needs about 1.9 GB download on the graphics card path, slower than Turbo on the processor), **Whisper Large v3 Turbo**<br>(1.0 GB download, 3.3 GB RAM), or **Whisper Small** (with WebGPU: 588 MB GPU download) or Python ASR helper | **NLLB-200 600M (default)**<br>(870 MB download, 4.1 GB RAM) or local **Ollama** (TranslateGemma / Gemma) | Total ~1.9 GB | No major restrictions. | Whisper Large v3 achieves the highest accuracy. Whisper Large v3 Turbo provides top accuracy with faster inference. Both try the graphics card first and fall back to the processor when WebGPU is not available. |

---

## 3. Minimum and Recommended Hardware

### Minimum Hardware
- **RAM**: 4 GB system memory
- **Free Disk Space**: 500 MB (sufficient for Whisper Tiny, OPUS-MT, and dictionary packs)
- **Browser**: Chrome 115+, Microsoft Edge 115+, Firefox 115+, or Safari 17+
- **Graphics / WebGPU**: Optional (CPU / WASM fallback is supported)
- **Speed**: speed not measured yet
- Measured on: Not measured yet: the Media tab shows how long each run took

### Recommended Hardware
- **RAM**: 8 GB to 16 GB+ system memory
- **Free Disk Space**: 3 GB to 5 GB (for Whisper Small or Large, NLLB-200, Piper voices, and dictionary packs)
- **Browser**: Modern Google Chrome or Microsoft Edge with WebGPU enabled
- **Graphics / WebGPU**: Dedicated GPU (NVIDIA GTX 1060 / RTX series, AMD Radeon, or Apple Silicon M1/M2/M3)
- **Speed**: speed not measured yet
- Measured on: Not measured yet: the Media tab shows how long each run took

---

## 4. How to Use

### First Start
1. When opening MAKAN Translate for the first time, choose your interface language (English or فارسی) using the language toggle in the top-right navigation bar.
2. If you have API keys for cloud providers (Google Gemini, Groq, OpenAI, etc.), open **Settings** (gear icon) and paste them. Keys are stored strictly in your browser's local storage and never leave your machine.

### Choosing and Downloading Models
1. Open the **Model Hub** tab (`models`).
2. For speech recognition: download **Whisper Small** (recommended for Persian/Arabic/Turkish) or **Whisper Tiny** (for quick English on light laptops).
3. For offline translation: download **NLLB-200 600M (default)**.
4. For offline voices: download one of the Piper voices (e.g. Persian Amir or English Ryan).
5. Downloads come from Hugging Face directly into your browser's persistent cache.

### Going Offline
- Click the **Offline** switch (`#offBtn`) in the top navigation bar.
- When active, all online cloud engines are bypassed, and translations run exclusively through your downloaded on-device models and offline dictionaries. No data leaves your machine.

### Long Files (Media Tab Limits)
- In the browser, media audio is decoded entirely in memory.
- For files longer than 30–40 minutes on an 8 GB laptop, browser memory constraints may occur.
- For longer movies or MKV/AVI files, use the **MAKAN Windows desktop application**, which uses `ffmpeg` to stream audio in small chunks without memory spikes.

### Tips for Weak Systems
1. Close other resource-heavy browser tabs (e.g. YouTube, social media) before starting transcription.
2. Process media in short clips (under 5–10 minutes) rather than full multi-hour recordings.
3. Select lighter models such as **Whisper Tiny** or **OPUS-MT**, or rely on cloud engines (Gemini Flash / Groq) which require minimal local hardware.

---

## 5. Web Version vs. Windows App vs. Browser Extension

| Capability | Hosted Web App (`/translate/app/`) | Windows Desktop App | Browser Extension |
| :--- | :---: | :---: | :---: |
| **Full Translation Interface (13 Tabs)** | Yes | Yes | Popup / Card view |
| **Offline AI Translation (NLLB, M2M, OPUS)** | Yes (browser Cache Storage) | Yes (local models) | No (uses web app / server) |
| **Offline Dictionary (Wiktionary packs)** | Yes | Yes | Yes (bundled en-fa, fa-en) |
| **In-Browser Speech Recognition (Whisper)** | Yes (Transformers.js / WebGPU) | Yes | No |
| **Screen Translator (OCR Snipping)** | No (browser sandbox blocks capture) | Yes (Windows Media OCR & RapidOCR) | No |
| **Python ASR Helper Integration** | Limited (requires local network access) | Yes (integrated desktop helper) | No |
| **ffmpeg Audio Extraction (MKV, AVI, Long Video)** | No (Web Audio API only) | Yes (via ffmpeg.exe) | No |
| **"Open in App" Bridge** | Destination (receives text via URL fragment) | Yes (Bridge server on port 50505) | Yes (Trigger source) |
| **In-Page Word Translation Card & Hotkey** | No | No | Yes (select text + Press M) |

---

## 6. Limits and Honesty

- **Unofficial Web Endpoints**: Translation features using unofficial Google web endpoints may stop working or be throttled without warning if Google alters its public endpoints. For mission-critical stability, supply an official Gemini or Groq API key in Settings.
- **Ollama Integration**: To use local Ollama with the hosted web app at `https://makanlab.tech`, Ollama must be running with origin allowance:
  `OLLAMA_ORIGINS="https://makanlab.tech" ollama serve`
  Modern browsers will display a "Local Network Access" permission prompt that you must accept.
- **Windows SmartScreen**: The Windows desktop application is built independently and is not code-signed with an expensive EV certificate. Windows SmartScreen may show an "Unknown Publisher" prompt on first run (click *More info* → *Run anyway*).
- **Hosting Environment and Multi-Threading**: The hosted web application at `https://makanlab.tech` runs in a standard static hosting environment where `crossOriginIsolated` is `false` by default. As a result, Whisper uses only one CPU thread on `makanlab.tech` unless the optional `.htaccess.threads-optional` headers are enabled (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: credentialless`). In contrast, the MAKAN Windows desktop application enables cross-origin isolation headers automatically on its local server, unlocking multi-threaded CPU Whisper performance.

---

## 7. Choosing the Translation Engine

In the **Text**, **Subtitle**, **Document**, and **Media** tabs, the engine picker allows you to decide exactly how your text is translated:

- **Auto vs. Choosing One**:
  - **Auto (your order in Settings)**: Tries engines in the priority order configured under *Settings → Translation engines & keys*. If an engine is not usable, it is silently skipped; if one fails during translation, the chain automatically moves to the next usable engine.
  - **Choosing a Specific Engine**: Translates strictly with that chosen engine (e.g. Google, Gemini, NLLB). If that engine encounters an error, the operation stops and displays the plain reason without silently falling back to other providers.
- **Model Selector**:
  - Next to the engine dropdown, a **Model** selector appears whenever the chosen engine offers multiple models:
    - **API engines** (Gemini, OpenRouter, Mistral, Cerebras, OpenAI, Claude, Groq): choose between models supported by that provider (e.g. Gemini 2.5 Flash vs. Gemini 2.5 Pro). Selecting a model here immediately synchronizes with *Settings → Translation engines & keys* (`cfg.eng[id].model`) and survives page reloads.
    - **Local AI servers** (Ollama, LM Studio / custom OpenAI-compatible): dynamically queries the running server for available models. If the server is offline, it displays `not running` and safely preserves your saved model configuration.
    - **Offline translation** (NLLB-200, M2M-100, mBART-50, OPUS-MT): choose among the downloaded offline neural models. Each option clearly shows download readiness, size, and licence terms (such as NLLB's CC BY-NC 4.0 non-commercial licence). Models that are not downloaded are disabled from selection, and a direct `Get models` link opens the Model Hub to download additional models.
- **Media Tab Speech Model**:
  - In the Media tab's Transcribe card, a dedicated **Speech model** dropdown allows choosing between downloaded Whisper sizes (Tiny, Base, Small, Large v3 Turbo, Large v3). Non-downloaded sizes are shown disabled alongside a `Get` link to the Model Hub.
- **Elapsed Time Tracking ("Done in")**:
  - The Media tab and Subtitle tab now track and display the exact elapsed time for each transcription and translation run upon completion (e.g., `Done in 12 s` or `Done in 2 min 5 s`), providing direct performance feedback on your specific computer.
- **What the States Mean**:
  - `ready`: Engine is configured, downloaded, or free to use immediately.
  - `needs a key`: An API key or model name must be provided in Settings.
  - `not downloaded`: An offline model (such as NLLB) must be downloaded first via Model Hub or Settings.
  - `offline mode blocks it`: Offline mode is enabled, blocking online network engines.
  - `not supported in this browser`: The engine requires browser capabilities not present in the current runtime.
- **Chrome On-Device in the Windows App**:
  - Chrome's built-in on-device translation API (`window.Translator`) is an experimental Chromium browser feature. In the MAKAN Windows desktop app (Electron), this API is not supported and is honestly marked as unavailable (`not supported in this browser`), so the auto chain never attempts to use it.
- **Using the Test Button**:
  - The **Test** button next to the picker quickly verifies your selected engine by translating a sample sentence ("Hello, how are you?") to the active target language. It displays the translation and response time in seconds, or reports the plain failure reason. Testing never modifies your translation history or glossary, and can be cancelled at any time by clicking again.

---

## 8. Where Each Engine Works

| Engine | Web app in Chrome | Web app in Edge | Web app in Firefox or Safari | Windows app | Extension |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Gemini** | needs key | needs key | needs key | needs key | needs key |
| **OpenRouter** | needs key | needs key | needs key | needs key | needs key |
| **Mistral** | needs key | needs key | needs key | needs key | needs key |
| **Cerebras** | needs key | needs key | needs key | needs key | needs key |
| **OpenAI** | needs key | needs key | needs key | needs key | needs key |
| **Claude** | needs key | needs key | needs key | needs key | needs key |
| **Ollama** | needs OLLAMA_ORIGINS | needs OLLAMA_ORIGINS | needs OLLAMA_ORIGINS | yes | yes |
| **LM Studio / custom** | yes | yes | yes | yes | yes |
| **Chrome on-device** | yes | not verified | no | no | no |
| **Google web** | yes | yes | yes | yes | yes |
| **MyMemory** | yes | yes | yes | yes | yes |
| **NLLB / M2M / mBART / OPUS-MT offline** | needs download | needs download | needs download | needs download | no |
| **Whisper** | needs download | needs download | needs download | needs download | no |

---

## 9. Browser Extension & Whole-Page Translation

The MAKAN Translate browser extension (Chrome, Edge, Firefox) provides full in-place page translation:

- **What it can do**:
  - **Comprehensive Text Collection**: Walks the DOM to find all visible text-bearing elements (including `div`, `span`, `a`, `button`, headings, list items, table cells, form labels, summary, document title, and open shadow roots).
  - **Attribute Translation**: Translates `placeholder`, `alt`, `title`, and `aria-label` attributes of visible elements.
  - **Sentence & Markup Preservation**: Groups inline runs inside block elements so sentences split by formatting (`<a>`, `<b>`, `<em>`) are translated as single units and original markup is preserved.
  - **Viewport Prioritization**: Sorts units by distance from the screen to translate on-screen content first before translating remaining content in the background.
  - **Dynamic Content & SPAs**: Observes dynamic DOM changes with a debounced `MutationObserver` to automatically translate infinite-scroll feeds and single-page application navigation.
  - **Interactive Top Banner**: Displays real-time progress ("Translated 120 of 430"), a Stop button (halting further translation while keeping what is done), Show Original (restoring original HTML and attributes exactly), and a target-language dropdown that re-translates from saved originals.
  - **RTL Support**: Automatically applies right-to-left layout (`dir="rtl"` and `text-align: start`) for RTL target languages (`fa`, `ar`, `he`, `ur`), leaving LTR untouched and cleanly restored.
  - **Optional Translation Offer Bar**: An optional setting ("Offer to translate pages in other languages") detects foreign language pages entirely locally without sending any data over the network until the user clicks Translate. Includes a "Never for this site" preference stored locally.

- **Limits & Known Constraints**:
  - **Sensible Page Cap**: One page is capped at 4,000 units to ensure browser responsiveness and prevent quota exhaustion.
  - **Excluded Elements**: Automatically skips `<script>`, `<style>`, `<noscript>`, `<svg>`, `<pre>`, `<code>`, `<kbd>`, `<samp>`, `<textarea>`, `<input>` values, `[contenteditable]`, and password or payment fields.
  - **Excluded Text**: Numeric-only, symbol-only, or emoji-only strings and text shorter than 2 letters are skipped.
  - **Same-Origin Iframes**: Content inside nested `<iframe>` elements is not translated by the top-level page translator (each frame operates in isolation).
  - **Mutation Rate Limit**: Dynamic mutations are rate-guarded to at most one batch per second to prevent browser freezes on rapidly updating pages.

---

## 10. On a phone

MAKAN Translate can be installed directly from any mobile browser using the standard "Add to Home screen" or "Install app" option.

- **Touch-Optimized Layout**: When opened on a phone, the app adapts to touch screens with a compact single-row header (56 px), full-width cards, a sticky action bar above navigation, and a fixed bottom navigation bar with 5 primary tabs (Text, Voice, Document, Media, and More).
- **Available Models & Engines**:
  - **Online Engines**: All cloud engines (Google Web, Gemini, Groq, OpenRouter, Mistral, OpenAI, Claude) and browser speech recognition are fully available.
  - **Small Whisper Models Only**: To prevent browser tab crashes and memory exhaustion on mobile devices, offline speech recognition is limited to small Whisper models: **Whisper Tiny**, **Whisper Base**, and **Whisper Small** (marked with a note: *Needs a recent phone with about 8 GB RAM*).
  - **Offline Dictionaries & Idioms**: Downloadable offline dictionary and idiom packs remain fully functional offline.
- **Desktop & Computer Features**:
  - Heavy offline translation models (NLLB-200, M2M-100, mBART-50, OPUS-MT), large Whisper models (Whisper Large v3, Large v3 Turbo, Distil Large v3), and offline Piper neural voice models are hidden on phones and require a computer or the MAKAN Windows app.
  - **Screen Translation**: Requires native desktop screen capture capabilities and is available only on a computer with the Windows app.



