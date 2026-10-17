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
- **Limits**: *Experimental in web browser*. Direct screen snipping requires the MAKAN Windows desktop app (which integrates Windows Media OCR and RapidOCR). In browser mode, native capture buttons are honestly disabled with explanatory notices.
- **Online / Offline**: Configuration and preview translation work offline if an offline model is active.

### 6. Media (`media`)
- **What it can do**: Transcribes and translates audio and video files (`.mp3`, `.mp4`, `.wav`, `.webm`, `.m4a`), generates synchronized subtitles, offers customizable subtitle styling (fonts, colors, sizes, backgrounds), and exports to `.srt`, `.vtt`, `.ass`, and `.txt`.
- **What it cannot do**: In browser mode, cannot decode proprietary video formats (such as MKV or AVI) that HTML5 Web Audio cannot decode.
- **Limits**: In browser mode, files are decoded entirely in RAM via Web Audio API. Recommended file duration: up to 30–40 minutes on laptops with 8 GB RAM. Files exceeding memory limits require the Windows desktop app with ffmpeg.
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
| **Strong PC**<br>(16 GB+ RAM, GPU with WebGPU) | **Whisper Small** (with WebGPU: 588 MB GPU download) or **Whisper Large v3 Turbo**<br>(1.0 GB download, 3.3 GB RAM) or Python ASR helper | **NLLB-200 600M (default)**<br>(870 MB download, 4.1 GB RAM) or local **Ollama** (TranslateGemma / Gemma) | Total ~1.9 GB | No major restrictions. | Whisper Large v3 Turbo achieves the best transcription accuracy. With WebGPU or a dedicated GPU it runs quickly; on pure CPU it requires patience. |

---

## 3. Minimum and Recommended Hardware

### Minimum Hardware
- **RAM**: 4 GB system memory
- **Free Disk Space**: 500 MB (sufficient for Whisper Tiny, OPUS-MT, and dictionary packs)
- **Browser**: Chrome 115+, Microsoft Edge 115+, Firefox 115+, or Safari 17+
- **Graphics / WebGPU**: Optional (CPU / WASM fallback is supported)
- **Speed**: speed not measured yet
- Measured on: [Placeholder - to be filled after timing on test PCs]

### Recommended Hardware
- **RAM**: 8 GB to 16 GB+ system memory
- **Free Disk Space**: 3 GB to 5 GB (for Whisper Small or Large, NLLB-200, Piper voices, and dictionary packs)
- **Browser**: Modern Google Chrome or Microsoft Edge with WebGPU enabled
- **Graphics / WebGPU**: Dedicated GPU (NVIDIA GTX 1060 / RTX series, AMD Radeon, or Apple Silicon M1/M2/M3)
- **Speed**: speed not measured yet
- Measured on: [Placeholder - to be filled after timing on test PCs]

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
- **Hosting Environment**: The hosted web application runs in standard static hosting environments. Multi-threaded WASM (`crossOriginIsolated`) requires specific headers that must be validated on the host before activation.
