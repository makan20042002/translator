/* ---------- UNIFIED VOICE PICKER ---------- */
const VOICE_SAMPLES={
  fa:'سلام، این یک آزمایش صدا برای مترجم ماکان است.',
  en:'Hello, this is a voice test for MAKAN Translate.',
  ar:'مرحبا، هذا اختبار للصوت.',
  tr:'Merhaba, bu bir ses testidir.',
  de:'Hallo, dies ist ein Stimmtest.',
  fr:'Bonjour, ceci est un test de voix.',
  es:'Hola, esta es una prueba de voz.'
};
function getVoiceSample(lang){
  const b=(lang||'en').split('-')[0].toLowerCase();
  return VOICE_SAMPLES[b]||VOICE_SAMPLES.en;
}
async function previewVoice(voiceVal, source, lang){
  stopSpeak();
  const sample=getVoiceSample(lang||'fa');
  if(source==='device'){
    if(!('speechSynthesis' in self))return;
    const vs=speechSynthesis.getVoices();
    const v=vs.find(x=>x.voiceURI===voiceVal)||vs.find(x=>x.lang.toLowerCase().startsWith((lang||'').toLowerCase()));
    if(!v)return;
    const u=new SpeechSynthesisUtterance(sample);
    u.voice=v;u.lang=v.lang;u.rate=cfg.tts.rate||1.0;
    speechSynthesis.speak(u);
  }else if(source==='offline'){
    const id=voiceVal.replace(/^piper:/,'');
    const m=MC.models.find(x=>x.id===id);
    if(!m||!mcReady(m)){
      toast(L('needDl'),'warn');
      return;
    }
    await playPiper(sample,++speakTok,m);
  }else if(source==='gemini'){
    const voiceName=voiceVal.replace(/^gemini:/,'');
    const key=geminiTtsKey();
    if(!key){
      toast(`${L('geminiWord')}: ${L('needKey')}`, 'warn');
      return;
    }
    await playGeminiTts(sample,lang||'fa',++speakTok,key,voiceName);
  }
}
function selectVoice(val, lang){
  const b=(lang||$('tgt')?.value||'fa').split('-')[0].toLowerCase();
  cfg.tts.voices[b]=val;
  saveCfg();
  if($('voiceSel'))$('voiceSel').value=val;
  renderUnifiedVoicePicker();
  fillVoices();
  updateCompactVoiceButtons();
  const name=val?val:L('autoVoice');
  toast(`${L('voiceUsed')}: ${name}`,'ok');
}

function getVoiceDisplayName(val, lang){
  if(!val)return L('autoVoice')||'Auto';
  if(val.startsWith('gemini:'))return L('geminiWord')+' · '+val.slice(7);
  if(val.startsWith('piper:')){
    const id=val.slice(6);
    const m=(self.MODEL_CATALOG?.models||MC?.models||[]).find(x=>x.id===id);
    return m?mcText(m.name):val;
  }
  const allDev=('speechSynthesis' in self?speechSynthesis.getVoices():[]);
  const v=allDev.find(x=>x.voiceURI===val);
  return v?v.name:val;
}

function updateCompactVoiceButtons(){
  const tLang=($('tgt')?.value||'fa').split('-')[0].toLowerCase();
  const tVal=cfg.tts?.voices?.[tLang]||'';
  const tTxt=getVoiceDisplayName(tVal,tLang);
  if($('tVoiceCurLabel'))$('tVoiceCurLabel').textContent=tTxt;
  if($('vConvVoiceCurLabel'))$('vConvVoiceCurLabel').textContent=tTxt;
  if($('vLiveVoiceCurLabel'))$('vLiveVoiceCurLabel').textContent=tTxt;

  const askL=(($('vAskLang')?.value==='auto'?$('tgt')?.value:$('vAskLang')?.value)||'fa').split('-')[0].toLowerCase();
  const askVal=cfg.tts?.voices?.[askL]||'';
  if($('vAskVoiceCurLabel'))$('vAskVoiceCurLabel').textContent=getVoiceDisplayName(askVal,askL);
  if(typeof updateVoiceReadiness === 'function') updateVoiceReadiness();
}

function toggleCompactVoicePopup(wrapId, popupId, listId, context){
  const popup=$(popupId);
  if(!popup)return;
  const isHidden=popup.hidden;
  document.querySelectorAll('.compact-voice-popup').forEach(p=>{
    p.hidden=true;
    const btn=p.parentElement?.querySelector('.compact-voice-btn');
    if(btn)btn.setAttribute('aria-expanded','false');
  });
  if(isHidden){
    popup.hidden=false;
    const btn=$(wrapId)?.querySelector('.compact-voice-btn');
    if(btn)btn.setAttribute('aria-expanded','true');
    const list=$(listId);
    if(list){
      let l=$('tgt')?.value||'fa';
      if(context==='ask'&&$('vAskLang')?.value&&$('vAskLang').value!=='auto')l=$('vAskLang').value;
      list.innerHTML=buildVoicePickerHTML(l, 'voiceRadio_'+listId);
    }
  }
}

