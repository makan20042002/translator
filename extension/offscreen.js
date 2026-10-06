/**
 * MAKAN Translate - Offscreen Audio Player
 * Manifest V3 audio playback context.
 * Bypasses page Content Security Policy (CSP) and plays synthesized WAV/MP3 audio.
 */

let curAudio = null;
let currentToken = null;
let curStreamPlayer = null;
let curAbortController = null;

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.target !== 'makan-offscreen') return false;
  // Only the extension's own background may control the player. Messages broadcast by a web page's
  // content script reach this page too, and must be ignored.
  if (!sender || sender.id !== chrome.runtime.id || !String(sender.url || '').startsWith(chrome.runtime.getURL(''))) return false;

  // Stream Gemini TTS via Web Audio AudioContext
  if (req.action === 'stream-tts') {
    stopCurrentAudio();
    const token = req.token || Date.now();
    currentToken = token;

    try {
      curAbortController = new AbortController();
      const player = new GeminiAudioStreamPlayer({
        rate: req.rate || 1.0,
        sampleRate: 24000,
        onFirstSound: () => {
          if (currentToken === token) {
            chrome.runtime.sendMessage({ target: 'makan-background', action: 'tts-state', state: 'playing', token }).catch(() => {});
          }
        },
        onEnded: () => {
          if (currentToken === token) {
            curStreamPlayer = null;
            chrome.runtime.sendMessage({ target: 'makan-background', action: 'tts-state', state: 'ended', token }).catch(() => {});
          }
        },
        onError: (err) => {
          if (currentToken === token) {
            curStreamPlayer = null;
            chrome.runtime.sendMessage({ target: 'makan-background', action: 'tts-state', state: 'stream-error', error: err.message, token }).catch(() => {});
          }
        }
      });
      curStreamPlayer = player;

      streamGeminiTts(req.text, req.geminiKey, {
        voice: req.voice,
        rate: req.rate,
        model: req.model,
        player,
        signal: curAbortController.signal,
        fallback: false // Let background handle pipelined fallback if stream fails
      }).then(res => {
        sendResponse({ ok: true, streaming: true, token });
      }).catch(err => {
        if (currentToken === token && err.name !== 'AbortError') {
          chrome.runtime.sendMessage({
            target: 'makan-background',
            action: 'tts-state',
            state: 'stream-error',
            error: err.message,
            token
          }).catch(() => {});
        }
        sendResponse({ ok: false, error: err.message });
      });

      return true; // async
    } catch (err) {
      curStreamPlayer = null;
      sendResponse({ ok: false, error: err.message });
      return false;
    }
  }

  if (req.action === 'play-audio') {
    stopCurrentAudio();
    const token = req.token || Date.now();
    currentToken = token;

    try {
      const audio = new Audio(req.audioUrl);
      curAudio = audio;
      if (req.rate) audio.playbackRate = req.rate;

      audio.onended = () => {
        if (currentToken === token) {
          curAudio = null;
          chrome.runtime.sendMessage({ target: 'makan-background', action: 'tts-state', state: 'ended', token }).catch(() => {});
        }
      };

      audio.onerror = (e) => {
        if (currentToken === token) {
          curAudio = null;
          chrome.runtime.sendMessage({ target: 'makan-background', action: 'tts-state', state: 'error', error: 'Audio playback failed', token }).catch(() => {});
        }
      };

      audio.play().then(() => {
        sendResponse({ ok: true, status: 'playing' });
      }).catch(err => {
        curAudio = null;
        sendResponse({ ok: false, error: err.message });
      });
    } catch (err) {
      curAudio = null;
      sendResponse({ ok: false, error: err.message });
    }
    return true; // async
  }

  if (req.action === 'stop-audio') {
    stopCurrentAudio();
    sendResponse({ ok: true, status: 'stopped' });
    return false;
  }
});

function stopCurrentAudio() {
  currentToken = null;
  if (curAbortController) {
    try { curAbortController.abort(); } catch {}
    curAbortController = null;
  }
  if (curStreamPlayer) {
    try { curStreamPlayer.stop(); } catch {}
    curStreamPlayer = null;
  }
  if (curAudio) {
    try {
      curAudio.pause();
      curAudio.currentTime = 0;
    } catch {}
    curAudio = null;
  }
}
