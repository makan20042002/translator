#!/usr/bin/env python3
"""
Entry point to run the MAKAN Translate ASR Helper server.
Usage:
    python run.py [--host 127.0.0.1] [--port 8765] [--preload whisper-large-v3]
"""

import argparse
import os
import sys

def main():
    parser = argparse.ArgumentParser(description="MAKAN Translate ASR Helper")
    parser.add_argument("--host", default="127.0.0.1", help="Host address (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8765, help="Port number (default: 8765)")
    parser.add_argument("--preload", default=None, help="Preload model on startup (e.g. whisper-large-v3, qwen3-asr)")
    args = parser.parse_args()

    os.environ["MAKAN_ASR_HOST"] = args.host
    os.environ["MAKAN_ASR_PORT"] = str(args.port)

    # Add directory to sys.path
    curr_dir = os.path.dirname(os.path.abspath(__file__))
    if curr_dir not in sys.path:
        sys.path.insert(0, curr_dir)

    import uvicorn
    import server

    if args.preload:
        print(f"Preloading model: {args.preload}...")
        try:
            server.load_model(args.preload)
            print(f"Model {args.preload} preloaded successfully.")
        except Exception as e:
            print(f"Warning: Failed to preload {args.preload}: {e}", file=sys.stderr)

    print(f"Starting server at http://{args.host}:{args.port}")
    uvicorn.run(server.app, host=args.host, port=args.port, log_level="info")

if __name__ == "__main__":
    main()
