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

## 6. Problems found, most serious first

Each item says how it is known:

* **Confirmed**: an automated test ran it and saw it happen. The test name is
  given so you can find it in the `npm test` summary.
* **From reading**: seen in the code but not run by a test.

None of these has been fixed yet; this list is for deciding what to fix.

### Security and privacy

1. **The web app sends your Gemini and Groq API keys to its own web
   server.** `syncKeysToServer()` (index.html line 1111) runs half a second
   after every page load and on every settings save, and sends
   `POST /api/sync_keys` with `{gemini: <key>, groq: <key>}` to whatever site
   the page is served from. On the public website the keys would reach the
   site's server and its logs. The footer promises "Keys stay in your
   browser". **Confirmed**: the test *API keys are not sent to the web app's
   own server* saw the key POSTed 4 times after one key entry and one reload.
2. **The extension gives every web page's content script all API keys.**
   `get-config` returns the full settings, keys included, to the script
   running inside each web page. **Confirmed**: *the content script running
   inside web pages is not given the API keys* read the Gemini key from
   inside a web page.
3. **Any web page can make the extension translate it without the user
   asking.** A page only has to fire the event `__makan_page_translate_action`
   (content.js line 1019). The page's text is then sent to the user's engines,
   using their quota. This contradicts `PRIVACY.md`. **Confirmed**: *a web
   page cannot make the extension translate it without the user asking*. The
   page's own script started a request to Google, and the page came back
   translated.
4. From reading: the Gemini key is put in the web address (`?key=…`) for voice
   transcription, the voice interpreter and the connection check, so it can
   appear in logs. Elsewhere it is sent in a header.

### Features that do not work

5. **Settings exported from the web app break the extension.** "Export for
   Extension" includes the engines `chrome` and `nllb`, which the extension
   does not know. After "Import Settings File", every translation fails.
   **Confirmed**: *settings exported from the web app … can be imported, and
   the extension still translates*. The card showed "⚠️ Cannot read
   properties of undefined (reading 'key')".
6. **Read-aloud in the extension card never uses the computer's own voices.**
   `content.js` relies on `pickBestVoice`, `splitTextForSpeech` and
   `getNoVoiceMessage` from `engine.js`, but `engine.js` is not loaded into
   web pages. So the card always asks Gemini, and without a Gemini key it
   says there is no voice, even when Windows has one. This matches "read-aloud
   does not work in Chrome". **Confirmed**: *the card can use the computer's
   own voices* found all three helpers missing in the content script's world.
   (Real Windows voices could not be tested here.) The popup does load
   `engine.js` and is not affected.
7. **The card's Speak button forgets that it is playing.** About 7 ms after
   the press, the "stopped" message from the button's own clean-up arrives
   and resets it to "Speak" while the Gemini voice plays. Pressing it again
   starts the speech over instead of stopping it. **Confirmed**: *Speak plays
   Gemini voice … and shows the playing state*. The audio request was made,
   but the button read "Speak" during playback.
8. **Endless retry when the only engine left is rate-limited.** A 429
   answer on the last engine in the chain waits and retries with no limit;
   the Translate button stays disabled until you press Stop. **Confirmed**:
   *when the only engine is rate-limited (HTTP 429) …*. The app made 16
   requests in 30 s and was still retrying.
9. **"+ Add to Glossary" in the Document tab is not saved.** It saves the
   engine settings (`saveCfg`) instead of the glossary (`mkt_gls`).
   **Confirmed**: *"+ Add to Glossary" … keeps the terms after a reload*. The
   term was gone after reload.
10. **"Show Original" after whole-page translation loses links and
    formatting.** Translation and restore both replace paragraph content with
    plain text. **Confirmed**: *"Show Original" brings back links and bold
    text …*. The link and the bold text were missing after restore.
11. **"Open in App" from the extension opens an empty web app.** The card and
    popup pass `?text=…&src=…&tgt=…`; `index.html` never reads them.
    **Confirmed**: *opening the app with ?text=… fills the Text tab*.
12. **The Talk button ignores the "Microphone engine" setting.** Without a
    Gemini key it always uses the offline Whisper model and starts
    downloading its AI library, even with "Browser" selected.
    **Confirmed**: *with "Microphone engine: Browser", Talk does not start
    downloading the offline Whisper model*. A request for
    `cdn.jsdelivr.net/npm/@huggingface/transformers` was made.
13. **"Silence wait" in Engines & keys does nothing.** Two elements share the
    id `vSilenceWait`; only the Voice-tab one is connected. **Confirmed**:
    *"Silence wait" in Engines & keys is saved*.
14. From reading: the popup's "Grant Site Access" button asks the background
    for `inject-tab`, but the background only understands `inject-into-tab`.
    That banner only appears when site access is missing (mainly Firefox), so
    it was not run.
15. From reading: the extension's dictionary lookup does not handle Claude. If
    Claude is the first AI engine, the lookup silently falls back to plain
    translation.
