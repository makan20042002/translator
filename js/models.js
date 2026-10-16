/* ---------- offline model catalogue (Engines & keys → Offline) ---------- */
const MC=self.MODEL_CATALOG||{models:[],codes:{}};
const MC_CACHE='transformers-cache';       // the cache the model library writes to
const mcDownloading={};                    // model id -> files being downloaded
let mcCache=null;                          // repo -> {bytes,files} once the cache was read; null before that or without Cache Storage
const trCodes=kind=>kind==='nllb'?NLLB:MC.codes?.[kind];
const mcSize=b=>b<=0?'0 MB':b>=1073741824?(b/1073741824).toFixed(1)+' GB':Math.max(1,Math.round(b/1048576))+' MB';
const mcText=(o)=>o&&typeof o==='object'?(o[ui]||o.en||''):(o||'');
// Flags older versions of the app wrote when a download finished.
function mcLegacy(m){
  if(m.id==='tr-nllb-600')return !!store.get('nllb',false);
  if(m.kind==='whisper'&&(m.key==='base'||m.key==='small'))return store.get('whisper_wasm','')===m.key||store.get('whisper_webgpu','')===m.key;
  return false;
}
const mcDone=()=>store.get('mdl',{});
async function mcScan(){
  if(!('caches' in self)){mcCache=null;return null}
  const out={};
  try{
    const c=await caches.open(MC_CACHE);
    for(const req of await c.keys()){
      const k=req.url.match(/^https:\/\/huggingface\.co\/([^/]+\/[^/]+)\/resolve\/[^/]+\/([^?]+)/);if(!k)continue;
      const res=await c.match(req),m=MC.models.find(x=>x.repo===k[1]);
      let n=+(res?.headers.get('content-length')||0);
      if(!n&&m)n=(m.files.find(f=>f[0]===k[2])||[0,0])[1];
      const r=out[k[1]]||(out[k[1]]={bytes:0,files:new Map()});r.bytes+=n;r.files.set(k[2],n);
    }
    mcCache=out;
  }catch{mcCache=null}
  return mcCache;
}
// A model is ready when its download finished and its files are still in this browser's storage.
function mcReady(m){
  if(!m)return false;
  const rec=mcDone()[m.id];
  if(m.job==='ocr'){
    return !!rec;
  }
  if(m.kind==='piper'){                    // judged by the files in storage alone
    if(mcCache===null)return !!rec;
    const r=mcCache[m.repo];return !!r&&m.files.every(f=>r.files.has(f[0]));
  }
  if(!rec&&!mcLegacy(m))return false;
  if(mcCache===null)return true;           // storage could not be read: trust the saved flag
  const r=mcCache[m.repo];
  return !!r&&(!rec||rec.files.every(f=>r.files.has(f)));
}
// What this model takes up in browser storage (a voice shares its repository with other voices, so only its own files count).
const mcBytes=m=>{const r=mcCache?.[m.repo];if(!r)return 0;return m.kind==='piper'?m.files.reduce((a,f)=>a+(r.files.get(f[0])||0),0):r.bytes};
const trModels=()=>MC.models.filter(m=>m.job==='translate');
const trAnyReady=()=>trModels().some(mcReady);
const asrModel=key=>{
  const k=key||cfg.whisper;
  if(!k||k==='auto')return MC.models.find(m=>m.kind==='whisper'&&mcReady(m))||MC.models.find(m=>m.kind==='whisper'&&m.key==='base');
  return MC.models.find(m=>m.kind==='whisper'&&m.key===k)||MC.models.find(m=>m.kind==='whisper'&&m.key==='base');
};
const asrReady=()=>mcReady(asrModel());
function trCovers(m,src,tgt){
  if(m.kind==='opus')return m.pair[0]===src&&m.pair[1]===tgt;
  const c=trCodes(m.kind);return !!(c&&c[src]&&c[tgt]);
}
// Which downloaded model translates this pair: the user's multilingual choice, unless they asked for the small pair models.
function pickTr(src,tgt){
  const ok=trModels().filter(m=>mcReady(m)&&trCovers(m,src,tgt));
  if(!ok.length)return null;
  const pair=ok.find(m=>m.kind==='opus');
  if(cfg.trPair&&pair)return pair;
  if(cfg.trModel&&cfg.trModel!=='auto'){
    const chosen=ok.find(m=>m.id===cfg.trModel);
    if(chosen)return chosen;
  }
  return ok.find(m=>m.kind!=='opus')||pair;
}
function mcMark(m,files){
  const d=mcDone();d[m.id]={at:Date.now(),files};store.set('mdl',d);
  // keep the older flags in step, so an older copy of the app still sees these two
  if(m.id==='tr-nllb-600')store.set('nllb',true);
  if(m.kind==='whisper'&&(m.key==='base'||m.key==='small')){store.set('whisper_'+(hasWebGpu&&m.gpu?'webgpu':'wasm'),m.key);store.set('whisper',m.key)}
}
function mcUnmark(m){
  const d=mcDone();delete d[m.id];store.set('mdl',d);
  if(m.id==='tr-nllb-600')store.set('nllb',false);
  if(m.kind==='whisper'){for(const k of ['whisper_wasm','whisper_webgpu','whisper'])if(store.get(k,'')===m.key)store.set(k,'')}
}
const mcFailed={};
function mcLicence(m){
  if(m.kind==='nllb')return 'CC BY-NC 4.0';
  if(m.kind==='whisper')return 'MIT / Apache 2.0';
  if(m.kind==='piper'){
    const licMap={
      'fa_IR-amir-medium':'CC0 / Public domain',
      'fa_IR-ganji-medium':'CC0 / Public domain',
      'en_GB-alba-medium':'CC BY 4.0 (Univ of Edinburgh)',
      'en_US-cori-medium':'CC0 / Public domain',
      'en_US-kristin-medium':'CC0 / Public domain',
      'en_US-ljspeech-medium':'CC0 / Public domain'
    };
    return licMap[m.id]||'CC0 / Public domain';
  }
  if(m.kind==='opus')return 'CC BY 4.0 (OPUS)';
  if(m.kind==='rapidocr')return 'Apache 2.0 (PaddleOCR)';
  return 'Open Source';
}
async function mcDownload(m){
  if(mcDownloading[m.id])return;
  delete mcFailed[m.id];
  const ab=new AbortController();
  mcDownloading[m.id]={files:{},abort:ab};
  try{await navigator.storage?.persist?.()}catch{}
  await checkWebGpu();mcRender();
  try{
    if(m.kind==='piper'){
      await piperEngineFiles(m);           // the speech engine ships with the app; fetching it now lets the app keep a copy for offline use
      await prpc('load',{voice:{path:m.voice}},{progress:p=>mcFileProgress(m,p.file,p.loaded,p.total)});
    }
    else if(m.job==='ocr'){
      const base=`https://huggingface.co/${m.repo}/resolve/main/`;
      const filesPayload={};
      let cache=null;
      try{cache=await caches.open(MC_CACHE)}catch{}
      for(const [fname,fsize] of m.files){
        if(ab.signal.aborted)throw new DOMException('Aborted','AbortError');
        const fileUrl=base+fname;
        try{
          const resp=await fetch(fileUrl,{signal:ab.signal});
          if(resp.ok){
            const blob=await resp.blob();
            const buf=await blob.arrayBuffer();
            if(cache){
              await cache.put(fileUrl,new Response(buf,{headers:{'content-length':String(buf.byteLength)}}));
            }
            filesPayload[fname]=Array.from(new Uint8Array(buf));
          }
        }catch(fetchErr){
          if(fetchErr.name==='AbortError')throw fetchErr;
        }
        mcFileProgress(m,fname,fsize,fsize);
      }
      if(window.makanDesktop?.saveOcrModelFiles&&Object.keys(filesPayload).length>0){
        await window.makanDesktop.saveOcrModelFiles({modelId:m.id,files:filesPayload});
      }
    }
    else if(m.job==='translate'){
      await rpc('loadTr',{spec:{repo:m.repo,kind:m.kind}});
      try{await rpc('unload',{repo:m.repo})}catch{}
    }else{
      await rpc('loadAsr',{model:m.key});
      try{await rpc('unload',{repo:m.repo})}catch{}
    }
    const seen=Object.keys(mcDownloading[m.id].files).filter(f=>f.endsWith('.onnx')||f.endsWith('.onnx_data')||f.endsWith('.txt'));
    await mcScan();
    mcMark(m,(mcCache?.[m.repo]?[...mcCache[m.repo].files.keys()].filter(f=>f.endsWith('.onnx')||f.endsWith('.onnx_data')||f.endsWith('.txt')):seen));
    // the first model of a kind becomes the one in use
    if(m.job==='listen'&&cfg.whisper!=='auto'&&!asrReady())cfg.whisper=m.key;
    if(m.job==='translate'&&m.kind!=='opus'&&cfg.trModel!=='auto'&&!mcReady(MC.models.find(x=>x.id===cfg.trModel)))cfg.trModel=m.id;
    saveCfg();
    delete mcFailed[m.id];
    toast(L('dlDone'),'ok',6000);
  }catch(e){
    if(e.name==='AbortError'){
      toast(`${mcText(m.name)}: ${L('dlCancelled')||'Download cancelled'}`,'warn');
    }else{
      mcFailed[m.id]=e.message;
      toast(e.message,'err',9000);
    }
  }
  delete mcDownloading[m.id];
  await mcScan();mcRender();renderEngines();fillEngines();
  if(typeof updateStatusPill==='function')updateStatusPill();
  if(typeof updateStorageCard==='function')updateStorageCard();
}
function mcCancel(m){
  if(mcDownloading[m.id]){
    try{mcDownloading[m.id].abort?.abort()}catch{}
    delete mcDownloading[m.id];
    mcRender();
  }
}
async function mcDelete(m){
  try{if(m.kind==='piper'){if(pwk)await prpc('unload',{voice:{path:m.voice}})}else if(m.repo)await rpc('unload',{repo:m.repo})}catch{}
  try{
    const c=await caches.open(MC_CACHE);
    for(const req of await c.keys())if(m.kind==='piper'?m.files.some(f=>req.url.endsWith('/'+f[0])):req.url.includes('/'+m.repo+'/resolve/'))await c.delete(req);
  }catch{}
  inWorker.delete(m.repo);mcUnmark(m);
  await mcScan();mcRender();renderEngines();fillEngines();
  if(typeof updateStatusPill==='function')updateStatusPill();
  if(typeof updateStorageCard==='function')updateStorageCard();
  toast(`${mcText(m.name)}: ${L('mdlDeleted')}`,'ok');
}
function mcRow(m){
  const ready=mcReady(m),busy=!!mcDownloading[m.id];
  const inUse=ready&&(m.job==='listen'?(cfg.whisper!=='auto'&&cfg.whisper===m.key):(cfg.trModel!=='auto'&&cfg.trModel===m.id));
  const gpu=m.webgpu==='optional'?L('mdlGpuOpt'):L('mdlGpuNo');
  const langs=m.kind==='opus'?`${langShort(m.pair[0])} → ${langShort(m.pair[1])}`:mcText(m.langs);
  const gpuText=(m.job==='speak'||m.job==='ocr')?L('mdlGpuNo'):gpu;
  const badges=(m.rec?`<span class="badge rec">${esc(L('mdlRecNonEn'))}</span>`:'')+(m.weak?`<span class="badge warn">${esc(L('mdlWeak'))}</span>`:'');
  const dlId=m.id==='tr-nllb-600'?' id="dlTr"':'';
  const st=busy?L('mdlDownloading'):ready?L('ready')+(mcBytes(m)?' · '+mcSize(mcBytes(m)):''):L('notDl');
  return `<div class="mdl${inUse?' inuse':''}" data-mdl="${m.id}" data-state="${busy?'busy':ready?'ready':'none'}">
    <div class="mdl-h"><span class="dot${ready?' ok':''}"></span><strong>${esc(mcText(m.name))}</strong>${badges}<span class="sp"></span><span class="meta" id="mdlSt-${m.id}">${esc(st)}</span></div>
    <div class="mdl-m"><span title="${esc(L('mdlSizeTip'))}">${esc(L('mdlSize'))} ${mcSize(hasWebGpu&&m.gpuBytes?m.gpuBytes:m.bytes)}${m.extraBytes?` (+${mcSize(m.extraBytes)} ${esc(L('mdlEngineOnce'))})`:''}</span> · <span title="${esc(L('mdlMemTip'))}">${esc(L('mdlMem'))} ≈ ${mcSize(m.memMB*1048576)}</span> · ${esc(L('mdlGpu'))}: ${esc(gpuText)}${m.speed?` · ${esc(L('mdlSpeed'))} ${m.speed<1?m.speed.toFixed(1):Math.round(m.speed*10)/10} ${esc(L('mdlSpeedUnit'))}`:''} · ${esc(L('mdlLangs'))}: ${esc(langs)}</div>
    <div class="mdl-g">${esc(mcText(m.good))}</div>
    <div class="prog" id="mdlProg-${m.id}"${busy?'':' hidden'}><i id="mdlBar-${m.id}"></i></div>
    <div class="mdl-a">
      <button class="btn"${dlId} data-act="dl" ${ready||busy?'hidden':''}>${esc(L('download'))}</button>
      <button class="btn ghost" data-act="rm" ${ready&&!busy?'':'hidden'}>${esc(L('mdlDelete'))}</button>
      ${ready&&(m.job==='listen'||m.job==='translate')?`<label class="chk"><input type="radio" name="use-${m.job}" data-act="use" ${inUse?'checked':''}>${esc(L(inUse?'mdlInUse':'mdlUse'))}</label>`:''}
    </div></div>`;
}
function mcRender(){
  const box=$('mdlCatalog');if(!box)return;
  const by=(job,f)=>MC.models.filter(m=>m.job===job&&(!f||f(m)));
  let h='';
  const listen=by('listen');
  if(listen.length)h+=`<div class="mdl-grp">${esc(L('mdlGrpListen'))}</div>`+listen.map(mcRow).join('');
  const multi=by('translate',m=>m.kind!=='opus'),pairs=by('translate',m=>m.kind==='opus');
  if(multi.length||pairs.length){
    h+=`<div class="mdl-grp">${esc(L('mdlGrpTr'))}</div>`+multi.map(mcRow).join('');
    if(pairs.length)h+=`<div class="mdl-sub">${esc(L('mdlPairs'))}</div><label class="chk" style="margin:6px 0"><input type="checkbox" id="mdlPrefPair" ${cfg.trPair?'checked':''}>${esc(L('mdlPairsPrefer'))}</label>`+pairs.map(mcRow).join('');
  }
  const speak=by('speak');
  if(speak.length)h+=`<div class="mdl-grp">${esc(L('mdlGrpSpeak'))}</div>`+speak.map(mcRow).join('');
  const ocr=by('ocr');
  if(ocr.length)h+=`<div class="mdl-grp">${esc(L('mdlGrpOcr')||(ui==='fa'?'خوانش تصویر و صفحه (OCR)':'OCR & Screen Reading'))}</div>`+ocr.map(mcRow).join('');
  box.innerHTML=h;
  // total storage used by the models listed here
  const mine=MC.models.filter(m=>mcBytes(m)>0);
  const total=mine.reduce((a,m)=>a+mcBytes(m),0);
  const t=$('mdlTotal');
  if(t){
    t.textContent=mcCache===null?'':`${L('mdlTotal')}: ${mcSize(total)} (${mine.length})`;
    navigator.storage?.estimate?.().then(e=>{if(e&&e.usage&&$('mdlTotal')&&mcCache!==null)$('mdlTotal').textContent+=` · ${L('mdlSiteTotal')}: ${mcSize(e.usage)}`}).catch(()=>{});
  }

  // Sync Offline translation model & speech model dropdowns
  const trSel=$('offTrModelSel');
  if(trSel){
    const trDownloaded=trModels().filter(mcReady);
    const prevTr=(cfg.trModel&&(cfg.trModel==='auto'||trDownloaded.some(m=>m.id===cfg.trModel)))?cfg.trModel:'auto';
    let hTr=`<option value="auto">${esc(L('autoMdl'))}</option>`;
    for(const m of trDownloaded){
      hTr+=`<option value="${m.id}">${esc(mcText(m.name))}</option>`;
    }
    trSel.innerHTML=hTr;
    trSel.value=prevTr;
  }
  const asrSel=$('offWhisperSel');
  if(asrSel){
    const asrDownloaded=MC.models.filter(m=>m.kind==='whisper'&&mcReady(m));
    const prevWhisper=(cfg.whisper&&(cfg.whisper==='auto'||asrDownloaded.some(m=>m.key===cfg.whisper)))?cfg.whisper:'auto';
    let hAsr=`<option value="auto">${esc(L('autoMdl'))}</option>`;
    for(const m of asrDownloaded){
      hAsr+=`<option value="${m.key}">${esc(mcText(m.name))}</option>`;
    }
    asrSel.innerHTML=hAsr;
    asrSel.value=prevWhisper;
  }
  fillTestLangs();
  if(typeof renderUnifiedVoicePicker==='function')renderUnifiedVoicePicker();
  if(typeof updateSttPickerDisplay==='function')updateSttPickerDisplay();
  renderModelHub();
}
let hubActiveCat='all';
let hubDeleteConfirmId=null;
let hubDeleteConfirmTimer=null;

