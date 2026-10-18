/* ---------- SUBTITLE ---------- */
let cues=[],sName='subtitle',sCtl=null;
const toMs=s=>{const m=s.trim().match(/(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/);return m?(+(m[1]||0))*3600000+m[2]*60000+m[3]*1000+ +m[4].padEnd(3,'0'):0};
const fmt=(ms,sep)=>{const p=(n,l=2)=>String(n).padStart(l,'0');return `${p(Math.floor(ms/3600000))}:${p(Math.floor(ms/60000)%60)}:${p(Math.floor(ms/1000)%60)}${sep}${p(ms%1000,3)}`};
function parseSubs(txt){
  const out=[];
  for(const block of txt.replace(/^\ufeff/,'').replace(/\r\n?/g,'\n').split(/\n{2,}/)){
    const ls=block.split('\n'),k=ls.findIndex(l=>l.includes('-->'));if(k<0)continue;
    const [a,b]=ls[k].split('-->');const text=ls.slice(k+1).join('\n').trim();if(!text)continue;
    out.push({s:toMs(a),e:toMs(b),o:text,t:'',fromMemory:false});
  }
  return out;
}
function wrap2(s,max=42){
  if(s.length<=max||s.includes('\n'))return s;
  const mid=s.length/2;let best=-1;
  for(let i=0;i<s.length;i++)if(s[i]===' '&&(best<0||Math.abs(i-mid)<Math.abs(best-mid)))best=i;
  return best<0?s:s.slice(0,best)+'\n'+s.slice(best+1);
}
function updateSubEngineNotice(){
  const cur=(typeof store!=='undefined'?store.get('engine','auto'):'auto');
  const isNonAi=cur==='google'||cur==='mymemory'||cur==='nllb'||cur==='chrome';
  const el=$('subEngineNotice');
  if(el)el.hidden=!isNonAi;
}
function subLangName(code){
  if(code==='auto')return L('detect')||(ui==='fa'?'تشخیص خودکار':'Auto');
  if(ui==='fa'){
    if(code==='en')return 'انگلیسی';
    if(code==='fa')return 'فارسی';
    if(typeof LANGS!=='undefined'&&Array.isArray(LANGS)){
      const found=LANGS.find(l=>l[0]===code);
      if(found&&found[2])return found[2];
    }
  }
  return typeof langName==='function'?langName(code):code;
}
function renderCues(){
  const srcCode=$('src')?.value||'auto';
  const tgtCode=$('tgt')?.value||'fa';
  const srcName=subLangName(srcCode);
  const tgtName=subLangName(tgtCode);
  const isTgtRtl=tgtCode==='fa'||tgtCode==='ar'||tgtCode==='ur'||tgtCode==='he'||tgtCode==='ps'||tgtCode==='ku';

  const numCol=esc(L('subColNum')||'#');
  const timeCol=esc(L('subColTime')||(ui==='fa'?'زمان':'Time'));
  const origCol=esc(`${L('subColOrig')||'Original'} (${srcName})`);
  const transCol=esc(`${L('subColTrans')||'Translation'} (${tgtName})`);
  const editSvg=`<svg class="sub-hdr-edit-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;

  const hdr=`<div class="cues-header" role="row"><span class="n">${numCol}</span><span class="tm">${timeCol}</span><div class="o">${origCol}</div><div class="tr-hdr">${transCol} ${editSvg}</div></div>`;

  $('cues').innerHTML=hdr+cues.map((c,i)=>`<div class="cue" data-i="${i}"><span class="n">${i+1}</span><span class="tm" dir="ltr">${fmt(c.s,'.').slice(0,8)} → ${fmt(c.e,'.').slice(0,8)}</span><div class="o" dir="auto">${esc(c.o)}</div><div class="tr-cell"><div class="tr" dir="${isTgtRtl?'rtl':'auto'}" contenteditable="true" data-i="${i}">${esc(c.t)}</div><span class="cue-tm-badge pill-tm" data-i="${i}" ${c.fromMemory?'':'hidden'}>${esc(ui==='fa'?'حافظه':'memory')}</span></div></div>`).join('');
  sInfo();
}
const isSubErr=s=>!s||!s.trim()||/^(error|failed|http\s*\d+|429|503|rate limit|quota|timeout|timed?\s*out|unavailable|resource_exhausted)/i.test(s.trim());
const sInfo=()=>{
  const validCues=cues.filter(c=>c.t&&!isSubErr(c.t)).length;
  $('sInfo').textContent=`${sName} · ${validCues}/${cues.length} ${L('lines')}`;
  if($('sCuesCount'))$('sCuesCount').textContent=`${cues.length} ${L('cues')||'cues'}`;
  const srcName=subLangName($('src')?.value||'auto');
  const tgtName=subLangName($('tgt')?.value||'fa');
  if($('sLangPair'))$('sLangPair').textContent=`${srcName} → ${tgtName}`;
};
function updateSubProg(pct){
  const validCues=cues.filter(c=>c.t&&c.t.trim()&&!isSubErr(c.t)).length;
  const memCues=cues.filter(c=>c.fromMemory).length;
  const curPct=pct!=null?(pct===100&&validCues<cues.length?Math.round((validCues/cues.length)*100):pct):(cues.length?Math.round((validCues/cues.length)*100):0);
  if($('sBar'))$('sBar').style.width=curPct+'%';
  if($('sProgText')){
    const memPart=memCues?` · ${memCues} ${L('fromMemory')||'from memory'}`:'';
    const memPartFa=memCues?` · ${memCues} از حافظه`:'';
    $('sProgText').textContent=ui==='fa'
      ? `${validCues} از ${cues.length} خط (${curPct}%)${memPartFa}`
      : `Translated ${validCues} of ${cues.length} lines (${curPct}%)${memPart}`;
  }
}
let subEditTmTimer=null;
async function saveSubCueCorrection(i){
  if(i==null||!cues[i])return;
  const text=cues[i].o;
  const corrected=(cues[i].t||'').trim();
  if(!text||!text.trim()||!corrected)return;
  if(cfg.tm===false||typeof TranslationMemory==='undefined')return;

  const curEngine=(typeof store!=='undefined'?store.get('engine','auto'):'auto');
  const firstEng=curEngine==='auto'?cfg.order.find(usable):curEngine;
  const subMemMode=(firstEng&&ENG[firstEng]?.ai)?'smart':'fast';
  const subStyle=$('subStyle')?.value||'film';
  const srcLang=$('src').value==='finglish'?'auto':$('src').value;
  const tgtLang=$('tgt').value;
  const tone=$('tone')?.value||'';
  const subject=$('tSubject')?.value?.trim()||'';

  const origLines=text.split('\n');
  const corrLines=corrected.split('\n');
  if(origLines.length>1&&origLines.every(l=>/^\s*[-–—]/.test(l))&&origLines.length===corrLines.length){
    for(let k=0;k<origLines.length;k++){
      await TranslationMemory.put({
        sourceText:origLines[k],
        translatedText:corrLines[k],
        src:srcLang,
        tgt:tgtLang,
        modeClass:subMemMode,
        tone,
        subject,
        subStyle,
        corrected:true
      });
    }
  }else{
    const unitText=origLines.join(' ');
    await TranslationMemory.put({
      sourceText:unitText,
      translatedText:corrected,
      src:srcLang,
      tgt:tgtLang,
      modeClass:subMemMode,
      tone,
      subject,
      subStyle,
      corrected:true
    });
  }
  updateTmCount();
}
$('cues').addEventListener('input',e=>{
  const i=e.target.dataset?.i;
  if(i!=null){
    cues[i].t=e.target.innerText.replace(/\n$/,'');
    cues[i].fromMemory=false;
    const badge=$('cues').querySelector(`.cue-tm-badge[data-i="${i}"]`);
    if(badge)badge.hidden=true;
    const row=$('cues').querySelector(`.cue[data-i="${i}"]`);
    if(row&&cues[i].t.trim()&&!isSubErr(cues[i].t))row.classList.remove('error');
    const hasRemainingFailed=cues.some(c=>!c.t||!c.t.trim()||isSubErr(c.t));
    if(!hasRemainingFailed){
      if($('sStatusChip'))$('sStatusChip').className='sub-status-chip idle';
      if($('sStatusText'))$('sStatusText').textContent=ui==='fa'?'آماده':'Ready';
    }
    sInfo();
    updateSubProg();
    clearTimeout(subEditTmTimer);
    subEditTmTimer=setTimeout(()=>saveSubCueCorrection(i),300);
  }
});
$('cues').addEventListener('focusout',e=>{
  const i=e.target.dataset?.i;
  if(i!=null){
    clearTimeout(subEditTmTimer);
    saveSubCueCorrection(i);
  }
});
async function loadSubs(f){
  const c=parseSubs(await f.text());if(!c.length){toast('No subtitle lines found in this file','err');return}
  sCtl?.abort(); // a translation still running belongs to the old file
  cues=c;sName=f.name.replace(/\.[^.]+$/,'');
  if($('sFileName'))$('sFileName').textContent=f.name;
  if($('sCuesCount'))$('sCuesCount').textContent=`${c.length} ${L('cues')||'cues'}`;
  const srcName=subLangName($('src')?.value||'auto');
  const tgtName=subLangName($('tgt')?.value||'fa');
  if($('sLangPair'))$('sLangPair').textContent=`${srcName} → ${tgtName}`;
  $('sDrop').hidden=true;if($('sEntryCards'))$('sEntryCards').hidden=true;if($('sVideoCard'))$('sVideoCard').hidden=true;$('sWork').hidden=false;
  if($('sStatusChip'))$('sStatusChip').className='sub-status-chip idle';
  if($('sStatusText'))$('sStatusText').textContent=ui==='fa'?'آماده':'Ready';
  renderCues();updateSubEngineNotice();updateSubProg(0);
}
dropzone($('sDrop'),$('sFile'),loadSubs);
if($('sChangeFile'))$('sChangeFile').onclick=()=>$('sFile').click();
// Close file: back to the empty drop zone. If there are translated lines, the first click only asks (second click within 6 s confirms).
let sCloseTimer=null;
const sCloseReset=()=>{clearTimeout(sCloseTimer);sCloseTimer=null;if($('sCloseFileText'))$('sCloseFileText').textContent=L('subCloseFile')};
function closeSubs(){
  sCtl?.abort();sCloseReset();
  cues=[];sName='subtitle';$('cues').innerHTML='';$('sBar').style.width='0';if($('sProgText'))$('sProgText').textContent='';
  if($('sFileName'))$('sFileName').textContent='subtitle.srt';
  if($('sCuesCount'))$('sCuesCount').textContent=`0 ${L('cues')||'cues'}`;
  if($('sStatusChip'))$('sStatusChip').className='sub-status-chip idle';
  if($('sStatusText'))$('sStatusText').textContent=ui==='fa'?'آماده':'Ready';
  $('sFile').value='';$('sWork').hidden=true;$('sDrop').hidden=false;if($('sEntryCards'))$('sEntryCards').hidden=false;if($('sVideoCard'))$('sVideoCard').hidden=false;
}
if($('sCloseFile'))$('sCloseFile').onclick=()=>{
  if(cues.some(c=>c.t&&c.t.trim())&&!sCloseTimer){
    $('sCloseFileText').textContent=L('subCloseSure');
    sCloseTimer=setTimeout(sCloseReset,6000);return;
  }
  closeSubs();
};
async function doSubs(onlyEmpty){
  const idx=cues.map((c,i)=>i).filter(i=>!onlyEmpty||!cues[i].t.trim()||isSubErr(cues[i].t));if(!idx.length)return;
  // unit = one cue, or one dialogue line when every line starts with a dash
  const units=[],map=[];
  idx.forEach(i=>{const ls=cues[i].o.split('\n');
    if(ls.length>1&&ls.every(l=>/^\s*[-–—]/.test(l)))ls.forEach((l,k)=>{units.push(l);map.push([i,k,ls.length])});
    else{units.push(ls.join(' '));map.push([i,0,1])}});
  const parts={};
  sCtl=new AbortController();busy([$('sGo'),$('sRest')],$('sStop'),true);
  const subT0=Date.now();
  $('cues').querySelectorAll('.cue.error').forEach(el=>el.classList.remove('error'));
  if($('sStatusChip'))$('sStatusChip').className='sub-status-chip translating';
  if($('sStatusText'))$('sStatusText').textContent=ui==='fa'?'در حال ترجمه':'Translating';

  const curEngine=(typeof store!=='undefined'?store.get('engine','auto'):'auto');
  const firstEng=curEngine==='auto'?cfg.order.find(usable):curEngine;
  const subMemMode=(firstEng&&ENG[firstEng]?.ai)?'smart':'fast';
  const subStyle=$('subStyle')?.value||'film';
  const srcLang=$('src').value==='finglish'?'auto':$('src').value;
  const tgtLang=$('tgt').value;
  const tone=$('tone')?.value||'';
  const subject=$('tSubject')?.value?.trim()||'';

  const missIndices=[];
  const missTexts=[];
  let memHits=0;

  // 1. Look up memory before calling engine
  if(cfg.tm!==false&&typeof TranslationMemory!=='undefined'){
    for(let u=0;u<units.length;u++){
      try{
        const hit=await TranslationMemory.get({
          text:units[u],
          src:srcLang,
          tgt:tgtLang,
          modeClass:subMemMode,
          tone,
          subject,
          subStyle
        });
        if(hit&&hit.translatedText){
          const [i,p,n]=map[u];
          (parts[i]=parts[i]||[])[p]=hit.translatedText;
          if(parts[i].filter(x=>x!=null).length===n){
            cues[i].t=n>1?parts[i].join('\n'):wrap2(hit.translatedText.trim());
            cues[i].fromMemory=true;
            const el=$('cues').querySelector(`.tr[data-i="${i}"]`);
            if(el)el.textContent=cues[i].t;
            const badge=$('cues').querySelector(`.cue-tm-badge[data-i="${i}"]`);
            if(badge)badge.hidden=false;
          }
          memHits++;
          continue;
        }
      }catch(_){}
      missIndices.push(u);
      missTexts.push(units[u]);
    }
  }else{
    for(let u=0;u<units.length;u++){
      missIndices.push(u);
      missTexts.push(units[u]);
    }
  }

  // If all units hit memory, no engine call needed
  if(missTexts.length===0){
    busy([$('sGo'),$('sRest')],$('sStop'),false);
    updateSubProg(100);
    if($('sStatusChip'))$('sStatusChip').className='sub-status-chip idle';
    if($('sStatusText'))$('sStatusText').textContent=ui==='fa'?'آماده':'Ready';
    const memCues=cues.filter(c=>c.fromMemory).length;
    const memMsg=`${memCues} ${L('lines')||'lines'} ${L('fromMemory')||'from memory'}`;
    const subElapsed=Math.max(0,Math.round((Date.now()-subT0)/1000));
    const subTimeStr=(typeof MediaTranslate!=='undefined'&&typeof MediaTranslate.formatElapsedTime==='function')
      ? MediaTranslate.formatElapsedTime(subElapsed,ui)
      : `${subElapsed} s`;
    const doneText=ui==='fa'?`انجام شد در ${subTimeStr}`:`Done in ${subTimeStr}`;
    toast(`${doneText} · ${memMsg}`,'ok');
    sInfo();
    return;
  }

  // 2. Translate only missing units
  // Flow on batch failure:
  // (a) Within engine: eGoogle falls back from clients5.google.com to translate.googleapis.com if primary endpoint fails.
  // (b) Across engines: translateItems tries fallback engines in cfg.order if the current engine throws.
  // (c) Unrescued failure: if every engine/endpoint fails, translateItems throws. The run stops,
  const chosenEngine=(typeof store!=='undefined'?store.get('engine','auto'):'auto');
  let subChain;
  if(chosenEngine==='auto'){
    subChain=cfg.order.filter(usable);
  }else{
    if(!usable(chosenEngine)){
      throw new Error(why(chosenEngine)||L(isOff()?'noOff':'noEngine'));
    }
    subChain=[chosenEngine];
  }
  try{
    const r=await translateItems(missTexts,opts({kind:'sub',signal:sCtl.signal,engine:chosenEngine,chain:subChain,
      onProgress:(pos,tot,engId)=>{
        const doneUnits=missIndices.length?(units.length-missIndices.length)+pos:pos;
        const pct=units.length?Math.round((doneUnits/units.length)*100):0;
        updateSubProg(pct);
      },
      onBatch:(b,res)=>{
        const errRe=/^(error|failed|http\s*\d+|429|503|rate limit|quota|timeout|timed?\s*out|unavailable|resource_exhausted)/i;
        const batchOk=Array.isArray(res)&&res.length===b.length&&res.every(s=>typeof s==='string'&&s.trim()&&!errRe.test(s.trim()));

        b.forEach((kMiss,k)=>{
          const u=missIndices[kMiss];
          const [i,p,n]=map[u];
          const trans=res[k];
          (parts[i]=parts[i]||[])[p]=trans;
          if(parts[i].filter(x=>x!=null).length===n){
            cues[i].t=n>1?parts[i].join('\n'):wrap2(trans.trim());
            cues[i].fromMemory=false;
            const el=$('cues').querySelector(`.tr[data-i="${i}"]`);
            if(el)el.textContent=cues[i].t;
            const badge=$('cues').querySelector(`.cue-tm-badge[data-i="${i}"]`);
            if(badge)badge.hidden=true;
            const row=$('cues').querySelector(`.cue[data-i="${i}"]`);
            if(row&&cues[i].t.trim()&&!isSubErr(cues[i].t))row.classList.remove('error');
          }

          if(batchOk&&cfg.tm!==false&&typeof TranslationMemory!=='undefined'){
            TranslationMemory.put({
              sourceText:units[u],
              translatedText:trans,
              src:srcLang,
              tgt:tgtLang,
              modeClass:subMemMode,
              tone,
              subject,
              subStyle
            }).catch(()=>{});
          }
        });
        sInfo();
        updateSubProg();
      }}));

    const failedCues=cues.filter(c=>!c.t||!c.t.trim()||isSubErr(c.t));
    if(failedCues.length>0){
      if($('sStatusChip'))$('sStatusChip').className='sub-status-chip error';
      if($('sStatusText'))$('sStatusText').textContent=ui==='fa'?'خطا':'Error';
      cues.forEach((c,idx)=>{
        const row=$('cues').querySelector(`.cue[data-i="${idx}"]`);
        if(row&&(!c.t||!c.t.trim()||isSubErr(c.t)))row.classList.add('error');
      });
      updateSubProg();
    }else{
      updateSubProg(100);
      const memCues=cues.filter(c=>c.fromMemory).length;
      const memMsg=memCues?` (${memCues} ${L('fromMemory')||'lines from memory'})`:'';
      const subElapsed=Math.max(0,Math.round((Date.now()-subT0)/1000));
      const subTimeStr=(typeof MediaTranslate!=='undefined'&&typeof MediaTranslate.formatElapsedTime==='function')
        ? MediaTranslate.formatElapsedTime(subElapsed,ui)
        : `${subElapsed} s`;
      const doneText=ui==='fa'?`انجام شد در ${subTimeStr}`:`Done in ${subTimeStr}`;
      toast(`${doneText} · ${r.used}${memMsg}`,'ok');
      if($('sStatusChip'))$('sStatusChip').className='sub-status-chip idle';
      if($('sStatusText'))$('sStatusText').textContent=ui==='fa'?'آماده':'Ready';
    }
  }catch(e){
    fail(e);
    if(e.name==='AbortError'){
      if($('sStatusChip'))$('sStatusChip').className='sub-status-chip idle';
      if($('sStatusText'))$('sStatusText').textContent=ui==='fa'?'آماده':'Ready';
    }else{
      if($('sStatusChip'))$('sStatusChip').className='sub-status-chip error';
      if($('sStatusText'))$('sStatusText').textContent=ui==='fa'?'خطا':'Error';
      cues.forEach((c,idx)=>{
        const row=$('cues').querySelector(`.cue[data-i="${idx}"]`);
        if(row&&(!c.t||!c.t.trim()||isSubErr(c.t)))row.classList.add('error');
      });
    }
    updateSubProg();
  }
  busy([$('sGo'),$('sRest')],$('sStop'),false);
  sInfo();
  updateTmCount();
}
$('sGo').onclick=()=>doSubs(false);$('sRest').onclick=()=>doSubs(true);$('sStop').onclick=()=>sCtl?.abort();
function exportSubs(vtt){
  const bi=$('sBi').checked,sep=vtt?'.':',';
  const body=cues.map((c,i)=>{const tx=c.t?(bi?c.t+'\n'+c.o:c.t):c.o;return `${vtt?'':i+1+'\n'}${fmt(c.s,sep)} --> ${fmt(c.e,sep)}\n${tx}`}).join('\n\n')+'\n';
  download(`${sName}.${$('tgt').value}.${vtt?'vtt':'srt'}`,(vtt?'WEBVTT\n\n':'')+body);
}
$('sSrt').onclick=()=>exportSubs(false);$('sVtt').onclick=()=>exportSubs(true);
$('src')?.addEventListener('change',()=>{if(cues.length)renderCues();else sInfo();});
$('tgt')?.addEventListener('change',()=>{if(cues.length)renderCues();else sInfo();});

function initSubEnginePicker(){
  const hostEl=$('subEnginePickerHost');
  if(hostEl&&typeof ENG!=='undefined'&&typeof ENG.mountEnginePicker==='function'){
    ENG.mountEnginePicker(hostEl,{
      context:'sub',
      getLangs:()=>({
        src:$('subSrc')?.value||$('src')?.value||'en',
        tgt:$('subTgt')?.value||$('tgt')?.value||'fa'
      })
    });
  }
}
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',initSubEnginePicker);
}else{
  initSubEnginePicker();
}
$('subSrc')?.addEventListener('change',()=>{if(typeof ENG!=='undefined'&&typeof ENG.updateEnginePickers==='function')ENG.updateEnginePickers();});
$('subTgt')?.addEventListener('change',()=>{if(typeof ENG!=='undefined'&&typeof ENG.updateEnginePickers==='function')ENG.updateEnginePickers();});
