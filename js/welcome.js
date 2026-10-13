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
    return (s >= 1 && s <= 4) ? s : 1;
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
  for (let i = 1; i <= 4; i++) {
    const pane = $('welcomeStep' + i);
    if (pane) pane.hidden = (i !== welcomeCurrentStep);
  }

  // Footer buttons
  const backBtn = $('welcomeBackBtn');
  const nextBtn = $('welcomeNextBtn');
  const finishBtn = $('welcomeFinishBtn');

  if (backBtn) backBtn.hidden = (welcomeCurrentStep === 1);
  if (nextBtn) nextBtn.hidden = (welcomeCurrentStep === 4);
  if (finishBtn) finishBtn.hidden = (welcomeCurrentStep !== 4);

  // Update summary card on step 4
  if (welcomeCurrentStep === 4) {
    const sumLang = $('welcomeSummaryLang');
    const sumEng = $('welcomeSummaryEngine');
    const sumPriv = $('welcomeSummaryPrivacy');
    const sumKeyRow = $('welcomeSummaryKeyRow');
    const sumKey = $('welcomeSummaryKey');
    const sumPkg = $('welcomeSummaryPkg');
    const sumStatus = $('welcomeSummaryStatus');

    if (sumLang) sumLang.textContent = welcomeSelectedLang === 'fa' ? 'فارسی (Persian)' : 'English';

    const engNames = {
      offline: 'آفلاین (NLLB)',
      ollama: 'هوشمند (Ollama)',
      online: 'سریع (Google / MyMemory)'
    };
    if (sumEng) sumEng.textContent = engNames[welcomeSelectedEngine] || welcomeSelectedEngine;

    if (sumPriv) {
      const disc = getWelcomePrivacyDisclosure();
      sumPriv.textContent = disc.text;
      sumPriv.style.color = disc.isLocal ? '#3FB950' : 'var(--text-dim, #B5C2D4)';
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
      vBadge.style.color = '#3FB950';
    } else {
      vBadge.textContent = vR.reason ? `${vR.reason} (محدود)` : 'آماده نیست (Not ready)';
      vBadge.style.color = 'var(--text-dim, #B5C2D4)';
    }
  }

  if (sBadge) {
    const isDesktop = !!(window.makanDesktop?.isDesktop);
    if (isDesktop) {
      sBadge.textContent = 'متصل به دسکتاپ ✓ (Connected)';
      sBadge.style.color = '#3FB950';
    } else {
      sBadge.textContent = 'محیط مرورگر وب (Web browser)';
      sBadge.style.color = 'var(--text-dim, #B5C2D4)';
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
let welcomeOllamaChecking = false;

function isWelcomeNllbReady() {
  if (typeof MC === 'undefined' || !MC.models) return false;
  const nllb = MC.models.find(m => m.id === 'tr-nllb-600');
  return (typeof mcReady === 'function' && nllb) ? mcReady(nllb) : false;
}

async function checkWelcomeOllama() {
  if (typeof engineConnStatus !== 'undefined' && engineConnStatus?.ollama?.code === 'works') {
    welcomeOllamaReachable = true;
    updateWelcomePrivacyNotice();
    return;
  }
  if (welcomeOllamaChecking) return;
  welcomeOllamaChecking = true;
  try {
    const host = (typeof getOllamaHost === 'function') ? getOllamaHost() : 'http://localhost:11434';
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 1200);
    const res = await fetch(host + '/api/tags', { signal: ctrl.signal }).catch(() => null);
    clearTimeout(to);
    welcomeOllamaReachable = !!(res && res.ok);
  } catch (e) {
    welcomeOllamaReachable = false;
  } finally {
    welcomeOllamaChecking = false;
    updateWelcomePrivacyNotice();
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
        text: isEn ? 'Text is sent to the chosen AI provider' : 'متن به ارائه‌دهنده انتخابی هوش مصنوعی ارسال می‌شود'
      };
    }
    return {
      isLocal: false,
      text: isEn ? 'Needs Ollama running' : 'نیاز به اجرای برنامه Ollama دارد'
    };
  }
  return {
    isLocal: false,
    text: isEn ? 'Text is sent to the chosen provider' : 'متن به ارائه‌دهنده انتخابی ارسال می‌شود'
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
    notice.style.borderColor = 'rgba(63, 185, 80, 0.35)';
    notice.style.background = 'rgba(63, 185, 80, 0.08)';
    txt.style.color = '#3FB950';
  } else {
    notice.classList.remove('local');
    notice.style.borderColor = 'rgba(8, 168, 255, 0.3)';
    notice.style.background = 'rgba(8, 168, 255, 0.06)';
    txt.style.color = 'var(--text-dim, #B5C2D4)';
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
  const ov = $('welcomeOverlay');
  if (!ov) return;
  welcomeLastFocusedElement = document.activeElement;
  welcomeCurrentStep = step;
  ov.hidden = false;
  ov.classList.add('on');
  checkWelcomeOllama();
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
    const pane = $('welcomeStep' + welcomeCurrentStep);
    const target = pane?.querySelector('input:checked, button:not([hidden]), [tabindex="0"]') || $('welcomeNextBtn') || $('welcomeSkipBtn');
    if (target && typeof target.focus === 'function') target.focus();
  }, 30);
}

function closeWelcomeWizard() {
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
    const idx = cfg.order.indexOf('ollama');
    if (idx > -1) {
      cfg.order.splice(idx, 1);
      cfg.order.unshift('ollama');
    }
    if ($('engine')) $('engine').value = 'ollama';
    store.set('engine', 'ollama');
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
    if (welcomeCurrentStep < 4) {
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
