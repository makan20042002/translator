# MAKAN Translate: how the code works

This is a plain-language map of the code as it is today. It was written by
reading every source file. Where something below says "looks wrong", that is
an observation from reading. The section at the end says which of these the
automated tests have confirmed by running them.

## 1. The two products

The repository holds two things that share some code:

1. **The web app**: a single web page (`index.html`) that you open in a
   browser. It has seven tabs: Text, Subtitle, Document, Voice, Compare,
   Glossary and History, plus an "Engines & keys" settings window.
2. **The browser extension** (`extension/` folder): adds a small "M" button
   when you select text on any web page, a right-click menu item, a toolbar
   popup, whole-page translation and an options page.

Neither has a build step for the app code itself. The only "build" is
`build-manifests.js`, which copies the extension into `dist/chrome` and
`dist/firefox` with a manifest suited to each browser.

## 2. What each file does

### Web app (top folder)

| File | What it does |
| --- | --- |
| `index.html` | The whole web app: page layout, styles (lines 14 to 395) and about 3,500 lines of JavaScript (lines 919 to 4429). Every tab, the settings window, all translation engines, voice input and output, and document handling live here. |
| `extension/engine.js` | Loaded by `index.html` (line 918) **and** by the extension. See section 5 for what the web app actually uses from it. |
| `ai-worker.js` | A background worker for the "offline" features. It downloads the NLLB translation model and the Whisper speech model from Hugging Face (through the `cdn.jsdelivr.net` library `@huggingface/transformers`) and runs them in the browser. |
| `sw.js` | Service worker. Keeps a saved copy of the app files so the page can open without internet. Files from the same site are fetched fresh when online and taken from the saved copy when offline. Fonts and the AI library are taken from the saved copy first. Translation services are never cached. |
| `manifest.webmanifest`, `icon-192.png`, `icon-512.png` | Make the web app installable ("Add to home screen" / "Install app"). |
| `test-server.py` | A small local web server on port 8080 used during development. It also accepts `POST /api/sync_keys` and throws the body away (see section 6, item 1). |
| `ENGINE_SYNC.md` | A note about keeping the web app and the extension in step. **It is out of date**: it lists engines (DeepL, an "offline" entry) and settings that no longer match the code. |
| `test-assets/`, `test_docs/` | Old ad-hoc scripts and sample files from earlier work. They are not part of the new test suite and nothing the user loads depends on them. Note: you said these were meant to be left out of the repository, but they are committed. |
| `translator` | A broken "sub-repository" link (git calls it a submodule entry) pointing at an old commit of this same repository. It has no content and no `.gitmodules` file. It was probably added by accident. |

### Extension (`extension/` folder)

| File | What it does |
| --- | --- |
| `manifest.json` | The base extension description (Manifest V3): permissions, the content script, keyboard shortcuts (Alt+Shift+M popup, Alt+Shift+T selection, Alt+Shift+P page). |
| `manifest.chrome.json`, `manifest.firefox.json` | Copies written **by** `build-manifests.js` (it writes them back into the source folder every time it runs). They are not read by anything. |
| `engine.js` | The translation "engine room": list of languages and engines, default settings, loading and saving settings, calling Google / MyMemory / AI providers, dictionary lookups, connection checks, and Gemini read-aloud (text-to-speech). |
| `background.js` | The extension's background worker. Loads `engine.js`, answers messages from the popup, options page and web pages (translate, dictionary, test connections, save settings, read aloud), creates the right-click menu items, handles keyboard shortcuts, and injects the content script into tabs that do not have it yet. |
| `content.js` + `content.css` | Runs inside every web page. Shows the "M" button after a text selection, opens the translation card (Copy, Speak, Swap, Open in App), handles double-click dictionary lookups and whole-page translate / restore. Everything it draws lives in a separate "shadow" layer so the page's own styles cannot break it. |
| `popup.html/.js/.css` | The toolbar popup: a mini translator, site on/off switch, "Translate Page" button, language toggle. |
| `options.html/.js/.css` | The settings page: engine order, keys, models, behaviour settings, voice settings, a "site check" for the active tab, import / export of settings. |
| `offscreen.html/.js` | A hidden page Chrome and Edge need for playing audio from an extension. Only used for Gemini read-aloud. Not included in the Firefox build. |
| `_locales/en`, `_locales/fa` | Extension name and description in English and Persian. |
| `PRIVACY.md` | Privacy statement for the extension stores. |

