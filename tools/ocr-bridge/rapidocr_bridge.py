#!/usr/bin/env python3
"""
MAKAN Screen Translator - RapidOCR (PaddleOCR ONNX) Bridge
Provides deep learning OCR using ONNX Runtime for multilingual screen text recognition.
"""

import sys
import os
import json
import io

def get_engine():
    try:
        from rapidocr_onnxruntime import RapidOCR
        # Initialize RapidOCR engine
        return RapidOCR()
    except Exception as e:
        return None, str(e)

def main():
    if len(sys.argv) > 1 and sys.argv[1] == '--test':
        try:
            from rapidocr_onnxruntime import RapidOCR
            print(json.dumps({"ok": True, "available": True, "engine": "rapidocr-onnx"}))
            return
        except Exception as e:
            print(json.dumps({"ok": False, "available": False, "error": str(e)}))
            return

    try:
        from rapidocr_onnxruntime import RapidOCR
        engine = RapidOCR()
    except Exception as e:
        print(json.dumps({"ok": False, "error": f"RapidOCR/ONNX initialization failed: {e}"}))
        return

    # Read image input
    img_data = None
    if '--stdin' in sys.argv:
        try:
            img_data = sys.stdin.buffer.read()
        except Exception as e:
            print(json.dumps({"ok": False, "error": f"Failed to read image from stdin: {e}"}))
            return
    elif len(sys.argv) > 1 and not sys.argv[1].startswith('-'):
        img_path = sys.argv[1]
        if not os.path.exists(img_path):
            print(json.dumps({"ok": False, "error": f"Image file not found: {img_path}"}))
            return
        try:
            with open(img_path, 'rb') as f:
                img_data = f.read()
        except Exception as e:
            print(json.dumps({"ok": False, "error": f"Failed to read image file: {e}"}))
            return

    if not img_data or len(img_data) == 0:
        print(json.dumps({"ok": True, "text": "", "lines": [], "engine": "rapidocr"}))
        return

    try:
        # RapidOCR can directly accept bytes or numpy array/PIL
        result, elapse = engine(img_data)
        if not result:
            print(json.dumps({"ok": True, "text": "", "lines": [], "engine": "rapidocr", "elapse": elapse}))
            return

        lines = []
        text_lines = []
        for item in result:
            # item format: [box_coordinates, text, confidence]
            box = item[0]
            txt = str(item[1]).strip()
            conf = float(item[2]) if len(item) > 2 else 1.0
            if txt:
                text_lines.append(txt)
                lines.append({
                    "text": txt,
                    "confidence": conf,
                    "box": box
                })

        full_text = "\n".join(text_lines)
        print(json.dumps({
            "ok": True,
            "text": full_text,
            "lines": lines,
            "engine": "rapidocr",
            "elapse": elapse
        }, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"ok": False, "error": f"RapidOCR recognition failed: {e}"}))

if __name__ == '__main__':
    main()
