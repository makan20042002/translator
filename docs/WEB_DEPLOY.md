# Deploying MAKAN Translate to Shared Web Hosting

This guide explains in plain, step-by-step language how to publish MAKAN Translate to your shared web host (such as cPanel / LiteSpeed / Apache) at:
**`https://makanlab.tech/translate/app/`**

---

## 1. What to Build and Upload

1. On your computer, open a command prompt / terminal in the `translator` repository folder.
2. Run the build command:
   ```bash
   npm run build:web
   ```
   This generates a clean, self-contained output folder at:
   ```
   dist/web/
   ```
3. **What to upload**: Upload the **entire contents** inside `dist/web/` into your website's server directory:
   ```
   public_html/translate/app/
   ```
   *(Note: Upload the files inside `dist/web/`, not the `dist` or `web` folder itself, so that `index.html` resides directly inside `public_html/translate/app/index.html`)*.

---

## 2. How to Upload

### Option A: Using cPanel / DirectAdmin File Manager (Recommended & Quickest)
1. In `dist/web/`, select all files and subfolders, right-click, and choose **Compress to ZIP** (e.g. `web-deploy.zip`).
2. Log in to your hosting control panel (cPanel) and open **File Manager**.
3. Navigate to `public_html/`. If the folders `translate` and `app` do not exist yet, create `translate`, go inside it, and create `app`. You should now be in:
   `public_html/translate/app/`
4. Click **Upload**, drag and drop your `web-deploy.zip` file, and wait for the upload to complete.
5. In File Manager, right-click `web-deploy.zip` and choose **Extract**.
6. Ensure hidden dotfiles (like `.htaccess` and `.htaccess.threads-optional`) are visible (in cPanel File Manager: Settings → *Show Hidden Files*).
7. Delete `web-deploy.zip` after extracting.

### Option B: Using FTP / SFTP (FileZilla, WinSCP, Cyberduck)
1. Connect to `makanlab.tech` with your FTP credentials.
2. Navigate to the remote directory:
   `public_html/translate/app/`
3. Drag and drop all files and folders from your local `dist/web/` into the remote directory.
4. Ensure your FTP client transfers hidden dotfiles (specifically `.htaccess`).

---

## 3. Post-Deployment Verification (The 10 Checks)

After uploading, open your browser and verify every item in this checklist:

1. **HTTPS padlock**: Open `https://makanlab.tech/translate/app/`. The browser address bar shows a secure padlock icon with no mixed-content warnings.
2. **Page loads**: The app interface loads cleanly with the MAKAN logo, language selector, navigation tabs, and no 404 errors.
3. **A model download starts**: Go to the **Model Hub** tab (or Settings → Offline models). Pick a small model (like Whisper Base or OPUS-MT) and click Download. Confirm the download progress bar moves smoothly.
4. **Microphone prompt works**: Switch to the **Voice** tab and click the microphone button. Confirm the browser prompts for microphone permission and speech capture begins.
5. **Offline reload works**: Open Developer Tools (F12) → Application / Network tab, check "Offline", and press Reload (F5). Confirm the application shell opens from the service worker cache even without an active internet connection.
6. **Media tab**: Open the **Media** tab. Confirm the audio/video upload area renders with subtitle styling controls and file drop zones.
7. **Extension Open in App fallback opens the hosted app**: When the desktop application executable is closed, triggering "Open in App" from the browser extension opens `https://makanlab.tech/translate/app/#text=...` with the selected text pre-filled in the Text tab.
8. **Settings**: Click the gear icon to open **Settings**. Verify all engine configurations, API key inputs, and voice dropdowns display correctly.
9. **About/Help**: Click **About & credits** in the footer. Confirm the About dialog opens, displaying offline dictionary attribution and model capabilities.
10. **Service worker version**: Check the Developer Tools Console or Application → Service Workers tab. Confirm the active service worker cache name matches the current release version (e.g. `makan-translate-v...`).

---

## 4. Multi-Threading with .htaccess.threads-optional

Your build output includes two server configuration files:
- `.htaccess` (active by default): handles HTTPS redirect, compression, MIME types for `.wasm`, `.onnx`, `.webmanifest`, and safe cache rules.
- `.htaccess.threads-optional` (inactive): contains `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless` (or `require-corp`).

Plainly stated: On `makanlab.tech`, Whisper uses only one CPU thread unless the optional `.htaccess.threads-optional` headers are enabled (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: credentialless`). Without these headers, `crossOriginIsolated` is `false`, restricting CPU execution to 1 thread. The MAKAN Windows desktop app enables these headers automatically on its local server, so multi-core CPU transcription works out of the box in the desktop app.

### What is faster with it:
`media/media-worker.js` checks `self.crossOriginIsolated`. When enabled by COOP/COEP headers:
- The ONNX Runtime WASM engine can use multi-threading (`pickThreads()` allocates up to `cores - 2` CPU worker threads).
- Whisper CPU transcription in the Media tab and Voice tab processes audio noticeably faster on multi-core computers.

### What could break:
- COEP requires cross-origin resources to be compatible (e.g. `credentialless` allows cross-origin loads without credentials, while `require-corp` requires explicit CORP headers).
- If Hugging Face or third-party CDNs omit compatible headers, model downloads or assets might be blocked by the browser.
- **Rule**: Untested on the real host. Do NOT activate this on production until you have tested it in a staging folder on your hosting server.

---

## 5. Connecting a Hosted Page to Local Ollama

The web app supports Ollama for local LLM translation. When using a hosted website over HTTPS (`https://makanlab.tech`), web browsers impose security restrictions on accessing local services (`http://127.0.0.1:11434`):

1. **Origin Allowance**: Ollama must allow the website's origin. Set the environment variable before starting Ollama:
   - On Windows (PowerShell):
     ```powershell
     $env:OLLAMA_ORIGINS="https://makanlab.tech"
     ollama serve
     ```
   - On Windows (System Environment Variables):
     Add `OLLAMA_ORIGINS` with value `https://makanlab.tech`.
2. **Local Network Access Prompt**: Modern Chromium browsers may display a permission prompt asking whether `makanlab.tech` is allowed to access your local network. Click **Allow**.

---

## 6. How to Update

When you release a new version:
1. Run `npm run build:web`.
2. Upload the updated contents of `dist/web/` to `public_html/translate/app/`, overwriting existing files.
3. Visitors' browsers will automatically detect the new `sw.js` (because `sw.js` is never cached long).
4. On the next visit or hard refresh (Ctrl+F5 / Shift+Reload), the new service worker activates, deletes old caches, and serves the updated version.

---

## 7. How to Roll Back

If an issue occurs after an update:
1. Re-run `npm run build:web` from your previous stable git commit or restore the backup copy of your previous `dist/web/` folder.
2. Upload the restored files to `public_html/translate/app/`.
3. Visitors will automatically download the restored version on their next refresh.
