# MERGE GUIDE: put Media Translate into MAKAN Translate

The module is the `media/` folder. It adds ONE global, `window.MediaTranslate`. Nothing else in this app is needed for the merge.

## 1. Copy these files
Copy the whole `media/` folder to a folder in MAKAN Translate (for example `media/`). Keep the files together:

    media-i18n.js  media-file.js  media-decode.js  media-asr.js  media-cues.js
    media-export.js  media-preview.js  media-ui.js  media-worker.js
    media-tab.html  media.css

`media-ui.js` finds `media-tab.html` and `media.css` by itself (same folder as the script) and `media-asr.js` finds `media-worker.js` the same way. Do not move them apart.

## 2. Add the scripts (this order)
    media-i18n.js, media-file.js, media-decode.js, media-asr.js, media-cues.js,
    media-export.js, media-preview.js, media-ui.js

`media-asr.js`, `media-cues.js`, `media-export.js` and `media-preview.js` are optional: without one, that card is simply not shown. `mount()` fails loudly if i18n, file, decode or ui is missing.

## 3. Strings
`MediaTranslate.i18n` is `{ en: {...}, fa: {...} }`. Every key starts with `media`. Append the two objects to MAKAN Translate's own EN and FA tables, or return them from `host.t`. Placeholders such as `{name}` are the same in EN and FA.

## 4. Mount
    MediaTranslate.mount(rootEl, host).then(function (handle) { ... });

`handle` = `{ el, refresh, unmount, getFile, getAudio, getTranscript, getCues, getState, clear }`. Call `refresh()` after a language change, `unmount()` when the tab is destroyed.
The module draws no page title: show `mediaTitle` / `mediaSubtitle` in your own page header.

## 5. What the host (MAKAN Translate) must give
Required: `host.t(key)`.
Optional (a card appears only if its function exists):

| Host item | Effect |
|---|---|
| `getLang()` | 'en' or 'fa' |
| `getWhisperChoice()` -> `{repo,name,memMB,ready,gpu?}` | Transcribe card (use your Whisper model choice) |
| `engine` -> `{libUrl, workerFactory?}` | where the speech library is loaded from |
| `onModelUsed(repo)`, `openModelHub()` | model bookkeeping, "Open Model Hub" button |
| `getLanguages()` | language list |
| `translateCues(cues, opts)` | Translate card (use MAKAN Translate's own engines) |
| `getTranslateChoice()` | label and licence of the engine before pressing |
| `toast(msg)` | messages |
| `saveFile(name, blob)` | Export buttons (hidden without it) |
| `loadSubtitleStyle()`, `saveSubtitleStyle(style)` | remember the subtitle style menu between visits (optional) |
| `desktop` | ffmpeg card and "save next to file" (Windows app only) |
| `limits` | tests only |

Details of every function are in `docs/OVERVIEW.md`. Cue format everywhere: `{ s, e, o, t }`.

## 6. Replace the standalone parts
These stay in this app and are NOT copied: `index.html`, `shell/` (sidebar, Model Hub, engine adapter, translate worker, Gemini, desktop host), `desktop/` (Electron), `tests/`. In MAKAN Translate their job is done by its own Model Hub, translation engines and `host.whisper`. Connect them through the host functions above.

## 6b. Translation engines are the host's job
The module only calls `host.translateCues(cues, { src, tgt, onProgress, signal, onInfo })` and reads `host.getTranslateChoice()`. Everything in `shell/tr-*.js`, `shell/engine-*.js`, `shell/*-card.mjs` (fallback chain, Ollama, LM Studio, Google web, MyMemory, Chrome) is standalone-only and is NOT copied. MAKAN Translate can reuse that code or use its own engines, as long as `translateCues` returns one translated cue per input cue with the same timing. Optional `onInfo` fields the module understands: `name`, `model`, `kind`, `switched {from, reason}`, `used [{name, count}]`, `waitingMs`. When a translated VTT is exported, the module adds a trailing `NOTE Translated by <engine>` block.

## 7. After merging
- Run the module tests (`npm test` here) against the merged page if you can, or at least open the Media tab, drop a short file and transcribe.
- CSS: every selector starts with `.mt-` and colours are `var(--x, fallback)`, so the host theme applies. If a variable name differs in MAKAN Translate, map it in one place.
- The speech library address is NOT inside the module. The host decides it (`host.engine.libUrl`).
