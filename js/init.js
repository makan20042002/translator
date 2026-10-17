/* ---------- shell ---------- */
(() => {
  let mediaHandle = null;
  let mediaMounting = null;

  function onMediaLanguageChange() {
    if (mediaHandle && typeof mediaHandle.refresh === 'function') {
      mediaHandle.refresh();
    }
  }

  function isMediaWebGpuAvailable() {
    if (typeof navigator === 'undefined' || !('gpu' in navigator) || !navigator.gpu) return false;
    if (typeof hasWebGpu === 'boolean' && !hasWebGpu) return false;
    return true;
  }

  function getMediaWhisperGpu(m) {
    if (!isMediaWebGpuAvailable()) return false;
    if (!m) return false;
    if (!m.gpu && m.webgpu !== 'optional') return false;

    const mKey = m.key || (typeof asrModel === 'function' ? asrModel()?.key : 'base');
    const wasmVal = (typeof store !== 'undefined') ? store.get('whisper_wasm', '') : '';
    const webgpuVal = (typeof store !== 'undefined') ? store.get('whisper_webgpu', '') : '';

    if (wasmVal === mKey || wasmVal === true || wasmVal === '1') {
      if (webgpuVal !== mKey && webgpuVal !== true) return false;
    }
    if (webgpuVal === mKey || webgpuVal === true || webgpuVal === '1') {
      return true;
    }
    if (typeof cfg !== 'undefined') {
      if (cfg.whisperDevice === 'wasm' || cfg.whisperDevice === 'cpu' || cfg.whisper_webgpu === false) return false;
      if (cfg.whisperDevice === 'webgpu' || cfg.whisper_webgpu === true) return true;
    }
    return Boolean(m.gpu || m.webgpu === 'optional');
  }

  function getMediaWhisperChoice() {
    const m = (typeof asrModel === 'function') ? asrModel() : null;
    if (!m) return null;
    return {
      repo: m.repo,
      name: (typeof mcText === 'function') ? mcText(m.name) : (m.name || m.repo),
      memMB: m.memMB || 1000,
      ready: (typeof mcReady === 'function') ? mcReady(m) : false,
      gpu: getMediaWhisperGpu(m)
    };
  }

  function getMediaTranslateChoice() {
    const chosen = (typeof $ === 'function' && $('engine')?.value) || 'auto';
    let id = chosen === 'auto' ? ((typeof cfg !== 'undefined' && cfg.order ? cfg.order.find(usable) : null) || 'nllb') : chosen;
    if (typeof isOff === 'function' && isOff()) {
      if (chosen !== 'auto' && typeof offCapable === 'function' && !offCapable(chosen)) {
        id = (typeof cfg !== 'undefined' && cfg.order) ? (cfg.order.find(x => usable(x) && offCapable(x)) || 'nllb') : 'nllb';
      }
    }
    const eng = (typeof ENG !== 'undefined' && ENG[id]) ? ENG[id] : { name: id, tier: 'free' };
    const isOffline = (typeof offCapable === 'function') ? offCapable(id) : false;
    const kind = isOffline ? 'offline' : 'online';

    let model = (typeof cfg !== 'undefined' && cfg.eng?.[id]?.model) || eng.model || '';
    if (id === 'nllb') {
      const s = (typeof $ === 'function' && $('src')?.value) || 'en';
      const t = (typeof $ === 'function' && $('tgt')?.value) || 'fa';
      const m = (typeof pickTr === 'function') ? pickTr(s, t) : null;
      model = m ? ((typeof mcText === 'function') ? mcText(m.name) : (m.name || m.repo)) : 'NLLB-200 600M';
    }

    const ready = (typeof why === 'function' ? !why(id) : true) && (!isOff() || isOffline);
    const needsKey = Boolean(eng.key && !(typeof cfg !== 'undefined' && cfg.eng?.[id]?.key));

    const res = {
      id,
      name: eng.name,
      kind,
      model,
      ready: Boolean(ready && !needsKey),
      needsKey
    };

    if (id === 'nllb') {
      res.licence = 'CC BY-NC 4.0';
      res.licenceNote = 'Non-commercial use only (CC BY-NC 4.0)';
    } else if (id === 'ollama') {
      res.licence = 'MIT';
    }

    return res;
  }

  async function mediaTranslateCues(cues, opts) {
    if (!Array.isArray(cues)) return [];
    const src = opts?.src || (typeof $ === 'function' && $('src')?.value) || 'en';
    const tgt = opts?.tgt || (typeof $ === 'function' && $('tgt')?.value) || 'fa';
    const signal = opts?.signal;
    const onProgress = opts?.onProgress;
    const onInfo = opts?.onInfo;

    if (signal?.aborted) {
      const err = new DOMException('Aborted', 'AbortError');
      err.code = 'aborted';
      err.partial = [];
      throw err;
    }

    const activeEngine = (typeof $ === 'function' && $('engine')?.value) || 'auto';
    let chain;
    if (activeEngine === 'auto') {
      chain = (typeof cfg !== 'undefined' && cfg.order) ? cfg.order.filter(usable) : [];
    } else {
      if (typeof usable === 'function' && !usable(activeEngine)) {
        const err = new Error(typeof L === 'function' ? (isOff() ? L('noOff') : L('noEngine')) : 'Engine unavailable');
        err.code = (typeof isOff === 'function' && isOff()) ? 'notdownloaded' : 'failed';
        err.partial = [];
        throw err;
      }
      chain = [activeEngine];
    }

    if (typeof isOff === 'function' && isOff()) {
      chain = chain.filter(id => (typeof offCapable === 'function' ? offCapable(id) : false));
      if (!chain.length) {
        const err = new Error(typeof L === 'function' ? L('noOff') : 'No offline engine is ready');
        err.code = 'notdownloaded';
        err.partial = [];
        throw err;
      }
    }

    if (!chain.length) {
      const err = new Error(typeof L === 'function' ? (isOff() ? L('noOff') : L('noEngine')) : 'No engine available');
      err.code = (typeof isOff === 'function' && isOff()) ? 'notdownloaded' : 'failed';
      err.partial = [];
      throw err;
    }

    const texts = cues.map(c => c.o || '');
    const translatedCues = cues.map(c => ({ s: c.s, e: c.e, o: c.o, t: '' }));

    const firstEngine = chain[0];
    if (firstEngine && typeof ENG !== 'undefined' && ENG[firstEngine]) {
      const eng = ENG[firstEngine];
      const kind = (typeof offCapable === 'function' && offCapable(firstEngine)) ? 'offline' : 'online';
      const model = (cfg.eng?.[firstEngine]?.model) || eng.model || (firstEngine === 'nllb' ? 'NLLB-200 600M' : '');
      const licence = firstEngine === 'nllb' ? 'CC BY-NC 4.0' : (firstEngine === 'ollama' ? 'MIT' : '');
      onInfo?.({ id: firstEngine, name: eng.name, kind, model, licence });
    }

    try {
      const res = await translateItems(texts, {
        src,
        tgt,
        signal,
        chain,
        onEngineChange: engId => {
          if (engId && typeof ENG !== 'undefined' && ENG[engId]) {
            const eng = ENG[engId];
            const kind = (typeof offCapable === 'function' && offCapable(engId)) ? 'offline' : 'online';
            const model = (cfg.eng?.[engId]?.model) || eng.model || (engId === 'nllb' ? 'NLLB-200 600M' : '');
            const licence = engId === 'nllb' ? 'CC BY-NC 4.0' : (engId === 'ollama' ? 'MIT' : '');
            onInfo?.({ id: engId, name: eng.name, kind, model, licence });
          }
        },
        onProgress: (done, total, engId) => {
          onProgress?.({
            stage: 'translate',
            fraction: total ? (done / total) : 0,
            done,
            total,
            engine: (typeof ENG !== 'undefined' && ENG[engId]?.name) || engId
          });
        },
        onBatch: (batchIndices, batchRes, allOut) => {
          batchIndices.forEach(idx => {
            translatedCues[idx] = {
              s: cues[idx].s,
              e: cues[idx].e,
              o: cues[idx].o,
              t: allOut[idx] || ''
            };
          });
        }
      });

      return cues.map((c, i) => ({
        s: c.s,
        e: c.e,
        o: c.o,
        t: (res && res.out && res.out[i] !== undefined) ? res.out[i] : ''
      }));
    } catch (err) {
      if (signal?.aborted || err.name === 'AbortError' || err.code === 'aborted') {
        const abortErr = new DOMException('Aborted', 'AbortError');
        abortErr.code = 'aborted';
        abortErr.partial = translatedCues;
        throw abortErr;
      }
      err.partial = translatedCues;
      throw err;
    }
  }

  const host = {
    t: k => (typeof L === 'function' ? L(k) : k),
    getLang: () => (typeof ui !== 'undefined' ? ui : 'en'),
    toast: (msg, type) => (typeof toast === 'function' ? toast(msg, type) : null),
    saveFile: (name, blob) => {
      const a = document.createElement('a');
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    getLanguages: () => (typeof LANGS !== 'undefined' ? LANGS.map(([code, label]) => {
      const parts = label.split(' · ');
      const name = (ui === 'fa' ? parts[0] : parts[1]) || label;
      return { code, name };
    }) : []),
    getWhisperChoice: getMediaWhisperChoice,
    engine: { libUrl: 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1' },
    onModelUsed: repo => { if (typeof recordModelUse === 'function') recordModelUse(repo); },
    openModelHub: () => {
      const btn = document.querySelector('#tabs button[data-tab="models"]');
      if (btn) btn.click();
    },
    translateCues: mediaTranslateCues,
    getTranslateChoice: getMediaTranslateChoice,
    loadSubtitleStyle: () => {
      try {
        return (typeof store !== 'undefined') ? store.get('media_subtitle_style', null) : null;
      } catch (e) {
        return null;
      }
    },
    saveSubtitleStyle: style => {
      try {
        if (typeof store !== 'undefined' && style && typeof style === 'object') {
          store.set('media_subtitle_style', style);
        }
      } catch (e) {}
    }
  };

  if (typeof window !== 'undefined' && window.MediaTranslate) {
    window.MediaTranslate.host = host;
    window.MediaTranslate.onLanguageChange = onMediaLanguageChange;
  }

  function ensureMediaMounted() {
    if (mediaHandle) return Promise.resolve(mediaHandle);
    if (mediaMounting) return mediaMounting;
    const root = typeof $ === 'function' ? $('tab-media') : document.getElementById('tab-media');
    if (!root || typeof window.MediaTranslate === 'undefined' || typeof window.MediaTranslate.mount !== 'function') {
      return Promise.resolve(null);
    }
    window.MediaTranslate.host = host;
    window.MediaTranslate.onLanguageChange = onMediaLanguageChange;
    mediaMounting = window.MediaTranslate.mount(root, host).then(h => {
      mediaHandle = h;
      mediaMounting = null;
      return h;
    }).catch(err => {
      mediaMounting = null;
      throw err;
    });
    return mediaMounting;
  }

  if (typeof window !== 'undefined' && window.MediaTranslate) {
    window.MediaTranslate.ensureMounted = ensureMediaMounted;
  }

  const tabsEl = typeof $ === 'function' ? $('tabs') : document.getElementById('tabs');
  if (tabsEl) {
    tabsEl.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (b && b.dataset.tab === 'media') {
        ensureMediaMounted();
      }
    });
  }
})();