### Build

`node build-manifests.js` creates:

* `dist/chrome/`: for Chrome and Edge. Background runs as a service worker.
* `dist/firefox/`: for Firefox 142 or newer. Background runs as an event page
  with `engine.js` loaded first; `offscreen.html/js` and the `offscreen`
  permission are left out.

## 3. How a translation request travels

### Web app, Text tab

1. You type in the left box and press **Translate** (or Ctrl+Enter).
   `doText()` (index.html line 2482) splits the text into lines.
2. `translateItems()` (line 1583) builds the **engine chain**:
   * If the Engine menu says "Auto", it takes the engines in the order set in
     Engines & keys, keeping only those that are switched on, have the key /
     URL / model they need, and are not "blocked" this session.
   * Otherwise it uses only the engine you picked.
3. It sends lines in batches. Each engine has a size limit (Google 40 lines /
   1,800 characters, MyMemory 1 line / 450 characters, AI engines 50 lines /
   5,000 characters).
4. `runBatch()` → `callEngine()` calls the engine:
   * **Google**: `POST https://clients5.google.com/translate_a/t`, falling back
     to `https://translate.googleapis.com/translate_a/single`.
   * **MyMemory**: `https://api.mymemory.translated.net/get`, one line at a time.
   * **Chrome on-device**: the browser's built-in `Translator` (only in recent
     Chrome).
   * **NLLB offline**: the model running in `ai-worker.js`.
   * **AI engines** (Gemini, OpenRouter, Mistral, Cerebras, OpenAI, Claude,
     Ollama, Custom, Groq): `eAI()` sends a JSON array of lines with
     instructions, and expects a JSON array of the same length back. Gemini
     uses `generativelanguage.googleapis.com`, Claude uses
     `api.anthropic.com/v1/messages`, the others use the "OpenAI-compatible"
     `…/chat/completions` address.
5. If an engine fails, the next one in the chain takes over and a small
   message says so. A "rate limit" (HTTP 429) answer switches engines, or, if
   it was the last engine, waits and tries again.
6. The result goes into the right box and into History.

Subtitle, Document, Compare and the Voice tab all use the same
`translateItems()`.

### Web app, Subtitle and Document tabs

* **Subtitle**: the file is read in the browser, split into cues (number,
  start, end, text). Lines are translated in batches. Each translated line
  can be edited by clicking it. Export writes SRT (`00:00:01,000`) or VTT
  (`WEBVTT` + `00:00:01.000`). Timings are copied unchanged.
* **Document**:
  * TXT and Markdown are translated line by line. Markdown headings, list
    markers and quote markers are kept, and code blocks are skipped.
  * JSON: every text value is translated; keys and numbers are kept.
  * CSV: every cell with words is translated.
  * DOCX / PPTX / XLSX are opened as ZIP files with **JSZip, downloaded from
    `cdn.jsdelivr.net`** when first needed. The text pieces inside the XML are
    replaced and the file is zipped again. For right-to-left targets
    (Persian, Arabic…) the paragraphs, tables and sheets are switched to
    right-to-left.
  * With an AI engine, the app first asks the AI for the document's subject
    and key terms, which you can edit.

### Web app, Voice tab

* **Talk button** (hold to speak, or tap to start/stop): records from the
  microphone. With a Gemini key, the recording is sent to Gemini, which
  returns the transcript, the detected language and the translation in one
  answer. Without a Gemini key it uses the offline Whisper model.
* **Live** button: hands-free loop of listen → translate → speak.
* **Read aloud**: uses a voice installed on the device if one matches the
  language; otherwise Gemini read-aloud (streamed audio) if there is a Gemini
  key; otherwise a "no voice" message.
* **Ask AI**: sends your question to the first working AI engine and reads
  the answer aloud.

### Extension

1. You select text on a page. `content.js` notices the mouse release, and
   shows the **M** button just above the selection.
