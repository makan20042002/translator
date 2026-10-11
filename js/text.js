/* ---------- Finglish (Persian in Latin letters) ---------- */
const aiChainNow=()=>cfg.order.filter(id=>ENG[id]?.ai&&usable(id));
// Converts Finglish to Persian script with one AI request. { kind: 'no' | 'needs-ai' | 'ok', persian, engine }
async function finglishStep(text,signal,src){
  src=src||$('src').value;
  if(src!=='auto'&&src!=='fa'&&src!=='finglish')return {kind:'no'};
  return prepareFinglish(text,src,cfg,{chain:aiChainNow(),signal});
}
// The "Persian spelling" line with a Copy button.
function fgBox(persian,into){
  const box=into||document.createElement('div');
  if(!into)box.className='fg-box';
  box.replaceChildren();
  const l=document.createElement('span');l.className='lbl';l.textContent=L('fgSpelling');
  const t=document.createElement('span');t.className='fg-t';t.textContent=persian;t.dir='rtl';t.lang='fa';
  const b=document.createElement('button');b.className='btn ghost';b.type='button';b.textContent=L('copy');b.onclick=()=>copy(persian);
  box.append(l,t,b);box.hidden=false;return box;
}
// For one searched word (Dictionary, Idioms): Persian spelling when it was Finglish and an AI engine can convert it; otherwise unchanged.
async function finglishWord(word){
  try{const r=await finglishStep(word,undefined,'auto');if(r.kind==='ok')return {text:r.persian,persian:r.persian}}catch{}
  return {text:word};
}