$('tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  document.querySelectorAll('#tabs button').forEach(x=>{
    const on=(x===b);
    x.classList.toggle('on',on);
    if(x.hasAttribute('aria-selected'))x.setAttribute('aria-selected',on?'true':'false');
  });
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on',x.id==='tab-'+b.dataset.tab));
  if($('speakNotice'))$('speakNotice').classList.toggle('voice-mode',b.dataset.tab==='voice');
  if($('sidebar'))$('sidebar').classList.remove('open');
  if($('sidebarBackdrop'))$('sidebarBackdrop').classList.remove('open');
  if(b.dataset.tab!=='voice'){
    stopLive();
  }
  if(b.dataset.tab==='voice')checkFileProtoNotice();
  if(b.dataset.tab==='hist')renderHist();if(b.dataset.tab==='gls')renderGloss();
  if(b.dataset.tab==='models'){if(typeof renderModelHub==='function')renderModelHub();if(typeof mcScan==='function')mcScan().then(()=>{if(typeof renderModelHub==='function')renderModelHub();});}
  if(b.dataset.tab==='sub')updateSubEngineNotice();
  if(b.dataset.tab==='media'&&typeof window.MediaTranslate?.ensureMounted==='function')window.MediaTranslate.ensureMounted();
  if($('tModeGrp'))$('tModeGrp').hidden=(b.dataset.tab!=='text');
});
if($('sidebarToggleBtn'))$('sidebarToggleBtn').onclick=()=>{
  const s=$('sidebar'),bd=$('sidebarBackdrop');
  if(s){
    const open=s.classList.toggle('open');
    if(bd)bd.classList.toggle('open',open);
  }
};
if($('sidebarBackdrop'))$('sidebarBackdrop').onclick=()=>{
  $('sidebar')?.classList.remove('open');
  $('sidebarBackdrop')?.classList.remove('open');
};
$('src').onchange=()=>{store.set('src',$('src').value);voiceLabels();if(typeof updateCardLangNames==='function')updateCardLangNames();if(typeof updateOfflineModelHints==='function')updateOfflineModelHints()};
$('tgt').onchange=()=>{store.set('tgt',$('tgt').value);voiceLabels();fillVoices();fillAskLangs();if(typeof updateCardLangNames==='function'){updateCardLangNames();updateTargetCardDirection();updateListenButtonState()}if(typeof updateOfflineModelHints==='function')updateOfflineModelHints()};
$('engine').onchange=()=>{store.set('engine',$('engine').value);updateSubEngineNotice()};
if($('tMode'))$('tMode').onchange=()=>store.set('tMode',$('tMode').value);
$('tone').onchange=()=>store.set('tone',$('tone').value);
if($('subStyle'))$('subStyle').onchange=()=>{store.set('subStyle',$('subStyle').value);updateSubEngineNotice()};
if($('subFamily'))$('subFamily').onchange=()=>{store.set('subFamily',$('subFamily').checked)};
$('swap').onclick=()=>{const s=$('src').value,t=$('tgt').value;if(s==='auto'||s==='finglish'){toast(L('sameLang'),'warn');return}
  $('src').value=t;$('tgt').value=s;const a=$('tIn').value;if($('tOut').value){$('tIn').value=$('tOut').value;$('tOut').value=a}
  $('src').onchange();$('tgt').onchange();$('tIn').dispatchEvent(new Event('input'))};
