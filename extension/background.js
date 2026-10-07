/**
 * MAKAN Translate - Extension Background Service Worker (Manifest V3)
 * Handles CORS-free API calls, Context Menus, Keyboard Shortcuts, Audio Playback, and Storage.
 * Never logs or prints API keys.
 */

if (typeof importScripts === 'function') {
  try {
    importScripts('engine.js');
    importScripts('dictionary.js');
  } catch (e) {
    console.error('Failed to import engine.js:', e);
  }
}

// Stored settings hold the API keys. Keep them out of reach of content scripts (the code that runs
// inside web pages); only the extension's own pages and this background worker may read storage.
try {
  Promise.resolve(chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })).catch(() => {});
} catch {}

// Global active audio token for TTS cancellation & pipelining
let activeAudioToken = 0;
let offscreenCreating = null;
let firefoxDirectAudio = null;
let firefoxStreamPlayer = null;
let firefoxStreamAbortController = null;
let currentPlaybackQueue = null;
let pendingChunkResolve = null;

function broadcastTtsState(payload) {
  try {
    chrome.runtime.sendMessage({ target: 'makan-ui', action: 'tts-state-update', ...payload }).catch(() => {});
  } catch {}
  try {
    chrome.tabs.query({}).then(tabs => {
      for (const t of tabs) {
        if (t.id && isTabAccessible(t.url)) {
          chrome.tabs.sendMessage(t.id, { target: 'makan-ui', action: 'tts-state-update', ...payload }).catch(() => {});
        }
      }
    }).catch(() => {});
  } catch {}
}

async function playAudioChunk(dataUrl, rate, token) {
  if (token !== activeAudioToken) return false;

  const hasOffscreen = await ensureOffscreenDocument();
  if (hasOffscreen) {
    return new Promise((resolve) => {
      let resolved = false;
      const onDone = (endedToken) => {
        if (!resolved && (endedToken === token || endedToken === null)) {
          resolved = true;
          pendingChunkResolve = null;
          resolve(endedToken === token);
        }
      };
      pendingChunkResolve = onDone;
      chrome.runtime.sendMessage({
        target: 'makan-offscreen',
        action: 'play-audio',
        audioUrl: dataUrl,
        rate,
        token
      }).catch(() => {
        onDone(null);
      });
    });
  }

  // Direct Audio element (Firefox background event page)
  if (typeof Audio !== 'undefined') {
    return new Promise((resolve) => {
      if (firefoxDirectAudio) {
        try { firefoxDirectAudio.pause(); } catch {}
      }
      const a = new Audio(dataUrl);
      firefoxDirectAudio = a;
      if (rate) a.playbackRate = rate;
      const done = (ok) => {
        if (firefoxDirectAudio === a) firefoxDirectAudio = null;
        resolve(ok);
      };
      a.onended = () => done(true);
      a.onerror = () => done(false);
      a.play().catch(() => done(false));
    });
  }

  return false;
}

async function startPipelinedPlayback(queue) {
  currentPlaybackQueue = queue;
  const { token, text, voice, rate, model, geminiKey } = queue;
  const sentences = typeof splitIntoSentences === 'function' ? splitIntoSentences(text) : [text];
  if (!sentences.length) {
    broadcastTtsState({ state: 'ended', token });
    return;
  }

  const prefetched = new Map();
  function prefetch(idx) {
    if (idx >= sentences.length || token !== activeAudioToken) return;
    if (!prefetched.has(idx)) {
      prefetched.set(idx, callGeminiTts(sentences[idx], geminiKey, {
        voice,
        rate,
        model,
        signal: queue.abortController?.signal
      }));
    }
  }

  // Immediately prefetch first sentence
  prefetch(0);

  for (let i = 0; i < sentences.length; i++) {
    if (token !== activeAudioToken) return;

    let res;
    try {
      res = await prefetched.get(i);
    } catch (err) {
      if (token !== activeAudioToken) return;
      console.warn(`TTS sentence ${i} failed:`, err);
      if (i === 0) {
        broadcastTtsState({ state: 'error', error: err.message, token });
        return;
      }
      continue;
    }

    if (token !== activeAudioToken) return;

    // Sentence i ready -> prefetch sentence i + 1 immediately while sentence i plays
    if (i + 1 < sentences.length) {
      prefetch(i + 1);
    }

    broadcastTtsState({ state: 'playing', token, sentenceIndex: i, totalSentences: sentences.length });

    const ok = await playAudioChunk(res.dataUrl, rate, token);
    if (!ok || token !== activeAudioToken) return;
  }

  if (token === activeAudioToken) {
    broadcastTtsState({ state: 'ended', token });
    if (currentPlaybackQueue === queue) currentPlaybackQueue = null;
  }
}

