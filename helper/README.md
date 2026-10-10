# MAKAN Translate - Python ASR Helper

A high-performance local Speech-to-Text inference helper providing an OpenAI-compatible API for **Whisper large-v3** and **Qwen3-ASR**.

## Features

- **OpenAI-Compatible API**: Implements `/v1/audio/transcriptions` for seamless integration.
- **Model Support**:
  - `whisper-large-v3`: State-of-the-art multilingual recognition (OpenAI Whisper large v3).
  - `whisper-large-v3-turbo`: Fast optimized variant of Whisper large v3.
  - `qwen3-asr` / `qwen2-audio`: Advanced Persian & English speech understanding with Qwen Audio models.
- **Lazy Loading**: Starts instantly (< 1s) and loads heavy models on first use or on demand.
- **GPU & CPU Auto-Detection**: Uses CUDA FP16 if available; gracefully falls back to CPU.
- **CORS Enabled**: Works directly from the web browser, PWA, or the Windows desktop app.

## Quick Start (Windows)

1. Double click `start.bat` or run in terminal:
   ```cmd
   python run.py --host 127.0.0.1 --port 8765
   ```
2. The server will start on `http://127.0.0.1:8765`.
3. In MAKAN Translate:
   - Go to **Engines & keys** → **Voice** (or Voice tab settings).
   - Under **Speech to text**, choose **Python ASR Helper (Whisper / Qwen)**.
   - Choose your preferred model (`Whisper large-v3` or `Qwen3-ASR`).

## API Endpoints

- `GET /health`: Health status, active model, and device information.
- `GET /v1/models`: List of available ASR models.
- `POST /v1/models/load`: Pre-load a specific model into memory (`{"model": "whisper-large-v3"}`).
- `POST /v1/models/unload`: Free memory/VRAM by unloading active model.
- `POST /v1/audio/transcriptions`: Transcribe audio file:
  - `file`: Multipart audio file (WAV, WebM, MP3, etc.)
  - `model`: `whisper-large-v3` or `qwen3-asr`
  - `language`: optional language hint (e.g. `fa` or `en`)
  - `response_format`: `json` (returns `{"text": "..."}`) or `text`
