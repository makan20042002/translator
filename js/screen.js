/* ---------- MAKAN SCREEN TRANSLATOR (WEB UI & DESKTOP INTEGRATION) ---------- */
function initScreenWebUI() {
  const tabScreen = $('tab-screen');
  if (!tabScreen) return;

  const isDesktop = !!(window.makanDesktop?.isDesktop);

  // Browser banner visibility
  const browserBanner = $('screenBrowserBanner');
  if (browserBanner) {
    browserBanner.hidden = isDesktop;
  }

    const launchBtn = $('tabScreenLaunchBtn');
  if (launchBtn) {
    launchBtn.disabled = !isDesktop;
    if (!isDesktop) {
      launchBtn.setAttribute('title', L('screenBrowserNotice'));
    } else {
      launchBtn.removeAttribute('title');
    }
  }

  const stSettingsBlock = $('screenTransSettingsBlock');
  if (stSettingsBlock) {
    stSettingsBlock.hidden = !isDesktop;
  }

  const btnScreen = $('btnScreenTrans');
  if (btnScreen) {
    btnScreen.style.display = isDesktop ? 'inline-flex' : 'none';
  }

  // Populate language dropdowns
  const srcSelect = $('screenSrcLang');
  const tgtSelect = $('screenTgtLang');
  if (srcSelect && typeof LANGS !== 'undefined') {
    srcSelect.innerHTML = `<option value="auto">${esc(L('detect'))}</option>`;
    LANGS.forEach(([code, name]) => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = name;
      if (code === 'en') opt.selected = true;
      srcSelect.appendChild(opt);
    });
  }
  if (tgtSelect && typeof LANGS !== 'undefined') {
    tgtSelect.innerHTML = '';
    LANGS.forEach(([code, name]) => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = name;
      if (code === 'fa') opt.selected = true;
      tgtSelect.appendChild(opt);
    });
  }

  if (typeof setupUnifiedLanguagePicker === 'function') {
    setupUnifiedLanguagePicker({
      srcSelect: 'screenSrcLang',
      tgtSelect: 'screenTgtLang',
      swapBtn: 'screenSwapBtn',
      idPrefix: 'screen',
      onChanged: () => updateScreenPrivacyNotice()
    });
  }

  // Populate engines
  const engSelect = $('screenTransEngine');
  if (engSelect) {
    const screenEngines = [
      ['auto', 'Auto (Best available)'],
      ['offline', 'NLLB (Offline)'],
      ['ollama', 'Ollama (Local)'],
      ['google', 'Google Translate (Web)'],
      ['gemini', 'Google Gemini'],
      ['groq', 'Groq Inference']
    ];
    engSelect.innerHTML = '';
    screenEngines.forEach(([id, name]) => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = name;
      engSelect.appendChild(opt);
    });
    engSelect.addEventListener('change', updateScreenPrivacyNotice);
  }

  // Privacy notice check
  function updateScreenPrivacyNotice() {
    const curEng = engSelect?.value || 'auto';
    const privEl = $('screenPrivacyText');
    if (!privEl) return;
    const isStrictlyLocal = (curEng === 'offline' || curEng === 'ollama');
    privEl.textContent = isStrictlyLocal ? L('screenPrivacyLocal') : L('screenPrivacyCloud');
  }
  updateScreenPrivacyNotice();

  // Mode Selection Cards
  const modeCards = tabScreen.querySelectorAll('.screen-mode-card');
  window.setScreenMode = function(chosenMode) {
    modeCards.forEach(c => {
      const isMatch = (c.dataset.mode === chosenMode);
      c.classList.toggle('on', isMatch);
      c.setAttribute('aria-checked', isMatch ? 'true' : 'false');
    });
    if ($('stFreezeFrame')) {
      $('stFreezeFrame').value = (chosenMode === 'freeze' || chosenMode === 'region') ? '1' : '0';
    }
    if ($('stClipboardWatcher')) {
      $('stClipboardWatcher').value = (chosenMode === 'clip') ? '1' : '0';
    }
    if (typeof window._persistStConfig === 'function') {
      window._persistStConfig();
    }
  };

  modeCards.forEach(card => {
    card.addEventListener('click', () => {
      if (typeof window.setScreenMode === 'function') {
        window.setScreenMode(card.dataset.mode);
      }
    });
  });

  // Overlay toggle
  const ovToggle = $('screenOverlayToggle');
  const resOv = $('screenResultOverlay');
  ovToggle?.addEventListener('change', () => {
    if (resOv) resOv.style.display = ovToggle.checked ? '' : 'none';
  });

  $('screenOvCloseBtn')?.addEventListener('click', () => {
    if (resOv) resOv.style.display = 'none';
    if (ovToggle) ovToggle.checked = false;
  });

  // Overlay copy button
  $('screenOvCopyBtn')?.addEventListener('click', async () => {
    const txt = $('screenOvTrans')?.textContent || '';
    if (!txt) return;
    try {
      await navigator.clipboard.writeText(txt);
      if (typeof toast === 'function') toast(L('copied'), 'ok');
    } catch {
      if (typeof toast === 'function') toast(txt, 'ok');
    }
  });

  // Overlay speak button
  $('screenOvSpeakBtn')?.addEventListener('click', () => {
    const txt = $('screenOvTrans')?.textContent || '';
    const tgt = tgtSelect?.value || 'fa';
    if (txt && typeof speak === 'function') {
      speak(txt, tgt);
    }
  });

  // Overlay open in Translate app button
  $('screenOvOpenInAppBtn')?.addEventListener('click', () => {
    const orig = $('screenOvOrig')?.textContent || '';
    const src = srcSelect?.value || 'auto';
    const tgt = tgtSelect?.value || 'fa';
    if ($('tIn')) {
      $('tIn').value = orig;
      if (src && src !== 'auto' && $('src')) $('src').value = src;
      if (tgt && $('tgt')) $('tgt').value = tgt;
      $('tIn').dispatchEvent(new Event('input'));
      document.querySelector('[data-tab=text]')?.click();
    }
  });

  // Toolbar actions
  let zoomLevel = 1;
  $('screenZoomInBtn')?.addEventListener('click', () => {
    if (zoomLevel < 1.4) zoomLevel += 0.1;
    const vp = $('screenSceneViewport');
    if (vp) vp.style.transform = `scale(${zoomLevel})`;
  });
  $('screenZoomOutBtn')?.addEventListener('click', () => {
    if (zoomLevel > 0.8) zoomLevel -= 0.1;
    const vp = $('screenSceneViewport');
    if (vp) vp.style.transform = `scale(${zoomLevel})`;
  });
  $('screenPinBtn')?.addEventListener('click', (e) => {
    e.currentTarget.classList.toggle('active');
  });

  // History buttons
  $('screenViewAllBtn')?.addEventListener('click', () => {
    document.querySelector('[data-tab=hist]')?.click();
  });
  $('screenClearHistBtn')?.addEventListener('click', () => {
    if (typeof store !== 'undefined') store.set('screen_hist', []);
    renderScreenCaptures();
  });

  // Render recent captures
  function renderScreenCaptures() {
    const listEl = $('screenCapturesList');
    if (!listEl) return;
    let list = (typeof store !== 'undefined' ? store.get('screen_hist', null) : null);
    if (!Array.isArray(list)) {
      list = [
        { id: 'c1', orig: 'Find the hidden path', trans: 'مسیر پنهان را پیدا کن', time: '2 min ago' },
        { id: 'c2', orig: 'Inventory is full', trans: 'موجودی پر است', time: '8 min ago' },
        { id: 'c3', orig: 'New objective', trans: 'هدف جدید', time: '12 min ago' }
      ];
    }
    listEl.innerHTML = '';
    if (list.length === 0) {
      listEl.innerHTML = `<div class="screen-empty-captures">${L('screenNoCaptures')}</div>`;
      return;
    }
    list.forEach(item => {
      const row = document.createElement('div');
      row.className = 'screen-capture-item';
      row.innerHTML = `
        <div class="screen-capture-thumb" aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        </div>
        <div class="screen-capture-meta">
          <span class="screen-capture-orig"><bdi>${item.orig}</bdi></span>
          <span class="screen-capture-arrow" aria-hidden="true">→</span>
          <span class="screen-capture-trans" dir="rtl">${item.trans}</span>
          <span class="screen-capture-time">${item.time}</span>
        </div>
        <div class="screen-capture-acts">
          <button class="btn icon-only screen-ov-act-btn" data-act="copy" title="Copy" aria-label="Copy">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          </button>
          <button class="btn icon-only screen-ov-act-btn" data-act="open" title="Open in Translate" aria-label="Open in Translate">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </button>
        </div>
      `;
      row.querySelector('[data-act=copy]')?.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(item.trans);
          if (typeof toast === 'function') toast(L('copied'), 'ok');
        } catch {}
      });
      row.querySelector('[data-act="open"]')?.addEventListener('click', () => {
        if ($('tIn')) {
          $('tIn').value = item.orig;
          $('tIn').dispatchEvent(new Event('input'));
          document.querySelector('[data-tab=text]')?.click();
        }
      });
      listEl.appendChild(row);
    });
  }
  renderScreenCaptures();

  // Primary capture button handler for browser / desktop
  $('tabScreenLaunchBtn')?.addEventListener('click', async () => {
    if (typeof window.closeSettings === 'function') window.closeSettings();
    if (window.makanDesktop?.startScreenTranslator) {
      window.makanDesktop.startScreenTranslator({
        targetLang: tgtSelect?.value || $('stTgtLang')?.value || 'fa',
        ocrLang: srcSelect?.value || $('stOcrLang')?.value || 'auto',
        engine: engSelect?.value || 'auto'
      });
      return;
    }
    if (typeof toast === 'function') {
      toast(L('screenBrowserNotice'), 'info');
    }
    // Demo translation on preview box
    const origBox = $('screenOvOrig');
    const transBox = $('screenOvTrans');
    if (origBox && transBox && typeof translateItems === 'function') {
      const origText = origBox.textContent.trim();
      const s = srcSelect?.value || 'auto';
      const t = tgtSelect?.value || 'fa';
      const e = engSelect?.value || 'auto';
      if (resOv) resOv.style.display = '';
      if (ovToggle) ovToggle.checked = true;
      try {
        const r = await translateItems([origText], opts({ src: s, tgt: t, engine: e }));
        if (r && r.out && r.out[0]) {
          transBox.textContent = r.out[0];
          if ($('screenOvEngPill')) $('screenOvEngPill').textContent = r.used || e;
        }
      } catch (_) {}
    }
  });
}