function buildVoicePickerHTML(lang, radioName){
  const b=(lang||$('tgt')?.value||'fa').split('-')[0].toLowerCase();
  const curr=cfg.tts?.voices?.[b]||'';
  const rName=radioName||'voiceRadio';

  const allDev=('speechSynthesis' in self?speechSynthesis.getVoices():[]);
  const devVoices=[...allDev].sort((a,b)=>{
    const aFa=(a.lang||'').toLowerCase().startsWith('fa');
    const bFa=(b.lang||'').toLowerCase().startsWith('fa');
    if(aFa&&!bFa)return -1;
    if(!aFa&&bFa)return 1;
    return (a.name||'').localeCompare(b.name||'');
  });

  const pipers=(self.MODEL_CATALOG?.models||MC?.models||[]).filter(m=>m.kind==='piper');
  const sortPiper=list=>[...list].sort((a,b)=>{
    const aFa=a.lang==='fa';
    const bFa=b.lang==='fa';
    if(aFa&&!bFa)return -1;
    if(!aFa&&bFa)return 1;
    return (mcText(a.name)).localeCompare(mcText(b.name));
  });
  const dlPipers=sortPiper(pipers.filter(m=>mcReady(m)));
  const undlPipers=sortPiper(pipers.filter(m=>!mcReady(m)));
  const gemVoices=(typeof GEM_VOICES!=='undefined'?GEM_VOICES:['Kore','Puck','Charon','Fenrir','Aoede']);

  let html='';
  const isAuto=!curr;
  html+=`<div class="voice-card voice-card-auto ${isAuto?'selected':''}" data-voice="" data-lang="${esc(b)}" style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border:1px solid ${isAuto?'var(--accent)':'var(--border)'};border-radius:6px;background:${isAuto?'var(--accent-dim)':'var(--surface2)'};cursor:pointer;margin-bottom:8px">
    <div class="row" style="gap:10px;align-items:center">
      <input type="radio" name="${esc(rName)}" value="" ${isAuto?'checked':''} style="cursor:pointer">
      <div>
        <strong>${esc(L('autoVoice'))}</strong>
        <div style="font-size:12px;color:var(--muted)">${esc(L('autoVoiceDesc'))}</div>
      </div>
    </div>
    <span class="tier local">${esc(L('auto')||'Auto')}</span>
  </div>`;

  if(devVoices.length){
    html+=`<div class="voice-group" data-group="device" style="margin-bottom:12px">
      <div class="voice-group-title" style="font-size:12.5px;font-weight:700;color:var(--muted);margin:8px 0 6px">${esc(L('deviceVoicesGrp'))} (${devVoices.length})</div>
      <div class="voice-group-items" style="display:flex;flex-direction:column;gap:6px">`;
    devVoices.forEach(v=>{
      const isSel=(curr===v.voiceURI);
      const isFa=(v.lang||'').toLowerCase().startsWith('fa');
      html+=`<div class="voice-card ${isSel?'selected':''}" data-voice="${esc(v.voiceURI)}" data-source="device" data-lang="${esc(v.lang)}" style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border:1px solid ${isSel?'var(--accent)':'var(--border)'};border-radius:6px;background:${isSel?'var(--accent-dim)':'var(--surface2)'};cursor:pointer;gap:8px">
        <div class="row" style="gap:8px;align-items:center;flex:1;min-width:0">
          <input type="radio" name="${esc(rName)}" value="${esc(v.voiceURI)}" ${isSel?'checked':''} style="cursor:pointer">
          <div style="min-width:0">
            <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(v.name)}${isFa?' 🇮🇷':''}</div>
            <div style="font-size:11.5px;color:var(--muted)">
              <span>${esc(langName(v.lang))}</span> · <span>${esc(L('voiceDevice'))}</span>
            </div>
          </div>
        </div>
        <div class="row" style="gap:6px;align-items:center">
          <button class="btn ghost btn-preview-voice" type="button" data-act="preview" data-voice="${esc(v.voiceURI)}" data-source="device" data-lang="${esc(v.lang)}" style="padding:2px 8px;font-size:11.5px">▶ ${esc(L('previewVoice'))}</button>
        </div>
      </div>`;
    });
    html+=`</div></div>`;
  }

  if(dlPipers.length){
    html+=`<div class="voice-group" data-group="offline-downloaded" style="margin-bottom:12px">
      <div class="voice-group-title" style="font-size:12.5px;font-weight:700;color:var(--muted);margin:8px 0 6px">${esc(L('offlineVoicesGrp'))} (${dlPipers.length})</div>
      <div class="voice-group-items" style="display:flex;flex-direction:column;gap:6px">`;
    dlPipers.forEach(m=>{
      const vVal='piper:'+m.id;
      const isSel=(curr===vVal);
      html+=`<div class="voice-card ${isSel?'selected':''}" data-voice="${esc(vVal)}" data-source="offline" data-lang="${esc(m.lang)}" style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border:1px solid ${isSel?'var(--accent)':'var(--border)'};border-radius:6px;background:${isSel?'var(--accent-dim)':'var(--surface2)'};cursor:pointer;gap:8px">
        <div class="row" style="gap:8px;align-items:center;flex:1;min-width:0">
          <input type="radio" name="${esc(rName)}" value="${esc(vVal)}" ${isSel?'checked':''} style="cursor:pointer">
          <div style="min-width:0">
            <div style="font-weight:600;font-size:13px">${esc(mcText(m.name))}</div>
            <div style="font-size:11.5px;color:var(--muted)">
              <span>${esc(langName(m.lang))}</span> · <span>${esc(L('voiceOffline'))}</span>
            </div>
          </div>
        </div>
        <div class="row" style="gap:6px;align-items:center">
          <button class="btn ghost btn-preview-voice" type="button" data-act="preview" data-voice="${esc(vVal)}" data-source="offline" data-lang="${esc(m.lang)}" style="padding:2px 8px;font-size:11.5px">▶ ${esc(L('previewVoice'))}</button>
        </div>
      </div>`;
    });
    html+=`</div></div>`;
  }

  if(undlPipers.length){
    html+=`<div class="voice-group" data-group="offline-available" style="margin-bottom:12px">
      <div class="voice-group-title" style="font-size:12.5px;font-weight:700;color:var(--muted);margin:8px 0 6px">${esc(L('offlineVoicesAvailable'))} (${undlPipers.length})</div>
      <div class="voice-group-items" style="display:flex;flex-direction:column;gap:6px">`;
    undlPipers.forEach(m=>{
      const vVal='piper:'+m.id;
      const isBusy=!!mcDownloading[m.id];
      html+=`<div class="voice-card" data-voice="${esc(vVal)}" data-source="offline" data-lang="${esc(m.lang)}" style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);gap:8px">
        <div class="row" style="gap:8px;align-items:center;flex:1;min-width:0">
          <div style="min-width:0">
            <div style="font-weight:600;font-size:13px">${esc(mcText(m.name))}</div>
            <div style="font-size:11.5px;color:var(--muted)">
              <span>${esc(langName(m.lang))}</span> · <span>${esc(L('offline'))}</span> · <span>${esc(mcSize(m.bytes))}</span>
            </div>
          </div>
        </div>
        <div class="row" style="gap:6px;align-items:center">
          <button class="btn btn-dl-voice" type="button" data-act="dl-piper" data-id="${esc(m.id)}" ${isBusy?'disabled':''} style="padding:2px 10px;font-size:11.5px">${esc(isBusy?L('mdlDownloading'):L('download'))}</button>
          <button class="btn ghost btn-preview-voice" type="button" data-act="preview" data-voice="${esc(vVal)}" data-source="offline" data-lang="${esc(m.lang)}" style="padding:2px 8px;font-size:11.5px">▶ ${esc(L('previewVoice'))}</button>
        </div>
      </div>`;
    });
    html+=`</div></div>`;
  }

  if(gemVoices.length){
    html+=`<div class="voice-group" data-group="gemini" style="margin-bottom:12px">
      <div class="voice-group-title" style="font-size:12.5px;font-weight:700;color:var(--muted);margin:8px 0 6px">${esc(L('geminiVoicesGrp'))} (${gemVoices.length})</div>
      <div class="voice-group-items" style="display:flex;flex-direction:column;gap:6px">`;
    gemVoices.forEach(n=>{
      const vVal='gemini:'+n;
      const isSel=(curr===vVal);
      html+=`<div class="voice-card ${isSel?'selected':''}" data-voice="${esc(vVal)}" data-source="gemini" data-lang="fa" style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border:1px solid ${isSel?'var(--accent)':'var(--border)'};border-radius:6px;background:${isSel?'var(--accent-dim)':'var(--surface2)'};cursor:pointer;gap:8px">
        <div class="row" style="gap:8px;align-items:center;flex:1;min-width:0">
          <input type="radio" name="${esc(rName)}" value="${esc(vVal)}" ${isSel?'checked':''} style="cursor:pointer">
          <div style="min-width:0">
            <div style="font-weight:600;font-size:13px">${esc(L('geminiWord'))} · ${esc(n)}</div>
            <div style="font-size:11.5px;color:var(--muted)">
              <span>${esc(langName('fa'))} / 130+</span> · <span>${esc(L('geminiWord'))}</span>
            </div>
          </div>
        </div>
        <div class="row" style="gap:6px;align-items:center">
          <button class="btn ghost btn-preview-voice" type="button" data-act="preview" data-voice="${esc(vVal)}" data-source="gemini" data-lang="fa" style="padding:2px 8px;font-size:11.5px">▶ ${esc(L('previewVoice'))}</button>
        </div>
      </div>`;
    });
    html+=`</div></div>`;
  }

  return html;
}

