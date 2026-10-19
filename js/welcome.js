'use strict';
/* ---------- Welcome Wizard (First Run) ---------- */

let welcomeCurrentStep = 1;
let welcomeSelectedLang = 'fa';
let welcomeSelectedEngine = 'offline';
let welcomeSelectedPackage = 'none';

function isWelcomeDone() {
  try {
    if (typeof window !== 'undefined' && window.location && window.location.search) {
      if (new URLSearchParams(window.location.search).get('welcome') === '1') return false;
    }
    if (localStorage.getItem('welcome_force') === '1') return false;
    if (typeof navigator !== 'undefined' && navigator.webdriver && localStorage.getItem('welcome_test') !== '1') {
      return true;
    }
    return localStorage.getItem('welcome_done') === '1';
  } catch (e) {
    // If storage is unavailable or restricted, never block the app
    return true;
  }
}

function setWelcomeDone() {
  try {
    localStorage.setItem('welcome_done', '1');
    localStorage.removeItem('welcome_step');
  } catch (e) {}
}

function saveWelcomeStep(step) {
  try {
    localStorage.setItem('welcome_step', String(step));
  } catch (e) {}
}

function getSavedWelcomeStep() {
  try {
    const s = parseInt(localStorage.getItem('welcome_step') || '1', 10);
    return (s >= 1 && s <= 5) ? s : 1;
  } catch (e) {
    return 1;
  }
}

function updateWelcomeStepUI() {
  const ov = $('welcomeOverlay');
  if (!ov) return;

  // Step indicator dots
  document.querySelectorAll('#welcomeStepIndicator .step-dot').forEach(dot => {
    const s = parseInt(dot.dataset.step, 10);
    dot.classList.toggle('active', s === welcomeCurrentStep);
    dot.classList.toggle('passed', s < welcomeCurrentStep);
  });

  // Toggle step panes
  for (let i = 1; i <= 5; i++) {
    const pane = (i === 4 ? ($('welcomeStepHow') || $('welcomeStep4')) : $('welcomeStep' + i));
    if (pane) pane.hidden = (i !== welcomeCurrentStep);
  }

  // Footer buttons
  const backBtn = $('welcomeBackBtn');
  const nextBtn = $('welcomeNextBtn');
  const finishBtn = $('welcomeFinishBtn');

  if (backBtn) backBtn.hidden = (welcomeCurrentStep === 1);
  if (nextBtn) nextBtn.hidden = (welcomeCurrentStep === 5);
  if (finishBtn) finishBtn.hidden = (welcomeCurrentStep !== 5);

  // Update summary card on step 5
  if (welcomeCurrentStep === 5) {
    const sumLang = $('welcomeSummaryLang');
    const sumEng = $('welcomeSummaryEngine');
    const sumPriv = $('welcomeSummaryPrivacy');
    const sumKeyRow = $('welcomeSummaryKeyRow');
    const sumKey = $('welcomeSummaryKey');
    const sumPkg = $('welcomeSummaryPkg');
    const sumStatus = $('welcomeSummaryStatus');

    if (sumLang) sumLang.textContent = welcomeSelectedLang === 'fa' ? 'فارسی (Persian)' : 'English';

    const isEn = (typeof ui !== 'undefined' && ui === 'en');
    let engName = '';
    if (welcomeSelectedEngine === 'offline') {
      engName = isEn ? 'Offline (NLLB)' : 'آفلاین (NLLB)';
    } else if (welcomeSelectedEngine === 'online') {
      engName = isEn ? 'Fast (Google / MyMemory)' : 'سریع (Google / MyMemory)';
    } else {
      const hasKey = (typeof cfg !== 'undefined' && cfg.eng) ? (cfg.eng.gemini?.key ? 'Gemini' : (cfg.eng.groq?.key ? 'Groq' : (cfg.eng.openrouter?.key ? 'OpenRouter' : ''))) : '';
      if (hasKey) {
        engName = isEn ? `Smart (${hasKey})` : `هوشمند (${hasKey})`;
      } else if (welcomeOllamaReachable) {
        engName = isEn ? 'Smart (Ollama)' : 'هوشمند (Ollama)';
      } else {
        engName = isEn ? 'Smart (AI / Ollama)' : 'هوشمند (Ollama / هوش مصنوعی)';
      }
    }
    if (sumEng) sumEng.textContent = engName;

    if (sumPriv) {
      const disc = getWelcomePrivacyDisclosure();
      sumPriv.textContent = disc.text;
      sumPriv.style.color = disc.isLocal ? 'var(--success, #10B981)' : 'var(--muted, #8496B0)';
    }

    // AI Key row
    const configuredKey = (typeof cfg !== 'undefined' && cfg.eng) ? (cfg.eng.gemini?.key || cfg.eng.groq?.key || cfg.eng.openrouter?.key || '') : '';
    if (sumKeyRow && sumKey) {
      if (configuredKey) {
        sumKeyRow.hidden = false;
        sumKey.textContent = `تنظیم شد (…${configuredKey.slice(-4)})`;
      } else {
        sumKeyRow.hidden = true;
      }
    }

    // Offline package row
    if (sumPkg) {
      const pkgNames = {
        none: 'بدون دانلود (فوری)',
        light: 'NLLB-200 600M (۸۷۰ مگابایت)',
        full: 'NLLB + Whisper (۱٫۱ گیگابایت)'
      };
      sumPkg.textContent = pkgNames[welcomeSelectedPackage] || welcomeSelectedPackage;
    }

    // Voice & screen status
    if (sumStatus) {
      const vR = (typeof getVoiceTabReadiness === 'function') ? getVoiceTabReadiness() : { ready: true };
      const isDesktop = !!(window.makanDesktop?.isDesktop);
      sumStatus.textContent = `${vR.ready ? 'صدا آماده' : 'صدا محدود'} · ${isDesktop ? 'دسکتاپ متصل' : 'محیط وب'}`;
    }
  }

  // Update conditional privacy notice in Step 2
  updateWelcomePrivacyNotice();

  // Update model catalogue sizes & status in Step 3
  if (welcomeCurrentStep === 3) {
    updateWelcomeModelStatus();
    updateWelcomeVoiceScreenStatus();
  }
}

