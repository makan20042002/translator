# Third-Party Libraries and Licences

This repository bundles, vendor-hosts, loads via CDN, or downloads the following third-party software, fonts, datasets, and models:

---

## GPL component

- **Component**: eSpeak NG
- **Licence**: GNU General Public License v3.0 or later (GPL-3.0-or-later)
- **Licence Text**: Full licence text is provided in [`vendor/piper/LICENSE-GPL.txt`](../vendor/piper/LICENSE-GPL.txt).
- **Source Link**: https://github.com/espeak-ng/espeak-ng
- **Inclusion & Isolation**: eSpeak NG (GPL-3.0-or-later) is included inside `vendor/piper/` (`piper_phonemize.*`), is loaded only by the offline voice worker (`piper-worker.js`), is not linked into any other part of the app, and its full licence text and source link are provided.
- **Removing Offline Voice**: A user can remove the offline voice by deleting `vendor/piper` and `piper-worker.js` without breaking the rest of the application. All remaining features (text translation, subtitles, documents, online voice, speech recognition, and OCR) continue to work normally.

---

## 1. Vendored Libraries (`vendor/`)

### pdfjs (`vendor/pdfjs/`)
- **Name**: PDF.js (by Mozilla Foundation)
- **Version**: 3.11.174
- **Licence**: Apache License 2.0
- **Location**: `vendor/pdfjs/` (`vendor/pdfjs/pdf.min.js`, `vendor/pdfjs/pdf.worker.min.js`, `vendor/pdfjs/LICENSE`)
- **Source Link**: https://github.com/mozilla/pdf.js
- **Credit / Required Attribution**:
  Copyright 2023 Mozilla Foundation. Licensed under the Apache License, Version 2.0. Full license text is included in `vendor/pdfjs/LICENSE`.
- **Usage**: Used in the Document tab for extracting selectable text and rebuilding paragraphs from uploaded PDF documents. Runs entirely locally and offline in the browser.

### piper (`vendor/piper/`)
- **Name**: Piper Web Voice Synthesis Engine & Phonemizer
- **Version**: piper-wasm 1.0.0 / ONNX Runtime Web 1.14.0
- **Licence**: MIT (Piper, ONNX Runtime Web, @diffusionstudio/piper-wasm); GPL-3.0-or-later (eSpeak NG phonemizer data & code embedded in `piper_phonemize`)
- **Location**: `vendor/piper/` (`vendor/piper/ort.wasm.min.js`, `vendor/piper/ort-wasm-simd.wasm`, `vendor/piper/piper_phonemize.js`, `vendor/piper/piper_phonemize.wasm`, `vendor/piper/piper_phonemize.data`)
- **Source Link**: https://github.com/rhasspy/piper and https://github.com/diffusion-studio/piper-wasm and https://github.com/espeak-ng/espeak-ng
- **Credit / Required Attribution**:
  - Piper: Copyright (c) Michael Hansen (Rhasspy). Licensed under MIT License.
  - ONNX Runtime: Copyright (c) Microsoft Corporation. Licensed under MIT License.
  - eSpeak NG: Copyright (c) Jonathan Duddington and eSpeak NG contributors. Licensed under GNU General Public License v3.0 or later.
- **Usage**: Used by `piper-worker.js` for offline text-to-speech voice generation. Runs locally in a Web Worker.

---

## 2. Bundled Fonts (`fonts/`)

### Vazirmatn.woff2 (`fonts/Vazirmatn.woff2`)
- **Name**: Vazirmatn Font
- **Version**: 33.003
- **Licence**: SIL Open Font License 1.1 (OFL-1.1)
- **Location**: `fonts/Vazirmatn.woff2`
- **Source Link**: https://github.com/rastikerdar/vazirmatn
- **Credit / Required Attribution**:
  Copyright (c) 2015-2023 Saber Rastikerdar (saber.rastikerdar@gmail.com) with Reserved Font Name "Vazirmatn".
- **Usage**: Primary Persian/Arabic typography across the web application and extension.

### OFL.txt (`fonts/OFL.txt`)
- **Name**: SIL Open Font License 1.1
- **Version**: 1.1 (February 26, 2007)
- **Licence**: SIL Open Font License 1.1
- **Location**: `fonts/OFL.txt`
- **Source Link**: https://scripts.sil.org/OFL
- **Credit / Required Attribution**:
  Copyright (c) 2007 SIL International.
- **Usage**: License text for the bundled Vazirmatn font.

---

## 3. Bundled JavaScript Libraries

### JSZip
- **Name**: JSZip
- **Version**: 3.10.1
- **Licence**: MIT License or GPLv3 (Dual-licensed)
- **Location**: `jszip.min.js`
- **Source Link**: https://github.com/Stuk/jszip
- **Credit / Required Attribution**:
  Copyright (c) 2009-2016 Stuart Knightley. Bundles `pako` zlib port (MIT license, Copyright (c) 2014-2017 Vitaly Puzrin and Andrei Tuputcyn).