/* ---------- TEXT ---------- */
let tCtl=null;
function getQuickestNonAiEngine(){
  if(isOff()){
    if(usable('nllb'))return 'nllb';
    if(usable('chrome'))return 'chrome';
    if(usable('ollama'))return 'ollama';
    return 'nllb';
  }
  if(usable('chrome'))return 'chrome';
  if(usable('google'))return 'google';
  if(usable('mymemory'))return 'mymemory';
  if(usable('nllb'))return 'nllb';
  return 'google';
}
// Fast: try every available non-AI engine in turn (on-device Chrome first, then Google web, then MyMemory).
// A missing language pair in one engine (e.g. Chrome on-device) just moves on to the next.
function getFastChain(){
  if(isOff())return [getQuickestNonAiEngine()];
  const chain=['chrome','google','mymemory','nllb'].filter(usable);
  for(const id of ['google','mymemory'])if(!chain.includes(id)&&cfg.eng[id]&&cfg.eng[id].on!==false&&!sessionBlocked.has(id))chain.push(id);
  return chain.length?chain:['google','mymemory'];
}
function getSmartEngineChain(){
  const cur=$('engine').value;
  if(cur!=='auto'&&usable(cur))return [cur];
  const chain=cfg.order.filter(usable);
  if(chain.length)return chain;
  if(isOff())return usable('nllb')?['nllb']:usable('ollama')?['ollama']:['nllb'];
  return ['google'];
}
function getAiEngineChain(){
  const cur=$('engine').value;
  if(cur!=='auto'&&ENG[cur]?.ai&&usable(cur))return [cur];
  const aiList=cfg.order.filter(id=>ENG[id]?.ai&&usable(id));
  if(aiList.length)return aiList;
  if(isOff())return ['ollama'];
  return ['gemini'];
}
function getDefaultTransMode(){
  const saved=store.get('tMode',null);
  if(saved&&['both','fast','smart'].includes(saved))return saved;
  const hasAi=cfg.order.some(id=>ENG[id]?.ai&&usable(id));
  return hasAi?'both':'fast';
}
async function saveToMemory(params){
  try{
    if(cfg.tm===false)return;
    if(typeof TranslationMemory==='undefined'||!params)return;
    const src=String(params.text||'').trim();
    const tr=String(params.translatedText||'').trim();
    if(!src||!tr)return;
    if(params.hasError)return;
    // Never save errors, empty results, partial results, rate-limit (429/503) or timeout results
    const errRe = /^(error|failed|http\s*\d+|429|503|rate limit|quota|timeout|timed?\s*out|unavailable|resource_exhausted)/i;
    if(errRe.test(tr))return;
    if(Array.isArray(params.lines)&&Array.isArray(params.out)){
      if(params.lines.length!==params.out.length)return;
      if(params.out.some(s=>typeof s!=='string'||!s.trim()||errRe.test(s.trim())))return;
    }
    await TranslationMemory.put({
      sourceText:params.text,
      translatedText:params.translatedText,
      src:params.src,
      tgt:params.tgt,
      modeClass:params.modeClass,
      tone:params.tone,
      subject:params.subject
    });
  }catch(_){}
}
async function doText(){
  const text=$('tIn').value;if(!text.trim())return;
  tCtl=new AbortController();busy([$('tGo')],$('tStop'),true);$('tMeta').textContent='…';const t0=performance.now();
  $('tShowImproved')?.remove();
  if($('tSaveCorrection'))$('tSaveCorrection').hidden=true;
  let userInteractedWithFast=false;
  const onFastInteract=()=>{userInteractedWithFast=true};
  $('tOut').addEventListener('input',onFastInteract,{once:true});
  $('tOut').addEventListener('keydown',onFastInteract,{once:true});
  $('tOut').addEventListener('copy',onFastInteract,{once:true});
  const copyBtnClick=()=>{userInteractedWithFast=true};
  $('tCopy').addEventListener('click',copyBtnClick,{once:true});

  const mode=$('tMode')?.value||getDefaultTransMode();
  const hasAi=cfg.order.some(id=>ENG[id]?.ai&&usable(id));

  // Look up memory before calling any engine
  const memMode=(mode==='fast'||(mode==='both'&&!hasAi))?'fast':'smart';
  let memHit=null;
  if(cfg.tm!==false){
    try{
      if(typeof TranslationMemory!=='undefined'){
        memHit=await TranslationMemory.get({
          text,
          src:$('src').value==='finglish'?'auto':$('src').value,
          tgt:$('tgt').value,
          modeClass:memMode,
          tone:$('tone')?.value||'',
          subject:$('tSubject')?.value?.trim()||''
        });
      }
    }catch(_){memHit=null;}
  }
  if(memHit&&memHit.translatedText){
    busy([$('tGo')],$('tStop'),false);
    $('tOut').value=memHit.translatedText;
    if(memHit.corrected){
      $('tMeta').innerHTML=`<span class="pill-tm pill-corrected">${esc(L('fromCorrection'))}</span>`;
    }else{
      $('tMeta').innerHTML=`<span class="pill-tm">${esc(L('fromMemory'))}</span>`;
    }
    const h=store.get('hist',[]);h.unshift({ts:Date.now(),src:$('src').value,tgt:$('tgt').value,e:memHit.corrected?'correction':'memory',i:text.slice(0,4000),o:memHit.translatedText.slice(0,4000)});store.set('hist',h.slice(0,60));
    $('tCopy').removeEventListener('click',copyBtnClick);
    return;
  }

  if(isOff()&&!cfg.order.some(id=>(!isOff()||offCapable(id))&&usable(id))){
    showOfflineGuidance(L('noOff'),$('tMeta'));
    busy([$('tGo')],$('tStop'),false);
    return;
  }

  // A slow AI engine must not look like a hang: after 4 s say what is being waited for.
  const aiName=ENG[(mode==='smart'?getSmartEngineChain():getAiEngineChain())[0]]?.name||'';
  const waitTimer=mode==='fast'||!aiName?0:setTimeout(()=>{
    const m=$('tMeta');if(!m||m.querySelector('.waiting-ai'))return;
    if(mode==='smart'&&!$('tOut').value)m.textContent=`${L('waitingFor')} ${aiName}…`;
    else if(mode==='both'){const sp=document.createElement('span');sp.className='waiting-ai';sp.textContent=` · ${L('waitingFor')} ${aiName}…`;m.appendChild(sp)}
  },4000);
  let fgPersian='';
  try{
    let lines=text.split('\n');
    // Finglish: one AI request turns it into Persian script; that is shown above the translation and translated from.
    $('tFinglish').hidden=true;
    const fg=await finglishStep(text,tCtl.signal);
    if(fg.kind==='needs-ai'){
      $('tOut').value='';$('tMeta').textContent=L('fgNeedsAi');
      busy([$('tGo')],$('tStop'),false);return;
    }
    if(fg.kind==='ok'){
      fgPersian=fg.persian;fgBox(fgPersian,$('tFinglish'));
      if($('tgt').value==='fa'){                      // the conversion is the result
        $('tOut').value=fgPersian;
        $('tMeta').textContent=`${L('fgVia')} · ${fg.engine} · ${((performance.now()-t0)/1000).toFixed(1)}s`;
        const h=store.get('hist',[]);h.unshift({ts:Date.now(),src:$('src').value,tgt:$('tgt').value,e:fg.engine,i:text.slice(0,4000),o:fgPersian.slice(0,4000)});store.set('hist',h.slice(0,60));
        busy([$('tGo')],$('tStop'),false);return;
      }
      lines=fgPersian.split('\n');srcOverride='fa';
    }
    if(mode==='fast'||(mode==='both'&&!hasAi)){
      const r=await translateItems(lines,opts({chain:getFastChain(),signal:tCtl.signal,onProgress:(a,b)=>$('tMeta').textContent=`${a}/${b}`}));
      const res=r.out.join('\n');$('tOut').value=res;
      $('tMeta').innerHTML=`<span class="pill-fast">${esc(L('fastLabel'))}</span> · ${esc(r.used)} · ${((performance.now()-t0)/1000).toFixed(1)}s`;
      const h=store.get('hist',[]);h.unshift({ts:Date.now(),src:$('src').value,tgt:$('tgt').value,e:r.used,i:text.slice(0,4000),o:res.slice(0,4000)});store.set('hist',h.slice(0,60));
      saveToMemory({text,translatedText:res,lines,out:r.out,src:srcOverride||($('src').value==='finglish'?'auto':$('src').value),tgt:$('tgt').value,modeClass:'fast',tone:$('tone')?.value||'',subject:$('tSubject')?.value?.trim()||''});
    }else if(mode==='smart'){
      const smartChain=getSmartEngineChain();
      const r=await translateItems(lines,opts({chain:smartChain,signal:tCtl.signal,onProgress:(a,b)=>$('tMeta').textContent=`${a}/${b}`}));
      const res=r.out.join('\n');$('tOut').value=res;
      $('tMeta').textContent=`${L('via')} ${r.used} · ${((performance.now()-t0)/1000).toFixed(1)}s`;
      const h=store.get('hist',[]);h.unshift({ts:Date.now(),src:$('src').value,tgt:$('tgt').value,e:r.used,i:text.slice(0,4000),o:res.slice(0,4000)});store.set('hist',h.slice(0,60));
      saveToMemory({text,translatedText:res,lines,out:r.out,src:srcOverride||($('src').value==='finglish'?'auto':$('src').value),tgt:$('tgt').value,modeClass:'smart',tone:$('tone')?.value||'',subject:$('tSubject')?.value?.trim()||''});
    }else{
      const nonAiEng=getFastChain()[0];
      const aiChain=getAiEngineChain();
      let fastDone=false,smartDone=false,fastErr=null;
      // Fast failed but Smart worked: show the Smart result and say so in one line.
      const noteFastFailed=()=>{const sp=document.createElement('span');sp.className='fast-failed';sp.textContent=` · ${L('fastFailed')} (${toPlainReason(fastErr)||fastErr.message})`;$('tMeta').appendChild(sp)};
      let fastRes='',fastUsed=nonAiEng;
      let smartRes='',smartUsed='';

      const fastPromise=translateItems(lines,opts({chain:getFastChain(),signal:tCtl.signal})).then(r=>{
        fastRes=r.out.join('\n');
        fastUsed=r.used;
        fastDone=true;
        if(!smartDone){
          $('tOut').value=fastRes;
          $('tMeta').innerHTML=`<span class="pill-fast">${esc(L('fastLabel'))}</span> · ${esc(r.used)}`;
        }
        saveToMemory({text,translatedText:fastRes,lines,out:r.out,src:srcOverride||($('src').value==='finglish'?'auto':$('src').value),tgt:$('tgt').value,modeClass:'fast',tone:$('tone')?.value||'',subject:$('tSubject')?.value?.trim()||''});
        return r;
      }).catch(err=>{
        fastDone=true;fastErr=err;
        if(smartDone&&smartRes)noteFastFailed();
        throw err;
      });

      const smartPromise=translateItems(lines,opts({chain:aiChain,signal:tCtl.signal})).then(r=>{
        smartRes=r.out.join('\n');
        smartUsed=r.used;
        smartDone=true;
        const dur=((performance.now()-t0)/1000).toFixed(1);

        if(userInteractedWithFast&&fastRes){
          let showBtn=$('tShowImproved');
          if(!showBtn){
            showBtn=document.createElement('button');
            showBtn.id='tShowImproved';
            showBtn.className='btn ghost';
            showBtn.style.marginLeft='8px';
            showBtn.textContent=L('showImproved');
            $('tMeta').appendChild(showBtn);
          }
          showBtn.onclick=()=>{
            $('tOut').classList.add('calm-fade');
            setTimeout(()=>$('tOut').classList.remove('calm-fade'),400);
            $('tOut').value=smartRes;
            $('tMeta').textContent=`${L('via')} ${smartUsed} · ${dur}s`;
            showBtn.remove();
            const h=store.get('hist',[]);h.unshift({ts:Date.now(),src:$('src').value,tgt:$('tgt').value,e:smartUsed,i:text.slice(0,4000),o:smartRes.slice(0,4000)});store.set('hist',h.slice(0,60));
          };
        }else{
          $('tOut').classList.add('calm-fade');
          setTimeout(()=>$('tOut').classList.remove('calm-fade'),400);
          $('tOut').value=smartRes;
          $('tMeta').textContent=`${L('via')} ${smartUsed} · ${dur}s`;
          if(fastErr)noteFastFailed();
          const h=store.get('hist',[]);h.unshift({ts:Date.now(),src:$('src').value,tgt:$('tgt').value,e:smartUsed,i:text.slice(0,4000),o:smartRes.slice(0,4000)});store.set('hist',h.slice(0,60));
        }
        saveToMemory({text,translatedText:smartRes,lines,out:r.out,src:srcOverride||($('src').value==='finglish'?'auto':$('src').value),tgt:$('tgt').value,modeClass:'smart',tone:$('tone')?.value||'',subject:$('tSubject')?.value?.trim()||''});
        return r;
      }).catch(err=>{
        smartDone=true;
        if(fastRes){
          const is429=err.status===429||/429|resource_exhausted|rate limit|quota/i.test(err.message||'');
          const plain=toPlainReason(err);const reason=is429?L('aiRateLimited'):(plain?`${L('aiUnavailable')} (${plain})`:L('aiUnavailable'));
          $('tMeta').textContent=`${L('fastLabel')} (${esc(fastUsed)}) · ${reason}`;
          const h=store.get('hist',[]);h.unshift({ts:Date.now(),src:$('src').value,tgt:$('tgt').value,e:fastUsed,i:text.slice(0,4000),o:fastRes.slice(0,4000)});store.set('hist',h.slice(0,60));
          saveToMemory({text,translatedText:fastRes,lines,src:srcOverride||($('src').value==='finglish'?'auto':$('src').value),tgt:$('tgt').value,modeClass:'fast',tone:$('tone')?.value||'',subject:$('tSubject')?.value?.trim()||''});
        }else{
          throw err;
        }
      });

      await Promise.allSettled([fastPromise,smartPromise]);
      if(!fastRes&&!smartRes){
        throw new Error(L(isOff()?'noOff':'noEngine'));
      }
    }
  }catch(e){
    if(isOff()){
      showOfflineGuidance(e.message,$('tMeta'));
    }else{
      $('tMeta').textContent='';
      fail(e);
    }
  }
  finally{
    clearTimeout(waitTimer);srcOverride=null;
    $('tCopy').removeEventListener('click',copyBtnClick);
  }
  busy([$('tGo')],$('tStop'),false);
  updateStatusChip();
  renderRecentTranslations();
  if(mode!=='fast'&&$('tOut').value&&aiAvailable())markIdiomsAi(fgPersian||text);
}