function updateWelcomeVoiceScreenStatus() {
  const vBadge = $('welcomeVoiceStatusBadge');
  const sBadge = $('welcomeScreenStatusBadge');

  if (vBadge) {
    const vR = (typeof getVoiceTabReadiness === 'function') ? getVoiceTabReadiness() : { ready: true };
    if (vR.ready) {
      vBadge.textContent = 'آماده ✓ (Ready)';
      vBadge.style.color = 'var(--success, #10B981)';
    } else {
      vBadge.textContent = vR.reason ? `${vR.reason} (محدود)` : 'آماده نیست (Not ready)';
      vBadge.style.color = 'var(--muted, #8496B0)';
    }
  }

  if (sBadge) {
    const isDesktop = !!(window.makanDesktop?.isDesktop);
    if (isDesktop) {
      sBadge.textContent = 'متصل به دسکتاپ ✓ (Connected)';
      sBadge.style.color = 'var(--success, #10B981)';
    } else {
      sBadge.textContent = 'محیط مرورگر وب (Web browser)';
      sBadge.style.color = 'var(--muted, #8496B0)';
    }
  }
}

function updateWelcomeModelStatus() {
  if (typeof MC === 'undefined' || !MC.models) return;
  const nllb = MC.models.find(m => m.id === 'tr-nllb-600');
  const whisper = MC.models.find(m => m.id === 'asr-small');

  const nllbReady = (typeof mcReady === 'function' && nllb) ? mcReady(nllb) : false;
  const whisperReady = (typeof mcReady === 'function' && whisper) ? mcReady(whisper) : false;

  const nllbBadge = $('welcomeNllbBadge');
  if (nllbBadge) {
    if (nllbReady) {
      nllbBadge.textContent = 'آماده است ✓';
      nllbBadge.classList.add('ok');
    } else {
      const sz = (typeof mcSize === 'function' && nllb) ? mcSize(nllb.bytes) : '870 MB';
      nllbBadge.textContent = sz;
      nllbBadge.classList.remove('ok');
    }
  }

  const fullBadge = $('welcomeFullBadge');
  if (fullBadge) {
    if (nllbReady && whisperReady) {
      fullBadge.textContent = 'آماده است ✓';
      fullBadge.classList.add('ok');
    } else {
      const totBytes = (nllb ? nllb.bytes : 0) + (whisper ? whisper.bytes : 0);
      const sz = (typeof mcSize === 'function' && totBytes) ? mcSize(totBytes) : '1.1 GB';
      fullBadge.textContent = sz;
      fullBadge.classList.remove('ok');
    }
  }
}