- **Usage**: Reading and packaging Office document archives (.docx, .pptx, .xlsx) in `js/documents.js`.

---

## 4. Offline Dictionary Packs (`dict/`)

### Wiktionary Dictionaries via Kaikki
- **Name**: Offline Wiktionary Lexical Dictionaries (ar-en, de-en, en-ar, en-de, en-fa, en-fr, en-tr, fa-en, fr-en, tr-en)
- **Version**: Kaikki data dump 2026-10-03
- **Licence**: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0) and GNU Free Documentation License (GFDL)
- **Location**: `dict/`
- **Source Link**: https://kaikki.org/dictionary/ and https://github.com/tatuylonen/wiktextract and https://en.wiktionary.org
- **Credit / Required Attribution**:
  Derived from Wiktionary data extracted with Wiktextract and distributed by Kaikki.org.
  Academic citation: Tatu Ylonen, "Wiktextract: Wiktionary as Machine-Readable Structured Data", Proceedings of the 13th Conference on Language Resources and Evaluation (LREC), 2022.
  Frequency ranking generated with `wordfreq` by Robyn Speer (code Apache-2.0, data CC BY-SA 4.0).
  Attribution notice: "If you redistribute these packs, keep this credits file and the applicable license notices with them. Attribution should not imply endorsement." Full credits are included in `dict/<pair>/credits.txt`.
- **Usage**: In-browser instant word lookup in web app Dictionary tab and extension popup/card.

---

## 5. Machine Learning Models (`models-catalog.js`)

### Whisper Speech Recognition Models (OpenAI)
- **Name**: OpenAI Whisper Models (Tiny, Base, Small, Large v3, Large v3 Turbo, Distil Large v3)
- **Repositories**:
  - `Xenova/whisper-tiny` (v1.0.0, MIT)
  - `Xenova/whisper-base` (v1.0.0, MIT)
  - `Xenova/whisper-small` (v1.0.0, MIT)
  - `onnx-community/whisper-large-v3-turbo` (v1.0.0, MIT)
  - `onnx-community/whisper-large-v3-ONNX` (v1.0.0, Apache-2.0)
  - `distil-whisper/distil-large-v3` (v1.0.0, MIT)
- **Licence**: MIT (Whisper Tiny, Base, Small, Large v3 Turbo, Distil Large v3); Apache-2.0 (Whisper Large v3 ONNX)
- **Source Link**: https://github.com/openai/whisper and https://huggingface.co/onnx-community and https://huggingface.co/distil-whisper
- **Credit / Required Attribution**:
  - OpenAI Whisper: Copyright (c) OpenAI.
  - Distil-Whisper: Copyright (c) Hugging Face (Sanchit Gandhi, Patrick von Platen, Alexander M. Rush).
  - ONNX conversions by Xenova and ONNX Community.
- **Usage**: Transcribing speech to text in the Voice tab and Media tab.

### NLLB-200 (Non-Commercial Notice)
- **Name**: NLLB-200 distilled 600M (`Xenova/nllb-200-distilled-600M`)
- **Version**: 600M distilled checkpoint
- **Licence**: Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)
- **Source Link**: https://github.com/facebookresearch/fairseq/tree/nllb and https://huggingface.co/Xenova/nllb-200-distilled-600M
- **Credit / Required Attribution**:
  Copyright (c) Meta Platforms, Inc. and affiliates. (NLLB Team et al.).
- **Usage**: Offline neural translation in Text, Subtitle, and Media tabs.
- **Notice**: NLLB-200 model weights are restricted to non-commercial use under CC BY-NC 4.0.

### M2M-100
- **Name**: M2M-100 418M (`Xenova/m2m100_418M`)
- **Version**: 418M parameter checkpoint
- **Licence**: MIT License
- **Source Link**: https://github.com/facebookresearch/fairseq/tree/master/examples/m2m_100 and https://huggingface.co/Xenova/m2m100_418M
- **Credit / Required Attribution**:
  Copyright (c) Meta Platforms, Inc. (Angela Fan, Shruti Bhosale, Holger Schwenk, Zhiyi Ma, Ahmed El-Kishky, Siddharth Goyal, Mandeep Baines, Onur Celebi, Guillaume Wenzek, Vishrav Chaudhary, Naman Goyal, Tom Birch, Vitaliy Liptchinsky, Sergey Edunov, Edouard Grave, Michael Auli, Armand Joulin).
- **Usage**: Many-to-many multilingual translation model.

### mBART-50
- **Name**: mBART-50 Many-to-Many (`Xenova/mbart-large-50-many-to-many-mmt`)
- **Version**: Large 50 checkpoint
- **Licence**: MIT License
- **Source Link**: https://github.com/facebookresearch/fairseq/tree/master/examples/mbart50 and https://huggingface.co/Xenova/mbart-large-50-many-to-many-mmt
- **Credit / Required Attribution**:
  Copyright (c) Meta Platforms, Inc.
