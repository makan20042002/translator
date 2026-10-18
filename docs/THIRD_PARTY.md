# Third-Party Libraries and Licences

This repository bundles and vendors the following third-party software:

## PDF.js
- **Project**: PDF.js (by Mozilla Foundation)
- **Version**: 3.11.174
- **Licence**: Apache License 2.0
- **Location**: [`vendor/pdfjs/`](file:///c:/Users/Makan/Desktop/translator/vendor/pdfjs)
  - `vendor/pdfjs/pdf.min.js`
  - `vendor/pdfjs/pdf.worker.min.js`
  - `vendor/pdfjs/LICENSE`
- **Link**: https://github.com/mozilla/pdf.js
- **Usage**: Used in the Document tab for extracting selectable text and rebuilding paragraphs from uploaded PDF documents. Runs entirely locally and offline in the browser without external network requests or eval.

## Piper Offline Voices & Phonemizer
- **Project**: Piper / ONNX Runtime Web / eSpeak NG
- **Licence**: MIT (Piper, ONNX Runtime Web), GPL-3.0-or-later (eSpeak NG)
- **Location**: `vendor/piper/`
- **Link**: https://github.com/rhasspy/piper

## JSZip
- **Project**: JSZip
- **Licence**: MIT
- **Location**: `jszip.min.js`
- **Link**: https://stuk.github.io/jszip/

## Vazirmatn Font
- **Project**: Vazirmatn Font (by Saber Rastikerdar)
- **Licence**: SIL Open Font License 1.1 (OFL)
- **Location**: `fonts/Vazirmatn.woff2`
- **Link**: https://github.com/rastikerdar/vazirmatn

## Whisper Models (OpenAI)
- **Project**: Whisper Speech Recognition Models (Tiny, Base, Small via `Xenova/whisper-*`, Large v3 Turbo via `onnx-community/whisper-large-v3-turbo`, Large v3 via `onnx-community/whisper-large-v3-ONNX`, Distil Large v3 via `distil-whisper/distil-large-v3`)
- **Licence**: MIT (Whisper). Converted ONNX checkpoints on Hugging Face (see respective model cards).
- **Link**: https://github.com/openai/whisper
- **Usage**: Transcribing speech to text in the Voice tab and Media tab.

### Whisper Large v3 (Full)
- **Name**: Whisper Large v3
- **Repository**: `onnx-community/whisper-large-v3-ONNX`
- **Licence**: Apache-2.0 (original OpenAI model; repo tag not shown)
- **Source**: https://huggingface.co/onnx-community/whisper-large-v3-ONNX
- **Usage**: High-accuracy speech recognition across 99 languages in the Voice and Media tabs.

### Whisper Distil Large v3 (English Only, Fast)
- **Name**: Whisper Distil Large v3 (English only, fast)
- **Repository**: `distil-whisper/distil-large-v3`
- **Licence**: MIT
- **Source**: https://huggingface.co/distil-whisper/distil-large-v3
- **Usage**: Lightweight English-only speech recognition in the Voice and Media tabs.

## Transformers.js
- **Project**: Transformers.js (`@huggingface/transformers` 3.8.1)
- **Licence**: Apache License 2.0
- **Link**: https://github.com/huggingface/transformers.js
- **Usage**: Runs machine learning models (Whisper, translation models) in browser Web Workers.

## ONNX Runtime Web
- **Project**: ONNX Runtime Web (Microsoft)
- **Licence**: MIT
- **Link**: https://github.com/microsoft/onnxruntime
- **Usage**: Execution engine bundled within Transformers.js and used for offline neural models.

## NLLB-200 (Non-Commercial Notice)
- **Project**: NLLB-200 distilled 600M (`Xenova/nllb-200-distilled-600M` by Meta AI)
- **Licence**: Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)
- **Link**: https://github.com/facebookresearch/fairseq/tree/nllb
- **Usage**: Offline translation in the Text, Subtitle, and Media tabs.
- **Notice**: NLLB-200 may be used for non-commercial purposes only. Commercial distributions must omit this model or acquire commercial rights.

## M2M-100
- **Project**: M2M-100 418M (`Xenova/m2m100_418M` by Meta AI)
- **Licence**: MIT
- **Link**: https://github.com/facebookresearch/fairseq/tree/master/examples/m2m_100
- **Usage**: Many-to-many multilingual machine translation model.

## mBART-50
- **Project**: mBART-50 Many-to-Many (`Xenova/mbart-large-50-many-to-many-mmt` by Meta AI)
- **Licence**: MIT
- **Link**: https://github.com/facebookresearch/fairseq/tree/master/examples/mbart50
- **Usage**: Multilingual machine translation model.

## FFmpeg (Not Bundled)
- **Project**: FFmpeg
- **Licence**: LGPL 2.1+ / GPL 2.0+ (depending on build flags)
- **Link**: https://ffmpeg.org/
- **Usage**: FFmpeg is **NOT** bundled and **NOT** distributed with this software. Users install and configure their own local copy independently if needed.

