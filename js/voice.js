/* ---------- VOICE ---------- */
let liveActive = false, liveSide = 'a';
let askHistory = [];
let convHistory = [];
let curPttStop = null;

function stopRecNow() {
  if (curPttStop) {
    try { curPttStop(); } catch {}
    curPttStop = null;
  }
}

function isSilenceHallucination(text) {
  if (!text) return true;
  const clean = text.trim().toLowerCase().replace(/[.,!?;:()[\]"'\-_/\\*~`]/g, '').trim();
  if (!clean) return true;
  const bad = [
    'thank you', 'thanks', 'thank you for watching', 'thanks for watching',
    'thank you very much', 'subtitles by', 'subtitles created by',
    'translated by', 'amara.org', 'mbc', 'please subscribe',
    'like and subscribe', 'subscribe', 'bye', 'goodbye', 'see you next time',
    'silence', 'applause', 'music', 'cheering',
    'ممنون', 'متشکرم', 'تشکر', 'با تشکر', 'ممنون از تماشای شما',
    'زیرنویس', 'خداحافظ', 'بسیار ممنون', 'تشکر از شما'
  ];
  if (bad.includes(clean)) return true;
  if (/^[\s.·…\-–—•*]+$/.test(text)) return true;
  return false;
}

function updateEmptyState() {
  const empty = $('vEmptyState');
  if (!empty) return;
  const hasBubbles = $('bubbles')?.children.length > 0;
  empty.hidden = hasBubbles;
  const tipText = $('vFirstUseText');
  if (tipText) {
    const hasKey = !!(cfg.eng.gemini.key || cfg.eng.groq.key || cfg.eng.openrouter.key || cfg.eng.ollama.on);
    tipText.textContent = hasKey ? L('vTipHasKey') : L('vTipNoKey');
  }
}

function usableAiEngine() {
  return (cfg.eng.gemini.key && !sessionBlocked.has('gemini')) ||
         (cfg.eng.groq.key && !sessionBlocked.has('groq')) ||
         (cfg.eng.openrouter.key && !sessionBlocked.has('openrouter')) ||
         (cfg.eng.ollama.on && cfg.eng.ollama.model) ||
         (cfg.eng.custom.on && cfg.eng.custom.model);
}

function updateAskAiView() {
  const hasAi = usableAiEngine();
  const noAiCard = $('vAskNoAi');
  const askEmpty = $('vAskEmpty');
  if (noAiCard) noAiCard.hidden = hasAi;
  if (askEmpty) askEmpty.hidden = !hasAi || (askHistory.length > 0) || ($('askBubbles')?.children.length > 0);
}

function updateLiveSpeakerLabels() {
  const s = $('src').value, t = $('tgt').value;
  const effectiveA = (s === 'auto') ? (t.startsWith('fa') ? 'en' : (t.startsWith('en') ? 'fa' : 'en')) : s;
  const nameA = `${L('speakerA')} (${langName(effectiveA)})`;
  const nameB = `${L('speakerB')} (${langName(t)})`;
  if ($('vLiveSpkAName')) $('vLiveSpkAName').textContent = nameA;
  if ($('vLiveSpkBName')) $('vLiveSpkBName').textContent = nameB;
}

function initVoiceLangs() {
  const vSrc = $('vSrc'), vTgt = $('vTgt');
  if (!vSrc || !vTgt) return;
  vSrc.innerHTML = `<option value="auto">${esc(L('detect'))}</option>` +
    LANGS.map(l => `<option value="${l[0]}">${esc(l[1])}</option>`).join('');
  vTgt.innerHTML = LANGS.map(l => `<option value="${l[0]}">${esc(l[1])}</option>`).join('');
  vSrc.value = $('src')?.value || 'auto';
  vTgt.value = $('tgt')?.value || 'fa';
  vSrc.onchange = () => {
    if ($('src')) { $('src').value = vSrc.value; $('src').onchange(); }
    updateVoiceLangPills();
  };
  vTgt.onchange = () => {
    if ($('tgt')) { $('tgt').value = vTgt.value; $('tgt').onchange(); }
    updateVoiceLangPills();
  };
}

function getVoiceTabReadiness() {
  const mode = sttMode();
  let asrOk = true, asrReason = '';
  if (mode === 'whisper') {
    asrOk = typeof asrReady === 'function' ? asrReady() : false;
    if (!asrOk) asrReason = L('voiceNoModel') || 'Model not downloaded';
  } else if (mode === 'browser') {
    const hasSR = 'SpeechRecognition' in self || 'webkitSpeechRecognition' in self;
    asrOk = !!hasSR;
    if (!asrOk) asrReason = L('voiceNoSR') || 'Speech recognition unavailable';
  } else if (mode === 'helper') {
    asrOk = !!(typeof isHelperConnected === 'function' && isHelperConnected());
    if (!asrOk) asrReason = L('voiceNoHelper') || 'Speech helper not connected';
  } else if (mode === 'groq') {
    asrOk = !!cfg.eng.groq.key;
    if (!asrOk) asrReason = L('voiceNoKey') || 'API key required';
  } else if (mode === 'gemini') {
    asrOk = !!(cfg.eng.gemini.key && !sessionBlocked.has('gemini'));
    if (!asrOk) asrReason = L('voiceNoKey') || 'API key required';
  }

  if (window.__micBlocked || window.__micDenied) {
    asrOk = false;
    asrReason = L('voiceNoMic') || 'Microphone blocked';
  }

  // Translation engine readiness
  const activeTransEng = $('vTransEngine')?.value || store.get('voiceTransEngine', 'auto');
  let transOk = true, transReason = '';
  if (typeof trAnyReady !== 'function') {
    transOk = true;
  } else if (isOff()) {
    transOk = trAnyReady();
  } else if (activeTransEng === 'auto') {
    transOk = cfg.order.some(usable);
  } else {
    transOk = usable(activeTransEng);
  }
  if (!transOk) {
    transReason = L('voiceNoTrans') || 'Translation engine not ready';
  }

  // Voice readiness
  const tLang = $('tgt')?.value || 'fa';
  let voiceOk = true, voiceReason = '';
  let vKind = 'device';
  if (typeof MC !== 'undefined') {
    const vRes = resolveVoice(tLang);
    voiceOk = vRes && vRes.kind !== 'none';
    vKind = vRes?.kind;
    if (!voiceOk) {
      voiceReason = L('voiceNoVoice') || 'No voice for target language';
    }
  }

  const allOk = asrOk && transOk && voiceOk;
  let overallReason = '';
  if (!asrOk) overallReason = asrReason;
  else if (!transOk) overallReason = transReason;
  else if (!voiceOk) overallReason = voiceReason;

  return {
    ready: allOk,
    reason: overallReason,
    asr: { ok: asrOk, reason: asrReason, mode },
    trans: { ok: transOk, reason: transReason, engine: activeTransEng },
    voice: { ok: voiceOk, reason: voiceReason, kind: vKind }
  };
}

function updateVoiceReadiness() {
  const r = (typeof window !== 'undefined' && typeof window.getVoiceTabReadiness === 'function')
    ? window.getVoiceTabReadiness()
    : getVoiceTabReadiness();
  const chip = $('vVoiceReadyChip');
  const txt = $('vVoiceReadyText');
  if (chip) {
    chip.dataset.ready = String(r.ready);
    chip.classList.toggle('ready', r.ready);
    chip.classList.toggle('not-ready', !r.ready);
  }
  if (txt) {
    txt.textContent = r.ready ? L('voiceReady') : `${L('voiceNotReady')}: ${r.reason}`;
  }
  if (chip) {
    chip.title = r.ready ? (L('voiceReady') + ' — All engines ready') : (L('voiceNotReady') + ': ' + r.reason);
  }

  // Update subtitle: do not say "offline" unless the selected engines are offline
  const subEl = $('vPageSub');
  if (subEl) {
    const isAsrOff = r.asr.mode === 'whisper' && r.asr.ok;
    const isTransOff = isOff() || (r.trans.engine && ENG[r.trans.engine]?.offline);
    const isVoiceOff = r.voice.kind === 'piper' || r.voice.kind === 'device';
    const allOffline = isAsrOff && isTransOff && isVoiceOff;
    subEl.textContent = allOffline ? L('pageVoiceSubOffline') : L('pageVoiceSub');
  }

  updateVoicePrivacyNote(r);

  if (typeof updateVoiceStatusStrip === 'function') {
    updateVoiceStatusStrip(r);
  }
}

function updateVoicePrivacyNote(readiness) {
  const el = $('vPrivacyLine');
  if (!el) return;
  const r = readiness || ((typeof window !== 'undefined' && typeof window.getVoiceTabReadiness === 'function')
    ? window.getVoiceTabReadiness()
    : getVoiceTabReadiness());
  const isAsrLocal = r.asr.ok && (r.asr.mode === 'whisper' || r.asr.mode === 'helper');
  const activeTrans = r.trans?.engine || $('vTransEngine')?.value || store.get('voiceTransEngine', 'auto');
  const isTransLocal = r.trans.ok && (
    isOff() ||
    activeTrans === 'nllb' ||
    activeTrans === 'bergamot' ||
    activeTrans === 'offline' ||
    activeTrans === 'local' ||
    (ENG[activeTrans] && (ENG[activeTrans].tier === 'local' || ENG[activeTrans].off || ENG[activeTrans].offline))
  );
  const isVoiceLocal = r.voice.ok && (r.voice.kind === 'piper' || r.voice.kind === 'device');
  const allLocal = isAsrLocal && isTransLocal && isVoiceLocal;

  if (allLocal) {
    el.hidden = false;
    el.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><span>${esc(L('voicePrivateNote'))}</span>`;
    el.className = 'voice-privacy-note local';
  } else {
    el.hidden = true;
    el.innerHTML = '';
    el.className = 'voice-privacy-note';
  }
}

function updateVoiceStatusStrip(readiness) {
  const strip = $('vStatusStrip');
  if (!strip) return;
  const r = readiness || ((typeof window !== 'undefined' && typeof window.getVoiceTabReadiness === 'function')
    ? window.getVoiceTabReadiness()
    : getVoiceTabReadiness());

  let asrName = 'Browser';
  if (r.asr.mode === 'whisper') {
    const wm = typeof asrModel === 'function' ? asrModel() : null;
    asrName = wm ? mcText(wm.name) : 'Whisper';
  } else if (r.asr.mode === 'groq') {
    asrName = 'Groq';
  } else if (r.asr.mode === 'helper') {
    asrName = 'Helper (' + (cfg.helperModel || 'Whisper') + ')';
  } else if (r.asr.mode === 'gemini') {
    asrName = 'Gemini';
  }

  let transName = 'Auto';
  const activeTrans = r.trans?.engine || $('vTransEngine')?.value || store.get('voiceTransEngine', 'auto');
  if (activeTrans !== 'auto' && ENG[activeTrans]) {
    transName = ENG[activeTrans].name;
  } else if (isOff()) {
    const trM = (typeof trModels === 'function' && typeof mcReady === 'function' && trModels().find(mcReady)) || (typeof trModels === 'function' && trModels()[0]);
    transName = trM ? mcText(trM.name) : 'Offline';
  }

  const tLang = $('tgt')?.value || 'fa';
  let voiceName = '';
  if (r.voice.kind === 'piper') {
    voiceName = (typeof MC !== 'undefined' && typeof resolveVoice === 'function') ? mcText(resolveVoice(tLang)?.m?.name) : 'Piper';
  } else if (r.voice.kind === 'gemini') {
    voiceName = cfg.tts?.voices?.[tLang.split('-')[0]] || 'Gemini';
  } else if (r.voice.kind === 'device') {
    const voiceObj = (typeof speechSynthesis !== 'undefined' && typeof pickVoice === 'function') ? pickVoice(tLang) : null;
    voiceName = voiceObj ? voiceObj.name : langName(tLang);
  } else if (r.voice.kind === 'none') {
    voiceName = langName(tLang);
  }
  if (!voiceName) {
    const voiceObj = (typeof speechSynthesis !== 'undefined' && typeof pickVoice === 'function') ? pickVoice(tLang) : null;
    voiceName = voiceObj ? voiceObj.name : langName(tLang);
  }

  const asrOk = r.asr.ok;
  const transOk = r.trans.ok;
  const voiceOk = r.voice.ok;
  const okText = L('voiceReady') || 'Ready';

  const items = [
    {
      id: 'vStripAsrChip',
      ok: asrOk,
      html: `<span class="status-dot ${asrOk ? 'ok' : 'warn'}" aria-hidden="true"></span><span title="${esc(r.asr.reason || okText)}"><bdi>${esc(asrName)}</bdi> ${esc(asrOk ? okText : r.asr.reason)}</span>`
    },
    {
      id: 'vStripTransChip',
      ok: transOk,
      html: `<span class="status-dot ${transOk ? 'ok' : 'warn'}" aria-hidden="true"></span><span title="${esc(r.trans.reason || okText)}"><bdi>${esc(transName)}</bdi> ${esc(transOk ? okText : r.trans.reason)}</span>`
    },
    {
      id: 'vStripVoiceChip',
      ok: voiceOk,
      html: `<span class="status-dot ${voiceOk ? 'ok' : 'warn'}" aria-hidden="true"></span><span title="${esc(r.voice.reason || okText)}"><bdi>${esc(voiceName)}</bdi> ${esc(voiceOk ? okText : r.voice.reason)}</span>`
    }
  ];

  const isAsrLocal = r.asr.ok && (r.asr.mode === 'whisper' || r.asr.mode === 'helper');
  const isTransLocal = r.trans.ok && (
    isOff() ||
    activeTrans === 'nllb' ||
    activeTrans === 'bergamot' ||
    activeTrans === 'offline' ||
    activeTrans === 'local' ||
    (ENG[activeTrans] && (ENG[activeTrans].tier === 'local' || ENG[activeTrans].off || ENG[activeTrans].offline))
  );
  const isVoiceLocal = r.voice.ok && (r.voice.kind === 'piper' || r.voice.kind === 'device');
  const allLocal = isAsrLocal && isTransLocal && isVoiceLocal;

  const infoText = allLocal ? L('voicePrivateNote') : (isOff() ? L('offMode') : L('statusOnlineActive'));
  const infoIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="voice-status-info-icon" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

  strip.innerHTML = `
    <div class="voice-status-items">
      ${items.map(it => `<div class="voice-status-item" id="${it.id}">${it.html}</div>`).join('<span class="voice-status-sep" aria-hidden="true">|</span>')}
    </div>
    <div class="voice-status-info">
      ${infoIcon}
      <span>${esc(infoText)}</span>
    </div>
  `;
}

function updateVoiceLangPills() {
  const s = $('src').value, t = $('tgt').value;
  const aText = s === 'auto' ? L('detect') : langName(s);
  const bText = langName(t);
  if ($('vLangA')) $('vLangA').textContent = aText;
  if ($('vLangB')) $('vLangB').textContent = bText;
  if ($('vSrc') && $('vSrc').value !== s) $('vSrc').value = s;
  if ($('vTgt') && $('vTgt').value !== t) $('vTgt').value = t;
  updateLiveSpeakerLabels();
  updateVoiceReadiness();
}

function fillVoiceTransEngines() {
  const select = $('vTransEngine');
  if (!select) return;
  const ok = cfg.order.filter(usable);
  const cur = store.get('voiceTransEngine', 'auto');
  select.innerHTML = `<option value="auto">${esc(L('auto'))}</option>` +
    ok.map(id => `<option value="${id}">${esc(ENG[id].name)}</option>`).join('');
  select.value = ok.includes(cur) ? cur : 'auto';
}

function fillAskLangs() {
  const cur = $('vAskLang').value || $('tgt').value;
  $('vAskLang').innerHTML = `<option value="auto">${esc(L('vAskLangAuto') || 'Same as question')}</option>` +
    LANGS.map(l => `<option value="${l[0]}">${esc(l[1])}</option>`).join('');
  $('vAskLang').value = cur;
  if ($('vAskLang').selectedIndex < 0) $('vAskLang').value = $('tgt').value;
  $('vAskLang').onchange = () => { if (typeof updateCompactVoiceButtons === 'function') updateCompactVoiceButtons(); };
}

// Mode switcher: Conversation vs Ask AI
$('vTabConv').onclick = () => {
  $('vTabConv').classList.add('on');
  $('vTabAsk').classList.remove('on');
  $('vTabConv').setAttribute('aria-selected', 'true');
  $('vTabAsk').setAttribute('aria-selected', 'false');
  $('vViewConv').hidden = false;
  $('vViewAsk').hidden = true;
  updateEmptyState();
  setVoiceState('ready');
};
$('vTabAsk').onclick = () => {
  stopLive();
  $('vTabAsk').classList.add('on');
  $('vTabConv').classList.remove('on');
  $('vTabAsk').setAttribute('aria-selected', 'true');
  $('vTabConv').setAttribute('aria-selected', 'false');
  $('vViewConv').hidden = true;
  $('vViewAsk').hidden = false;
  fillAskLangs();
  updateAskAiView();
  setVoiceState('ready');
};

if ($('vAskOpenKeys')) $('vAskOpenKeys').onclick = () => $('openSet').click();

// Swap voice languages
$('vSwap').onclick = () => {
  const s = $('src').value, t = $('tgt').value;
  if (s === 'auto') {
    $('src').value = t;
    $('tgt').value = (t === 'en' ? 'fa' : 'en');
  } else {
    $('src').value = t;
    $('tgt').value = s;
  }
  $('src').onchange();
  $('tgt').onchange();
  updateVoiceLangPills();
  toast(`${langShort($('src').value)} ⇄ ${langShort($('tgt').value)}`, 'ok', 1500);
};

// Save and Clear conversation
$('vSaveConv').onclick = () => {
  const bubbles = $('bubbles').querySelectorAll('.bub');
  if (!bubbles.length) {
    toast(L('empty'), 'warn');
    return;
  }
  const s = $('src').value, t = $('tgt').value;
  const sName = langName(s), tName = langName(t);
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toLocaleTimeString();

  let out = `MAKAN Translate — Voice Conversation\n`;
  out += `Date: ${dateStr} ${timeStr}\n`;
  out += `Language Pair: ${sName} (${s}) ⇄ ${tName} (${t})\n`;
  out += `Turns: ${bubbles.length}\n`;
  out += `==================================================\n\n`;

  bubbles.forEach((bub, i) => {
    const spk = bub.querySelector('.bub-speaker')?.textContent || `Turn ${i + 1}`;
    const tm = bub.querySelector('.bub-time')?.textContent || '';
    const orig = bub.querySelector('.bub-orig-text')?.textContent || '';
    const trans = bub.querySelector('.bub-text')?.textContent || '';
    const tags = [...bub.querySelectorAll('.bub-tag')].map(t => t.textContent).join(' · ');

    out += `[${tm}] ${spk}:\n`;
    out += `Original:    ${orig}\n`;
    out += `Translation: ${trans}\n`;
    if (tags) out += `Details:     ${tags}\n`;
    out += `--------------------------------------------------\n\n`;
  });

  download(`conversation-${dateStr}.txt`, out);
  toast(L('convSaved'), 'ok');
};

$('vClearConv').onclick = () => {
  $('bubbles').innerHTML = '';
  convHistory = [];
  $('vPartial').hidden = true;
  $('vPartial').textContent = '';
  updateEmptyState();
  setVoiceState('ready');
  toast(L('convCleared'), 'ok', 1500);
};

// Toggle compact settings panel
$('vToggleSettings').onclick = () => {
  const panel = $('vSettingsPanel');
  const btn = $('vToggleSettings');
  const isHidden = panel.hidden;
  panel.hidden = !isHidden;
  btn.classList.toggle('on', isHidden);
  btn.setAttribute('aria-expanded', String(isHidden));
};

// Audio Input (Mic vs PC Video/Audio loopback) synchronization
function syncAudioInputUI() {
  const isDesktop = (cfg.audioInput === 'desktop');
  const btn = $('vAudioInputToggle');
  const lbl = $('vAudioInputLabel');
  if (btn) btn.classList.toggle('on', isDesktop);
  if (lbl) lbl.textContent = isDesktop ? 'PC Audio' : 'Mic';
  if ($('vAudioInput')) $('vAudioInput').value = isDesktop ? 'desktop' : 'mic';
  if ($('vAudioInputSetting')) $('vAudioInputSetting').value = isDesktop ? 'desktop' : 'mic';
}

function setAudioInput(mode) {
  releaseMicStream();
  cfg.audioInput = (mode === 'desktop') ? 'desktop' : 'mic';
  saveCfg();
  syncAudioInputUI();
  if (typeof saveAppConfig === 'function') saveAppConfig();
  toast(cfg.audioInput === 'desktop' ? 'PC Audio / Video translation active' : 'Microphone input active', 'ok', 2000);
}

if ($('vAudioInputToggle')) {
  $('vAudioInputToggle').onclick = () => {
    setAudioInput(cfg.audioInput === 'desktop' ? 'mic' : 'desktop');
  };
}

if ($('vAudioInput')) {
  $('vAudioInput').onchange = () => {
    setAudioInput($('vAudioInput').value);
  };
}

if ($('vAudioInputSetting')) {
  $('vAudioInputSetting').onchange = () => {
    setAudioInput($('vAudioInputSetting').value);
  };
}
syncAudioInputUI();
$('vSpeed').onchange = () => {
  cfg.tts.rate = +$('vSpeed').value || 1.0;
  saveCfg();
  if ($('ttsSpeed')) $('ttsSpeed').value = String(cfg.tts.rate);
};
if ($('vLiveVoiceSpeed')) $('vLiveVoiceSpeed').onchange = () => store.set('liveVoiceSpeed', $('vLiveVoiceSpeed').value);
document.querySelectorAll('select#vSilenceWait').forEach(el => {
  el.onchange = () => {
    cfg.silenceWait = +el.value || 800;
    saveCfg();
    document.querySelectorAll('select#vSilenceWait').forEach(other => {
      other.value = String(cfg.silenceWait);
    });
  };
});
if ($('vSttChoice')) $('vSttChoice').onchange = () => {
  cfg.stt = $('vSttChoice').value;
  saveCfg();
  if ($('sttSel')) $('sttSel').value = cfg.stt;
  if (typeof updateHelperSettingsVisibility === 'function') updateHelperSettingsVisibility();
  voiceLabels();
  if (typeof updateSttPickerDisplay === 'function') updateSttPickerDisplay();
};
if ($('vTransEngine')) $('vTransEngine').onchange = () => {
  store.set('voiceTransEngine', $('vTransEngine').value);
};

// Enhanced addBubble with editing and metadata
function addBubble(container, side, said, trans, fromLang, toLang, meta = {}) {
  const isConv = (container === $('bubbles'));
  const d = document.createElement('div');
  d.className = 'bub ' + side;

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isFaFrom = fromLang.startsWith('fa') || fromLang.startsWith('ar') || /[\u0600-\u06FF]/.test(said);
  const dirFrom = isFaFrom ? 'rtl' : 'ltr';
  const isFaTo = toLang.startsWith('fa') || toLang.startsWith('ar') || /[\u0600-\u06FF]/.test(trans);
  const dirTo = isFaTo ? 'rtl' : 'ltr';

  const speakerName = side === 'a' ? L('speakerA') : L('speakerB');
  const langLabel = fromLang === 'auto' ? '' : langShort(fromLang);

  const vRes = resolveVoice(toLang);
  const canSpeak = vRes && vRes.kind !== 'none';

  d.innerHTML = `
    <div class="bub-header">
      <span class="bub-speaker">${esc(speakerName)}${langLabel ? ' · ' + esc(langLabel) : ''}</span>
      <span class="bub-time">${esc(timeStr)}</span>
    </div>
    <div class="bub-orig" dir="${dirFrom}" title="${esc(L('tapToEdit'))}">
      <span class="bub-orig-text">${esc(said)}</span>
      <span class="bub-edit-icon">${SVG_ICONS.pencilSmall}</span>
    </div>
    <div class="bub-text" dir="${dirTo}">${esc(trans)}</div>
    <div class="bub-actions">
      <button class="replay-btn" type="button" data-lang="${esc(toLang)}" ${canSpeak ? '' : 'disabled aria-disabled="true"'} title="${esc(canSpeak ? L('replay') : (L('noVoiceInstalled') || 'No voice available for this language'))}">
        ${SVG_ICONS.speakerSmall}<span>${esc(L('replay'))}</span>
      </button>
      <button class="copy-btn" type="button" title="${esc(L('copy'))}">
        ${SVG_ICONS.copySmall}<span>${esc(L('copy'))}</span>
      </button>
      <div class="bub-meta-tags">
        ${meta.stt ? `<span class="bub-tag"><bdi>${esc(meta.stt)}${meta.sttModel ? ' · ' + esc(meta.sttModel) : ''}</bdi></span>` : ''}
        ${meta.engine ? `<span class="bub-tag"><bdi>${esc(meta.engine)}</bdi></span>` : ''}
        ${meta.voice ? `<span class="bub-tag"><bdi>${esc(meta.voice)}</bdi></span>` : ''}
        ${meta.dur ? `<span class="bub-tag bub-time-chip"><bdi>${esc(meta.dur)}</bdi></span>` : ''}
      </div>
    </div>
  `;

  // Replay speech
  d.querySelector('.replay-btn').onclick = e => {
    e.stopPropagation();
    const curRes = resolveVoice(toLang);
    if (!curRes || curRes.kind === 'none') {
      toast(L('noVoiceInstalled'), 'warn');
      return;
    }
    const txt = d.querySelector('.bub-text').textContent;
    if (txt && txt !== '…' && txt !== '—') speak(txt, toLang);
  };

  // Copy translation
  d.querySelector('.copy-btn').onclick = e => {
    e.stopPropagation();
    const txt = d.querySelector('.bub-text').textContent;
    if (txt && txt !== '…' && txt !== '—') {
      copy(txt);
      toast(L('copied'), 'ok', 1500);
    }
  };

  // Click original text to edit and re-translate
  const origWrap = d.querySelector('.bub-orig');
  origWrap.onclick = e => {
    e.stopPropagation();
    if (d.querySelector('.bub-edit-row')) return;
    const curSaid = d.querySelector('.bub-orig-text').textContent;
    origWrap.hidden = true;

    const editRow = document.createElement('div');
    editRow.className = 'bub-edit-row';
    editRow.innerHTML = `
      <input type="text" class="bub-edit-input" dir="${dirFrom}" value="${esc(curSaid)}">
      <button class="btn bub-btn-xs cta bub-retranslate-btn">${esc(L('retranslate'))}</button>
      <button class="btn bub-btn-xs ghost bub-cancel-btn">✕</button>
    `;
    origWrap.parentNode.insertBefore(editRow, origWrap.nextSibling);

    const input = editRow.querySelector('.bub-edit-input');
    input.focus();
    input.select();

    const finishEdit = async (doReTr) => {
      const newSaid = input.value.trim();
      editRow.remove();
      origWrap.hidden = false;
      if (doReTr && newSaid && newSaid !== curSaid) {
        d.querySelector('.bub-orig-text').textContent = newSaid;
        d.querySelector('.bub-text').textContent = '…';
        setVoiceState('working');
        try {
          const r = await translateItems([newSaid], opts({ src: fromLang, tgt: toLang }));
          d.querySelector('.bub-text').textContent = r.out[0];
          setVoiceState('ready');
          if ($('vAuto').checked) speak(r.out[0], toLang);
        } catch (err) {
          d.querySelector('.bub-text').textContent = '—';
          fail(err);
          setVoiceState('error');
        }
      }
    };

    editRow.querySelector('.bub-retranslate-btn').onclick = () => finishEdit(true);
    editRow.querySelector('.bub-cancel-btn').onclick = () => finishEdit(false);
    input.onkeydown = ev => {
      if (ev.key === 'Enter') finishEdit(true);
      else if (ev.key === 'Escape') finishEdit(false);
    };
  };

  container.appendChild(d);
  d.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  if (isConv) {
    convHistory.push({ time: timeStr, spk: speakerName, orig: said, trans, fromLang, toLang, meta });
    updateEmptyState();
  }
  return d;
}

// Hands-free Live conversation loop / speaker-directed live mode
async function triggerLiveBrowserSpeaker(side) {
  if (!liveActive) return;
  if (isSpeaking()) stopSpeak();
  const s = $('src').value, t = $('tgt').value;
  const effectiveA = (s === 'auto') ? (t.startsWith('fa') ? 'en' : 'fa') : s;
  const from = (side === 'a') ? effectiveA : t;
  const to = (side === 'a') ? t : effectiveA;
  const listenLang = from;
  const spkBtn = (side === 'a') ? $('vLiveSpkABtn') : $('vLiveSpkBBtn');
  if (spkBtn) spkBtn.classList.add('listening');
  setVoiceState('listening', L('vLiveListening'));

  try {
    let tx = await new Promise(resolve => {
      listen(listenLang, null, rText => resolve(rText), interim => {
        $('vPartial').hidden = false;
        $('vPartial').textContent = interim;
      }).then(res => {
        if (res && res.started === false) resolve('');
      });
    });
    $('vPartial').hidden = true;
    $('vPartial').textContent = '';
    if (spkBtn) spkBtn.classList.remove('listening');
    if (!liveActive) return;
    if (!tx || !tx.trim() || isSilenceHallucination(tx)) {
      setVoiceState('ready');
      return;
    }
    tx = tx.trim();
    setVoiceState('working', L('vLiveTranslating'));
    const t0 = performance.now();
    const activeTransEng = $('vTransEngine')?.value || store.get('voiceTransEngine', 'auto');
    const r = await translateItems([tx], opts({ src: from, tgt: to, engine: activeTransEng }));
    if (!liveActive) return;
    const dt = ((performance.now() - t0) / 1000).toFixed(1) + 's';
    const voiceObj = pickVoice(to);
    const voiceName = voiceObj ? voiceObj.name.slice(0, 16) : (resolveVoice(to).kind === 'piper' ? mcText(resolveVoice(to).m.name).slice(0, 16) : L('ttsFallback'));
    const isWh = sttMode() === 'whisper';
    addBubble($('bubbles'), side, tx, r.out[0] || '…', from, to, {
      stt: isWh ? 'Whisper' : 'Browser',
      sttModel: isWh && asrModel() ? mcText(asrModel().name) : null,
      engine: r.used,
      voice: voiceName,
      dur: dt
    });
    if (r.out[0] && $('vAuto').checked) {
      setVoiceState('speaking', L('vLiveSpeaking'));
      const forceFast = $('vLiveVoiceSpeed')?.value !== 'quality';
      await speakFast(r.out[0], to, forceFast);
    }
    if (liveActive) setVoiceState('ready');
  } catch (err) {
    if (spkBtn) spkBtn.classList.remove('listening');
    setVoiceState('ready');
    toast(err.message || 'Turn error', 'warn', 3000);
  }
}

async function runLiveLoop() {
  liveActive = true;
  liveSide = 'a';
  const liveBtn = $('vLiveBtn');
  if (liveBtn) {
    liveBtn.classList.add('live-on');
    liveBtn.setAttribute('aria-pressed', 'true');
    $('vLiveTxt').textContent = L('vStopLive');
    liveBtn.querySelector('.v-live-dot').style.display = 'inline-block';
  }
  updateVoiceLangPills();

  try {
    await getMicStream();
  } catch (err) {
    toast(err.message, 'err');
    stopLive();
    return;
  }

  const curStt = sttMode();
  const hasGeminiKey = !!(cfg.eng.gemini.key || (cfg.tts.mode==='gemini'&&cfg.tts.key)) && !sessionBlocked.has('gemini') && cfg.eng.gemini.on !== false;
  const isGemini = hasGeminiKey && curStt !== 'whisper' && curStt !== 'browser';

  if (!isGemini) {
    // With browser engine, language cannot be detected before listening.
    // Display clear notice and offer two speaker buttons.
    const box = $('vLiveBrowserBox');
    if (box) box.hidden = false;
    const pttWrap = $('vPttWrap');
    if (pttWrap) pttWrap.style.display = 'none';
    updateLiveSpeakerLabels();
    setVoiceState('ready', L('vStatusReady'));
    return;
  }

  // With Gemini, detect between the two selected languages continuously
  const box = $('vLiveBrowserBox');
  if (box) box.hidden = true;
  const pttWrap = $('vPttWrap');
  if (pttWrap) pttWrap.style.display = '';

  while (liveActive) {
    while (liveActive && isSpeaking()) {
      setVoiceState('speaking');
      await sleep(100);
    }
    if (!liveActive) break;
    await sleep(250); // Grace period to prevent hearing itself

    try {
      const s = $('src').value, t = $('tgt').value;
      const effectiveA = (s === 'auto') ? (t.startsWith('fa') ? 'en' : (t.startsWith('en') ? 'fa' : 'en')) : s;
      const effectiveB = t;
      setVoiceState('listening', L('vLiveListening'));

      let turnResult = null;
      const t0 = performance.now();

      const blob = await record(null, interim => {
        $('vPartial').hidden = false;
        $('vPartial').textContent = interim;
      });
      if (!liveActive || !blob || blob.size < 1200) {
        $('vPartial').hidden = true;
        $('vPartial').textContent = '';
        await sleep(200);
        continue;
      }
      setVoiceState('working', L('vLiveTranslating'));
      const res = await interpretGemini(blob, effectiveA, effectiveB);
      turnResult = {
        lang: res.lang,
        transcript: res.transcript,
        translation: res.translation,
        stt: 'Gemini',
        engine: 'Gemini'
      };

      $('vPartial').hidden = true;
      $('vPartial').textContent = '';
      if (!liveActive || !turnResult || !turnResult.transcript || isSilenceHallucination(turnResult.transcript)) {
        await sleep(200);
        continue;
      }

      const spokenLang = (turnResult.lang || '').toLowerCase();
      const normA = effectiveA.split('-')[0].toLowerCase();
      const isSideA = (spokenLang === effectiveA.toLowerCase() || spokenLang.startsWith(normA));
      const side = isSideA ? 'a' : 'b';
      const from = isSideA ? effectiveA : effectiveB;
      const to = isSideA ? effectiveB : effectiveA;
      const dt = ((performance.now() - t0) / 1000).toFixed(1) + 's';
      const voiceObj = pickVoice(to);
      const voiceName = voiceObj ? voiceObj.name.slice(0, 16) : (resolveVoice(to).kind === 'piper' ? mcText(resolveVoice(to).m.name).slice(0, 16) : L('ttsFallback'));

      const d = addBubble($('bubbles'), side, turnResult.transcript, turnResult.translation || '…', from, to, {
        stt: turnResult.stt,
        sttModel: turnResult.sttModel,
        engine: turnResult.engine,
        voice: voiceName,
        dur: dt
      });

      if (!liveActive) break;

      if (turnResult.translation && $('vAuto').checked) {
        setVoiceState('speaking', L('vLiveSpeaking'));
        const forceFast = $('vLiveVoiceSpeed')?.value !== 'quality';
        await speakFast(turnResult.translation, to, forceFast);
        await sleep(250); // Echo prevention gap
      }

      if (!liveActive) break;
      setVoiceState('listening');
      await sleep(200);
    } catch (turnErr) {
      console.warn('[Live Loop Turn Error]:', scrubKeys(turnErr&&turnErr.message||turnErr));
      $('vPartial').hidden = true;
      $('vPartial').textContent = '';
      toast(turnErr.message || 'Turn error', 'warn', 3000);
      await sleep(800);
    }
  }
  stopLive();
}

function stopLive() {
  liveActive = false;
  const liveBtn = $('vLiveBtn');
  if (liveBtn) {
    liveBtn.classList.remove('live-on');
    liveBtn.setAttribute('aria-pressed', 'false');
    $('vLiveTxt').textContent = L('vLive');
  }
  const box = $('vLiveBrowserBox');
  if (box) box.hidden = true;
  const pttWrap = $('vPttWrap');
  if (pttWrap) pttWrap.style.display = '';
  if ($('vLiveSpkABtn')) $('vLiveSpkABtn').classList.remove('listening');
  if ($('vLiveSpkBBtn')) $('vLiveSpkBBtn').classList.remove('listening');
  $('vPartial').hidden = true;
  $('vPartial').textContent = '';
  if (rec) { try { rec.stop(); } catch {} }
  stopSpeak();
  setVoiceState('ready');
}
$('vLiveBtn').onclick = () => { if (liveActive) stopLive(); else runLiveLoop(); };
if ($('vLiveSpkABtn')) $('vLiveSpkABtn').onclick = () => triggerLiveBrowserSpeaker('a');
if ($('vLiveSpkBBtn')) $('vLiveSpkBBtn').onclick = () => triggerLiveBrowserSpeaker('b');
$('vStopSpeak').onclick = stopSpeak;
$('vAskStopSpeak').onclick = stopSpeak;

/* Push to Talk handlers */
function setupPTT(btn, onSend, viewType) {
  if (!btn) return;
  let isRecording = false, tapActive = false, pressTime = 0, pttRec = null, pttAc = null;
  const isAsk = (viewType === 'ask');
  const partEl = isAsk ? $('vAskPartial') : $('vPartial');

  async function startRec() {
    if (isRecording) return;
    if (isSpeaking()) {
      stopSpeak();
      await sleep(35);
    }
    isRecording = true;
    pressTime = Date.now();
    setVoiceState('listening', L('vStatusListening'), { isTap: tapActive });
    if (partEl) { partEl.hidden = false; partEl.textContent = '…'; }

    if (!isElectron && sttMode() === 'browser') {
      const SR = self.SpeechRecognition || self.webkitSpeechRecognition;
      if (!SR) {
        isRecording = false;
        tapActive = false;
        if (partEl) { partEl.hidden = true; partEl.textContent = ''; }
        setVoiceState('error', L('noSR'));
        if (typeof showSpeakNotice === 'function') showSpeakNotice(L('noSR'));
        toast(L('noSR'), 'err');
        return;
      }
      try {
        const rec = new SR();
        const l = isAsk ? ($('vAskLang')?.value || 'auto') : ($('src')?.value || 'auto');
        rec.lang = (l === 'auto') ? (navigator.language || 'en') : l;
        rec.interimResults = true;
        rec.continuous = false;
        let finalTx = '', interimTx = '';
        rec.onresult = e => {
          let f = '', it = '';
          for (let i = 0; i < e.results.length; ++i) {
            const r = e.results[i];
            const t = r[0]?.transcript || '';
            if (r.isFinal) f += t;
            else it += t;
          }
          finalTx = f;
          interimTx = it;
          const display = (f + (f && it && !f.endsWith(' ') && !it.startsWith(' ') ? ' ' : '') + it).trim();
          if (display && partEl) partEl.textContent = display;
        };
        rec.onerror = e => {
          if (e.error !== 'no-speech' && e.error !== 'aborted') {
            const isBlocked = e.error === 'not-allowed';
            const msg = isBlocked ? L('micBlocked') : ((L('voiceSpeechError') || 'Speech error') + ': ' + e.error);
            if (typeof showSpeakNotice === 'function') showSpeakNotice(msg);
            toast(msg, 'err');
          }
        };
        rec.onend = () => {
          isRecording = false;
          tapActive = false;
          pttRec = null;
          curPttStop = null;
          if (partEl) { partEl.hidden = true; partEl.textContent = ''; }
          const dur = Date.now() - pressTime;
          const combined = (finalTx + (finalTx && interimTx && !finalTx.endsWith(' ') && !interimTx.startsWith(' ') ? ' ' : '') + interimTx).trim();
          if (dur < 350 && !combined) {
            setVoiceState('ready');
            return;
          }
          if (combined) {
            onSend({ transcript: combined, mode: 'browser' });
          } else {
            setVoiceState('ready');
          }
        };
        pttRec = { stop: () => { try { rec.stop(); } catch {} } };
        curPttStop = pttRec.stop;
        rec.start();
        return;
      } catch (err) {
        isRecording = false;
        tapActive = false;
        pttRec = null;
        curPttStop = null;
        if (partEl) { partEl.hidden = true; partEl.textContent = ''; }
        const errMsg = err.message || L('voiceSpeechError');
        setVoiceState('error', errMsg);
        if (typeof showSpeakNotice === 'function') showSpeakNotice(errMsg);
        toast(errMsg, 'err');
        return;
      }
    }

    try {
      const st = await getMicStream();
      const mr = new MediaRecorder(st);
      const ch = [];
      let maxRms = 0;

      try {
        pttAc = new (self.AudioContext || self.webkitAudioContext)();
        const an = pttAc.createAnalyser();
        pttAc.createMediaStreamSource(st).connect(an);
        an.fftSize = 512;
        const buf = new Float32Array(512);
        const levelIv = setInterval(() => {
          if (!isRecording) { clearInterval(levelIv); return; }
          an.getFloatTimeDomainData(buf);
          let s = 0; for (const x of buf) s += x * x;
          const rms = Math.sqrt(s / buf.length);
          if (rms > maxRms) maxRms = rms;
          updateMeterLevel(rms);
        }, 80);
      } catch {}

      mr.ondataavailable = e => ch.push(e.data);
      mr.onstop = async () => {
        isRecording = false;
        tapActive = false;
        pttRec = null;
        curPttStop = null;
        if (pttAc) { try { pttAc.close(); } catch {} pttAc = null; }
        resetMeterLevel();
        if (partEl) { partEl.hidden = true; partEl.textContent = ''; }

        const dur = Date.now() - pressTime;
        if (dur < 350) {
          setVoiceState('ready');
          return;
        }
        if (maxRms < 0.012) {
          toast(L('micLowWarn'), 'warn', 4000);
        }

        const blob = new Blob(ch, { type: mr.mimeType });
        if (blob.size < 1200) {
          setVoiceState('ready');
          return;
        }
        onSend(blob);
      };

      pttRec = { stop: () => { if (mr.state === 'recording') mr.stop(); } };
      curPttStop = pttRec.stop;
      mr.start();
    } catch (err) {
      isRecording = false;
      tapActive = false;
      curPttStop = null;
      if (pttAc) { try { pttAc.close(); } catch {} pttAc = null; }
      resetMeterLevel();
      if (partEl) { partEl.hidden = true; partEl.textContent = ''; }
      const isNotAllowed = err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
      const isNotFound = err && (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError');
      const errMsg = isNotAllowed ? L('micBlocked') : isNotFound ? L('noMicrophone') : (err.message || L('micBlocked'));
      setVoiceState('error', errMsg);
      if (typeof showSpeakNotice === 'function') showSpeakNotice(errMsg);
      toast(errMsg, 'err');
    }
  }

  function stopRec() {
    if (!isRecording) return;
    if (pttRec) pttRec.stop();
  }

  btn.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    btn.setPointerCapture?.(e.pointerId);
    if (tapActive) stopRec();
    else startRec();
  });

  btn.addEventListener('pointerup', e => {
    e.preventDefault();
    if (!isRecording) return;
    const elapsed = Date.now() - pressTime;
    if (elapsed < 350) {
      tapActive = true;
      setVoiceState('listening', L('vStatusListening'), { isTap: true });
    } else {
      stopRec();
    }
  });

  btn.addEventListener('pointercancel', () => { if (isRecording) stopRec(); });

  btn.addEventListener('ptt-start', () => {
    if (tapActive) stopRec();
    else startRec();
  });
  btn.addEventListener('ptt-stop', () => {
    if (!isRecording) return;
    const elapsed = Date.now() - pressTime;
    if (elapsed < 350) {
      tapActive = true;
      setVoiceState('listening', L('vStatusListening'), { isTap: true });
    } else {
      stopRec();
    }
  });
}

async function handleConvPttAudio(audioInput) {
  const s = $('src').value, t = $('tgt').value;
  setVoiceState('working', L('vStatusWorking'));
  const t0 = performance.now();

  try {
    let turnResult = null;
    const mode = sttMode();

    if (audioInput && typeof audioInput === 'object' && audioInput.transcript) {
      turnResult = {
        lang: s === 'auto' ? 'en' : s,
        transcript: audioInput.transcript,
        translation: '',
        stt: 'Browser',
        engine: 'Auto'
      };
    } else {
      const blob = audioInput;
      if (mode === 'helper') {
        const tx = await transcribeHelper(blob, s);
        turnResult = {
          lang: s === 'auto' ? 'en' : s,
          transcript: tx,
          translation: '',
          stt: 'Helper',
          sttModel: cfg.helperModel || 'whisper-large-v3',
          engine: 'Auto'
        };
      } else if (mode === 'groq') {
        const tx = await transcribeGroq(blob, s);
        turnResult = {
          lang: s === 'auto' ? 'en' : s,
          transcript: tx,
          translation: '',
          stt: 'Groq',
          engine: 'Auto'
        };
      } else if (mode === 'whisper') {
        if (!asrReady()) {
          toast(L('needDl'), 'warn');
          setVoiceState('ready');
          return;
        }
        const audio = await to16k(blob);
        const wmKey = asrModel().key;
        let res = await rpc('asr', { audio, lang: (s === 'auto' ? null : s.split('-')[0]), model: wmKey, langs: [s, t], returnLang: true }, [audio.buffer]);
        let tx = typeof res === 'object' ? res.text : res;
        let detectedLang = typeof res === 'object' ? res.lang : null;
        tx = (tx || '').trim();
        turnResult = { lang: detectedLang || s, transcript: tx, translation: '', stt: 'Whisper', sttModel: asrModel() ? mcText(asrModel().name) : '', engine: 'Auto' };
      } else if ((cfg.eng.gemini.key || (cfg.tts.mode==='gemini'&&cfg.tts.key)) && !sessionBlocked.has('gemini')) {
        try {
          const res = await interpretGemini(blob, s, t);
          turnResult = {
            lang: res.lang,
            transcript: res.transcript,
            translation: res.translation,
            stt: 'Gemini',
            engine: 'Gemini'
          };
        } catch (gemErr) {
          if (/quota|429|403|blocked/i.test(gemErr.message || '')) {
            toast('Gemini: ' + L('switching') + ' Google', 'warn', 4000);
          }
          if (!asrReady()) {
            toast(L('needDl'), 'warn');
            setVoiceState('ready');
            return;
          }
          const audio = await to16k(blob);
          const wmKey = asrModel().key;
          let tx = await rpc('asr', { audio, lang: (s === 'auto' ? null : s.split('-')[0]), model: wmKey, langs: [s, t], returnLang: true }, [audio.buffer]);
          tx = (typeof tx === 'object' ? tx.text : tx) || '';
          turnResult = { lang: s, transcript: tx.trim(), translation: '', stt: 'Whisper', sttModel: asrModel() ? mcText(asrModel().name) : '', engine: 'Auto' };
        }
      } else {
        if (!asrReady()) {
          toast(L('needDl'), 'warn');
          setVoiceState('ready');
          return;
        }
        const audio = await to16k(blob);
        const wmKey = asrModel().key;
        let res = await rpc('asr', { audio, lang: (s === 'auto' ? null : s.split('-')[0]), model: wmKey, langs: [s, t], returnLang: true }, [audio.buffer]);
        let tx = typeof res === 'object' ? res.text : res;
        let detectedLang = typeof res === 'object' ? res.lang : null;
        tx = (tx || '').trim();
        turnResult = { lang: detectedLang || s, transcript: tx, translation: '', stt: 'Whisper', sttModel: asrModel() ? mcText(asrModel().name) : '', engine: 'Auto' };
      }
    }

    if (!turnResult || !turnResult.transcript || isSilenceHallucination(turnResult.transcript)) {
      setVoiceState('ready');
      return;
    }

    const spokenLang = turnResult.lang;
    let side = 'a';
    if (spokenLang) {
      side = (spokenLang === t || spokenLang.startsWith(t.split('-')[0])) ? 'b' : 'a';
    } else {
      const hasFarsi = /[\u0600-\u06FF]/.test(turnResult.transcript);
      const sFa = s.startsWith('fa') || s.startsWith('ar'), tFa = t.startsWith('fa') || t.startsWith('ar');
      if (hasFarsi && tFa && !sFa) side = 'b';
      else if (hasFarsi && sFa && !tFa) side = 'a';
      else if (!hasFarsi && sFa && !tFa) side = 'b';
      else if (!hasFarsi && !sFa && tFa) side = 'a';
    }

    const from = side === 'a' ? s : t;
    const to = side === 'a' ? t : (s === 'auto' ? 'en' : s);

    if (!turnResult.translation) {
      const activeTransEng = $('vTransEngine')?.value || store.get('voiceTransEngine', 'auto');
      const tr = await translateItems([turnResult.transcript], opts({ src: from, tgt: to, engine: activeTransEng }));
      turnResult.translation = tr.out[0];
      turnResult.engine = tr.used;
    }

    const dt = ((performance.now() - t0) / 1000).toFixed(1) + 's';
    const voiceObj = pickVoice(to);
    const voiceName = voiceObj ? voiceObj.name.slice(0, 16) : (resolveVoice(to).kind === 'piper' ? mcText(resolveVoice(to).m.name).slice(0, 16) : L('ttsFallback'));

    if (!voiceObj && resolveVoice(to).kind !== 'piper' && !noVoiceTold[to]) {
      noVoiceTold[to] = 1;
      toast(L('noVoiceWarn'), 'warn', 7000);
      if (typeof showSpeakNotice === 'function') showSpeakNotice(L('voiceNoVoice') || L('noVoiceWarn'));
    }

    addBubble($('bubbles'), side, turnResult.transcript, turnResult.translation, from, to, {
      stt: turnResult.stt,
      sttModel: turnResult.sttModel,
      engine: turnResult.engine,
      voice: voiceName,
      dur: dt
    });

    if (turnResult.translation && $('vAuto').checked) {
      setVoiceState('speaking');
      await speakFast(turnResult.translation, to, $('vLiveVoiceSpeed')?.value !== 'quality');
    }
    setVoiceState('ready');
  } catch (err) {
    fail(err);
    if (typeof showSpeakNotice === 'function') showSpeakNotice(err.message || L('failed'));
    setVoiceState('error', err.message);
  }
}

async function handleAskPttAudio(audioInput) {
  setVoiceState('working', L('vStatusWorking'));
  try {
    let tx = '';
    let sttName = '';
    let sttModelName = '';
    const askL = $('vAskLang').value, l2 = askL === 'auto' ? null : askL.split('-')[0];
    const mode = sttMode();

    if (audioInput && typeof audioInput === 'object' && audioInput.transcript) {
      tx = audioInput.transcript;
      sttName = 'Browser';
    } else {
      const blob = audioInput;
      if (mode === 'helper') {
        tx = await transcribeHelper(blob, askL);
        sttName = 'Helper';
        sttModelName = cfg.helperModel || 'whisper-large-v3';
      } else if (mode === 'groq') {
        tx = await transcribeGroq(blob, askL);
        sttName = 'Groq';
      } else if (mode === 'whisper') {
        if (!asrReady()) {
          toast(L('needDl'), 'warn');
          setVoiceState('ready');
          return;
        }
        const audio = await to16k(blob);
        tx = await rpc('asr', { audio, lang: l2, model: asrModel().key, langs: [$('src').value, $('tgt').value] }, [audio.buffer]);
        sttName = 'Whisper';
        sttModelName = asrModel() ? mcText(asrModel().name) : '';
      } else if (cfg.eng.gemini.key && !sessionBlocked.has('gemini')) {
        tx = await transcribeGemini(blob, l2);
        sttName = 'Gemini';
      } else {
        if (!asrReady()) {
          toast(L('needDl'), 'warn');
          setVoiceState('ready');
          return;
        }
        const audio = await to16k(blob);
        tx = await rpc('asr', { audio, lang: l2, model: asrModel().key, langs: [$('src').value, $('tgt').value] }, [audio.buffer]);
        sttName = 'Whisper';
        sttModelName = asrModel() ? mcText(asrModel().name) : '';
      }
    }
    tx = (tx || '').trim();
    if (tx && !isSilenceHallucination(tx)) {
      $('vAskIn').value = tx;
      doAsk(tx, { stt: sttName, sttModel: sttModelName });
    } else {
      setVoiceState('ready');
    }
  } catch (err) {
    fail(err);
    setVoiceState('error', err.message);
  }
}

setupPTT($('vPttBtn'), handleConvPttAudio, 'conv');
setupPTT($('vAskPttBtn'), handleAskPttAudio, 'ask');

let pttSpaceActive = false;
window.addEventListener('keydown', e => {
  if (e.code === 'Escape') {
    if (isSpeaking()) {
      stopSpeak();
      setVoiceState('ready');
    }
    if (liveActive) {
      stopLive();
    }
    stopRecNow();
    return;
  }

  if (e.code === 'Space' && !e.repeat) {
    const isVoiceTab = $('tab-voice')?.classList.contains('on');
    if (!isVoiceTab) return;
    const tag = document.activeElement?.tagName?.toLowerCase();
    const isEditable = document.activeElement?.isContentEditable;
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || isEditable) return;
    const isAsk = !$('vViewAsk')?.hidden;
    const btn = isAsk ? $('vAskPttBtn') : $('vPttBtn');
    if (btn) {
      e.preventDefault();
      pttSpaceActive = true;
      btn.dispatchEvent(new CustomEvent('ptt-start', { detail: { bySpace: true } }));
    }
  }
});
window.addEventListener('keyup', e => {
  if (e.code === 'Space' && pttSpaceActive) {
    pttSpaceActive = false;
    const isAsk = !$('vViewAsk')?.hidden;
    const btn = isAsk ? $('vAskPttBtn') : $('vPttBtn');
    if (btn) {
      e.preventDefault();
      btn.dispatchEvent(new CustomEvent('ptt-stop', { detail: { bySpace: true } }));
    }
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (voiceState === 'listening') {
      stopRecNow();
      setVoiceState('ready');
    }
    if (isSpeaking()) {
      stopSpeak();
      setVoiceState('ready');
    }
  }
});

// Ask AI mode
async function doAsk(query, sttMeta) {
  query = (query || '').trim();
  if (!query) return;
  if (isSilenceHallucination(query)) return;
  $('vAskIn').value = '';

  if (!usableAiEngine()) {
    updateAskAiView();
    toast(L('vAskNoAiDesc'), 'warn', 5000);
    return;
  }

  // Finglish typed here is turned into Persian script first (best effort: if that fails, the text is sent as typed).
  let fgNote = '';
  try { const fg = await finglishStep(query, undefined, 'auto'); if (fg.kind === 'ok') { fgNote = query; query = fg.persian; } } catch { /* send as typed */ }
  const ansCode = $('vAskLang').value === 'auto' ? ($('tgt').value || 'en') : $('vAskLang').value;
  const ansLName = langName(ansCode);
  const sys = `You are a friendly, helpful voice assistant. Answer the user's request in ${ansLName}. Keep your answer short (1 to 3 sentences), clear, conversational, and natural to hear when read aloud. Do NOT use any Markdown formatting, asterisks, bullet points, numbered lists, URLs, or emojis. Plain conversational text only.`;

  const userBub = addBubble($('askBubbles'), 'a', query, '…', 'auto', ansCode, { stt: fgNote ? 'Finglish' : (sttMeta?.stt || 'Input'), sttModel: sttMeta?.sttModel || null });
  if (fgNote) userBub.title = fgNote;
  userBub.querySelector('.bub-text')?.remove();
  const d = addBubble($('askBubbles'), 'b', query, L('vAskThinking') || 'Thinking…', ansCode, ansCode, { engine: 'AI' });
  d.querySelector('.bub-orig')?.remove();

  askHistory.push({ role: 'user', content: query });
  if (askHistory.length > 8) askHistory = askHistory.slice(-8);

  $('vAskSend').disabled = true;
  $('vAskPttBtn').disabled = true;
  setVoiceState('working', L('vAskThinking'));

  try {
    const r = await chat(askHistory, { system: sys, engine: $('engine').value });
    const ans = cleanSpokenText(r.text);
    d.querySelector('.bub-text').textContent = ans;
    const tagEl = d.querySelector('.bub-meta-tags');
    if (tagEl) tagEl.innerHTML = `<span class="bub-tag">${esc(L('via') + ' ' + r.used)}</span>`;
    askHistory.push({ role: 'assistant', content: ans });
    updateAskAiView();
    setVoiceState('speaking');
    if (ans) await speak(ans, ansCode);
    setVoiceState('ready');
  } catch (e) {
    d.querySelector('.bub-text').textContent = '—';
    fail(e);
    setVoiceState('error', e.message);
  } finally {
    $('vAskSend').disabled = false;
    $('vAskPttBtn').disabled = false;
  }
}
$('vAskSend').onclick = () => doAsk($('vAskIn').value);
$('vAskIn').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    doAsk($('vAskIn').value);
  }
});
$('vAskNew').onclick = () => {
  askHistory = [];
  $('askBubbles').innerHTML = '';
  $('vAskPartial').hidden = true;
  $('vAskPartial').textContent = '';
  updateAskAiView();
  setVoiceState('ready');
  toast(L('done'), 'ok', 1500);
};

initVoiceLangs();
updateVoiceLangPills();
updateVoiceReadiness();

$('tabs')?.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b?.dataset?.tab === 'voice') updateVoiceReadiness();
});

if (typeof window !== 'undefined') {
  window.getVoiceTabReadiness = getVoiceTabReadiness;
  window.updateVoicePrivacyNote = updateVoicePrivacyNote;
  window.updateVoiceStatusStrip = updateVoiceStatusStrip;
  window.updateVoiceReadiness = updateVoiceReadiness;
}