function renderModelHub(){
  const grid=$('modelHubCatalog');
  if(!grid)return;
  const models=MC.models||[];
  const filtered=models.filter(m=>{
    if(hubActiveCat==='all')return true;
    if(hubActiveCat==='translate')return m.job==='translate';
    if(hubActiveCat==='listen')return m.job==='listen';
    if(hubActiveCat==='speak')return m.job==='speak';
    if(hubActiveCat==='ocr')return m.job==='ocr';
    return true;
  });

  const categoryLabels={
    translate:L('catTranslate')||'Translation',
    listen:L('catSpeech')||'Speech',
    speak:L('catVoices')||'Voice',
    ocr:L('catOcr')||'OCR'
  };

  grid.innerHTML=filtered.map(m=>{
    const ready=mcReady(m);
    const busy=!!mcDownloading[m.id];
    const failed=!!mcFailed[m.id];
    const state=busy?'busy':(ready?'ready':(failed?'failed':'none'));
    const lic=mcLicence(m);
    const catLbl=categoryLabels[m.job]||m.job;

    let stateBadge='';
    if(busy)stateBadge=`<span class="hub-pill busy">⏳ ${esc(L('mdlDownloading'))}</span>`;
    else if(ready)stateBadge=`<span class="hub-pill ready">✓ ${esc(L('statusReady')||'Installed')}</span>`;
    else if(failed)stateBadge=`<span class="hub-pill failed" title="${esc(mcFailed[m.id])}">⚠ ${esc(L('failed')||'Failed')}</span>`;
    else stateBadge=`<span class="hub-pill none">${esc(L('statusNotDownloaded')||'Not downloaded')}</span>`;

    const dlSize=mcSize(hasWebGpu&&m.gpuBytes?m.gpuBytes:m.bytes);
    const realDisk=(ready&&mcBytes(m)>0)?` · Disk: ${mcSize(mcBytes(m))}`:'';
    const langs=m.kind==='opus'?`${langShort(m.pair[0])} → ${langShort(m.pair[1])}`:mcText(m.langs);
    const isConfirming=(hubDeleteConfirmId===m.id);
    const inUse=ready&&(m.job==='listen'?(cfg.whisper!=='auto'&&cfg.whisper===m.key):(cfg.trModel!=='auto'&&cfg.trModel===m.id));

    return `<div class="hub-model-card" data-hub-mdl="${esc(m.id)}" data-state="${state}">
      <div class="hub-model-head">
        <div class="hub-model-title-wrap">
          <strong class="hub-model-name"><bdi>${esc(mcText(m.name))}</bdi></strong>
          <div class="hub-model-badges">
            ${stateBadge}
            <span class="hub-pill cat">${esc(catLbl)}</span>
            <span class="hub-pill ram" title="Estimated RAM">RAM ≈ ${esc(mcSize(m.memMB*1048576))}</span>
            <span class="hub-pill lic" title="Licence">${esc(lic)}</span>
            ${m.rec?`<span class="hub-pill rec">${esc(L('mdlRecNonEn'))}</span>`:''}
            ${m.weak?`<span class="hub-pill warn">${esc(L('mdlWeak'))}</span>`:''}
          </div>
        </div>
      </div>
      <div class="hub-model-meta">
        <span>Download: ${esc(dlSize)}${realDisk}</span> · 
        <span>RAM ≈ ${esc(mcSize(m.memMB*1048576))}</span> · 
        <span>Langs: ${esc(langs)}</span>
      </div>
      <p class="hub-model-desc">${esc(mcText(m.good))}</p>
      <div class="prog hub-prog" id="hubProg-${esc(m.id)}" ${busy?'':'hidden'}><i id="hubBar-${esc(m.id)}"></i></div>
      <div class="hub-prog-meta" id="hubSt-${esc(m.id)}" ${busy?'':'hidden'}>${esc(L('mdlDownloading'))}</div>
      <div class="hub-model-actions">
        ${(!ready&&!busy)?`<button class="btn cta hub-act-btn" data-hub-act="dl" data-id="${esc(m.id)}" type="button"><span aria-hidden="true">⬇</span> ${esc(L('download'))}</button>`:''}
        ${busy?`<button class="btn danger hub-act-btn" data-hub-act="cancel" data-id="${esc(m.id)}" type="button">${esc(L('cancel')||'Cancel')}</button>`:''}
        ${(ready&&!busy)?`<button class="btn ghost danger hub-act-btn hub-btn-rm ${isConfirming?'confirming':''}" data-hub-act="rm" data-id="${esc(m.id)}" type="button">${isConfirming?esc(L('confirmDelete')||'Click again to confirm'):esc(L('mdlDelete'))}</button>`:''}
        ${(ready&&!busy&&(m.job==='listen'||m.job==='translate'))?`<button class="btn ${inUse?'ghost inuse':'cta'} hub-act-btn" data-hub-act="use" data-id="${esc(m.id)}" type="button">${esc(L(inUse?'mdlInUse':'mdlUse'))}</button>`:''}
      </div>
    </div>`;
  }).join('');

  const mine=(MC.models||[]).filter(m=>mcBytes(m)>0);
  const total=mine.reduce((a,m)=>a+mcBytes(m),0);
  const storageEl=$('hubModelsStorageUsed');
  if(storageEl){
    storageEl.textContent=`${mcSize(total)} (${mine.length} models)`;
  }
  navigator.storage?.estimate?.().then(e=>{
    if(e&&e.usage&&$('hubSiteStorageUsed')){
      $('hubSiteStorageUsed').textContent=mcSize(e.usage)+(e.quota?' / '+mcSize(e.quota):'');
    }
  }).catch(()=>{});
}