// Helper: Check if a URL can receive content scripts
function isTabAccessible(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('file://')) &&
         !lower.includes('chrome.google.com/webstore') &&
         !lower.includes('chromewebstore.google.com') &&
         !lower.includes('microsoftedge.microsoft.com/addons') &&
         // Only Firefox forbids extensions on its own add-on site; Chrome and Edge allow them there.
         !(/Firefox\//.test(navigator.userAgent) && lower.includes('addons.mozilla.org'));
}

// Helper: Ensure Offscreen document for audio playback (Chrome/Edge MV3)
async function ensureOffscreenDocument() {
  if (typeof chrome === 'undefined' || !chrome.offscreen) return false;
  try {
    if (chrome.offscreen.hasDocument && await chrome.offscreen.hasDocument()) {
      return true;
    }
  } catch {}

  if (offscreenCreating) {
    await offscreenCreating;
    return true;
  }

  try {
    offscreenCreating = chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play text-to-speech audio'
    });
    await offscreenCreating;
    offscreenCreating = null;
    return true;
  } catch (err) {
    offscreenCreating = null;
    return false;
  }
}

// Helper: Show in-page toast to user without requiring notifications permission
async function showInPageToast(tabId, message) {
  if (!tabId) {
    try {
      const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      tabId = t?.id;
    } catch {}
  }
  if (!tabId) return;

  try {
    const res = await chrome.tabs.sendMessage(tabId, { action: 'show-toast', message });
    if (res && res.ok) return;
  } catch {}

  if (chrome.scripting?.executeScript) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (msg) => {
          const id = 'makan-toast-notice';
          let el = document.getElementById(id);
          if (!el) {
            el = document.createElement('div');
            el.id = id;
            el.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483647;background:#0d1522;color:#eaf1f7;border:1px solid #3b6bff;border-radius:10px;padding:10px 16px;font-family:system-ui,-apple-system,sans-serif;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,0.5);transition:opacity 0.3s;pointer-events:auto;max-width:340px;';
            (document.body || document.documentElement).appendChild(el);
          }
          el.textContent = msg;
          el.style.opacity = '1';
          clearTimeout(el._timer);
          el._timer = setTimeout(() => {
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 350);
          }, 4500);
        },
        args: [message]
      });
    } catch {}
  }
}

function showNotification(title, message, tabId) {
  showInPageToast(tabId, message);
}

// Helper: Verify tab readiness, injecting content script if missing
async function ensureTabReady(tab) {
  if (!tab || !tab.id) return false;

  if (!isTabAccessible(tab.url)) {
    const domain = tab.url ? tab.url.split('/')[2] || tab.url.slice(0, 24) : 'internal page';
    showInPageToast(
      tab.id,
      `Cannot run on ${domain}. Browser security policies restrict extensions on internal and extension store pages.`
    );
    return false;
  }

  // First ping to check if content script is already listening
  let answered = false;
  try {
    const res = await Promise.race([
      chrome.tabs.sendMessage(tab.id, { action: 'ping' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 220))
    ]);
    if (res && res.ok) answered = true;
  } catch {}

  if (answered) return true;

  // Attempt dynamic injection if scripting API is available
  if (chrome.scripting?.executeScript) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['engine.js', 'content.js']
      });
      if (chrome.scripting.insertCSS) {
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content.css']
        }).catch(() => {});
      }
      // Brief pause to allow content script initialization
      await new Promise(r => setTimeout(r, 60));
      return true;
    } catch (injErr) {
      showInPageToast(
        tab.id,
        'Please reload this page once to enable MAKAN Translate (or check site access in extension settings).'
      );
      return false;
    }
  }

  showInPageToast(
    tab.id,
    'Please reload this page once to enable MAKAN Translate.'
  );
  return false;
}

