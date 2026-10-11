/* ---------- OLLAMA MODEL MANAGER ---------- */
function getOllamaHost(){
  const base=(cfg.eng?.ollama?.base||'http://localhost:11434').trim();
  return base.replace(/\/+$/,'').replace(/\/v1$/,'');
}
function getOllamaOrigin(){
  return (typeof location!=='undefined'&&location.origin&&location.origin!=='null')?location.origin:'http://localhost:8080';
}
function getOllamaUnreachableMsg(){
  const origin=getOllamaOrigin();
  return L('ollamaUnreachableMsg').replace('{origin}',origin);
}
async function fetchOllamaModels(){
  const host=getOllamaHost();
  try{
    const ctrl=new AbortController();
    const to=setTimeout(()=>ctrl.abort(),2500);
    const res=await fetch(host+'/api/tags',{signal:ctrl.signal});
    clearTimeout(to);
    if(res.ok){
      const data=await res.json();
      return (data.models||[]).map(m=>m.name||m.model).filter(Boolean);
    }
  }catch(err){}
  try{
    const v1base=(cfg.eng?.ollama?.base||'http://localhost:11434/v1').replace(/\/+$/,'');
    const ctrl=new AbortController();
    const to=setTimeout(()=>ctrl.abort(),2500);
    const v1res=await fetch(v1base+'/models',{signal:ctrl.signal});
    clearTimeout(to);
    if(v1res.ok){
      const data=await v1res.json();
      return (data.data||[]).map(m=>m.id).filter(Boolean);
    }
  }catch(err){}
  throw new Error('Ollama unreachable');
}
let ollamaPullAbort=null;
async function pullOllamaModel(name){
  if(!name)return;
  name=name.trim();
  if(!name)return;
  if(ollamaPullAbort){
    ollamaPullAbort.abort();
    ollamaPullAbort=null;
  }
  ollamaPullAbort=new AbortController();
  const box=$('ollamaPullProgress');
  const fill=$('ollamaPullProgressFill');
  const st=$('ollamaPullStatusText');
  const errBox=$('ollamaPullError');
  const cancelBtn=$('ollamaPullCancel');
  if(box)box.hidden=false;
  if(fill)fill.style.width='0%';
  if(st)st.textContent=`${L('ollamaPulling')} ${name}…`;
  if(errBox){errBox.hidden=true;errBox.textContent='';}
  if(cancelBtn)cancelBtn.disabled=false;

  try{
    const host=getOllamaHost();
    const res=await fetch(host+'/api/pull',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name,stream:true}),
      signal:ollamaPullAbort.signal
    });
    if(!res.ok){
      const errTxt=await res.text().catch(()=>'');
      let msg=`HTTP ${res.status}`;
      try{
        const j=JSON.parse(errTxt);
        if(j.error)msg=j.error;
      }catch{}
      throw new Error(msg);
    }
    const handleLine=(line)=>{
      if(!line.trim())return;
      try{
        const d=JSON.parse(line);
        if(d.error)throw new Error(d.error);
        if(d.total&&d.completed){
          const pct=Math.min(100,Math.round((d.completed/d.total)*100));
          if(fill)fill.style.width=`${pct}%`;
          if(st)st.textContent=`${d.status||L('ollamaPulling')} (${pct}%)`;
        }else if(d.status){
          if(st)st.textContent=d.status;
        }
      }catch(e){
        if(e.message&&!e.message.includes('JSON'))throw e;
      }
    };

    if(res.body&&typeof res.body.getReader==='function'){
      const reader=res.body.getReader();
      const decoder=new TextDecoder();
      let buf='';
      while(true){
        const {done,value}=await reader.read();
        if(done)break;
        buf+=decoder.decode(value,{stream:true});
        const lines=buf.split('\n');
        buf=lines.pop()||'';
        for(const line of lines)handleLine(line);
      }
      if(buf)handleLine(buf);
    }else{
      const txt=await res.text();
      for(const line of txt.split('\n'))handleLine(line);
    }

    if(fill)fill.style.width='100%';
    if(st)st.textContent=L('ollamaPullDone');
    toast(`${name} ${L('dlDone')||'ready'}`,'ok');
    cfg.eng.ollama.model=name;
    saveCfg();
    await updateOllamaManager();
    setTimeout(()=>{if(box&&!ollamaPullAbort)box.hidden=true},1500);
  }catch(err){
    if(err.name==='AbortError'||ollamaPullAbort?.signal?.aborted){
      if(st)st.textContent=L('ollamaPullCancelled');
      toast(L('ollamaPullCancelled'),'warn');
      setTimeout(()=>{if(box)box.hidden=true},1500);
    }else{
      if(errBox){errBox.textContent=err.message;errBox.hidden=false;}
      if(st)st.textContent=L('failed');
      toast(`${ENG.ollama.name}: ${err.message}`,'err');
    }
  }finally{
    ollamaPullAbort=null;
  }
}
function renderOllamaManager(e){
  return `<div class="ollama-mgr" id="ollamaMgr" style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--border)">
    <div id="ollamaUnreachableNotice" class="hint warn" style="color:var(--warn,#d97706);margin:6px 0 10px;padding:8px;background:var(--card-bg);border:1px solid var(--border);border-radius:6px" hidden>
      <div style="font-weight:600;margin-bottom:4px">${esc(L('ollamaUnreachableTitle'))}</div>
      <div id="ollamaUnreachableMsgText">${esc(getOllamaUnreachableMsg())}</div>
    </div>
    <div class="row" style="gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
      <label for="ollamaModelSel" style="font-weight:600;font-size:13px">${esc(L('ollamaInstalled'))}:</label>
      <select id="ollamaModelSel" style="flex:1;min-width:180px">
        <option value="">${esc(e.model||L('ollamaChooseModel'))}</option>
      </select>
    </div>
    <div class="ollama-rec-wrap" style="margin:8px 0">
      <div style="font-size:12px;color:var(--muted);margin-bottom:4px">${esc(L('ollamaRecommended'))}:</div>
      <div class="row" style="gap:6px;flex-wrap:wrap">
        <div class="ollama-rec-item" style="display:inline-flex;align-items:center;gap:6px;background:var(--card-bg);border:1px solid var(--border);padding:3px 8px;border-radius:4px;font-size:12px">
          <code>translategemma:4b</code>
          <button class="btn ghost" type="button" data-pull="translategemma:4b" style="padding:2px 8px;font-size:11px">${esc(L('download'))}</button>
        </div>
        <div class="ollama-rec-item" style="display:inline-flex;align-items:center;gap:6px;background:var(--card-bg);border:1px solid var(--border);padding:3px 8px;border-radius:4px;font-size:12px">
          <code>translategemma:12b</code>
          <button class="btn ghost" type="button" data-pull="translategemma:12b" style="padding:2px 8px;font-size:11px">${esc(L('download'))}</button>
        </div>
        <div class="ollama-rec-item" style="display:inline-flex;align-items:center;gap:6px;background:var(--card-bg);border:1px solid var(--border);padding:3px 8px;border-radius:4px;font-size:12px">
          <code>qwen3:8b</code>
          <button class="btn ghost" type="button" data-pull="qwen3:8b" style="padding:2px 8px;font-size:11px">${esc(L('download'))}</button>
        </div>
      </div>
    </div>
    <div class="row" style="gap:8px;margin-top:8px;align-items:center">
      <input type="text" id="ollamaCustomModel" placeholder="${esc(L('ollamaCustomPh'))}" style="flex:1;min-width:160px;font-size:12px" spellcheck="false">
      <button class="btn" id="ollamaCustomPullBtn" type="button" style="font-size:12px">${esc(L('download'))}</button>
    </div>
    <div id="ollamaPullProgress" style="margin-top:10px;padding:8px;background:var(--card-bg);border:1px solid var(--border);border-radius:6px" hidden>
      <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:6px">
        <span id="ollamaPullStatusText" style="font-size:12px;font-weight:600"></span>
        <button class="btn danger" id="ollamaPullCancel" type="button" style="padding:2px 8px;font-size:11px">${esc(L('ollamaPullCancel'))}</button>
      </div>
      <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden">
        <div id="ollamaPullProgressFill" style="height:100%;width:0%;background:var(--accent);transition:width 0.2s"></div>
      </div>
      <div id="ollamaPullError" style="color:var(--err);margin-top:6px;font-size:12px" hidden></div>
    </div>
    <p class="hint" id="ollamaAsrNotice" style="margin:8px 0 0;font-size:11.5px;color:var(--muted)">${esc(L('ollamaAsrNotice'))}</p>
  </div>`;
}
async function updateOllamaManager(){
  const mgr=$('ollamaMgr');
  if(!mgr)return;
  const sel=$('ollamaModelSel');
  const notice=$('ollamaUnreachableNotice');
  try{
    const models=await fetchOllamaModels();
    if(notice)notice.hidden=true;
    if(sel){
      const current=cfg.eng?.ollama?.model||'';
      let opts=`<option value="">— ${esc(L('ollamaChooseModel'))} —</option>`;
      models.forEach(m=>{
        const isSel=(m===current)?' selected':'';
        opts+=`<option value="${esc(m)}"${isSel}>${esc(m)}</option>`;
      });
      if(current&&!models.includes(current)){
        opts+=`<option value="${esc(current)}" selected>${esc(current)}</option>`;
      }
      sel.innerHTML=opts;
    }
  }catch(err){
    if(notice){
      notice.hidden=false;
      const msgEl=$('ollamaUnreachableMsgText')||notice.querySelector('div:last-child');
      if(msgEl)msgEl.textContent=getOllamaUnreachableMsg();
    }
    if(sel){
      sel.innerHTML=`<option value="" disabled selected>${esc(L('ollamaUnreachableTitle'))}</option>`;
    }
  }
}