function checkHeavyModelHint(m){
  if(!m)return;
  const isHeavy=(m.memMB&&m.memMB>=3000)||m.id==='asr-large-v3-turbo'||m.key==='large-v3-turbo';
  if(isHeavy){
    const hint=L('heavyModelHint')||'This model requires several GB of free memory. A smaller model is more reliable on devices with limited RAM.';
    if(typeof toast==='function')toast(hint,'warn',7000);
  }
}
if(typeof window!=='undefined'){
  window.checkHeavyModelHint=checkHeavyModelHint;
}

$('hubFilterRow')?.addEventListener('click',e=>{
  const btn=e.target.closest('.hub-filter-btn');
  if(!btn)return;
  document.querySelectorAll('#hubFilterRow .hub-filter-btn').forEach(b=>{
    b.classList.remove('active');
    b.setAttribute('aria-selected','false');
  });
  btn.classList.add('active');
  btn.setAttribute('aria-selected','true');
  hubActiveCat=btn.dataset.cat||'all';
  renderModelHub();
});

$('modelHubCatalog')?.addEventListener('click',async e=>{
  const btn=e.target.closest('[data-hub-act]');
  if(!btn)return;
  const id=btn.dataset.id;
  const m=(MC.models||[]).find(x=>x.id===id);
  if(!m)return;
  const act=btn.dataset.hubAct;
  if(act==='dl'){
    mcDownload(m);
  }else if(act==='cancel'){
    mcCancel(m);
  }else if(act==='use'){
    if(m.job==='listen')cfg.whisper=m.key;else cfg.trModel=m.id;
    checkHeavyModelHint(m);
    saveCfg();mcRender();fillEngines();
    if(typeof updateVoiceAutoEngineDisplay==='function')updateVoiceAutoEngineDisplay();
    if(typeof updateSttPickerDisplay==='function')updateSttPickerDisplay();
  }else if(act==='rm'){
    if(hubDeleteConfirmId!==m.id){
      hubDeleteConfirmId=m.id;
      btn.textContent=L('confirmDelete')||'Click again to confirm';
      btn.classList.add('confirming');
      clearTimeout(hubDeleteConfirmTimer);
      hubDeleteConfirmTimer=setTimeout(()=>{
        hubDeleteConfirmId=null;
        renderModelHub();
      },4000);
      return;
    }
    clearTimeout(hubDeleteConfirmTimer);
    hubDeleteConfirmId=null;
    await mcDelete(m);
  }
});
$('mdlCatalog').addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');if(!b)return;
  const m=MC.models.find(x=>x.id===b.closest('[data-mdl]')?.dataset.mdl);if(!m)return;
  if(b.dataset.act==='dl')mcDownload(m);
  else if(b.dataset.act==='rm')mcDelete(m);
  else if(b.dataset.act==='use'){
    if(m.job==='listen')cfg.whisper=m.key;else cfg.trModel=m.id;
    checkHeavyModelHint(m);
    saveCfg();mcRender();fillEngines();
    if(typeof updateVoiceAutoEngineDisplay==='function')updateVoiceAutoEngineDisplay();
  }
});
$('mdlCatalog').addEventListener('change',e=>{if(e.target.id==='mdlPrefPair'){cfg.trPair=e.target.checked;saveCfg()}});

