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
      lblMode: 'Mode:',
      fastLabel: 'Fast',
      showImproved: 'Show improved',
      aiRateLimited: 'AI rate limited',
      aiUnavailable: 'AI unavailable',
      placeholder: 'Type or paste text to translate…',
      clear: 'Clear',
      translate: 'Translate',
      translating: 'Translating…',
      fgSpelling: 'Persian spelling', fgCopy: 'Copy', fgVia: 'Finglish → Persian', fgOpt: 'Finglish · Persian in Latin letters',
      fgNeedsAi: 'Finglish (Persian written in Latin letters) needs an AI engine. Add a free Gemini or Groq key in Options.',
      openApp: 'Open in Windows app',
      openAppDesc: 'all features, OCR, offline models',
      openBrowser: 'Open in browser',
      openBrowserDesc: 'opens the web app at the Web App URL (makanlab.tech), uses your browser (Chrome on-device translation works in Chrome)',
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
      lblMode: 'حالت:',
      fastLabel: 'سریع',
      showImproved: 'نمایش نسخه بهتر',
      aiRateLimited: 'محدودیت نرخ هوش مصنوعی',
      aiUnavailable: 'هوش مصنوعی در دسترس نیست',
      placeholder: 'متن را برای ترجمه تایپ یا پیست کنید…',
      clear: 'پاک کردن',
      translate: 'ترجمه',
      translating: 'در حال ترجمه…',
      fgSpelling: 'املای فارسی', fgCopy: 'کپی', fgVia: 'فینگلیش ← فارسی', fgOpt: 'فینگلیش · فارسی با حروف لاتین',
      fgNeedsAi: 'فینگلیش (فارسی با حروف لاتین) به یک موتور هوش مصنوعی نیاز دارد. در تنظیمات یک کلید رایگان Gemini یا Groq اضافه کنید.',
      openApp: 'باز کردن در برنامه ویندوز',
      openAppDesc: 'تمام امکانات، OCR، مدل‌های آفلاین',
      openBrowser: 'باز کردن در مرورگر',
      openBrowserDesc: 'باز کردن برنامه تحت وب (makanlab.tech)، استفاده از مرورگر (مترجم داخلی کروم در کروم)',
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
  const pModeSel = document.getElementById('pModeSel');
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
  const pOpenBrowser = document.getElementById('pOpenBrowser');

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

  // Pages where the browser itself forbids extensions: say so in one line.
  try {
    const tab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
    const url = (tab && tab.url) || '';
    const isFirefox = /Firefox\//.test(navigator.userAgent);
    const restricted = !tab || !url
      || /^(chrome|edge|brave|opera|vivaldi|about|view-source|devtools|chrome-search|chrome-untrusted|chrome-extension|moz-extension|edge-extension):/i.test(url)
      || /^https:\/\/(chromewebstore\.google\.com|microsoftedge\.microsoft\.com\/addons)\b/i.test(url)
      || /^https:\/\/chrome\.google\.com\/webstore/i.test(url)
      || (isFirefox && /^https:\/\/(addons\.mozilla\.org|accounts\.firefox\.com|support\.mozilla\.org)\b/i.test(url));
    if (restricted) {
      const box = document.getElementById('pRestricted');
      document.getElementById('pRestrictedText').textContent = "The browser doesn't allow extensions on this page, so the on-page card and Translate Page are off here. The box below still works.";
      box.hidden = false;
      document.getElementById('pPageTransBtn').disabled = true;
      document.getElementById('pSiteToggle').disabled = true;
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
    if (document.getElementById('lblMode')) document.getElementById('lblMode').textContent = I18N[lang].lblMode;
    pInputText.placeholder = I18N[lang].placeholder;
    pClearBtn.textContent = I18N[lang].clear;
    pTransBtn.textContent = I18N[lang].translate;
    pPageTransText.textContent = I18N[lang].translatePage;
    if (pOpenWebApp) {
      const sp = pOpenWebApp.querySelector('span');
      if (sp) sp.textContent = I18N[lang].openApp;
    }
    const pOpenAppDesc = document.getElementById('pOpenAppDesc');
    if (pOpenAppDesc) pOpenAppDesc.textContent = I18N[lang].openAppDesc;
    if (pOpenBrowser) {
      const sp = pOpenBrowser.querySelector('span');
      if (sp) sp.textContent = I18N[lang].openBrowser;
    }
    const pOpenBrowserDesc = document.getElementById('pOpenBrowserDesc');
    if (pOpenBrowserDesc) pOpenBrowserDesc.textContent = I18N[lang].openBrowserDesc;
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
  pSrcLang.innerHTML += `<option value="finglish">${I18N[currentUi].fgOpt}</option>`;

  pSrcLang.value = cfg.src || 'auto';
  pTgtLang.value = cfg.tgt || 'fa';

  // Mode Selection
  const hasAi = cfg.order?.some(id => ENG[id]?.ai && (typeof isEngineUsable === 'function' ? isEngineUsable(id, cfg) : (cfg.eng?.[id]?.on && cfg.eng?.[id]?.key)) && (ENG[id]?.key ? Boolean(cfg.eng?.[id]?.key) : (id === 'custom' ? Boolean(cfg.eng?.[id]?.base) : false)));
  const defaultMode = cfg.transMode || (hasAi ? 'both' : 'fast');
  if (pModeSel) {
    pModeSel.value = defaultMode;
    pModeSel.onchange = () => {
      cfg.transMode = pModeSel.value;
      chrome.runtime.sendMessage({ action: 'save-config', cfg });
    };
  }

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
  function updateOpenWebAppHref(inputText) {
    if (!pOpenWebApp && !pOpenBrowser) return;
    const t = (inputText != null ? inputText : pInputText.value || '').trim();
    if (t) {
      const p = new URLSearchParams();
      p.set('text', t.slice(0, 2000));
      p.set('src', pSrcLang.value || 'auto');
      p.set('tgt', pTgtLang.value || 'fa');
      const targetHref = `${appBase.replace(/\/+$/, '')}/#${p.toString()}`;
      if (pOpenWebApp) pOpenWebApp.href = targetHref;
      if (pOpenBrowser) pOpenBrowser.href = targetHref;
    } else {
      if (pOpenWebApp) pOpenWebApp.href = appBase;
      if (pOpenBrowser) pOpenBrowser.href = appBase;
    }
  }
  updateOpenWebAppHref();
  pInputText.addEventListener('input', () => updateOpenWebAppHref());
  pSrcLang.addEventListener('change', () => updateOpenWebAppHref());
  pTgtLang.addEventListener('change', () => updateOpenWebAppHref());

  if (pOpenBrowser) {
    pOpenBrowser.addEventListener('click', (e) => {
      e.preventDefault();
      window.open(pOpenBrowser.href, '_blank');
    });
  }

  pOpenWebApp.addEventListener('click', async (e) => {
    e.preventDefault();
    const t = (pInputText.value || '').trim();
    let resp = null;
    try {
      resp = await chrome.runtime.sendMessage({
        action: 'open-in-app',
        text: t.slice(0, 2000),
        src: pSrcLang.value || 'auto',
        tgt: pTgtLang.value || 'fa'
      });
    } catch {}

    if (resp && resp.via === 'exe') {
      try {
        const msg = document.getElementById('pOpenAppMsg');
        if (msg) {
          msg.textContent = (currentUi === 'fa' || cfg?.ui === 'fa') ? 'در MAKAN Translate باز شد' : 'Opened in MAKAN Translate';
          msg.style.display = 'block';
          clearTimeout(msg._timer);
          msg._timer = setTimeout(() => { msg.style.display = 'none'; }, 2500);
        }
      } catch {}
    } else {
      window.open(pOpenWebApp.href, '_blank');
    }
  });

  // Toggle UI language
  pLangToggle.onclick = async () => {
    const next = currentUi === 'en' ? 'fa' : 'en';
    cfg.ui = next;
    applyUi(next);
    await chrome.runtime.sendMessage({ action: 'save-config', cfg });
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
    if (oldSrc === 'auto' || oldSrc === 'finglish') {
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
    const rawText = pInputText.value.trim();
    if (!rawText) return;

    pTransBtn.disabled = true;
    pTransBtn.textContent = I18N[currentUi].translating;
    pOutputWrap.hidden = false;
    pOutputText.innerHTML = '<span style="color:var(--muted)">Translating…</span>';
    pOutputEngine.textContent = '…';

    // Finglish: one AI request turns it into Persian script, shown above the result; the translation starts from it.
    const pFg = document.getElementById('pFg');
    pFg.hidden = true;
    let text = rawText, srcCode = pSrcLang.value;
    {
      let fg = null;
      try { fg = await askBackground({ action: 'finglish', text: rawText, src: srcCode }); } catch {}
      if (fg && fg.ok && fg.kind === 'needs-ai') {
        pOutputText.textContent = I18N[currentUi].fgNeedsAi; pOutputText.dir = currentUi === 'fa' ? 'rtl' : 'ltr';
        pOutputEngine.textContent = 'Finglish'; pTransBtn.disabled = false; pTransBtn.textContent = I18N[currentUi].translate;
        return;
      }
      if (fg && fg.ok && fg.kind === 'ok') {
        pFg.textContent = '';
        const lab = document.createElement('span'); lab.className = 'p-fg-lab'; lab.textContent = I18N[currentUi].fgSpelling;
        const fgText = document.createElement('span'); fgText.className = 'p-fg-text'; fgText.dir = 'rtl'; fgText.lang = 'fa'; fgText.textContent = fg.persian;
        const fgBtn = document.createElement('button'); fgBtn.type = 'button'; fgBtn.className = 'p-icon-btn p-fg-copy'; fgBtn.textContent = I18N[currentUi].fgCopy;
        fgBtn.onclick = () => navigator.clipboard?.writeText(fg.persian).catch(() => {});
        pFg.append(lab, fgText, fgBtn); pFg.hidden = false;
        text = fg.persian; srcCode = 'fa';
        if (pTgtLang.value === 'fa') {
          pOutputText.textContent = fg.persian; pOutputText.dir = 'rtl';
          pOutputEngine.textContent = `${I18N[currentUi].fgVia} · ${fg.engineName || 'AI'}`;
          pTransBtn.disabled = false; pTransBtn.textContent = I18N[currentUi].translate;
          return;
        }
      } else if (srcCode === 'finglish') {
        srcCode = 'auto';
      }
    }

    const hasAiAvailable = cfg.order?.some(id => ENG[id]?.ai && (typeof isEngineUsable === 'function' ? isEngineUsable(id, cfg) : (cfg.eng?.[id]?.on && cfg.eng?.[id]?.key)) && (ENG[id]?.key ? Boolean(cfg.eng?.[id]?.key) : (id === 'custom' ? Boolean(cfg.eng?.[id]?.base) : false)));
    const mode = pModeSel?.value || (hasAiAvailable ? 'both' : 'fast');
    let userInteractedWithFast = false;
    const markInteracted = () => { userInteractedWithFast = true; };
    pOutputText.addEventListener('copy', markInteracted, { once: true });
    pCopyBtn.addEventListener('click', markInteracted, { once: true });

    try {
      if (mode === 'fast' || (mode === 'both' && !hasAiAvailable)) {
        let resp = null;
        resp = await askBackground({
              action: 'translate-text',
              items: [text],
              src: srcCode,
              tgt: pTgtLang.value,
              mode: 'fast'
            });
        if (!resp && typeof MakanEngine !== 'undefined') {
          const r = await MakanEngine.translateText([text], srcCode, pTgtLang.value, cfg, { mode: 'fast' });
          resp = { ok: true, results: r.results, engineName: r.engineName };
        }
        if (resp && resp.ok && resp.results?.length) {
          pOutputText.textContent = resp.results[0];
          pOutputText.dir = isRtlLang(pTgtLang.value) ? 'rtl' : 'ltr';
          pOutputEngine.textContent = resp.engineName || 'Translated';
          updateOpenWebAppHref(rawText);
        } else {
          throw new Error(plainFailure(resp?.error));
        }
      } else if (mode === 'smart') {
        let resp = null;
        resp = await askBackground({
              action: 'translate-text',
              items: [text],
              src: srcCode,
              tgt: pTgtLang.value,
              engine: pEngineSel.value,
              tone: pToneSel.value,
              mode: 'smart'
            });
        if (!resp && typeof MakanEngine !== 'undefined') {
          const r = await MakanEngine.translateText([text], srcCode, pTgtLang.value, cfg, {
            engineName: pEngineSel.value,
            tone: pToneSel.value,
            mode: 'smart'
          });
          resp = { ok: true, results: r.results, engineName: r.engineName };
        }
        if (resp && resp.ok && resp.results?.length) {
          pOutputText.textContent = resp.results[0];
          pOutputText.dir = isRtlLang(pTgtLang.value) ? 'rtl' : 'ltr';
          pOutputEngine.textContent = resp.engineName || 'Translated';
          updateOpenWebAppHref(rawText);
        } else {
          throw new Error(plainFailure(resp?.error));
        }
      } else {
        // Both mode: start fast and smart concurrently
        let fastDone = false, smartDone = false;
        let fastRes = '', fastEngine = '';
        let smartRes = '', smartEngine = '';
        let fastErr = null, smartErr = null;

        const fastReq = askBackground({
          action: 'translate-text',
          items: [text],
          src: srcCode,
          tgt: pTgtLang.value,
          mode: 'fast'
        }).then(resp => {
          if (resp && resp.ok && resp.results?.length) {
            fastRes = resp.results[0];
            fastEngine = resp.engineName || 'Fast';
            fastDone = true;
            if (!smartDone) {
              pOutputText.textContent = fastRes;
              pOutputText.dir = isRtlLang(pTgtLang.value) ? 'rtl' : 'ltr';
              pOutputEngine.innerHTML = `<span class="pill-fast" style="font-size:10px;padding:1px 5px;background:rgba(255,190,83,0.18);color:#ffbe53;border-radius:4px;font-weight:600;">${I18N[currentUi].fastLabel}</span> · ${fastEngine}`;
            }
          } else {
            throw new Error(plainFailure(resp?.error));
          }
          return resp;
        }).catch(e => {
          fastDone = true;
          fastErr = e;
          throw e;
        });

        const smartReq = askBackground({
          action: 'translate-text',
          items: [text],
          src: srcCode,
          tgt: pTgtLang.value,
          engine: pEngineSel.value,
          tone: pToneSel.value,
          mode: 'smart'
        }).then(resp => {
          if (resp && resp.ok && resp.results?.length) {
            smartRes = resp.results[0];
            smartEngine = resp.engineName || 'AI';
            smartDone = true;
            if (userInteractedWithFast && fastRes) {
              let showBtn = document.getElementById('pShowImproved');
              if (!showBtn) {
                showBtn = document.createElement('button');
                showBtn.id = 'pShowImproved';
                showBtn.className = 'p-mini-sel';
                showBtn.style.cursor = 'pointer';
                showBtn.style.color = 'var(--cyan, #06b6d4)';
                showBtn.style.borderColor = 'var(--cyan, #06b6d4)';
                showBtn.textContent = I18N[currentUi].showImproved;
                pOutputEngine.appendChild(document.createTextNode(' '));
                pOutputEngine.appendChild(showBtn);
              }
              showBtn.onclick = () => {
                pOutputText.classList.add('calm-fade');
                setTimeout(() => pOutputText.classList.remove('calm-fade'), 400);
                pOutputText.textContent = smartRes;
                pOutputText.dir = isRtlLang(pTgtLang.value) ? 'rtl' : 'ltr';
                pOutputEngine.textContent = smartEngine;
                showBtn.remove();
              };
            } else {
              pOutputText.classList.add('calm-fade');
              setTimeout(() => pOutputText.classList.remove('calm-fade'), 400);
              pOutputText.textContent = smartRes;
              pOutputText.dir = isRtlLang(pTgtLang.value) ? 'rtl' : 'ltr';
              pOutputEngine.textContent = smartEngine;
            }
            updateOpenWebAppHref(rawText);
          } else {
            throw new Error(plainFailure(resp?.error));
          }
          return resp;
        }).catch(err => {
          smartDone = true;
          smartErr = err;
          if (fastRes) {
            const is429 = /429|resource_exhausted|rate limit|quota/i.test(err.message || '');
            const reason = is429 ? I18N[currentUi].aiRateLimited : I18N[currentUi].aiUnavailable;
            pOutputEngine.textContent = `${I18N[currentUi].fastLabel} (${fastEngine}) · ${reason}`;
          } else {
            throw err;
          }
        });

        await Promise.allSettled([fastReq, smartReq]);
        if (!fastRes && !smartRes) {
          throw smartErr || fastErr || new Error(plainFailure(''));
        }
      }
    } catch (err) {
      // Provider messages are plain text, never page markup.
      const why = plainFailure(err);
      const msg = document.createElement('span');
      msg.className = 'p-err';
      msg.textContent = '⚠️ Translation failed: ' + why;
      const nodes = [msg];
      if (failureNeedsOptions(why)) {
        const b = document.createElement('button');
        b.className = 'p-page-btn';
        b.id = 'pErrOptions';
        b.textContent = 'Open Options';
        b.onclick = () => { try { chrome.runtime.openOptionsPage(); } catch {} };
        nodes.push(document.createElement('br'), b);
      }
      pOutputText.replaceChildren(...nodes);
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
  // Gemini voice plays in the background and each speech there has a number. Updates about other
  // speeches (an older one stopping, one in a web page) must not change this button.
  let popupBackendToken = null;
  let popupWaitingForStart = false;
  let popupHeldStates = [];
  let popupLastSpeak = null; // for a playback error that arrives after the background accepted the request

  function stopPopupSpeech(tellBackground = true) {
    pSpeakToken++;
    isPopupSpeaking = false;
    popupBackendToken = null;
    popupWaitingForStart = false;
    popupHeldStates = [];
    pSpeakBtn.classList.remove('preparing', 'playing');
    pSpeakBtn.setAttribute('title', 'Read aloud');
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch {}
    if (tellBackground) {
      try { chrome.runtime.sendMessage({ action: 'stop-tts' }).catch(() => {}); } catch {}
    }
  }

  function applyPopupTtsState(req) {
    if (req.state === 'playing') {
      pSpeakBtn.classList.remove('preparing');
      pSpeakBtn.classList.add('playing');
      pSpeakBtn.setAttribute('title', 'Stop read-aloud');
    } else if (req.state === 'ended' || req.state === 'stopped' || req.state === 'error') {
      if (req.state === 'error' && popupLastSpeak && popupLastSpeak.token === pSpeakToken) popupLastSpeak.fail(req.error);
      isPopupSpeaking = false;
      popupBackendToken = null;
      pSpeakBtn.classList.remove('preparing', 'playing');
      pSpeakBtn.setAttribute('title', 'Read aloud');
    }
  }

  // Listen for background TTS state transitions
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((req) => {
        if (req && req.target === 'makan-ui' && req.action === 'tts-state-update') {
          if (popupWaitingForStart) { popupHeldStates.push(req); return; }
          // Only follow the background's speech if it is ours (a device voice speaks without the background).
          if (popupBackendToken === null || req.token !== popupBackendToken) return;
          applyPopupTtsState(req);
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

    // Starting a new speech: the background replaces any earlier one itself, so do not send a stop
    // that could arrive after the new speech began.
    stopPopupSpeech(false);
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
    const retrySpeak = () => pSpeakBtn.onclick();
    const hasVisibleErrorNotice = () => {
      const notices = pOutputWrap.querySelectorAll('.p-voice-notice');
      for (const n of notices) {
        if (n.dataset.kind === 'error' || n.querySelector('.p-voice-retry:not([title="Dismiss"])') || (n.textContent && !n.textContent.startsWith('Microsoft Edge'))) {
          return true;
        }
      }
      return false;
    };

    // text: one plain line; retry: shows a Retry button; onClose: called when dismissed.
    const notify = (text, retry, onClose, isError = false) => {
      if (!isError) {
        if (hasVisibleErrorNotice()) return null;
      }
      pOutputWrap.querySelectorAll('.p-voice-notice').forEach(n => n.remove());

      const n = document.createElement('div');
      n.className = 'p-voice-notice';
      n.dataset.kind = isError ? 'error' : 'hint';
      const m = document.createElement('span');
      m.textContent = text;
      n.appendChild(m);
      if (retry) {
        const b = document.createElement('button');
        b.className = 'p-voice-retry';
        b.textContent = 'Retry';
        b.onclick = () => { n.remove(); retry(); };
        n.appendChild(b);
      }
      const x = document.createElement('button');
      x.className = 'p-voice-retry';
      x.textContent = '✕';
      x.title = 'Dismiss';
      x.onclick = () => { n.remove(); if (onClose) onClose(); };
      n.appendChild(x);
      pOutputWrap.appendChild(n);
      return n;
    };

    popupLastSpeak = { token, fail: err => notify('Gemini voice: ' + plainFailure(err), retrySpeak, null, true) };
    const isEdgeBrowser = /\bEdg\//.test(navigator.userAgent || '');
    const usedLine = label => {
      let u = pOutputWrap.querySelector('.p-voice-used');
      if (!u) { u = document.createElement('div'); u.className = 'p-voice-used'; pOutputWrap.appendChild(u); }
      u.textContent = label ? 'Voice: ' + label : '';
    };

    if (preferGemini || !voice) {
      let ttsRes = null;
      popupWaitingForStart = true;
      popupHeldStates = [];
      usedLine(`Gemini (${cfg.tts?.geminiVoice || 'Kore'})`);
      ttsRes = await askBackground({
        action: 'play-gemini-tts',
        text,
        voice: cfg.tts?.geminiVoice,
        rate: cfg.tts?.rate
      });
      popupWaitingForStart = false;

      if (token !== pSpeakToken) return;

      if (ttsRes && ttsRes.ok) {
        popupBackendToken = typeof ttsRes.token === 'number' ? ttsRes.token : null;
        const held = popupHeldStates;
        popupHeldStates = [];
        for (const st of held) if (popupBackendToken !== null && st.token === popupBackendToken) applyPopupTtsState(st);
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
        if (isPopupSpeaking && !voice && !isEdgeBrowser && !cfg.edgeHintOff) {
          notify('Microsoft Edge has built-in natural voices for this language.', null, () => {
            cfg.edgeHintOff = true;
            chrome.runtime.sendMessage({ action: 'dismiss-edge-hint' }).catch(() => {});
          }, false);
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
        usedLine('');
        if (/not configured|key missing/i.test(String(ttsRes?.error || ''))) {
          notify((typeof getNoVoiceMessage === 'function'
            ? getNoVoiceMessage(targetLang, currentUi)
            : `No voice installed for ${targetLang}. Configure Gemini API key in Options for AI voice.`) + (!isEdgeBrowser ? ' Microsoft Edge has built-in natural voices for this language.' : ''), null, null, true);
        } else {
          notify('Gemini voice: ' + plainFailure(ttsRes?.error), retrySpeak, null, true);
        }
        return;
      }
    }

    usedLine(`${voice.name} (device)`);
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

  // Report a bug link
  const pReportBugLink = document.getElementById('pReportBugLink');
  if (pReportBugLink) {
    pReportBugLink.onclick = async (e) => {
      e.preventDefault();
      let version = '?';
      try { version = chrome.runtime.getManifest().version; } catch (_) {}
      if (!version || version === '?') version = (typeof ENG !== 'undefined' && ENG.getAppVersion && ENG.getAppVersion()) || '1.0.0';

      const ua = navigator.userAgent;

      const enabledEngines = [];
      for (const id of (cfg.order || [])) {
        const engCfg = (cfg.eng || {})[id] || {};
        if (engCfg.on !== false) {
          const info = (typeof ENG !== 'undefined' && ENG[id]) || {};
          enabledEngines.push(info.name || id);
        }
      }
      if (enabledEngines.length === 0) enabledEngines.push('none');

      const appVal = String(cfg.appUrl || cfg.appAddress || 'http://127.0.0.1:50505').trim().replace(/\/+$/, '');
      const appAddrHost = (appVal === 'http://127.0.0.1:50505' || appVal === '127.0.0.1:50505') ? '127.0.0.1:50505' : 'custom';

      const webVal = String(cfg.webAppUrl || 'http://localhost:8080').trim().replace(/\/+$/, '');
      const webAppHost = (webVal === 'http://localhost:8080' || webVal === 'localhost:8080') ? 'localhost:8080' : 'custom';

      let errors = [];
      try {
        const res = await chrome.runtime.sendMessage({ action: 'get-recent-errors' });
        if (res && res.ok && Array.isArray(res.errors)) errors = res.errors;
      } catch (_) {}
      if (!errors.length) {
        try {
          const st = await chrome.storage.local.get('makan_last_errors');
          const lastErr = st && st.makan_last_errors;
          if (lastErr && typeof lastErr === 'object') {
            const redact = (typeof ENG !== 'undefined' && ENG.redactDiagnosticsText) || (s => s);
            for (const [id, errObj] of Object.entries(lastErr)) {
              if (errObj && errObj.reason) errors.push(`[${id}] ${redact(errObj.reason)}`);
            }
            errors = errors.slice(-5);
          }
        } catch (_) {}
      }

      function assemble(errList, isTrunc) {
        const lines = [];
        lines.push('MAKAN Translate Bug Report v' + version + ' (Extension)');
        lines.push('');
        lines.push('Diagnostics:');
        lines.push('- Extension Version: ' + version);
        lines.push('- Browser / OS: ' + ua);
        lines.push('- Enabled Engines: ' + enabledEngines.join(', '));
        lines.push('- App Address Host: ' + appAddrHost);
        lines.push('- Web App URL Host: ' + webAppHost);
        lines.push('- Recent Errors (last ' + errList.length + '):');
        if (isTrunc) lines.push('  [Diagnostics truncated to fit email client limit]');
        if (errList.length === 0) {
          lines.push('  (none recorded)');
        } else {
          for (let j = 0; j < errList.length; j++) {
            lines.push('  ' + (j + 1) + '. ' + errList[j]);
          }
        }
        return lines.join('\n');
      }

      const errCopy = errors.slice();
      let isTrunc = false;
      while (errCopy.length > 0 && assemble(errCopy, isTrunc).length >= 1750) {
        errCopy.shift();
        isTrunc = true;
      }
      let report = assemble(errCopy, isTrunc);
      if (report.length > 1780) {
        report = report.slice(0, 1720) + '\n[Diagnostics truncated to fit email client limit]';
      }

      const email = (typeof ENG !== 'undefined' && ENG.BUG_REPORT_EMAIL) || 'makan20042002@gmail.com';
      const subject = 'MAKAN Translate bug report v' + version;
      const mailtoUrl = 'mailto:' + email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(report);

      let opened = false;
      try {
        const a = document.createElement('a');
        a.href = mailtoUrl;
        a.rel = 'noopener';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        a.remove();
        opened = true;
      } catch (_) {}

      if (!opened) {
        try {
          if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
            chrome.tabs.create({ url: mailtoUrl });
          }
        } catch (_) {}
      }
    };
  }
});
