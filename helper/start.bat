@echo off
title MAKAN Translate - Python ASR Helper
echo Starting MAKAN Translate ASR Helper (Whisper large-v3 / Qwen3-ASR)...
echo Server will be available at http://127.0.0.1:8765
cd /d "%~dp0"
python run.py --host 127.0.0.1 --port 8765
pause