2. Pressing M opens the card. The card sends a message
   `{action: 'translate-text', items: [...]}` to `background.js`.
   (A single word goes as `translate-dict` for a dictionary-style answer.)
3. `background.js` loads settings from extension storage and calls
   `translateItemsWithFallback()` in `engine.js`, which walks the same kind of
   engine chain as the web app (Google, MyMemory and the AI engines; there is
   no Chrome-on-device or NLLB in the extension).
4. The answer goes back to the card.
5. The right-click item "Translate with MAKAN" first pings the tab. If the
   content script does not answer within 0.22 s, the background injects it,
   then asks it to open the card. If injecting is impossible, a small notice
   is shown on the page.
6. The popup and the options page talk to `background.js` the same way.

## 4. Where settings and keys are stored

**API keys are stored in plain text in every case below.**

### Web app: the browser's `localStorage` for the site, keys prefixed `mkt_`

| Key | Contents |
| --- | --- |
| `mkt_cfg` | Engine order, each engine's on/off, **API key**, model and address, MyMemory e-mail, voice settings (including the speech server key), offline mode, microphone engine, silence wait. |
| `mkt_gls` | Glossary terms. |
| `mkt_hist` | The last 60 text translations (input and output, up to 4,000 characters each). |
| `mkt_ui`, `mkt_src`, `mkt_tgt`, `mkt_engine`, `mkt_tone`, `mkt_subStyle`, `mkt_subFamily`, `mkt_liveVoiceSpeed`, `mkt_voiceTransEngine`, `mkt_silenceWait` | Last choices in the menus. |
| `mkt_eng_conn` | Last "Check connections" results. |
| `mkt_nllb`, `mkt_whisper`, `mkt_whisper_webgpu`, `mkt_whisper_wasm` | Whether offline models were downloaded. |
| `mkt_groq_order_fixed` | One-time flag used to move Groq to the end of the list. |

Other storage: the service worker cache `makan-translate-v13` (app files,
fonts, AI library) and the Hugging Face model files (browser cache).

The web app **also sends the Gemini and Groq keys to its own web server**:
see section 6, item 1.

### Extension: `chrome.storage.local`, a single entry `makan_cfg`

It holds the engine order, each engine's settings **including API keys**,
languages, tone, trigger mode, dictionary on/off, disabled sites, interface
language, glossary, web app address and voice settings. The options page has
an unused fallback that would write to `localStorage` key `makan-ext-cfg`.

### Moving settings between them

"Export for Extension" in the web app downloads `makan-settings.json`; the
options page's "Import Settings File" or "Paste JSON" reads it. "Export
Backup" in the options page downloads `makan-translate-settings.json`. Both
files contain all API keys in plain text.

## 5. What `index.html` duplicates from `extension/engine.js`

`index.html` loads `extension/engine.js` with a normal `<script>` tag (line
918). `engine.js` puts its functions on the page's global object
(`window.LANGS`, `window.ENG`, `window.translateItemsWithFallback` and so on).
The web app's own script, which runs straight after, then declares its own
versions of many of the same names. Because those declarations come later,
**the web app's versions win** and the `engine.js` versions are ignored.

### Declared again with the same name (the engine.js copy is never used)

| Name | engine.js | index.html | How they differ |
| --- | --- | --- | --- |
| `LANGS` | line 11 | line 1076 | Same languages. engine.js also has a Persian name for each; the web app does not. |
| `langName` | line 52 | line 1077 | Same. |
| `ENG` (engine list) | line 56 | line 1081 | The web app has two extra engines, `chrome` (on-device) and `nllb` (offline). Display names differ ("Google Translate" vs "Google Translate (web)"). Ollama's default model is `gemma3` in engine.js and empty in the web app. |
| `DEF_ORDER` | line 70 | line 1096 | The web app's list also has `chrome` and `nllb`. |
| `fx` (fetch helper) | line 134 | line 1293 | Different: the web app retries once after a 429/503 answer, and returns errors in a different way. |
| `reEsc` | line 160 | line 1311 | Same. |
| `preGloss` (glossary for non-AI engines) | line 162 | line 1312 | engine.js takes the glossary as a parameter; the web app reads its own `glossary` variable. |
| `pcmToWav` | line 583 | line 1728 | engine.js returns bytes; the web app returns a `Blob`. |
| `splitIntoSentences` | line 701 | line 1657 | Same. |
| `isRtlLang` | line 53 | line 2599 | Same, except the web app's version throws an error if called with no value at all. |