function updateTextCounts(){
  const val = $('tIn')?.value || '';
  const chars = val.length;
  const words = val.trim() ? val.trim().split(/\s+/).length : 0;
  if($('tCount')) $('tCount').textContent = `${chars} ${L('chars')}`;
  if($('tWordCount')){
    const wUnit = ui === 'fa' ? 'کلمه' : (words === 1 ? 'word' : 'words');
    $('tWordCount').textContent = `${words} ${wUnit}`;
  }
}

function updateCardLangNames(){
  const s = $('src')?.value || 'auto';
  const t = $('tgt')?.value || 'fa';
  if($('tSrcLangName')) $('tSrcLangName').textContent = s === 'auto' ? L('detect') : langShort(s);
  if($('tTgtLangName')) $('tTgtLangName').textContent = langShort(t);
}

function updateTargetCardDirection(){
  const t = $('tgt')?.value || 'fa';
  const isRtl = (t === 'fa' || t === 'ar' || t === 'ur' || t === 'he' || t === 'ps' || t === 'ku');
  if($('tOut')){
    $('tOut').dir = isRtl ? 'rtl' : 'ltr';
    if(isRtl){
      $('tOut').classList.add('rtl-text');
    }else{
      $('tOut').classList.remove('rtl-text');
    }
  }
}

