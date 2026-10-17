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

  // Synchronous, CSP-immune CSS injection into Shadow DOM
  const CARD_CSS = "/* MAKAN Translate - Shadow DOM Content Styles */\r\n:host {\r\n  all: initial;\r\n  font-family: 'Manrope', 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;\r\n  font-size: 14px;\r\n  line-height: 1.5;\r\n  color: #EAF1F7;\r\n  --bg: #05070D;\r\n  --surface: #0B111C;\r\n  --surface2: #101826;\r\n  --glass: rgba(11, 17, 28, 0.94);\r\n  --border: rgba(255, 255, 255, 0.10);\r\n  --border2: rgba(255, 255, 255, 0.16);\r\n  --accent: #58A6FF;\r\n  --accent-dim: rgba(88, 166, 255, 0.14);\r\n  --green: #22E58A;\r\n  --cyan: #13C8F5;\r\n  --blue: #3B6BFF;\r\n  --grad: linear-gradient(100deg, #22E58A 0%, #13C8F5 50%, #3B6BFF 100%);\r\n  --cta: #FFB44A;\r\n  --cta-ink: #16110A;\r\n  --text: #EAF1F7;\r\n  --muted: #93A1B5;\r\n  --faint: #5E6B7E;\r\n  --r-s: 8px;\r\n  --r-m: 14px;\r\n  --r-l: 20px;\r\n}\r\n\r\n*, *::before, *::after {\r\n  box-sizing: border-box;\r\n}\r\n\r\n/* Floating MAKAN Action Button */\r\n.makan-btn-float {\r\n  position: absolute;\r\n  z-index: 2147483647;\r\n  width: 28px;\r\n  height: 28px;\r\n  border-radius: 8px;\r\n  background: var(--surface);\r\n  border: 1px solid var(--accent);\r\n  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 10px rgba(88, 166, 255, 0.3);\r\n  display: flex;\r\n  align-items: center;\r\n  justify-content: center;\r\n  cursor: pointer;\r\n  transform: scale(0.92);\r\n  transition: transform 0.16s cubic-bezier(0.2, 0.8, 0.4, 1), box-shadow 0.16s ease;\r\n  user-select: none;\r\n  pointer-events: auto !important;\r\n}\r\n\r\n.makan-btn-float:hover {\r\n  transform: scale(1.08);\r\n  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5), 0 0 14px rgba(88, 166, 255, 0.5);\r\n  border-color: #79b8ff;\r\n}\r\n\r\n.makan-mark-ico {\r\n  width: 18px;\r\n  height: 18px;\r\n  border-radius: 4px;\r\n  background: var(--grad);\r\n  display: grid;\r\n  place-items: center;\r\n  color: #03111A;\r\n  font-size: 11px;\r\n  font-weight: 800;\r\n  font-family: 'Space Grotesk', sans-serif;\r\n  line-height: 1;\r\n}\r\n\r\n/* Compact Translation Card */\r\n.makan-card {\r\n  position: absolute;\r\n  z-index: 2147483647;\r\n  width: 370px;\r\n  min-width: 280px;\r\n  max-width: calc(100vw - 32px);\r\n  max-height: 480px;\r\n  background: var(--glass);\r\n  backdrop-filter: blur(16px);\r\n  -webkit-backdrop-filter: blur(16px);\r\n  border: 1px solid var(--border2);\r\n  border-radius: var(--r-m);\r\n  box-shadow: 0 20px 48px -8px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.08);\r\n  pointer-events: auto !important;\r\n  display: flex;\r\n  flex-direction: column;\r\n  overflow: hidden;\r\n  animation: makanFadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);\r\n  box-sizing: border-box;\r\n}\r\n\r\n@keyframes makanFadeIn {\r\n  from { opacity: 0; transform: translateY(6px) scale(0.97); }\r\n  to { opacity: 1; transform: translateY(0) scale(1); }\r\n}\r\n\r\n.makan-card-header {\r\n  position: relative;\r\n  display: flex;\r\n  align-items: center;\r\n  flex-wrap: wrap;\r\n  row-gap: 6px;\r\n  column-gap: 6px;\r\n  padding-block: 8px;\r\n  padding-inline-start: 10px;\r\n  padding-inline-end: 36px;\r\n  background: rgba(255, 255, 255, 0.03);\r\n  border-bottom: 1px solid var(--border);\r\n  user-select: none;\r\n  min-width: 0;\r\n  box-sizing: border-box;\r\n}\r\n\r\n.makan-card-brand {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 6px;\r\n  font-weight: 700;\r\n  font-size: 12.5px;\r\n  letter-spacing: 0.02em;\r\n  color: var(--text);\r\n  flex-shrink: 0;\r\n  white-space: nowrap;\r\n}\r\n\r\n.makan-card-brand span {\r\n  color: var(--accent);\r\n}\r\n\r\n.makan-mode-select {\r\n  font-size: 11px;\r\n  font-weight: 600;\r\n  padding: 2px 6px;\r\n  border-radius: 6px;\r\n  background: var(--surface2);\r\n  border: 1px solid var(--border);\r\n  color: var(--text);\r\n  outline: none;\r\n  cursor: pointer;\r\n  box-sizing: border-box;\r\n  flex-shrink: 0;\r\n}\r\n\r\n.makan-pill {\r\n  font-size: 11px;\r\n  font-weight: 600;\r\n  padding: 2px 7px;\r\n  border-radius: 6px;\r\n  background: var(--surface2);\r\n  border: 1px solid var(--border);\r\n  color: var(--muted);\r\n  white-space: nowrap;\r\n  box-sizing: border-box;\r\n  flex-shrink: 0;\r\n}\r\n\r\n.makan-pill.engine {\r\n  color: var(--accent);\r\n  background: var(--accent-dim);\r\n  border-color: rgba(88, 166, 255, 0.3);\r\n  max-width: 140px;\r\n  overflow: hidden;\r\n  text-overflow: ellipsis;\r\n  white-space: nowrap;\r\n  flex-shrink: 1;\r\n  min-width: 0;\r\n}\r\n\r\n.makan-pill.detected {\r\n  color: var(--green);\r\n  background: rgba(34, 229, 138, 0.12);\r\n  border-color: rgba(34, 229, 138, 0.28);\r\n}\r\n\r\n.makan-icon-btn {\r\n  background: transparent;\r\n  border: none;\r\n  color: var(--muted);\r\n  width: 26px;\r\n  height: 26px;\r\n  border-radius: 6px;\r\n  display: grid;\r\n  place-items: center;\r\n  cursor: pointer;\r\n  padding: 0;\r\n  transition: background 0.15s ease, color 0.15s ease;\r\n}\r\n\r\n#makanCardClose {\r\n  position: absolute;\r\n  inset-block-start: 7px;\r\n  inset-inline-end: 7px;\r\n  z-index: 2;\r\n}\r\n\r\n.makan-icon-btn:hover {\r\n  background: var(--surface2);\r\n  color: var(--text);\r\n}\r\n\r\n.makan-card-body {\r\n  padding: 14px;\r\n  overflow-y: auto;\r\n  max-height: 260px;\r\n  min-height: 60px;\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 8px;\r\n  font-size: 14.5px;\r\n  line-height: 1.6;\r\n  color: var(--text);\r\n}\r\n\r\n.makan-loading {\r\n  display: flex;\r\n  align-items: center;\r\n  justify-content: center;\r\n  gap: 8px;\r\n  color: var(--muted);\r\n  font-size: 13px;\r\n  padding: 20px 0;\r\n}\r\n\r\n.makan-spin {\r\n  animation: makanSpin 0.9s linear infinite;\r\n}\r\n\r\n@keyframes makanSpin {\r\n  100% { transform: rotate(360deg); }\r\n}\r\n\r\n.makan-result-text {\r\n  white-space: pre-wrap;\r\n  word-break: break-word;\r\n  user-select: text;\r\n}\r\n\r\n.makan-result-text[dir=\"rtl\"] {\r\n  font-family: 'Vazirmatn', Tahoma, sans-serif;\r\n  text-align: right;\r\n  font-size: 15px;\r\n  line-height: 1.7;\r\n}\r\n\r\n/* Dictionary card style */\r\n.makan-dict-wrap {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 8px;\r\n}\r\n\r\n.makan-dict-head {\r\n  display: flex;\r\n  align-items: baseline;\r\n  gap: 8px;\r\n}\r\n\r\n.makan-dict-word {\r\n  font-size: 18px;\r\n  font-weight: 700;\r\n  color: #fff;\r\n}\r\n\r\n.makan-dict-phonetic {\r\n  font-family: monospace;\r\n  font-size: 12px;\r\n  color: var(--muted);\r\n}\r\n\r\n.makan-dict-pos {\r\n  font-size: 11px;\r\n  font-weight: 600;\r\n  text-transform: uppercase;\r\n  background: rgba(34, 229, 138, 0.15);\r\n  color: var(--green);\r\n  border: 1px solid rgba(34, 229, 138, 0.3);\r\n  padding: 1px 6px;\r\n  border-radius: 4px;\r\n}\r\n\r\n.makan-dict-trans {\r\n  font-size: 15.5px;\r\n  font-weight: 600;\r\n  color: var(--cta);\r\n}\r\n\r\n.makan-dict-def {\r\n  font-size: 13px;\r\n  color: var(--muted);\r\n  line-height: 1.5;\r\n  border-inline-start: 2px solid var(--accent);\r\n  padding-inline-start: 8px;\r\n}\r\n\r\n.makan-dict-ex {\r\n  font-size: 12.5px;\r\n  color: #cbd5e1;\r\n  font-style: italic;\r\n  background: var(--surface2);\r\n  padding: 6px 10px;\r\n  border-radius: 6px;\r\n}\r\n\r\n/* Card Footer Toolbar */\r\n.makan-card-footer {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 6px;\r\n  padding: 8px 12px;\r\n  background: rgba(0, 0, 0, 0.25);\r\n  border-top: 1px solid var(--border);\r\n}\r\n\r\n.makan-action-btn {\r\n  display: inline-flex;\r\n  align-items: center;\r\n  gap: 6px;\r\n  height: 28px;\r\n  padding: 0 10px;\r\n  border-radius: 6px;\r\n  border: 1px solid var(--border);\r\n  background: var(--surface2);\r\n  color: var(--muted);\r\n  font-size: 12px;\r\n  font-weight: 600;\r\n  cursor: pointer;\r\n  transition: all 0.15s ease;\r\n}\r\n\r\n.makan-action-btn:hover {\r\n  background: rgba(255, 255, 255, 0.08);\r\n  color: var(--text);\r\n  border-color: var(--border2);\r\n}\r\n\r\n.makan-action-btn.active {\r\n  color: var(--ok);\r\n  border-color: var(--ok);\r\n}\r\n\r\n.makan-action-btn.preparing {\r\n  color: #ffbe53;\r\n  border-color: #ffbe53;\r\n  background: rgba(255, 190, 83, 0.16);\r\n  box-shadow: 0 0 10px rgba(255, 190, 83, 0.35);\r\n  animation: makanPulseAudio 0.8s ease-in-out infinite alternate;\r\n}\r\n\r\n.makan-action-btn.playing {\r\n  color: var(--cyan);\r\n  border-color: var(--cyan);\r\n  background: rgba(19, 200, 245, 0.16);\r\n  box-shadow: 0 0 10px rgba(19, 200, 245, 0.35);\r\n  animation: makanPulseAudio 1.2s ease-in-out infinite alternate;\r\n}\r\n\r\n@keyframes makanPulseAudio {\r\n  from { box-shadow: 0 0 4px currentColor; opacity: 0.85; }\r\n  to { box-shadow: 0 0 12px currentColor; opacity: 1; }\r\n}\r\n\r\n.makan-voice-notice {\r\n  font-size: 12px;\r\n  line-height: 1.45;\r\n  color: #ffbe53;\r\n  background: rgba(255, 180, 74, 0.10);\r\n  border: 1px solid rgba(255, 180, 74, 0.3);\r\n  padding: 8px 10px;\r\n  border-radius: 6px;\r\n  margin-top: 6px;\r\n  word-break: break-word;\r\n}\r\n\r\n.makan-sp {\r\n  flex: 1;\r\n}\r\n\r\n.makan-open-app-btn {\r\n  color: var(--accent);\r\n  text-decoration: none;\r\n  font-size: 12px;\r\n  font-weight: 600;\r\n  display: inline-flex;\r\n  align-items: center;\r\n  gap: 4px;\r\n  padding: 4px 8px;\r\n  border-radius: 6px;\r\n}\r\n\r\n.makan-open-app-btn:hover {\r\n  background: var(--accent-dim);\r\n  text-decoration: none;\r\n}\r\n\r\n/* Full Page Translation Floating Top Banner */\r\n.makan-top-banner {\r\n  position: fixed;\r\n  top: 12px;\r\n  left: 50%;\r\n  transform: translateX(-50%);\r\n  z-index: 2147483646;\r\n  background: var(--glass);\r\n  backdrop-filter: blur(18px);\r\n  -webkit-backdrop-filter: blur(18px);\r\n  border: 1px solid var(--border2);\r\n  border-radius: 40px;\r\n  padding: 6px 16px;\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 12px;\r\n  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.08);\r\n  animation: makanBannerDrop 0.25s cubic-bezier(0.16, 1, 0.3, 1);\r\n  font-size: 13px;\r\n  pointer-events: auto !important;\r\n}\r\n\r\n@keyframes makanBannerDrop {\r\n  from { opacity: 0; transform: translate(-50%, -20px); }\r\n  to { opacity: 1; transform: translate(-50%, 0); }\r\n}\r\n\r\n.makan-banner-btn {\r\n  height: 28px;\r\n  padding: 0 12px;\r\n  border-radius: 20px;\r\n  border: 1px solid var(--border);\r\n  background: var(--surface2);\r\n  color: var(--text);\r\n  font-size: 12px;\r\n  font-weight: 600;\r\n  cursor: pointer;\r\n  transition: all 0.15s ease;\r\n}\r\n\r\n.makan-banner-btn:hover {\r\n  background: rgba(255, 255, 255, 0.12);\r\n  border-color: var(--accent);\r\n}\r\n\r\n.makan-banner-btn.cta {\r\n  background: var(--cta);\r\n  color: var(--cta-ink);\r\n  border-color: var(--cta);\r\n}\r\n\r\n.makan-banner-btn.cta:hover {\r\n  background: #ffc470;\r\n}\r\n\r\n/* Hover Tooltip for translated elements */\r\n.makan-tooltip {\r\n  position: absolute;\r\n  z-index: 2147483647;\r\n  max-width: 380px;\r\n  background: #080C14;\r\n  border: 1px solid var(--accent);\r\n  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.7);\r\n  border-radius: 8px;\r\n  padding: 8px 12px;\r\n  font-size: 12.5px;\r\n  line-height: 1.5;\r\n  color: #E2E8F0;\r\n  pointer-events: none;\r\n  animation: makanFadeIn 0.12s ease;\r\n}\r\n\r\n.makan-tooltip-lbl {\r\n  font-size: 10px;\r\n  font-weight: 700;\r\n  text-transform: uppercase;\r\n  letter-spacing: 0.08em;\r\n  color: var(--accent);\r\n  margin-bottom: 2px;\r\n}\r\n\r\n/* In-Page Toast Notification (Replaces chrome.notifications) */\r\n.makan-inpage-toast {\r\n  position: fixed;\r\n  top: 16px;\r\n  right: 16px;\r\n  z-index: 2147483647;\r\n  background: var(--surface2, #101826);\r\n  color: var(--text, #EAF1F7);\r\n  border: 1px solid var(--accent, #58A6FF);\r\n  border-radius: 10px;\r\n  padding: 10px 16px;\r\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Vazirmatn', sans-serif;\r\n  font-size: 13px;\r\n  line-height: 1.45;\r\n  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.08);\r\n  pointer-events: auto;\r\n  max-width: 360px;\r\n  opacity: 0;\r\n  transform: translateY(-8px);\r\n  transition: opacity 0.25s ease, transform 0.25s ease;\r\n}\r\n\r\n.makan-inpage-toast.visible {\r\n  opacity: 1;\r\n  transform: translateY(0);\r\n}\r\n\r\n.makan-mode-select {\r\n  font-size: 11px;\r\n  font-weight: 600;\r\n  padding: 2px 6px;\r\n  border-radius: 6px;\r\n  background: var(--surface2);\r\n  border: 1px solid var(--border);\r\n  color: var(--text);\r\n  cursor: pointer;\r\n  outline: none;\r\n}\r\n\r\n.makan-pill-fast {\r\n  font-size: 10px;\r\n  padding: 1px 4px;\r\n  border-radius: 4px;\r\n  background: rgba(255, 190, 83, 0.2);\r\n  color: #ffbe53;\r\n  font-weight: 700;\r\n  margin-inline-end: 3px;\r\n}\r\n\r\n.calm-fade {\r\n  animation: makanCalmFade 0.35s ease-out;\r\n}\r\n\r\n@keyframes makanCalmFade {\r\n  from { opacity: 0.5; }\r\n  to { opacity: 1; }\r\n}\r\n\r\n.makan-lang-row {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 6px;\r\n  padding: 4px 12px 0;\r\n}\r\n.makan-lang-select {\r\n  min-width: 0;\r\n  max-width: 45%;\r\n  flex: 1 1 0;\r\n  text-overflow: ellipsis;\r\n}\r\n.makan-lang-arrow {\r\n  color: var(--muted);\r\n  font-size: 12px;\r\n}\r\n\r\n.makan-banner-text { font-weight: 600; }\r\n.makan-err { color: var(--err); font-size: 13px; margin-bottom: 8px; }\r\n.makan-empty { color: var(--muted); font-size: 13.5px; padding: 12px 4px; }\r\n.makan-dict-ex2 { color: #94a3b8; }\r\n\r\n.makan-voice-used { font-size: 11px; color: var(--muted); margin-top: 6px; }\r\n.makan-voice-retry { margin-inline-start: 8px; font-size: 11px; padding: 1px 8px; border-radius: 6px; background: var(--surface2); border: 1px solid var(--border); color: var(--text); cursor: pointer; }\r\n\r\n.makan-dict-badge { margin-inline-start: 8px; font-size: 10px; padding: 1px 6px; border-radius: 6px; border: 1px solid var(--border); color: var(--muted); }\r\n.makan-dict-form { font-size: 11px; color: var(--muted); margin-top: 4px; }\r\n.makan-dict-extra { font-size: 12px; color: var(--muted); margin-top: 6px; }\r\n.makan-dict-ai { margin-top: 8px; padding-top: 6px; border-top: 1px dashed var(--border); }\r\n.makan-dict-ai[hidden] { display: none; }\r\n\r\n/* Finglish: the Persian spelling shown above the translation */\r\n.makan-fg { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 0 0 8px; padding: 6px 10px; border: 1px solid var(--border, #2a3340); border-radius: 8px; font-size: 13px; }\r\n.makan-fg[hidden] { display: none; }\r\n.makan-fg-lab { color: var(--cyan, #58a6ff); font-size: 11.5px; }\r\n.makan-fg-text { flex: 1; min-width: 120px; font-size: 15px; unicode-bidi: plaintext; }\r\n";
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(CARD_CSS);
    shadow.adoptedStyleSheets = [sheet];
  } catch {}


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
  // Gemini voice plays in the background, and each speech there has a number. Updates about other
  // speeches (an older one stopping, one in another tab) must not change this card's Speak button.
  let speakBackendToken = null;      // our speech's number, once the background has told us
  let speakWaitingForStart = false;  // true between asking the background to speak and its answer
  let heldStates = [];               // updates that arrive before we know our number

  function stopCurrentSpeech(tellBackground = true) {
    currentSpeakToken++;
    isAudioPlaying = false;
    speakBackendToken = null;
    speakWaitingForStart = false;
    heldStates = [];
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
    if (tellBackground) {
      try {
        askBackground({ action: 'stop-tts' }).catch(() => {});
      } catch {}
    }
  }

  // ---- Voice line under the translation: which voice is used, why there is no sound (with Retry), and the Edge hint ----
  const isEdgeBrowser = /\bEdg\//.test(navigator.userAgent || '');
  let lastSpeak = null;
  function voiceLine(container, kind) {
    if (!container) return null;
    let n = container.querySelector('.makan-voice-' + kind);
    if (!n) {
      n = document.createElement('div');
      n.className = 'makan-voice-' + kind;
      container.appendChild(n);
    }
    return n;
  }
  function showVoiceUsed(container, label) {
    const n = voiceLine(container, 'used');
    if (n) n.textContent = label ? 'Voice: ' + label : '';
  }
  // text: one plain line. retry: a function (shows a Retry button), onClose: called when the user dismisses it.
  function showVoiceNotice(container, text, retry, onClose) {
    const n = voiceLine(container, 'notice');
    if (!n) return;
    n.replaceChildren();
    const msg = document.createElement('span');
    msg.textContent = text;
    n.appendChild(msg);
    if (retry) {
      const b = document.createElement('button');
      b.className = 'makan-voice-retry';
      b.textContent = 'Retry';
      b.onclick = e => { if (!e.isTrusted) return; e.stopPropagation(); n.remove(); retry(); };
      n.appendChild(b);
    }
    const x = document.createElement('button');
    x.className = 'makan-voice-retry';
    x.textContent = '✕';
    x.title = 'Dismiss';
    x.onclick = e => { if (!e.isTrusted) return; e.stopPropagation(); n.remove(); if (onClose) onClose(); };
    n.appendChild(x);
    n.style.display = 'block';
  }
  function speakFailure(container, rawError, retry) {
    showVoiceNotice(container, 'Gemini voice: ' + plainFailure(rawError), retry);
  }

  async function handleSpeakClick(text, lang, btn, noticeContainer) {
    if (!text || !text.trim()) return;

    // Second click stops speech immediately
    if (isAudioPlaying && activePlayingBtn === btn) {
      stopCurrentSpeech();
      return;
    }

    // Starting a new speech: the background replaces any earlier one by itself, so do not send a stop
    // that could arrive after the new speech has begun and cancel it.
    stopCurrentSpeech(false);
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
    lastSpeak = { token, text, lang, btn, noticeContainer };
    const retrySpeak = () => handleSpeakClick(text, lang, btn, noticeContainer);
    { const old = noticeContainer && noticeContainer.querySelector('.makan-voice-notice'); if (old) old.remove(); }

    // Use Gemini TTS if preferGemini is true OR no matching browser voice exists for this language
    if (preferGemini || !voice) {
      let ttsRes = null;
      speakWaitingForStart = true;
      heldStates = [];
      showVoiceUsed(noticeContainer, `Gemini (${cfg?.tts?.geminiVoice || 'Kore'})`);
      ttsRes = await askBackground({
        action: 'play-gemini-tts',
        text,
        voice: cfg?.tts?.geminiVoice,
        rate: cfg?.tts?.rate
      });
      speakWaitingForStart = false;

      if (token !== currentSpeakToken) return;

      if (ttsRes && ttsRes.ok) {
        speakBackendToken = typeof ttsRes.token === 'number' ? ttsRes.token : null;
        const held = heldStates;
        heldStates = [];
        for (const st of held) if (speakBackendToken !== null && st.token === speakBackendToken) applyTtsState(st);
        // No device voice for this language, so Gemini was chosen automatically: say once that Edge has natural voices.
        if (isAudioPlaying && !voice && !isEdgeBrowser && !cfg?.edgeHintOff && (!noticeContainer || !noticeContainer.querySelector('.makan-voice-notice span'))) {
          showVoiceNotice(noticeContainer, 'Microsoft Edge has built-in natural voices for this language.', null,
            () => { cfg.edgeHintOff = true; askBackground({ action: 'dismiss-edge-hint' }); });
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

      // Gemini voice did not start. With a device voice, that voice takes over; without one, say why.
      if (voice) {
        // proceed below to browser speech synthesis
      } else {
        // CRITICAL: NEVER speak with a voice of a different language!
        cleanup();
        showVoiceUsed(noticeContainer, '');
        if (/not configured|key missing/i.test(String(ttsRes?.error || ''))) {
          const msg = typeof getNoVoiceMessage === 'function'
            ? getNoVoiceMessage(lang, cfg?.ui || 'en')
            : `No voice installed for ${lang}. Add voice in Windows settings or configure Gemini API key in MAKAN Options.`;
          showVoiceNotice(noticeContainer, msg + (!isEdgeBrowser ? ' Microsoft Edge has built-in natural voices for this language.' : ''));
        } else {
          speakFailure(noticeContainer, ttsRes?.error, retrySpeak);
        }
        return;
      }
    }

    showVoiceUsed(noticeContainer, `${voice.name} (device)`);
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

  // Fallback link only if adoptedStyleSheets is not supported
  if (!('adoptedStyleSheets' in shadow)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    try { link.href = (window.browser?.runtime?.getURL || window.chrome?.runtime?.getURL)?.('content.css') || 'http://localhost:8080/extension/content.css'; }
    catch { link.href = 'http://localhost:8080/extension/content.css'; }
    shadow.appendChild(link);
  }

  // If the page's policy refuses something of ours, remember it so a failure can say so plainly.
  let lastCspBlock = null;
  document.addEventListener('securitypolicyviolation', e => {
    const b = String(e.blockedURI || '');
    if (/^(chrome|moz)-extension:/.test(b) || /^(chrome|moz)-extension:/.test(String(e.sourceFile || '')) || /makan/i.test(b)) lastCspBlock = Date.now();
  }, true);
  const cspBlockedReason = () => (lastCspBlock && Date.now() - lastCspBlock < 120000 ? "blocked by this site's security policy" : '');

  // Load config from background
  async function refreshConfig() {
    try {
      const res = await askBackground({ action: 'get-public-config' });
      if (res && res.ok && res.cfg) cfg = res.cfg;
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
  function isRtlText(str) {
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(str || '');
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
    let detectedLang = isRtlText(text) ? 'fa' : 'en';
    const isSingleWord = isWord || (!text.includes(' ') && text.length <= 32);

    const hasAiAvailable = !!cfg?.hasAi;
    let cardMode = cfg?.transMode || (hasAiAvailable ? 'both' : 'fast');

    card.innerHTML = `
      <div class="makan-card-header">
        <div class="makan-card-brand">
          <div class="makan-mark-ico">M</div>
          MAKAN<span>Translate</span>
        </div>
        <span class="makan-pill" id="makanPairPill">${escapeHtml(curSrc.toUpperCase())} → ${escapeHtml(curTgt.toUpperCase())}</span>
        <select class="makan-mode-select" id="makanModeSel" title="Mode">
          <option value="both"${cardMode === 'both' ? ' selected' : ''}>Both</option>
          <option value="fast"${cardMode === 'fast' ? ' selected' : ''}>Fast</option>
          <option value="smart"${cardMode === 'smart' ? ' selected' : ''}>Smart</option>
        </select>
        <span class="makan-pill detected" id="makanDetectedPill">Detected: ${detectedLang.toUpperCase()}</span>
        <span class="makan-pill engine" id="makanEnginePill" title="Translating…">Translating…</span>
        <button class="makan-icon-btn" id="makanCardClose" title="Close (Esc)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="makan-lang-row">
        <select class="makan-mode-select makan-lang-select" id="makanSrcSel" aria-label="Source language"></select>
        <span class="makan-lang-arrow">→</span>
        <select class="makan-mode-select makan-lang-select" id="makanTgtSel" aria-label="Target language"></select>
      </div>
      <div class="makan-fg" id="makanFg" hidden></div>
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
    openAppBtn.addEventListener('click', async e => {
      e.stopPropagation();
      e.preventDefault();
      try {
        const resp = await askBackground({
          action: 'open-in-app',
          text: (text || '').slice(0, 2000),
          src: curSrc,
          tgt: curTgt
        });
        if (resp && resp.via === 'exe') {
          let note = card.querySelector('.makan-card-note');
          if (!note) {
            note = document.createElement('div');
            note.className = 'makan-card-note';
            const body = card.querySelector('#makanCardBody');
            if (body) body.prepend(note);
            else card.appendChild(note);
          }
          note.textContent = (curUi === 'fa' || cfg?.ui === 'fa') ? 'در MAKAN Translate باز شد' : 'Opened in MAKAN Translate';
          setTimeout(() => {
            card.classList.add('fading');
            setTimeout(() => removeCard(), 400);
          }, 1100);
        } else {
          window.open(openAppBtn.href, '_blank');
        }
      } catch {
        window.open(openAppBtn.href, '_blank');
      }
    });

    function updateAppUrl(sourceText, sLang, tLang) {
      const appBase = cfg?.webAppUrl || 'http://localhost:8080';
      const p = new URLSearchParams();
      p.set('text', (sourceText || '').slice(0, 2000));
      p.set('src', sLang || 'auto');
      p.set('tgt', tLang || 'fa');
      openAppBtn.href = `${appBase.replace(/\/+$/, '')}/#${p.toString()}`;
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

    // Compact source / target language selectors (same list as the web app); the choice is remembered.
    const srcSel = card.querySelector('#makanSrcSel');
    const tgtSel = card.querySelector('#makanTgtSel');
    const langList = (typeof globalThis.LANGS !== 'undefined' && globalThis.LANGS) || [];
    const langOpt = ([code, name]) => `<option value="${escapeHtml(code)}">${escapeHtml(String(name).split(' · ').pop())}</option>`;
    srcSel.innerHTML = '<option value="auto">Auto-detect</option>' + langList.filter(l => l[0] !== 'auto').map(langOpt).join('') + `<option value="finglish">${cfg?.ui === 'fa' ? 'فینگلیش · فارسی با حروف لاتین' : 'Finglish · Persian in Latin letters'}</option>`;
    tgtSel.innerHTML = langList.filter(l => l[0] !== 'auto').map(langOpt).join('');
    const syncLangSelects = () => { srcSel.value = curSrc; tgtSel.value = curTgt; };
    syncLangSelects();
    const rememberLangs = () => chrome.runtime?.sendMessage?.({ action: 'set-language', src: curSrc, tgt: curTgt })?.catch?.(() => {});
    for (const sel of [srcSel, tgtSel]) {
      sel.addEventListener('pointerdown', e => e.stopPropagation());
      sel.addEventListener('mousedown', e => e.stopPropagation());
      sel.addEventListener('keydown', e => e.stopPropagation());
      sel.onchange = e => {
        if (!e.isTrusted) return;
        curSrc = srcSel.value; curTgt = tgtSel.value;
        rememberLangs();
        executeTranslate(text, curSrc, curTgt, false);
      };
    }

    // Hook mode select
    const modeSel = card.querySelector('#makanModeSel');
    if (modeSel) {
      modeSel.addEventListener('pointerdown', e => e.stopPropagation());
      modeSel.addEventListener('mousedown', e => e.stopPropagation());
      modeSel.onchange = () => {
        cardMode = modeSel.value;
        if (cfg) {
          cfg.transMode = cardMode;
          chrome.runtime?.sendMessage?.({ action: 'save-config', cfg });
        }
        executeTranslate(text, curSrc, curTgt, false);
      };
    }

    // Execute translation via background
    let translatedResult = '';
    const bodyElem = card.querySelector('#makanCardBody');
    const enginePill = card.querySelector('#makanEnginePill');
    const pairPill = card.querySelector('#makanPairPill');
    const detectedPill = card.querySelector('#makanDetectedPill');

    // ---- Offline dictionary rendering (text only, never markup from data) ----
    function renderIdiom(idiom) {
      const rtl = ['fa', 'ar', 'he', 'ur'].includes(idiom.to); // the meanings are in the pack's target language
      const dir = rtl ? 'rtl' : 'ltr';
      translatedResult = idiom.meanings.join(rtl ? '، ' : '; ');
      enginePill.textContent = 'Offline dictionary';
      enginePill.title = 'Offline dictionary (Wiktionary, CC BY-SA)';
      bodyElem.innerHTML = `<div class="makan-dict-wrap">
        <div class="makan-dict-head"><span class="makan-dict-word">${escapeHtml(idiom.headword)}</span><span class="makan-dict-badge">Idiom</span></div>
        <div class="makan-dict-trans makan-idiom-meaning" dir="${dir}">${escapeHtml(translatedResult)}</div>
        ${idiom.example ? `<div class="makan-dict-ex">${escapeHtml(idiom.example)}</div>` : ''}
      </div>`;
    }
    function renderDictionaryEntry(res, sourceText, sLang, tLang) {
      const toFa = ['fa', 'ar', 'he', 'ur'].includes(res.to);
      const dir = toFa ? 'rtl' : 'ltr', sep = toFa ? '، ' : '; ';
      const head = (res.groups[0] && res.groups[0].entries[0].headword) || res.query;
      translatedResult = (res.groups[0] ? res.groups[0].entries[0].meanings.slice(0, 3) : res.extra.map(x => x.headword)).join(sep);
      enginePill.textContent = 'Offline dictionary';
      enginePill.title = 'Offline dictionary (Wiktionary, CC BY-SA)';
      const groups = res.groups.map(g => `<div class="makan-dict-pos">${escapeHtml(g.pos)}</div>` + g.entries.map(e => `
        ${e.viaForm ? `<div class="makan-dict-form">${escapeHtml(e.viaForm.form)} → ${escapeHtml(e.headword)}${e.viaForm.tags && e.viaForm.tags.length ? ' (' + escapeHtml(e.viaForm.tags.join(', ')) + ')' : ''}</div>` : ''}
        <div class="makan-dict-trans" dir="${dir}">${escapeHtml(e.meanings.slice(0, 5).join(sep))}</div>
        ${e.example ? `<div class="makan-dict-ex">${escapeHtml(e.example)}</div>` : ''}`).join('')).join('');
      const extra = res.extra.length ? `<div class="makan-dict-extra" dir="${dir}">Also: ${escapeHtml(res.extra.slice(0, 5).map(x => x.headword).join(sep))}</div>` : '';
      const idioms = res.phrases.length ? `<div class="makan-dict-pos">phrases</div>` + res.phrases.slice(0, 3).map(p => `<div class="makan-dict-ex"><b>${escapeHtml(p.headword)}</b> — ${escapeHtml(p.meanings.slice(0, 2).join(sep))}</div>`).join('') : '';
      bodyElem.innerHTML = `<div class="makan-dict-wrap">
        <div class="makan-dict-head"><span class="makan-dict-word">${escapeHtml(head)}</span><span class="makan-dict-badge">Offline</span></div>
        ${groups}${extra}${idioms}
        <div class="makan-dict-ai" id="makanDictAi" hidden></div>
      </div>`;
      // The AI explanation comes after, when an AI engine is available (the dictionary entry above never waits for it).
      if (cfg?.hasAi && cfg?.dictLookup !== false) {
        askBackground({ action: 'translate-dict', word: sourceText, src: sLang, tgt: tLang }).then(r => {
          const box = bodyElem.querySelector('#makanDictAi');
          if (!box || !r.ok || !r.dict) return;
          const d = r.dict;
          const parts = [d.definition, ...(d.examples || []).slice(0, 2)].filter(Boolean);
          if (!parts.length) return;
          box.replaceChildren();
          const lab = document.createElement('div'); lab.className = 'makan-dict-pos'; lab.textContent = 'AI explanation';
          box.appendChild(lab);
          for (const t of parts) { const p = document.createElement('div'); p.className = 'makan-dict-ex'; p.textContent = t; box.appendChild(p); }
          box.hidden = false;
        });
      }
    }

    let executeSeq = 0;
    function showAiIdiom(i, tLang) {
      const rtl = isRtl(tLang);
      const box = document.createElement('div');
      box.className = 'makan-idiom-ai';
      const head = document.createElement('div');
      head.className = 'makan-dict-head';
      const b = document.createElement('span');
      b.className = 'makan-dict-badge';
      b.textContent = 'Idiom (AI)';
      head.appendChild(b);
      box.appendChild(head);
      const line = (label, text) => {
        if (!text) return;
        const d = document.createElement('div');
        d.className = 'makan-dict-ex';
        d.dir = 'auto';
        d.textContent = label + ': ' + text;
        box.appendChild(d);
      };
      const m = document.createElement('div');
      m.className = 'makan-dict-trans makan-idiom-meaning';
      m.dir = rtl ? 'rtl' : 'auto';
      m.textContent = i.meaning;
      box.appendChild(m);
      line('Natural equivalent', i.equivalent);
      line('Register', i.register);
      const lab = document.createElement('div');
      lab.className = 'makan-dict-pos';
      lab.textContent = 'Literal translation';
      bodyElem.prepend(lab);
      bodyElem.prepend(box);
    }

    // Finglish (Persian written in Latin letters): texts for the card, in both interface languages.
    const FG_TEXT = {
      en: { spelling: 'Persian spelling', copy: 'Copy', via: 'Finglish → Persian', needsAi: 'Finglish (Persian written in Latin letters) needs an AI engine. Add a free Gemini or Groq key in Options.' },
      fa: { spelling: 'املای فارسی', copy: 'کپی', via: 'فینگلیش ← فارسی', needsAi: 'فینگلیش (فارسی با حروف لاتین) به یک موتور هوش مصنوعی نیاز دارد. در تنظیمات یک کلید رایگان Gemini یا Groq اضافه کنید.' }
    };
    const fgT = () => FG_TEXT[cfg?.ui === 'fa' ? 'fa' : 'en'];
    function showFinglish(persian) {
      const box = card.querySelector('#makanFg');
      box.textContent = '';
      const lab = document.createElement('span'); lab.className = 'makan-fg-lab'; lab.textContent = fgT().spelling;
      const txt = document.createElement('span'); txt.className = 'makan-fg-text'; txt.dir = 'rtl'; txt.lang = 'fa'; txt.textContent = persian;
      const btn = document.createElement('button'); btn.className = 'makan-action-btn makan-fg-copy'; btn.type = 'button'; btn.textContent = fgT().copy;
      btn.onclick = (e) => { e.stopPropagation(); if (e.isTrusted) navigator.clipboard?.writeText(persian).catch(() => {}); };
      box.append(lab, txt, btn);
      box.hidden = false;
    }

    async function executeTranslate(sourceText, sLang, tLang, useDict) {
      executeSeq++;
      bodyElem.innerHTML = `
        <div class="makan-loading">
          <svg class="makan-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/></svg>
          Translating…
        </div>
      `;
      pairPill.textContent = `${sLang.toUpperCase()} → ${tLang.toUpperCase()}`;
      detectedLang = isRtlText(sourceText) ? 'fa' : 'en';
      detectedPill.textContent = `Detected: ${detectedLang.toUpperCase()}`;
      updateAppUrl(sourceText, sLang, tLang);

      // Finglish: one AI request turns it into Persian script, shown above the result; the translation starts from it.
      card.querySelector('#makanFg').hidden = true;
      {
        const mySeq = executeSeq;
        let fg = null;
        try { fg = await askBackground({ action: 'finglish', text: sourceText, src: sLang }); } catch {}
        if (mySeq !== executeSeq) return;
        if (fg && fg.ok && fg.kind === 'needs-ai') {
          enginePill.textContent = 'Finglish';
          bodyElem.innerHTML = `<div class="makan-err">${escapeHtml(fgT().needsAi)}</div>`;
          return;
        }
        if (fg && !fg.ok && fg.error) {
          bodyElem.innerHTML = `<div class="makan-err">⚠️ Translation failed: ${escapeHtml(fg.error)}</div>`;
          return;
        }
        if (fg && fg.ok && fg.kind === 'ok') {
          showFinglish(fg.persian);
          sourceText = fg.persian; sLang = 'fa';
          if (tLang === 'fa') {
            translatedResult = fg.persian;
            enginePill.textContent = `${fgT().via} · ${fg.engineName || 'AI'}`;
            bodyElem.innerHTML = `<div class="makan-result-text" dir="rtl">${escapeHtml(fg.persian)}</div>`;
            return;
          }
        } else if (sLang === 'finglish') {
          sLang = 'auto';
        }
      }


      // Offline dictionary first: instant and without any network call. A selected phrase that is an idiom
      // shows its meaning (marked as an idiom) instead of a literal translation.
      try {
        const nWords = sourceText.trim().split(/\s+/).length;
        if (useDict || (nWords >= 2 && nWords <= 8)) {
          const dr = await askBackground({ action: 'dict-lookup', word: sourceText, phrase: !useDict });
          if (dr.ok && !useDict && dr.idiom) { renderIdiom(dr.idiom); return; }
          if (dr.ok && useDict && dr.result && (dr.result.groups.length || dr.result.extra.length)) {
            renderDictionaryEntry(dr.result, sourceText, sLang, tLang);
            return;
          }
        }
      } catch {}

      try {
        if (useDict && cfg?.dictLookup) {
          let resp = null;
          resp = await askBackground({
                action: 'translate-dict',
                word: sourceText,
                src: sLang,
                tgt: tLang
              });
          if (!resp && typeof MakanEngine !== 'undefined') {
            const d = await MakanEngine.lookupWordDictionary(sourceText, sLang, tLang, cfg);
            resp = { ok: true, dict: d };
          }
          if (resp && resp.ok && resp.dict) {
            const d = resp.dict;
            enginePill.textContent = d.engineName || 'AI Dictionary';
            enginePill.title = enginePill.textContent;
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
                  ${d.examples && d.examples.length ? `<div class="makan-dict-ex">${escapeHtml(d.examples[0])}<br><span class="makan-dict-ex2" dir="${isRtl(tLang) ? 'rtl' : 'ltr'}">${escapeHtml(d.examples[1] || '')}</span></div>` : ''}
                </div>
              `;
            } else {
              translatedResult = d.translation || sourceText;
              bodyElem.innerHTML = `<div class="makan-result-text" dir="${isRtl(tLang) ? 'rtl' : 'ltr'}">${escapeHtml(translatedResult)}</div>`;
            }
          } else {
            throw new Error(plainFailure(resp?.error));
          }
        } else {
          let userInteractedWithFast = false;
          const markInteracted = () => { userInteractedWithFast = true; };
          bodyElem.addEventListener('copy', markInteracted, { once: true });
          const copyBtn = card.querySelector('#makanCopyBtn');
          copyBtn?.addEventListener('click', markInteracted, { once: true });

          if (cardMode === 'fast' || (cardMode === 'both' && !hasAiAvailable)) {
            let resp = null;
            resp = await askBackground({
                  action: 'translate-text',
                  items: [sourceText],
                  src: sLang,
                  tgt: tLang,
                  mode: 'fast'
                });
            if (!resp && typeof MakanEngine !== 'undefined') {
              const r = await MakanEngine.translateText([sourceText], sLang, tLang, cfg, { mode: 'fast' });
              resp = { ok: true, results: r.results, engineName: r.engineName };
            }
            if (resp && resp.ok && resp.results?.length) {
              translatedResult = resp.results[0];
              enginePill.textContent = resp.engineName || 'Translated';
              bodyElem.innerHTML = `<div class="makan-result-text" dir="${isRtl(tLang) ? 'rtl' : 'ltr'}">${escapeHtml(translatedResult)}</div>`;
            } else {
              throw new Error(plainFailure(resp?.error));
            }
          } else if (cardMode === 'smart') {
            let resp = null;
            resp = await askBackground({
                  action: 'translate-text',
                  items: [sourceText],
                  src: sLang,
                  tgt: tLang,
                  tone: cfg?.tone,
                  subject: cfg?.subject,
                  mode: 'smart'
                });
            if (!resp && typeof MakanEngine !== 'undefined') {
              const r = await MakanEngine.translateText([sourceText], sLang, tLang, cfg, { tone: cfg?.tone, subject: cfg?.subject, mode: 'smart' });
              resp = { ok: true, results: r.results, engineName: r.engineName };
            }
            if (resp && resp.ok && resp.results?.length) {
              translatedResult = resp.results[0];
              enginePill.textContent = resp.engineName || 'Translated';
              enginePill.title = enginePill.textContent;
              bodyElem.innerHTML = `<div class="makan-result-text" dir="${isRtl(tLang) ? 'rtl' : 'ltr'}">${escapeHtml(translatedResult)}</div>`;
            } else {
              throw new Error(plainFailure(resp?.error));
            }
          } else {
            // Both mode
            let fastDone = false, smartDone = false;
            let fastRes = '', fastEngine = '';
            let smartRes = '', smartEngine = '';
            let fastErr = null, smartErr = null;
            // Fast failed but Smart worked: show the Smart result and say so in one line.
            const noteFastFailed = () => {
              enginePill.textContent = `${smartEngine} · Fast engines failed, showing Smart result`;
              enginePill.title = `Fast: ${fastErr?.message || 'failed'}`;
            };

            const fastReq = askBackground({
              action: 'translate-text',
              items: [sourceText],
              src: sLang,
              tgt: tLang,
              mode: 'fast'
            }).then(resp => {
              if (resp && resp.ok && resp.results?.length) {
                fastRes = resp.results[0];
                fastEngine = resp.engineName || 'Fast';
                fastDone = true;
                if (!smartDone) {
                  translatedResult = fastRes;
                  bodyElem.innerHTML = `<div class="makan-result-text" dir="${isRtl(tLang) ? 'rtl' : 'ltr'}">${escapeHtml(fastRes)}</div>`;
                  enginePill.innerHTML = `<span class="makan-pill-fast">Fast</span> ${escapeHtml(fastEngine)}`;
                  enginePill.title = `Fast: ${fastEngine}`;
                }
              } else {
                throw new Error(plainFailure(resp?.error));
              }
              return resp;
            }).catch(e => {
              fastDone = true;
              fastErr = e;
              if (smartDone && smartRes && !userInteractedWithFast) noteFastFailed();
              throw e;
            });

            const smartReq = askBackground({
              action: 'translate-text',
              items: [sourceText],
              src: sLang,
              tgt: tLang,
              tone: cfg?.tone,
              subject: cfg?.subject,
              mode: 'smart'
            }).then(resp => {
              if (resp && resp.ok && resp.results?.length) {
                smartRes = resp.results[0];
                smartEngine = resp.engineName || 'AI';
                smartDone = true;
                if (userInteractedWithFast && fastRes) {
                  let showBtn = card.querySelector('#makanShowImproved');
                  if (!showBtn) {
                    showBtn = document.createElement('button');
                    showBtn.id = 'makanShowImproved';
                    showBtn.className = 'makan-action-btn';
                    showBtn.style.color = 'var(--cyan, #58a6ff)';
                    showBtn.style.borderColor = 'var(--cyan, #58a6ff)';
                    showBtn.innerHTML = `<span>Show improved</span>`;
                    const footer = card.querySelector('.makan-card-footer');
                    if (footer) footer.insertBefore(showBtn, footer.firstChild);
                  }
                  showBtn.onclick = (e) => {
                    e.stopPropagation();
                    translatedResult = smartRes;
                    bodyElem.classList.add('calm-fade');
                    setTimeout(() => bodyElem.classList.remove('calm-fade'), 400);
                    bodyElem.innerHTML = `<div class="makan-result-text" dir="${isRtl(tLang) ? 'rtl' : 'ltr'}">${escapeHtml(smartRes)}</div>`;
                    enginePill.textContent = smartEngine;
                    enginePill.title = smartEngine;
                    showBtn.remove();
                  };
                } else {
                  translatedResult = smartRes;
                  bodyElem.classList.add('calm-fade');
                  setTimeout(() => bodyElem.classList.remove('calm-fade'), 400);
                  bodyElem.innerHTML = `<div class="makan-result-text" dir="${isRtl(tLang) ? 'rtl' : 'ltr'}">${escapeHtml(smartRes)}</div>`;
                  enginePill.textContent = smartEngine;
                  enginePill.title = smartEngine;
                  if (fastErr) noteFastFailed();
                }
              } else {
                throw new Error(plainFailure(resp?.error));
              }
              return resp;
            }).catch(err => {
              smartDone = true;
              smartErr = err;
              if (fastRes) {
                const is429 = /429|resource_exhausted|rate limit|quota/i.test(err.message || '');
                const reason = is429 ? 'AI rate limited' : ('AI unavailable' + (err.message ? ` (${String(err.message).replace(/^Translation failed: /, '').slice(0, 80)})` : ''));
                enginePill.textContent = `Fast (${fastEngine}) · ${reason}`;
              } else {
                throw err;
              }
            });

            await Promise.allSettled([fastReq, smartReq]);
            if (!fastRes && !smartRes) {
              throw smartErr || fastErr || new Error(plainFailure(''));
            }
          }
        }
        // Not a stored idiom: ask the AI engine whether it is one. If so, its explanation goes above the (literal) translation.
        const nW = sourceText.trim().split(/\s+/).length;
        if (!useDict && cfg?.hasAi && nW >= 2 && nW <= 8 && !bodyElem.querySelector('.makan-dict-badge')) {
          const mySeq = executeSeq;
          askBackground({ action: 'idiom-check', text: sourceText }).then(r => {
            if (mySeq !== executeSeq || !r.ok || !r.idiom) return;
            showAiIdiom(r.idiom, tLang);
          });
        }
      } catch (err) {
        const why = plainFailure(cspBlockedReason() || err);
        bodyElem.innerHTML = `<div class="makan-err">⚠️ Translation failed: ${escapeHtml(why)}</div>${failureNeedsOptions(why) ? '<button class="makan-action-btn" id="makanErrOptions">Open Options</button>' : ''}`;
        const eo = bodyElem.querySelector('#makanErrOptions');
        if (eo) eo.onclick = (e) => { if (e.isTrusted) askBackground({ action: 'open-options' }); };
      }
    }

    // Check empty text selection
    if (!text || !text.trim()) {
      bodyElem.innerHTML = `<div class="makan-empty">No text selected. Select any text on this page to translate.</div>`;
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
      syncLangSelects();
      rememberLangs();
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
    let lastEngineName = '';
    translatedNodes = [];
    let lastPageFailure = '';

    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const chunk = targets.slice(i, i + BATCH_SIZE);
      const texts = chunk.map(el => el.innerText.trim());

      try {
        const res = await askBackground({
          action: 'translate-text',
          items: texts,
          src: 'auto',
          tgt: tgt,
          tone: cfg?.tone,
          subject: cfg?.subject
        });
        if (!res.ok) lastPageFailure = plainFailure(cspBlockedReason() || res.error);

        if (res && res.ok && res.results) {
          if (res.engineName || res.engineUsed) {
            lastEngineName = res.engineName || res.engineUsed;
          }
          chunk.forEach((el, idx) => {
            const original = texts[idx];
            const translated = res.results[idx] || original;
            el.setAttribute('data-makan-orig', original);
            el.setAttribute('data-makan-trans', translated);
            if (el._makanOrigHtml === undefined) el._makanOrigHtml = el.innerHTML;
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
        lastPageFailure = plainFailure(cspBlockedReason() || err);
      }
    }

    if (completed === 0) {
      isPageTranslated = false;
      const why = lastPageFailure || plainFailure('');
      showPageBanner(`Page not translated: ${why}`, false, false, failureNeedsOptions(why));
      return;
    }

    isPageTranslated = true;
    const engineLabel = lastEngineName || (cfg?.order?.[0] || 'MAKAN');
    showPageBanner(`Page translated to ${tgt.toUpperCase()} via ${engineLabel}.`, false, true);
  }

  // Restore original page text
  function restoreOriginalPage() {
    translatedNodes.forEach(el => {
      if (el._makanOrigHtml !== undefined) {
        el.innerHTML = el._makanOrigHtml;
        delete el._makanOrigHtml;
      } else {
        const orig = el.getAttribute('data-makan-orig');
        if (orig) el.innerText = orig;
      }
      el.removeAttribute('data-makan-orig');
      el.removeAttribute('data-makan-trans');
      el.removeAttribute('dir');
      el.onmouseenter = null;
      el.onmouseleave = null;
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
  function showPageBanner(statusText, isLoading, showRestore = false, showOptions = false) {
    if (currentBannerElem) currentBannerElem.remove();

    const banner = document.createElement('div');
    banner.className = 'makan-top-banner';
    banner.innerHTML = `
      <div class="makan-mark-ico">M</div>
      <span class="makan-banner-text">${escapeHtml(statusText)}</span>
      ${showOptions ? `<button class="makan-banner-btn cta" id="makanBannerOptions">Open Options</button>` : ''}
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

    const optBtn = banner.querySelector('#makanBannerOptions');
    if (optBtn) optBtn.onclick = (e) => { if (e.isTrusted) askBackground({ action: 'open-options' }); };

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

  // What the background tells us about the speech it is playing for this card.
  function applyTtsState(req) {
    if (req.state === 'playing') {
      if (activePlayingBtn) {
        activePlayingBtn.classList.remove('preparing');
        activePlayingBtn.classList.add('playing');
        activePlayingBtn.setAttribute('title', 'Stop read-aloud');
        const span = activePlayingBtn.querySelector('span');
        if (span) span.textContent = 'Stop';
      }
    } else if (req.state === 'ended' || req.state === 'stopped' || req.state === 'error') {
      if (req.state === 'error' && lastSpeak && activePlayingBtn === lastSpeak.btn && (speakBackendToken === null || req.token === speakBackendToken)) {
        const ls = lastSpeak;
        speakFailure(ls.noticeContainer, req.error, () => handleSpeakClick(ls.text, ls.lang, ls.btn, ls.noticeContainer));
      }
      if (activePlayingBtn) {
        activePlayingBtn.classList.remove('preparing', 'playing');
        activePlayingBtn.setAttribute('title', 'Read aloud');
        const span = activePlayingBtn.querySelector('span');
        if (span) span.textContent = 'Speak';
      }
      isAudioPlaying = false;
      activePlayingBtn = null;
      speakBackendToken = null;
    }
  }

  // Listen to messages from background / popup
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
        // Only the extension itself can reach this listener; refuse anything else (and anything from another content script).
        if (!sender || sender.id !== chrome.runtime.id || !req || typeof req !== 'object') return false;
        if (req.target === 'makan-ui' && req.action === 'tts-state-update') {
          if (speakWaitingForStart) { heldStates.push(req); return false; }
          // Only follow the background's speech if it is ours (a device voice speaks without the background).
          if (speakBackendToken === null || req.token !== speakBackendToken) return false;
          applyTtsState(req);
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