### Re-implemented under a different name (both copies are live, in different products)

| engine.js (extension) | index.html (web app) |
| --- | --- |
| `translateItemsWithFallback` | `translateItems` + `runBatch` + `callEngine` (adds batching, splitting long text, notes, progress, region-block detection) |
| `buildSysPrompt` | `sysPrompt` (adds subtitle styles, family-friendly mode, document subject, key terms, translator notes) |
| `parseAiJsonArray` | `parseArr` |
| `callGoogle` | `eGoogle` |
| `callMyMemory` | `eMyMemory` |
| `callAi` | `eAI` |
| `isEngineUsable` | `why` + `usable` |
| `testEngineConnection` | `checkEngineConn` (more detailed results) |
| `callGeminiTts` | the sentence-by-sentence fallback inside `playGeminiTts` |
| `pickBestVoice` | `pickVoice` |
| `splitTextForSpeech` | `splitLong` |
| `ttsSessionCache` / `getTtsCacheKey` | `geminiTtsCache` / `getGeminiTtsCacheKey` (both are used, see below) |
| `DEFAULT_CFG` | the default settings built at line 1097 |
| `loadConfig` / `saveConfig` | `store.get('cfg')` / `saveCfg` |
| `lookupWordDictionary` | (no equivalent in the web app) |

### What the web app really uses from engine.js

Only the Gemini streaming read-aloud: `streamGeminiTts`,
`GeminiAudioStreamPlayer`, `ttsSessionCache` and `getTtsCacheKey` (used in
`playGeminiTts`, lines 1745 to 1780). If `engine.js` fails to load, the web
app quietly falls back to its own sentence-by-sentence Gemini read-aloud.

So `ENGINE_SYNC.md`'s rule "keep both files in step" is the only thing that
keeps two separate implementations of the same behaviour consistent. They
have already drifted apart (different engine lists, different error
handling, different connection-check messages).

## 6. Things that look fragile or wrong (from reading the code)

Ordered roughly by how much they matter. The test suite tries to confirm
each of them; see section 7.

1. **The web app sends your Gemini and Groq API keys to its own web
   server.** `syncKeysToServer()` (index.html line 1111) runs half a second
   after every page load and on every settings save. It sends
   `POST /api/sync_keys` with `{gemini: <key>, groq: <key>}` to whatever site
   the page is served from. On the public website that means the keys reach
   the website's server and its logs. The footer says "Keys stay in your
   browser and are sent only to the provider you choose", which is not true
   while this code is there.
2. **Settings exported from the web app break the extension.** The web
   app's export includes the `chrome` and `nllb` engines. The extension's
   import copies them in, and `isEngineUsable()` in engine.js then reads
   `ENG['chrome'].key` for an engine the extension does not know, which
   crashes. After import, every translation in the extension would fail.
3. **Re-loading or updating the extension can leave open tabs unusable.**
   `content.js` refuses to run twice in the same tab
   (`window.__makanTranslateLoaded`). After the extension is reloaded or
   updated, the old copy in an open tab stops working, but the new copy
   injected by `background.js` sees the old flag and exits immediately. The
   right-click item then shows "Please reload this page" instead of a card.
4. **Read-aloud in the extension card and popup never uses the computer's
   own voices.** `content.js` calls `pickBestVoice`, `splitTextForSpeech` and
   `getNoVoiceMessage`, but these live in `engine.js`, which is not loaded
   into web pages (the manifest only lists `content.js`). The check
   `typeof pickBestVoice === 'function'` is always false, so it always tries
   Gemini, and without a Gemini key it shows "No voice installed" even when
   Windows has a voice for that language. This matches the report that
   read-aloud does not work in Chrome. (The popup does load `engine.js`, so
   the popup is not affected.)