function renderUnifiedVoicePicker(){
  const wrap=$('voicePickerList');
  if(wrap){
    wrap.innerHTML=buildVoicePickerHTML($('tgt')?.value||'fa', 'voiceRadio');
  }
  document.querySelectorAll('.compact-voice-popup:not([hidden]) .voice-picker-list').forEach(c=>{
    const ctx=c.dataset.context;
    let l=$('tgt')?.value||'fa';
    if(ctx==='ask'&&$('vAskLang')?.value&&$('vAskLang').value!=='auto')l=$('vAskLang').value;
    c.innerHTML=buildVoicePickerHTML(l, 'voiceRadio_'+c.id);
  });
  updateCompactVoiceButtons();
}
if(typeof document!=='undefined'){
  document.addEventListener('click',async e=>{
    const micSttBtn=e.target.closest('#vMicSttBtn');
    if(micSttBtn){
      e.stopPropagation();
      const pop=$('vMicSttPopup');
      if(pop){
        const isHidden=pop.hidden;
        document.querySelectorAll('.compact-voice-popup').forEach(p=>{
          p.hidden=true;
          const btn=p.parentElement?.querySelector('.compact-voice-btn, #vMicSttBtn');
          if(btn)btn.setAttribute('aria-expanded','false');
        });
        if(isHidden){
          pop.hidden=false;
          micSttBtn.setAttribute('aria-expanded','true');
          const list=$('vMicSttList');
          if(list)list.innerHTML=renderSttPickerListHTML();
        }
      }
      return;
    }
    const trigBtn=e.target.closest('.compact-voice-picker-wrap .compact-voice-btn');
    if(trigBtn){
      e.stopPropagation();
      const wrap=trigBtn.closest('.compact-voice-picker-wrap');
      const popup=wrap?.querySelector('.compact-voice-popup');
      const list=popup?.querySelector('.voice-picker-list');
      if(wrap&&popup&&list){
        toggleCompactVoicePopup(wrap.id, popup.id, list.id, list.dataset.context);
      }
      return;
    }
    if(!e.target.closest('.compact-voice-picker-wrap') && !e.target.closest('.v-mic-stt-picker-wrap')){
      document.querySelectorAll('.compact-voice-popup').forEach(p=>{
        p.hidden=true;
        const btn=p.parentElement?.querySelector('.compact-voice-btn, #vMicSttBtn');
        if(btn)btn.setAttribute('aria-expanded','false');
      });
    }
    const prevBtn=e.target.closest('.voice-picker-list [data-act="preview"]');
    if(prevBtn){
      e.stopPropagation();
      await previewVoice(prevBtn.dataset.voice,prevBtn.dataset.source,prevBtn.dataset.lang);
      return;
    }
    const dlBtn=e.target.closest('.voice-picker-list [data-act="dl-piper"]');
    if(dlBtn){
      e.stopPropagation();
      const m=MC.models.find(x=>x.id===dlBtn.dataset.id);
      if(m){
        await mcDownload(m);
        renderUnifiedVoicePicker();
      }
      return;
    }
    const card=e.target.closest('.voice-picker-list .voice-card');
    if(card){
      const val=card.dataset.voice||'';
      const lang=card.dataset.lang||$('tgt')?.value;
      selectVoice(val,lang);
      const pop=card.closest('.compact-voice-popup');
      if(pop){
        pop.hidden=true;
        const btn=pop.parentElement?.querySelector('.compact-voice-btn');
        if(btn)btn.setAttribute('aria-expanded','false');
      }
    }
    const sttDlBtn=e.target.closest('#vMicSttList [data-act="dl-whisper"]');
    if(sttDlBtn){
      e.stopPropagation();
      const m=MC.models.find(x=>x.id===sttDlBtn.dataset.id);
      if(m){
        await mcDownload(m);
        updateSttPickerDisplay();
      }
      return;
    }
    const sttDlHelperBtn=e.target.closest('#vMicSttList [data-act="dl-helper-model"]');
    if(sttDlHelperBtn){
      e.stopPropagation();
      const mId=sttDlHelperBtn.dataset.helperModel;
      if(mId){
        selectSttChoice('helper', null, mId);
        sttDlHelperBtn.disabled=true;
        const oldText=sttDlHelperBtn.textContent;
        sttDlHelperBtn.textContent='⏳ ...';
        await downloadHelperModel(mId);
        sttDlHelperBtn.disabled=false;
        sttDlHelperBtn.textContent='✅ Ready';
        setTimeout(()=>{ if(sttDlHelperBtn) sttDlHelperBtn.textContent=oldText; }, 3000);
        updateSttPickerDisplay();
      }
      return;
    }
    const sttCard=e.target.closest('#vMicSttList .voice-card');
    if(sttCard && sttCard.dataset.stt){
      selectSttChoice(sttCard.dataset.stt, sttCard.dataset.whisper, sttCard.dataset.helperModel);
      const pop=$('vMicSttPopup');
      if(pop){
        pop.hidden=true;
        $('vMicSttBtn')?.setAttribute('aria-expanded','false');
      }
      return;
    }
  });
}