if($('offTrModelSel'))$('offTrModelSel').onchange=e=>{
  cfg.trModel=e.target.value;
  const m=(MC.models||[]).find(x=>x.id===cfg.trModel);
  checkHeavyModelHint(m);
  saveCfg();mcRender();fillEngines();
};
if($('offWhisperSel'))$('offWhisperSel').onchange=e=>{
  cfg.whisper=e.target.value;
  const m=(MC.models||[]).find(x=>x.kind==='whisper'&&x.key===cfg.whisper);
  checkHeavyModelHint(m);
  saveCfg();mcRender();
  if(typeof updateVoiceAutoEngineDisplay==='function')updateVoiceAutoEngineDisplay();
  if(typeof updateSttPickerDisplay==='function')updateSttPickerDisplay();
};

function fillTestLangs(){
  const s=$('testMdlSrc'),t=$('testMdlTgt');
  if(!s||!t)return;
  if(!s.options.length){
    s.innerHTML=LANGS.map(l=>`<option value="${l[0]}">${esc(l[1])}</option>`).join('');
    t.innerHTML=LANGS.map(l=>`<option value="${l[0]}">${esc(l[1])}</option>`).join('');
    s.value=$('src')?.value&&$('src').value!=='auto'?$('src').value:'en';
    t.value=$('tgt')?.value?$('tgt').value:'fa';
  }
}

