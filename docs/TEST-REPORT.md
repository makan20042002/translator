# Test report

This report covers the automated test suite (`npm test`) as it was when the
suite was written. Everything below was produced by running it; nothing is
estimated.

* **Where it ran**: a Linux cloud container, Node.js 22, Chromium 141
  (Playwright 1.56.1), headless. The translation services were imitated by
  the local stub (see `tests/support/stub-server.js`); there was no real
  internet access to them and no API keys.
* **Runs**: the whole suite was run twice in a row. Every one of the 65
  tests had the same outcome both times. Each run took about 6 minutes.
* **Result**: 39 passed, 23 failed, 3 skipped. Extension build passed.
  `web-ext lint` passed (0 errors, 21 warnings). Firefox skipped.
  `npm test` exits with code 1 because there are failures.

## Every failure: is the test wrong or the app?

All 23 failures are **app problems**. For each one, I checked that the test
does what a user would do and that the stub imitates the real service
correctly for that case. The "Evidence" column is what the test actually
observed. The numbers refer to `docs/OVERVIEW.md`, section 6.

| # | Failing test | Evidence from the run | Verdict |
| --- | --- | --- | --- |
| 1 | Web › Engines & keys › API keys are not sent to the web app's own server | 4 × `POST /api/sync_keys body={"gemini":"stub-valid-key",…}` to the app's own server | App (item 1) |
| 2 | Ext › the content script running inside web pages is not given the API keys | the Gemini key was readable from the content-script world of a web page | App (item 2) |
| 3 | Ext › a web page cannot make the extension translate it without the user asking | a page-fired event caused `clients5.google.com/translate_a/t` and the paragraph became `[fa] The quick…` | App (item 3) |
| 4 | Ext › settings exported from the web app … still translates | card showed `⚠️ Cannot read properties of undefined (reading 'key')` | App (item 5) |
| 5 | Ext › the card can use the computer's own voices | in the content-script world `pickBestVoice`, `splitTextForSpeech`, `getNoVoiceMessage` are all `undefined` | App (item 6) |
| 6 | Ext › Speak plays Gemini voice … shows the playing state | voice request made, but the button read "Speak" during playback (a trace showed "Stop" for only 7 ms) | App (item 7) |
| 7 | Web › when the only engine is rate-limited (HTTP 429) … within 30 seconds | 16 requests in 30 s, Translate button still disabled | App (item 8) |
| 8 | Web › "+ Add to Glossary" in the Document tab keeps the terms after a reload | 2 glossary rows before reload, fewer after | App (item 9) |
| 9 | Ext › "Show Original" brings back links and bold text | `#p2 a#link1` count 0 after restore | App (item 10) |
| 10 | Web › opening the app with ?text=… fills the Text tab | source box empty | App (item 11) |
| 11 | Web › with "Microphone engine: Browser", Talk does not start downloading the offline Whisper model | request to `cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1` | App (item 12) |
| 12 | Web › "Silence wait" in Engines & keys is saved | saved value `undefined` after choosing 1500 ms | App (item 13) |
| 13 | Ext › the page banner names the engine that was actually used | banner: "Page translated to FA via gemini." (Google was used, Gemini had no key) | App (item 18) |
| 14 | Ext › when every engine fails, the page banner says so instead of "Page translated" | page text unchanged, banner still says "Page translated …" | App (item 18) |
| 15 | Web › a provider outage (HTTP 500) is not reported as "key rejected" | Gemini row: "key rejected" | App (item 19) |
| 16 | Ext › a wrong Gemini key is reported as "Key rejected" | Gemini row: "Connection failed" for Gemini's real `API key not valid` reply | App (item 19) |
| 17 | Ext › "Detected" shows FA when Persian text is selected | "Detected: EN" | App (item 20) |
| 18 | Web › every interface text the page uses exists in both English and Persian | missing: pages, words, slides, sheets, docAddedToGlossary, noTermsToReview, vAskLangAuto | App (item 21) |
| 19 | Web › the Ask AI answer-language menu shows a readable first choice | first option reads "vAskLangAuto" | App (item 21) |
| 20 | Web › the Voice panel's "Microphone engine" menu shows the saved choice | Engines & keys says "browser", Voice panel says "auto" | App (item 22) |
| 21 | Web › the Download button can be clicked as soon as translation finishes | element under the button's centre: the "Done" message (1280 × 900 window) | App (item 23, minor, depends on window size) |
| 22 | Web › JSON: the downloaded file can be read by a strict JSON reader | first character is U+FEFF (byte-order mark) | App (item 24) |
| 23 | Web › DOCX: elements the app adds are in the order the Office file format requires | 15 out-of-order elements (e.g. `<w:pPr> has <w:bidi> after <w:rPr>`) | App (item 25; effect on Microsoft Word not tested) |

### How the stub could mislead, and what was done about it

The stub's answers are my imitation of each provider, based on their
published formats. They were not compared with live replies here, because
live access was blocked. Two results depend on that imitation:

* #16 uses Gemini's error body for a wrong key
  (`{"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT", … "reason":"API_KEY_INVALID"}}`).
  If Google's real wording differs, the extension may show something else.
  The optional live tests can be extended to check this with a real key.
* #15 forces an HTTP 500 with a typical Google error body.

## Mistakes in my own tests, found and fixed while writing the suite

These were test problems, not app problems. They are listed so you can see
what was checked:

* The character counter expected "33"; the correct count of the typed text
  is 32.
* The stub returned plain text to the voice interpreter because its
  interpreter prompt also contains "Transcribe the spoken audio". Fixed the
  stub's order of checks.
* `--proxy-bypass-list=<-loopback>` sent the local web app through the
  stub; removed.
* The browser's own "Failed to load resource" log lines (normal when an
  engine without a key answers 401) were counted as app errors; they are now
  ignored, while the app's own errors are still caught.
* Browser CORS "preflight" requests were counted as app requests; the stub
  counter now ignores them.
* The sample Word file has 8 text segments, not 7 (its footnote counts).
* The generated Excel sample had no "sheet view", which real Excel files
  always have; the sample now has one (item 26 notes the limitation).
* LibreOffice here was first missing its Writer/Calc/Impress parts, so it
  could not open even the original samples. The check now proves LibreOffice
  can open the original before judging the translated file, and otherwise
  says "not checked". After installing those parts, all three translated
  Office files opened.
* Extension tests that acted within milliseconds of the mouse release raced
  the extension's own 50 ms delay (2 of 3 runs failed). The tests now pause
  300 ms, like a person, before pressing M or the menu. After that, 5 runs
  out of 5 passed.
* Double-click was aimed at the middle of the paragraph's box (empty space)
  instead of the word itself; fixed.

## What was not verified here

* **Real microphone and speech recognition**: a recorded sound file stands
  in for the microphone, and "Gemini" transcription is the stub.
* **Windows / Edge voices**: this Chromium has 0 device voices. The
  device-voice read-aloud paths were not exercised. Item 6 was confirmed by
  inspecting the content script, not by hearing a voice.
* **Live providers** (Google, MyMemory, Gemini, Groq, OpenRouter, Mistral,
  Cerebras, OpenAI, Claude, Ollama): not reachable from here. Real Google
  answered HTTP 429, MyMemory was blocked, and Gemini needs a key. The 3 live
  tests are reported as skipped.
* **Firefox**: it could not be installed (Mozilla's download servers are
  blocked by this environment's network policy), so nothing beyond
  `web-ext lint` ran for the Firefox build.
* **Microsoft Edge itself**: the Chrome build was tested in Chromium. Edge's
  own behaviour (its mini menu next to selections, "site access on click")
  was not.
* **Microsoft Office**: translated files were opened with LibreOffice 24.2,
  not Word, PowerPoint or Excel.
* **The native right-click menu**: automation cannot click Chrome's menu.
  The tests press the right mouse button on the selection and then call the
  extension's own menu handler with the data Chrome would pass (see
  `tests/support/extension.js`).

## Full output of the final run

This is the complete console output of `npm test` (second run), with colour
codes removed. The last line was added by the shell to show the exit code.