let welcomeOllamaReachable = false;
let welcomeOllamaAbortCtrl = null;

function isWelcomeNllbReady() {
  if (typeof MC === 'undefined' || !MC.models) return false;
  const nllb = MC.models.find(m => m.id === 'tr-nllb-600');
  if (typeof mcReady === 'function' && nllb && mcReady(nllb)) return true;
  if (typeof trAnyReady === 'function' && trAnyReady()) return true;
  const mdl = (typeof store !== 'undefined' && typeof store.get === 'function') ? store.get('mdl', {}) : {};
  if (mdl && mdl['tr-nllb-600'] && (mdl['tr-nllb-600'].at || mdl['tr-nllb-600'].files)) return true;
  if (typeof store !== 'undefined' && typeof store.get === 'function' && store.get('nllb', false)) return true;
  return false;
}

async function checkWelcomeOllama(force = false) {
  const offline = (typeof isOff === 'function' && isOff()) || (typeof cfg !== 'undefined' && !!cfg.offline);
  const ollamaOn = (typeof cfg !== 'undefined' && cfg.eng?.ollama?.on !== false);
  const isSelected = (typeof welcomeSelectedEngine !== 'undefined' && welcomeSelectedEngine === 'ollama') ||
                     (typeof isOllamaSelected === 'function' && isOllamaSelected());
  if (!force && (offline || !ollamaOn || !isSelected)) {
    welcomeOllamaReachable = false;
    updateWelcomePrivacyNotice();
    return;
  }
  if (typeof engineConnStatus !== 'undefined' && engineConnStatus?.ollama?.code === 'works') {
    welcomeOllamaReachable = true;
    updateWelcomePrivacyNotice();
    return;
  }
  if (welcomeOllamaAbortCtrl) {
    try { welcomeOllamaAbortCtrl.abort(); } catch (e) {}
    welcomeOllamaAbortCtrl = null;
  }
  const ctrl = new AbortController();
  welcomeOllamaAbortCtrl = ctrl;
  const to = setTimeout(() => {
    try { ctrl.abort(); } catch (e) {}
  }, 1200);
  try {
    const host = (typeof getOllamaHost === 'function') ? getOllamaHost() : 'http://localhost:11434';
    let res = await fetch(host + '/api/tags', { signal: ctrl.signal }).catch(() => null);
    if (!res || !res.ok) {
      res = await fetch(host + '/v1/models', { signal: ctrl.signal }).catch(() => null);
    }
    clearTimeout(to);
    if (welcomeOllamaAbortCtrl === ctrl) {
      welcomeOllamaReachable = !!(res && res.ok);
    }
  } catch (e) {
    if (welcomeOllamaAbortCtrl === ctrl) {
      welcomeOllamaReachable = false;
    }
  } finally {
    if (welcomeOllamaAbortCtrl === ctrl) {
      welcomeOllamaAbortCtrl = null;
      updateWelcomePrivacyNotice();
    }
  }
}