function updateStatusChip(){
  const chip = $('tStatusChip');
  if(!chip) return;
  const hasRes = !!$('tOut')?.value?.trim();
  chip.hidden = !hasRes;
}

function updateListenButtonState(){
  const btn = $('tSpeak');
  if(!btn) return;
  btn.disabled = false;
  const tgt = $('tgt')?.value || 'fa';
  if(typeof resolveVoice === 'function'){
    const v = resolveVoice(tgt);
    const vName = v.kind === 'device' ? v.voice?.name : v.kind === 'gemini' ? `Gemini (${v.voiceName})` : v.kind === 'piper' ? (typeof mcText==='function'?mcText(v.m?.name):v.m?.name) : '';
    btn.title = vName ? `${L('speak')} · ${vName}` : (L('speak') || 'Speak');
    if($('tVoiceUsed')){
      $('tVoiceUsed').textContent = vName ? `${L('voiceUsed')}: ${vName}` : '';
      $('tVoiceUsed').title = $('tVoiceUsed').textContent;
    }
  }
}

$('tGo').onclick=doText;$('tStop').onclick=()=>tCtl?.abort();
$('tIn').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();doText()}});
$('tIn').addEventListener('input',updateTextCounts);
$('tClear').onclick=()=>{
  $('tIn').value='';$('tOut').value='';$('tMeta').textContent='';
  if($('tSaveCorrection'))$('tSaveCorrection').hidden=true;
  $('tIn').dispatchEvent(new Event('input'));
  updateStatusChip();
  $('tIn').focus();
};
$('tOut').addEventListener('input',()=>{
  const hasIn=$('tIn').value.trim();
  const hasOut=$('tOut').value.trim();
  if($('tSaveCorrection'))$('tSaveCorrection').hidden=!(hasIn&&hasOut);
  updateStatusChip();
});
if($('tSaveCorrection'))$('tSaveCorrection').onclick=async()=>{
  const text=$('tIn').value;
  const corrected=$('tOut').value;
  if(!text.trim()||!corrected.trim())return;

  const mode=$('tMode')?.value||getDefaultTransMode();
  const hasAi=cfg.order.some(id=>ENG[id]?.ai&&usable(id));
  const memMode=(mode==='fast'||(mode==='both'&&!hasAi))?'fast':'smart';

  if(typeof TranslationMemory!=='undefined'){
    const saveModes=mode==='both'?['fast','smart']:[memMode];
    for(const m of saveModes){
      await TranslationMemory.put({
        sourceText:text,
        translatedText:corrected,
        src:$('src').value==='finglish'?'auto':$('src').value,
        tgt:$('tgt').value,
        modeClass:m,
        tone:$('tone')?.value||'',
        subject:$('tSubject')?.value?.trim()||'',
        corrected:true
      });
    }
  }

  $('tSaveCorrection').hidden=true;
  $('tMeta').innerHTML=`<span class="pill-tm pill-corrected">${esc(L('fromCorrection'))}</span>`;
  toast(L('correctionSaved'),'ok');
  const h=store.get('hist',[]);
  h.unshift({ts:Date.now(),src:$('src').value,tgt:$('tgt').value,e:'correction',i:text.slice(0,4000),o:corrected.slice(0,4000)});
  store.set('hist',h.slice(0,60));
  updateTmCount();
  renderRecentTranslations();
};
$('tPaste').onclick=async()=>{try{$('tIn').value=await navigator.clipboard.readText();$('tIn').dispatchEvent(new Event('input'))}catch{toast('Clipboard blocked','err')}};
$('tCopy').onclick=()=>copy($('tOut').value);
if($('tCardSwap')) $('tCardSwap').onclick=()=>{
  const outVal=$('tOut')?.value||'';
  if(!outVal.trim())return;
  const inVal=$('tIn')?.value||'';
  $('tIn').value=outVal;
  $('tOut').value=inVal;
  const s=$('src')?.value, t=$('tgt')?.value;
  if(s!=='auto'&&s!=='finglish'){
    $('src').value=t;
    $('tgt').value=s;
    $('src').onchange?.();
    $('tgt').onchange?.();
  }
  $('tIn').dispatchEvent(new Event('input'));
  $('tOut').dispatchEvent(new Event('input'));
  updateStatusChip();
};
$('tSpeak').onclick=()=>{
  getOrCreateAppAudioContext();
  if(isSpeaking()||$('tSpeak').classList.contains('preparing')||$('tSpeak').classList.contains('playing')||(typeof voiceState!=='undefined'&&(voiceState==='speaking'||voiceState==='preparing'))){
    stopSpeak();
  }else{
    speak($('tOut').value,$('tgt').value);
  }
};
$('tMic').onclick=()=>listen($('src').value,$('tMic'),tx=>{$('tIn').value=($('tIn').value?$('tIn').value+' ':'')+tx;$('tIn').dispatchEvent(new Event('input'));doText()});