```text

> makan-translate-dev@0.0.0 test
> node tests/run-all.js

══════════════════════════════════════════════════════════════════════════════
STEP 1  Build the extension (node build-manifests.js)
══════════════════════════════════════════════════════════════════════════════
📦 Building Firefox Manifest & Package...
✅ Firefox build ready at: dist/firefox/ (and extension/manifest.firefox.json)
📦 Building Chrome/Edge Manifest & Package...
✅ Chrome/Edge build ready at: dist/chrome/ (and extension/manifest.chrome.json)
══════════════════════════════════════════════════════════════════════════════
STEP 2  Browser tests (web + ext + live) in Chromium, with a local stand-in for the translation services
══════════════════════════════════════════════════════════════════════════════

Running 65 tests using 1 worker

  ✓   1 [web] › tests/web/compare-glossary-history.spec.js:17:3 › Web app: Compare tab › shows one result card per ticked engine (2.0s)
  ✓   2 [web] › tests/web/compare-glossary-history.spec.js:46:5 › Web app: Glossary tab › with Google › a term added by typing is applied to translations and kept after a reload (2.2s)
  ✓   3 [web] › tests/web/compare-glossary-history.spec.js:79:5 › Web app: Glossary tab › with Gemini › AI engines receive the glossary in their instructions (1.1s)
  ✘   4 [web] › tests/web/compare-glossary-history.spec.js:86:5 › Web app: Glossary tab › with Gemini › "+ Add to Glossary" in the Document tab keeps the terms after a reload (11.8s)
  ✓   5 [web] › tests/web/compare-glossary-history.spec.js:108:3 › Web app: History tab › lists translations newest first and "Clear history" empties it (3.4s)
  ✘   6 [web] › tests/web/document.spec.js:51:3 › Web app: Document tab › the Download button can be clicked as soon as translation finishes (nothing covers it) (1.4s)
  ✓   7 [web] › tests/web/document.spec.js:63:3 › Web app: Document tab › TXT: every line translated, empty lines kept (6.7s)
  ✓   8 [web] › tests/web/document.spec.js:71:3 › Web app: Document tab › Markdown: headings, lists, quotes and links survive; code blocks are not translated (6.1s)
  ✓   9 [web] › tests/web/document.spec.js:84:3 › Web app: Document tab › JSON: same keys, numbers and booleans; text values translated (6.0s)
  ✘  10 [web] › tests/web/document.spec.js:96:3 › Web app: Document tab › JSON: the downloaded file can be read by a strict JSON reader (no byte-order mark) (6.2s)
  ✓  11 [web] › tests/web/document.spec.js:103:3 › Web app: Document tab › CSV: same rows and columns, numbers kept, a field with a comma stays quoted (6.7s)
  ✓  12 [web] › tests/web/document.spec.js:114:3 › Web app: Document tab › DOCX: valid file, same paragraphs and table, text translated, right-to-left set, footnote kept (9.8s)
  ✘  13 [web] › tests/web/document.spec.js:141:3 › Web app: Document tab › DOCX: elements the app adds are in the order the Office file format requires (6.3s)
  ✓  14 [web] › tests/web/document.spec.js:153:3 › Web app: Document tab › PPTX: valid file, same slides, text translated, right-to-left set (10.0s)
  ✓  15 [web] › tests/web/document.spec.js:171:3 › Web app: Document tab › XLSX: valid file, same sheets, formulas and numbers kept, text translated, sheets right-to-left (9.4s)
  ✓  16 [web] › tests/web/settings.spec.js:26:3 › Web app: Engines & keys › opens, saves a typed Gemini key, and "Check connections" finishes with a status for every engine (1.8s)
  ✓  17 [web] › tests/web/settings.spec.js:50:3 › Web app: Engines & keys › a wrong Gemini key is reported as "key rejected" (1.4s)
  ✘  18 [web] › tests/web/settings.spec.js:58:3 › Web app: Engines & keys › a provider outage (HTTP 500) is not reported as "key rejected" (11.6s)
  ✘  19 [web] › tests/web/settings.spec.js:67:3 › Web app: Engines & keys › API keys are not sent to the web app's own server (4.2s)
  ✘  20 [web] › tests/web/settings.spec.js:83:5 › Web app: Engines & keys › voice settings › "Silence wait" in Engines & keys is saved (1.8s)
  ✓  21 [web] › tests/web/subtitle.spec.js:42:3 › Web app: Subtitle tab › opens an SRT, translates it, keeps an edited line, and exports valid SRT and VTT with identical timings (2.3s)
  ✓  22 [web] › tests/web/tabs-and-language.spec.js:12:3 › Web app: tabs › every tab opens with a real mouse click and shows its panel, with no console errors (3.1s)
  ✘  23 [web] › tests/web/tabs-and-language.spec.js:34:3 › Web app: interface language › every interface text the page uses exists in both English and Persian (584ms)
  ✘  24 [web] › tests/web/tabs-and-language.spec.js:47:3 › Web app: interface language › the Ask AI answer-language menu shows a readable first choice (11.8s)
  ✓  25 [web] › tests/web/tabs-and-language.spec.js:54:3 › Web app: interface language › switches to Persian (right-to-left) and back to English (left-to-right); choice survives a reload (2.2s)
  ✓  26 [web] › tests/web/text.spec.js:10:5 › Web app: Text tab › with only Google switched on › typed text is translated with Ctrl+Enter, line breaks are kept, and the result is saved in History (1.5s)
  ✓  27 [web] › tests/web/text.spec.js:44:5 › Web app: Text tab › with only Google switched on › Copy puts the translation on the clipboard (944ms)
  ✘  28 [web] › tests/web/text.spec.js:55:5 › Web app: Text tab › with only Google switched on › opening the app with ?text=…&src=…&tgt=… (what the extension's "Open in App" does) fills the Text tab (3.8s)
  ✘  29 [web] › tests/web/text.spec.js:63:5 › Web app: Text tab › with only Google switched on › when the only engine is rate-limited (HTTP 429), the user gets an answer or an error within 30 seconds (31.9s)
  ✓  30 [web] › tests/web/text.spec.js:85:5 › Web app: Text tab › with Gemini first and Google second › Gemini is used when it works (1.8s)
  ✓  31 [web] › tests/web/text.spec.js:100:5 › Web app: Text tab › with Gemini first and Google second › when Gemini fails, Google takes over and the user is told (902ms)
  ✓  32 [web] › tests/web/voice.spec.js:24:5 › Web app: Voice tab › with a Gemini key › holding Talk goes ready → listening → working → speaking → ready and adds a translated bubble (5.6s)
  ✓  33 [web] › tests/web/voice.spec.js:67:5 › Web app: Voice tab › with a Gemini key › Ask AI: a typed question gets a spoken answer (3.1s)
  ✘  34 [web] › tests/web/voice.spec.js:89:5 › Web app: Voice tab › saved microphone setting › the Voice panel's "Microphone engine" menu shows the saved choice (10.9s)
  ✘  35 [web] › tests/web/voice.spec.js:101:5 › Web app: Voice tab › without any AI key › with "Microphone engine: Browser", Talk does not start downloading the offline Whisper model (8.2s)
  ✓  36 [ext] › tests/ext/options.spec.js:26:3 › Extension: options page › opens without errors and saves behaviour settings (3.1s)
  ✓  37 [ext] › tests/ext/options.spec.js:43:3 › Extension: options page › a typed Gemini key is saved, and "Check Connections" reports each engine (2.0s)
  ✘  38 [ext] › tests/ext/options.spec.js:57:3 › Extension: options page › a wrong Gemini key is reported as "Key rejected" (11.9s)
  ✓  39 [ext] › tests/ext/options.spec.js:65:3 › Extension: options page › "Export Backup" downloads a settings file containing the saved settings (2.3s)
  ✘  40 [ext] › tests/ext/options.spec.js:75:3 › Extension: options page › settings exported from the web app ("Export for Extension") can be imported, and the extension still translates (13.8s)
  ✓  41 [ext] › tests/ext/popup-menu-page.spec.js:8:3 › Extension: toolbar popup (the real popup, opened with chrome.action.openPopup) › translates typed text (2.7s)
  ✓  42 [ext] › tests/ext/popup-menu-page.spec.js:24:3 › Extension: toolbar popup (the real popup, opened with chrome.action.openPopup) › "Translate Page" translates the page in the tab, and "Show Original" restores it (1.7s)
  ✓  43 [ext] › tests/ext/popup-menu-page.spec.js:40:3 › Extension: right-click menu › "Translate with MAKAN" works on a tab that was open before the extension was loaded (2.0s)
  ✓  44 [ext] › tests/ext/popup-menu-page.spec.js:50:3 › Extension: right-click menu › "Translate with MAKAN" injects the extension into a tab that does not have it yet (2.9s)
  ✓  45 [ext] › tests/ext/popup-menu-page.spec.js:69:3 › Extension: right-click menu › "Translate entire page" translates and "Show Original" restores the text (1.9s)
  ✘  46 [ext] › tests/ext/popup-menu-page.spec.js:85:3 › Extension: right-click menu › "Show Original" brings back links and bold text inside translated paragraphs (11.3s)
  ✘  47 [ext] › tests/ext/popup-menu-page.spec.js:95:3 › Extension: right-click menu › the page banner names the engine that was actually used (11.8s)
  ✘  48 [ext] › tests/ext/popup-menu-page.spec.js:103:3 › Extension: right-click menu › when every engine fails, the page banner says so instead of "Page translated" (11.9s)
  ✓  49 [ext] › tests/ext/popup-menu-page.spec.js:115:3 › Extension: after the extension is reloaded › selecting text in a tab that was already open still translates (4.9s)
  ✘  50 [ext] › tests/ext/popup-menu-page.spec.js:129:3 › Extension: what web pages can and cannot do › a web page cannot make the extension translate it without the user asking (2.9s)
  ✘  51 [ext] › tests/ext/popup-menu-page.spec.js:141:5 › Extension: what web pages can and cannot do › with a Gemini key saved › the content script running inside web pages is not given the API keys (2.1s)
  ✓  52 [ext] › tests/ext/selection-card.spec.js:9:3 › Extension: selection card › loads with no errors on the extensions page (2.2s)
  ✓  53 [ext] › tests/ext/selection-card.spec.js:15:3 › Extension: selection card › drag-selecting text shows the M button; a real mouse press on it opens a translated card (2.1s)
  ✓  54 [ext] › tests/ext/selection-card.spec.js:31:3 › Extension: selection card › selecting inside a text box does not show the M button (1.3s)
  ✓  55 [ext] › tests/ext/selection-card.spec.js:38:3 › Extension: selection card › card controls: Copy, Swap, close button and Escape (3.4s)
  ✘  56 [ext] › tests/ext/selection-card.spec.js:78:3 › Extension: selection card › "Detected" shows FA when Persian text is selected (11.9s)
  ✓  57 [ext] › tests/ext/selection-card.spec.js:86:3 › Extension: selection card › "Open in App" links to the web app with the text and languages (2.3s)
  ✓  58 [ext] › tests/ext/selection-card.spec.js:99:5 › Extension: selection card › Speak button › without a Gemini key or a device voice, Speak shows a clear "no voice" message (1.9s)
  ✘  59 [ext] › tests/ext/selection-card.spec.js:110:5 › Extension: selection card › Speak button › the card can use the computer's own voices (voice helpers are available to the content script) (1.1s)
  ✘  60 [ext] › tests/ext/selection-card.spec.js:122:5 › Extension: selection card › with a Gemini key › Speak plays Gemini voice through the background and shows the playing state (4.0s)
  ✓  61 [ext] › tests/ext/selection-card.spec.js:138:5 › Extension: selection card › with a Gemini key › double-clicking a single word opens a dictionary card (2.0s)
  ✓  62 [ext] › tests/ext/selection-card.spec.js:151:3 › Extension: selection card › double-click without an AI key falls back to a plain translation (1.1s)
  -  63 [live] › tests/live/live-services.spec.js:40:3 › Live services (real internet) › real Google Translate translates a sentence
  -  64 [live] › tests/live/live-services.spec.js:52:3 › Live services (real internet) › real Gemini translates a sentence
  -  65 [live] › tests/live/live-services.spec.js:63:3 › Live services (real internet) › real Gemini read-aloud returns audio


  1) [web] › tests/web/compare-glossary-history.spec.js:86:5 › Web app: Glossary tab › with Gemini › "+ Add to Glossary" in the Document tab keeps the terms after a reload 

    Error: glossary rows after reload (MAKAN from before + cache from the document)

    expect(locator).toHaveCount(expected) failed

    Locator:  locator('#gList .gl')
    Expected: 2
    Received: 1
    Timeout:  10000ms

    Call log:
      - glossary rows after reload (MAKAN from before + cache from the document) with timeout 10000ms
      - waiting for locator('#gList .gl')
        14 × locator resolved to 1 element
           - unexpected value "1"


       98 |       await page.reload();
       99 |       await mouseClick(page, page.locator('#tabs button[data-tab="gls"]'));
    > 100 |       await expect(page.locator('#gList .gl'), 'glossary rows after reload (MAKAN from before + cache from the document)').toHaveCount(2);
          |                                                                                                                            ^
      101 |     });
      102 |   });
      103 | });
        at /home/user/translator/tests/web/compare-glossary-history.spec.js:100:124

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    tests/.results/artifacts/web-compare-glossary-histo-08f39-ps-the-terms-after-a-reload-web/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: tests/.results/artifacts/web-compare-glossary-histo-08f39-ps-the-terms-after-a-reload-web/error-context.md

    attachment #3: trace (application/zip) ─────────────────────────────────────────────────────────
    tests/.results/artifacts/web-compare-glossary-histo-08f39-ps-the-terms-after-a-reload-web/trace.zip
    Usage:

        npx playwright show-trace tests/.results/artifacts/web-compare-glossary-histo-08f39-ps-the-terms-after-a-reload-web/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  2) [web] › tests/web/document.spec.js:51:3 › Web app: Document tab › the Download button can be clicked as soon as translation finishes (nothing covers it) 

    Error: element under the middle of the Download button right after "Done"

    expect(received).toBe(expected) // Object.is equality

    Expected: "dSave"
    Received: "toast ok"

      58 |     const onTop = await page.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return e.id || e.className || e.tagName; }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
      59 |     test.info().annotations.push({ type: 'window size', description: '1280 x 900' });
    > 60 |     expect(onTop, 'element under the middle of the Download button right after "Done"').toBe('dSave');
         |                                                                                         ^
      61 |   });
      62 |
      63 |   test('TXT: every line translated, empty lines kept', async ({ app, files }) => {
        at /home/user/translator/tests/web/document.spec.js:60:89

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    tests/.results/artifacts/web-document-Web-app-Docum-b3cd8-finishes-nothing-covers-it--web/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: tests/.results/artifacts/web-document-Web-app-Docum-b3cd8-finishes-nothing-covers-it--web/error-context.md

    attachment #3: trace (application/zip) ─────────────────────────────────────────────────────────
    tests/.results/artifacts/web-document-Web-app-Docum-b3cd8-finishes-nothing-covers-it--web/trace.zip
    Usage:

        npx playwright show-trace tests/.results/artifacts/web-document-Web-app-Docum-b3cd8-finishes-nothing-covers-it--web/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  3) [web] › tests/web/document.spec.js:96:3 › Web app: Document tab › JSON: the downloaded file can be read by a strict JSON reader (no byte-order mark) 

    Error: first character of the file (65279 = invisible byte-order mark, which strict JSON readers reject)

    expect(received).not.toBe(expected) // Object.is equality

    Expected: not 65279

       97 |     const out = await translateDocument(app.page, files.json, 5);
       98 |     const raw = out.bytes.toString('utf8');
    >  99 |     expect(raw.charCodeAt(0), 'first character of the file (65279 = invisible byte-order mark, which strict JSON readers reject)').not.toBe(0xfeff);
          |                                                                                                                                        ^
      100 |     expect(() => JSON.parse(raw)).not.toThrow();
      101 |   });
      102 |
        at /home/user/translator/tests/web/document.spec.js:99:136

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    tests/.results/artifacts/web-document-Web-app-Docum-7a72a--reader-no-byte-order-mark--web/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: tests/.results/artifacts/web-document-Web-app-Docum-7a72a--reader-no-byte-order-mark--web/error-context.md

    attachment #3: trace (application/zip) ─────────────────────────────────────────────────────────
    tests/.results/artifacts/web-document-Web-app-Docum-7a72a--reader-no-byte-order-mark--web/trace.zip
    Usage:

        npx playwright show-trace tests/.results/artifacts/web-document-Web-app-Docum-7a72a--reader-no-byte-order-mark--web/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  4) [web] › tests/web/document.spec.js:141:3 › Web app: Document tab › DOCX: elements the app adds are in the order the Office file format requires 

    Error: elements out of schema order (Word may refuse or "repair" such files)

    expect(received).toEqual(expected) // deep equality

    - Expected  -  1
    + Received  + 15

    - Array []
    + Array [
    +   "word/document.xml: <w:rPr> has <w:rFonts> after <w:rtl>",
    +   "word/document.xml: <w:pPr> has <w:bidi> after <w:rPr>",
    +   "word/document.xml: <w:rPr> has <w:rFonts> after <w:rtl>",
    +   "word/document.xml: <w:rPr> has <w:rFonts> after <w:rtl>",
    +   "word/document.xml: <w:rPr> has <w:rFonts> after <w:rtl>",
    +   "word/document.xml: <w:rPr> has <w:rFonts> after <w:rtl>",
    +   "word/document.xml: <w:rPr> has <w:rFonts> after <w:rtl>",
    +   "word/document.xml: <w:rPr> has <w:rFonts> after <w:rtl>",
    +   "word/document.xml: <w:rPr> has <w:rFonts> after <w:rtl>",
    +   "word/document.xml: <w:rPr> has <w:rFonts> after <w:rtl>",
    +   "word/document.xml: <w:rPr> has <w:rFonts> after <w:rtl>",
    +   "word/footnotes.xml: <w:rPr> has <w:rFonts> after <w:rtl>",
    +   "word/footnotes.xml: <w:rPr> has <w:rFonts> after <w:rtl>",
    + ]

      148 |       ...schemaOrderProblems(after.parts['word/footnotes.xml'], 'word/footnotes.xml')
      149 |     ];
    > 150 |     expect(problems, 'elements out of schema order (Word may refuse or "repair" such files)').toEqual([]);
          |                                                                                               ^
      151 |   });
      152 |
      153 |   test('PPTX: valid file, same slides, text translated, right-to-left set', async ({ app, files }) => {
        at /home/user/translator/tests/web/document.spec.js:150:95

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    tests/.results/artifacts/web-document-Web-app-Docum-0d044-Office-file-format-requires-web/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: tests/.results/artifacts/web-document-Web-app-Docum-0d044-Office-file-format-requires-web/error-context.md

    attachment #3: trace (application/zip) ─────────────────────────────────────────────────────────
    tests/.results/artifacts/web-document-Web-app-Docum-0d044-Office-file-format-requires-web/trace.zip
    Usage:

        npx playwright show-trace tests/.results/artifacts/web-document-Web-app-Docum-0d044-Office-file-format-requires-web/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  5) [web] › tests/web/settings.spec.js:58:3 › Web app: Engines & keys › a provider outage (HTTP 500) is not reported as "key rejected" 

    Error: a server error says nothing about the key

    expect(locator).not.toHaveText(expected) failed

    Locator:  locator('#engList .eng[data-id="gemini"] .eng-status')
    Expected: not "key rejected"
    Received: "key rejected"
    Timeout:  10000ms

    Call log:
      - a server error says nothing about the key with timeout 10000ms
      - waiting for locator('#engList .eng[data-id="gemini"] .eng-status')
        14 × locator resolved to <span title="key rejected" class="eng-status err">key rejected</span>
           - unexpected value "key rejected"


      62 |     stub.failHost('generativelanguage.googleapis.com', 500, Infinity, { error: { code: 500, message: 'Internal error encountered.', status: 'INTERNAL' } });
      63 |     await checkConnections(page);
    > 64 |     await expect(statusOf(page, 'gemini'), 'a server error says nothing about the key').not.toHaveText('key rejected');
         |                                                                                             ^
      65 |   });
      66 |
      67 |   test('API keys are not sent to the web app\'s own server', async ({ app }) => {
        at /home/user/translator/tests/web/settings.spec.js:64:93

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    tests/.results/artifacts/web-settings-Web-app-Engin-6c879-t-reported-as-key-rejected--web/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: tests/.results/artifacts/web-settings-Web-app-Engin-6c879-t-reported-as-key-rejected--web/error-context.md

    attachment #3: trace (application/zip) ─────────────────────────────────────────────────────────
    tests/.results/artifacts/web-settings-Web-app-Engin-6c879-t-reported-as-key-rejected--web/trace.zip
    Usage:

        npx playwright show-trace tests/.results/artifacts/web-settings-Web-app-Engin-6c879-t-reported-as-key-rejected--web/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  6) [web] › tests/web/settings.spec.js:67:3 › Web app: Engines & keys › API keys are not sent to the web app's own server 

    Error: requests to the web app's own server that contain an API key

    expect(received).toEqual(expected) // deep equality

    - Expected  - 1
    + Received  + 6

    - Array []
    + Array [
    +   "POST /api/sync_keys body={\"gemini\":\"stub-valid-key\",\"groq\":\"\"}",
    +   "POST /api/sync_keys body={\"gemini\":\"stub-valid-key\",\"groq\":\"\"}",
    +   "POST /api/sync_keys body={\"gemini\":\"stub-valid-key\",\"groq\":\"\"}",
    +   "POST /api/sync_keys body={\"gemini\":\"stub-valid-key\",\"groq\":\"\"}",
    + ]

      75 |     await page.waitForTimeout(1500);
      76 |     const leaks = stub.log.filter(e => e.server === 'app' && (e.body.includes(VALID_KEY) || e.query.includes(VALID_KEY)));
    > 77 |     expect(leaks.map(e => `${e.method} ${e.path} body=${e.body}`), 'requests to the web app\'s own server that contain an API key').toEqual([]);
         |                                                                                                                                     ^
      78 |   });
      79 |
      80 |   test.describe('voice settings', () => {
        at /home/user/translator/tests/web/settings.spec.js:77:133

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    tests/.results/artifacts/web-settings-Web-app-Engin-7674b-to-the-web-app-s-own-server-web/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: tests/.results/artifacts/web-settings-Web-app-Engin-7674b-to-the-web-app-s-own-server-web/error-context.md

    attachment #3: trace (application/zip) ─────────────────────────────────────────────────────────
    tests/.results/artifacts/web-settings-Web-app-Engin-7674b-to-the-web-app-s-own-server-web/trace.zip
    Usage:

        npx playwright show-trace tests/.results/artifacts/web-settings-Web-app-Engin-7674b-to-the-web-app-s-own-server-web/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  7) [web] › tests/web/settings.spec.js:83:5 › Web app: Engines & keys › voice settings › "Silence wait" in Engines & keys is saved 

    Error: saved silence wait (ms)

    expect(received).toBe(expected) // Object.is equality

    Expected: 1500
    Received: undefined

      90 |       await mouseClick(page, page.locator('#btnSaveDone'));
      91 |       const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('mkt_cfg')).silenceWait);
    > 92 |       expect(stored, 'saved silence wait (ms)').toBe(1500);
         |                                                 ^
      93 |     });
      94 |   });
      95 | });
        at /home/user/translator/tests/web/settings.spec.js:92:49

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    tests/.results/artifacts/web-settings-Web-app-Engin-8335b-it-in-Engines-keys-is-saved-web/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: tests/.results/artifacts/web-settings-Web-app-Engin-8335b-it-in-Engines-keys-is-saved-web/error-context.md

    attachment #3: trace (application/zip) ─────────────────────────────────────────────────────────
    tests/.results/artifacts/web-settings-Web-app-Engin-8335b-it-in-Engines-keys-is-saved-web/trace.zip
    Usage:

        npx playwright show-trace tests/.results/artifacts/web-settings-Web-app-Engin-8335b-it-in-Engines-keys-is-saved-web/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  8) [web] › tests/web/tabs-and-language.spec.js:34:3 › Web app: interface language › every interface text the page uses exists in both English and Persian 

    Error: text keys with no English / Persian wording (the raw key name is shown instead)

    expect(received).toEqual(expected) // deep equality

    - Expected  -  2
    + Received  + 18

      Object {
    -   "en": Array [],
    -   "fa": Array [],
    +   "en": Array [
    +     "pages",
    +     "words",
    +     "slides",
    +     "sheets",
    +     "docAddedToGlossary",
    +     "noTermsToReview",
    +     "vAskLangAuto",
    +   ],
    +   "fa": Array [
    +     "pages",
    +     "words",
    +     "slides",
    +     "sheets",
    +     "docAddedToGlossary",
    +     "noTermsToReview",
    +     "vAskLangAuto",
    +   ],
      }

      42 |       return { en: [...used].filter(k => !(k in I18N.en)), fa: [...used].filter(k => !(k in I18N.fa)) };
      43 |     });
    > 44 |     expect(missing, 'text keys with no English / Persian wording (the raw key name is shown instead)').toEqual({ en: [], fa: [] });
         |                                                                                                        ^
      45 |   });
      46 |
      47 |   test('the Ask AI answer-language menu shows a readable first choice', async ({ app }) => {
        at /home/user/translator/tests/web/tabs-and-language.spec.js:44:104

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    tests/.results/artifacts/web-tabs-and-language-Web--14902-in-both-English-and-Persian-web/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: tests/.results/artifacts/web-tabs-and-language-Web--14902-in-both-English-and-Persian-web/error-context.md

    attachment #3: trace (application/zip) ─────────────────────────────────────────────────────────
    tests/.results/artifacts/web-tabs-and-language-Web--14902-in-both-English-and-Persian-web/trace.zip
    Usage:

        npx playwright show-trace tests/.results/artifacts/web-tabs-and-language-Web--14902-in-both-English-and-Persian-web/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  9) [web] › tests/web/tabs-and-language.spec.js:47:3 › Web app: interface language › the Ask AI answer-language menu shows a readable first choice 

    Error: expect(locator).not.toHaveText(expected) failed

    Locator:  locator('#vAskLang option').first()
    Expected: not "vAskLangAuto"
    Received: "vAskLangAuto"
    Timeout:  10000ms

    Call log:
      - Expect "not toHaveText" with timeout 10000ms
      - waiting for locator('#vAskLang option').first()
        14 × locator resolved to <option value="auto">vAskLangAuto</option>
           - unexpected value "vAskLangAuto"


      49 |     await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));
      50 |     await mouseClick(page, page.locator('#vTabAsk'));
    > 51 |     await expect(page.locator('#vAskLang option').first()).not.toHaveText('vAskLangAuto');
         |                                                                ^
      52 |   });
      53 |
      54 |   test('switches to Persian (right-to-left) and back to English (left-to-right); choice survives a reload', async ({ app }) => {
        at /home/user/translator/tests/web/tabs-and-language.spec.js:51:64

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    tests/.results/artifacts/web-tabs-and-language-Web--959ac-ows-a-readable-first-choice-web/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: tests/.results/artifacts/web-tabs-and-language-Web--959ac-ows-a-readable-first-choice-web/error-context.md

    attachment #3: trace (application/zip) ─────────────────────────────────────────────────────────
    tests/.results/artifacts/web-tabs-and-language-Web--959ac-ows-a-readable-first-choice-web/trace.zip
    Usage:

        npx playwright show-trace tests/.results/artifacts/web-tabs-and-language-Web--959ac-ows-a-readable-first-choice-web/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  10) [web] › tests/web/text.spec.js:55:5 › Web app: Text tab › with only Google switched on › opening the app with ?text=…&src=…&tgt=… (what the extension's "Open in App" does) fills the Text tab 

    Error: the text passed in the address should appear in the source box

    expect(locator).toHaveValue(expected) failed

    Locator:  locator('#tIn')
    Expected: "Hello from the extension"
    Received: ""
    Timeout:  3000ms

    Call log:
      - the text passed in the address should appear in the source box with timeout 3000ms
      - waiting for locator('#tIn')
        7 × locator resolved to <textarea id="tIn" dir="auto" data-tp="phIn" placeholder="Type or paste text…"></textarea>
          - unexpected value ""


      58 |       await page.goto(stub.appOrigin + '/?text=' + encodeURIComponent('Hello from the extension') + '&src=en&tgt=fa');
      59 |       await expect(page.locator('#tabs button').first()).toBeVisible();
    > 60 |       await expect(page.locator('#tIn'), 'the text passed in the address should appear in the source box').toHaveValue('Hello from the extension', { timeout: 3000 });
         |                                                                                                            ^
      61 |     });
      62 |
      63 |     test('when the only engine is rate-limited (HTTP 429), the user gets an answer or an error within 30 seconds', async ({ app }) => {
        at /home/user/translator/tests/web/text.spec.js:60:108

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    tests/.results/artifacts/web-text-Web-app-Text-tab--82978-App-does-fills-the-Text-tab-web/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: tests/.results/artifacts/web-text-Web-app-Text-tab--82978-App-does-fills-the-Text-tab-web/error-context.md

    attachment #3: trace (application/zip) ─────────────────────────────────────────────────────────
    tests/.results/artifacts/web-text-Web-app-Text-tab--82978-App-does-fills-the-Text-tab-web/trace.zip
    Usage:

        npx playwright show-trace tests/.results/artifacts/web-text-Web-app-Text-tab--82978-App-does-fills-the-Text-tab-web/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  11) [web] › tests/web/text.spec.js:63:5 › Web app: Text tab › with only Google switched on › when the only engine is rate-limited (HTTP 429), the user gets an answer or an error within 30 seconds 

    Error: Translate button should be usable again (with an error shown) instead of retrying forever

    expect(locator).toBeEnabled() failed

    Locator:  locator('#tGo')
    Expected: enabled
    Received: disabled
    Timeout:  30000ms

    Call log:
      - Translate button should be usable again (with an error shown) instead of retrying forever with timeout 30000ms
      - waiting for locator('#tGo')
        34 × locator resolved to <button id="tGo" disabled class="btn cta">…</button>
           - unexpected value "disabled"

    The app sent 16 requests in 30 s and was still retrying.

      75 |         .catch(async e => {
      76 |           const n = stub.calls('translate.googleapis.com').length + stub.calls('clients5.google.com').length;
    > 77 |           throw new Error(`${e.message}\nThe app sent ${n} requests in 30 s and was still retrying.`);
         |                 ^
      78 |         });
      79 |     });
      80 |   });
        at /home/user/translator/tests/web/text.spec.js:77:17
        at /home/user/translator/tests/web/text.spec.js:73:7

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    tests/.results/artifacts/web-text-Web-app-Text-tab--6f2f5--an-error-within-30-seconds-web/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: tests/.results/artifacts/web-text-Web-app-Text-tab--6f2f5--an-error-within-30-seconds-web/error-context.md

    attachment #3: trace (application/zip) ─────────────────────────────────────────────────────────
    tests/.results/artifacts/web-text-Web-app-Text-tab--6f2f5--an-error-within-30-seconds-web/trace.zip
    Usage:

        npx playwright show-trace tests/.results/artifacts/web-text-Web-app-Text-tab--6f2f5--an-error-within-30-seconds-web/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  12) [web] › tests/web/voice.spec.js:89:5 › Web app: Voice tab › saved microphone setting › the Voice panel's "Microphone engine" menu shows the saved choice 

    Error: the Voice panel menu

    expect(locator).toHaveValue(expected) failed

    Locator:  locator('#vSttChoice')
    Expected: "browser"
    Received: "auto"
    Timeout:  10000ms

    Call log:
      - the Voice panel menu with timeout 10000ms
      - waiting for locator('#vSttChoice')
        14 × locator resolved to <select id="vSttChoice">…</select>
           - unexpected value "auto"


      92 |       await mouseClick(page, page.locator('#vToggleSettings'));
      93 |       await expect(page.locator('#sttSel'), 'the same setting in Engines & keys').toHaveValue('browser');
    > 94 |       await expect(page.locator('#vSttChoice'), 'the Voice panel menu').toHaveValue('browser');
         |                                                                         ^
      95 |     });
      96 |   });
      97 |
        at /home/user/translator/tests/web/voice.spec.js:94:73

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    tests/.results/artifacts/web-voice-Web-app-Voice-ta-7cb27-menu-shows-the-saved-choice-web/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: tests/.results/artifacts/web-voice-Web-app-Voice-ta-7cb27-menu-shows-the-saved-choice-web/error-context.md

    attachment #3: trace (application/zip) ─────────────────────────────────────────────────────────
    tests/.results/artifacts/web-voice-Web-app-Voice-ta-7cb27-menu-shows-the-saved-choice-web/trace.zip
    Usage:

        npx playwright show-trace tests/.results/artifacts/web-voice-Web-app-Voice-ta-7cb27-menu-shows-the-saved-choice-web/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  13) [web] › tests/web/voice.spec.js:101:5 › Web app: Voice tab › without any AI key › with "Microphone engine: Browser", Talk does not start downloading the offline Whisper model 

    Error: requests for the offline AI library / Whisper model

    expect(received).toEqual(expected) // deep equality

    - Expected  - 1
    + Received  + 3

    - Array []
    + Array [
    +   "cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1",
    + ]

      115 |       await page.waitForTimeout(4000);
      116 |       const modelFetches = stub.log.filter(e => e.host === 'cdn.jsdelivr.net' && e.path.includes('huggingface') || e.host === 'huggingface.co');
    > 117 |       expect(modelFetches.map(e => e.host + e.path), 'requests for the offline AI library / Whisper model').toEqual([]);
          |                                                                                                             ^
      118 |     });
      119 |   });
      120 | });
        at /home/user/translator/tests/web/voice.spec.js:117:109

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    tests/.results/artifacts/web-voice-Web-app-Voice-ta-654d4-g-the-offline-Whisper-model-web/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: tests/.results/artifacts/web-voice-Web-app-Voice-ta-654d4-g-the-offline-Whisper-model-web/error-context.md

    attachment #3: trace (application/zip) ─────────────────────────────────────────────────────────
    tests/.results/artifacts/web-voice-Web-app-Voice-ta-654d4-g-the-offline-Whisper-model-web/trace.zip
    Usage:

        npx playwright show-trace tests/.results/artifacts/web-voice-Web-app-Voice-ta-654d4-g-the-offline-Whisper-model-web/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  14) [ext] › tests/ext/options.spec.js:57:3 › Extension: options page › a wrong Gemini key is reported as "Key rejected" 

    Error: Gemini answers "API key not valid" for a wrong key

    expect(locator).toHaveText(expected) failed

    Locator:  locator('#optEngineList .opt-eng-row[data-id="gemini"]').locator('.opt-status-pill')
    Expected: "Key rejected"
    Received: "Connection failed"
    Timeout:  10000ms

    Call log:
      - Gemini answers "API key not valid" for a wrong key with timeout 10000ms
      - waiting for locator('#optEngineList .opt-eng-row[data-id="gemini"]').locator('.opt-status-pill')
        14 × locator resolved to <span class="opt-status-pill err">Connection failed</span>
           - unexpected value "Connection failed"


      60 |     await mouseClick(page, page.locator('#btnCheckConn'));
      61 |     await expect(page.locator('#optToasts')).toContainText(/Connections checked/, { timeout: 30_000 });
    > 62 |     await expect(row(page, 'gemini').locator('.opt-status-pill'), 'Gemini answers "API key not valid" for a wrong key').toHaveText('Key rejected');
         |                                                                                                                         ^
      63 |   });
      64 |
      65 |   test('"Export Backup" downloads a settings file containing the saved settings', async ({ ext }) => {
        at /home/user/translator/tests/ext/options.spec.js:62:121

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    tests/.results/artifacts/ext-options-Extension-opti-f04b8-s-reported-as-Key-rejected--ext/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: screenshot (image/png) ──────────────────────────────────────────────────────────
    tests/.results/artifacts/ext-options-Extension-opti-f04b8-s-reported-as-Key-rejected--ext/test-failed-2.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: tests/.results/artifacts/ext-options-Extension-opti-f04b8-s-reported-as-Key-rejected--ext/error-context.md

    attachment #4: trace (application/zip) ─────────────────────────────────────────────────────────
    tests/.results/artifacts/ext-options-Extension-opti-f04b8-s-reported-as-Key-rejected--ext/trace.zip
    Usage:

        npx playwright show-trace tests/.results/artifacts/ext-options-Extension-opti-f04b8-s-reported-as-Key-rejected--ext/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  15) [ext] › tests/ext/options.spec.js:75:3 › Extension: options page › settings exported from the web app ("Export for Extension") can be imported, and the extension still translates 

    Error: the card after importing web-app settings

    expect(locator).toContainText(expected) failed

    Locator: locator('#makan-translate-root .makan-card .makan-card-body')
    Expected substring: "[fa] First item in the list of things."
    Received string:    "⚠️ Cannot read properties of undefined (reading 'key')"
    Timeout: 10000ms

    Call log:
      - the card after importing web-app settings with timeout 10000ms
      - waiting for locator('#makan-translate-root .makan-card .makan-card-body')
        14 × locator resolved to <div id="makanCardBody" class="makan-card-body">…</div>
           - unexpected value "⚠️ Cannot read properties of undefined (reading 'key')"


      100 |     await dragSelect(article, '#li1');
      101 |     await pressM(article);
    > 102 |     await expect(inShadow(article, '.makan-card .makan-card-body'), 'the card after importing web-app settings').toContainText('[fa] First item in the list of things.');
          |                                                                                                                  ^
      103 |   });
      104 | });
      105 |
        at /home/user/translator/tests/ext/options.spec.js:102:114

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    tests/.results/artifacts/ext-options-Extension-opti-bcbee--extension-still-translates-ext/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: screenshot (image/png) ──────────────────────────────────────────────────────────
    tests/.results/artifacts/ext-options-Extension-opti-bcbee--extension-still-translates-ext/test-failed-2.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #3: screenshot (image/png) ──────────────────────────────────────────────────────────
    tests/.results/artifacts/ext-options-Extension-opti-bcbee--extension-still-translates-ext/test-failed-3.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: tests/.results/artifacts/ext-options-Extension-opti-bcbee--extension-still-translates-ext/error-context.md

    attachment #5: trace (application/zip) ─────────────────────────────────────────────────────────
    tests/.results/artifacts/ext-options-Extension-opti-bcbee--extension-still-translates-ext/trace.zip
    Usage:

        npx playwright show-trace tests/.results/artifacts/ext-options-Extension-opti-bcbee--extension-still-translates-ext/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  16) [ext] › tests/ext/popup-menu-page.spec.js:85:3 › Extension: right-click menu › "Show Original" brings back links and bold text inside translated paragraphs 

    Error: the link inside the paragraph

    expect(locator).toHaveCount(expected) failed

    Locator:  locator('#p2 a#link1')
    Expected: 1
    Received: 0
    Timeout:  10000ms

    Call log:
      - the link inside the paragraph with timeout 10000ms
      - waiting for locator('#p2 a#link1')
        14 × locator resolved to 0 elements
           - unexpected value "0"


      89 |     await inShadow(page, '#makanRestoreBtn').click();
      90 |     await expect(page.locator('#p2')).toHaveText('This paragraph has a useful link and some bold words inside it.');
    > 91 |     await expect(page.locator('#p2 a#link1'), 'the link inside the paragraph').toHaveCount(1);
         |                                                                                ^
      92 |     await expect(page.locator('#p2 b#bold1'), 'the bold text inside the paragraph').toHaveCount(1);
      93 |   });
      94 |
        at /home/user/translator/tests/ext/popup-menu-page.spec.js:91:80

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    tests/.results/artifacts/ext-popup-menu-page-Extens-652ad-nside-translated-paragraphs-ext/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: tests/.results/artifacts/ext-popup-menu-page-Extens-652ad-nside-translated-paragraphs-ext/error-context.md

    attachment #3: trace (application/zip) ─────────────────────────────────────────────────────────
    tests/.results/artifacts/ext-popup-menu-page-Extens-652ad-nside-translated-paragraphs-ext/trace.zip
    Usage:

        npx playwright show-trace tests/.results/artifacts/ext-popup-menu-page-Extens-652ad-nside-translated-paragraphs-ext/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  17) [ext] › tests/ext/popup-menu-page.spec.js:95:3 › Extension: right-click menu › the page banner names the engine that was actually used 

    Error: expect(locator).toContainText(expected) failed

    Locator: locator('#makan-translate-root .makan-top-banner')
    Timeout: 10000ms
    Expected pattern: /google/i
    Received string:  "
          M
          Page translated to FA via gemini.
          Show Original·······················
        "

    Call log:
      - Expect "toContainText" with timeout 10000ms
      - waiting for locator('#makan-translate-root .makan-top-banner')
        14 × locator resolved to <div class="makan-top-banner">…</div>
           - unexpected value "
          M
          Page translated to FA via gemini.
          Show Original
          
            
          
        "


       98 |     await ext.clickContextMenu('makan-translate-page', page.url());
       99 |     await expect(inShadow(page, '.makan-top-banner')).toContainText('Page translated');
    > 100 |     await expect(inShadow(page, '.makan-top-banner')).toContainText(/google/i);
          |                                                       ^
      101 |   });
      102 |
      103 |   test('when every engine fails, the page banner says so instead of "Page translated"', async ({ ext, stub }) => {
        at /home/user/translator/tests/ext/popup-menu-page.spec.js:100:55

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    tests/.results/artifacts/ext-popup-menu-page-Extens-e2f0d-gine-that-was-actually-used-ext/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: tests/.results/artifacts/ext-popup-menu-page-Extens-e2f0d-gine-that-was-actually-used-ext/error-context.md

    attachment #3: trace (application/zip) ─────────────────────────────────────────────────────────
    tests/.results/artifacts/ext-popup-menu-page-Extens-e2f0d-gine-that-was-actually-used-ext/trace.zip
    Usage:

        npx playwright show-trace tests/.results/artifacts/ext-popup-menu-page-Extens-e2f0d-gine-that-was-actually-used-ext/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  18) [ext] › tests/ext/popup-menu-page.spec.js:103:3 › Extension: right-click menu › when every engine fails, the page banner says so instead of "Page translated" 

    Error: nothing was translated

    expect(locator).not.toContainText(expected) failed

    Locator: locator('#makan-translate-root .makan-top-banner')
    Expected substring: not "Page translated"
    Received string: "
          M
          Page translated to FA via gemini.
          Show Original
          
            
          
        "
    Timeout: 10000ms

    Call log:
      - nothing was translated with timeout 10000ms
      - waiting for locator('#makan-translate-root .makan-top-banner')
        14 × locator resolved to <div class="makan-top-banner">…</div>
           - unexpected value "
          M
          Page translated to FA via gemini.
          Show Original
          
            
          
        "


      108 |     await expect(banner).not.toContainText('Translating', { timeout: 20_000 });
      109 |     await expect(page.locator('#p1')).toHaveText('The quick brown fox jumps over the lazy dog near the river bank.');
    > 110 |     await expect(banner, 'nothing was translated').not.toContainText('Page translated');
          |                                                        ^
      111 |   });
      112 | });
      113 |
        at /home/user/translator/tests/ext/popup-menu-page.spec.js:110:56

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    tests/.results/artifacts/ext-popup-menu-page-Extens-e6b48-instead-of-Page-translated--ext/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: tests/.results/artifacts/ext-popup-menu-page-Extens-e6b48-instead-of-Page-translated--ext/error-context.md

    attachment #3: trace (application/zip) ─────────────────────────────────────────────────────────
    tests/.results/artifacts/ext-popup-menu-page-Extens-e6b48-instead-of-Page-translated--ext/trace.zip
    Usage:

        npx playwright show-trace tests/.results/artifacts/ext-popup-menu-page-Extens-e6b48-instead-of-Page-translated--ext/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  19) [ext] › tests/ext/popup-menu-page.spec.js:129:3 › Extension: what web pages can and cannot do › a web page cannot make the extension translate it without the user asking 

    Error: translation requests started by the page itself

    expect(received).toEqual(expected) // deep equality

    - Expected  - 1
    + Received  + 3

    - Array []
    + Array [
    +   "clients5.google.com/translate_a/t",
    + ]

      132 |     await page.evaluate(() => document.dispatchEvent(new Event('__makan_page_translate_action')));
      133 |     await page.waitForTimeout(2000);
    > 134 |     expect(stub.calls().filter(c => ['clients5.google.com', 'translate.googleapis.com', 'api.mymemory.translated.net', 'generativelanguage.googleapis.com'].includes(c.host)).map(c => c.host + c.path), 'translation requests started by the page itself').toEqual([]);
          |                                                                                                                                                                                                                                                             ^
      135 |     await expect(page.locator('#p1')).toHaveText('The quick brown fox jumps over the lazy dog near the river bank.');
      136 |   });
      137 |
        at /home/user/translator/tests/ext/popup-menu-page.spec.js:134:253

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    tests/.results/artifacts/ext-popup-menu-page-Extens-5768d--it-without-the-user-asking-ext/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: tests/.results/artifacts/ext-popup-menu-page-Extens-5768d--it-without-the-user-asking-ext/error-context.md

    attachment #3: trace (application/zip) ─────────────────────────────────────────────────────────
    tests/.results/artifacts/ext-popup-menu-page-Extens-5768d--it-without-the-user-asking-ext/trace.zip
    Usage:

        npx playwright show-trace tests/.results/artifacts/ext-popup-menu-page-Extens-5768d--it-without-the-user-asking-ext/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  20) [ext] › tests/ext/popup-menu-page.spec.js:141:5 › Extension: what web pages can and cannot do › with a Gemini key saved › the content script running inside web pages is not given the API keys 

    Error: an API key is readable from inside web pages

    expect(received).toBe(expected) // Object.is equality

    Expected: false
    Received: true

      142 |       const page = ext.article;
      143 |       const seen = await inContentScriptWorld(ext, page, `chrome.runtime.sendMessage({ action: 'get-config' }).then(r => JSON.stringify(r).includes(${JSON.stringify(VALID_KEY)}))`);
    > 144 |       expect(seen, 'an API key is readable from inside web pages').toBe(false);
          |                                                                    ^
      145 |     });
      146 |   });
      147 | });
        at /home/user/translator/tests/ext/popup-menu-page.spec.js:144:68

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    tests/.results/artifacts/ext-popup-menu-page-Extens-b035e-s-is-not-given-the-API-keys-ext/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: tests/.results/artifacts/ext-popup-menu-page-Extens-b035e-s-is-not-given-the-API-keys-ext/error-context.md

    attachment #3: trace (application/zip) ─────────────────────────────────────────────────────────
    tests/.results/artifacts/ext-popup-menu-page-Extens-b035e-s-is-not-given-the-API-keys-ext/trace.zip
    Usage:

        npx playwright show-trace tests/.results/artifacts/ext-popup-menu-page-Extens-b035e-s-is-not-given-the-API-keys-ext/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  21) [ext] › tests/ext/selection-card.spec.js:78:3 › Extension: selection card › "Detected" shows FA when Persian text is selected 

    Error: expect(locator).toHaveText(expected) failed

    Locator:  locator('#makan-translate-root #makanDetectedPill')
    Expected: "Detected: FA"
    Received: "Detected: EN"
    Timeout:  10000ms

    Call log:
      - Expect "toHaveText" with timeout 10000ms
      - waiting for locator('#makan-translate-root #makanDetectedPill')
        14 × locator resolved to <span id="makanDetectedPill" class="makan-pill detected">Detected: EN</span>
           - unexpected value "Detected: EN"


      81 |     await pressM(page);
      82 |     await expect(inShadow(page, '.makan-result-text')).toBeVisible();
    > 83 |     await expect(inShadow(page, '#makanDetectedPill')).toHaveText('Detected: FA');
         |                                                        ^
      84 |   });
      85 |
      86 |   test('"Open in App" links to the web app with the text and languages', async ({ ext }) => {
        at /home/user/translator/tests/ext/selection-card.spec.js:83:56

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    tests/.results/artifacts/ext-selection-card-Extensi-edb96-en-Persian-text-is-selected-ext/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: tests/.results/artifacts/ext-selection-card-Extensi-edb96-en-Persian-text-is-selected-ext/error-context.md

    attachment #3: trace (application/zip) ─────────────────────────────────────────────────────────
    tests/.results/artifacts/ext-selection-card-Extensi-edb96-en-Persian-text-is-selected-ext/trace.zip
    Usage:

        npx playwright show-trace tests/.results/artifacts/ext-selection-card-Extensi-edb96-en-Persian-text-is-selected-ext/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  22) [ext] › tests/ext/selection-card.spec.js:110:5 › Extension: selection card › Speak button › the card can use the computer's own voices (voice helpers are available to the content script) 

    Error: expect(received).toEqual(expected) // deep equality

    - Expected  - 3
    + Received  + 3

      Object {
    -   "getNoVoiceMessage": "function",
    -   "pickBestVoice": "function",
    -   "splitTextForSpeech": "function",
    +   "getNoVoiceMessage": "undefined",
    +   "pickBestVoice": "undefined",
    +   "splitTextForSpeech": "undefined",
      }

      113 |       const page = ext.article;
      114 |       const r = await inContentScriptWorld(ext, page, `({ pickBestVoice: typeof pickBestVoice, splitTextForSpeech: typeof splitTextForSpeech, getNoVoiceMessage: typeof getNoVoiceMessage })`);
    > 115 |       expect(r).toEqual({ pickBestVoice: 'function', splitTextForSpeech: 'function', getNoVoiceMessage: 'function' });
          |                 ^
      116 |     });
      117 |   });
      118 |
        at /home/user/translator/tests/ext/selection-card.spec.js:115:17

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    tests/.results/artifacts/ext-selection-card-Extensi-58d49-able-to-the-content-script--ext/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: tests/.results/artifacts/ext-selection-card-Extensi-58d49-able-to-the-content-script--ext/error-context.md

    attachment #3: trace (application/zip) ─────────────────────────────────────────────────────────
    tests/.results/artifacts/ext-selection-card-Extensi-58d49-able-to-the-content-script--ext/trace.zip
    Usage:

        npx playwright show-trace tests/.results/artifacts/ext-selection-card-Extensi-58d49-able-to-the-content-script--ext/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  23) [ext] › tests/ext/selection-card.spec.js:122:5 › Extension: selection card › with a Gemini key › Speak plays Gemini voice through the background and shows the playing state 

    Error: Speak button label while audio is playing

    expect(locator).toHaveText(expected) failed

    Locator:  locator('#makan-translate-root #makanSpeakBtn span')
    Expected: "Stop"
    Received: "Speak"
    Timeout:  1000ms

    Call log:
      - Speak button label while audio is playing with timeout 1000ms
      - waiting for locator('#makan-translate-root #makanSpeakBtn span')
        5 × locator resolved to <span>Speak</span>
          - unexpected value "Speak"


      130 |       expect(JSON.parse(tts.body).contents[0].parts[0].text).toBe('[fa] First item in the list of things.');
      131 |       // While the ~1.6 s of audio plays, the button should offer "Stop" (a second press stops speech).
    > 132 |       await expect(inShadow(page, '#makanSpeakBtn span'), 'Speak button label while audio is playing').toHaveText('Stop', { timeout: 1000 });
          |                                                                                                        ^
      133 |       // It finishes on its own (the stub's audio is under a second) and the button returns to "Speak".
      134 |       await expect(inShadow(page, '#makanSpeakBtn span')).toHaveText('Speak', { timeout: 15_000 });
      135 |       await expectNoExtensionErrors(ext);
        at /home/user/translator/tests/ext/selection-card.spec.js:132:104

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    tests/.results/artifacts/ext-selection-card-Extensi-05912-and-shows-the-playing-state-ext/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: tests/.results/artifacts/ext-selection-card-Extensi-05912-and-shows-the-playing-state-ext/error-context.md

    attachment #3: trace (application/zip) ─────────────────────────────────────────────────────────
    tests/.results/artifacts/ext-selection-card-Extensi-05912-and-shows-the-playing-state-ext/trace.zip
    Usage:

        npx playwright show-trace tests/.results/artifacts/ext-selection-card-Extensi-05912-and-shows-the-playing-state-ext/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  23 failed
    [web] › tests/web/compare-glossary-history.spec.js:86:5 › Web app: Glossary tab › with Gemini › "+ Add to Glossary" in the Document tab keeps the terms after a reload 
    [web] › tests/web/document.spec.js:51:3 › Web app: Document tab › the Download button can be clicked as soon as translation finishes (nothing covers it) 
    [web] › tests/web/document.spec.js:96:3 › Web app: Document tab › JSON: the downloaded file can be read by a strict JSON reader (no byte-order mark) 
    [web] › tests/web/document.spec.js:141:3 › Web app: Document tab › DOCX: elements the app adds are in the order the Office file format requires 
    [web] › tests/web/settings.spec.js:58:3 › Web app: Engines & keys › a provider outage (HTTP 500) is not reported as "key rejected" 
    [web] › tests/web/settings.spec.js:67:3 › Web app: Engines & keys › API keys are not sent to the web app's own server 
    [web] › tests/web/settings.spec.js:83:5 › Web app: Engines & keys › voice settings › "Silence wait" in Engines & keys is saved 
    [web] › tests/web/tabs-and-language.spec.js:34:3 › Web app: interface language › every interface text the page uses exists in both English and Persian 
    [web] › tests/web/tabs-and-language.spec.js:47:3 › Web app: interface language › the Ask AI answer-language menu shows a readable first choice 
    [web] › tests/web/text.spec.js:55:5 › Web app: Text tab › with only Google switched on › opening the app with ?text=…&src=…&tgt=… (what the extension's "Open in App" does) fills the Text tab 
    [web] › tests/web/text.spec.js:63:5 › Web app: Text tab › with only Google switched on › when the only engine is rate-limited (HTTP 429), the user gets an answer or an error within 30 seconds 
    [web] › tests/web/voice.spec.js:89:5 › Web app: Voice tab › saved microphone setting › the Voice panel's "Microphone engine" menu shows the saved choice 
    [web] › tests/web/voice.spec.js:101:5 › Web app: Voice tab › without any AI key › with "Microphone engine: Browser", Talk does not start downloading the offline Whisper model 
    [ext] › tests/ext/options.spec.js:57:3 › Extension: options page › a wrong Gemini key is reported as "Key rejected" 
    [ext] › tests/ext/options.spec.js:75:3 › Extension: options page › settings exported from the web app ("Export for Extension") can be imported, and the extension still translates 
    [ext] › tests/ext/popup-menu-page.spec.js:85:3 › Extension: right-click menu › "Show Original" brings back links and bold text inside translated paragraphs 
    [ext] › tests/ext/popup-menu-page.spec.js:95:3 › Extension: right-click menu › the page banner names the engine that was actually used 
    [ext] › tests/ext/popup-menu-page.spec.js:103:3 › Extension: right-click menu › when every engine fails, the page banner says so instead of "Page translated" 
    [ext] › tests/ext/popup-menu-page.spec.js:129:3 › Extension: what web pages can and cannot do › a web page cannot make the extension translate it without the user asking 
    [ext] › tests/ext/popup-menu-page.spec.js:141:5 › Extension: what web pages can and cannot do › with a Gemini key saved › the content script running inside web pages is not given the API keys 
    [ext] › tests/ext/selection-card.spec.js:78:3 › Extension: selection card › "Detected" shows FA when Persian text is selected 
    [ext] › tests/ext/selection-card.spec.js:110:5 › Extension: selection card › Speak button › the card can use the computer's own voices (voice helpers are available to the content script) 
    [ext] › tests/ext/selection-card.spec.js:122:5 › Extension: selection card › with a Gemini key › Speak plays Gemini voice through the background and shows the playing state 
  3 skipped
  39 passed (6.0m)
══════════════════════════════════════════════════════════════════════════════
STEP 3  web-ext lint on dist/firefox (Mozilla's add-on checker)
══════════════════════════════════════════════════════════════════════════════
errors: 0   warnings: 21   notices: 0
  WARNING  background.js:162  UNSUPPORTED_API: offscreen.hasDocument is not supported
  WARNING  background.js:162  UNSUPPORTED_API: offscreen.hasDocument is not supported
  WARNING  background.js:173  UNSUPPORTED_API: offscreen.createDocument is not supported
  WARNING  content.js:433  UNSAFE_VAR_ASSIGNMENT: Unsafe assignment to innerHTML
  WARNING  content.js:556  UNSAFE_VAR_ASSIGNMENT: Unsafe assignment to innerHTML
  WARNING  content.js:570  UNSAFE_VAR_ASSIGNMENT: Unsafe assignment to innerHTML
  WARNING  content.js:596  UNSAFE_VAR_ASSIGNMENT: Unsafe assignment to innerHTML
  WARNING  content.js:602  UNSAFE_VAR_ASSIGNMENT: Unsafe assignment to innerHTML
  WARNING  content.js:895  UNSAFE_VAR_ASSIGNMENT: Unsafe assignment to innerHTML
  WARNING  content.js:926  UNSAFE_VAR_ASSIGNMENT: Unsafe assignment to innerHTML
  WARNING  options.js:223  UNSAFE_VAR_ASSIGNMENT: Unsafe assignment to innerHTML
  WARNING  options.js:235  UNSAFE_VAR_ASSIGNMENT: Unsafe assignment to innerHTML
  WARNING  options.js:269  UNSAFE_VAR_ASSIGNMENT: Unsafe assignment to innerHTML
  WARNING  options.js:518  UNSAFE_VAR_ASSIGNMENT: Unsafe assignment to innerHTML
  WARNING  options.js:524  UNSAFE_VAR_ASSIGNMENT: Unsafe assignment to innerHTML
  WARNING  popup.js:137  UNSAFE_VAR_ASSIGNMENT: Unsafe assignment to innerHTML
  WARNING  popup.js:159  UNSAFE_VAR_ASSIGNMENT: Unsafe assignment to innerHTML
  WARNING  popup.js:160  UNSAFE_VAR_ASSIGNMENT: Unsafe assignment to innerHTML
  WARNING  popup.js:170  UNSAFE_VAR_ASSIGNMENT: Unsafe assignment to innerHTML
  WARNING  popup.js:296  UNSAFE_VAR_ASSIGNMENT: Unsafe assignment to innerHTML
  WARNING  popup.js:319  UNSAFE_VAR_ASSIGNMENT: Unsafe assignment to innerHTML
══════════════════════════════════════════════════════════════════════════════
STEP 4  Firefox
══════════════════════════════════════════════════════════════════════════════
Firefox was not found on this computer (set FIREFOX_BIN to its path if it is installed somewhere unusual).
══════════════════════════════════════════════════════════════════════════════
SUMMARY
══════════════════════════════════════════════════════════════════════════════
Web app (index.html)                22 passed   13 failed    0 skipped
Extension, Chrome/Edge build        17 passed   10 failed    0 skipped
Real services (need keys)            0 passed    0 failed    3 skipped
Build dist/chrome and dist/firefox                   PASSED
web-ext lint dist/firefox                            PASSED  (0 errors, 21 warnings, 0 notices)
Firefox: load the extension, popup, selection card   SKIPPED  (skipped: Firefox is not installed here)
──────────────────────────────────────────────────────────────────────────────
Browser tests: 39 passed, 23 failed, 3 skipped (65 in total)
──────────────────────────────────────────────────────────────────────────────
FAILED — each line is something that did not behave as expected:
  ✘ [web] Web app: Glossary tab › with Gemini › "+ Add to Glossary" in the Document tab keeps the terms after a reload
      Error: glossary rows after reload (MAKAN from before + cache from the document) / expect(locator).toHaveCount(expected) failed / Locator:  locator('#gList .gl')
  ✘ [web] Web app: Document tab › the Download button can be clicked as soon as translation finishes (nothing covers it)
      Error: element under the middle of the Download button right after "Done" / expect(received).toBe(expected) // Object.is equality / Expected: "dSave"
      window size: 1280 x 900
  ✘ [web] Web app: Document tab › JSON: the downloaded file can be read by a strict JSON reader (no byte-order mark)
      Error: first character of the file (65279 = invisible byte-order mark, which strict JSON readers reject) / expect(received).not.toBe(expected) // Object.is equality / Expected: not 65279
  ✘ [web] Web app: Document tab › DOCX: elements the app adds are in the order the Office file format requires
      Error: elements out of schema order (Word may refuse or "repair" such files) / expect(received).toEqual(expected) // deep equality / - Expected  -  1
  ✘ [web] Web app: Engines & keys › voice settings › "Silence wait" in Engines & keys is saved
      Error: saved silence wait (ms) / expect(received).toBe(expected) // Object.is equality / Expected: 1500
  ✘ [web] Web app: Engines & keys › a provider outage (HTTP 500) is not reported as "key rejected"
      Error: a server error says nothing about the key / expect(locator).not.toHaveText(expected) failed / Locator:  locator('#engList .eng[data-id="gemini"] .eng-status')
  ✘ [web] Web app: Engines & keys › API keys are not sent to the web app's own server
      Error: requests to the web app's own server that contain an API key / expect(received).toEqual(expected) // deep equality / - Expected  - 1
  ✘ [web] Web app: interface language › every interface text the page uses exists in both English and Persian
      Error: text keys with no English / Persian wording (the raw key name is shown instead) / expect(received).toEqual(expected) // deep equality / - Expected  -  2
  ✘ [web] Web app: interface language › the Ask AI answer-language menu shows a readable first choice
      Error: expect(locator).not.toHaveText(expected) failed / Locator:  locator('#vAskLang option').first() / Expected: not "vAskLangAuto"
  ✘ [web] Web app: Text tab › with only Google switched on › opening the app with ?text=…&src=…&tgt=… (what the extension's "Open in App" does) fills the Text tab
      Error: the text passed in the address should appear in the source box / expect(locator).toHaveValue(expected) failed / Locator:  locator('#tIn')
  ✘ [web] Web app: Text tab › with only Google switched on › when the only engine is rate-limited (HTTP 429), the user gets an answer or an error within 30 seconds
      Error: Translate button should be usable again (with an error shown) instead of retrying forever / expect(locator).toBeEnabled() failed / Locator:  locator('#tGo')
  ✘ [web] Web app: Voice tab › saved microphone setting › the Voice panel's "Microphone engine" menu shows the saved choice
      Error: the Voice panel menu / expect(locator).toHaveValue(expected) failed / Locator:  locator('#vSttChoice')
  ✘ [web] Web app: Voice tab › without any AI key › with "Microphone engine: Browser", Talk does not start downloading the offline Whisper model
      Error: requests for the offline AI library / Whisper model / expect(received).toEqual(expected) // deep equality / - Expected  - 1
  ✘ [ext] Extension: options page › a wrong Gemini key is reported as "Key rejected"
      Error: Gemini answers "API key not valid" for a wrong key / expect(locator).toHaveText(expected) failed / Locator:  locator('#optEngineList .opt-eng-row[data-id="gemini"]').locator('.opt-status-pill')
  ✘ [ext] Extension: options page › settings exported from the web app ("Export for Extension") can be imported, and the extension still translates
      Error: the card after importing web-app settings / expect(locator).toContainText(expected) failed / Locator: locator('#makan-translate-root .makan-card .makan-card-body')
  ✘ [ext] Extension: right-click menu › "Show Original" brings back links and bold text inside translated paragraphs
      Error: the link inside the paragraph / expect(locator).toHaveCount(expected) failed / Locator:  locator('#p2 a#link1')
  ✘ [ext] Extension: right-click menu › the page banner names the engine that was actually used
      Error: expect(locator).toContainText(expected) failed / Locator: locator('#makan-translate-root .makan-top-banner') / Timeout: 10000ms
  ✘ [ext] Extension: right-click menu › when every engine fails, the page banner says so instead of "Page translated"
      Error: nothing was translated / expect(locator).not.toContainText(expected) failed / Locator: locator('#makan-translate-root .makan-top-banner')
  ✘ [ext] Extension: what web pages can and cannot do › with a Gemini key saved › the content script running inside web pages is not given the API keys
      Error: an API key is readable from inside web pages / expect(received).toBe(expected) // Object.is equality / Expected: false
  ✘ [ext] Extension: what web pages can and cannot do › a web page cannot make the extension translate it without the user asking
      Error: translation requests started by the page itself / expect(received).toEqual(expected) // deep equality / - Expected  - 1
  ✘ [ext] Extension: selection card › Speak button › the card can use the computer's own voices (voice helpers are available to the content script)
      Error: expect(received).toEqual(expected) // deep equality / - Expected  - 3 / + Received  + 3
  ✘ [ext] Extension: selection card › with a Gemini key › Speak plays Gemini voice through the background and shows the playing state
      Error: Speak button label while audio is playing / expect(locator).toHaveText(expected) failed / Locator:  locator('#makan-translate-root #makanSpeakBtn span')
  ✘ [ext] Extension: selection card › "Detected" shows FA when Persian text is selected
      Error: expect(locator).toHaveText(expected) failed / Locator:  locator('#makan-translate-root #makanDetectedPill') / Expected: "Detected: FA"
──────────────────────────────────────────────────────────────────────────────
SKIPPED — not tested, so not counted as passed:
  - [live] Live services (real internet) › real Google Translate translates a sentence: skipped: needs live service (set MAKAN_LIVE=1 to run)
  - [live] Live services (real internet) › real Gemini translates a sentence: skipped: needs key (set MAKAN_GEMINI_KEY to run)
  - [live] Live services (real internet) › real Gemini read-aloud returns audio: skipped: needs key (set MAKAN_GEMINI_KEY to run)
  - Firefox: load the extension, popup, selection card: skipped: Firefox is not installed here
──────────────────────────────────────────────────────────────────────────────
Notes recorded by passing tests:
  - [web] Web app: Document tab › DOCX: valid file, same paragraphs and table, text translated, right-to-left set, footnote kept: LibreOffice: LibreOffice converted it to a 22851-byte PDF
  - [web] Web app: Document tab › PPTX: valid file, same slides, text translated, right-to-left set: LibreOffice: LibreOffice converted it to a 21467-byte PDF
  - [web] Web app: Document tab › XLSX: valid file, same sheets, formulas and numbers kept, text translated, sheets right-to-left: LibreOffice: LibreOffice converted it to a 13058-byte PDF
  - [ext] Extension: after the extension is reloaded › selecting text in a tab that was already open still translates: copies of the extension UI layer in the tab after reload: 1
  - [ext] Extension: selection card › Speak button › without a Gemini key or a device voice, Speak shows a clear "no voice" message: device voices in this browser: 0
══════════════════════════════════════════════════════════════════════════════
RESULT: 23 problem(s) found. Details above; full report: tests/.results/report.txt
══════════════════════════════════════════════════════════════════════════════
(finished in 360 s)
npm test exit code: 1
```

