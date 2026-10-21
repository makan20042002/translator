# MAKAN Translate

A private, multi-engine translation suite available as a modern web application, desktop app, and browser extension for Chrome, Edge, and Firefox.

---

## Features

MAKAN Translate combines on-device neural models, cloud translation APIs, and offline dictionaries into a unified interface matching [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md):

* **Text Translation**: Multi-engine translation across 99+ languages with automatic fallback (Google Web, Gemini, Groq, Ollama, and offline NLLB-200/M2M-100), Finglish transliteration, and text-to-speech pronunciation.
* **Subtitle Translation**: Imports, translates, and exports `.srt` and `.vtt` subtitle files with millisecond timestamp preservation.
* **Document Translation**: Full document translation preserving layout and tables for DOCX, PPTX, XLSX, PDF, TXT, Markdown, CSV, and JSON.
* **Voice Dictation & Conversation**: Speech recognition powered by browser APIs or on-device Whisper models, with speech synthesis via local Piper neural voices.
* **Screen Capture OCR**: Region snipping and image translation via native Windows OCR; note that continuous Live Video subtitle tracking is not in v1 and is planned for a future release.
* **Media Audio/Video**: Transcribes and translates audio and video files (`.mp3`, `.mp4`, `.wav`, `.m4a`, `.webm`) using local Whisper models, with subtitle burning and multi-format export.
* **Offline Bilingual Dictionary**: Instant offline bilingual definitions and search based on Wiktionary data (CC BY-SA) with a customizable "My Words" vocabulary notebook.
* **Idioms & Proverbs**: Searchable colloquial expressions with cultural explanations and reverse idiom discovery.
* **Side-by-Side Comparison**: Simultaneous side-by-side translation across multiple active engines to evaluate tone, fluency, and nuance.
* **Custom Glossary**: User-defined terminology replacement rules applied automatically before and after translation.
* **Translation History**: Searchable, locally stored translation log with one-click export to CSV.
* **Learning Drills & Games**: Interactive flashcards, matching drills, and quizzes built from your saved dictionary words and history; real-time game translation overlay is planned for a future release.
* **On-Device Model Hub**: Download, inspect, and manage local AI models (Whisper speech recognition, NLLB-200 translation, Piper voice models) for 100% offline usage.
* **Browser Extension (Chrome, Edge, Firefox)**: In-page translation card, floating quick button, double-click dictionary lookups, and full-page translation.

---

## Installation & Availability

* **Web Application**: Access directly online at [https://makanlab.tech/translate/app/](https://makanlab.tech/translate/app/).
* **Windows Desktop**: Download the Windows installer or portable executable from [GitHub Releases](https://github.com/makan20042002/translator/releases).
* **Browser Extension**:
  * Chrome Web Store: links coming when approved
  * Firefox Add-ons: links coming when approved

### On a phone

You can install the web app directly from your mobile browser ("Add to Home screen" or "Install app"). On a phone, the web app offers:
* Online translation engines (Google Web, Gemini, Groq, OpenRouter, etc.)
* Small offline Whisper models for speech recognition (Whisper Tiny, Base, and Small)
* Offline bilingual dictionary and idioms

Other offline models (such as NLLB-200, M2M-100, mBART-50, OPUS-MT, and Piper neural voices) and Screen translation require a computer or the MAKAN Windows app.

---

## Privacy Summary

MAKAN Translate is designed with a strict offline-first, local-privacy architecture:
* Zero telemetry, zero analytics tracking, and no automated crash reporting.
* API keys are kept only on your device in the browser's local storage, never synced, and sent only to their own provider when making translation requests.
* Translation history, glossaries, custom dictionaries, and downloaded models stay entirely on your local machine.

Read the complete privacy statement in [`extension/PRIVACY.md`](extension/PRIVACY.md).

---

## Screenshots

Screenshots: docs/screenshots/ (added at release)

---

## Development & Building

### Prerequisites
* [Node.js](https://nodejs.org) (v18 or newer recommended)
* Optional: [Ollama](https://ollama.com) for running local LLM translation models

### Build Commands

```bash
# Install development dependencies
npm install

# Build browser extensions into dist/chrome and dist/firefox
npm run build

# Package extension release zip archives into dist/packages
npm run package:extensions

# Build web application bundle
npm run build:web
```

### Running Tests

> **Note**: Please close Ollama before tests to avoid local port conflicts with mock server fixtures.

```bash
# Run full automated test suite
npm test

# Run specific test suites
npm run test:web      # Web app tests
npm run test:ext      # Extension tests
npm run test:firefox  # Firefox web-ext lint
```

---

## Project Layout

| Directory / File | Description |
| :--- | :--- |
| `index.html` | Web application single-page entry point |
| `css/` | Application styling (base, components, layout, tabs) |
| `js/` | Core logic (translation engine, store, i18n, speech, UI controllers) |
| `extension/` | Browser extension source files (manifests, content scripts, background worker, popup, options) |
| `dist/` | Distribution builds for Chrome/Edge and Firefox extensions (`dist/chrome`, `dist/firefox`, `dist/packages`) |
| `dict/` | Wiktionary-derived offline dictionary databases and pack definitions |
| `media/` | Media tab transcription UI, waveform visualizer, and workers |
| `vendor/` | Vendored runtime libraries (Piper neural TTS, PDF.js, etc.) |
| `docs/` | Documentation: [`docs/OVERVIEW.md`](docs/OVERVIEW.md), [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md), [`docs/THIRD_PARTY.md`](docs/THIRD_PARTY.md) |
| `tests/` | Playwright test suites, mock services, and fixtures |
| `tools/` | Build scripts and packaging utilities |

---

## License & Credits

* **License**: Released under the [MIT License](LICENSE).
* **Credits**: Third-party components, open-source libraries, and dataset credits are documented in [`docs/THIRD_PARTY.md`](docs/THIRD_PARTY.md).

---

## Contact & Author

Made by Makan, MAKANLAB, [https://makanlab.tech](https://makanlab.tech)  
Contact: [makan20042002@gmail.com](mailto:makan20042002@gmail.com)