function getWelcomePrivacyDisclosure() {
  const isEn = (typeof ui !== 'undefined' && ui === 'en');
  if (welcomeSelectedEngine === 'offline') {
    if (isWelcomeNllbReady()) {
      return {
        isLocal: true,
        text: isEn ? 'Processing stays on this PC' : 'پردازش در همین رایانه انجام می‌شود'
      };
    }
    return {
      isLocal: false,
      text: isEn ? 'Needs the offline model (not downloaded yet)' : 'نیاز به دانلود مدل آفلاین دارد (هنوز دانلود نشده است)'
    };
  }
  if (welcomeSelectedEngine === 'ollama') {
    if (welcomeOllamaReachable) {
      return {
        isLocal: true,
        text: isEn ? 'Processing stays on this PC' : 'پردازش در همین رایانه انجام می‌شود'
      };
    }
    const hasKey = (typeof cfg !== 'undefined' && cfg.eng) ? (cfg.eng.gemini?.key || cfg.eng.groq?.key || cfg.eng.openrouter?.key) : '';
    if (hasKey) {
      return {
        isLocal: false,
        text: isEn ? 'Text is sent only to the selected provider' : 'متن فقط به ارائه‌دهنده انتخابی ارسال می‌شود'
      };
    }
    return {
      isLocal: false,
      text: isEn ? 'Needs Ollama running' : 'نیاز به اجرای برنامه Ollama دارد'
    };
  }
  return {
    isLocal: false,
    text: isEn ? 'Text is sent only to the selected provider' : 'متن فقط به ارائه‌دهنده انتخابی ارسال می‌شود'
  };
}

function updateWelcomePrivacyNotice() {
  const notice = $('welcomePrivacyNotice');
  const txt = $('welcomePrivacyText');
  if (!notice || !txt) return;

  const disc = getWelcomePrivacyDisclosure();
  txt.textContent = disc.text;
  if (disc.isLocal) {
    notice.classList.add('local');
    notice.style.borderColor = 'var(--success, rgba(16, 185, 129, 0.35))';
    notice.style.background = 'var(--success-bg, rgba(16, 185, 129, 0.08))';
    txt.style.color = 'var(--success, #10B981)';
  } else {
    notice.classList.remove('local');
    notice.style.borderColor = 'var(--border, rgba(8, 168, 255, 0.3))';
    notice.style.background = 'var(--hover, rgba(8, 168, 255, 0.06))';
    txt.style.color = 'var(--muted, #8496B0)';
  }
}

let welcomeLastFocusedElement = null;

function trapWelcomeFocus(e) {
  const ov = $('welcomeOverlay');
  if (!ov || ov.hidden || !ov.classList.contains('on')) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    skipWelcomeWizard();
    return;
  }

  if (e.key === 'Tab') {
    const focusable = ov.querySelectorAll('button:not([hidden]):not([disabled]), [href], input:not([hidden]):not([disabled]):not([type="hidden"]), select:not([hidden]):not([disabled]), textarea:not([hidden]):not([disabled]), [tabindex]:not([tabindex="-1"])');
    const visibleFocusable = Array.from(focusable).filter(el => el.offsetParent !== null && !el.closest('[hidden]'));
    if (!visibleFocusable.length) return;

    const first = visibleFocusable[0];
    const last = visibleFocusable[visibleFocusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first || !ov.contains(document.activeElement)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last || !ov.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    }
  }
}

function openWelcomeWizard(step = 1) {
  if (typeof closeSettings === 'function') closeSettings();
  const ov = $('welcomeOverlay');
  if (!ov) return;
  welcomeLastFocusedElement = document.activeElement;
  welcomeCurrentStep = step;
  ov.hidden = false;
  ov.classList.add('on');
  if (typeof welcomeSelectedEngine !== 'undefined' && welcomeSelectedEngine === 'ollama') checkWelcomeOllama();
  if (typeof mcScan === 'function') {
    mcScan().then(() => updateWelcomePrivacyNotice()).catch(() => {});
  }
  updateWelcomeStepUI();
  const pSel = $('welcomeKeyProvider');
  const kInp = $('welcomeApiKeyInput');
  if (pSel && kInp && typeof cfg !== 'undefined') {
    const p = pSel.value || 'gemini';
    const ex = cfg.eng?.[p]?.key || '';
    kInp.value = ex;
    const l4 = $('welcomeKeyLast4');
    if (l4) l4.textContent = ex.length > 4 ? `…${ex.slice(-4)}` : '';
  }
  setTimeout(() => {
    const pane = (welcomeCurrentStep === 4 ? ($('welcomeStepHow') || $('welcomeStep4')) : $('welcomeStep' + welcomeCurrentStep));
    const target = pane?.querySelector('input:checked, button:not([hidden]), [tabindex="0"]') || $('welcomeNextBtn') || $('welcomeSkipBtn');
    if (target && typeof target.focus === 'function') target.focus();
  }, 30);
}