16. From reading: in the extension, if the last engine is MyMemory and it is
    rate-limited, the retry calls Google instead.
17. From reading: "Translator notes" only work for Word (and only if the file
    already has footnotes), TXT and Markdown. The box has no effect for
    PowerPoint, Excel, JSON and CSV.

### Wrong or misleading messages

18. **The page banner after whole-page translation can be wrong.** It names
    the first engine in the list rather than the one used ("via gemini" when
    Google did the work), and it says "Page translated" even when every
    request failed. **Confirmed**: *the page banner names the engine that was
    actually used* and *when every engine fails, the page banner says so …*.
19. **Wrong connection-check results.** In the web app, any unexpected error
    (for example a server error 500) is shown as "key rejected". In the
    extension, a wrong Gemini key is shown as "Connection failed", because
    Gemini's real message ("API key not valid") is not recognised.
    **Confirmed**: *a provider outage (HTTP 500) is not reported as "key
    rejected"* (web) and *a wrong Gemini key is reported as "Key rejected"*
    (extension).
20. **The card's "Detected" language is always EN.** The code checks the
    selected text as if it were a language code. Swap on Persian text then
    goes the wrong way. **Confirmed**: *"Detected" shows FA when Persian text
    is selected*.
21. **Seven interface texts are missing in both languages**, so the raw key
    name is shown: `docAddedToGlossary` (the message reads "1
    docAddedToGlossary"), `noTermsToReview`, `vAskLangAuto` (first choice in
    the Ask AI language menu), and `pages`, `words`, `slides`, `sheets`
    (English words in the Persian interface). **Confirmed**: *every interface
    text … exists in both English and Persian* and *the Ask AI
    answer-language menu shows a readable first choice*.
22. **The Voice panel's "Microphone engine" menu does not show the saved
    choice** (it always shows "Auto"). **Confirmed**: *the Voice panel's
    "Microphone engine" menu shows the saved choice*.
23. **The "Done" message covers the Download button** in the Document tab for
    about 4 s. A click there in that time does nothing. Seen at a 1280 × 900
    window; it depends on window size. **Confirmed**: *the Download button can
    be clicked as soon as translation finishes*.

### Output files

24. **JSON documents are downloaded with an invisible byte-order mark** at
    the start, which strict JSON readers (Node.js, many web services) reject.
    **Confirmed**: *JSON: the downloaded file can be read by a strict JSON
    reader*.
25. **Word documents: added elements are out of the order the Office format
    requires** (`w:bidi` after `w:rPr`, `w:rFonts` after `w:rtl`). LibreOffice
    opens the files fine, and the test checks that. Whether Microsoft Word
    complains was **not** tested (Word is not available here). **Confirmed**
    (the ordering): *DOCX: elements the app adds are in the order the Office
    file format requires*. 15 places in the sample file.
26. From reading and one test run: Excel right-to-left is only applied to
    sheets that already contain a "sheet view" entry. Files saved by Excel
    always have one; some files made by other programs do not.

### Code and repository hygiene (from reading)

27. `index.html` loads `extension/engine.js` and then declares its own copies
    of most of it (section 5). Two implementations of the same logic have
    already drifted apart (items 5, 6 and 19 come from this).
28. `MakanEngine` is used as a fallback in the extension but is never
    defined, so that code can never run.
29. `build-manifests.js` also writes into the source folder
    (`extension/manifest.chrome.json`, `extension/manifest.firefox.json`).
    Re-running it produced identical files.
30. The service worker does not pre-save `extension/engine.js`, so after the
    very first visit the page can open offline without the Gemini streaming
    read-aloud.
31. `ENGINE_SYNC.md` and `PRIVACY.md` describe engines and addresses that do
    not match the code. For example, `PRIVACY.md` omits
    `clients5.google.com`, the main Google address used.
32. The repository contains the old `test-assets/` scripts (you said they
    were meant to stay out) and a broken `translator` sub-repository link.

33. `web-ext lint` (Mozilla's checker) reports 0 errors and 21 warnings for
    the Firefox build. 3 are about the `offscreen` API, which the code only
    uses when it exists (Chrome/Edge). 18 are places that build page content
    with `innerHTML`. Most insert fixed text, but two insert outside data
    without escaping it: `popup.js` line 296 inserts an error message that can
    come from a provider's reply, and `options.js` puts stored key and model
    values into the page this way. Low risk, but easy to make safe.

### Withdrawn after testing

* *Earlier draft:* "after the extension is reloaded, open tabs stop working
  because the new content script refuses to start." Testing showed this is
  wrong for Chromium. After a reload, the extension injects a working copy
  and selecting text in an already-open tab translates normally (test
  *selecting text in a tab that was already open still translates*). Edge
  was not tested.

## 7. Where the evidence is

* Run `npm test`; the summary at the end lists every failing test with the
  reason. The same text is saved to `tests/.results/report.txt`.
* `docs/TEST-REPORT.md` has the full output of the run made when the suite
  was written, and says for each failure whether the test or the app was
  wrong.
