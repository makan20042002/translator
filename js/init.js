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

  function resolveMediaWhisperGpu(m) {
    if (!getMediaWhisperGpu(m)) return false;
    if (m && m.gpuFiles && m.gpuFiles.length > 0 && typeof m.gpu === 'object' && m.gpu) {
      return m.gpu;
    }
    if (m && typeof m.dtype === 'object' && m.dtype) {
      return m.dtype;
    }
    return true;
  }

  function getMediaWhisperChoice() {
    const m = (typeof asrModel === 'function') ? asrModel() : null;
    if (!m) return null;
    const hasGpu = Boolean(m.gpu || m.webgpu === 'optional');
    return {
      key: m.key,
      repo: m.repo,
      name: (typeof mcText === 'function') ? mcText(m.name) : (m.name || m.repo),
      memMB: m.memMB || 1000,
      ready: (typeof mcReady === 'function') ? mcReady(m) : false,
      gpu: resolveMediaWhisperGpu(m),
      gpuVariant: m.gpu || null,
      hasGpuVariant: hasGpu
    };
  }

  function getMediaTranslateChoice() {
    const chosen = (typeof store !== 'undefined' ? store.get('engine', 'auto') : 'auto');
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
      if (m) {
        model = (typeof mcText === 'function') ? mcText(m.name) : (m.name || m.repo);
      } else if (typeof cfg !== 'undefined' && cfg.trModel && cfg.trModel !== 'auto' && typeof MC !== 'undefined' && MC.models) {
        const direct = MC.models.find(x => x.id === cfg.trModel);
        if (direct) model = (typeof mcText === 'function') ? mcText(direct.name) : (direct.name || direct.repo);
      }
      if (!model) model = 'NLLB-200 600M';
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
      if (/nllb/i.test(model)) {
        res.licence = 'CC BY-NC 4.0';
        res.licenceNote = 'Non-commercial use only (CC BY-NC 4.0)';
      } else {
        res.licence = 'MIT';
        res.licenceNote = '';
      }
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

    const translatedCues = cues.map(c => ({ s: c.s, e: c.e, o: c.o, t: '' }));

    if (signal?.aborted) {
      const err = new DOMException('Aborted', 'AbortError');
      err.code = 'aborted';
      err.partial = [];
      throw err;
    }

    try {
      const activeEngine = (typeof store !== 'undefined' ? store.get('engine', 'auto') : 'auto');
      let chain;
      if (activeEngine === 'auto') {
        chain = (typeof cfg !== 'undefined' && cfg.order) ? cfg.order.filter(usable) : [];
      } else {
        if (typeof usable === 'function' && !usable(activeEngine)) {
          const err = new Error(typeof L === 'function' ? (isOff() ? L('noOff') : (why(activeEngine) || L('noEngine'))) : 'Engine unavailable');
          throw err;
        }
        chain = [activeEngine];
      }

      if (typeof isOff === 'function' && isOff()) {
        chain = chain.filter(id => (typeof offCapable === 'function' ? offCapable(id) : false));
        if (!chain.length) {
          const err = new Error(typeof L === 'function' ? L('noOff') : 'No offline engine is ready');
          throw err;
        }
      }

      if (!chain.length) {
        const err = new Error(typeof L === 'function' ? (isOff() ? L('noOff') : L('noEngine')) : 'No engine available');
        throw err;
      }

      const texts = cues.map(c => c.o || '');

      const firstEngine = chain[0];
      if (firstEngine && typeof ENG !== 'undefined' && ENG[firstEngine]) {
        const eng = ENG[firstEngine];
        const kind = (typeof offCapable === 'function' && offCapable(firstEngine)) ? 'offline' : 'online';
        const model = (cfg.eng?.[firstEngine]?.model) || eng.model || (firstEngine === 'nllb' ? 'NLLB-200 600M' : '');
        const licence = firstEngine === 'nllb' ? 'CC BY-NC 4.0' : (firstEngine === 'ollama' ? 'MIT' : '');
        onInfo?.({ id: firstEngine, name: eng.name, kind, model, licence });
      }

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
      if (!err.code) {
        const offlineOn = (typeof isOff === 'function' && isOff()) || (typeof cfg !== 'undefined' && !!cfg.offline);
        const hasOfflineModel = typeof trAnyReady === 'function' ? trAnyReady() : false;
        err.code = (offlineOn && !hasOfflineModel) ? 'notdownloaded' : 'failed';
      }
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
    listWhisperModels: () => {
      let models = (typeof MC !== 'undefined' && MC.models) ? MC.models.filter(m => m.kind === 'whisper') : [];
      if (typeof window !== 'undefined' && window.isPhone && window.isPhone()) {
        const allowed = window.PHONE_ALLOWED_MODELS || ['asr-tiny', 'asr-base', 'asr-small'];
        models = models.filter(m => allowed.includes(m.id));
      }
      return models.map(m => ({
        key: m.key,
        repo: m.repo,
        name: (typeof mcText === 'function') ? mcText(m.name) : (m.name || m.repo),
        ready: (typeof mcReady === 'function') ? mcReady(m) : false,
        size: (typeof mcSize === 'function' && m.bytes) ? mcSize(m.bytes) : '',
        bytes: m.bytes
      }));
    },
    setWhisperChoice: (key) => {
      if (typeof cfg !== 'undefined') {
        cfg.whisper = key;
        if (typeof saveCfg === 'function') saveCfg();
        if (typeof mcRender === 'function') mcRender();
      }
    },
    engine: { libUrl: 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1' },
    onModelUsed: repo => { if (typeof window !== 'undefined' && typeof window.recordModelUse === 'function') window.recordModelUse(repo); },
    openModelHub: () => {
      const btn = document.querySelector('#tabs button[data-tab="models"]');
      if (btn) btn.click();
    },
    translateCues: mediaTranslateCues,
    getTranslateChoice: getMediaTranslateChoice,
    getEngineChoice: () => (typeof store !== 'undefined' ? store.get('engine', 'auto') : 'auto'),
    setEngineChoice: (val) => {
      if (typeof store !== 'undefined') store.set('engine', val);
      if (typeof ENG !== 'undefined' && typeof ENG.updateEnginePickers === 'function') {
        ENG.updateEnginePickers();
      }
    },
    listEngines: () => {
      const order = (typeof cfg !== 'undefined' && cfg.order) ? cfg.order : [];
      return order.map(id => ({
        id,
        name: (typeof ENG !== 'undefined' && ENG[id]?.name) || id,
        status: (typeof ENG !== 'undefined' && typeof ENG.getStatus === 'function')
          ? ENG.getStatus(id)
          : { state: 'ready', usable: true }
      }));
    },
    mountEnginePicker: (container, opts) => {
      if (typeof ENG !== 'undefined' && typeof ENG.mountEnginePicker === 'function') {
        return ENG.mountEnginePicker(container, opts);
      }
      return null;
    },
    updateEnginePickers: () => {
      if (typeof ENG !== 'undefined' && typeof ENG.updateEnginePickers === 'function') {
        ENG.updateEnginePickers();
      }
    },
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
    },
    desktop: (typeof window !== 'undefined' && (window.MTDesktop || (window.makanDesktop?.isDesktop ? window.makanDesktop : null))) || null
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

  if (typeof sanitizePhoneModelChoices === 'function') {
    sanitizePhoneModelChoices();
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
  if(b.dataset.tab==='hist')renderHist();if(b.dataset.tab==='gls')renderGloss();if(b.dataset.tab==='cmp'&&typeof initCompareLangs==='function')initCompareLangs();
  if(b.dataset.tab==='models'){if(typeof renderModelHub==='function')renderModelHub();if(typeof mcScan==='function')mcScan().then(()=>{if(typeof renderModelHub==='function')renderModelHub();});}
  if(b.dataset.tab==='sub')updateSubEngineNotice();
  if(b.dataset.tab==='doc'&&typeof updateDocEngineNoticeFromPicker==='function')updateDocEngineNoticeFromPicker();
  if(typeof ENG!=='undefined'&&typeof ENG.updateEnginePickers==='function')ENG.updateEnginePickers();
  if(b.dataset.tab==='media'&&typeof window.MediaTranslate?.ensureMounted==='function')window.MediaTranslate.ensureMounted();
  if($('tModeGrp'))$('tModeGrp').hidden=(b.dataset.tab!=='text');
  if(typeof updatePhoneNav==='function')updatePhoneNav(b.dataset.tab);
});

function updatePhoneNav(activeTab) {
  if (!activeTab) return;
  const mainPhoneTabs = ['text', 'voice', 'doc', 'media'];
  const isMain = mainPhoneTabs.includes(activeTab);
  document.querySelectorAll('#phoneBottomNav button[data-tab]').forEach(btn => {
    const on = (btn.dataset.tab === activeTab);
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  const moreBtn = document.getElementById('phoneNavMoreBtn');
  if (moreBtn) {
    moreBtn.classList.toggle('on', !isMain);
    moreBtn.setAttribute('aria-selected', !isMain ? 'true' : 'false');
  }
  document.querySelectorAll('#phoneMoreSheet .phone-sheet-item[data-tab]').forEach(item => {
    const on = (item.dataset.tab === activeTab);
    item.classList.toggle('on', on);
  });
}

function initPhoneNavigation() {
  const bottomNav = document.getElementById('phoneBottomNav');
  const moreSheet = document.getElementById('phoneMoreSheet');
  const backdrop = document.getElementById('phoneSheetBackdrop');
  const moreBtn = document.getElementById('phoneNavMoreBtn');
  const closeBtn = document.getElementById('phoneMoreCloseBtn');
  const settingsBtn = document.getElementById('phoneMoreSettingsBtn');

  function openSheet() {
    if (!moreSheet || !backdrop) return;
    moreSheet.hidden = false;
    backdrop.hidden = false;
    moreSheet.classList.add('open');
    backdrop.classList.add('open');
    if (moreBtn) moreBtn.setAttribute('aria-expanded', 'true');
  }

  function closeSheet() {
    if (!moreSheet || !backdrop) return;
    moreSheet.classList.remove('open');
    backdrop.classList.remove('open');
    moreSheet.hidden = true;
    backdrop.hidden = true;
    if (moreBtn) moreBtn.setAttribute('aria-expanded', 'false');
  }

  if (bottomNav) {
    bottomNav.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn === moreBtn || btn.dataset.phoneNav === 'more') {
        if (moreSheet && moreSheet.classList.contains('open')) closeSheet();
        else openSheet();
        return;
      }
      const tab = btn.dataset.tab;
      if (tab) {
        closeSheet();
        const tabBtn = document.querySelector('#tabs button[data-tab="' + tab + '"]');
        if (tabBtn) tabBtn.click();
      }
    });
  }

  if (moreSheet) {
    moreSheet.addEventListener('click', e => {
      const item = e.target.closest('.phone-sheet-item');
      if (!item) return;
      if (item === settingsBtn || item.id === 'phoneMoreSettingsBtn') {
        closeSheet();
        document.getElementById('openSet')?.click();
        return;
      }
      const tab = item.dataset.tab;
      if (tab) {
        closeSheet();
        const tabBtn = document.querySelector('#tabs button[data-tab="' + tab + '"]');
        if (tabBtn) tabBtn.click();
      }
    });
  }

  if (closeBtn) closeBtn.onclick = closeSheet;
  if (backdrop) backdrop.onclick = closeSheet;

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && moreSheet && moreSheet.classList.contains('open')) {
      closeSheet();
    }
  });

  const activeBtn = document.querySelector('#tabs button.on');
  if (activeBtn && activeBtn.dataset.tab) {
    updatePhoneNav(activeBtn.dataset.tab);
  }
}
initPhoneNavigation();
if (typeof window !== 'undefined') {
  window.updatePhoneNav = updatePhoneNav;
  window.initPhoneNavigation = initPhoneNavigation;
}
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
if($('engine'))$('engine').onchange=()=>{store.set('engine',$('engine').value);updateSubEngineNotice();if(typeof ENG!=='undefined'&&typeof ENG.updateEnginePickers==='function')ENG.updateEnginePickers();};
if($('tMode'))$('tMode').onchange=()=>{store.set('tMode',$('tMode').value);if(typeof updateDocEngineInfo==='function')updateDocEngineInfo();};
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
  if(typeof offStatus === 'function') offStatus();
  updateStatusPill();
  updateStorageCard();
  checkFileProtoNotice();
  fillEngines();if($('tMode'))$('tMode').value=getDefaultTransMode();$('tone').value=store.get('tone','');voiceLabels();renderGloss();renderVoice();fillAskLangs();
  document.querySelectorAll('select#vSilenceWait').forEach(el=>{el.value=String(cfg.silenceWait||800)});
  if($('vLiveVoiceSpeed'))$('vLiveVoiceSpeed').value=store.get('liveVoiceSpeed','fast');
  if($('subStyle'))$('subStyle').value=store.get('subStyle','film');
  if($('subFamily'))$('subFamily').checked=store.get('subFamily',false);
  if(typeof mountTextEnginePicker==='function')mountTextEnginePicker();
  if(typeof mountDocEnginePicker==='function')mountDocEnginePicker();
  updateSubEngineNotice();
  if(typeof updateDocEngineNoticeFromPicker==='function')updateDocEngineNoticeFromPicker();
  if(typeof ENG!=='undefined'&&typeof ENG.updateEnginePickers==='function')ENG.updateEnginePickers();
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