5. **"Show Original" after whole-page translation does not bring back links
   and formatting.** Page translation replaces each paragraph's content with
   plain text (`innerText`), and restore puts back plain text. Links, bold
   text and images inside translated paragraphs are lost until the page is
   reloaded.
6. **Whole-page translation says "Page translated" even when every request
   failed**, and the banner names the first engine in the list rather than
   the engine that was actually used.
7. **The card's "Detected" language is always EN.** `isRtl(text)` is given
   the selected text instead of a language code, so it is false for any
   text, Persian included. Swap on Persian text then translates in the wrong
   direction.
8. **"Open in App" from the extension opens an empty web app.** The card and
   popup pass `?text=…&src=…&tgt=…`, but `index.html` never reads the address
   bar.
9. **Gemini connection check in the extension reports a bad key as
   "Connection failed"** instead of "Key rejected", because Gemini's real
   message ("API key not valid") does not match the patterns it looks for.
   In the web app, any unexpected error (for example a server error 500) is
   reported as "Key rejected".
10. **Endless retry when the only engine left is rate-limited.** In
    `translateItems()`, a 429 answer on the last engine waits and retries
    forever, with no limit, until you press Stop.
11. **"+ Add to Glossary" in the Document tab is not saved.** It changes the
    glossary in memory and calls `saveCfg()`, which saves the engine settings,
    not the glossary (`mkt_gls`). After a reload the terms are gone.
12. **Two settings share the id `vSilenceWait`** (Voice tab panel and the
    Engines & keys window). The one in Engines & keys does nothing.
13. **The popup's "Grant Site Access" asks the background for
    `inject-tab`**, but the background only understands `inject-into-tab`, so
    the script is never injected after access is granted.
14. **Any web page can make the extension translate the whole page** by
    firing a `__makan_page_translate_action` event on its own document
    (content.js line 1019). That sends the page's text to the user's engines
    (and spends their quota) without the user asking, contrary to
    `PRIVACY.md`.
15. **The extension hands all API keys to every web page's content
    script.** `get-config` returns the full settings, keys included, and the
    content script asks for it on every page load. Keys do not need to leave
    the background worker.
16. **The extension's dictionary lookup ignores Claude.** If Claude is the
    first AI engine, it sends the request to `/chat/completions` with no
    address and silently falls back to plain translation.
17. **Extension 429 retry uses the wrong engine.** If the last engine in the
    chain is MyMemory and it is rate-limited, the retry calls Google instead.
18. **JSON documents are downloaded with an invisible "byte order mark"**
    at the start (all downloads get one). Strict JSON readers, including
    Node.js and many web APIs, reject such files.
19. **Word documents: new XML elements are appended at the end of their
    parent** (`w:bidi`, `w:jc`, `w:rtl`, `w:rFonts`, `w:updateFields`). The
    Office file format defines a fixed order for these, so a strict reader
    could reject the file or "repair" it. LibreOffice opens such files; it is
    not known whether Word complains.
20. **Translator notes only work for Word, TXT and Markdown.** The checkbox
    has no effect for PowerPoint, Excel, JSON and CSV, and in Word only if the
    file already has a footnotes part.
21. **The Talk button ignores the "Microphone engine" setting.** Without a
    Gemini key it always uses the offline Whisper model, which starts a large
    download without asking, even if "Browser" or "Groq" is selected.
22. **`build-manifests.js` writes into the source folder**
    (`extension/manifest.chrome.json`, `extension/manifest.firefox.json`) as
    well as `dist/`.
23. Smaller items: the Gemini key is put in the web address (`?key=`) for
    voice transcription and the connection check, so it can appear in logs;
    `MakanEngine` is referenced in the extension but never defined, so those
    fallbacks are dead code; the service worker does not pre-save
    `extension/engine.js`; `ENGINE_SYNC.md` and `PRIVACY.md` list endpoints
    and engines that do not match the code (for example `PRIVACY.md` omits
    `clients5.google.com`, which is the main Google address used).

## 7. Which of these the tests confirmed

See the "Test results" section of the pull request and
`docs/TEST-REPORT.md`, which lists, for every item above, whether a test ran
it and what happened.