let testTrAbort=null;
async function runTestTranslationModels(){
  const txt=($('testMdlText')?.value||'').trim();
  if(!txt){toast(L('phIn'),'warn');return}
  const src=$('testMdlSrc')?.value||'en';
  const tgt=$('testMdlTgt')?.value||'fa';
  const dlModels=trModels().filter(mcReady);

  let ollamaModels=[];
  try{
    ollamaModels=await fetchOllamaModels();
  }catch{}

  const allToTest=[
    ...dlModels.map(m=>({type:'offline',model:m,name:mcText(m.name)})),
    ...ollamaModels.map(m=>({type:'ollama',model:m,name:`Ollama (${m})`}))
  ];

  const resBox=$('testTrResults'),runBtn=$('testTrRun'),stopBtn=$('testTrStop'),stBox=$('testTrStatus');
  if(!allToTest.length){
    if(resBox)resBox.innerHTML=`<p class="hint">${esc(L('testNoTrModels'))}</p>`;
    return;
  }

  testTrAbort=new AbortController();
  if(runBtn)runBtn.hidden=true;
  if(stopBtn)stopBtn.hidden=false;
  if(stBox){stBox.hidden=false;stBox.textContent=L('testRunning')}

  let tableHtml=`<table class="test-results-table">
    <thead>
      <tr>
        <th>${esc(L('testColModel'))}</th>
        <th>${esc(L('testColResult'))}</th>
        <th>${esc(L('testColTime'))}</th>
      </tr>
    </thead>
    <tbody>`;
  for(let i=0;i<allToTest.length;i++){
    tableHtml+=`<tr id="testTrRow-${i}"><td class="test-row-name"><strong>${esc(allToTest[i].name)}</strong></td><td class="test-row-res" style="color:var(--muted)">…</td><td class="test-row-time">—</td></tr>`;
  }
  tableHtml+=`</tbody></table>`;
  if(resBox)resBox.innerHTML=tableHtml;

  for(let i=0;i<allToTest.length;i++){
    if(testTrAbort.signal.aborted)break;
    const item=allToTest[i];
    const rowEl=$(`testTrRow-${i}`);
    const resTd=rowEl?.querySelector('.test-row-res');
    const timeTd=rowEl?.querySelector('.test-row-time');
    if(resTd)resTd.textContent=L('waitingFor')+'…';

    const t0=performance.now();
    try{
      let outText='';
      if(item.type==='offline'){
        const m=item.model;
        if(!trCovers(m,src,tgt)){
          throw new Error('language pair not supported');
        }
        const codes=m.kind==='opus'?null:trCodes(m.kind);
        const res=await rpc('translate',{
          items:[txt],
          src:codes?.[src],
          tgt:codes?.[tgt],
          spec:{repo:m.repo,kind:m.kind}
        });
        outText=Array.isArray(res)?res[0]:res;
      }else{
        const res=await eAI('ollama',[txt],{src,tgt,model:item.model,signal:testTrAbort.signal});
        outText=Array.isArray(res)?res[0]:(res?.out?.[0]||res);
      }
      const dur=((performance.now()-t0)/1000).toFixed(2);
      if(resTd){resTd.textContent=outText;resTd.style.color=''}
      if(timeTd)timeTd.textContent=`${dur}s`;
    }catch(err){
      const dur=((performance.now()-t0)/1000).toFixed(2);
      if(resTd){resTd.textContent=`⚠️ ${err.message}`;resTd.style.color='var(--warn)'}
      if(timeTd)timeTd.textContent=`${dur}s`;
    }
  }

  if(runBtn)runBtn.hidden=false;
  if(stopBtn)stopBtn.hidden=true;
  if(stBox)stBox.textContent=testTrAbort.signal.aborted?L('testStopped'):L('testDone');
  testTrAbort=null;
}

