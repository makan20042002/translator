/* ---------- SUBTITLE ---------- */
let cues=[],sName='subtitle',sCtl=null;
const toMs=s=>{const m=s.trim().match(/(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/);return m?(+(m[1]||0))*3600000+m[2]*60000+m[3]*1000+ +m[4].padEnd(3,'0'):0};
const fmt=(ms,sep)=>{const p=(n,l=2)=>String(n).padStart(l,'0');return `${p(Math.floor(ms/3600000))}:${p(Math.floor(ms/60000)%60)}:${p(Math.floor(ms/1000)%60)}${sep}${p(ms%1000,3)}`};
function parseSubs(txt){
  const out=[];
  for(const block of txt.replace(/^\ufeff/,'').replace(/\r\n?/g,'\n').split(/\n{2,}/)){
    const ls=block.split('\n'),k=ls.findIndex(l=>l.includes('-->'));if(k<0)continue;
    const [a,b]=ls[k].split('-->');const text=ls.slice(k+1).join('\n').trim();if(!text)continue;
    out.push({s:toMs(a),e:toMs(b),o:text,t:''});
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
  const cur=$('engine')?.value||store.get('engine','auto');
  const isNonAi=cur==='google'||cur==='mymemory'||cur==='nllb'||cur==='chrome';
  const el=$('subEngineNotice');
  if(el)el.hidden=!isNonAi;
}
function renderCues(){
  const hdr=`<div class="cues-header"><span class="n">${esc(L('subColNum'))}</span><span class="tm">${esc(L('subColTime'))}</span><div class="o">${esc(L('subColOrig'))}</div><div class="tr">${esc(L('subColTrans'))}</div></div>`;
  $('cues').innerHTML=hdr+cues.map((c,i)=>`<div class="cue"><span class="n">${i+1}</span><span class="tm" dir="ltr">${fmt(c.s,'.').slice(0,8)} → ${fmt(c.e,'.').slice(0,8)}</span><div class="o" dir="auto">${esc(c.o)}</div><div class="tr" dir="auto" contenteditable="true" data-i="${i}">${esc(c.t)}</div></div>`).join('');
  sInfo();
}
const sInfo=()=>{
  $('sInfo').textContent=`${sName} · ${cues.filter(c=>c.t).length}/${cues.length} ${L('lines')}`;
  if($('sCuesCount'))$('sCuesCount').textContent=`${cues.length} ${L('cues')||'cues'}`;
  const srcName=typeof langName==='function'&&$('src')?langName($('src').value):'English';
  const tgtName=typeof langName==='function'&&$('tgt')?langName($('tgt').value):'Persian';
  if($('sLangPair'))$('sLangPair').textContent=`${srcName} → ${tgtName}`;
};
let subEditTmTimer=null;
async function saveSubCueCorrection(i){
  if(i==null||!cues[i])return;
  const text=cues[i].o;
  const corrected=(cues[i].t||'').trim();
  if(!text||!text.trim()||!corrected)return;
  if(cfg.tm===false||typeof TranslationMemory==='undefined')return;

  const curEngine=$('engine')?.value||'auto';
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
    sInfo();
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
  const srcName=typeof langName==='function'&&$('src')?langName($('src').value):'English';
  const tgtName=typeof langName==='function'&&$('tgt')?langName($('tgt').value):'Persian';
  if($('sLangPair'))$('sLangPair').textContent=`${srcName} → ${tgtName}`;
  $('sDrop').hidden=true;if($('sEntryCards'))$('sEntryCards').hidden=true;if($('sVideoCard'))$('sVideoCard').hidden=true;$('sWork').hidden=false;$('sBar').style.width='0';if($('sProgText'))$('sProgText').textContent='0%';renderCues();updateSubEngineNotice();
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
  const idx=cues.map((c,i)=>i).filter(i=>!onlyEmpty||!cues[i].t.trim());if(!idx.length)return;
  // unit = one cue, or one dialogue line when every line starts with a dash
  const units=[],map=[];
  idx.forEach(i=>{const ls=cues[i].o.split('\n');
    if(ls.length>1&&ls.every(l=>/^\s*[-–—]/.test(l)))ls.forEach((l,k)=>{units.push(l);map.push([i,k,ls.length])});
    else{units.push(ls.join(' '));map.push([i,0,1])}});
  const parts={};
  sCtl=new AbortController();busy([$('sGo'),$('sRest')],$('sStop'),true);

  const curEngine=$('engine')?.value||'auto';
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
            const el=$('cues').querySelector(`.tr[data-i="${i}"]`);
            if(el)el.textContent=cues[i].t;
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
    $('sBar').style.width='100%';
    const memMsg=`${memHits} ${L('lines')||'lines'} ${L('fromMemory')||'from memory'}`;
    if($('sProgText'))$('sProgText').textContent=`${units.length}/${units.length} (100%) · ${memMsg}`;
    toast(`${L('done')} · ${memMsg}`,'ok');
    sInfo();
    return;
  }

  // 2. Translate only missing units
  try{
    const r=await translateItems(missTexts,opts({kind:'sub',signal:sCtl.signal,
      onProgress:(pos,tot,engId)=>{
        const done=memHits+pos;
        const total=units.length;
        const pct=Math.round((done/total)*100);
        $('sBar').style.width=pct+'%';
        if($('sProgText')){
          $('sProgText').textContent=`${done}/${total} (${pct}%)${memHits?` · ${memHits} from memory`:''}`;
        }
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
            const el=$('cues').querySelector(`.tr[data-i="${i}"]`);
            if(el)el.textContent=cues[i].t;
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
      }}));

    const memMsg=memHits?` (${memHits} ${L('fromMemory')||'lines from memory'})`:'';
    toast(`${L('done')} · ${r.used}${memMsg}`,'ok');
    if($('sProgText')&&memHits){
      $('sProgText').textContent=`${units.length}/${units.length} (100%) · ${memHits} from memory`;
    }
  }catch(e){
    fail(e);
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