function formatRelativeTime(ts){
  if(!ts) return '';
  const diffSec=Math.max(0,Math.floor((Date.now()-ts)/1000));
  if(diffSec<60) return ui==='fa'?'همین الان':'Just now';
  const diffMin=Math.floor(diffSec/60);
  if(diffMin<60) return ui==='fa'?`${diffMin} دقیقه قبل`:`${diffMin} minute${diffMin===1?'':'s'} ago`;
  const diffHr=Math.floor(diffMin/60);
  if(diffHr<24) return ui==='fa'?`${diffHr} ساعت قبل`:`${diffHr} hour${diffHr===1?'':'s'} ago`;
  const diffDay=Math.floor(diffHr/24);
  return ui==='fa'?`${diffDay} روز قبل`:`${diffDay} day${diffDay===1?'':'s'} ago`;
}

function renderRecentTranslations(){
  const list=$('tRecentList');
  const empty=$('tRecentEmpty');
  if(!list) return;

  const hist=store.get('hist',[]);
  const items=hist.slice(0,3);

  list.replaceChildren();

  if(!items.length){
    list.hidden=true;
    if(empty) empty.hidden=false;
    return;
  }

  list.hidden=false;
  if(empty) empty.hidden=true;

  items.forEach(item=>{
    const tile=document.createElement('div');
    tile.className='trans-recent-tile';
    tile.setAttribute('role','button');
    tile.tabIndex=0;
    tile.title='Click to load into translator';

    const clockIcon=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="trans-recent-icon" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    const arrowIcon=`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="trans-recent-arrow" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;

    tile.innerHTML=`
      <div class="trans-recent-tile-main">
        <span class="trans-recent-time-grp">
          ${clockIcon}
          <span class="trans-recent-rel-time">${esc(formatRelativeTime(item.ts))}</span>
        </span>
        <div class="trans-recent-texts">
          <span class="trans-recent-src-text" title="${esc(item.i)}">${esc(item.i)}</span>
          ${arrowIcon}
          <span class="trans-recent-tgt-text" title="${esc(item.o)}">${esc(item.o)}</span>
        </div>
      </div>
    `;

    const loadItem=()=>{
      if($('tIn')) $('tIn').value=item.i||'';
      if($('tOut')) $('tOut').value=item.o||'';
      if(item.src&&$('src')) $('src').value=item.src;
      if(item.tgt&&$('tgt')) $('tgt').value=item.tgt;
      $('tIn')?.dispatchEvent(new Event('input'));
      $('tOut')?.dispatchEvent(new Event('input'));
      if(typeof voiceLabels==='function') voiceLabels();
      if(typeof updateCardLangNames==='function') updateCardLangNames();
      if(typeof updateTargetCardDirection==='function') updateTargetCardDirection();
      if(typeof updateStatusChip==='function') updateStatusChip();
      if(item.e){
        if(item.e==='memory') $('tMeta').innerHTML=`<span class="pill-tm">${esc(L('fromMemory'))}</span>`;
        else if(item.e==='correction') $('tMeta').innerHTML=`<span class="pill-tm pill-corrected">${esc(L('fromCorrection'))}</span>`;
        else if(ENG[item.e]?.name) $('tMeta').textContent=ENG[item.e].name;
      }
    };

    tile.onclick=loadItem;
    tile.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();loadItem()}};
    list.append(tile);
  });
}

if($('tRecentClear')){
  $('tRecentClear').onclick=()=>{
    store.set('hist',[]);
    renderRecentTranslations();
    if(typeof renderHist==='function') renderHist();
  };
}
if($('tRecentViewAll')){
  $('tRecentViewAll').onclick=()=>{
    const histBtn=document.querySelector('#tabs button[data-tab="hist"]');
    if(histBtn) histBtn.click();
  };
}

function renderTextStatusStrip(){
  const strip=$('tStatusStrip');
  if(!strip) return;

  const items=[];

  // 1. Offline translation model readiness (NLLB or active catalogue translation model)
  const trOk=typeof trAnyReady==='function'&&trAnyReady();
  const trM=(typeof trModels==='function'&&typeof mcReady==='function'&&trModels().find(mcReady))||null;
  const rawName=trM?.name||'NLLB';
  const trName=typeof mcText==='function'?mcText(rawName):(typeof rawName==='object'?(rawName[ui]||rawName.en||''):rawName);
  items.push({
    ready:trOk,
    html:`<span class="status-dot ${trOk?'ok':'warn'}" aria-hidden="true"></span><span><bdi>${esc(trName)}</bdi> ${esc(trOk?L('statusReady'):L('statusNotDownloaded'))}</span>`
  });

  // Right-aligned status note: reflects current operation mode (offline mode vs online engines available)
  const infoText=isOff()?L('offMode'):L('statusOfflineAvail');
  const infoIcon=`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="trans-status-info-icon" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

  strip.innerHTML=`
    <div class="trans-status-items">
      ${items.map(it=>`<div class="trans-status-item">${it.html}</div>`).join('<span class="trans-status-sep" aria-hidden="true">|</span>')}
    </div>
    <div class="trans-status-info">
      ${infoIcon}
      <span>${esc(infoText)}</span>
    </div>
  `;
}

updateTextCounts();
updateCardLangNames();
updateTargetCardDirection();
updateStatusChip();
renderRecentTranslations();