function getSttCurName(){
  const curStt=cfg.stt||'auto';
  if(curStt==='auto')return L('sttAuto')?L('sttAuto').split(' ')[0]:'Auto';
  if(curStt==='browser')return 'Browser';
  if(curStt==='gemini')return 'Gemini';
  if(curStt==='groq')return 'Groq Whisper';
  if(curStt==='helper'){
    const hm=cfg.helperModel||'whisper-large-v3';
    if(hm==='qwen3-asr') return 'Qwen3-ASR (Helper)';
    if(hm==='whisper-large-v3-turbo') return 'Whisper Turbo (Helper)';
    return 'Whisper L3 (Helper)';
  }
  if(curStt==='whisper'){
    const wKey=cfg.whisper||'auto';
    const m=(self.MODEL_CATALOG?.models||MC?.models||[]).find(x=>x.kind==='whisper'&&x.key===wKey);
    return m?mcText(m.name):('Whisper '+(wKey==='auto'?'Auto':wKey));
  }
  return curStt;
}

function renderSttPickerListHTML(){
  const curStt=cfg.stt||'auto';
  const curWh=cfg.whisper||'auto';
  const isAuto=(curStt==='auto');

  let html='';
  html+=`<div class="voice-group" data-group="auto-stt" style="margin-bottom:8px">
    <div class="voice-group-title" style="padding:4px 8px 2px;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px">${esc(L('autoVoice')||'Auto')}</div>
    <div class="voice-card voice-card-auto ${isAuto?'selected':''}" data-stt="auto" style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border:1px solid ${isAuto?'var(--accent)':'var(--border)'};border-radius:6px;background:${isAuto?'var(--accent-dim)':'var(--surface2)'};cursor:pointer">
      <div class="row" style="gap:10px;align-items:center">
        <input type="radio" name="sttRadio" value="auto" ${isAuto?'checked':''} style="cursor:pointer">
        <div>
          <strong>${esc(L('sttAuto')||'Auto (best available)')}</strong>
          <div style="font-size:12px;color:var(--muted)">${isOff()?(esc(L('offMode'))+' · Whisper'):'Groq / Gemini / Browser / Whisper'}</div>
        </div>
      </div>
      <span class="badge" style="font-size:11px">Auto</span>
    </div>
  </div>`;

  const whisperModels=(self.MODEL_CATALOG?.models||MC?.models||[]).filter(m=>m.kind==='whisper');
  html+=`<div class="voice-group" data-group="offline-whisper" style="margin-bottom:10px">
    <div class="voice-group-title" style="padding:4px 8px;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px">${esc(L('offH')||'Offline')} · Whisper</div>
    <div style="display:flex;flex-direction:column;gap:6px">`;

  for(const m of whisperModels){
    const ready=mcReady(m);
    const isSel=(curStt==='whisper'&&curWh===m.key);
    const sz=mcSize(hasWebGpu&&m.gpuBytes?m.gpuBytes:m.bytes);
    if(ready){
      html+=`<div class="voice-card ${isSel?'selected':''}" data-stt="whisper" data-whisper="${esc(m.key)}" data-status="ready" style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border:1px solid ${isSel?'var(--accent)':'var(--border)'};border-radius:6px;background:${isSel?'var(--accent-dim)':'var(--surface2)'};cursor:pointer;gap:8px">
        <div class="row" style="gap:8px;align-items:center;flex:1;min-width:0">
          <input type="radio" name="sttRadio" value="whisper:${esc(m.key)}" ${isSel?'checked':''} style="cursor:pointer">
          <div style="min-width:0">
            <div style="font-weight:600;font-size:13px">${esc(mcText(m.name))}</div>
            <div style="font-size:11.5px;color:var(--muted)">${esc(sz)} · 99 langs (Fa, En…)</div>
          </div>
        </div>
        <span class="badge" style="font-size:11px;background:var(--surface3);color:var(--fg)">${esc(L('offMode')||'Offline')}</span>
      </div>`;
    }else{
      html+=`<div class="voice-card voice-card-undl" data-whisper="${esc(m.key)}" data-status="available" style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);opacity:0.9;gap:8px">
        <div class="row" style="gap:8px;align-items:center;flex:1;min-width:0">
          <div style="min-width:0">
            <div style="font-weight:600;font-size:13px">${esc(mcText(m.name))}</div>
            <div style="font-size:11.5px;color:var(--muted)">${esc(sz)} · ${esc(L('notDownloaded')||'Not downloaded')}</div>
          </div>
        </div>
        <div class="row" style="gap:4px;align-items:center">
          <span class="badge" style="font-size:11px;background:var(--surface3);color:var(--muted)">${esc(L('offMode')||'Offline')}</span>
          <button class="btn ghost btn-sm" type="button" data-act="dl-whisper" data-id="${esc(m.id)}" title="${esc(L('dlBtn')||'Download')}" style="padding:2px 8px;font-size:11.5px;white-space:nowrap">
            ⬇️ ${esc(L('dlBtn')||'Download')}
          </button>
        </div>
      </div>`;
    }
  }
  html+=`</div></div>`;

  const onlineOpts=[
    { id:'browser', name:L('sttBrowser')||'Browser (online)', desc:'Web Speech API' },
    { id:'gemini', name:L('sttGemini')||'Gemini (online)', desc:'Google Gemini API' },
    { id:'groq', name:L('sttGroq')||'Groq Whisper', desc:'Cloud Whisper API' }
  ];
  html+=`<div class="voice-group" data-group="online-stt" style="margin-bottom:6px">
    <div class="voice-group-title" style="padding:4px 8px;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px">آنلاین / Online</div>
    <div style="display:flex;flex-direction:column;gap:6px">`;

  for(const o of onlineOpts){
    const isSel=(curStt===o.id);
    html+=`<div class="voice-card ${isSel?'selected':''}" data-stt="${esc(o.id)}" style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border:1px solid ${isSel?'var(--accent)':'var(--border)'};border-radius:6px;background:${isSel?'var(--accent-dim)':'var(--surface2)'};cursor:pointer;gap:8px">
      <div class="row" style="gap:8px;align-items:center;flex:1;min-width:0">
        <input type="radio" name="sttRadio" value="${esc(o.id)}" ${isSel?'checked':''} style="cursor:pointer">
        <div style="min-width:0">
          <div style="font-weight:600;font-size:13px">${esc(o.name)}</div>
          <div style="font-size:11.5px;color:var(--muted)">${esc(o.desc)}</div>
        </div>
      </div>
      <span class="badge" style="font-size:11px;background:var(--surface3);color:var(--fg)">Online</span>
    </div>`;
  }
  html+=`</div></div>`;

  const helperOpts=[
    { id:'whisper-large-v3', name:'Whisper large-v3', desc:'OpenAI Whisper Large v3 (Local Helper)' },
    { id:'whisper-large-v3-turbo', name:'Whisper large-v3-turbo', desc:'Whisper Large v3 Turbo (Local Helper)' },
    { id:'qwen3-asr', name:'Qwen3-ASR', desc:'Qwen Speech/ASR (Local Helper)' }
  ];
  html+=`<div class="voice-group" data-group="helper-asr" style="margin-bottom:6px">
    <div class="voice-group-title" style="padding:4px 8px;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px">دستیار پایتون / Python ASR Helper</div>
    <div style="display:flex;flex-direction:column;gap:6px">`;

  for(const h of helperOpts){
    const isSel=(curStt==='helper' && (cfg.helperModel||'whisper-large-v3')===h.id);
    html+=`<div class="voice-card ${isSel?'selected':''}" data-stt="helper" data-helper-model="${esc(h.id)}" style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border:1px solid ${isSel?'var(--accent)':'var(--border)'};border-radius:6px;background:${isSel?'var(--accent-dim)':'var(--surface2)'};cursor:pointer;gap:8px">
      <div class="row" style="gap:8px;align-items:center;flex:1;min-width:0">
        <input type="radio" name="sttRadio" value="helper:${esc(h.id)}" ${isSel?'checked':''} style="cursor:pointer">
        <div style="min-width:0">
          <div style="font-weight:600;font-size:13px">${esc(h.name)}</div>
          <div style="font-size:11.5px;color:var(--muted)">${esc(h.desc)}</div>
        </div>
      </div>
      <div class="row" style="gap:6px;align-items:center">
        <button class="btn btn-xs" data-act="dl-helper-model" data-helper-model="${esc(h.id)}" style="font-size:11px;padding:3px 7px" title="Download & Load into memory">⚡ Load</button>
        <span class="badge" style="font-size:11px;background:var(--surface3);color:var(--fg)">Helper</span>
      </div>
    </div>`;
  }
  html+=`</div></div>`;

  return html;
}

