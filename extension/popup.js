/**
 * MAKAN Translate - Popup Script (Manifest V3)
 */

document.addEventListener('DOMContentLoaded', async () => {
  let cfg = null;
  let currentHost = '';
  let activeTabId = null;

  // UI Strings
  const I18N = {
    en: {
      dir: 'ltr',
      langBtn: 'FA',
      title: 'MAKAN<b>Translate</b>',
      siteEnabled: 'Enabled on site',
      siteDisabled: 'Disabled on site',
      translatePage: 'Translate Page',
      restorePage: 'Show Original',
      lblEngine: 'Engine:',
      lblTone: 'Tone:',
      placeholder: 'Type or paste text to translate…',
      clear: 'Clear',
      translate: 'Translate',
      translating: 'Translating…',
      openApp: 'Open full Web App',
      copied: 'Copied!'
    },
    fa: {
      dir: 'rtl',
      langBtn: 'EN',
      title: 'مترجم <b>MAKAN</b>',
      siteEnabled: 'فعال در این سایت',
      siteDisabled: 'غیرفعال در این سایت',
      translatePage: 'ترجمه کل صفحه',
      restorePage: 'متن اصلی',
      lblEngine: 'موتور:',
      lblTone: 'لحن:',
      placeholder: 'متن را برای ترجمه تایپ یا پیست کنید…',
      clear: 'پاک کردن',
      translate: 'ترجمه',
      translating: 'در حال ترجمه…',
      openApp: 'باز کردن وب‌اپلیکیشن کامل',
      copied: 'کپی شد!'
    }
  };

  // Elements
  const pLangToggle = document.getElementById('pLangToggle');
  const pOptionsBtn = document.getElementById('pOptionsBtn');
  const pSiteToggle = document.getElementById('pSiteToggle');
  const pSiteLabel = document.getElementById('pSiteLabel');
  const pPageTransBtn = document.getElementById('pPageTransBtn');
  const pPageTransText = document.getElementById('pPageTransText');
  const pSrcLang = document.getElementById('pSrcLang');
  const pTgtLang = document.getElementById('pTgtLang');
  const pSwapLang = document.getElementById('pSwapLang');
  const pEngineSel = document.getElementById('pEngineSel');
  const pToneSel = document.getElementById('pToneSel');
  const pInputText = document.getElementById('pInputText');
  const pClearBtn = document.getElementById('pClearBtn');
  const pTransBtn = document.getElementById('pTransBtn');
  const pOutputWrap = document.getElementById('pOutputWrap');
  const pOutputEngine = document.getElementById('pOutputEngine');
  const pOutputText = document.getElementById('pOutputText');
  const pCopyBtn = document.getElementById('pCopyBtn');
  const pSpeakBtn = document.getElementById('pSpeakBtn');
  const pOpenWebApp = document.getElementById('pOpenWebApp');

  // Load active tab info
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]) {
      activeTabId = tabs[0].id;
      if (tabs[0].url && tabs[0].url.startsWith('http')) {
        currentHost = new URL(tabs[0].url).hostname;
      }
    }
  } catch {}

  // Load config directly from local storage with background fallback
  try {
    if (typeof loadConfig === 'function') {
      cfg = await loadConfig();
    }
  } catch {}
  if (!cfg) {
    try {
      if (window.chrome?.runtime?.sendMessage) {
        const res = await Promise.race([
          chrome.runtime.sendMessage({ action: 'get-config' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 300))
        ]);
        if (res && res.cfg) cfg = res.cfg;
      }
    } catch {}
  }
  if (!cfg) {
    cfg = typeof DEFAULT_CFG !== 'undefined' ? JSON.parse(JSON.stringify(DEFAULT_CFG)) : {};
  }

  // Check site access permissions (Firefox MV3 optional host permissions)
  try {
    if (chrome.permissions?.contains && chrome.permissions?.request) {
      const hasPerm = await chrome.permissions.contains({
        origins: ['*://*/*']
      });
      const permBanner = document.getElementById('pPermBanner');
      const permBtn = document.getElementById('pPermBtn');
      if (!hasPerm && permBanner && permBtn) {
        permBanner.style.display = 'flex';
        permBtn.onclick = async () => {
          try {
            const granted = await chrome.permissions.request({
              origins: ['*://*/*']
            });
            if (granted) {
              permBanner.style.display = 'none';
              if (activeTabId && chrome.runtime?.sendMessage) {
                chrome.runtime.sendMessage({ action: 'inject-tab', tabId: activeTabId }).catch(() => {});
              }
            }
          } catch (e) {
            console.warn('Permission request error:', e);
          }
        };
      }
    }
  } catch {}

  let currentUi = cfg.ui || 'en';

  function applyUi(lang) {
    currentUi = lang;
    document.body.dir = I18N[lang].dir;
    pLangToggle.textContent = I18N[lang].langBtn;
    document.querySelector('.p-title').innerHTML = I18N[lang].title;
    document.getElementById('lblEngine').textContent = I18N[lang].lblEngine;
    document.getElementById('lblTone').textContent = I18N[lang].lblTone;
    pInputText.placeholder = I18N[lang].placeholder;
    pClearBtn.textContent = I18N[lang].clear;
    pTransBtn.textContent = I18N[lang].translate;
    pPageTransText.textContent = I18N[lang].translatePage;
    pOpenWebApp.querySelector('span').textContent = I18N[lang].openApp;
    updateSiteLabel();
  }

  function updateSiteLabel() {
    const isOff = currentHost && cfg.disabledSites?.includes(currentHost);
    pSiteLabel.textContent = isOff ? I18N[currentUi].siteDisabled : I18N[currentUi].siteEnabled;
    pSiteToggle.checked = !isOff;
  }

  // Populate Languages
  pSrcLang.innerHTML = '<option value="auto">Auto-detect</option>';
  pTgtLang.innerHTML = '';
  LANGS.forEach(([code, name, faName]) => {
    const label = currentUi === 'fa' ? faName : name;
    pSrcLang.innerHTML += `<option value="${code}">${label}</option>`;
    pTgtLang.innerHTML += `<option value="${code}">${label}</option>`;
  });

  pSrcLang.value = cfg.src || 'auto';
  pTgtLang.value = cfg.tgt || 'fa';

  // Populate Engines
  pEngineSel.innerHTML = '<option value="auto">Auto (Best available)</option>';
  cfg.order.forEach(id => {
    if (ENG[id]) {
      pEngineSel.innerHTML += `<option value="${id}">${ENG[id].name}</option>`;
    }
  });

  pToneSel.value = cfg.tone || 'neutral';

  applyUi(currentUi);

  // Set web app link
  const appBase = cfg.webAppUrl || 'http://localhost:8080';
  pOpenWebApp.href = appBase;

  // Toggle UI language
  pLangToggle.onclick = async () => {
    const next = currentUi === 'en' ? 'fa' : 'en';
    cfg.ui = next;
    await chrome.runtime.sendMessage({ action: 'save-config', cfg });
    applyUi(next);
  };

  // Open Options page
  pOptionsBtn.onclick = () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  };

  // Toggle site enabled
  pSiteToggle.onchange = async () => {
    if (!currentHost) return;
    const resp = await chrome.runtime.sendMessage({ action: 'toggle-site-disabled', host: currentHost });
    if (resp && resp.ok) {
      cfg.disabledSites = cfg.disabledSites || [];
      const idx = cfg.disabledSites.indexOf(currentHost);
      if (idx >= 0) cfg.disabledSites.splice(idx, 1);
      else cfg.disabledSites.push(currentHost);
      updateSiteLabel();
    }
  };

  // Swap languages
  pSwapLang.onclick = () => {
    const oldSrc = pSrcLang.value;
    const oldTgt = pTgtLang.value;
    if (oldSrc === 'auto') {
      pSrcLang.value = oldTgt;
      pTgtLang.value = 'en';
    } else {
      pSrcLang.value = oldTgt;
      pTgtLang.value = oldSrc;
    }
    cfg.src = pSrcLang.value;
    cfg.tgt = pTgtLang.value;
    chrome.runtime.sendMessage({ action: 'save-config', cfg });
  };

  pSrcLang.onchange = () => {
    cfg.src = pSrcLang.value;
    chrome.runtime.sendMessage({ action: 'save-config', cfg });
  };

  pTgtLang.onchange = () => {
    cfg.tgt = pTgtLang.value;
    chrome.runtime.sendMessage({ action: 'save-config', cfg });
  };

  pToneSel.onchange = () => {
    cfg.tone = pToneSel.value;
    chrome.runtime.sendMessage({ action: 'save-config', cfg });
  };

  // Clear text
  pClearBtn.onclick = () => {
    pInputText.value = '';
    pOutputWrap.hidden = true;
    pInputText.focus();
  };

  // Translate
  async function doTranslate() {
    const text = pInputText.value.trim();
    if (!text) return;

    pTransBtn.disabled = true;
    pTransBtn.textContent = I18N[currentUi].translating;
    pOutputWrap.hidden = false;
    pOutputText.innerHTML = '<span style="color:var(--muted)">Translating…</span>';
    pOutputEngine.textContent = '…';

    try {
      let resp = null;
      if (window.chrome?.runtime?.sendMessage) {
        try {
          resp = await chrome.runtime.sendMessage({
            action: 'translate-text',
            items: [text],
            src: pSrcLang.value,
            tgt: pTgtLang.value,
            engine: pEngineSel.value,
            tone: pToneSel.value
          });
        } catch {}
      }

      if (!resp && typeof MakanEngine !== 'undefined') {
        const r = await MakanEngine.translateText([text], pSrcLang.value, pTgtLang.value, cfg, {
          engineName: pEngineSel.value,
          tone: pToneSel.value
        });
        resp = { ok: true, results: r.results, engineName: r.engineName };
      }

      if (resp && resp.ok && resp.results?.length) {
        const out = resp.results[0];
        pOutputText.textContent = out;
        pOutputText.dir = isRtlLang(pTgtLang.value) ? 'rtl' : 'ltr';
        pOutputEngine.textContent = resp.engineName || 'Translated';

        // Update full app link with query
        pOpenWebApp.href = `${appBase.replace(/\/+$/, '')}/?text=${encodeURIComponent(text)}&src=${encodeURIComponent(pSrcLang.value)}&tgt=${encodeURIComponent(pTgtLang.value)}`;
      } else {
        throw new Error(resp?.error || 'Translation failed');
      }
    } catch (err) {
      pOutputText.innerHTML = `<span style="color:var(--err)">⚠️ ${err.message}</span>`;
    } finally {
      pTransBtn.disabled = false;
      pTransBtn.textContent = I18N[currentUi].translate;
    }
  }

  pTransBtn.onclick = doTranslate;
  pInputText.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      doTranslate();
    }
  });

  // Copy Output
  pCopyBtn.onclick = async () => {
    const text = pOutputText.textContent;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      const origHtml = pCopyBtn.innerHTML;
      pCopyBtn.innerHTML = `<span style="font-size:10px;color:var(--ok)">✓</span>`;
      setTimeout(() => pCopyBtn.innerHTML = origHtml, 1500);
    } catch {}
  };

  // Speak Output (TTS) with language-matching voice, Gemini fallback, visible playing state and second-click stop
  let pSpeakToken = 0;
  let isPopupSpeaking = false;

  function stopPopupSpeech() {
    pSpeakToken++;
    isPopupSpeaking = false;
    pSpeakBtn.classList.remove('preparing', 'playing');
    pSpeakBtn.setAttribute('title', 'Read aloud');
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch {}
    try { chrome.runtime.sendMessage({ action: 'stop-tts' }).catch(() => {}); } catch {}
  }

  // Listen for background TTS state transitions
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((req) => {
        if (req.target === 'makan-ui' && req.action === 'tts-state-update') {
          if (req.state === 'playing') {
            pSpeakBtn.classList.remove('preparing');
            pSpeakBtn.classList.add('playing');
            pSpeakBtn.setAttribute('title', 'Stop read-aloud');
          } else if (req.state === 'ended' || req.state === 'stopped' || req.state === 'error') {
            isPopupSpeaking = false;
            pSpeakBtn.classList.remove('preparing', 'playing');
            pSpeakBtn.setAttribute('title', 'Read aloud');
          }
        }
      });
    }
  } catch {}

  pSpeakBtn.onclick = async () => {
    const text = pOutputText.textContent;
    if (!text || text === '…' || text.startsWith('⚠️')) return;

    if (isPopupSpeaking) {
      stopPopupSpeech();
      return;
    }

    stopPopupSpeech();
    const token = ++pSpeakToken;
    isPopupSpeaking = true;
    pSpeakBtn.classList.add('preparing');
    pSpeakBtn.classList.remove('playing');
    pSpeakBtn.setAttribute('title', 'Preparing voice... (Click to stop)');

    const cleanup = () => {
      if (token === pSpeakToken) {
        isPopupSpeaking = false;
        pSpeakBtn.classList.remove('preparing', 'playing');
        pSpeakBtn.setAttribute('title', 'Read aloud');
      }
    };

    const targetLang = pTgtLang.value;
    const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    const voice = typeof pickBestVoice === 'function' ? pickBestVoice(targetLang, voices, cfg.tts?.voices) : null;
    const preferGemini = !!cfg.tts?.preferGemini;

    // Remove any previous voice notice
    const oldNotice = pOutputWrap.querySelector('.p-voice-notice');
    if (oldNotice) oldNotice.remove();

    if (preferGemini || !voice) {
      let ttsRes = null;
      try {
        ttsRes = await chrome.runtime.sendMessage({
          action: 'play-gemini-tts',
          text,
          voice: cfg.tts?.geminiVoice,
          rate: cfg.tts?.rate
        });
      } catch {}

      if (token !== pSpeakToken) return;

      if (ttsRes && ttsRes.ok) {
        if (ttsRes.audioDataUrl) {
          try {
            const a = new Audio(ttsRes.audioDataUrl);
            if (cfg.tts?.rate) a.playbackRate = cfg.tts.rate;
            a.onended = cleanup;
            a.onerror = cleanup;
            await a.play();
            return;
          } catch {
            cleanup();
            return;
          }
        }
        const check = setInterval(() => {
          if (token !== pSpeakToken) {
            clearInterval(check);
            cleanup();
          }
        }, 400);
        return;
      }

      if (voice) {
        // Fallback to local voice if Gemini key was missing but user preferred Gemini
      } else {
        // NEVER speak with a mismatched language voice
        cleanup();
        const notice = document.createElement('div');
        notice.className = 'p-voice-notice';
        notice.textContent = typeof getNoVoiceMessage === 'function'
          ? getNoVoiceMessage(targetLang, currentUi)
          : `No voice installed for ${targetLang}. Configure Gemini API key in Options for AI voice.`;
        pOutputWrap.appendChild(notice);
        setTimeout(() => { if (notice.parentNode) notice.remove(); }, 8000);
        return;
      }
    }

    if (!window.speechSynthesis) {
      cleanup();
      return;
    }

    const chunks = typeof splitTextForSpeech === 'function' ? splitTextForSpeech(text, 180) : [text];
    let idx = 0;

    function speakNext() {
      if (token !== pSpeakToken || idx >= chunks.length) {
        cleanup();
        return;
      }
      const u = new SpeechSynthesisUtterance(chunks[idx++]);
      u.voice = voice;
      u.lang = voice.lang || targetLang;
      u.rate = cfg.tts?.rate || 1.0;
      u.onstart = () => {
        if (token === pSpeakToken) {
          pSpeakBtn.classList.remove('preparing');
          pSpeakBtn.classList.add('playing');
        }
      };
      u.onend = () => { if (token === pSpeakToken) speakNext(); };
      u.onerror = () => cleanup();
      window.speechSynthesis.speak(u);
    }

    speakNext();
  };

  // Translate Entire Page Button
  pPageTransBtn.onclick = async () => {
    if (!activeTabId) return;
    chrome.tabs.sendMessage(activeTabId, { action: 'page-translate-toggle' }).catch(() => {});
    window.close(); // Close popup so user sees page translation
  };
});