// Inject content scripts into all open tabs on extension install/update
async function injectOpenTabs() {
  if (!chrome.scripting?.executeScript) return;
  try {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    for (const tab of tabs) {
      if (!tab.id || !isTabAccessible(tab.url)) continue;
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['engine.js', 'content.js']
      }).catch(() => {});
      if (chrome.scripting.insertCSS) {
        chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content.css']
        }).catch(() => {});
      }
    }
  } catch {}
}

// Lifecycle initialization
chrome.runtime.onInstalled.addListener(async details => {
  // Ensure default configuration exists
  const existing = await chrome.storage.local.get('makan_cfg');
  if (!existing || !existing.makan_cfg) {
    await chrome.storage.local.set({ makan_cfg: DEFAULT_CFG });
  }

  // Set up context menus
  try {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'makan-translate-sel',
        title: 'Translate with MAKAN',
        contexts: ['selection']
      });
      chrome.contextMenus.create({
        id: 'makan-translate-page',
        title: 'Translate entire page with MAKAN',
        contexts: ['page']
      });
    });
  } catch {}

  // Inject content scripts into tabs that were open before extension was installed/reloaded
  await injectOpenTabs();
});

// Handle Context Menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;
  const ready = await ensureTabReady(tab);
  if (!ready) return;

  if (info.menuItemId === 'makan-translate-sel') {
    chrome.tabs.sendMessage(tab.id, {
      action: 'context-translate-selection',
      text: info.selectionText || ''
    }).catch(err => {
      showInPageToast(tab.id, 'Please reload this page once to enable translation.');
    });
  } else if (info.menuItemId === 'makan-translate-page') {
    chrome.tabs.sendMessage(tab.id, {
      action: 'context-translate-page'
    }).catch(err => {
      showInPageToast(tab.id, 'Please reload this page once to enable translation.');
    });
  }
});

// Handle Keyboard Commands
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (!tab || !tab.id) return;
  const ready = await ensureTabReady(tab);
  if (!ready) return;

  if (command === 'translate-selection') {
    chrome.tabs.sendMessage(tab.id, { action: 'shortcut-translate-selection' }).catch(() => {});
  } else if (command === 'translate-page') {
    chrome.tabs.sendMessage(tab.id, { action: 'shortcut-translate-page' }).catch(() => {});
  }
});

// ---- Who is asking? ----
// The extension's own pages (popup, options, offscreen player) have an address inside the extension.
// A content script reports the address of the web page it runs in.
const EXT_URL = chrome.runtime.getURL('');
const isExtensionPage = sender => !!sender && sender.id === chrome.runtime.id && typeof sender.url === 'string' && sender.url.startsWith(EXT_URL);
const isContentScript = sender => !!sender && sender.id === chrome.runtime.id && !!sender.tab && !isExtensionPage(sender);
// The only things the part of the extension that runs inside web pages may ask for.
// Everything else (reading or saving settings, testing engines, injecting scripts) is for extension pages only.
const CONTENT_SCRIPT_ACTIONS = new Set(['get-public-config', 'translate-text', 'translate-dict', 'play-gemini-tts', 'stop-tts', 'set-language', 'open-options', 'get-card-css', 'dismiss-edge-hint', 'dict-lookup']);

// The dictionary packs ship inside the extension; load one into IndexedDB the first time it is needed (no network).
const dictionaryReady = {};
function ensureDictionary(pair) {
  if (!dictionaryReady[pair]) {
    dictionaryReady[pair] = (async () => {
      if (await MakanDict.status(pair)) return true;
      await MakanDict.install(pair, { getBytes: async rel => (await fetch(chrome.runtime.getURL(`dict/${pair}/${rel}`))).arrayBuffer() });
      return true;
    })().catch(e => { delete dictionaryReady[pair]; throw e; });
  }
  return dictionaryReady[pair];
}
try { chrome.runtime.onInstalled.addListener(() => { ensureDictionary('en-fa').catch(() => {}); ensureDictionary('fa-en').catch(() => {}); }); } catch {}

