# MAKAN Translate — Engine Logic Synchronization Guide (`ENGINE_SYNC.md`)

This document defines the contract and synchronization checkpoints between the web application (`index.html`) and the browser extension (`extension/engine.js`).

---

## 1. Architectural Roles

| Component | Host / Runtime | Loading Mechanism | Role |
| :--- | :--- | :--- | :--- |
| **`index.html`** | Standalone Single-Page Web App (Browser / Local Server) | Self-contained inline scripts | Full multi-tab translation suite (Text, Subtitles, Documents, Voice conversation, Comparison, Glossary, Offline WASM). |
| **`extension/engine.js`** | Manifest V3 Extension (Chrome, Edge, Firefox) | `importScripts('engine.js')` in background worker; `<script src="engine.js">` in options/popup/content | Headless engine kernel executing CORS-free translation calls, dictionary lookups, connection health checks, and audio encoding. |

---

## 2. Invariant Data Structures (Must Match Exactly)

### 2.1 Engine Definitions (`ENG`)
Both files must declare identical engine metadata:
```javascript
const ENG = {
  google:    { name: 'Google Translate', type: 'free',     cors: true,  maxChars: 4500 },
  deepl:     { name: 'DeepL',            type: 'freemium', cors: true,  maxChars: 3000 },
  groq:      { name: 'Groq (Llama 3.3)', type: 'ai',       cors: false, model: 'llama-3.3-70b-versatile' },
  gemini:    { name: 'Google Gemini',    type: 'ai',       cors: false, model: 'gemini-2.5-flash' },
  openrouter:{ name: 'OpenRouter',       type: 'ai',       cors: false, model: 'meta-llama/llama-3.3-70b-instruct' },
  openai:    { name: 'OpenAI (GPT-4o)',  type: 'ai',       cors: false, model: 'gpt-4o-mini' },
  offline:   { name: 'Local / Offline',  type: 'local',    cors: true  }
};
```

### 2.2 Default Configuration (`DEFAULT_CFG`)
Default settings, fallback order, and TTS preferences must remain synchronized:
```javascript
const DEFAULT_CFG = {
  src: 'auto',
  tgt: 'fa',
  tone: 'neutral',
  order: ['google', 'groq', 'gemini', 'openrouter', 'openai', 'deepl'],
  eng: {
    google: { on: true },
    deepl: { on: true, key: '', pro: false },
    groq: { on: true, key: '', model: 'llama-3.3-70b-versatile' },
    gemini: { on: true, key: '', model: 'gemini-2.5-flash' },
    openrouter: { on: true, key: '', model: 'meta-llama/llama-3.3-70b-instruct' },
    openai: { on: true, key: '', model: 'gpt-4o-mini' },
    offline: { on: false }
  },
  tts: {
    preferGemini: false,
    geminiVoice: 'Kore',
    rate: 1.0,
    voices: { fa: '', en: '' }
  },
  trigger: 'auto',       // 'auto' | 'alt' | 'never'
  dictLookup: true,      // double-click single-word dictionary lookup
  webAppUrl: 'http://localhost:8080'
};
```

---

## 3. Core Engine Functions to Keep Synchronized

Whenever modifications are made to any of the following capabilities, update both `index.html` and `extension/engine.js`:

### 3.1 AI Translation Prompt Templates
AI engines (Gemini, Groq, OpenRouter, OpenAI) use system instructions enforcing:
- No meta-talk, notes, or introductions.
- Tone adaptation: `neutral`, `formal`, `technical`, or `film` (natural spoken colloquial).
- Preservation of formatting, code blocks, placeholders, and tags.
- Direct output of translated items matching input array order.

### 3.2 AI Dictionary Lookup & Schema
Single-word dictionary lookups return a structured JSON object:
```json
{
  "isDictionary": true,
  "word": "resilience",
  "phonetic": "/rɪˈzɪl.jəns/",
  "pos": "noun",
  "translations": ["تاب‌آوری", "انعطاف‌پذیری", "مقاومت"],
  "definition": "The capacity to recover quickly from difficulties; toughness.",
  "examples": [
    "She showed great resilience in the face of adversity.",
    "او در مواجهه با سختی‌ها تاب‌آوری بالایی نشان داد."
  ],
  "engineName": "Google Gemini"
}
```

### 3.3 Text-to-Speech (TTS) Voice Selection & Audio Conversion
1. **Language Match Verification (`pickBestVoice` / `pickVoice`)**:
   - Must strictly match the language code (`fa` vs `en`).
   - Prioritize `natural`, `neural`, and `online` voice names.
   - **Critical Rule**: Never pass an utterance to browser speech synthesis if no voice matches the requested language. Mismatched speech synthesis skips non-Latin scripts and produces corrupted partial speech.
2. **Gemini TTS Fallback (`callGeminiTts` / `playGeminiTts`)**:
   - Model sequence: `gemini-3.8-flash-tts` first, with fallback to `gemini-3.1-flash-tts-preview` on 404 / model-not-found.
   - Modality: `['AUDIO']` with `speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: ... } } }`.
   - Audio decoding: Base64 to PCM / L16 uint8 bytes converted to standard WAV container (`pcmToWav`) at 24kHz.

---

## 4. Verification Checklist Before Release

When editing either file, verify:
- [ ] No API keys are logged to console or stored in unencrypted cookies.
- [ ] `DEFAULT_CFG` property names match between both files.
- [ ] `node build-manifests.js` runs without error.
- [ ] `web-ext lint --source-dir extension` produces **0 errors**.
- [ ] Both English and Persian TTS gracefully fall back to Gemini TTS or display the localized warning when no device voice is installed.
