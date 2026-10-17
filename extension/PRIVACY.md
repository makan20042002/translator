# Privacy & Safety Policy — MAKAN Translate Browser Extension

MAKAN Translate is designed with a strict **privacy-first, user-controlled architecture**. The extension functions as a transparent bridge between the user and their chosen translation providers, without telemetry, ad-tracking, or centralized intermediary servers.

---

## 1. Third-Party Services & API Endpoints

The extension communicates strictly with the following translation providers, and only when enabled by the user in their settings or fallback chain:

| Service / Provider | Endpoint URL | Data Sent | When Sent |
| :--- | :--- | :--- | :--- |
| **Google Translate** | `https://translate.googleapis.com/translate_a/single` | Selected text or visible page snippet, language pair codes | On explicit user request via free Google engine |
| **MyMemory** | `https://api.mymemory.translated.net/get` | Selected text snippet, language pair codes | On explicit user request via free MyMemory engine |
| **Google Gemini** | `https://generativelanguage.googleapis.com/v1beta/models/...` | Selected text or page text, prompt, language codes, user's Gemini key in header | On user request when Gemini translation or Gemini TTS is used |
| **Groq** | `https://api.groq.com/openai/v1/chat/completions` | Selected text or page text, language codes, user's Groq key in header | On user request when Groq engine is active |
| **OpenRouter** | `https://openrouter.ai/api/v1/chat/completions` | Selected text or page text, language codes, user's OpenRouter key in header | On user request when OpenRouter engine is active |
| **Mistral AI** | `https://api.mistral.ai/v1/chat/completions` | Selected text or page text, language codes, user's Mistral key in header | On user request when Mistral engine is active |
| **Cerebras** | `https://api.cerebras.ai/v1/chat/completions` | Selected text or page text, language codes, user's Cerebras key in header | On user request when Cerebras engine is active |
| **OpenAI** | `https://api.openai.com/v1/chat/completions` | Selected text or page text, language codes, user's OpenAI key in header | On user request when OpenAI engine is active |
| **Anthropic Claude** | `https://api.anthropic.com/v1/messages` | Selected text or page text, language codes, user's Claude key in header | On user request when Claude engine is active |
| **Ollama (Local AI)** | `http://localhost:11434/v1/chat/completions` | Selected text, language codes | Processed **locally on user's machine**; zero internet transmission |
| **Custom Server** | User-configured URL (e.g., `http://localhost:1234/v1`) | Selected text, language codes | User-defined local or private server |
| **MAKAN Desktop App Bridge** | `http://127.0.0.1:50505/__makan/*` | Selected text, language pair codes | On user clicking "Open in App" to focus the running desktop app |

> **Local Desktop App Bridge**: When clicking 'Open in App', the extension checks if the MAKAN Translate desktop app is running on 127.0.0.1:50505. Only localhost/127.0.0.1 is contacted, no external network call is made.

> **Note on other services**: MAKAN Translate does NOT integrate or call DeepL, analytics platforms, advertising trackers, or telemetry endpoints. Only the services listed above exist in the codebase.

---

## 2. Core Privacy Principles

- **Zero Passive Background Reading**:
  The extension never reads or transmits webpage content automatically in the background. Content is read and sent to translation providers **only upon an explicit user action**:
  - Selecting text and clicking the floating MAKAN button.
  - Selecting text and choosing "Translate with MAKAN" from the right-click context menu.
  - Pressing a user-configured keyboard shortcut (`Alt+Shift+T` for selection, `Alt+Shift+P` for full page).
  - Explicitly clicking "Translate" in the toolbar popup.
  - Explicitly clicking "Translate Page" in the toolbar popup or context menu.

- **Strict Sensitive Field Protection**:
  The extension is hard-coded to ignore and skip:
  - Password inputs (`<input type="password">`).
  - Payment and credit card fields (`autocomplete="cc-number"`, `[autocomplete*="card-"]`, etc.).
  - Hidden fields, token inputs, and security credentials.
  - Editable form fields (`<textarea>`, `<input>`, `[contenteditable="true"]`).

- **Local Storage for API Keys**:
  - User API keys (Gemini, Groq, OpenRouter, Mistral, Cerebras, OpenAI, Claude, Custom) are stored exclusively in your local browser storage (`chrome.storage.local`).
  - Keys are never synced to any remote server or third party.
  - Keys are sent strictly and directly to the official API endpoints of the provider you configured over encrypted HTTPS.
  - Keys are never printed or logged to console outputs.

---

## 3. Justification of Requested Permissions

MAKAN Translate requests the absolute minimum set of browser permissions required to operate:

| Permission | Justification & Scope |
| :--- | :--- |
| `storage` | Stores user configuration (engine order, tone, selected voices, site whitelist/blacklist) and optional user API keys locally on your device via `chrome.storage.local`. |
| `contextMenus` | Creates the right-click "Translate with MAKAN" item when text is highlighted. |
| `activeTab` | Grants temporary access to the active page when the toolbar icon or shortcut is invoked, allowing seamless in-place translation and positioning the floating card. |
| `scripting` | Dynamically injects the translation script into tabs that were already opened before the extension was installed or reloaded, avoiding mandatory page reloads. |
| `offscreen` | *(Chromium only)* Used strictly to create an isolated offscreen document for playing synthesized text-to-speech audio via Web Audio/Audio element in Manifest V3 service worker environments. Excluded in Firefox builds. |
| `host_permissions` (`http://*/*`, `https://*/*`) | Allows the background service worker to make direct fetch calls to translation endpoints (Google, Gemini, Groq, local Ollama on `localhost:11434`, etc.) without being blocked by third-party website CORS headers. |

> **Notifications Permission**: MAKAN Translate does **not** request or use the `"notifications"` permission. All user alerts, tips, and notices are delivered as sleek, unobtrusive in-page notifications inside the page's isolated Shadow DOM.

---

## 4. Mozilla Store Declaration (`data_collection_permissions`)

For Firefox submission and Mozilla Add-on Policies:
- **Category Declared**: `websiteContent`
- **Justification**: User-selected text or visible webpage paragraphs are read strictly upon user request (click, context menu, or shortcut) and forwarded to the user's chosen translation provider to produce translated text.
- **Identity**: `makan-translate@makanlab.tech`
- **Strict Min Version**: `142.0` (Ensures full support for data collection declarations on both Desktop and Android)