/* ---------- SETTINGS ---------- */
function renderEngines(){
  $('engList').innerHTML=cfg.order.map((id,i)=>{const d=ENG[id],e=cfg.eng[id],w=why(id);
    const conn=engineConnStatus[id];
    let connHtml='';
    if(conn){
      const cls=conn.code==='works'?'ok':((conn.code==='needsKey'||conn.code==='needsUrl'||conn.code==='needsDl')?'warn':'err');
      connHtml=`<span class="eng-status ${cls}" title="${esc(conn.text)}">${esc(conn.text)}</span>`;
    }
    return `<div class="eng ${e.on?'':'off'}" data-id="${id}"><div class="eng-h"><span class="dot ${usable(id)?'ok':''}"></span><strong>${esc(d.name)}</strong>${connHtml}<span class="tier ${d.tier}">${esc(L(d.tier))}</span>${w?`<span class="meta">${esc(w)}</span>`:''}<span class="sp"></span>
      ${d.url?`<a href="${d.url}" target="_blank" rel="noopener">${esc(L(d.key?'getKey':'install'))} ↗</a>`:''}
      <button class="btn ghost" data-a="up" ${i?'':'disabled'} aria-label="Move up">↑</button><button class="btn ghost" data-a="down" ${i<cfg.order.length-1?'':'disabled'} aria-label="Move down">↓</button>
      <label class="chk"><input type="checkbox" data-f="on" ${e.on?'checked':''}>On</label></div>
      ${d.ai?`<div class="eng-b">${id==='custom'||id==='ollama'?`<input type="text" data-f="base" value="${esc(e.base)}" placeholder="${esc(L('baseUrl'))}" style="grid-column:1/-1" spellcheck="false">`:''}
        ${id==='ollama'?'':`<input type="password" data-f="key" value="${esc(e.key)}" placeholder="${esc(L('key'))}" autocomplete="off" spellcheck="false">`}
        ${id==='groq'&&e.key&&!e.key.startsWith('gsk_')?`<div class="warn-groq" style="color:var(--warn);font-size:12px;margin-top:6px;grid-column:1/-1">${esc(L('groqKeyWarn'))}</div>`:''}
        <input type="text" data-f="model" value="${esc(e.model)}" placeholder="${esc(L('model'))}" list="models">
        <button class="btn" data-a="models">${esc(L('loadModels'))}</button><button class="btn" data-a="test">${esc(L('test'))}</button></div>`
        :`<div class="row" style="margin-top:8px"><span class="sp"></span><button class="btn" data-a="test">${esc(L('test'))}</button></div>`}
      ${id==='ollama'?renderOllamaManager(e):''}
      ${d.hint?`<p class="hint" style="margin:8px 0 0">${esc(L(d.hint).replace('{origin}',getOllamaOrigin()))}</p>`:''}</div>`}).join('');
  renderVoice();
  $('mmEmail').value=cfg.mmEmail||'';
  updateOllamaManager();
}
$('engList').addEventListener('input',e=>{
  if(e.target.id==='ollamaCustomModel')return;
  const f=e.target.dataset.f;if(!f||e.target.type==='checkbox')return;
  const engEl=e.target.closest('.eng');const id=engEl?.dataset.id;if(!id||!cfg.eng[id])return;
  cfg.eng[id][f]=e.target.value.trim();saveCfg();
  if(id==='ollama'&&f==='model'){const sel=$('ollamaModelSel');if(sel&&[...sel.options].some(o=>o.value===e.target.value.trim()))sel.value=e.target.value.trim()}
  if(id==='groq'&&f==='key'){
    let w=engEl.querySelector('.warn-groq');
    const invalid=cfg.eng.groq.key&&!cfg.eng.groq.key.startsWith('gsk_');
    if(invalid&&!w){w=document.createElement('div');w.className='warn-groq';w.style.cssText='color:var(--warn);font-size:12px;margin-top:6px;grid-column:1/-1';w.textContent=L('groqKeyWarn');engEl.querySelector('.eng-b').append(w)}
    else if(!invalid&&w){w.remove()}
  }
});
$('engList').addEventListener('change',e=>{
  if(e.target.id==='ollamaModelSel'){
    const chosen=e.target.value;
    if(chosen){
      cfg.eng.ollama.model=chosen;
      saveCfg();
      const inp=document.querySelector('#engList .eng[data-id="ollama"] input[data-f="model"]');
      if(inp)inp.value=chosen;
      fillEngines();
      if(!store.get('tMode')&&$('tMode'))$('tMode').value=getDefaultTransMode();
      renderEngines();
      toast(`${ENG.ollama.name}: ${chosen}`,'ok');
    }
    return;
  }
  const f=e.target.dataset.f;if(!f)return;const id=e.target.closest('.eng').dataset.id;
  cfg.eng[id][f]=e.target.type==='checkbox'?e.target.checked:e.target.value.trim();saveCfg();fillEngines();if(!store.get('tMode')&&$('tMode'))$('tMode').value=getDefaultTransMode();renderEngines()});