// Auto-run web initialization on script load or DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initScreenWebUI);
} else {
  initScreenWebUI();
}

/* ---------- MAKAN SCREEN TRANSLATOR (DESKTOP INTEGRATION) ---------- */
(async function initScreenTranslatorDesktop() {
  if (!window.makanDesktop?.isDesktop) return;

  // Show the header button and settings block in desktop environment
  const btnScreen = $('btnScreenTrans');
  const stSettingsBlock = $('screenTransSettingsBlock');
  if (btnScreen) btnScreen.style.display = 'inline-flex';
  if (stSettingsBlock) stSettingsBlock.hidden = false;
  const launchBtn = $('tabScreenLaunchBtn');
  if (launchBtn) {
    launchBtn.disabled = false;
    launchBtn.removeAttribute('title');
  }

  btnScreen?.addEventListener('click', () => {
    if (typeof window.closeSettings === 'function') window.closeSettings();
    window.makanDesktop.startScreenTranslator({
      targetLang: $('screenTgtLang')?.value || $('stTgtLang')?.value || 'fa',
      ocrLang: $('screenSrcLang')?.value || $('stOcrLang')?.value || 'auto',
      engine: $('screenTransEngine')?.value || 'auto'
    });
  });

  // Also support Ctrl+Shift+S keyboard shortcut inside the browser window
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) {
      e.preventDefault();
      if (typeof window.closeSettings === 'function') window.closeSettings();
      window.makanDesktop.startScreenTranslator({
        targetLang: $('screenTgtLang')?.value || $('stTgtLang')?.value || 'fa',
        ocrLang: $('screenSrcLang')?.value || $('stOcrLang')?.value || 'auto',
        engine: $('screenTransEngine')?.value || 'auto'
      });
    }
  });

  // Populate installed OCR languages and target languages in settings
  const stOcrLang = $('stOcrLang');
  const stTgtLang = $('stTgtLang');
  const stOcrHint = $('stOcrStatusHint');

  if (stTgtLang && typeof LANGS !== 'undefined' && stTgtLang.options.length <= 2) {
    const curVal = stTgtLang.value || 'fa';
    stTgtLang.innerHTML = '';
    LANGS.forEach(([code, name]) => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = `${name} (${code})`;
      if (code === curVal) opt.selected = true;
      stTgtLang.appendChild(opt);
    });
  }

  try {
    const ocrLangs = await window.makanDesktop.getOcrLanguages();
    if (stOcrLang) {
      stOcrLang.innerHTML = '<option value="auto">Auto-detect / Default</option>';
      if (Array.isArray(ocrLangs) && ocrLangs.length > 0) {
        ocrLangs.forEach(lang => {
          const opt = document.createElement('option');
          opt.value = lang.tag;
          opt.textContent = `${lang.displayName || lang.tag} (${lang.tag})`;
          stOcrLang.appendChild(opt);
        });
      }
      const hasFa = (Array.isArray(ocrLangs) ? ocrLangs : []).some(l => l.tag.toLowerCase().startsWith('fa'));
      if (!hasFa) {
        const optFa = document.createElement('option');
        optFa.value = 'fa';
        optFa.textContent = 'Persian (fa)';
        stOcrLang.appendChild(optFa);
      }
      if (stOcrHint && Array.isArray(ocrLangs)) {
        stOcrHint.textContent = `✓ ${ocrLangs.length} Windows OCR language pack(s) ready (${ocrLangs.map(l => l.tag).join(', ')})`;
        try {
          const engines = await window.makanDesktop.getOcrEngines?.();
          if (Array.isArray(engines)) {
            const hasRapid = engines.some(e => e.id === 'rapidocr' && e.available);
            if (hasRapid) {
              stOcrHint.textContent += ' • RapidOCR (PaddleOCR ONNX) Ready';
            }
          }
        } catch {}
      }
    }
  } catch (err) {
    if (stOcrHint) stOcrHint.textContent = 'Native Windows OCR is ready.';
  }

  // Populate and manage OCR model dropdown
  const stOcrModel = $('stOcrModel');
  const stOcrModelDlBtn = $('stOcrModelDlBtn');

  function renderOcrModels(chosenId) {
    if (!stOcrModel) return;
    const ocrModels = (MC.models || []).filter(m => m.job === 'ocr');
    stOcrModel.innerHTML = '';
    ocrModels.forEach(m => {
      const ready = mcReady(m);
      const opt = document.createElement('option');
      opt.value = m.id;
      const sizeStr = mcSize(mcBytes(m) || m.bytes);
      opt.textContent = ready
        ? `${mcText(m.name)} (✓ Ready · ${sizeStr})`
        : `${mcText(m.name)} (${sizeStr} · ${L('notDl')})`;
      stOcrModel.appendChild(opt);
    });
    if (chosenId && Array.from(stOcrModel.options).some(o => o.value === chosenId)) {
      stOcrModel.value = chosenId;
    } else if (stOcrModel.options.length > 0) {
      stOcrModel.selectedIndex = 0;
    }
    syncOcrModelDlBtn();
  }

  function syncOcrModelDlBtn() {
    if (!stOcrModel || !stOcrModelDlBtn) return;
    const curId = stOcrModel.value;
    const m = (MC.models || []).find(x => x.id === curId);
    if (!m) {
      stOcrModelDlBtn.style.display = 'none';
      return;
    }
    const ready = mcReady(m);
    if (ready) {
      stOcrModelDlBtn.style.display = 'none';
    } else {
      stOcrModelDlBtn.style.display = 'inline-flex';
      stOcrModelDlBtn.textContent = `${L('dlBtn')} (${mcSize(m.bytes)})`;
    }
  }

  stOcrModel?.addEventListener('change', () => {
    syncOcrModelDlBtn();
    updateActiveReadingStatus();
    persistStConfig();
  });

  stOcrModelDlBtn?.addEventListener('click', async () => {
    const curId = stOcrModel?.value;
    const m = (MC.models || []).find(x => x.id === curId);
    if (!m) return;
    stOcrModelDlBtn.disabled = true;
    stOcrModelDlBtn.textContent = L('mdlDownloading');
    try {
      await mcDownload(m);
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      stOcrModelDlBtn.disabled = false;
      renderOcrModels(curId);
      updateActiveReadingStatus();
    }
  });

  function updateActiveReadingStatus() {
    const engineVal = $('stOcrEngine')?.value || 'auto';
    const langVal = $('stOcrLang')?.value || 'auto';
    const modelVal = $('stOcrModel')?.value;
    const engineNames = {
      auto: 'Auto (Dual Engine)',
      windows: 'Windows Media OCR',
      rapidocr: 'RapidOCR (PaddleOCR ONNX)',
      dual: 'Dual Engine (Windows + RapidOCR)'
    };
    const engName = engineNames[engineVal] || engineVal;
    let lName = langVal;
    if (langVal === 'auto') lName = 'Auto-detect';
    else if (langVal.startsWith('fa')) lName = 'Persian (fa)';
    else if (langVal.startsWith('en')) lName = 'English (' + langVal + ')';
    else if (langVal.startsWith('ar')) lName = 'Arabic (' + langVal + ')';

    let modelSuffix = '';
    if (modelVal && (engineVal === 'rapidocr' || engineVal === 'auto' || engineVal === 'dual')) {
      const mdl = (MC.models || []).find(x => x.id === modelVal);
      if (mdl) modelSuffix = ` · ${mcText(mdl.name)}`;
    }

    const statusEl = $('stActiveReadingStatus');
    if (statusEl) {
      statusEl.textContent = `${engName} · ${lName}${modelSuffix}`;
    }
    const screenStatusEl = $('screenActiveReadingStatus');
    if (screenStatusEl) {
      screenStatusEl.innerHTML = `Active reading: <bdi>${typeof esc === 'function' ? esc(engName) : engName}</bdi> · ${typeof esc === 'function' ? esc(lName) : lName}${modelSuffix}`;
    }

    const warnEl = $('stPersianWarningLine');
    const warnTxt = $('stPersianWarningText');
    if (warnEl && warnTxt) {
      const isFa = langVal.startsWith('fa');
      if (engineVal === 'windows' && isFa) {
        warnEl.style.display = 'block';
        warnTxt.textContent = '⚠ This engine cannot read Persian: install the Windows Persian language pack or use RapidOCR.';
      } else if (engineVal === 'rapidocr' && isFa) {
        const arabicMdl = MC.models?.find(m => m.id === (modelVal || 'ocr-rapid-arabic'));
        const isReady = arabicMdl && mcReady(arabicMdl);
        if (!isReady) {
          warnEl.style.display = 'block';
          warnTxt.textContent = 'ℹ RapidOCR requires the Arabic & Persian model (11.3 MB). Download it below in Engines & keys > Offline.';
        } else {
          warnEl.style.display = 'none';
        }
      } else {
        warnEl.style.display = 'none';
      }
    }

    const badgeEl = $('stPersianStatusBadge');
    const descEl = $('stPersianStatusDesc');
    if (badgeEl && descEl) {
      const arabicMdl = (MC.models || []).find(m => m.id === 'ocr-rapid-arabic');
      const isRapidReady = arabicMdl && mcReady(arabicMdl);
      const isWinFa = Array.from($('stOcrLang')?.options || []).some(o => o.value.toLowerCase().startsWith('fa') && o.value !== 'auto');
      if (isRapidReady) {
        badgeEl.textContent = 'Ready (RapidOCR)';
        badgeEl.style.background = 'var(--success-bg, rgba(63, 185, 80, 0.15))';
        badgeEl.style.color = 'var(--success, #3FB950)';
        descEl.textContent = 'Persian deep learning recognition model (RapidOCR) is downloaded and ready.';
      } else if (isWinFa) {
        badgeEl.textContent = 'Ready (Windows OCR)';
        badgeEl.style.background = 'var(--success-bg, rgba(63, 185, 80, 0.15))';
        badgeEl.style.color = 'var(--success, #3FB950)';
        descEl.textContent = 'Windows Persian OCR language pack is installed and ready.';
      } else {
        badgeEl.textContent = 'Not installed';
        badgeEl.style.background = 'rgba(255, 180, 74, 0.15)';
        badgeEl.style.color = 'var(--warning, #FFB44A)';
        descEl.textContent = 'Persian OCR model is not downloaded. RapidOCR can recognize Persian after downloading the 11.3 MB model below.';
      }
    }
  }

  // Load and apply current screen translator configuration
  try {
    const cfgST = await window.makanDesktop.getScreenTransConfig();
    if (cfgST) {
      if ($('stEnable')) $('stEnable').value = cfgST.enabled ? '1' : '0';
      if ($('stOcrEngine') && cfgST.ocrEngine) $('stOcrEngine').value = cfgST.ocrEngine;
      if ($('stHotkey') && cfgST.hotkey) $('stHotkey').value = cfgST.hotkey;
      if ($('stFreezeFrame')) $('stFreezeFrame').value = cfgST.freezeFrame !== false ? '1' : '0';
      if ($('stClipboardWatcher')) $('stClipboardWatcher').value = cfgST.clipboardWatcher ? '1' : '0';
      if ($('stOcrLang') && cfgST.ocrLang) $('stOcrLang').value = cfgST.ocrLang;
      if ($('stTgtLang') && cfgST.targetLang) $('stTgtLang').value = cfgST.targetLang;
      if ($('stAutoCopy')) $('stAutoCopy').value = cfgST.autoCopy ? '1' : '0';
      if ($('stSaveHist')) $('stSaveHist').value = cfgST.saveHistory ? '1' : '0';
      if ($('stReturnToApp')) $('stReturnToApp').value = cfgST.returnToAppAfterCapture ? '1' : '0';
      if ($('screenTgtLang') && cfgST.targetLang) $('screenTgtLang').value = cfgST.targetLang;
      if ($('screenSrcLang') && cfgST.ocrLang) $('screenSrcLang').value = cfgST.ocrLang;
      if (typeof window.setScreenMode === 'function') {
        if (cfgST.clipboardWatcher) {
          window.setScreenMode('clip');
        } else if (cfgST.freezeFrame) {
          window.setScreenMode('freeze');
        } else {
          window.setScreenMode('region');
        }
      }
      renderOcrModels(cfgST.ocrModel || 'ocr-rapid-arabic');
    } else {
      renderOcrModels('ocr-rapid-arabic');
    }
  } catch {
    renderOcrModels('ocr-rapid-arabic');
  }
  updateActiveReadingStatus();

  // Sync settings back to backend on change or Save
  async function persistStConfig() {
    updateActiveReadingStatus();
    try {
      await window.makanDesktop.saveScreenTransConfig({
        enabled: $('stEnable')?.value === '1',
        ocrEngine: $('stOcrEngine')?.value || 'auto',
        ocrModel: $('stOcrModel')?.value || 'ocr-rapid-arabic',
        hotkey: $('stHotkey')?.value || 'CommandOrControl+Shift+S',
        freezeFrame: $('stFreezeFrame')?.value === '1',
        clipboardWatcher: $('stClipboardWatcher')?.value === '1',
        ocrLang: $('stOcrLang')?.value || 'auto',
        targetLang: $('stTgtLang')?.value || 'fa',
        autoCopy: $('stAutoCopy')?.value === '1',
        saveHistory: $('stSaveHist')?.value === '1',
        returnToAppAfterCapture: $('stReturnToApp')?.value === '1'
      });
    } catch (e) {
      console.warn('[ScreenTranslator] Error saving config:', e);
    }
  }
  window._persistStConfig = persistStConfig;

  $('stEnable')?.addEventListener('change', persistStConfig);
  $('stOcrEngine')?.addEventListener('change', persistStConfig);
  $('stHotkey')?.addEventListener('change', persistStConfig);
  $('stFreezeFrame')?.addEventListener('change', persistStConfig);
  $('stClipboardWatcher')?.addEventListener('change', persistStConfig);
  $('stOcrLang')?.addEventListener('change', persistStConfig);
  $('stTgtLang')?.addEventListener('change', persistStConfig);
  $('stAutoCopy')?.addEventListener('change', persistStConfig);
  $('stSaveHist')?.addEventListener('change', persistStConfig);
  $('stReturnToApp')?.addEventListener('change', persistStConfig);
  $('btnSaveDone')?.addEventListener('click', persistStConfig);

  $('btnTestScreenTrans')?.addEventListener('click', () => {
    window.makanDesktop.startScreenTranslator();
  });

  // Handle translation requests forwarded from Screen Translator overlay
  window.makanDesktop.onExecuteScreenTranslation(async (payload) => {
    const { id, text, src, tgt, engine } = payload;
    try {
      let sourceLang = (!src || src === 'auto') ? ($('src')?.value === 'finglish' ? 'auto' : ($('src')?.value || 'auto')) : src;
      let targetLang = tgt || $('tgt')?.value || 'fa';
      const transEngine = engine || $('engine')?.value || 'auto';

      if (sourceLang !== 'auto' && sourceLang === targetLang) {
        targetLang = sourceLang === 'fa' ? 'en' : 'fa';
      }

      const rawTrimmed = String(text || '').trim();
      if (!rawTrimmed) {
        window.makanDesktop.sendScreenTranslationResponse({
          id,
          ok: true,
          translation: '',
          detectedSrc: sourceLang,
          engineUsed: transEngine
        });
        return;
      }

      // Check Translation Memory first
      if (typeof TranslationMemory !== 'undefined' && cfg.tm !== false) {
        try {
          const hit = await TranslationMemory.get({
            text: rawTrimmed,
            src: sourceLang,
            tgt: targetLang,
            modeClass: 'smart',
            tone: $('tone')?.value || '',
            subject: $('tSubject')?.value?.trim() || ''
          });
          if (hit && hit.translatedText) {
            window.makanDesktop.sendScreenTranslationResponse({
              id,
              ok: true,
              translation: hit.translatedText,
              detectedSrc: sourceLang,
              engineUsed: hit.corrected ? 'correction' : 'memory'
            });
            return;
          }
        } catch (_) {}
      }

      const lines = rawTrimmed.split('\n');
      const chain = (transEngine === 'auto')
        ? (typeof getSmartEngineChain === 'function' ? getSmartEngineChain() : (typeof getFastChain === 'function' ? getFastChain() : ['google']))
        : [transEngine];

      const r = await translateItems(lines, opts({
        chain,
        src: sourceLang,
        tgt: targetLang,
        engine: transEngine
      }));

      const outText = (r && r.out && r.out.join('\n')) || '';
      const usedEng = r?.used || (Array.isArray(chain) ? chain.join(', ') : transEngine);

      if (typeof saveToMemory === 'function' && outText) {
        try {
          saveToMemory({
            text: rawTrimmed,
            translatedText: outText,
            lines,
            out: r.out,
            src: sourceLang,
            tgt: targetLang,
            modeClass: 'smart',
            tone: $('tone')?.value || '',
            subject: $('tSubject')?.value?.trim() || ''
          });
        } catch (_) {}
      }

      // Optional: Save to history if configured
      const curCfg = await window.makanDesktop.getScreenTransConfig().catch(() => ({}));
      if (curCfg?.saveHistory && outText) {
        try {
          const h = store.get('hist', []);
          h.unshift({ ts: Date.now(), src: sourceLang, tgt: targetLang, e: usedEng, i: rawTrimmed, o: outText });
          if (h.length > 200) h.length = 200;
          store.set('hist', h);
          renderHist();
        } catch {}
      }

      window.makanDesktop.sendScreenTranslationResponse({
        id,
        ok: true,
        translation: outText,
        detectedSrc: sourceLang,
        engineUsed: usedEng
      });
    } catch (err) {
      console.warn('[ScreenTranslator] Primary translation engine failed, trying fallback:', err);
      try {
        const fallbackLines = String(text || '').trim().split('\n');
        const rFallback = await translateItems(fallbackLines, opts({
          chain: ['google'],
          src: src || 'auto',
          tgt: tgt || 'fa',
          engine: 'google'
        }));
        const outFallback = (rFallback && rFallback.out && rFallback.out.join('\n')) || '';
        if (outFallback) {
          window.makanDesktop.sendScreenTranslationResponse({
            id,
            ok: true,
            translation: outFallback,
            detectedSrc: src || 'auto',
            engineUsed: 'Google'
          });
          return;
        }
      } catch (_) {}

      window.makanDesktop.sendScreenTranslationResponse({
        id,
        ok: false,
        error: err?.message || 'Translation failed. Please retry or click Open in App.'
      });
    }
  });

  // Handle "Open in App" button from floating overlay
  window.makanDesktop.onLoadTranslationInput(({ text, src, tgt }) => {
    if ($('tIn')) {
      $('tIn').value = text || '';
      if (src && src !== 'auto') $('src').value = src;
      if (tgt) $('tgt').value = tgt;
      $('tIn').dispatchEvent(new Event('input'));
      document.querySelector('[data-tab=text]')?.click();
    }
  });
})();