function selectSttChoice(stt, whisperKey, helperModel){
  cfg.stt = stt;
  if(stt === 'whisper' && whisperKey){
    cfg.whisper = whisperKey;
  }
  if(stt === 'helper' && helperModel){
    cfg.helperModel = helperModel;
  }
  saveCfg();
  if($('sttSel')) $('sttSel').value = cfg.stt;
  if($('vSttChoice')) $('vSttChoice').value = cfg.stt;
  if($('offWhisperSel') && stt === 'whisper' && whisperKey){
    $('offWhisperSel').value = whisperKey;
  }
  if($('helperModelSel') && stt === 'helper' && helperModel){
    $('helperModelSel').value = helperModel;
  }
  if(typeof updateHelperSettingsVisibility === 'function') updateHelperSettingsVisibility();
  if(typeof mcRender === 'function') mcRender();
  if(typeof voiceLabels === 'function') voiceLabels();
  if(typeof updateVoiceAutoEngineDisplay === 'function') updateVoiceAutoEngineDisplay();
  updateSttPickerDisplay();
}

function updateSttPickerDisplay(){
  const lbl=$('vMicSttCurLabel');
  if(lbl)lbl.textContent=getSttCurName();
  const list=$('vMicSttList');
  if(list && !$('vMicSttPopup')?.hidden){
    list.innerHTML=renderSttPickerListHTML();
  }
  if(typeof updateVoiceReadiness === 'function') updateVoiceReadiness();
}