let testAsrAbort=null;
async function runTestSpeechModels(){
  const dlWhisper=MC.models.filter(m=>m.kind==='whisper'&&mcReady(m));
  const resBox=$('testAsrResults'),runBtn=$('testAsrRun'),stopBtn=$('testAsrStop'),promptEl=$('testAsrPrompt'),stBox=$('testAsrStatus');

  if(!dlWhisper.length){
    if(resBox)resBox.innerHTML=`<p class="hint">${esc(L('testNoAsrModels'))}</p>`;
    return;
  }

  testAsrAbort=new AbortController();
  if(runBtn)runBtn.hidden=true;
  if(stopBtn)stopBtn.hidden=false;
  if(promptEl){promptEl.hidden=false;promptEl.textContent=L('testRecPrompt')}
  if(stBox){stBox.hidden=false;stBox.textContent=L('vStatusListening')}

  let blob=null;
  try{
    blob=await record(runBtn,()=>{});
  }catch(e){
    if(promptEl)promptEl.hidden=true;
    if(runBtn)runBtn.hidden=false;
    if(stopBtn)stopBtn.hidden=true;
    if(stBox)stBox.textContent=e.message;
    return;
  }
  if(promptEl)promptEl.hidden=true;

  if(testAsrAbort.signal.aborted||!blob){
    if(runBtn)runBtn.hidden=false;
    if(stopBtn)stopBtn.hidden=true;
    if(stBox)stBox.textContent=L('testStopped');
    return;
  }

  let tableHtml=`<table class="test-results-table">
    <thead>
      <tr>
        <th>${esc(L('testColModel'))}</th>
        <th>${esc(L('testColResult'))}</th>
        <th>${esc(L('testColTime'))}</th>
      </tr>
    </thead>
    <tbody>`;
  for(let i=0;i<dlWhisper.length;i++){
    tableHtml+=`<tr id="testAsrRow-${i}"><td class="test-row-name"><strong>${esc(mcText(dlWhisper[i].name))}</strong></td><td class="test-row-res" style="color:var(--muted)">…</td><td class="test-row-time">—</td></tr>`;
  }
  tableHtml+=`</tbody></table>`;
  if(resBox)resBox.innerHTML=tableHtml;
  if(stBox)stBox.textContent=L('testRunning');

  const audio=await to16k(blob);
  const src=$('src')?.value||'auto';
  const lang=(src==='auto'?null:src.split('-')[0]);

  for(let i=0;i<dlWhisper.length;i++){
    if(testAsrAbort.signal.aborted)break;
    const m=dlWhisper[i];
    const rowEl=$(`testAsrRow-${i}`);
    const resTd=rowEl?.querySelector('.test-row-res');
    const timeTd=rowEl?.querySelector('.test-row-time');
    if(resTd)resTd.textContent=L('waitingFor')+'…';

    const t0=performance.now();
    try{
      const res=await rpc('asr',{audio,lang,model:m.key,langs:[$('src').value,$('tgt').value]});
      const tx=typeof res==='object'?res.text:res;
      const dur=((performance.now()-t0)/1000).toFixed(2);
      if(resTd){resTd.textContent=(tx||'').trim()||'—';resTd.style.color=''}
      if(timeTd)timeTd.textContent=`${dur}s`;
    }catch(err){
      const dur=((performance.now()-t0)/1000).toFixed(2);
      if(resTd){resTd.textContent=`⚠️ ${err.message}`;resTd.style.color='var(--warn)'}
      if(timeTd)timeTd.textContent=`${dur}s`;
    }
  }

  if(runBtn)runBtn.hidden=false;
  if(stopBtn)stopBtn.hidden=true;
  if(stBox)stBox.textContent=testAsrAbort.signal.aborted?L('testStopped'):L('testDone');
  testAsrAbort=null;
}

if($('testTrRun'))$('testTrRun').onclick=runTestTranslationModels;
if($('testTrStop'))$('testTrStop').onclick=()=>{
  if(testTrAbort)testTrAbort.abort();
  if($('testTrStop'))$('testTrStop').hidden=true;
  if($('testTrRun'))$('testTrRun').hidden=false;
  if($('testTrStatus'))$('testTrStatus').textContent=L('testStopped');
};
if($('testAsrRun'))$('testAsrRun').onclick=runTestSpeechModels;
if($('testAsrStop'))$('testAsrStop').onclick=()=>{
  if(testAsrAbort)testAsrAbort.abort();
  if(rec)try{rec.stop()}catch{}
  if($('testAsrStop'))$('testAsrStop').hidden=true;
  if($('testAsrRun'))$('testAsrRun').hidden=false;
  if($('testAsrPrompt'))$('testAsrPrompt').hidden=true;
  if($('testAsrStatus'))$('testAsrStatus').textContent=L('testStopped');
};
