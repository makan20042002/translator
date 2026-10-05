import subprocess
import time
import json
import urllib.request
import urllib.parse
import os
import sys

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

def take_screenshots(prefix="before"):
    os.makedirs("test-assets/screenshots", exist_ok=True)
    with open("test-assets/sample_movie.srt", "r", encoding="utf-8") as f:
        srt_content = f.read()

    # We will test 3 resolutions x 2 languages = 6 configurations
    configs = [
        {"w": 1366, "h": 900, "lang": "en", "dir": "ltr"},
        {"w": 1366, "h": 900, "lang": "fa", "dir": "rtl"},
        {"w": 1920, "h": 1080, "lang": "en", "dir": "ltr"},
        {"w": 1920, "h": 1080, "lang": "fa", "dir": "rtl"},
        {"w": 390, "h": 844, "lang": "en", "dir": "ltr"},
        {"w": 390, "h": 844, "lang": "fa", "dir": "rtl"},
    ]

    for cfg in configs:
        w = cfg["w"]
        h = cfg["h"]
        lang = cfg["lang"]
        out_name = f"test-assets/screenshots/{prefix}_{w}_{lang}.png"
        
        # Launch Chrome with remote debugging
        user_data = os.path.abspath(f"test-assets/chrome_profile_{w}_{lang}")
        os.makedirs(user_data, exist_ok=True)
        
        proc = subprocess.Popen([
            CHROME_PATH,
            "--headless=new",
            f"--remote-debugging-port=9225",
            f"--window-size={w},{h}",
            f"--user-data-dir={user_data}",
            "--no-first-run",
            "--no-default-browser-check",
            "http://localhost:8080/"
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        time.sleep(1.5)
        try:
            # Query targets
            targets_url = "http://127.0.0.1:9225/json"
            req = urllib.request.urlopen(targets_url)
            targets = json.loads(req.read().decode())
            page_target = [t for t in targets if t.get("type") == "page"][0]
            ws_url = page_target["webSocketDebuggerUrl"]
            
            # Simple websocket interaction via Python 3.14 or basic script
            # In node or python websocket: let's use python's asyncio or node
        finally:
            proc.kill()

print("Script template created")
