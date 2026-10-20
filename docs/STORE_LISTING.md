# MAKAN Translate — Store Listing & Submission Guide

Documentation and metadata prepared for **Chrome Web Store** and **Firefox Add-ons (AMO)** submission for **MAKAN Translate v1.0.0**.

- **Owner**: Makan
- **Year**: 2026
- **License**: MIT
- **Official Site**: [https://makanlab.tech](https://makanlab.tech)
- **Support Email**: [makan20042002@gmail.com](mailto:makan20042002@gmail.com)
- **Firefox Gecko ID**: `makan-translate@makanlab.tech`

---

## 1. Short Description (<= 132 characters)

```text
Translate text, selection, and web pages with free engines or your own AI key. English & Persian (RTL), privacy-first.
```
*(Exact length: 118 characters. Limit: 132 characters.)*

---

## 2. Long Description

```markdown
MAKAN Translate is a powerful, privacy-first translation extension designed for seamless reading and browsing in English, Persian (Farsi), and over 99 languages.

Whether reading international news, research papers, or documentation, MAKAN Translate gives you complete freedom to translate selected phrases, words, or entire web pages using free online engines, your own private AI keys, or local offline models.

KEY FEATURES:

★ Floating Selection Button & Card
Select any text on any webpage: a discrete "M" button appears. Click it to open an elegant translation card with instant translations, pronunciation audio, dictionary lookup, and natural equivalents.

★ Full-Page Web Translation
Translate entire websites with one click while preserving the original layout, formatting, links, and tables. Automatically applies right-to-left (RTL) styling for Persian, Arabic, and Urdu, with an instant "Show Original" restore option.

★ Multi-Engine Freedom & Smart Fallback
You choose how your text is translated:
• Free Online Engines: Google Translate and MyMemory ready with zero configuration.
• AI Models with Your Own Key: Connect Google Gemini, Groq, OpenRouter, Mistral, Cerebras, OpenAI, or Anthropic Claude for human-quality nuanced translations.
• Local Privacy AI: Connect directly to Ollama (e.g. gemma, llama3) or LM Studio running locally on your computer with 0 bytes sent across the internet.
• Auto Chain: Automatically tries your preferred engines in order, falling back silently if an engine reaches a rate limit.

★ Offline Dictionary & Idiom Explanations
Double-click words or highlight phrases to inspect curated offline dictionary entries (Wiktionary CC BY-SA) and idioms. Clarify figurative meanings and cultural nuances beyond literal translations.

★ Natural Voice & Read Aloud
Listen to natural voice pronunciations using high-quality browser synthesis, Microsoft Edge natural voices, or Google Gemini voice audio.

★ Desktop & App Integration
Seamlessly export translations to the MAKAN desktop workspace or web app with a single click.

★ Privacy First by Design
• Zero telemetry, tracking, or background profiling.
• Translates ONLY when you ask (button click, context menu, or keyboard shortcut).
• Never reads or scans password fields, payment forms, or sensitive text inputs.
• Your API keys remain encrypted inside your browser's local storage.
```

---

## 3. Permission Justifications (One Line Each)

| Permission | Justification |
| :--- | :--- |
| `storage` | Saves user settings, translation history, offline dictionary packs, and optional API keys locally in `chrome.storage.local`. |
| `contextMenus` | Adds the "Translate with MAKAN" action to the browser right-click menu when text is selected. |
| `activeTab` | Grants temporary access to the active tab to display the translation card and position it next to selected text upon user interaction. |
| `scripting` | Dynamically injects content scripts and styling into tabs opened before extension installation without requiring page reloads. |
| `offscreen` | *(Chromium only)* Creates an isolated offscreen document for playing Gemini text-to-speech audio in Manifest V3 service worker environments. |
| `host_permissions` (`http://*/*`, `https://*/*`) | Enables direct communication with translation APIs (Google, Gemini, Groq, Ollama) and in-page whole-page translation across user-visited sites. |

---

## 4. Privacy Summary

1. **Explicit Action Only**: The extension never reads or transmits text in the background. Content is read and sent only when the user explicitly clicks the translation button, chooses the context menu option, or presses a shortcut.
2. **Sensitive Fields Excluded**: Password inputs (`type="password"`), credit card and payment fields (`autocomplete*="cc-"`), editable inputs, and hidden tokens are strictly bypassed and never read.
3. **No Intermediary Servers**: Network requests travel directly from the user's browser to the selected translation API or local server over HTTPS. There is no central tracking server or proxy.
4. **Local Key Storage**: API keys are saved exclusively in local extension storage (`chrome.storage.local`) and are never uploaded or synced to external servers.
5. **No Telemetry**: No analytics packages, tracking beacons, or usage analytics are embedded.

Full policy details are available in [`extension/PRIVACY.md`](file:///c:/Users/Makan/Desktop/translator/extension/PRIVACY.md).

---

## 5. Missing Screenshot Checklist (To capture before publishing)

All screenshots must be 1280x800 PNG or 640x400 PNG without window borders or artifacts.

- [ ] **1. `screenshot-selection-card.png`** (1280x800):
  Selection of an English paragraph on Wikipedia or a news site, showing the floating "M" button and the active MAKAN translation card with Persian translation, Copy, and Speak buttons.
- [ ] **2. `screenshot-whole-page.png`** (1280x800):
  Full-page translation of an English article into Persian, highlighting the clean RTL layout, preserved links, and the top translation banner ("Show Original").
- [ ] **3. `screenshot-popup-translator.png`** (1280x800):
  Toolbar popup open with source and target text, tone selection dropdown, and site on/off toggle.
- [ ] **4. `screenshot-options-engines.png`** (1280x800):
  Options page showing engine chain reordering, API key input fields, and live connection test indicators.
- [ ] **5. `screenshot-offline-dict.png`** (1280x800):
  Dictionary lookup card displaying part-of-speech tags, forms, meanings, and an AI idiom breakdown.