function closeWelcomeWizard() {
  if (typeof closeSettings === 'function') closeSettings();
  const ov = $('welcomeOverlay');
  if (!ov) return;
  ov.classList.remove('on');
  ov.hidden = true;
  if (welcomeLastFocusedElement && typeof welcomeLastFocusedElement.focus === 'function') {
    try {
      welcomeLastFocusedElement.focus();
    } catch {}
  }
  welcomeLastFocusedElement = null;
}

function skipWelcomeWizard() {
  setWelcomeDone();
  closeWelcomeWizard();
}

function finishWelcomeWizard() {
  // Apply language choice
  if (ui !== welcomeSelectedLang) {
    ui = welcomeSelectedLang;
    store.set('ui', ui);
    applyI18n();
  }

  // Apply engine preference to cfg.order
  if (welcomeSelectedEngine === 'offline') {
    const idx = cfg.order.indexOf('nllb');
    if (idx > -1) {
      cfg.order.splice(idx, 1);
      cfg.order.unshift('nllb');
    }
    if ($('engine')) $('engine').value = 'nllb';
    store.set('engine', 'nllb');
  } else if (welcomeSelectedEngine === 'ollama') {
    const pSel = $('welcomeKeyProvider');
    const pref = pSel?.value || 'gemini';
    const keyProvider = (cfg.eng?.[pref]?.key) ? pref : (cfg.eng?.gemini?.key ? 'gemini' : (cfg.eng?.groq?.key ? 'groq' : (cfg.eng?.openrouter?.key ? 'openrouter' : '')));

    if (keyProvider) {
      const idx = cfg.order.indexOf(keyProvider);
      if (idx > -1) {
        cfg.order.splice(idx, 1);
        cfg.order.unshift(keyProvider);
      }
      if ($('engine')) $('engine').value = 'auto';
      store.set('engine', 'auto');
    } else if (welcomeOllamaReachable) {
      const idx = cfg.order.indexOf('ollama');
      if (idx > -1) {
        cfg.order.splice(idx, 1);
        cfg.order.unshift('ollama');
      }
      if ($('engine')) $('engine').value = 'ollama';
      store.set('engine', 'ollama');
    } else {
      const idx = cfg.order.indexOf('ollama');
      if (idx > -1) {
        cfg.order.splice(idx, 1);
        cfg.order.unshift('ollama');
      }
      if ($('engine')) $('engine').value = 'auto';
      store.set('engine', 'auto');
    }
  } else if (welcomeSelectedEngine === 'online') {
    if ($('engine')) $('engine').value = 'auto';
    store.set('engine', 'auto');
  }
  saveCfg();
  if (typeof fillEngines === 'function') fillEngines();

  // Apply package download if requested
  if (welcomeSelectedPackage === 'light' || welcomeSelectedPackage === 'full') {
    const nllbMdl = (MC.models || []).find(m => m.id === 'tr-nllb-600');
    if (nllbMdl && !mcReady(nllbMdl)) {
      mcDownload(nllbMdl);
    }
  }
  if (welcomeSelectedPackage === 'full') {
    const whisperMdl = (MC.models || []).find(m => m.id === 'asr-small');
    if (whisperMdl && !mcReady(whisperMdl)) {
      mcDownload(whisperMdl);
    }
  }

  setWelcomeDone();
  closeWelcomeWizard();
  const textTabBtn = document.querySelector('#tabs button[data-tab="text"]');
  if (textTabBtn) textTabBtn.click();
}