$('engList').addEventListener('keydown',e=>{
  if(e.key==='Enter'&&e.target.id==='ollamaCustomModel'){
    e.preventDefault();
    const m=e.target.value?.trim();
    if(m)pullOllamaModel(m);
  }
});
$('engList').addEventListener('click',async e=>{
  const pullTarget=e.target.closest('[data-pull]');
  if(pullTarget){
    pullOllamaModel(pullTarget.dataset.pull);
    return;
  }
  if(e.target.id==='ollamaCustomPullBtn'||e.target.closest('#ollamaCustomPullBtn')){
    const m=$('ollamaCustomModel')?.value?.trim();
    if(m)pullOllamaModel(m);
    return;
  }
  if(e.target.id==='ollamaPullCancel'||e.target.closest('#ollamaPullCancel')){
    if(ollamaPullAbort){ollamaPullAbort.abort();ollamaPullAbort=null;}
    return;
  }
  const a=e.target.dataset.a;if(!a)return;const id=e.target.closest('.eng').dataset.id,i=cfg.order.indexOf(id);
  if(a==='up'||a==='down'){const j=a==='up'?i-1:i+1;[cfg.order[i],cfg.order[j]]=[cfg.order[j],cfg.order[i]];saveCfg();renderEngines();fillEngines();return}
  e.target.disabled=true;
  try{
    if(a==='test'){if(why(id))throw new Error(why(id));const tg=$('tgt').value==='en'?'fa':$('tgt').value;const r=await translateItems(['Good morning, how are you?'],{src:'en',tgt:tg,engine:id,tone:''});sessionBlocked.delete(id);toast(`${ENG[id].name} ${L('works')}: ${r.out[0]}`,'ok',6000)}
    if(a==='models'){const m=await listModels(id);$('models').innerHTML=m.map(x=>`<option value="${esc(x)}">`).join('');toast(`${m.length} ${L('model')}`,'ok');e.target.closest('.eng').querySelector('[data-f=model]').focus()}
  }catch(err){toast(`${ENG[id].name}: ${err.message}`,'err',7000)}
  e.target.disabled=false;
});
$('btnCheckConn').onclick=runCheckConnections;
$('btnExportForExt').onclick=()=>{
  saveAllInputs();
  const exportData={
    app:'MAKAN Translate',
    version:'1.0.0',
    exportedAt:new Date().toISOString(),
    cfg,
    order:cfg.order,
    eng:cfg.eng,
    src:$('src').value,
    tgt:$('tgt').value,
    tone:$('tone').value,
    glossary
  };
  const blob=new Blob([JSON.stringify(exportData,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download='makan-settings.json';
  a.click();
  URL.revokeObjectURL(url);
  toast(L('settingsExported')||'Settings exported for Extension!','ok');
};
$('mmEmail').onchange=()=>{cfg.mmEmail=$('mmEmail').value.trim();saveCfg()};
const saveAllInputs=()=>{
  document.querySelectorAll('#engList .eng').forEach(el=>{
    const id=el.dataset.id;if(!id||!cfg.eng[id])return;
    el.querySelectorAll('input').forEach(inp=>{
      const f=inp.dataset.f;if(!f)return;
      cfg.eng[id][f]=inp.type==='checkbox'?inp.checked:inp.value.trim();
      if(f==='key'&&inp.value.trim()) sessionBlocked.delete(id);
    });
  });
  const ovSilence = document.querySelector('#ov select#vSilenceWait');
  if(ovSilence) cfg.silenceWait = +ovSilence.value || cfg.silenceWait || 800;
  if($('sttSel')) cfg.stt = $('sttSel').value;
  if($('vSttChoice')) cfg.stt = $('vSttChoice').value;
  if($('vAudioInput')) cfg.audioInput = $('vAudioInput').value;
  if($('vAudioInputSetting')) cfg.audioInput = $('vAudioInputSetting').value;
  if($('ttsMode')) cfg.tts.mode = $('ttsMode').value;
  if($('setTmToggle')) cfg.tm = $('setTmToggle').checked;
  else if($('tmToggle')) cfg.tm = $('tmToggle').checked;
  if(cfg.tts.mode==='gemini'&&cfg.tts.key&&!cfg.eng.gemini.key) cfg.eng.gemini.key=cfg.tts.key;
  if(cfg.eng.gemini.key&&!cfg.tts.key&&cfg.tts.mode==='gemini') cfg.tts.key=cfg.eng.gemini.key;
  if(cfg.eng.gemini.key) sessionBlocked.delete('gemini');
  if(cfg.eng.groq.key) sessionBlocked.delete('groq');
  saveCfg();
  fillEngines();
  if(!store.get('tMode')&&$('tMode'))$('tMode').value=getDefaultTransMode();
  fillVoiceTransEngines();
  voiceLabels();
};
let tmPersistAsked=false;
async function checkStoragePersist(){
  if(typeof navigator==='undefined'||!navigator.storage?.persist)return;
  if(tmPersistAsked)return;
  tmPersistAsked=true;
  try{
    let agreed=false;
    if(navigator.storage.persisted){
      agreed=await navigator.storage.persisted();
    }
    if(!agreed&&navigator.storage.persist){
      agreed=await navigator.storage.persist();
    }
    const el=$('tmPersistStatus');
    if(el){
      el.hidden=false;
      el.textContent=agreed?(L('tmPersistent')||'Persistent'):(L('tmStandard')||'Standard');
      el.title=agreed?'Persistent storage: granted':'Persistent storage: standard (best effort)';
    }
  }catch(_){}
}
async function updateTmCount(){
  if(typeof TranslationMemory!=='undefined'&&$('tmCount')){
    try{
      const c=await TranslationMemory.count();
      $('tmCount').textContent=String(c||0);
      if($('tmSize')&&typeof TranslationMemory.estimateSize==='function'){
        const b=await TranslationMemory.estimateSize();
        const szStr=b<1024?`${b} B`:b<1048576?`${(b/1024).toFixed(1)} KB`:`${(b/1048576).toFixed(1)} MB`;
        $('tmSize').textContent=`(~${szStr} ${L('tmEstimate')||'estimate'})`;
      }
      checkStoragePersist();
    }catch(_){
      $('tmCount').textContent='0';
    }
  }
}
function syncTmToggles(){
  const isChecked=(cfg.tm!==false);
  if($('tmToggle'))$('tmToggle').checked=isChecked;
  if($('setTmToggle'))$('setTmToggle').checked=isChecked;
}
if($('tmToggle')){
  $('tmToggle').checked=(cfg.tm!==false);
  $('tmToggle').onchange=()=>{
    cfg.tm=$('tmToggle').checked;
    if($('setTmToggle'))$('setTmToggle').checked=cfg.tm;
    saveCfg();
  };
}
if($('setTmToggle')){
  $('setTmToggle').checked=(cfg.tm!==false);
  $('setTmToggle').onchange=()=>{
    cfg.tm=$('setTmToggle').checked;
    if($('tmToggle'))$('tmToggle').checked=cfg.tm;
    saveCfg();
  };
}
let tmClearTimer=null;
const tmClearReset=()=>{
  clearTimeout(tmClearTimer);
  tmClearTimer=null;
  if($('tmClearBtn')){
    $('tmClearBtn').textContent=L('tmClear');
    $('tmClearBtn').classList.remove('confirming');
  }
};
if($('tmClearBtn'))$('tmClearBtn').onclick=async()=>{
  if(!tmClearTimer){
    $('tmClearBtn').textContent=L('tmClearSure');
    $('tmClearBtn').classList.add('confirming');
    tmClearTimer=setTimeout(tmClearReset,5000);
    return;
  }
  clearTimeout(tmClearTimer);
  tmClearTimer=null;
  if(typeof TranslationMemory!=='undefined'){
    await TranslationMemory.clear();
  }
  if($('tmCount'))$('tmCount').textContent='0';
  if($('tmSize'))$('tmSize').textContent=`(~0 B ${L('tmEstimate')||'estimate'})`;
  if($('tmClearBtn')){
    $('tmClearBtn').textContent=L('tmClear');
    $('tmClearBtn').classList.remove('confirming');
  }
  toast(L('tmCleared'),'ok');
};
$('openSet').onclick=()=>{
  renderEngines();
  let ok=0,total=cfg.order.length;
  cfg.order.forEach(id=>{if(engineConnStatus[id]?.code==='works')ok++});
  if(Object.keys(engineConnStatus).length&&$('checkConnSummary'))$('checkConnSummary').textContent=`${ok}/${total} ${L('connWorks')}`;
  syncTmToggles();
  updateTmCount();
  $('ov').classList.add('on');
};
$('closeSet').onclick=()=>{saveAllInputs();$('ov').classList.remove('on')};
$('btnSaveDone').onclick=()=>{saveAllInputs();$('ov').classList.remove('on');toast('Settings saved','ok')};
document.querySelectorAll('.set-tab-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.set-tab-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const sec=$(btn.dataset.sec);
    if(sec)sec.scrollIntoView({behavior:'smooth',block:'start'});
  });
});
