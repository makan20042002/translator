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

    if (sumLang) sumLang.textContent = welcomeSelectedLang === 'fa' ? 'فارسی (Persian)' : 'English';

    const engNames = {
      offline: 'Offline (NLLB)',
      ollama: 'Ollama (Local AI)',
      online: 'Online (Cloud Engines)'
    };
    if (sumEng) sumEng.textContent = engNames[welcomeSelectedEngine] || welcomeSelectedEngine;

    if (sumPriv) {
      if (welcomeSelectedEngine === 'offline' || welcomeSelectedEngine === 'ollama') {
        sumPriv.textContent = L('screenPrivacyLocal') || 'Everything stays on this device';
        sumPriv.style.color = '#3FB950';
      } else {
        sumPriv.textContent = L('screenPrivacyCloud') || 'Online engine (selected provider)';
        sumPriv.style.color = 'var(--text-dim, #B5C2D4)';
      }
    }
  }

  // Update conditional privacy notice in Step 2
  updateWelcomePrivacyNotice();
}

function updateWelcomePrivacyNotice() {
  const notice = $('welcomePrivacyNotice');
  const txt = $('welcomePrivacyText');
  if (!notice || !txt) return;

  if (welcomeSelectedEngine === 'offline' || welcomeSelectedEngine === 'ollama') {
    txt.textContent = L('screenPrivacyLocal') || 'Everything stays on this device';
    notice.classList.add('local');
    notice.style.borderColor = 'rgba(63, 185, 80, 0.35)';
    notice.style.background = 'rgba(63, 185, 80, 0.08)';
    txt.style.color = '#3FB950';
  } else {
    txt.textContent = L('screenPrivacyCloud') || 'Online engine: text is sent only to the selected provider';
    notice.classList.remove('local');
    notice.style.borderColor = 'rgba(8, 168, 255, 0.3)';
    notice.style.background = 'rgba(8, 168, 255, 0.06)';
    txt.style.color = 'var(--text-dim, #B5C2D4)';
  }
}

function openWelcomeWizard(step = 1) {
  const ov = $('welcomeOverlay');
  if (!ov) return;
  welcomeCurrentStep = step;
  ov.hidden = false;
  ov.classList.add('on');
  updateWelcomeStepUI();
}

function closeWelcomeWizard() {
  const ov = $('welcomeOverlay');
  if (!ov) return;
  ov.classList.remove('on');
  ov.hidden = true;
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
}

function initWelcomeWizard() {
  const ov = $('welcomeOverlay');
  if (!ov) return;

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
    finishWelcomeWizard();
  });

  // Finish button
  $('welcomeFinishBtn')?.addEventListener('click', () => {
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