$('uiLang').onclick=()=>{ui=ui==='en'?'fa':'en';store.set('ui',ui);boot()};
if($('sidebarSettingsBtn'))$('sidebarSettingsBtn').onclick=()=>$('openSet')?.click();
if($('topbarSettingsBtn'))$('topbarSettingsBtn').onclick=()=>$('openSet')?.click();
if($('tabScreenLaunchBtn'))$('tabScreenLaunchBtn').onclick=()=>{
  if(window.makanDesktop?.startScreenTranslator)window.makanDesktop.startScreenTranslator();
  else if($('btnScreenTrans'))$('btnScreenTrans').click();
};
if($('tabScreenOpenOcrBtn'))$('tabScreenOpenOcrBtn').onclick=()=>{
  $('openSet')?.click();$('setTabBtnOcr')?.click();
};
if($('tabModelsOpenSetBtn'))$('tabModelsOpenSetBtn').onclick=()=>{
  $('openSet')?.click();$('setTabBtnTrModels')?.click();
};
function updateStatusPill(){
  const pill=$('sidebarStatusPill');
  if(!pill)return;
  const isReady=(typeof trAnyReady==='function')?trAnyReady():false;
  pill.classList.toggle('ready',isReady);
  const dot=$('sidebarStatusDot')||pill.querySelector('.status-dot');
  if(dot)dot.classList.toggle('ready',isReady);
  const txt=$('sidebarStatusText')||pill.querySelector('.status-text')||pill;
  if(txt)txt.textContent=isReady?(L('statusOfflineReady')||'Offline ready'):(L('statusOnlineOnly')||'Online only');
  if(typeof renderTextStatusStrip==='function')renderTextStatusStrip();
}
async function updateStorageCard(){
  const card=$('sidebarStorageCard');
  if(!card)return;
  if(!navigator.storage||typeof navigator.storage.estimate!=='function'){
    card.hidden=true;
    return;
  }
  try{
    const est=await navigator.storage.estimate();
    if(typeof est?.usage!=='number'||typeof est?.quota!=='number'||est.quota<=0){
      card.hidden=true;
      return;
    }
    const usageMB=est.usage<1048576?(est.usage/1024).toFixed(0)+' KB':(est.usage/(1024*1024)).toFixed(1)+' MB';
    const quotaGB=(est.quota/(1024*1024*1024)).toFixed(1)+' GB';
    const pct=Math.min(100,Math.max(0,Math.round((est.usage/est.quota)*100)));
    const usageEl=$('sidebarStorageUsage');
    const barEl=$('sidebarStorageBar');
    if(usageEl)usageEl.textContent=`${usageMB} / ${quotaGB}`;
    if(barEl)barEl.style.width=pct+'%';
    card.hidden=false;
  }catch(e){
    card.hidden=true;
  }
}
function checkFileProtoNotice(){
  const el=$('vFileProtoNotice');
  if(el)el.hidden=(location.protocol!=='file:');
}
function boot(){
  const s=$('src').value,t=$('tgt').value;
  applyI18n();fillLangs();if(s){$('src').value=s;$('tgt').value=t}
  updateStatusPill();
  updateStorageCard();
  checkFileProtoNotice();
  fillEngines();if($('tMode'))$('tMode').value=getDefaultTransMode();$('tone').value=store.get('tone','');voiceLabels();renderGloss();renderVoice();fillAskLangs();
  document.querySelectorAll('select#vSilenceWait').forEach(el=>{el.value=String(cfg.silenceWait||800)});
  if($('vLiveVoiceSpeed'))$('vLiveVoiceSpeed').value=store.get('liveVoiceSpeed','fast');
  if($('subStyle'))$('subStyle').value=store.get('subStyle','film');
  if($('subFamily'))$('subFamily').checked=store.get('subFamily',false);
  updateSubEngineNotice();
  if(typeof updateDocEngineInfo==='function')updateDocEngineInfo();
  const rawParams = (location.hash && location.hash.length > 1)
    ? location.hash.slice(1)
    : ((location.search && location.search.length > 1) ? location.search.slice(1) : '');
  if (rawParams) {
    try {
      const p = new URLSearchParams(rawParams);
      const text = p.get('text');
      const srcP = p.get('src');
      const tgtP = p.get('tgt');
      if (text !== null) {
        $('tIn').value = text.slice(0, 5000);
      }
      if (srcP && (srcP === 'auto' || LANGS.some(l => l[0] === srcP))) {
        $('src').value = srcP;
      }
      if (tgtP && LANGS.some(l => l[0] === tgtP)) {
        $('tgt').value = tgtP;
      }
      voiceLabels();
      history.replaceState(null, '', location.pathname || '/');
    } catch (e) {}
  }
  if (typeof updateListenButtonState === 'function') updateListenButtonState();
  if (typeof renderTextStatusStrip === 'function') renderTextStatusStrip();
  if (typeof updateOfflineModelHints === 'function') updateOfflineModelHints();
  $('tIn').dispatchEvent(new Event('input'));
}
boot();
