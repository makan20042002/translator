/**
 * MAKAN Translate - Content Script (Manifest V3)
 * Injected into web pages. Uses isolated Shadow DOM to protect page styling.
 * Never touches password or payment inputs.
 */

(function () {
  if (window.__makanTranslateLoaded) return;
  window.__makanTranslateLoaded = true;

  // State
  let cfg = null;
  let activeSelection = '';
  let activeRange = null;
  let isPageTranslated = false;
  let translatedNodes = [];
  let currentCardElem = null;
  let currentFloatBtn = null;
  let currentBannerElem = null;
  let currentTooltipElem = null;

  // Initialize Shadow DOM Container
  const hostElem = document.createElement('div');
  hostElem.id = 'makan-translate-root';
  hostElem.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;';
  document.documentElement.appendChild(hostElem);
  const shadow = hostElem.attachShadow({ mode: 'open' });

  // Captured selection state to prevent loss on pointerdown/collapse
  let lastCapturedSelection = {
    text: '',
    rect: null,
    isWord: false,
    timestamp: 0
  };

  // Helper: Determine if an event originated from within the MAKAN extension UI
  function isExtensionEvent(e) {
    if (!e) return false;
    try {
      const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
      if (path && path.length > 0) {
        if (path.includes(hostElem)) return true;
        if (shadow && path.includes(shadow)) return true;
        for (const el of path) {
          if (!el || el.nodeType !== 1) continue;
          if (el === hostElem) return true;
          if (el.classList && (
            el.classList.contains('makan-btn-float') ||
            el.classList.contains('makan-card') ||
            el.classList.contains('makan-top-banner') ||
            el.classList.contains('makan-inpage-toast') ||
            el.classList.contains('makan-tooltip')
          )) return true;
        }
      }
    } catch {}
    if (hostElem) {
      if (e.target === hostElem || (e.target && hostElem.contains(e.target))) return true;
    }
    return false;
  }

  // Audio / Speech State
  let currentSpeakToken = 0;
  let isAudioPlaying = false;
  let activePlayingBtn = null;

  function stopCurrentSpeech() {
    currentSpeakToken++;
    isAudioPlaying = false;
    if (activePlayingBtn) {
      activePlayingBtn.classList.remove('playing');
      activePlayingBtn.setAttribute('title', 'Read aloud');
      const span = activePlayingBtn.querySelector('span');
      if (span) span.textContent = 'Speak';
      activePlayingBtn = null;
    }
    try {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    } catch {}
    try {
      if (window.chrome?.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ action: 'stop-tts' }).catch(() => {});
      }
    } catch {}
  }

  async function handleSpeakClick(text, lang, btn, noticeContainer) {
    if (!text || !text.trim()) return;

    // Second click stops speech immediately
    if (isAudioPlaying && activePlayingBtn === btn) {
      stopCurrentSpeech();
      return;
    }

    stopCurrentSpeech();
    const token = ++currentSpeakToken;
    isAudioPlaying = true;
    activePlayingBtn = btn;
    btn.classList.add('preparing');
    btn.classList.remove('playing');
    btn.setAttribute('title', 'Preparing voice... (Click to stop)');
    const span = btn.querySelector('span');
    if (span) span.textContent = 'Stop';

    function cleanup() {
      if (currentSpeakToken === token) {
        isAudioPlaying = false;
        activePlayingBtn = null;
        btn.classList.remove('preparing', 'playing');
        btn.setAttribute('title', 'Read aloud');
        if (span) span.textContent = 'Speak';
      }
    }

    if (!cfg) await refreshConfig();
    const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    const voice = typeof pickBestVoice === 'function' ? pickBestVoice(lang, voices, cfg?.tts?.voices) : null;
    const preferGemini = !!cfg?.tts?.preferGemini;

    // Use Gemini TTS if preferGemini is true OR no matching browser voice exists for this language
    if (preferGemini || !voice) {
      let ttsRes = null;
      try {
        if (window.chrome?.runtime?.sendMessage) {
          ttsRes = await chrome.runtime.sendMessage({
            action: 'play-gemini-tts',
            text,
            voice: cfg?.tts?.geminiVoice,
            rate: cfg?.tts?.rate
          });
        }
      } catch {}

      if (token !== currentSpeakToken) return;

      if (ttsRes && ttsRes.ok) {
        // Fallback for audio element if returned directly
        if (ttsRes.audioDataUrl) {
          try {
            const a = new Audio(ttsRes.audioDataUrl);
            if (cfg?.tts?.rate) a.playbackRate = cfg.tts.rate;
            a.onended = cleanup;
            a.onerror = cleanup;
            await a.play();
            return;
          } catch {
            cleanup();
            return;
          }
        }
        // Playing via background offscreen or background page
        const monitorInterval = setInterval(() => {
          if (token !== currentSpeakToken) {
            clearInterval(monitorInterval);
            cleanup();
          }
        }, 400);
        return;
      }

      // Gemini TTS did not work (e.g. key missing)
      // If a local voice exists, fall back to it
      if (voice) {
        // proceed below to browser speech synthesis
      } else {
        // CRITICAL: NEVER speak with a voice of a different language!
        cleanup();
        const msg = typeof getNoVoiceMessage === 'function'
          ? getNoVoiceMessage(lang, cfg?.ui || 'en')
          : `No voice installed for ${lang}. Add voice in Windows settings or configure Gemini API key in MAKAN Options.`;

        if (noticeContainer) {
          let n = noticeContainer.querySelector('.makan-voice-notice');
          if (!n) {
            n = document.createElement('div');
            n.className = 'makan-voice-notice';
            noticeContainer.appendChild(n);
          }
          n.textContent = msg;
          n.style.display = 'block';
          setTimeout(() => { if (n && n.parentNode) n.style.display = 'none'; }, 8000);
        }
        return;
      }
    }

    // Browser Speech Synthesis with proper language matching & chunk splitting
    if (!window.speechSynthesis) {
      cleanup();
      return;
    }

    const chunks = typeof splitTextForSpeech === 'function' ? splitTextForSpeech(text, 180) : [text];
    let chunkIdx = 0;

    function speakNext() {
      if (token !== currentSpeakToken || chunkIdx >= chunks.length) {
        cleanup();
        return;
      }
      const chunk = chunks[chunkIdx++];
      const u = new SpeechSynthesisUtterance(chunk);
      u.voice = voice;
      u.lang = voice.lang || lang;
      u.rate = cfg?.tts?.rate || 1.0;

      u.onstart = () => {
        if (token === currentSpeakToken && activePlayingBtn === btn) {
          btn.classList.remove('preparing');
          btn.classList.add('playing');
        }
      };

      u.onend = () => {
        if (token === currentSpeakToken) speakNext();
      };
      u.onerror = () => {
        cleanup();
      };
      window.speechSynthesis.speak(u);
    }

    speakNext();
  }

  // Load shadow stylesheet
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  try {
    link.href = window.chrome?.runtime?.getURL ? chrome.runtime.getURL('content.css') : 'http://localhost:8080/extension/content.css';
  } catch {
    link.href = 'http://localhost:8080/extension/content.css';
  }
  shadow.appendChild(link);

  // Load config from background
  async function refreshConfig() {
    try {
      if (window.chrome?.runtime?.sendMessage) {
        const res = await chrome.runtime.sendMessage({ action: 'get-public-config' });
        if (res && res.ok) cfg = res.cfg;
      }
    } catch {}
    if (!cfg && typeof DEFAULT_CFG !== 'undefined') {
      cfg = JSON.parse(JSON.stringify(DEFAULT_CFG));
    }
  }
  refreshConfig();

  // Helper: check if target is inside form control or password/payment
  function isSensitiveOrEditable(el) {
    if (!el || !el.closest) return false;
    if (el.closest('#makan-translate-root')) return true;
    if (el.closest('input[type="password"], input[type="hidden"], [autocomplete*="cc-"], [autocomplete*="card-"]')) return true;
    if (el.closest('[contenteditable="true"], textarea, input')) return true;
    return false;
  }

  // Helper: check RTL
  function isRtl(lang) {
    return ['fa', 'ar', 'he', 'ur', 'ps', 'sd', 'ug'].some(c => lang === c || (lang && lang.startsWith(c + '-')));
  }

  // Remove existing floating button
  function removeFloatBtn() {
    if (currentFloatBtn && currentFloatBtn.parentNode) {
      currentFloatBtn.remove();
      currentFloatBtn = null;
    }
  }

  // Remove existing translation card
  function removeCard() {
    stopCurrentSpeech();
    if (currentCardElem && currentCardElem.parentNode) {
      currentCardElem.remove();
      currentCardElem = null;
    }
  }

  // Display unobtrusive in-page toast notification in Shadow DOM
  function showToastNotice(text) {
    if (!text) return;
    let t = shadow.querySelector('.makan-inpage-toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'makan-inpage-toast';
      shadow.appendChild(t);
    }
    t.textContent = text;
    t.classList.add('visible');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => {
      t.classList.remove('visible');
    }, 4500);
  }

  // Helper: calculate clamped coordinates for floating element
  function calculatePos(rect, elemWidth, elemHeight) {
    const pad = 10;
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;

    let left = rect.right + scrollX - elemWidth;
    let top = rect.bottom + scrollY + 8;

    // Check bottom collision -> flip above selection
    if (rect.bottom + elemHeight + 20 > viewH) {
      top = rect.top + scrollY - elemHeight - 8;
    }
    // Check top collision
    if (top < scrollY + pad) top = scrollY + pad;

    // Check right collision
    if (left + elemWidth > scrollX + viewW - pad) {
      left = scrollX + viewW - elemWidth - pad;
    }
    // Check left collision
    if (left < scrollX + pad) left = scrollX + pad;

    return { left, top };
  }

  // Render small floating MAKAN button with Edge mini menu anti-collision
  function showFloatingButton(rect, text, isWord) {
    removeFloatBtn();
    removeCard();

    // 1. Capture selected text and its position at the moment the button is shown
    lastCapturedSelection = {
      text: text,
      rect: {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width || (rect.right - rect.left),
        height: rect.height || (rect.bottom - rect.top)
      },
      isWord: !!isWord,
      timestamp: Date.now()
    };

    const btn = document.createElement('div');
    btn.className = 'makan-btn-float';
    btn.title = isWord && cfg?.dictLookup ? 'Dictionary lookup with MAKAN' : 'Translate with MAKAN';
    btn.innerHTML = `<div class="makan-mark-ico">M</div>`;

    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    const btnW = 28;
    const btnH = 28;

    // Edge Mini Menu sits at rect.bottom (often centered or right-aligned).
    // Position MAKAN button ABOVE the selection to avoid overlap:
    let left = rect.right + scrollX - btnW;
    let top = rect.top + scrollY - btnH - 6;

    // If top of selection is too close to viewport top (< 38px), flip below selection
    // but place on the OPPOSITE horizontal side (rect.left) to avoid Edge's mini menu:
    if (rect.top < 38) {
      top = rect.bottom + scrollY + 8;
      left = rect.left + scrollX;
    }

    // Keep within horizontal bounds of viewport
    const maxLeft = window.innerWidth + scrollX - btnW - 8;
    const minLeft = scrollX + 8;
    left = Math.max(minLeft, Math.min(left, maxLeft));

    btn.style.left = `${left}px`;
    btn.style.top = `${top}px`;
    btn.style.pointerEvents = 'auto';

    let hasOpened = false;
    const activateButton = (e) => {
      // Only a real press by the user opens the card; scripts in the web page can fake events but not this flag.
      if (!e || !e.isTrusted) return;
      if (e) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      }
      if (hasOpened) return;
      hasOpened = true;

      const textToUse = lastCapturedSelection.text || text;
      const rectToUse = lastCapturedSelection.rect || rect;
      const isWordToUse = lastCapturedSelection.isWord !== undefined ? lastCapturedSelection.isWord : isWord;

      removeFloatBtn();
      openTranslationCard(rectToUse, textToUse, isWordToUse);
    };

    const stopEvent = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    };

    // 2. Act on pointerdown to prevent clearing page selection, stop bubbling to document
    btn.addEventListener('pointerdown', activateButton, { capture: true });
    btn.addEventListener('mousedown', activateButton, { capture: true });
    btn.addEventListener('click', activateButton, { capture: true });
    btn.addEventListener('pointerup', stopEvent, { capture: true });
    btn.addEventListener('mouseup', stopEvent, { capture: true });

    shadow.appendChild(btn);
    currentFloatBtn = btn;
  }

  // Open Compact Translation Card
  async function openTranslationCard(rect, text, isWord) {
    removeFloatBtn();
    removeCard();

    if (!cfg) await refreshConfig();

    const card = document.createElement('div');
    card.className = 'makan-card';
    card.style.left = '0px';
    card.style.top = '0px';
    card.style.pointerEvents = 'auto';

    let curSrc = cfg?.src || 'auto';
    let curTgt = cfg?.tgt || 'fa';
    let detectedLang = isRtl(text) ? 'fa' : 'en';
    const isSingleWord = isWord || (!text.includes(' ') && text.length <= 32);

    card.innerHTML = `
      <div class="makan-card-header">
        <div class="makan-card-brand">
          <div class="makan-mark-ico">M</div>
          MAKAN<span>Translate</span>
        </div>
        <span class="makan-pill" id="makanPairPill">${curSrc.toUpperCase()} → ${curTgt.toUpperCase()}</span>
        <span class="makan-pill detected" id="makanDetectedPill">Detected: ${detectedLang.toUpperCase()}</span>
        <span class="makan-pill engine" id="makanEnginePill">Translating…</span>
        <button class="makan-icon-btn" id="makanCardClose" title="Close (Esc)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="makan-card-body" id="makanCardBody">
        <div class="makan-loading">
          <svg class="makan-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/></svg>
          Translating…
        </div>
      </div>
      <div class="makan-card-footer">
        <button class="makan-action-btn" id="makanCopyBtn" title="Copy translation">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          <span>Copy</span>
        </button>
        <button class="makan-action-btn" id="makanSpeakBtn" title="Read aloud">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
          <span>Speak</span>
        </button>
        <button class="makan-action-btn" id="makanSwapBtn" title="Swap direction">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>
          <span>Swap</span>
        </button>
        <span class="makan-sp"></span>
        <a class="makan-open-app-btn" id="makanOpenApp" target="_blank" title="Open in full MAKAN Translate web app">
          <span>Open in App</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
      </div>
    `;

    shadow.appendChild(card);
    currentCardElem = card;

    // Position correctly within viewport
    const pos = calculatePos(rect, 370, 240);
    card.style.left = `${pos.left}px`;
    card.style.top = `${pos.top}px`;

    // Hook close button
    const closeBtn = card.querySelector('#makanCardClose');
    closeBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); });
    closeBtn.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); });
    closeBtn.onclick = (e) => {
      if (!e.isTrusted) return;
      e.preventDefault();
      e.stopPropagation();
      removeCard();
    };

    // Hook web app link
    const openAppBtn = card.querySelector('#makanOpenApp');
    openAppBtn.addEventListener('pointerdown', e => e.stopPropagation());
    openAppBtn.addEventListener('mousedown', e => e.stopPropagation());
    openAppBtn.addEventListener('click', e => { e.stopPropagation(); if (!e.isTrusted) e.preventDefault(); });

    function updateAppUrl(sourceText, sLang, tLang) {
      const appBase = cfg?.webAppUrl || 'http://localhost:8080';
      const appUrl = `${appBase.replace(/\/+$/, '')}/?text=${encodeURIComponent(sourceText)}&src=${encodeURIComponent(sLang)}&tgt=${encodeURIComponent(tLang)}`;
      openAppBtn.href = appUrl;
    }
    updateAppUrl(text, curSrc, curTgt);

    // Prevent any pointer/mouse events inside card from bubbling or triggering outside-click
    const stopCardPropagation = (e) => {
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    };
    card.addEventListener('pointerdown', stopCardPropagation);
    card.addEventListener('mousedown', stopCardPropagation);
    card.addEventListener('pointerup', stopCardPropagation);
    card.addEventListener('mouseup', stopCardPropagation);
    card.addEventListener('click', stopCardPropagation);

    // Execute translation via background
    let translatedResult = '';
    const bodyElem = card.querySelector('#makanCardBody');
    const enginePill = card.querySelector('#makanEnginePill');
    const pairPill = card.querySelector('#makanPairPill');
    const detectedPill = card.querySelector('#makanDetectedPill');

    async function executeTranslate(sourceText, sLang, tLang, useDict) {
      bodyElem.innerHTML = `
        <div class="makan-loading">
          <svg class="makan-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/></svg>
          Translating…
        </div>
      `;
      pairPill.textContent = `${sLang.toUpperCase()} → ${tLang.toUpperCase()}`;
      detectedLang = isRtl(sourceText) ? 'fa' : 'en';
      detectedPill.textContent = `Detected: ${detectedLang.toUpperCase()}`;
      updateAppUrl(sourceText, sLang, tLang);

      try {
        if (useDict && cfg?.dictLookup) {
          let resp = null;
          if (window.chrome?.runtime?.sendMessage) {
            try {
              resp = await chrome.runtime.sendMessage({
                action: 'translate-dict',
                word: sourceText,
                src: sLang,
                tgt: tLang
              });
            } catch {}
          }
          if (!resp && typeof MakanEngine !== 'undefined') {
            const d = await MakanEngine.lookupWordDictionary(sourceText, sLang, tLang, cfg);
            resp = { ok: true, dict: d };
          }
          if (resp && resp.ok && resp.dict) {
            const d = resp.dict;
            enginePill.textContent = d.engineName || 'AI Dictionary';
            if (d.isDictionary) {
              translatedResult = Array.isArray(d.translations) ? d.translations.join('، ') : d.word;
              bodyElem.innerHTML = `
                <div class="makan-dict-wrap">
                  <div class="makan-dict-head">
                    <span class="makan-dict-word">${escapeHtml(d.word)}</span>
                    ${d.phonetic ? `<span class="makan-dict-phonetic">${escapeHtml(d.phonetic)}</span>` : ''}
                    ${d.pos ? `<span class="makan-dict-pos">${escapeHtml(d.pos)}</span>` : ''}
                  </div>
                  <div class="makan-dict-trans" dir="${isRtl(tLang) ? 'rtl' : 'ltr'}">${escapeHtml(translatedResult)}</div>
                  ${d.definition ? `<div class="makan-dict-def" dir="${isRtl(tLang) ? 'rtl' : 'ltr'}">${escapeHtml(d.definition)}</div>` : ''}
                  ${d.examples && d.examples.length ? `<div class="makan-dict-ex">${escapeHtml(d.examples[0])}<br><span style="color:#94a3b8" dir="${isRtl(tLang) ? 'rtl' : 'ltr'}">${escapeHtml(d.examples[1] || '')}</span></div>` : ''}
                </div>
              `;
            } else {
              translatedResult = d.translation || sourceText;
              bodyElem.innerHTML = `<div class="makan-result-text" dir="${isRtl(tLang) ? 'rtl' : 'ltr'}">${escapeHtml(translatedResult)}</div>`;
            }
          } else {
            throw new Error(resp?.error || 'Dictionary lookup failed');
          }
        } else {
          let resp = null;
          if (window.chrome?.runtime?.sendMessage) {
            try {
              resp = await chrome.runtime.sendMessage({
                action: 'translate-text',
                items: [sourceText],
                src: sLang,
                tgt: tLang,
                tone: cfg?.tone,
                subject: cfg?.subject
              });
            } catch {}
          }
          if (!resp && typeof MakanEngine !== 'undefined') {
            const r = await MakanEngine.translateText([sourceText], sLang, tLang, cfg, { tone: cfg?.tone, subject: cfg?.subject });
            resp = { ok: true, results: r.results, engineName: r.engineName };
          }
          if (resp && resp.ok && resp.results?.length) {
            translatedResult = resp.results[0];
            enginePill.textContent = resp.engineName || 'Translated';
            bodyElem.innerHTML = `<div class="makan-result-text" dir="${isRtl(tLang) ? 'rtl' : 'ltr'}">${escapeHtml(translatedResult)}</div>`;
          } else {
            throw new Error(resp?.error || 'Translation failed');
          }
        }
      } catch (err) {
        bodyElem.innerHTML = `<div style="color:var(--err);font-size:13px">⚠️ ${escapeHtml(err.message)}</div>`;
      }
    }

    // Check empty text selection
    if (!text || !text.trim()) {
      bodyElem.innerHTML = `<div style="color:var(--muted);font-size:13.5px;padding:12px 4px;">No text selected. Select any text on this page to translate.</div>`;
      enginePill.textContent = 'Ready';
      return;
    }

    // Initial translation execution
    await executeTranslate(text, curSrc, curTgt, isSingleWord);

    // Hook Copy button
    const copyBtn = card.querySelector('#makanCopyBtn');
    copyBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); });
    copyBtn.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); });
    copyBtn.onclick = async (e) => {
      if (!e.isTrusted) return;
      e.preventDefault();
      e.stopPropagation();
      if (!translatedResult) return;
      let copied = false;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(translatedResult);
          copied = true;
        }
      } catch {}
      if (!copied) {
        try {
          const ta = document.createElement('textarea');
          ta.value = translatedResult;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          (document.body || document.documentElement).appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
          copied = true;
        } catch {}
      }
      copyBtn.classList.add('active');
      copyBtn.querySelector('span').textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.classList.remove('active');
        copyBtn.querySelector('span').textContent = 'Copy';
      }, 1800);
    };

    // Hook Speak button (TTS)
    const speakBtn = card.querySelector('#makanSpeakBtn');
    speakBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); });
    speakBtn.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); });
    speakBtn.onclick = (e) => {
      if (!e.isTrusted) return;
      e.preventDefault();
      e.stopPropagation();
      const targetText = translatedResult || text;
      if (!targetText) return;
      handleSpeakClick(targetText, curTgt, speakBtn, card.querySelector('#makanCardBody'));
    };

    // Hook Swap Direction button
    const swapBtn = card.querySelector('#makanSwapBtn');
    swapBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); });
    swapBtn.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); });
    swapBtn.onclick = async (e) => {
      if (!e.isTrusted) return;
      e.preventDefault();
      e.stopPropagation();
      const prevSrc = curSrc === 'auto' ? detectedLang : curSrc;
      const prevTgt = curTgt;
      curSrc = prevTgt;
      curTgt = prevSrc;
      const textToTranslate = translatedResult || text;
      await executeTranslate(textToTranslate, curSrc, curTgt, false);
    };
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Handle text selection on page
  document.addEventListener('mouseup', e => {
    // Ignore events a web page's own script made up; only real mouse input counts.
    if (!e.isTrusted) return;
    // If the event originated inside any extension component, ignore completely
    if (isExtensionEvent(e)) return;
    if (isSensitiveOrEditable(e.target)) return;

    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : '';

      if (!text || text.length < 1) {
        // Protect floating button if created recently (< 450ms)
        if (Date.now() - lastCapturedSelection.timestamp < 450) return;
        removeFloatBtn();
        return;
      }

      // Check if disabled for this site
      const currentHost = window.location.hostname;
      if (cfg?.disabledSites?.includes(currentHost)) return;

      // Check trigger options
      if (cfg?.trigger === 'never') return;
      if (cfg?.trigger === 'alt' && !e.altKey) return;

      activeSelection = text;
      try {
        const range = sel.getRangeAt(0);
        activeRange = range.cloneRange();
        const rect = range.getBoundingClientRect();
        if (rect && (rect.width > 0 || rect.height > 0)) {
          const isWord = !text.includes(' ') && text.length <= 28;
          showFloatingButton(rect, text, isWord);
        }
      } catch {}
    }, 50);
  });

  // Handle double-click on word for dictionary lookup
  document.addEventListener('dblclick', e => {
    if (!e.isTrusted) return;
    if (isExtensionEvent(e)) return;
    if (isSensitiveOrEditable(e.target)) return;

    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : '';

      if (!text || text.includes(' ') || text.length > 32) return;

      const currentHost = window.location.hostname;
      if (cfg?.disabledSites?.includes(currentHost)) return;
      if (cfg?.trigger === 'never') return;

      try {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect && (rect.width > 0 || rect.height > 0)) {
          openTranslationCard(rect, text, true);
        }
      } catch {}
    }, 50);
  });

  // Close on Escape or click outside
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      removeCard();
      removeFloatBtn();
    }
  });

  document.addEventListener('mousedown', e => {
    if (isExtensionEvent(e)) return;
    removeFloatBtn();
    removeCard();
  });

  document.addEventListener('pointerdown', e => {
    if (isExtensionEvent(e)) return;
  });

  // Remove button only when user scrolls far away (> 160px)
  let lastScrollY = window.scrollY || 0;
  let lastScrollX = window.scrollX || 0;
  window.addEventListener('scroll', () => {
    if (!currentFloatBtn && !currentCardElem) return;
    const curX = window.scrollX || 0;
    const curY = window.scrollY || 0;
    if (currentFloatBtn && (Math.abs(curX - lastScrollX) > 160 || Math.abs(curY - lastScrollY) > 160)) {
      removeFloatBtn();
      lastScrollX = curX;
      lastScrollY = curY;
    }
  }, { passive: true });

  // Whole Page Translation Functionality
  async function translateWholePage() {
    if (isPageTranslated) {
      restoreOriginalPage();
      return;
    }

    if (!cfg) await refreshConfig();
    const tgt = cfg?.tgt || 'fa';

    // Show floating top banner
    showPageBanner('Translating visible page content…', true);

    // Collect eligible text nodes
    const eligibleSelectors = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, dt, dd, td, th, figcaption, article p, section p';
    const allCandidates = Array.from(document.querySelectorAll(eligibleSelectors));

    const targets = [];
    for (const el of allCandidates) {
      if (isSensitiveOrEditable(el)) continue;
      if (el.closest('pre, code, kbd, noscript, script, style, svg, [data-makan-orig]')) continue;
      const text = el.innerText?.trim();
      if (text && text.length > 3 && /[a-zA-Z\u0600-\u06FF]/.test(text)) {
        targets.push(el);
      }
    }

    if (!targets.length) {
      showPageBanner('No translatable text found on this page.', false);
      return;
    }

    // Process in batches
    const BATCH_SIZE = 25;
    let completed = 0;
    translatedNodes = [];

    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const chunk = targets.slice(i, i + BATCH_SIZE);
      const texts = chunk.map(el => el.innerText.trim());

      try {
        let res = null;
        if (window.chrome?.runtime?.sendMessage) {
          try {
            res = await chrome.runtime.sendMessage({
              action: 'translate-text',
              items: texts,
              src: 'auto',
              tgt: tgt,
              tone: cfg?.tone,
              subject: cfg?.subject
            });
          } catch {}
        }
        if (!res && typeof MakanEngine !== 'undefined') {
          const r = await MakanEngine.translateText(texts, 'auto', tgt, cfg, { tone: cfg?.tone, subject: cfg?.subject });
          res = { ok: true, results: r.results, engineName: r.engineName };
        }

        if (res && res.ok && res.results) {
          chunk.forEach((el, idx) => {
            const original = texts[idx];
            const translated = res.results[idx] || original;
            el.setAttribute('data-makan-orig', original);
            el.setAttribute('data-makan-trans', translated);
            el.innerText = translated;
            if (isRtl(tgt)) el.setAttribute('dir', 'rtl');

            // Attach hover tooltip listener
            attachTooltip(el, original);
            translatedNodes.push(el);
          });
          completed += chunk.length;
          showPageBanner(`Translating page… (${completed}/${targets.length})`, true);
        }
      } catch (err) {
        console.warn('Batch translation error:', err.message);
      }
    }

    isPageTranslated = true;
    showPageBanner(`Page translated to ${tgt.toUpperCase()} via ${cfg?.order?.[0] || 'MAKAN'}.`, false, true);
  }

  // Restore original page text
  function restoreOriginalPage() {
    translatedNodes.forEach(el => {
      const orig = el.getAttribute('data-makan-orig');
      if (orig) {
        el.innerText = orig;
        el.removeAttribute('data-makan-orig');
        el.removeAttribute('data-makan-trans');
        el.removeAttribute('dir');
        el.onmouseenter = null;
        el.onmouseleave = null;
      }
    });
    translatedNodes = [];
    isPageTranslated = false;
    if (currentBannerElem) {
      currentBannerElem.remove();
      currentBannerElem = null;
    }
    if (currentTooltipElem) {
      currentTooltipElem.remove();
      currentTooltipElem = null;
    }
  }

  // Top Page Translation Banner
  function showPageBanner(statusText, isLoading, showRestore = false) {
    if (currentBannerElem) currentBannerElem.remove();

    const banner = document.createElement('div');
    banner.className = 'makan-top-banner';
    banner.innerHTML = `
      <div class="makan-mark-ico">M</div>
      <span style="font-weight:600">${escapeHtml(statusText)}</span>
      ${showRestore ? `<button class="makan-banner-btn cta" id="makanRestoreBtn">Show Original</button>` : ''}
      <button class="makan-icon-btn" id="makanBannerClose" title="Close banner">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    `;

    shadow.appendChild(banner);
    currentBannerElem = banner;

    banner.querySelector('#makanBannerClose').onclick = (e) => {
      if (!e.isTrusted) return;
      banner.remove();
      currentBannerElem = null;
    };

    if (showRestore) {
      const btn = banner.querySelector('#makanRestoreBtn');
      if (btn) btn.onclick = (e) => { if (e.isTrusted) restoreOriginalPage(); };
    }
  }

  // Hover Tooltip for Original Text
  function attachTooltip(el, originalText) {
    el.addEventListener('mouseenter', () => {
      if (!currentTooltipElem) {
        currentTooltipElem = document.createElement('div');
        currentTooltipElem.className = 'makan-tooltip';
        shadow.appendChild(currentTooltipElem);
      }
      currentTooltipElem.innerHTML = `
        <div class="makan-tooltip-lbl">Original Text</div>
        <div>${escapeHtml(originalText.slice(0, 300))}</div>
      `;
      const rect = el.getBoundingClientRect();
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;
      currentTooltipElem.style.left = `${rect.left + scrollX}px`;
      currentTooltipElem.style.top = `${rect.bottom + scrollY + 4}px`;
      currentTooltipElem.style.display = 'block';
    });

    el.addEventListener('mouseleave', () => {
      if (currentTooltipElem) currentTooltipElem.style.display = 'none';
    });
  }

  // Listen to messages from background / popup
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
        // Only the extension itself can reach this listener; refuse anything else (and anything from another content script).
        if (!sender || sender.id !== chrome.runtime.id || !req || typeof req !== 'object') return false;
        if (req.target === 'makan-ui' && req.action === 'tts-state-update') {
          if (req.state === 'playing') {
            if (activePlayingBtn) {
              activePlayingBtn.classList.remove('preparing');
              activePlayingBtn.classList.add('playing');
              activePlayingBtn.setAttribute('title', 'Stop read-aloud');
              const span = activePlayingBtn.querySelector('span');
              if (span) span.textContent = 'Stop';
            }
          } else if (req.state === 'ended' || req.state === 'stopped' || req.state === 'error') {
            if (activePlayingBtn) {
              activePlayingBtn.classList.remove('preparing', 'playing');
              activePlayingBtn.setAttribute('title', 'Read aloud');
              const span = activePlayingBtn.querySelector('span');
              if (span) span.textContent = 'Speak';
            }
            isAudioPlaying = false;
            activePlayingBtn = null;
          }
          return false;
        }

        if (req.action === 'ping') {
          sendResponse({ ok: true, url: window.location.href, title: document.title });
          return true;
        }

        if (req.action === 'context-translate-selection' || req.action === 'shortcut-translate-selection') {
          const sel = window.getSelection();
          const text = (req.text || sel?.toString() || activeSelection || lastCapturedSelection?.text || '').trim();
          let rect = null;
          if (sel && sel.rangeCount > 0) {
            try { rect = sel.getRangeAt(0).getBoundingClientRect(); } catch {}
          }
          if (!rect && activeRange) {
            try { rect = activeRange.getBoundingClientRect(); } catch {}
          }
          if (!rect && lastCapturedSelection?.rect) {
            rect = lastCapturedSelection.rect;
          }
          if (!rect || (rect.width === 0 && rect.height === 0)) {
            rect = {
              left: Math.max(16, window.innerWidth / 2 - 185),
              right: Math.min(window.innerWidth - 16, window.innerWidth / 2 + 185),
              top: Math.max(70, window.innerHeight * 0.2),
              bottom: Math.max(110, window.innerHeight * 0.2 + 40),
              width: 370,
              height: 40
            };
          }
          openTranslationCard(rect, text, !text.includes(' ') && text.length <= 28);
          sendResponse({ ok: true });
          return true;
        } else if (req.action === 'show-toast') {
          showToastNotice(req.message);
          sendResponse({ ok: true });
          return true;
        } else if (req.action === 'context-translate-page' || req.action === 'shortcut-translate-page' || req.action === 'page-translate-toggle') {
          translateWholePage();
          sendResponse({ ok: true, isPageTranslated: !isPageTranslated });
          return true;
        }
        return true;
      });
    }
  } catch {}

  // Nothing here listens for commands from the web page itself: no window handles, no custom DOM
  // events, no window messages. Translation starts only from real user input (see isTrusted checks above)
  // or from a message sent by the extension's own background or popup.

})();
