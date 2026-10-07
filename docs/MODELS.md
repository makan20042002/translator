# Offline models: what is in the app, how it was checked, what is not

Engines & keys → **Offline** lists the models that run inside the browser, in three groups:
**Listening** (speech to text), **Translation** and **Speaking** (text to speech). Each model shows
its name, download size, memory, whether it needs WebGPU, its languages and one line on what it is
good for, with **Download**, **Delete** and a *ready* state, and the total storage the models use.

The numbers are in [`MODELS-results.md`](MODELS-results.md). It is generated from the saved
results of the checks (`tools/model-check/results/`), so none of it is typed by hand.

## The rule used

A model is listed **only if it was downloaded through the app's own Download button, in a real
Chromium, and run through the app's own code** (`ai-worker.js` / `piper-worker.js`) on this
computer. Sizes come from the Hugging Face API (`/api/models/<repo>?blobs=true`), for exactly the
files the check downloaded. Memory and speed are measured in the browser. The check is repeatable:
see "Running the checks again" below.

The machine had 4 CPU cores, 16 GB of memory and **no GPU**. It was Chromium with ONNX Runtime
running on WebAssembly with **one thread** (more threads need the page to be served with special
headers that ordinary hosting does not send). Nothing was run on Windows, Edge, Firefox or Safari.

## Listening

| Model | Listed | Notes |
| --- | --- | --- |
| Whisper Tiny | yes | English fine; Persian almost unreadable (90 % of the words wrong on the test sentence). |
| Whisper Base | yes | The default for people who never chose; English fine; Persian poor (70 % wrong). |
| Whisper Small | yes, recommended outside English | Persian: 1 of 10 words wrong. About 2.4 s of waiting per second of speech without WebGPU. |
| Whisper Medium | **no** | Downloads, and runs under Node, but **cannot start in Chromium**: `Can't create a session. failed to allocate a buffer of size 313468028` (the size of its encoder file). Repeated three times, also with the graph optimiser switched off. Not offered rather than offered broken. Untested: Medium with WebGPU. |
| Whisper Large v3 Turbo | yes, recommended outside English | Best result (Persian sentence exactly right) but slow without WebGPU: about 7.5 s of waiting per second of speech, so a 10 s clip takes over a minute. 1.0 GB to download. |

Tiny, Base and Small keep the WebGPU path the app already had (fp32 encoder + 4-bit decoder, falls
back to WebGPU-off if it fails). **That path was not run here** (no GPU) and is shown as
"not tested". Turbo always uses the 8-bit files and WASM; a WebGPU route for it was not tried.

What was changed for long and bad recordings:

* **Time to wait.** The fixed 20 second "working" timeout is replaced, for recognition, by
  `30 s + 4 × (audio length × measured speed of the model)`, plus a minute if the model has to be
  loaded first. Every progress report from the worker ("Transcribing… 40 % · 2/5") restarts a
  one-minute clock, so a job that is alive is never cut off and one that is silent for a minute is.
  Everything other than recognition keeps the old 20 seconds.
* **Runaway repetition.** Output is limited to a number of tokens that fits the audio (14 per
  second, at most 440 per 30 s window). If the text is a loop (the same 1 to 8 words many times),
  it is generated once more with a repetition penalty, and any loop that remains is cut to one
  copy. A single word repeated up to five times (“no no no”) is left alone. Code: `asr-guard.js`.

## Translation

| Model | Listed | Notes |
| --- | --- | --- |
| NLLB-200 distilled 600M | yes, default | Unchanged. Existing downloads and choices keep working. |
| M2M-100 418M | yes | Rougher than NLLB (e.g. Persian → English: "We are going to the park today, so we are going to the park."). Enabled for the 8 languages that were tested. |
| mBART-50 many-to-many | yes | Fluent; enabled for the 8 tested languages. |
| OPUS-MT, single pair | yes, 11 models | EN→AR, AR→EN, EN→DE, DE→EN, EN→FR, FR→EN, EN→ES, ES→EN, EN→RU, RU→EN, TR→EN. About 110 MB each and roughly 4 to 8 times faster than NLLB in the check (1 to 2 s against 5 to 7 s for one sentence). One sentence of ES→EN came out wrong ("It's been a while…"): they are small models. Used only if the box "Use a small pair model when one is downloaded" is ticked. |
| NLLB 1.3 B / 3.3 B | **no** | No usable browser build exists on Hugging Face. The ONNX copies of the 1.3 B model (`forkjoin-ai/…`, `fine444666/…`, `playmak3r/…`) are third-party exports that put the files in the repository root and have no `decoder_model_merged`, which transformers.js 3.8.1 requires (checked in the file lists; nothing was downloaded). Exporting it here would leave nowhere to host the 1.8 GB result. The 1.3 B weights are also CC BY-NC. |
| OPUS-MT `tc-big` EN→TR and TR→EN | **no** | `onnx-community/opus-mt-tc-big-*` (512 MB) run, but the 8-bit file produces nonsense (`we bakma sorundur ölçümler 7,000 desolate way forgave…`). |
| OPUS-MT multilingual `mul-en` / `en-mul` | **no** | Run, but unusable for Persian (see below). |
| TranslateGemma 4B, MADLAD | **no** | Not tried: a 4 B model is far beyond what a browser tab holds in 8-bit, and no MADLAD browser build was found. Untested. |

### English ↔ Persian, specifically

* **There is no single-pair OPUS-MT model for English → Persian or Persian → English.** The Helsinki-NLP
  repositories `opus-mt-en-fa` and `opus-mt-fa-en` do not exist (nor in `Xenova/` or `onnx-community/`).
