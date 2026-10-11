/* ---------- MAKAN SCREEN TRANSLATOR (DESKTOP INTEGRATION) ---------- */
(async function initScreenTranslatorDesktop() {
  if (!window.makanDesktop?.isDesktop) return;

  // Show the header button and settings block in desktop environment
  const btnScreen = $('btnScreenTrans');
  const stSettingsBlock = $('screenTransSettingsBlock');
  if (btnScreen) btnScreen.style.display = 'inline-flex';
  if (stSettingsBlock) stSettingsBlock.hidden = false;

  btnScreen?.addEventListener('click', () => {
    window.makanDesktop.startScreenTranslator();
  });

  // Also support Ctrl+Shift+S keyboard shortcut inside the browser window
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) {
      e.preventDefault();
      window.makanDesktop.startScreenTranslator();
    }
  });

  // Populate installed OCR languages in settings
  const stOcrLang = $('stOcrLang');
  const stOcrHint = $('stOcrStatusHint');

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