---

# Run after the first round of fixes

Fixes covered: all key leaks, keys kept away from web pages, web pages unable
to start translation, the follow-up review, settings import (bug 4),
read-aloud with device voices (bug 5), the Speak button (bug 6) and the
endless rate-limit retry (bug 7).

* **One full run** (`npm test`, final code, 6 minutes): 71 passed, 18 failed,
  3 skipped, 92 tests. Mozilla's checker: 0 errors, 20 warnings.
* **Two of those 18 failures were my test helper, not the app.** The helper
  that drags the mouse over text let go before the browser had finished
  highlighting the last few characters, so the translation was of
  slightly shorter text. The helper now waits until the whole text is
  highlighted. Those two tests were then run again, 5 times each: 10 of 10
  passed. No second full run was made (to save time), so the expected
  full-run result is 73 passed, 16 failed, 3 skipped, but that exact
  number was not observed.
* **The 16 remaining failures are the bugs that were deliberately left
  alone this round** (bugs 8 to 11 and the smaller problems: glossary not
  saved, Show Original, Open in App, Talk button ignoring the microphone
  setting, wrong messages, missing interface texts, Silence wait, the Done
  message over Download, JSON byte-order mark, Word element order, banner
  texts, "Detected" language, wrong Gemini key message, HTTP 500 shown as
  key rejected).
