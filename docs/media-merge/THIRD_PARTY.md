# THIRD PARTY

This list was written from what the code uses. Where a licence was not checked it says "check". Do not rely on this file as legal advice: read each project's own licence before shipping.

## Used by the app at run time
| Part | What for | Licence |
|---|---|---|
| Whisper (OpenAI) models: Tiny, Base, Small via `Xenova/whisper-*`, Large v3 Turbo via `onnx-community/whisper-large-v3-turbo` | speech to text | MIT (Whisper). The converted ONNX copies on Hugging Face: check each model page |
| Transformers.js (`@huggingface/transformers` 3.8.1, loaded from jsDelivr) | runs the models in the browser | Apache-2.0 |
| NLLB-200 distilled 600M (`Xenova/nllb-200-distilled-600M`) | offline translation | CC BY-NC 4.0, NON-COMMERCIAL use only |
| M2M-100 418M (`Xenova/m2m100_418M`) | offline translation | MIT |
| mBART-50 many-to-many (`Xenova/mbart-large-50-many-to-many-mmt`) | offline translation | MIT |
| ONNX Runtime Web (inside Transformers.js) | model engine | check |
| Gemini API (optional, the person's own key) | online translation | Google's terms of use apply; check |
| Ollama (program on the person's own computer, not shipped) | local translation | MIT (Ollama); each model has its own licence: check |
| TranslateGemma (`translategemma:4b` and others, downloaded by the person with Ollama) | local translation | Gemma terms of use: check before commercial use |
| LM Studio or other OpenAI-style server (not shipped) | local translation | their own terms; each model has its own licence: check |
| Google Translate web-page services (unofficial, optional) | online translation | NOT an official API; Google's terms apply and may forbid this use: check. Off by default |
| MyMemory (optional) | online translation | free public service with a daily limit; their terms apply: check |
| Chrome on-device Translator (browser feature) | local translation | part of Chrome; Google's terms apply |
| Hugging Face model host | model download | check their terms |

## ffmpeg
ffmpeg is NOT included and NOT distributed with this app. The person downloads it themselves from ffmpeg.org and the app only starts it. Its licence (LGPL or GPL, depending on the build) belongs to the build the person chose: check.

## Development and packaging only
| Part | Licence |
|---|---|
| Electron | check (MIT, to be confirmed) |
| electron-builder | check (MIT, to be confirmed) |
| Playwright | check (Apache-2.0, to be confirmed) |
| Node.js | check |

A portable exe made with `npm run dist` contains Electron, which brings its own third-party notices: check the files it writes next to the exe.

## Note about NLLB
NLLB-200 may be used for non-commercial purposes only. If MAKAN Translate or this app is used commercially, do not offer NLLB, or get a licence. The app shows this on the NLLB card in Model Hub and in the Translate card.
