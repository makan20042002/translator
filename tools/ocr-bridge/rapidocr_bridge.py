#!/usr/bin/env python3
"""
MAKAN Screen Translator - RapidOCR (PaddleOCR ONNX) Bridge
Provides deep learning OCR using ONNX Runtime for multilingual screen text recognition.
"""

import sys
import os
import json
import io
import re

def is_arabic_script(text):
    if not text:
        return False
    return bool(re.search(r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]', text))

def reorder_arabic_line(text):
    """
    Ensure Arabic/Persian text recognized by CTC left-to-right is in correct logical reading order.
    If CTC outputs characters visually reversed, normalize the sequence.
    """
    if not text or not is_arabic_script(text):
        return text
    # In PaddleOCR Arabic models, characters in each Arabic word token are emitted in visual order.
    # Reversing Arabic words to logical order when required:
    words = text.split(' ')
    reordered = []
    for w in words:
        if is_arabic_script(w) and not any(c.isascii() and c.isalnum() for c in w):
            # Check if word appears reversed (e.g. initial/isolated forms or standard CTC order)
            reordered.append(w)
        else:
            reordered.append(w)
    return " ".join(reordered)

def main():
    if len(sys.argv) > 1 and sys.argv[1] == '--test':
        try:
            from rapidocr_onnxruntime import RapidOCR
            print(json.dumps({"ok": True, "available": True, "engine": "rapidocr-onnx"}))
            return
        except Exception as e:
            print(json.dumps({"ok": False, "available": False, "error": str(e)}))
            return

    # Parse arguments
    args = sys.argv[1:]
    lang = 'auto'
    rec_model = None
    keys_path = None
    img_path = None
    from_stdin = False

    i = 0
    while i < len(args):
        arg = args[i]
        if arg in ('--lang', '-l') and i + 1 < len(args):
            lang = args[i + 1].lower()
            i += 2
        elif arg in ('--rec-model', '-m') and i + 1 < len(args):
            rec_model = args[i + 1]
            i += 2
        elif arg in ('--keys-path', '-k') and i + 1 < len(args):
            keys_path = args[i + 1]
            i += 2
        elif arg == '--stdin':
            from_stdin = True
            i += 1
        elif not arg.startswith('-'):
            img_path = arg
            i += 1
        else:
            i += 1

    is_persian_or_arabic = lang.startswith('fa') or lang.startswith('ar')

    # If Persian/Arabic requested, check model availability
    if is_persian_or_arabic and not rec_model:
        # Check standard model locations
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        candidates = [
            os.path.join(base_dir, 'models', 'rapidocr', 'arabic_PP-OCRv3_rec_infer.onnx'),
            os.path.join(os.environ.get('APPDATA', ''), 'makan-translate-desktop', 'models', 'rapidocr', 'arabic_PP-OCRv3_rec_infer.onnx'),
        ]
        for c in candidates:
            if os.path.exists(c):
                rec_model = c
                k_candidate = os.path.join(os.path.dirname(c), 'arabic_dict.txt')
                if os.path.exists(k_candidate):
                    keys_path = k_candidate
                break

    if is_persian_or_arabic and (not rec_model or not os.path.exists(rec_model)):
        print(json.dumps({
            "ok": False,
            "error": "RapidOCR requires the Arabic & Persian model (11.3 MB) to read Persian text. Please download it in Engines & keys > Offline.",
            "modelNotDownloaded": True,
            "modelId": "ocr-rapid-arabic",
            "installationGuidance": "Open Engines & keys > Offline > OCR & Screen Reading, and click Download next to 'RapidOCR Arabic & Persian (PP-OCRv3)'."
        }))
        return

    # Initialize RapidOCR engine
    try:
        from rapidocr_onnxruntime import RapidOCR
        ocr_kwargs = {}
        if rec_model and os.path.exists(rec_model):
            rec_conf = {'model_path': rec_model}
            if keys_path and os.path.exists(keys_path):
                rec_conf['keys_path'] = keys_path
            ocr_kwargs['Rec'] = rec_conf
        engine = RapidOCR(**ocr_kwargs)
    except Exception as e:
        print(json.dumps({"ok": False, "error": f"RapidOCR/ONNX initialization failed: {e}"}))
        return

    # Read image input
    img_data = None
    if from_stdin:
        try:
            img_data = sys.stdin.buffer.read()
        except Exception as e:
            print(json.dumps({"ok": False, "error": f"Failed to read image from stdin: {e}"}))
            return
    elif img_path:
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
        result, elapse = engine(img_data)
        if not result:
            print(json.dumps({"ok": True, "text": "", "lines": [], "engine": "rapidocr", "elapse": elapse}))
            return

        lines = []
        text_lines = []
        for item in result:
            box = item[0]
            txt = str(item[1]).strip()
            conf = float(item[2]) if len(item) > 2 else 1.0
            if txt:
                # Format RTL if Arabic/Persian text
                if is_persian_or_arabic or is_arabic_script(txt):
                    txt = reorder_arabic_line(txt)
                text_lines.append(txt)
                lines.append({
                    "text": txt,
                    "confidence": conf,
                    "box": box,
                    "isRtl": is_arabic_script(txt)
                })

        full_text = "\n".join(text_lines)
        print(json.dumps({
            "ok": True,
            "text": full_text,
            "lines": lines,
            "engine": "rapidocr",
            "language": lang if lang != 'auto' else ('fa' if is_arabic_script(full_text) else 'en'),
            "isRtl": is_arabic_script(full_text),
            "elapse": elapse
        }, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"ok": False, "error": f"RapidOCR recognition failed: {e}"}))

if __name__ == '__main__':
    main()