/* voice + offline settings */
function fillVoices(){
  const b=$('tgt').value.split('-')[0].toLowerCase(),vs=('speechSynthesis' in self?speechSynthesis.getVoices():[]).filter(v=>v.lang.toLowerCase().startsWith(b));
  $('voiceLbl').textContent=`${L('voiceFor')} ${langShort($('tgt').value)}`;
  // Automatic (default), every device voice for this language, then the Gemini voices.
  $('voiceSel').innerHTML=`<option value="">${esc(L('autoVoice'))} · ${vs.length}</option>`
    +(vs.length?`<optgroup label="${esc(L('deviceVoicesGrp'))}">`+vs.map(v=>`<option value="${esc(v.voiceURI)}">${esc(v.name)}</option>`).join('')+'</optgroup>':'')
    +`<optgroup label="${esc(L('geminiVoicesGrp'))}">`+GEM_VOICES.map(n=>`<option value="gemini:${n}">${L('geminiWord')} · ${n}</option>`).join('')+'</optgroup>'
    +(piperVoices().filter(m=>m.lang===b).length?`<optgroup label="${esc(L('offlineVoicesGrp'))}">`+piperVoices().filter(m=>m.lang===b).map(m=>`<option value="piper:${m.id}">${esc(mcText(m.name))}</option>`).join('')+'</optgroup>':'');
  $('voiceSel').value=cfg.tts.voices[b]||'';if($('voiceSel').selectedIndex<0)$('voiceSel').value='';
  renderUnifiedVoicePicker();
}
let hasWebGpu=null;
async function checkWebGpu(){
  if(hasWebGpu!==null)return hasWebGpu;
  try{
    hasWebGpu='gpu' in navigator && !!(await navigator.gpu?.requestAdapter().catch(()=>null));
  }catch{hasWebGpu=false}
  return hasWebGpu;
}
async function offStatus(){
  $('offBtn').classList.toggle('on',isOff());$('offBtn').querySelector('.dot').classList.toggle('ok',isOff());
  if(store.get('nllb')&&(!cfg.trModel||cfg.trModel==='auto')){cfg.trModel='tr-nllb-600';saveCfg()}
  if(store.get('whisper')&&(!cfg.whisper||cfg.whisper==='auto')){cfg.whisper=store.get('whisper');saveCfg()}
  mcRender();
  await Promise.all([mcScan(),checkWebGpu()]);       // what is stored, and whether WebGPU exists (it changes the download size)
  mcRender();fillEngines();if(typeof updateStatusPill==='function')updateStatusPill();
}
function renderVoice(){
  $('sttSel').value=cfg.stt;
  if($('vSttChoice'))$('vSttChoice').value=cfg.stt;
  $('ttsMode').value=cfg.tts.mode;
  if($('ttsSpeed'))$('ttsSpeed').value=String(cfg.tts.rate||1.0);
  if($('vSpeed'))$('vSpeed').value=String(cfg.tts.rate||1.0);
  const isDev=cfg.tts.mode==='device';
  if($('voiceLblWrap'))$('voiceLblWrap').hidden=!isDev;
  $('ttsApi').hidden=isDev;
  const isGemini=cfg.tts.mode==='gemini',isOpenAi=cfg.tts.mode==='openai';
  if($('ttsBaseWrap'))$('ttsBaseWrap').hidden=isGemini||isOpenAi;
  const kInput=$('tts_key');
  if(kInput){
    if(isGemini)kInput.placeholder=L('key')+' ('+(cfg.eng.gemini.key?'using Gemini engine key':'leave empty to use engine key')+')';
    else if(isOpenAi)kInput.placeholder=L('key')+' ('+(cfg.eng.openai.key?'using OpenAI engine key':'leave empty to use engine key')+')';
    else kInput.placeholder=L('key');
  }
  const hEl=$('ttsHint');
  if(hEl){
    if(isGemini)hEl.textContent='Google Gemini TTS: high quality speech in 130 languages using a speech model that your key can use (picked automatically). Voices: Kore, Puck, Charon, Fenrir, Aoede.';
    else if(isOpenAi)hEl.textContent='OpenAI TTS: high quality speech in 57+ languages using tts-1 or tts-1-hd. Voices: alloy, ash, coral, echo, fable, onyx, nova, sage, shimmer.';
    else hEl.textContent=L('ttsHint');
  }
  ['base','key','model','voice'].forEach(k=>{if($('tts_'+k))$('tts_'+k).value=cfg.tts[k]||''});
  document.querySelectorAll('select#vSilenceWait').forEach(el=>{el.value=String(cfg.silenceWait||800)});
  fillVoices();offStatus();
  updateHelperSettingsVisibility();
  if(typeof updateSttPickerDisplay==='function')updateSttPickerDisplay();
}
function updateHelperSettingsVisibility(){
  const wrap=$('helperSettingsWrap');
  if(!wrap)return;
  wrap.hidden=(cfg.stt!=='helper');
  if(!wrap.hidden){
    if($('helperModelSel'))$('helperModelSel').value=cfg.helperModel||'whisper-large-v3';
    if($('helperUrlInput'))$('helperUrlInput').value=cfg.helperUrl||'http://127.0.0.1:8765';
  }
}
async function checkHelperConnection(){
  const msgEl=$('helperStatusMsg');
  const url=($('helperUrlInput')?.value||cfg.helperUrl||'http://127.0.0.1:8765').replace(/\/+$/, '');
  if(msgEl){msgEl.textContent='...';msgEl.style.color='var(--muted)';}
  try{
    const res=await fx(url+'/health');
    if(msgEl){
      msgEl.textContent='✅ '+L('helperConnected')+(res.loaded_model?` (${res.loaded_model})`:'');
      msgEl.style.color='var(--accent)';
    }
    return true;
  }catch(err){
    if(msgEl){
      msgEl.textContent='⚠️ '+L('helperOffline');
      msgEl.style.color='var(--err)';
    }
    return false;
  }
}
if($('helperModelSel')) $('helperModelSel').onchange=()=>{cfg.helperModel=$('helperModelSel').value;saveCfg();if(typeof updateSttPickerDisplay==='function')updateSttPickerDisplay()};
if($('helperUrlInput')) $('helperUrlInput').onchange=()=>{cfg.helperUrl=$('helperUrlInput').value.trim()||'http://127.0.0.1:8765';saveCfg()};
if($('btnCheckHelper')) $('btnCheckHelper').onclick=checkHelperConnection;
async function downloadHelperModel(overrideModel){
  const msgEl=$('helperStatusMsg');
  const url=($('helperUrlInput')?.value||cfg.helperUrl||'http://127.0.0.1:8765').replace(/\/+$/, '');
  const model=overrideModel||$('helperModelSel')?.value||cfg.helperModel||'whisper-large-v3';
  if(overrideModel){
    cfg.helperModel=overrideModel;
    saveCfg();
    if($('helperModelSel')) $('helperModelSel').value=overrideModel;
  }
  if(msgEl){
    msgEl.textContent='⏳ Downloading & loading model "'+model+'"... (First run may take a few minutes)';
    msgEl.style.color='var(--muted)';
  }
  try{
    const res=await fx(url+'/v1/models/load',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model})
    });
    if(res && res.status==='loaded'){
      if(msgEl){
        msgEl.textContent='✅ Model "'+model+'" is downloaded & loaded in memory! (Cache: ~/.cache/huggingface/hub/)';
        msgEl.style.color='var(--accent)';
      }
    }else{
      if(msgEl){
        msgEl.textContent='⚠️ Helper response: '+JSON.stringify(res);
        msgEl.style.color='var(--warn)';
      }
    }
  }catch(err){
    if(msgEl){
      msgEl.textContent='⚠️ Failed to load model: '+(err.message||err)+'. Ensure helper server is running (python helper/run.py or desktop app).';
      msgEl.style.color='var(--err)';
    }
  }
}
if($('btnDownloadHelperModel')) $('btnDownloadHelperModel').onclick=downloadHelperModel;
if('speechSynthesis' in self)speechSynthesis.onvoiceschanged=()=>{fillVoices();if(typeof renderUnifiedVoicePicker==='function')renderUnifiedVoicePicker()};
$('sttSel').onchange=()=>{cfg.stt=$('sttSel').value;saveCfg();if($('vSttChoice'))$('vSttChoice').value=cfg.stt;updateHelperSettingsVisibility();voiceLabels();if(typeof updateSttPickerDisplay==='function')updateSttPickerDisplay()};
document.querySelectorAll('select#vSilenceWait').forEach(el=>{
  el.onchange=()=>{
    cfg.silenceWait=+el.value||800;
    saveCfg();
    document.querySelectorAll('select#vSilenceWait').forEach(other=>{other.value=String(cfg.silenceWait)});
  };
});
$('ttsMode').onchange=()=>{
  // The voice key box belongs to one voice provider; never carry it over to another one.
  if(cfg.tts.mode!==$('ttsMode').value)cfg.tts.key='';
  cfg.tts.mode=$('ttsMode').value;
  if(cfg.tts.mode==='gemini'){cfg.tts.model='gemini-2.5-flash-preview-tts';if(!cfg.tts.voice||!['Kore','Puck','Charon','Fenrir','Aoede'].includes(cfg.tts.voice))cfg.tts.voice='Kore'}
  else if(cfg.tts.mode==='openai'){if(!cfg.tts.model)cfg.tts.model='tts-1';if(!cfg.tts.voice)cfg.tts.voice='alloy'}
  saveCfg();renderVoice();
};
if($('ttsSpeed'))$('ttsSpeed').onchange=()=>{
  cfg.tts.rate=+$('ttsSpeed').value||1.0;saveCfg();
  if($('vSpeed'))$('vSpeed').value=String(cfg.tts.rate);
};
$('voiceSel').onchange=()=>{cfg.tts.voices[$('tgt').value.split('-')[0].toLowerCase()]=$('voiceSel').value;saveCfg();if(typeof renderUnifiedVoicePicker==='function')renderUnifiedVoicePicker()};
['base','key','model','voice'].forEach(k=>{if($('tts_'+k))$('tts_'+k).onchange=()=>{cfg.tts[k]=$('tts_'+k).value.trim();saveCfg()}});
const TTS_PRE={
  gemini:{mode:'gemini',base:'',model:'gemini-2.5-flash-preview-tts',voice:'Kore'},
  openai:{mode:'openai',base:'https://api.openai.com/v1',model:'tts-1',voice:'alloy'},
  sesame:{mode:'api',base:'http://localhost:8000/v1',model:'csm-1b',voice:'alloy'}
};
$('ttsPre').onchange=()=>{const p=TTS_PRE[$('ttsPre').value];if(p){cfg.tts.key='';Object.assign(cfg.tts,p);saveCfg();renderVoice()}};
$('ttsTest').onclick=()=>{const t=$('tgt').value,smp={fa:'سلام، این یک آزمایش صدا برای مترجم ماکان است.',ar:'مرحبا، هذا اختبار للصوت.',tr:'Merhaba, bu bir ses testidir.',de:'Hallo, dies ist ein Stimmtest.',fr:'Bonjour, ceci est un test de voix.',es:'Hola, esta es una prueba de voz.'};speak.last='';speak(smp[t]||'Hello, this is a voice test for MAKAN Translate.',smp[t]?t:'en')};
$('offBtn').onclick=()=>{cfg.offline=!cfg.offline;saveCfg();fillEngines();offStatus();voiceLabels();if(typeof renderTextStatusStrip==='function')renderTextStatusStrip()};
addEventListener('online',()=>{fillEngines();offStatus();if(typeof renderTextStatusStrip==='function')renderTextStatusStrip()});addEventListener('offline',()=>{fillEngines();offStatus();if(typeof renderTextStatusStrip==='function')renderTextStatusStrip()});
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});