* Failures that were in the first report and are now fixed: keys sent to the
  site's own server, keys readable by web pages, a page starting
  translation, importing the web app's settings, the card ignoring device
  voices, the Speak button resetting, the endless 429 retry.

Complete output of the full run: `tests/.results/report.txt` after running
`npm test` (it is not committed because it is regenerated every run).

## Final full-run summary (as printed)

```text
Web app (index.html)                31 passed   11 failed    0 skipped
Extension, Chrome/Edge build        40 passed    7 failed    0 skipped
Real services (need keys)            0 passed    0 failed    3 skipped
Build dist/chrome and dist/firefox                   PASSED
web-ext lint dist/firefox                            PASSED  (0 errors, 20 warnings, 0 notices)
Firefox: load the extension, popup, selection card   SKIPPED  (skipped: Firefox is not installed here)
──────────────────────────────────────────────────────────────────────────────
Browser tests: 71 passed, 18 failed, 3 skipped (92 in total)
──────────────────────────────────────────────────────────────────────────────
FAILED — each line is something that did not behave as expected:
  ✘ [web] Web app: Glossary tab › with Gemini › "+ Add to Glossary" in the Document tab keeps the terms after a reload
      Error: glossary rows after reload (MAKAN from before + cache from the document) / expect(locator).toHaveCount(expected) failed / Locator:  locator('#gList .gl')
  ✘ [web] Web app: Document tab › the Download button can be clicked as soon as translation finishes (nothing covers it)
      Error: element under the middle of the Download button right after "Done" / expect(received).toBe(expected) // Object.is equality / Expected: "dSave"
      window size: 1280 x 900
  ✘ [web] Web app: Document tab › JSON: the downloaded file can be read by a strict JSON reader (no byte-order mark)
      Error: first character of the file (65279 = invisible byte-order mark, which strict JSON readers reject) / expect(received).not.toBe(expected) // Object.is equality / Expected: not 65279
  ✘ [web] Web app: Document tab › DOCX: elements the app adds are in the order the Office file format requires
      Error: elements out of schema order (Word may refuse or "repair" such files) / expect(received).toEqual(expected) // deep equality / - Expected  -  1
  ✘ [web] Web app: Engines & keys › voice settings › "Silence wait" in Engines & keys is saved
      Error: saved silence wait (ms) / expect(received).toBe(expected) // Object.is equality / Expected: 1500
  ✘ [web] Web app: Engines & keys › a provider outage (HTTP 500) is not reported as "key rejected"
      Error: a server error says nothing about the key / expect(locator).not.toHaveText(expected) failed / Locator:  locator('#engList .eng[data-id="gemini"] .eng-status')
  ✘ [web] Web app: interface language › every interface text the page uses exists in both English and Persian
      Error: text keys with no English / Persian wording (the raw key name is shown instead) / expect(received).toEqual(expected) // deep equality / - Expected  -  2
  ✘ [web] Web app: interface language › the Ask AI answer-language menu shows a readable first choice
      Error: expect(locator).not.toHaveText(expected) failed / Locator:  locator('#vAskLang option').first() / Expected: not "vAskLangAuto"
  ✘ [web] Web app: Text tab › with only Google switched on › opening the app with ?text=…&src=…&tgt=… (what the extension's "Open in App" does) fills the Text tab
      Error: the text passed in the address should appear in the source box / expect(locator).toHaveValue(expected) failed / Locator:  locator('#tIn')
  ✘ [web] Web app: Voice tab › saved microphone setting › the Voice panel's "Microphone engine" menu shows the saved choice
      Error: the Voice panel menu / expect(locator).toHaveValue(expected) failed / Locator:  locator('#vSttChoice')
  ✘ [web] Web app: Voice tab › without any AI key › with "Microphone engine: Browser", Talk does not start downloading the offline Whisper model
      Error: requests for the offline AI library / Whisper model / expect(received).toEqual(expected) // deep equality / - Expected  - 1
  ✘ [ext] Extension: options page › a wrong Gemini key is reported as "Key rejected"
      Error: Gemini answers "API key not valid" for a wrong key / expect(locator).toHaveText(expected) failed / Locator:  locator('#optEngineList .opt-eng-row[data-id="gemini"]').locator('.opt-status-pill')
  ✘ [ext] Extension: a web page cannot drive the extension › page scripts cannot press the buttons on the M bubble or on the card
      Error: expect(locator).toHaveText(expected) failed / Locator:  locator('#makan-translate-root .makan-result-text') / Expected: "[fa] First item in the list of things."
  ✘ [ext] Extension: right-click menu › "Show Original" brings back links and bold text inside translated paragraphs
      Error: the link inside the paragraph / expect(locator).toHaveCount(expected) failed / Locator:  locator('#p2 a#link1')
  ✘ [ext] Extension: right-click menu › the page banner names the engine that was actually used
      Error: expect(locator).toContainText(expected) failed / Locator: locator('#makan-translate-root .makan-top-banner') / Timeout: 10000ms
  ✘ [ext] Extension: right-click menu › when every engine fails, the page banner says so instead of "Page translated"
      Error: nothing was translated / expect(locator).not.toContainText(expected) failed / Locator: locator('#makan-translate-root .makan-top-banner')
  ✘ [ext] Extension: selection card › drag-selecting text shows the M button; a real mouse press on it opens a translated card
      Error: expect(locator).toHaveText(expected) failed / Locator:  locator('#makan-translate-root .makan-result-text') / Expected: "[fa] The quick brown fox jumps over the lazy dog near the river bank."
  ✘ [ext] Extension: selection card › "Detected" shows FA when Persian text is selected
      Error: expect(locator).toHaveText(expected) failed / Locator:  locator('#makan-translate-root #makanDetectedPill') / Expected: "Detected: FA"
──────────────────────────────────────────────────────────────────────────────
SKIPPED — not tested, so not counted as passed:
  - [live] Live services (real internet) › real Google Translate translates a sentence: skipped: needs live service (set MAKAN_LIVE=1 to run)
  - [live] Live services (real internet) › real Gemini translates a sentence: skipped: needs key (set MAKAN_GEMINI_KEY to run)
  - [live] Live services (real internet) › real Gemini read-aloud returns audio: skipped: needs key (set MAKAN_GEMINI_KEY to run)
  - Firefox: load the extension, popup, selection card: skipped: Firefox is not installed here
──────────────────────────────────────────────────────────────────────────────
Notes recorded by passing tests:
  - [web] Web app: Document tab › DOCX: valid file, same paragraphs and table, text translated, right-to-left set, footnote kept: LibreOffice: LibreOffice converted it to a 22851-byte PDF
  - [web] Web app: Document tab › PPTX: valid file, same slides, text translated, right-to-left set: LibreOffice: LibreOffice converted it to a 21467-byte PDF
  - [web] Web app: Document tab › XLSX: valid file, same sheets, formulas and numbers kept, text translated, sheets right-to-left: LibreOffice: LibreOffice converted it to a 13058-byte PDF
  - [ext] Extension: after the extension is reloaded › selecting text in a tab that was already open still translates: copies of the extension UI layer in the tab after reload: 1
  - [ext] Extension: selection card › Speak button › without a Gemini key or a device voice, Speak shows a clear "no voice" message: device voices in this browser: 0
══════════════════════════════════════════════════════════════════════════════
RESULT: 18 problem(s) found. Details above; full report: tests/.results/report.txt
══════════════════════════════════════════════════════════════════════════════
(finished in 466 s)
exit 1
```
