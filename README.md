# MAKAN Translate

A translator in two forms:

* a **web app**: one web page (`index.html`) with Text, Subtitle, Document,
  Voice, Compare, Glossary, History, Screen, and Media tabs;
* a **browser extension** for Chrome, Edge and Firefox: select text on any
  page, press the **M** button, and a small translation card appears.

How the code fits together, where settings and keys are stored, and a list of
known problems are in [`docs/OVERVIEW.md`](docs/OVERVIEW.md). What the
automated tests found is in [`docs/TEST-REPORT.md`](docs/TEST-REPORT.md).
For capabilities, hardware requirements, and operational limits, see the [`User Guide`](docs/USER_GUIDE.md).

---

## What each folder is

| Folder or file | What it is | Do you need it? |
| --- | --- | --- |
| `index.html`, `ai-worker.js`, `sw.js`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png` | The web app. | Yes: this is the website. |
| `extension/` | The **source** of the browser extension. Edit files here. | Yes. |
| `dist/` | The **built** extension: `dist/chrome` (Chrome and Edge) and `dist/firefox`. Made by the build step below and not kept in git. Rebuild it after every change in `extension/`. | Made for you. |
| `build-manifests.js` | Makes `dist/` from `extension/`. | Yes. |
| `docs/` | Explanations: code overview and test report. | For reading. |
| `tests/` | The automated tests (see below). Nothing the user loads depends on them. | For checking. |
| `package.json`, `package-lock.json` | List of the developer tools the tests use. Not part of the app. | For checking. |
| `node_modules/` | The tools themselves, downloaded by `npm install`. Not kept in git. | Made for you. |
| `test-server.py` | A small local web server from earlier development (port 8080). | Optional. |
| `ENGINE_SYNC.md` | An older note about keeping the web app and the extension in step. Out of date; see `docs/OVERVIEW.md` section 5. | No. |
| `test_docs/` | Sample files from earlier work. Not used by the new tests. | No. |

---

## Which folder to load in each browser

First build the extension (see "One-time setup" below), then:

| Browser | Steps | Folder or file to choose |
| --- | --- | --- |
| **Chrome** | Open `chrome://extensions`, switch on **Developer mode** (top right), click **Load unpacked**. | `dist\chrome` |
| **Edge** | Open `edge://extensions`, switch on **Developer mode** (left side), click **Load unpacked**. | `dist\chrome` (Edge uses the Chrome build) |
| **Firefox** (version 142 or newer) | Open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…**. Firefox forgets it when it closes. | `dist\firefox\manifest.json` |

After changing anything in `extension/`, run `npm run build` again and press
the **reload** arrow on the extension's card in `chrome://extensions` or
`edge://extensions`.

---

## Which files go on the website

Upload these, keeping the same names and folders:

```
index.html
css/                     ← all CSS files (base.css, layout.css, components.css, tabs.css)
js/                      ← all JavaScript files (store.js, i18n.js, translate.js, ...)
media/                   ← all Media Translate files (media-ui.js, media-worker.js, media.css, etc.)
ai-worker.js
asr-guard.js
models-catalog.js
piper-worker.js
sw.js
manifest.webmanifest
icon-192.png
icon-512.png
extension/engine.js      ← must stay in a folder called "extension"; index.html loads it from there
vendor/piper/            ← the whole folder (5 files, about 29 MB): the offline voice engine, loaded by piper-worker.js
```

Do **not** upload `tests/`, `node_modules/`, `dist/`, `docs/`, `test_docs/`,
`package.json`, `package-lock.json` or `test-server.py`.

> **Before you publish:** the web app no longer sends API keys to your
> website's server (this was fixed; see `docs/OVERVIEW.md`, section 6).
> One open point remains: `index.html` loads JSZip from a public CDN without
> an integrity check, see the same section.

---

## One-time setup on Windows

1. Install **Node.js** (the "LTS" version) from <https://nodejs.org>.
2. Open the project folder in File Explorer, type `cmd` in the address bar
   and press Enter. A black command window opens in the right folder.
3. Type these two commands, pressing Enter after each:

   ```
   npm install
   npx playwright install chromium
   ```

   The first downloads the test tools (they took about 160 MB of disk space
   when this was set up). The second downloads the copy of Chromium that the
   tests drive (about 600 MB once unpacked). You only do this once.

To build the extension at any time:

```
npm run build
```

## Running the tests

```
npm test
```

This one command:

1. builds the extension into `dist/`;
2. opens the web app and the extension in a hidden Chromium window and uses
   them with real mouse clicks and key presses: every tab, translating text,
   subtitles, every document type, Compare, Glossary, History, Engines &
   keys, English/Persian switching, the Voice tab with a pretend microphone,
   the extension's popup, the **M** button and card, double-click
   dictionary, the right-click menu, whole-page translation and the options
   page;
3. checks the Firefox build with Mozilla's own checker (`web-ext lint`);
4. prints a **summary** at the end, with three lists: what passed, what
   **failed** (and what each failure means), and what was **skipped** and
   why.

It takes about 6 minutes. The same summary is saved to
`tests\.results\report.txt`. For each failed test there is a screenshot and a
step-by-step recording in `tests\.results\artifacts\`. Open a recording with:

```
npx playwright show-trace tests\.results\artifacts\<test folder>\trace.zip
```

You can also run one part: `npm run test:web`, `npm run test:ext`,
`npm run test:firefox`.

### No keys or internet needed

The tests do not use the real translation services. A small program inside
the tests pretends to be Google, MyMemory, Gemini, OpenAI and the others, on
your own computer. It answers with predictable fake translations such as
`[fa] Hello` for "Hello". So the tests check the app's own behaviour
(sending the right text, putting answers in the right place, handling
errors, building valid files), **not** the quality of real translations.

### Tests against the real services (optional)

A few tests talk to the real services. They are **skipped** unless you turn
them on, and the summary lists them as "skipped: needs key", never as
passed. In PowerShell:

```
$env:MAKAN_LIVE="1"              # real Google Translate (no key)
$env:MAKAN_GEMINI_KEY="your key" # real Gemini translation and read-aloud
npm test
```

The key is only put into the test browser; it is not printed or saved.

### What the tests cannot check

* a real microphone and real speech recognition (a recorded sound is used
  instead);
* the voices installed in Windows / Edge ("read aloud" with device voices);
* real providers' answers and limits (unless you run the optional tests
  above);
* Firefox itself, unless Firefox is installed (then the summary tells you
  how to try it by hand);
* Microsoft Word opening the translated `.docx` (LibreOffice is used instead
  when it is installed).

---

## Bug Reports & Diagnostics

If you run into an issue or unexpected behavior:
* In the **web app**: click **Report a bug** in the About window or at the top of the Help window.
* In the **browser extension**: click **Report a bug** in the Options page (About section) or the link in the popup footer.
* In the **Windows desktop app**: click **Report a bug** in the Help or About window.

### Privacy Guarantees
* **Nothing is sent by the app**: The application contains no background telemetry, tracking, or automated error reporting.
* **Your own email program sends the message**: Clicking "Send by email" opens a draft in your system's default email client addressed to `makan20042002@gmail.com`. You can inspect, edit, or cancel the draft before sending. You can also copy the report to your clipboard.
* **What the report contains**: App/extension version, interface language, operating system and browser version, active tab, enabled engine names (never keys or custom URLs), offline mode status, names of downloaded offline models, WebGPU availability, whether running in the Windows app, and up to the last 5 in-memory error messages (with any keys, tokens, or queries strictly redacted).
* **What the report NEVER contains**: API keys or authorization tokens, custom server URLs, user source or translated text, file names or paths, and translation history.