* The multilingual `Xenova/opus-mt-mul-en` and `opus-mt-en-mul` do have browser builds and
  `>>pes<<` is a valid Persian target. They run, but the Persian is unusable
  (`tools/model-check/results/mul-check.txt`): Persian → English gave *"This day is the heaven good;
  therefore we go to the field, and it is good for us to tread."*, English → Persian gave
  *"امروز تاخیر نیکو است، پس ما در فرق راه می‌رویم."* (meaningless). Their own model card reports
  7.5 BLEU for Persian → English.
* `opus-mt-en-iir` / `iir-en` (Indo-Iranian) and the `tc-bible-big-iir` models have no ONNX build.
  `persiannlp/mt5-*-parsinlu-opus-translation_fa_en` is PyTorch only, Persian → English only.
* What works for English ↔ Persian in the browser: **NLLB 600M** (default), **mBART-50**, **M2M-100**.
  NLLB and mBART are the best of those; both turn "going for a walk" into spoken-style Persian
  ("میخوایم") on the test sentence.

## Speaking

The three voices are Piper VITS voices (`rhasspy/piper-voices` on Hugging Face), run with
ONNX Runtime Web and the eSpeak NG phonemizer. **All code is in `vendor/piper/` next to the app; no
script comes from another website at run time** (the check recorded requests to `huggingface.co` only,
for the voice files). The voice files are downloaded once (about 61 MB) and kept in the same browser
storage as the other models; the speech engine (28 MB) is part of the website and is fetched when the
first voice is downloaded, so the service worker keeps a copy for offline use.

| Voice | Licence of the recording data |
| --- | --- |
| Persian · Amir (`fa_IR-amir-medium`) | CC0 |
| Persian · Ganji (`fa_IR-ganji-medium`) | CC0 |
| English · Alba (`en_GB-alba-medium`) | CC BY 4.0 (credit added to About & credits) |

Not offered: `fa_IR-gyro` (licence "see URL"), `fa_IR-reza_ibrahim` (Quran-recitation style),
`en_US-ryan` and `hfc_female` (CC BY-NC-SA), `en_US-lessac` (Blizzard licence), `en_US-amy`
(licence "see URL").

**When it is used.** The voice for a language is chosen as before: a voice picked in the voice menu,
else a device voice, else Gemini (key set and not in Offline mode). A downloaded offline voice is now
used when none of those can speak: no device voice for the language and Gemini off, offline, missing a
key, or failed. It can also be picked in the voice menu ("Offline voices (downloaded)"). The name is
shown in the "Voice: …" line, for example *Voice: Persian · Amir (male) (offline voice)*.

**Measured** (Chromium, one thread, voice already downloaded): time from "speak" to the first sound
1.1 to 1.5 s; the first use after opening the page adds 2 to 4 s to load the voice. In the check the
page had no device voice and no key, Offline mode was on, and the app chose the offline voice by itself.
The sound itself was checked by transcribing it back with Whisper: the English sentence came back
word for word; the Persian one as *"سلام، این یه آزمایش صدا برای مترجم محکنه."* (the brand name
"ماکان" is the only slip). A person has not listened to it.

**Licence flag for the owner.** The phonemizer (`piper_phonemize.wasm/.data`, from the npm package
`@diffusionstudio/piper-wasm` 1.0.0, MIT) contains **eSpeak NG, which is GPL-3.0-or-later**. The files
are served unchanged next to the app and loaded by a worker; whether that is acceptable for this
repository is a decision for the owner (there is no LICENSE file in the repository). The wasm was not
rebuilt here, so it is a binary from npm. Removing `vendor/piper/` and the three voices from
`tools/model-check/catalog-meta.mjs` removes the feature cleanly.

## Where the models come from, and the new download hosts

`huggingface.co/<model>/resolve/main/<file>` answers with a redirect to Hugging Face's download
network (seen: `us.aws.cdn.hf.co`; Hugging Face may use others, such as `cas-bridge.xethub.hf.co`),
no longer `cdn-lfs.huggingface.co`. **Nothing in the app, the extension, the service worker or the
build referred to `cdn-lfs.huggingface.co`** (searched; a test now fails if that changes), and the
service worker leaves model downloads alone. The model library script still comes from
`cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1` (unchanged, on the existing allow-list).

If a network allow-list is used (a company firewall, a proxy), it needs:
`huggingface.co`, `*.hf.co` (not `cdn-lfs.huggingface.co`), `cdn.jsdelivr.net`.
`cdn-lfs.huggingface.co` is not needed and was **not reachable** in the environment this was built in.

## Licences of the models

The NLLB-200 models (the default included) are **CC BY-NC 4.0** (non-commercial). Whisper, M2M-100,
mBART-50 and OPUS-MT are MIT / Apache-2.0 / CC-BY 4.0. Each model keeps its own licence (note added to
About & credits).

## Running the checks again

```
cd tools/model-check
npm install                      # once
node asr-check.mjs Xenova/whisper-small <cache-folder>     # one model under Node
node browser-check.mjs asr-small <cache-folder>            # one model through the real app in Chromium
./run-browser-all.sh <cache-folder>                         # every model in the list (about 1 hour)
node build-catalog.mjs           # rewrites ../../models-catalog.js from the results and the Hugging Face API
node make-report.mjs > ../../docs/MODELS-results.md
```

`browser-check.mjs` needs the repository's own `npm install` (for Playwright) and internet through
`curl`. The clips in `tools/model-check/clips/` are one English and one Persian sentence (licences in
that folder).

## Hand-check on Windows

See the pull request description for the exact steps.