// What a web page's content script may know about the settings: never keys, models or addresses.
function safeWebAppUrl(u) {
  try { const x = new URL(String(u)); if (x.protocol === 'http:' || x.protocol === 'https:') return x.href.replace(/\/+$/, ''); } catch {}
  return 'http://localhost:8080';
}
function publicConfig(cfg) {
  const tts = cfg.tts || {};
  const hasAi = (cfg.order || []).some(id => ENG[id]?.ai && isEngineUsable(id, cfg) && (ENG[id].key ? Boolean(cfg.eng?.[id]?.key) : (id === 'custom' ? Boolean(cfg.eng?.[id]?.base) : false)));
  return {
    src: cfg.src, tgt: cfg.tgt, tone: cfg.tone, subject: cfg.subject,
    trigger: cfg.trigger, dictLookup: cfg.dictLookup, disabledSites: cfg.disabledSites || [], ui: cfg.ui,
    webAppUrl: safeWebAppUrl(cfg.webAppUrl),
    transMode: cfg.transMode,
    edgeHintOff: !!cfg.edgeHintOff,
    hasAi,
    tts: { rate: tts.rate, preferGemini: !!tts.preferGemini, geminiVoice: tts.geminiVoice, voices: tts.voices || {} }
  };
}

// Check the shape of requests before using them.
const LANG_RE = /^(auto|[a-z]{2,3}(-[A-Za-z0-9]{2,8})?)$/;
function requestProblem(req) {
  if (req.action === 'translate-text') {
    if (req.items !== undefined && (!Array.isArray(req.items) || req.items.length > 200 || req.items.some(x => typeof x !== 'string' || x.length > 20000))) return 'Bad items';
    if (req.text !== undefined && (typeof req.text !== 'string' || req.text.length > 20000)) return 'Bad text';
  }
  if (req.action === 'translate-dict' && (typeof req.word !== 'string' || req.word.length > 200)) return 'Bad word';
  if (req.action === 'dict-lookup' && (typeof req.word !== 'string' || req.word.length > 200)) return 'Bad word';
  if (req.action === 'play-gemini-tts' && (typeof req.text !== 'string' || req.text.length > 5000)) return 'Bad text';
  for (const k of ['src', 'tgt']) if (req[k] !== undefined && !LANG_RE.test(String(req[k]))) return 'Bad language';
  if (req.engine !== undefined && req.engine !== 'auto' && !(typeof ENG !== 'undefined' && ENG[req.engine])) return 'Bad engine';
  return null;
}