function initWelcomeKeyHandling() {
  const providerSel = $('welcomeKeyProvider');
  const keyInp = $('welcomeApiKeyInput');
  const toggleBtn = $('welcomeKeyToggleBtn');
  const last4 = $('welcomeKeyLast4');
  const savedHint = $('welcomeKeySavedHint');

  if (!providerSel || !keyInp) return;

  function syncKeyInput() {
    const p = providerSel.value || 'gemini';
    const existing = (typeof cfg !== 'undefined' && cfg.eng && cfg.eng[p] && cfg.eng[p].key) ? cfg.eng[p].key : '';
    keyInp.value = existing;
    if (last4) {
      last4.textContent = existing.length > 4 ? `…${existing.slice(-4)}` : '';
    }
    if (savedHint) savedHint.style.display = 'none';
  }

  function saveCurrentKey() {
    const p = providerSel.value || 'gemini';
    const val = keyInp.value.trim();
    if (typeof cfg !== 'undefined' && cfg.eng && cfg.eng[p]) {
      cfg.eng[p].key = val;
      if (typeof saveCfg === 'function') saveCfg();
      if (typeof fillEngines === 'function') fillEngines();
      if (typeof renderEngines === 'function') renderEngines();
    }
    if (last4) {
      last4.textContent = val.length > 4 ? `…${val.slice(-4)}` : '';
    }
    if (savedHint) {
      savedHint.style.display = val ? 'block' : 'none';
    }
  }

  providerSel.addEventListener('change', syncKeyInput);
  keyInp.addEventListener('input', saveCurrentKey);
  keyInp.addEventListener('change', saveCurrentKey);
  keyInp.addEventListener('blur', saveCurrentKey);

  toggleBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    if (keyInp.type === 'password') {
      keyInp.type = 'text';
      toggleBtn.textContent = '🔒';
    } else {
      keyInp.type = 'password';
      toggleBtn.textContent = '👁';
    }
  });

  syncKeyInput();
}

function initWelcomeWizard() {
  const ov = $('welcomeOverlay');
  if (!ov) return;

  initWelcomeKeyHandling();

  // Language choice cards
  document.querySelectorAll('[data-choice-lang]').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('[data-choice-lang]').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
      welcomeSelectedLang = card.dataset.choiceLang || 'fa';
      if (ui !== welcomeSelectedLang) {
        ui = welcomeSelectedLang;
        store.set('ui', ui);
        applyI18n();
      }
    });
  });

  // Engine choice cards
  document.querySelectorAll('[data-choice-engine]').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('[data-choice-engine]').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
      welcomeSelectedEngine = card.dataset.choiceEngine || 'offline';
      if (welcomeSelectedEngine === 'ollama') checkWelcomeOllama();
      if (welcomeSelectedEngine === 'offline' && typeof mcScan === 'function') {
        mcScan().then(() => updateWelcomePrivacyNotice()).catch(() => {});
      }
      updateWelcomePrivacyNotice();
    });
  });

  // Package choice cards
  document.querySelectorAll('[data-choice-package]').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('[data-choice-package]').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
      welcomeSelectedPackage = card.dataset.choicePackage || 'none';
    });
  });

  // Next button
  $('welcomeNextBtn')?.addEventListener('click', () => {
    if (welcomeCurrentStep < 5) {
      welcomeCurrentStep++;
      saveWelcomeStep(welcomeCurrentStep);
      updateWelcomeStepUI();
    }
  });

  // Back button
  $('welcomeBackBtn')?.addEventListener('click', () => {
    if (welcomeCurrentStep > 1) {
      welcomeCurrentStep--;
      saveWelcomeStep(welcomeCurrentStep);
      updateWelcomeStepUI();
    }
  });

  // Skip button
  $('welcomeSkipBtn')?.addEventListener('click', () => {
    skipWelcomeWizard();
  });

  // Keyboard navigation & trap
  document.removeEventListener('keydown', trapWelcomeFocus);
  document.addEventListener('keydown', trapWelcomeFocus);

  // Finish button
  $('welcomeFinishBtn')?.addEventListener('click', () => {
    finishWelcomeWizard();
  });

  // Dedicated button to Text tab
  $('welcomeGoTextBtn')?.addEventListener('click', () => {
    finishWelcomeWizard();
  });

  // Reopen button in Settings
  $('btnReopenWelcome')?.addEventListener('click', () => {
    $('closeSet')?.click();
    openWelcomeWizard(1);
  });

  // First run check
  if (!isWelcomeDone()) {
    const savedStep = getSavedWelcomeStep();
    openWelcomeWizard(savedStep);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWelcomeWizard);
  } else {
    initWelcomeWizard();
  }
}