- **Usage**: Multilingual translation model.

### OPUS-MT Models
- **Name**: OPUS-MT Translation Models (`Xenova/opus-mt-*`: en-ar, ar-en, en-de, de-en, en-fr, fr-en, en-es, es-en, en-ru, ru-en, tr-en)
- **Version**: ONNX converted checkpoints
- **Licence**: CC-BY-4.0
- **Source Link**: https://github.com/Helsinki-NLP/Opus-MT and https://huggingface.co/Xenova
- **Credit / Required Attribution**:
  Copyright (c) Helsinki-NLP (Jörg Tiedemann, Santhosh Thottingal). Released under Creative Commons Attribution 4.0 International (CC BY 4.0).
- **Usage**: Fast language-pair specific offline translation.

### Piper Neural Voices
- **Name**: Piper TTS Voices (`rhasspy/piper-voices`)
- **Versions & Licences**:
  - `fa_IR-amir-medium` (Persian Amir): Licence: CC0 1.0 Universal (Public Domain)
  - `fa_IR-ganji-medium` (Persian Ganji): Licence: CC0 1.0 Universal (Public Domain)
  - `en_GB-alba-medium` (English Alba): Licence: Creative Commons Attribution 4.0 International (CC BY 4.0). Voice data credit: Alba dataset, Centre for Speech Technology Research (CSTR), University of Edinburgh.
  - `en_US-ljspeech-medium` (English LJ Speech): Licence: Public Domain / CC0 1.0 Universal. Voice data credit: Keith Ito (The LJ Speech Dataset).
  - `en_GB-cori-medium` (English Cori): Licence: CC0 1.0 Universal (Public Domain).
  - `en_US-kristin-medium` (English Kristin): Licence: CC0 1.0 Universal (Public Domain).
- **Source Link**: https://huggingface.co/rhasspy/piper-voices
- **Credit / Required Attribution**:
  Rhasspy Piper project contributors. Required attribution for Alba: Centre for Speech Technology Research (CSTR), University of Edinburgh.
- **Usage**: Local text-to-speech rendering in `piper-worker.js`.

### RapidOCR / PaddleOCR
- **Name**: RapidOCR Arabic & Persian (PP-OCRv3 `PaddleOCR/arabic_PP-OCRv3_rec`)
- **Version**: PP-OCRv3
- **Licence**: Apache License 2.0
- **Source Link**: https://github.com/PaddlePaddle/PaddleOCR and https://github.com/RapidAI/RapidOCR
- **Credit / Required Attribution**:
  Copyright (c) 2020 PaddlePaddle Authors. Licensed under Apache License 2.0. RapidOCR ONNX runtime integration by RapidAI contributors.
- **Usage**: Deep-learning OCR engine for screen translation in the desktop companion.

---

## 6. CDN Runtime Libraries

### Transformers.js
- **Name**: Transformers.js (`@huggingface/transformers`)
- **Version**: 3.8.1
- **Licence**: Apache License 2.0
- **Source Link**: https://github.com/huggingface/transformers.js
- **Credit / Required Attribution**:
  Copyright (c) 2023 Xenova / Hugging Face. Licensed under the Apache License, Version 2.0.
- **Usage**: Loaded dynamically in `ai-worker.js` from `cdn.jsdelivr.net` to execute Whisper, NLLB, and ONNX translation models.

### ONNX Runtime Web
- **Name**: ONNX Runtime Web
- **Version**: 1.14.0+
- **Licence**: MIT License
- **Source Link**: https://github.com/microsoft/onnxruntime
- **Credit / Required Attribution**:
  Copyright (c) Microsoft Corporation. Licensed under the MIT License.
- **Usage**: Underlying web execution engine for neural network inference in browser workers.

---

## 7. External Tools (Not Bundled)

### FFmpeg
- **Name**: FFmpeg
- **Version**: User-provided
- **Licence**: LGPL 2.1+ / GPL 2.0+ (depending on build flags)
- **Source Link**: https://ffmpeg.org/
- **Notice**: FFmpeg is **NOT bundled** and **NOT distributed** with this software. If required for external video extraction scripts, users install and configure their own local copy independently.

---

## 8. Unverified - owner must check

The following items are referenced or loaded from external registries and should be verified prior to commercial store distribution:
1. **OPUS-MT Individual Pair Model Cards**: Individual language-pair models trained by Helsinki-NLP are broadly CC-BY-4.0, but specific upstream training data corpora in the OPUS corpus may carry specific attribution requirements. The owner should verify each language pair model card on Hugging Face before commercial distribution.
2. **RapidOCR PP-OCRv3 Dataset Terms**: The PaddleOCR architecture and model code are Apache-2.0. The owner should review Baidu PaddlePaddle's training dataset guidelines if the Arabic PP-OCRv3 checkpoint is bundled in enterprise or commercial distributions.