// Handle runtime messages from content scripts, options, and popups
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (!req || typeof req !== 'object') return false;

  const fromExtensionPage = isExtensionPage(sender);
  if (req.target === 'makan-background') {
    // Only the extension's own hidden audio player reports playback state.
    if (!fromExtensionPage || req.action !== 'tts-state') return false;
  } else if (!fromExtensionPage && !(isContentScript(sender) && CONTENT_SCRIPT_ACTIONS.has(req.action))) {
    // Extension pages may do anything; content scripts (inside web pages) only the short list above.
    sendResponse({ ok: false, error: 'Not allowed from this context' });
    return false;
  }
  const problem = requestProblem(req);
  if (problem) { sendResponse({ ok: false, error: problem }); return false; }

  if (req.target === 'makan-background' && req.action === 'tts-state') {
    if (req.state === 'playing') {
      broadcastTtsState({ state: 'playing', token: req.token });
    } else if (req.state === 'ended') {
      if (pendingChunkResolve) {
        pendingChunkResolve(req.token);
      }
      broadcastTtsState({ state: 'ended', token: req.token });
    } else if (req.state === 'stream-error') {
      if (currentPlaybackQueue && req.token === activeAudioToken) {
        console.warn('Streaming error reported, falling back to pipelined playback:', req.error);
        startPipelinedPlayback(currentPlaybackQueue);
      }
    } else if (req.state === 'error') {
      if (pendingChunkResolve) {
        pendingChunkResolve(null);
      }
      broadcastTtsState({ state: 'error', error: req.error, token: req.token });
    }
    return false;
  }

  (async () => {
    const cfg = await loadConfig();

    if (req.action === 'get-config') {
      return { ok: true, cfg };
    }

    if (req.action === 'get-public-config') {
      return { ok: true, cfg: publicConfig(cfg) };
    }

    if (req.action === 'dict-lookup') {
      // Offline dictionary: no network. The packs inside the extension are loaded into IndexedDB the first time.
      try {
        const word = String(req.word || '').trim();
        const lang = MakanDict.detectLang(word);
        await ensureDictionary(MakanDict.PAIRS[lang]);
        if (req.phrase) {
          const idiom = await MakanDict.lookupPhrase(word, { lang });
          return { ok: true, idiom };
        }
        const result = await MakanDict.lookup(word, { lang });
        return { ok: true, result };
      } catch (e) {
        return { ok: false, error: String((e && e.message) || e) };
      }
    }

    if (req.action === 'dismiss-edge-hint') {
      cfg.edgeHintOff = true;
      await saveConfig(cfg);
      return { ok: true };
    }

    if (req.action === 'open-options') {
      try { await chrome.runtime.openOptionsPage(); return { ok: true }; } catch (e) { return { ok: false, error: String(e.message || e) }; }
    }

    if (req.action === 'get-card-css') {
      try { const r = await fetch(chrome.runtime.getURL('content.css')); return { ok: true, css: await r.text() }; } catch (e) { return { ok: false, error: String(e.message || e) }; }
    }

    if (req.action === 'set-language') {
      // The card's language choice is remembered; only these two fields, only known language codes.
      const known = c => typeof c === 'string' && (LANGS || []).some(l => l[0] === c);
      if (!known(req.src) && req.src !== 'auto') return { ok: false, error: 'Bad language' };
      if (!known(req.tgt) || req.tgt === 'auto') return { ok: false, error: 'Bad language' };
      cfg.src = req.src; cfg.tgt = req.tgt;
      await saveConfig(cfg);
      return { ok: true };
    }

    if (req.action === 'save-config') {
      await saveConfig(req.cfg);
      return { ok: true };
    }

    if (req.action === 'toggle-site-disabled') {
      const host = req.host;
      if (!host) return { ok: false, error: 'No host' };
      const disabled = cfg.disabledSites || [];
      const idx = disabled.indexOf(host);
      if (idx >= 0) disabled.splice(idx, 1);
      else disabled.push(host);
      cfg.disabledSites = disabled;
      await saveConfig(cfg);
      return { ok: true, isSiteDisabled: disabled.includes(host) };
    }

    if (req.action === 'translate-text') {
      const items = Array.isArray(req.items) ? req.items : [String(req.text || '')];
      const options = {
        src: req.src || cfg.src || 'auto',
        tgt: req.tgt || cfg.tgt || 'fa',
        engine: req.engine || 'auto',
        tone: req.tone || cfg.tone || 'neutral',
        subject: req.subject || cfg.subject || '',
        subStyle: req.subStyle || cfg.subStyle || 'neutral',
        mode: req.mode || 'auto'
      };

      try {
        const res = await translateItemsWithFallback(items, options, cfg);
        return {
          ok: true,
          results: res.results,
          detectedSrc: res.src,
          tgt: res.tgt,
          engineUsed: res.engineUsed,
          engineName: res.engineName
        };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    }

    if (req.action === 'translate-dict') {
      const word = String(req.word || '').trim();
      const options = {
        src: req.src || cfg.src || 'auto',
        tgt: req.tgt || cfg.tgt || 'fa'
      };
      try {
        const dict = await lookupWordDictionary(word, options, cfg);
        return { ok: true, dict };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    }

    if (req.action === 'test-engine') {
      const id = req.id;
      const res = await testEngineConnection(id, cfg);
      return { ok: true, res };
    }

    if (req.action === 'test-all-engines') {
      const results = {};
      for (const id of cfg.order) {
        results[id] = await testEngineConnection(id, cfg);
      }
      return { ok: true, results };
    }

    // TTS: Play speech audio using Gemini AI with sentence pipelining & caching
    if (req.action === 'play-gemini-tts') {
      const text = String(req.text || '').trim();
      const geminiKey = cfg.eng?.gemini?.key;
      if (!geminiKey) {
        return { ok: false, error: 'Gemini API key is not configured in MAKAN Options.' };
      }

      const previousToken = activeAudioToken;
      const token = ++activeAudioToken;
      // A new speech replaces any earlier one (here or in another tab); tell the earlier one's button.
      broadcastTtsState({ state: 'stopped', token: previousToken });
      const voice = req.voice || cfg.tts?.geminiVoice || 'Kore';
      const rate = req.rate || cfg.tts?.rate || 1.0;
      const model = req.model || cfg.tts?.model || 'gemini-2.5-flash-preview-tts';

      if (currentPlaybackQueue) {
        try { currentPlaybackQueue.abortController.abort(); } catch {}
        currentPlaybackQueue = null;
      }
      if (pendingChunkResolve) {
        const res = pendingChunkResolve;
        pendingChunkResolve = null;
        res(null);
      }
      if (firefoxStreamPlayer) {
        try { firefoxStreamPlayer.stop(); } catch {}
        firefoxStreamPlayer = null;
      }
      if (firefoxStreamAbortController) {
        try { firefoxStreamAbortController.abort(); } catch {}
        firefoxStreamAbortController = null;
      }

      // Check session cache first for instant playback
      const cacheKey = getTtsCacheKey(text, voice, rate, model);
      if (ttsSessionCache.has(cacheKey)) {
        const cached = ttsSessionCache.get(cacheKey);
        broadcastTtsState({ state: 'playing', token });
        playAudioChunk(cached.dataUrl, rate, token).then(ok => {
          if (token === activeAudioToken) {
            broadcastTtsState({ state: 'ended', token });
          }
        });
        return { ok: true, cached: true, token };
      }

      broadcastTtsState({ state: 'preparing', token });

      const queue = {
        token,
        text,
        voice,
        rate,
        model,
        geminiKey,
        abortController: new AbortController()
      };
      currentPlaybackQueue = queue;

      // Chrome/Edge MV3 offscreen streaming
      const hasOffscreen = await ensureOffscreenDocument();
      if (hasOffscreen) {
        chrome.runtime.sendMessage({
          target: 'makan-offscreen',
          action: 'stream-tts',
          text,
          geminiKey,
          voice,
          rate,
          model,
          token
        }).then(res => {
          if (!res || !res.ok) {
            console.warn('Offscreen stream start failed, falling back to pipelined playback:', res?.error);
            if (token === activeAudioToken) startPipelinedPlayback(queue);
          }
        }).catch(err => {
          console.warn('Offscreen message error, falling back to pipelined playback:', err);
          if (token === activeAudioToken) startPipelinedPlayback(queue);
        });
        return { ok: true, streaming: true, token };
      }

      // Firefox MV3 background page streaming (direct AudioContext support)
      if (typeof GeminiAudioStreamPlayer !== 'undefined' && typeof streamGeminiTts === 'function') {
        try {
          firefoxStreamAbortController = new AbortController();
          firefoxStreamPlayer = new GeminiAudioStreamPlayer({
            rate,
            sampleRate: 24000,
            onFirstSound: () => {
              if (token === activeAudioToken) broadcastTtsState({ state: 'playing', token });
            },
            onEnded: () => {
              if (token === activeAudioToken) {
                broadcastTtsState({ state: 'ended', token });
                firefoxStreamPlayer = null;
              }
            },
            onError: (err) => {
              if (token === activeAudioToken) {
                console.warn('Firefox stream playback error, falling back to pipelining:', err);
                startPipelinedPlayback(queue);
              }
            }
          });

          streamGeminiTts(text, geminiKey, {
            voice,
            rate,
            model,
            player: firefoxStreamPlayer,
            signal: firefoxStreamAbortController.signal,
            fallback: false
          }).catch(err => {
            if (token === activeAudioToken && err.name !== 'AbortError') {
              console.warn('Firefox stream error, falling back to pipelined:', err);
              startPipelinedPlayback(queue);
            }
          });
          return { ok: true, streaming: true, token };
        } catch (err) {
          console.warn('Firefox stream setup error, falling back to pipelining:', err);
        }
      }

      // Direct fallback to pipelining if neither offscreen nor direct streaming available
      startPipelinedPlayback(queue);
      return { ok: true, pipelined: true, token };
    }

    // TTS: Stop playing speech audio immediately
    if (req.action === 'stop-tts') {
      const stoppedToken = activeAudioToken;
      activeAudioToken++;
      if (currentPlaybackQueue) {
        try { currentPlaybackQueue.abortController.abort(); } catch {}
        currentPlaybackQueue = null;
      }
      if (pendingChunkResolve) {
        const res = pendingChunkResolve;
        pendingChunkResolve = null;
        res(null);
      }
      if (firefoxDirectAudio) {
        try { firefoxDirectAudio.pause(); } catch {}
        firefoxDirectAudio = null;
      }
      if (firefoxStreamPlayer) {
        try { firefoxStreamPlayer.stop(); } catch {}
        firefoxStreamPlayer = null;
      }
      if (firefoxStreamAbortController) {
        try { firefoxStreamAbortController.abort(); } catch {}
        firefoxStreamAbortController = null;
      }
      if (chrome.offscreen) {
        chrome.runtime.sendMessage({
          target: 'makan-offscreen',
          action: 'stop-audio'
        }).catch(() => {});
      }
      // Say which speech was stopped, so a button that already moved on to a newer speech ignores this.
      broadcastTtsState({ state: 'stopped', token: stoppedToken });
      return { ok: true };
    }

    // Self-Check: Check accessibility of a tab
    if (req.action === 'check-tab-status') {
      let targetTab = null;
      if (req.tabId) {
        try { targetTab = await chrome.tabs.get(req.tabId); } catch {}
      }
      if (!targetTab) {
        // The Options page itself is the active tab when this runs from there, so look for the web page
        // the user was most recently on (any window), not at the Options page.
        const all = await chrome.tabs.query({});
        const web = all.filter(t => /^(https?|file):/i.test(t.url || '')).sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
        targetTab = web[0];
        if (!targetTab) {
          const activeTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          targetTab = activeTabs.find(t => !String(t.url || '').startsWith(EXT_URL));
        }
      }

      if (!targetTab) return { ok: false, reason: 'No normal web page is open. Open a website in another tab, then press "Check Active Tab" again.' };

      const url = targetTab.url || '';
      const isInternal = url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('about:') || url.startsWith('view-source:');
      const onFirefox = /Firefox\//.test(navigator.userAgent);
      const isStore = url.includes('microsoftedge.microsoft.com/addons') || url.includes('chromewebstore.google.com') || url.includes('chrome.google.com/webstore') || (onFirefox && url.includes('addons.mozilla.org'));
      const isFile = url.startsWith('file://');
      const accessible = isTabAccessible(url);

      let host = '';
      try { host = new URL(url).hostname; } catch {}
      const isDomainDisabled = host && (cfg.disabledSites || []).includes(host);

      let contentScriptResponding = false;
      if (accessible) {
        try {
          const pingRes = await Promise.race([
            chrome.tabs.sendMessage(targetTab.id, { action: 'ping' }),
            new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 250))
          ]);
          contentScriptResponding = !!(pingRes && pingRes.ok);
        } catch {}
      }

      return {
        ok: true,
        tabId: targetTab.id,
        url: targetTab.url,
        title: targetTab.title,
        host,
        accessible,
        isInternal,
        isStore,
        isFile,
        isDomainDisabled,
        contentScriptResponding
      };
    }

    // Self-Check: Manually inject script into tab on request
    if (req.action === 'inject-into-tab') {
      const tabId = req.tabId;
      if (!tabId || !chrome.scripting?.executeScript) {
        return { ok: false, error: 'Scripting API not available or tab ID missing' };
      }
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['engine.js', 'content.js']
        });
        if (chrome.scripting.insertCSS) {
          await chrome.scripting.insertCSS({
            target: { tabId },
            files: ['content.css']
          }).catch(() => {});
        }
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }

    return { ok: false, error: 'Unknown action: ' + req.action };
  })()
    .then(sendResponse)
    .catch(err => sendResponse({ ok: false, error: err.message }));

  return true; // Keep message channel open for async response
});
