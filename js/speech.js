/* ----- text to speech ----- */
let speakTok=0,curAudio=null;const noVoiceTold={};
const geminiTtsCache=new Map();
function getGeminiTtsCacheKey(text,voice='Kore',rate=1.0,model='gemini'){
  return `${model}|${voice}|${rate}|${String(text||'').trim()}`;
}
function splitIntoSentences(text){
  const str=String(text||'').replace(/\s*\n+\s*/g,' \n ').trim();
  if(!str)return[];
  const sentences=[];
  const re=/[^.!?؟؛\n]+(?:[.!?؟؛\n]+|$)/gu;
  let match;
  while((match=re.exec(str))!==null){
    const s=match[0].trim();
    if(s)sentences.push(s);
  }
  if(sentences.length<=1&&str.length>220){
    const clauseRe=/[^,،؛:\n]+(?:[,،؛:\n]+|$)/gu;
    const sub=[];
    while((match=clauseRe.exec(str))!==null){
      const c=match[0].trim();
      if(c)sub.push(c);
    }
    if(sub.length>1)return sub;
  }
  return sentences.length>0?sentences:[str];
}
function updateSpeakUI(state){
  const on=!!state;
  const isPrep=state==='preparing';
  const elA=$('vStopSpeak'),elB=$('vAskStopSpeak');
  if(elA)elA.hidden=!on;if(elB)elB.hidden=!on;
  const tBtn=$('tSpeak');
  if(tBtn){
    if(isPrep){
      tBtn.classList.add('preparing');tBtn.classList.remove('playing');
      tBtn.textContent=L('stop')||'Stop';
      tBtn.title='Preparing voice... (Click to stop)';
    }else if(on){
      tBtn.classList.remove('preparing');tBtn.classList.add('playing');
      tBtn.textContent=L('stop')||'Stop';
      tBtn.title=L('stop')||'Stop';
    }else{
      tBtn.classList.remove('preparing','playing');
      tBtn.textContent=L('speak')||'Speak';
      tBtn.title=L('speak')||'Speak';
    }
  }
  if(typeof setVoiceState==='function'){
    if(isPrep)setVoiceState('preparing');
    else if(on)setVoiceState('speaking');
    else if(voiceState==='speaking'||voiceState==='preparing')setVoiceState('ready');
  }
}
let appStreamPlayer = null;
let appAbortController = null;
let appAudioContext = null;

function getOrCreateAppAudioContext() {
  if (!appAudioContext || appAudioContext.state === 'closed') {
    const AudioCtx = self.AudioContext || self.webkitAudioContext;
    if (AudioCtx) appAudioContext = new AudioCtx({ sampleRate: 24000 });
  }
  if (appAudioContext && appAudioContext.state === 'suspended') {
    appAudioContext.resume().catch(() => {});
  }
  return appAudioContext;
}

function stopSpeak(){
  speakTok++;
  try{if('speechSynthesis' in self)speechSynthesis.cancel()}catch{}
  if(appAbortController){try{appAbortController.abort()}catch{}appAbortController=null}
  if(appStreamPlayer){try{appStreamPlayer.stop()}catch{}appStreamPlayer=null}
  if(curAudio){try{curAudio.pause()}catch{}curAudio=null}
  updateSpeakUI(false);
}
function pcmToWav(pcmBytes,sampleRate=24000,numChannels=1){
  const header=new ArrayBuffer(44),view=new DataView(header),totalDataLen=pcmBytes.byteLength;
  const writeStr=(offset,str)=>{for(let i=0;i<str.length;i++)view.setUint8(offset+i,str.charCodeAt(i))};
  writeStr(0,'RIFF');view.setUint32(4,totalDataLen+36,true);writeStr(8,'WAVE');writeStr(12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,numChannels,true);
  view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*numChannels*2,true);
  view.setUint16(32,numChannels*2,true);view.setUint16(34,16,true);writeStr(36,'data');
  view.setUint32(40,totalDataLen,true);
  return new Blob([header,pcmBytes],{type:'audio/wav'});
}
const GEM_VOICES=['Kore','Puck','Charon','Fenrir','Aoede'];
async function playGeminiTts(text,lang,tok,key,voiceOverride){
  let model=cfg.tts.model||'gemini-2.5-flash-preview-tts',voice=GEM_VOICES.includes(voiceOverride)?voiceOverride:(GEM_VOICES.includes(cfg.tts.voice)?cfg.tts.voice:'Kore');
  const rate=cfg.tts.rate||1.0;

  // 1. Session Cache check for instant replay
  const cacheKey = (typeof getTtsCacheKey === 'function') ? getTtsCacheKey(text, voice, rate, model) : `${model}|${voice}|${rate}|${text}`;
  const sessionCached = (typeof ttsSessionCache !== 'undefined') ? ttsSessionCache.get(cacheKey) : null;
  if(sessionCached?.dataUrl){
    updateSpeakUI('speaking');
    const a=curAudio=new Audio(sessionCached.dataUrl);if(rate)a.playbackRate=rate;
    await new Promise((res)=>{
      const end=()=>{if(curAudio===a)curAudio=null;res()};
      a.onended=end;a.onpause=end;a.onerror=end;
      a.play().catch(end);
    });
    return;
  }

  // 2. Web Audio streaming with AudioContext (autoplay met via click gesture)
  if (typeof GeminiAudioStreamPlayer !== 'undefined' && typeof streamGeminiTts === 'function') {
    const audioCtx = getOrCreateAppAudioContext();
    updateSpeakUI('preparing');
    appAbortController = new AbortController();
    const player = new GeminiAudioStreamPlayer({
      rate,
      sampleRate: 24000,
      audioCtx,
      onFirstSound: () => {
        if (tok === speakTok) updateSpeakUI('speaking');
      },
      onEnded: () => {
        if (tok === speakTok) {
          appStreamPlayer = null;
          updateSpeakUI(false);
        }
      }
    });
    appStreamPlayer = player;

    try {
      await streamGeminiTts(text, key, {
        voice,
        rate,
        model,
        player,
        signal: appAbortController.signal,
        fallback: false
      });
      await new Promise(resolve => {
        const checkDone = () => {
          if (tok !== speakTok || (player.streamDone && player.activeSources.size === 0)) {
            appStreamPlayer = null;
            resolve();
          }
        };
        player.onEnded = checkDone;
        setTimeout(checkDone, 80);
      });
      return;
    } catch (streamErr) {
      if (tok !== speakTok || streamErr.name === 'AbortError') return;
      console.warn('Gemini streaming failed, falling back to sentence pipelining:', scrubKeys(streamErr&&streamErr.message||streamErr));
      if (player) player.stop();
      appStreamPlayer = null;
    }
  }

  // 3. Fallback: Sentence Pipelining (already in place and preserved)
  const sentences=splitIntoSentences(text);
  if(!sentences.length)return;

  updateSpeakUI('preparing');

  const prefetched=new Map();
  async function fetchSentenceBlob(s){
    const ck=getGeminiTtsCacheKey(s,voice,rate,model);
    if(geminiTtsCache.has(ck))return geminiTtsCache.get(ck);

    const callApi=async m=>fx(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`,{
      method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},
      body:JSON.stringify({
        contents:[{parts:[{text:s}]}],
        generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:voice}}}}
      })
    });
    const j=await withGeminiModel(key,'tts',model,callApi,undefined);
    const inlineData=j.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if(!inlineData?.data)throw new Error('Gemini TTS: empty audio');
    const bin=atob(inlineData.data),bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    let blob;const mime=inlineData.mimeType||'';
    if(mime.includes('pcm')||mime.includes('l16')){
      const m=mime.match(/rate=(\d+)/),sampleRate=m?parseInt(m[1],10):24000;
      blob=pcmToWav(bytes,sampleRate,1);
    }else{
      blob=new Blob([bytes],{type:mime||'audio/wav'});
    }
    geminiTtsCache.set(ck,blob);
    return blob;
  }

  function prefetch(idx){
    if(idx>=sentences.length||tok!==speakTok)return;
    if(!prefetched.has(idx)){
      prefetched.set(idx,fetchSentenceBlob(sentences[idx]));
    }
  }

  prefetch(0);

  for(let i=0;i<sentences.length;i++){
    if(tok!==speakTok)return;
    let blob;
    try{
      blob=await prefetched.get(i);
    }catch(err){
      if(tok!==speakTok)return;
      if(i===0)throw err;
      continue;
    }
    if(tok!==speakTok)return;

    if(i+1<sentences.length){
      prefetch(i+1);
    }

    updateSpeakUI('speaking');

    const url=URL.createObjectURL(blob);
    try{
      await new Promise((res,rej)=>{
        const a=curAudio=new Audio(url);if(cfg.tts.rate)a.playbackRate=cfg.tts.rate;
        const end=()=>{if(curAudio===a)curAudio=null;res()};
        const err=e=>{if(curAudio===a)curAudio=null;rej(e)};
        a.onended=end;a.onpause=end;a.onerror=()=>err(new Error('audio playback failed'));
        a.play().catch(err);
      });
    }finally{
      URL.revokeObjectURL(url);
      curAudio=null;
    }
  }
}
async function playOpenAiTts(text,lang,tok,key){
  const model=cfg.tts.model||'tts-1',voice=cfg.tts.voice||'alloy';
  for(const part of splitLong(text,500)){
    if(tok!==speakTok)return;
    let r;
    try{
      r=await fetch('https://api.openai.com/v1/audio/speech',{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},
        body:JSON.stringify({model,input:part,voice,speed:Math.max(0.25,Math.min(4.0,cfg.tts.rate||1.0)),response_format:'mp3'})
      });
    }catch{throw new Error('OpenAI TTS not reachable')}
    if(!r.ok){
      let msg='';try{const errJ=await r.json();msg=errJ.error?.message}catch{}
      throw new Error(msg||('OpenAI TTS HTTP '+r.status));
    }
    const url=URL.createObjectURL(await r.blob());if(tok!==speakTok)return;
    await new Promise((res,rej)=>{
      const a=curAudio=new Audio(url);if(cfg.tts.rate)a.playbackRate=cfg.tts.rate;
      const end=()=>{if(curAudio===a)curAudio=null;res()};
      const err=e=>{if(curAudio===a)curAudio=null;rej(e)};
      a.onended=end;a.onpause=end;a.onerror=()=>err(new Error('audio playback failed'));
      a.play().catch(err);
    });
    URL.revokeObjectURL(url);
    curAudio=null;
  }
}
function pickVoice(lang){
  const vs=speechSynthesis.getVoices(),b=lang.split('-')[0].toLowerCase();
  const saved=vs.find(v=>v.voiceURI===cfg.tts.voices[b]);if(saved)return saved;
  const sc=v=>(/natural|neural/i.test(v.name)?4:0)+(/online/i.test(v.name)?2:0)+(/google/i.test(v.name)?1:0)+(v.lang.toLowerCase()===lang.toLowerCase()?.5:0);
  return vs.filter(v=>v.lang.toLowerCase().startsWith(b)).sort((x,y)=>sc(y)-sc(x))[0]||null;
}
async function playApi(text,tok){
  const h={'Content-Type':'application/json'};if(cfg.tts.key)h.Authorization='Bearer '+cfg.tts.key;let r;
  try{r=await fetch(cfg.tts.base.replace(/\/+$/,'')+'/audio/speech',{method:'POST',headers:h,body:JSON.stringify({model:cfg.tts.model,input:text,voice:cfg.tts.voice,response_format:'mp3'})})}catch{throw new Error('speech server not reachable')}
  if(!r.ok)throw new Error('speech server HTTP '+r.status);
  const url=URL.createObjectURL(await r.blob());if(tok!==speakTok)return;
  await new Promise((res,rej)=>{
    const a=curAudio=new Audio(url);if(cfg.tts.rate)a.playbackRate=cfg.tts.rate;
    const end=()=>{if(curAudio===a)curAudio=null;res()};
    const err=e=>{if(curAudio===a)curAudio=null;rej(e)};
    a.onended=end;a.onpause=end;a.onerror=()=>err(new Error('audio could not be played'));
    a.play().catch(err);
  });
  URL.revokeObjectURL(url);
  curAudio=null;
}
function isSpeaking(){
  return !!((curAudio&&!curAudio.paused&&!curAudio.ended)||(self.speechSynthesis?.speaking));
}
// ---- Which voice speaks: the choice for this language, or Automatic ----
// Automatic = a device voice that matches the language; if there is none, Gemini voice (when a key is set);
// if neither, a clear message. A device voice for another language is never used.
const geminiTtsKey=()=>cfg.tts?.key||cfg.eng?.gemini?.key||'';
function isVoiceAvailable(pref,b,lang){
  if(!pref)return true;
  if(pref.startsWith('piper:')){
    const id=pref.slice(6);
    return piperVoices().some(m=>m.id===id&&m.lang===b);
  }
  if(pref.startsWith('gemini:')){
    return !!geminiTtsKey()&&!isOff();
  }
  if('speechSynthesis' in self){
    const vs=speechSynthesis.getVoices();
    return vs.some(v=>v.voiceURI===pref);
  }
  return false;
}
function resolveVoice(lang){
  const b=lang.split('-')[0].toLowerCase(),rawPref=cfg.tts.voices[b]||'';
  const pref=isVoiceAvailable(rawPref,b,lang)?rawPref:'';
  const key=geminiTtsKey(),gemOk=!!key&&!isOff();
  const dev=('speechSynthesis' in self)?pickVoice(lang):null;
  const gem=name=>({kind:'gemini',key,voiceName:GEM_VOICES.includes(name)?name:(GEM_VOICES.includes(cfg.tts.voice)?cfg.tts.voice:'Kore')});
  if(pref.startsWith('piper:')){const m=piperFor(b);if(m&&pref==='piper:'+m.id)return {kind:'piper',m}}
  if(pref.startsWith('gemini:')&&gemOk)return gem(pref.slice(7));
  if(dev)return {kind:'device',voice:dev};
  if(gemOk)return gem('');
  const off=piperFor(b);if(off)return {kind:'piper',m:off};      // no device voice, and Gemini is off, offline, or failed
  return {kind:'none'};
}
function showVoiceUsed(label){document.querySelectorAll('.voice-used').forEach(el=>{el.textContent=label?`${L('voiceUsed')}: ${label}`:'';el.title=el.textContent})}
// One calm line near the bottom: why there is no sound, with Retry when trying again can help, and a close button.
function showSpeakNotice(text,retry,onClose){
  const box=$('speakNotice');if(!box)return;
  box._onClose=onClose||null;
  $('speakNoticeText').textContent=text;
  const rb=$('speakNoticeRetry');rb.hidden=!retry;rb.textContent=L('retry');rb.onclick=()=>{hideSpeakNotice();retry&&retry()};
  box.hidden=false;
}
function hideSpeakNotice(){const box=$('speakNotice');if(box){box.hidden=true;box._onClose=null}}
if($('speakNoticeClose'))$('speakNoticeClose').onclick=()=>{const box=$('speakNotice'),f=box&&box._onClose;if(f)f();hideSpeakNotice()};
const isEdge=()=>/\bEdg\//.test(navigator.userAgent);
function speakFailureLine(e){return `${L('geminiWord')} ${L('voiceUsed').toLowerCase()}: ${toPlainReason(e)||plainFailure(e)}`}
async function speakResolved(flat,lang,tok,finish,retry,skipGemini){
  hideSpeakNotice();
  const b=lang.split('-')[0].toLowerCase(),rawPref=cfg.tts.voices[b]||'';
  const voiceUnavailable=rawPref&&!isVoiceAvailable(rawPref,b,lang);
  if(voiceUnavailable){
    const msg=L('voiceFallbackAuto');
    toast(msg,'warn',6000);
    showSpeakNotice(msg);
  }
  let r=resolveVoice(lang);
  if(skipGemini&&r.kind==='gemini'){
    const off=piperFor(lang.split('-')[0].toLowerCase());
    r=('speechSynthesis' in self&&pickVoice(lang))?{kind:'device',voice:pickVoice(lang)}:off?{kind:'piper',m:off}:{kind:'none',failedGemini:true};
  }
  if(r.kind==='none'){
    showVoiceUsed('');
    if(!r.failedGemini){
      const noVoiceNotice=L('noVoiceNoKey')+(MC.models.some(m=>m.kind==='piper'&&m.lang===lang.split('-')[0].toLowerCase())?' '+L('noVoiceOffline'):'')+(!isEdge()&&!store.get('edgeHintOff',false)?' '+L('edgeHint'):'');
      showSpeakNotice(voiceUnavailable ? `${L('voiceFallbackAuto')} ${noVoiceNotice}` : noVoiceNotice);
    }
    finish();return;
  }
  if(r.kind==='piper'){
    showVoiceUsed(piperLabel(r.m));
    try{await playPiper(flat,tok,r.m);finish()}
    catch(e){
      if(tok!==speakTok)return;
      curAudio=null;finish();
      console.warn('Offline voice failed:',scrubKeys(e&&e.message||e));
      showSpeakNotice(`${mcText(r.m.name)}: ${toPlainReason(e)||plainFailure(e)}`,retry);
    }
    return;
  }
  if(r.kind==='gemini'){
    showVoiceUsed(`${L('geminiWord')} (${r.voiceName})`);
    try{await playGeminiTts(flat,lang,tok,r.key,r.voiceName);finish()}
    catch(e){
      if(tok!==speakTok)return;
      curAudio=null;finish();
      console.warn('Gemini TTS failed:',scrubKeys(e&&e.message||e));
      showSpeakNotice(speakFailureLine(e),retry);
    }
    return;
  }
  const v=r.voice;
  showVoiceUsed(`${v.name} (${L('voiceDevice')})`);
  // A calm hint when the language has no device voice is only shown in the "none"/Gemini cases below; here a device voice exists.
  await new Promise(resolve=>{
    const parts=splitLong(flat,180);let left=parts.length;if(!left){resolve();return}
    parts.forEach(part=>{
      const u=new SpeechSynthesisUtterance(part);u.lang=v.lang;u.voice=v;
      u.rate=cfg.tts.rate||1.0;
      u.onstart=()=>{if(tok===speakTok)updateSpeakUI(true)};
      u.onend=()=>{left--;if(left<=0||tok!==speakTok)resolve()};
      u.onerror=()=>{left--;if(left<=0||tok!==speakTok)resolve()};
      speechSynthesis.speak(u);
    });
  });
  finish();
}
// The Edge hint: shown once per language that has no device voice while Gemini voice is used instead; dismissible for good.
function maybeEdgeHint(lang){
  if(isEdge()||store.get('edgeHintOff',false))return;
  const b=lang.split('-')[0].toLowerCase();
  if(('speechSynthesis' in self)&&pickVoice(lang))return;
  if(noVoiceTold[b])return;noVoiceTold[b]=1;
  const box=$('speakNotice');if(!box)return;
  setTimeout(()=>{ // after playback has started, so it never replaces a failure line
    if(box.hidden)showSpeakNotice(L('edgeHint'),null,()=>store.set('edgeHintOff',true));
  },1200);
}
async function speak(text,lang,skipGemini){
  if(rec){try{rec.stop()}catch{}rec=null}
  if(activeSR){try{activeSR.abort()}catch{}activeSR=null}
  const was=isSpeaking();stopSpeak();if(was&&speak.last===text){speak.last='';return}
  if(!text||!text.trim())return;speak.last=text;const tok=++speakTok,flat=text.replace(/\s*\n+\s*/g,' ');
  updateSpeakUI('preparing');
  const finish=()=>{if(tok===speakTok)updateSpeakUI(false)};
  const retry=()=>{speak.last='';speak(text,lang)};
  try{
    if(cfg.tts.mode==='gemini'&&!isOff()){
      const key=cfg.tts.key||cfg.eng.gemini.key;if(!key)throw new Error('Gemini TTS: '+L('needKey'));
      hideSpeakNotice();showVoiceUsed(`${L('geminiWord')} (${GEM_VOICES.includes(cfg.tts.voice)?cfg.tts.voice:'Kore'})`);
      await playGeminiTts(flat,lang,tok,key);finish();return;
    }else if(cfg.tts.mode==='openai'&&!isOff()){
      const key=cfg.tts.key||cfg.eng.openai.key;if(!key)throw new Error('OpenAI TTS: '+L('needKey'));
      showVoiceUsed('OpenAI');await playOpenAiTts(flat,lang,tok,key);finish();return;
    }else if(cfg.tts.mode==='api'&&(!isOff()||isLocalUrl(cfg.tts.base))){
      showVoiceUsed(L('ttsApiO'));
      for(const part of splitLong(flat,500)){if(tok!==speakTok)break;await playApi(part,tok)}
      finish();return;
    }
  }catch(e){
    if(tok!==speakTok)return;curAudio=null;
    // The voice the user chose failed: say why in one line (with Retry); a device voice still takes over if there is one.
    const dev=('speechSynthesis' in self)&&pickVoice(lang);
    if(!dev&&!piperFor(lang.split('-')[0].toLowerCase())){finish();showSpeakNotice(`${cfg.tts.mode==='gemini'?L('geminiWord'):cfg.tts.mode==='openai'?'OpenAI':L('ttsApiO')}: ${toPlainReason(e)||plainFailure(e)}`,retry);return}
    toast(`${scrubKeys(e.message)} — ${L('ttsFallback')}`,'warn');
    skipGemini=true;
  }
  await speakResolved(flat,lang,tok,finish,retry,skipGemini);
  if(tok===speakTok&&resolveVoice(lang).kind==='gemini')maybeEdgeHint(lang);
}
async function speakFast(text,lang,forceFast=false){
  // Fast live speech prefers the quick device voice, but a language with no device voice (Persian on Windows Chrome)
  // is spoken by Gemini instead of staying silent: the same automatic rule as everywhere.
  if(forceFast){
    if(rec){try{rec.stop()}catch{}rec=null}
    if(activeSR){try{activeSR.abort()}catch{}activeSR=null}
    stopSpeak();
    if(!text||!text.trim())return;
    const tok=++speakTok,flat=text.replace(/\s*\n+\s*/g,' ');
    updateSpeakUI(true);
    const finish=()=>{if(tok===speakTok)updateSpeakUI(false)};
    const retry=()=>{speakFast(text,lang,true)};
    await speakResolved(flat,lang,tok,finish,retry,false);
    if(tok===speakTok&&resolveVoice(lang).kind==='gemini')maybeEdgeHint(lang);
  }else{
    await speak(text,lang);
  }
}
/* ----- speech to text ----- */
const isElectron = typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent);
const SR = !isElectron && (self.SpeechRecognition || self.webkitSpeechRecognition);
function sttMode(){
  if(isElectron && cfg.stt==='browser'){
    if(cfg.eng?.groq?.key) return 'groq';
    const gemKey=cfg.eng?.gemini?.key||(cfg.tts.mode==='gemini'&&cfg.tts.key);
    if(gemKey) return 'gemini';
    return asrReady() ? 'whisper' : 'helper';
  }
  if(cfg.stt!=='auto')return cfg.stt;
  if(isOff())return 'whisper';
  if(cfg.eng.groq.key&&!sessionBlocked.has('groq')&&cfg.eng.groq.on!==false)return 'groq';
  const gemKey=cfg.eng.gemini.key||(cfg.tts.mode==='gemini'&&cfg.tts.key);
  if(gemKey&&!sessionBlocked.has('gemini')&&cfg.eng.gemini.on!==false)return 'gemini';
  if(isElectron) return asrReady() ? 'whisper' : 'helper';
  return (self.SpeechRecognition||self.webkitSpeechRecognition)?'browser':'whisper';
}

async function blobToWav(blob){
  const ac=new (self.AudioContext||self.webkitAudioContext)({sampleRate:16000});
  const ab=await blob.arrayBuffer();
  const b=await ac.decodeAudioData(ab);
  ac.close();
  const ch=b.getChannelData(0);
  const pcm=new Int16Array(ch.length);
  for(let i=0;i<ch.length;i++){
    const s=Math.max(-1,Math.min(1,ch[i]));
    pcm[i]=s<0?s*0x8000:s*0x7FFF;
  }
  return pcmToWav(new Uint8Array(pcm.buffer),16000,1);
}

function blobToBase64(blob){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onloadend=()=>res(r.result.split(',')[1]);
    r.onerror=rej;
    r.readAsDataURL(blob);
  });
}

async function transcribeGemini(blob, lang){
  const key=cfg.eng.gemini.key||(cfg.tts.mode==='gemini'&&cfg.tts.key);
  if(!key)throw new Error('Gemini: '+L('needKey'));
  const wavBlob=await blobToWav(blob);
  const base64Audio=await blobToBase64(wavBlob);
  const langHint=lang&&lang!=='auto'?` The spoken language is ${langShort(lang)} (${lang}).`:'';
  const prompt=`Transcribe the spoken audio verbatim.${langHint} Output only the exact transcript in the spoken language, with no commentary, no markdown, and no extra text.`;
  const models=(await geminiModelOrder(key,'text',cfg.eng.gemini.model)).slice(0,4);
  let lastErr;
  for(const model of models){
    try{
      const res=await fx(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
        method:'POST',
        headers:{'Content-Type':'application/json','x-goog-api-key':key},
        body:JSON.stringify({
          contents:[{
            parts:[
              {text:prompt},
              {inlineData:{mimeType:'audio/wav',data:base64Audio}}
            ]
          }]
        })
      });
      return res.candidates?.[0]?.content?.parts?.[0]?.text?.trim()||'';
    }catch(err){
      lastErr=err;
      if(isBlockError(err))throw err;
      if(/quota|429|404|not found|unavailable/i.test(err.message||''))continue;
      throw err;
    }
  }
  throw lastErr||new Error('Gemini STT failed');
}
async function transcribeGroq(blob, lang){
  const key=cfg.eng.groq.key;
  if(!key)throw new Error('Groq: '+L('needKey'));
  const fd=new FormData();
  const ext=/mp4/.test(blob.type)?'m4a':/ogg/.test(blob.type)?'ogg':'webm';
  fd.append('file',blob,'speech.'+ext);
  fd.append('model','whisper-large-v3-turbo');
  const l2=(!lang||lang==='auto')?null:lang.split('-')[0];
  if(l2)fd.append('language',l2);
  const res=await fx('https://api.groq.com/openai/v1/audio/transcriptions',{
    method:'POST',
    headers:{Authorization:'Bearer '+key},
    body:fd
  });
  return (res.text||'').trim();
}
async function transcribeHelper(blob, lang){
  const base = (cfg.helperUrl || 'http://127.0.0.1:8765').replace(/\/+$/, '');
  const fd = new FormData();
  const ext = /mp4/.test(blob.type) ? 'm4a' : /ogg/.test(blob.type) ? 'ogg' : 'wav';
  fd.append('file', blob, 'speech.' + ext);
  fd.append('model', cfg.helperModel || 'whisper-large-v3');
  const l2 = (!lang || lang === 'auto') ? null : lang.split('-')[0];
  if (l2) fd.append('language', l2);
  const res = await fx(base + '/v1/audio/transcriptions', {
    method: 'POST',
    body: fd
  });
  return (res.text || '').trim();
}
let sharedMicStream=null;
async function getMicStream(){
  if(sharedMicStream&&sharedMicStream.active){
    const live=sharedMicStream.getAudioTracks().filter(t=>t.readyState==='live');
    if(live.length>0){updateMicIndicator(true);return sharedMicStream}
  }

  // Desktop / PC Audio (YouTube, movies, streams) loopback capture
  if(cfg.audioInput === 'desktop'){
    try{
      let stream = null;
      if(window.makanDesktop?.getDesktopAudioSource){
        await window.makanDesktop.getDesktopAudioSource();
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: 'desktop'
            }
          },
          video: {
            mandatory: {
              chromeMediaSource: 'desktop'
            }
          }
        });
      } else if (navigator.mediaDevices.getDisplayMedia) {
        stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
      }
      if(stream && stream.getAudioTracks().length > 0){
        stream.getVideoTracks().forEach(t => t.stop());
        sharedMicStream = stream;
        sharedMicStream.getAudioTracks().forEach(t => {
          t.onended = () => { sharedMicStream = null; updateMicIndicator(false); };
        });
        updateMicIndicator(true);
        return sharedMicStream;
      }
    }catch(deskErr){
      console.warn('Desktop audio loopback capture failed, falling back to mic:', deskErr);
    }
  }

  try{
    sharedMicStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
    sharedMicStream.getAudioTracks().forEach(t=>{t.onended=()=>{sharedMicStream=null;updateMicIndicator(false)}});
    updateMicIndicator(true);
    return sharedMicStream;
  }catch(err){
    try{
      sharedMicStream=await navigator.mediaDevices.getUserMedia({audio:true});
      sharedMicStream.getAudioTracks().forEach(t=>{t.onended=()=>{sharedMicStream=null;updateMicIndicator(false)}});
      updateMicIndicator(true);
      return sharedMicStream;
    }catch(err2){
      updateMicIndicator(false);
      throw new Error(L('micBlocked'));
    }
  }
}
function releaseMicStream(){
  if(sharedMicStream){
    try{sharedMicStream.getTracks().forEach(t=>t.stop())}catch{}
    sharedMicStream=null;
  }
  updateMicIndicator(false);
}
function updateMicIndicator(active,recording=false){
  const els=[$('vMicIndConv'),$('vMicIndAsk')];
  els.forEach(el=>{
    if(!el)return;
    el.hidden=!active;
    el.classList.toggle('recording',recording);
    const txt=el.querySelector('.mic-ind-text');
    if(txt)txt.textContent=recording?L('micRecording'):L('micActive');
  });
}

async function interpretGemini(blob,langA,langB){
  const key=cfg.eng.gemini.key||(cfg.tts.mode==='gemini'&&cfg.tts.key);
  if(!key)throw new Error('Gemini: '+L('needKey'));
  const wavBlob=await blobToWav(blob);
  const base64Audio=await blobToBase64(wavBlob);
  const nameA=langName(langA)+` (${langA})`,nameB=langName(langB)+` (${langB})`;
  const prompt=`You are a real-time bilingual interpreter between ${nameA} and ${nameB}.
Listen to the user's spoken audio.
1. Determine which of the two languages was spoken: "${langA}" or "${langB}".
2. Transcribe the spoken audio verbatim in the original language.
3. Translate the spoken message into the other language of the pair (if ${langA} was spoken, translate to ${langB}; if ${langB} was spoken, translate to ${langA}).
For Persian, use natural conversational spoken Persian (محاوره‌ای).
Respond ONLY with a valid JSON object in this exact schema:
{
  "lang": "${langA}" or "${langB}",
  "transcript": "exact verbatim transcript in spoken language",
  "translation": "natural fluent translation into the other language"
}`;
  const models=(await geminiModelOrder(key,'text',cfg.eng.gemini.model)).slice(0,4);
  let lastErr;
  for(const model of models){
    try{
      const res=await fx(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
        method:'POST',
        headers:{'Content-Type':'application/json','x-goog-api-key':key},
        body:JSON.stringify({
          contents:[{parts:[{text:prompt},{inlineData:{mimeType:'audio/wav',data:base64Audio}}]}],
          generationConfig:{temperature:0.2,responseMimeType:'application/json'}
        })
      });
      const raw=res.candidates?.[0]?.content?.parts?.[0]?.text?.trim()||'';
      let parsed=null;
      try{parsed=JSON.parse(raw)}catch{
        const clean=raw.replace(/```(?:json)?/g,'').trim();
        const a=clean.indexOf('{'),b=clean.lastIndexOf('}');
        if(a>=0&&b>a)parsed=JSON.parse(clean.slice(a,b+1));
      }
      if(parsed&&parsed.transcript){
        let detected=parsed.lang?.toLowerCase()?.trim()||'';
        const normA=langA.split('-')[0].toLowerCase(),normB=langB.split('-')[0].toLowerCase();
        if(detected!==langA&&detected!==langB){
          if(detected.startsWith(normA))detected=langA;
          else if(detected.startsWith(normB))detected=langB;
          else detected=langA;
        }
        return {lang:detected,transcript:parsed.transcript.trim(),translation:(parsed.translation||'').trim()};
      }
    }catch(err){
      lastErr=err;
      if(isBlockError(err))throw err;
      if(/quota|429|404|not found|unavailable/i.test(err.message||''))continue;
      throw err;
    }
  }
  throw lastErr||new Error('Gemini interpret failed');
}

const SVG_ICONS={
  mic:`<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>`,
  micActive:`<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>`,
  speaker:`<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
  spinner:`<svg class="v-spin" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/></svg>`,
  error:`<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  speakerSmall:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
  copySmall:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  pencilSmall:`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`
};

function updateMeterLevel(rms){
  const norm=Math.min(1,Math.max(0,(rms-0.004)*16));
  const meters=[$('vMicMeter'),$('vAskMicMeter')];
  meters.forEach(meter=>{
    if(!meter)return;
    const bars=meter.querySelectorAll('.v-meter-bar');
    bars.forEach((bar,i)=>{
      const barThresh=(i+0.5)/bars.length;
      const act=norm>=barThresh*0.6;
      const h=act?Math.min(18,Math.max(4,Math.round(norm*18*(0.7+0.5*Math.sin(Date.now()/80+i))))):3;
      bar.style.height=h+'px';bar.style.opacity=act?'1':'0.25';
    });
  });
  const ripple=document.querySelector('.ptt-ripple');
  if(ripple){
    if(norm>0.08){
      ripple.style.transform=`scale(${1+norm*0.32})`;
      ripple.style.opacity=String(Math.min(0.65,norm*0.8));
    }else{
      ripple.style.transform='scale(1)';ripple.style.opacity='0';
    }
  }
}
function resetMeterLevel(){
  document.querySelectorAll('.v-meter-bar').forEach(bar=>{bar.style.height='3px';bar.style.opacity='0.25'});
  const ripple=document.querySelector('.ptt-ripple');
  if(ripple){ripple.style.transform='scale(1)';ripple.style.opacity='0'}
}

let voiceState='ready';
let voiceStateTimer=null;
// (Re)starts the clock for the 'working' state. Recognition of a long recording asks for more time and
// calls this again whenever the worker reports progress, so a job that is alive is never cut off.
function armWorking(ms){
  if(voiceState!=='working')return;
  clearTimeout(voiceStateTimer);
  voiceStateTimer=setTimeout(()=>{
    if(voiceState==='working'){
      toast(L('timeoutWorking'),'err');
      setVoiceState('ready',L('timeoutWorking'));
    }
  },ms);
}
function setVoiceState(state,message='',opts={}){
  voiceState=state;clearTimeout(voiceStateTimer);
  const statusLine=$('vStatusLine'),statusText=$('vStatusText');
  const pttBtn=$('vPttBtn'),pttLabel=$('vPttLabel'),pttSub=$('vPttSub'),pttIcon=$('vPttIcon');
  const askStatusLine=$('vAskStatusLine'),askStatusText=$('vAskStatusText'),askPttBtn=$('vAskPttBtn');
  if(statusLine)statusLine.dataset.state=state;
  if(askStatusLine)askStatusLine.dataset.state=state;
  if(pttBtn){
    pttBtn.dataset.state=state;
    pttBtn.classList.toggle('rec',state==='listening');
    pttBtn.classList.toggle('work',state==='working');
  }
  if(askPttBtn){
    askPttBtn.dataset.state=state;
    askPttBtn.classList.toggle('rec',state==='listening');
    askPttBtn.classList.toggle('work',state==='working');
  }
  const stopSpeakBtn=$('vStopSpeak'),askStopSpeakBtn=$('vAskStopSpeak');
  if(stopSpeakBtn)stopSpeakBtn.hidden=(state!=='speaking'&&state!=='preparing');
  if(askStopSpeakBtn)askStopSpeakBtn.hidden=(state!=='speaking'&&state!=='preparing');

  let txt=message,labelTxt=L('talk'),subTxt=L('pttHold');
  if(state==='ready'){
    txt=message||L('vStatusReady');
    labelTxt=L('talk');subTxt=L('pttHold');
    if(pttIcon)pttIcon.innerHTML=SVG_ICONS.mic;
    resetMeterLevel();
  }else if(state==='listening'){
    txt=message||L('vStatusListening');
    labelTxt=opts.isTap?L('pttTapStop'):L('pttReleaseSend');
    subTxt=opts.isTap?L('pttListeningTap'):L('pttListeningHold');
    if(pttIcon)pttIcon.innerHTML=SVG_ICONS.micActive;
    voiceStateTimer=setTimeout(()=>{
      if(voiceState==='listening'){
        toast(L('timeoutListening'),'warn');
        if(typeof stopRecNow==='function')stopRecNow();
        setVoiceState('ready',L('timeoutListening'));
      }
    },25000);
  }else if(state==='working'){
    txt=message||L('vStatusWorking');
    labelTxt=L('working');subTxt=L('workingWait');
    if(pttIcon)pttIcon.innerHTML=SVG_ICONS.spinner;
    resetMeterLevel();
    armWorking(opts.timeoutMs||20000);
  }else if(state==='preparing'){
    txt=message||L('vStatusPreparing');
    labelTxt=L('vPreparingPtt')||'Preparing…';subTxt=L('vPreparingTapStop')||'Tap to cancel';
    if(pttIcon)pttIcon.innerHTML=SVG_ICONS.speaker;
    resetMeterLevel();
    voiceStateTimer=setTimeout(()=>{
      if(voiceState==='preparing'){
        stopSpeak();
        setVoiceState('ready');
      }
    },25000);
  }else if(state==='speaking'){
    txt=message||L('vStatusSpeaking');
    labelTxt=L('vSpeakingPtt');subTxt=L('vSpeakingTapStop');
    if(pttIcon)pttIcon.innerHTML=SVG_ICONS.speaker;
    resetMeterLevel();
    voiceStateTimer=setTimeout(()=>{
      if(voiceState==='speaking'){
        stopSpeak();
        setVoiceState('ready');
      }
    },30000);
  }else if(state==='error'){
    txt=message||L('vStatusError');
    labelTxt=L('retry');subTxt=L('tapToRetry');
    if(pttIcon)pttIcon.innerHTML=SVG_ICONS.error;
    resetMeterLevel();
    voiceStateTimer=setTimeout(()=>{
      if(voiceState==='error')setVoiceState('ready');
    },4000);
  }
  if(statusText)statusText.textContent=txt;
  if(askStatusText)askStatusText.textContent=txt;
  if(pttLabel)pttLabel.textContent=labelTxt;
  if(pttSub)pttSub.innerHTML=subTxt;
}

let rec=null,activeSR=null;
function record(btn,onPartial){return new Promise(async(res,rej)=>{
  if(isSpeaking())return rej(new Error('Audio playback active'));
  let st;try{st=await getMicStream()}catch(err){return rej(err)}
  updateMicIndicator(true,true);
  const mr=new MediaRecorder(st),ch=[],ac=new (self.AudioContext||self.webkitAudioContext)(),an=ac.createAnalyser();
  ac.createMediaStreamSource(st).connect(an);an.fftSize=1024;const buf=new Float32Array(1024);
  let spoke=false,quiet=0,maxRms=0;const t0=Date.now(),noiseSamples=[];let speechThreshold=0.02;
  const silenceDelay=Math.max(500,+(cfg.silenceWait||store.get('silenceWait',800)));
  const stop=()=>{if(mr.state==='recording')mr.stop()};
  const iv=setInterval(()=>{
    if(isSpeaking()){spoke=false;stop();return}
    an.getFloatTimeDomainData(buf);let s=0;for(const x of buf)s+=x*x;
    const rms=Math.sqrt(s/buf.length),elapsed=Date.now()-t0;
    if(rms>maxRms)maxRms=rms;
    updateMeterLevel(rms);
    if(elapsed<=450){
      noiseSamples.push(rms);
      if(rms>0.03)spoke=true;
      if(elapsed>=400&&noiseSamples.length>0){
        const avgNoise=Math.min(0.025,noiseSamples.reduce((a,b)=>a+b,0)/noiseSamples.length);
        speechThreshold=Math.max(0.012,Math.min(0.045,avgNoise*2.0));
      }
    }else{
      if(rms>speechThreshold){spoke=true;quiet=0;if(onPartial)onPartial('…')}
      else quiet+=100;
      if((spoke&&quiet>=silenceDelay)||elapsed>12000)stop();
    }
  },80);
  mr.ondataavailable=e=>ch.push(e.data);
  mr.onstop=()=>{
    clearInterval(iv);ac.close();
    updateMicIndicator(true,false);
    resetMeterLevel();
    btn?.classList?.remove('rec');rec=null;
    if(spoke&&maxRms<0.012)toast(L('micLowWarn'),'warn',4000);
    // Reusing sharedMicStream tracks!
    if(isSpeaking()||!spoke)res(new Blob([]));
    else res(new Blob(ch,{type:mr.mimeType}));
  };
  rec={stop};btn?.classList?.add('rec');mr.start();
})}
async function to16k(blob){
  const ac=new (self.AudioContext||self.webkitAudioContext)({sampleRate:16000});
  const b=await ac.decodeAudioData(await blob.arrayBuffer());ac.close();return b.getChannelData(0).slice();
}
async function listen(lang,btn,onText,onPartial){
  if(rec){rec.stop();return {started:false,stopped:true}}
  if(activeSR){try{activeSR.abort()}catch{}activeSR=null;btn?.classList?.remove('rec');return {started:false,stopped:true}}
  if(isSpeaking()){btn?.classList?.remove('rec');return {started:false,reason:'Audio playback active'}}

  let called=false;
  const finish=tx=>{
    if(!called){
      called=true;
      if(tx&&typeof tx==='string'&&tx.trim()&&!isSpeaking()){
        onText?.(tx.trim());
      }
    }
  };
  const mode=sttMode(),l2=lang==='auto'?null:lang.split('-')[0];
  if(mode==='browser'){
    if(!SR){toast(L('noSR'),'err');finish('');return {started:false,reason:'noSR'}}
    if(isSpeaking())return {started:false,reason:'Audio playback active'};
    const r=activeSR=new SR();r.lang=lang==='auto'?(navigator.language||'en'):lang;r.interimResults=true;
    r.onresult=e=>{
      if(isSpeaking()){try{r.abort()}catch{}return}
      let interim='',final='';
      for(let i=0;i<e.results.length;++i){
        if(e.results[i].isFinal)final+=e.results[i][0].transcript;
        else interim+=e.results[i][0].transcript;
      }
      if(interim&&onPartial&&!isSpeaking())onPartial(interim);
      if(final&&!isSpeaking())finish(final);
    };
    r.onerror=e=>{if(e.error!=='no-speech'&&e.error!=='aborted')toast('Mic: '+e.error,'err');finish('')};
    r.onend=()=>{if(activeSR===r)activeSR=null;btn?.classList?.remove('rec');finish('')};
    btn?.classList?.add('rec');
    try{r.start()}catch(err){activeSR=null;btn?.classList?.remove('rec');return {started:false,reason:err.message}}
    return {started:true};
  }
  try{
    if(mode==='groq'&&!cfg.eng.groq.key)throw new Error('Groq: '+L('needKey'));
    if(mode==='whisper'&&!asrReady())throw new Error('Whisper: '+L('needDl'));
    const blob=await record(btn,onPartial);
    if(isSpeaking()||!blob||blob.size<1500){finish('');return {started:true,recorded:false,reason:'empty or playback active'}}
    btn?.classList?.add('work');let text;
    if(mode==='helper'){
      text=await transcribeHelper(blob,l2);
    }else if(mode==='gemini'){
      text=await transcribeGemini(blob,l2);
    }else if(mode==='groq'){
      try{
        text=await transcribeGroq(blob,l2);
      }catch(err){
        if(isBlockError(err)){
          markBlocked('groq');
          toast('Groq: '+L('regionBlocked'),'warn',8000);
          if(cfg.eng.gemini.key&&!sessionBlocked.has('gemini')){
            text=await transcribeGemini(blob,l2);
          }else{
            if(!asrReady())throw new Error('Whisper: '+L('needDl'));
            const audio=await to16k(blob);
            text=await rpc('asr',{audio,lang:l2,model:asrModel().key,langs:[$('src').value,$('tgt').value]},[audio.buffer]);
          }
        }else throw err;
      }
    }else{
      const audio=await to16k(blob);text=await rpc('asr',{audio,lang:l2,model:asrModel().key,langs:[$('src').value,$('tgt').value]},[audio.buffer]);
    }
    if(!isSpeaking()){
      text=(text||'').trim();finish(text);
    }else{
      finish('');
    }
    return {started:true,text};
  }catch(e){
    if(e.message!=='Audio playback active')toast(e.message,'err',7000);
    finish('');
    return {started:false,reason:e.message};
  }finally{
    btn?.classList?.remove('work');
  }
}
function download(name,data,type='text/plain'){const isJson=name.endsWith('.json')||type.includes('json');const bom=isJson?'':'\ufeff';const blob=data instanceof Blob?data:new Blob([bom+data],{type:type+';charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
function dropzone(drop,input,onFile){
  input.onchange=()=>{if(input.files[0])onFile(input.files[0]);input.value=''};
  ['dragover','dragenter'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over')}));
  ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over')}));
  drop.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)onFile(f)});
}
function busy(goBtns,stopBtn,on){goBtns.forEach(b=>b.disabled=on);stopBtn.hidden=!on}

function fillLangs(){
  $('src').innerHTML=`<option value="auto">${esc(L('detect'))}</option>`+LANGS.map(l=>`<option value="${l[0]}">${esc(l[1])}</option>`).join('')+`<option value="finglish">${esc(L('fgOpt'))}</option>`;
  $('tgt').innerHTML=LANGS.map(l=>`<option value="${l[0]}">${esc(l[1])}</option>`).join('');
  $('src').value=store.get('src','auto');$('tgt').value=store.get('tgt',(navigator.language||'').startsWith('fa')?'en':'fa');
}
function fillEngines(){
  const cur=store.get('engine','auto'),ok=cfg.order.filter(usable);
  $('engine').innerHTML=`<option value="auto">${esc(L('auto'))}</option>`+ok.map(id=>`<option value="${id}">${esc(ENG[id].name)}</option>`).join('');
  $('engine').value=ok.includes(cur)?cur:'auto';
  $('cEng').innerHTML=ok.map((id,i)=>`<label class="chk"><input type="checkbox" value="${id}" ${i<3?'checked':''}>${esc(ENG[id].name)}</label>`).join('');
  if(typeof fillVoiceTransEngines==='function') fillVoiceTransEngines();
}

function getVoiceAutoEngines() {
  const mode = sttMode();
  if (mode === 'helper') listen = 'Python Helper (' + (cfg.helperModel || 'whisper-large-v3') + ')';
  else if (mode === 'gemini') listen = 'Google Gemini';
  else if (mode === 'groq') listen = 'Groq Whisper';
  else if (mode === 'whisper') listen = 'Whisper (offline)';
  else listen = (self.SpeechRecognition || self.webkitSpeechRecognition) ? 'Browser' : 'Whisper (offline)';

  const activeTrans = $('vTransEngine')?.value || store.get('voiceTransEngine', 'auto');
  let trans = activeTrans;
  if (trans === 'auto') {
    const chain = cfg.order.filter(usable);
    trans = chain[0] || 'google';
  }
  const transName = ENG[trans]?.name || trans;
  return { listen, trans: transName };
}

function updateVoiceAutoEngineDisplay() {
  const { listen, trans } = getVoiceAutoEngines();
  const elListen = $('vListenEngName');
  const elTrans = $('vTransEngName');
  if (elListen) elListen.textContent = listen;
  if (elTrans) elTrans.textContent = trans;
  const turnMeta = $('vTurnMeta');
  if (turnMeta && (voiceState === 'ready' || !turnMeta.textContent)) {
    turnMeta.textContent = `${listen} → ${trans}`;
  }
}

function voiceLabels(){
  const s=$('src')?.value||'auto',t=$('tgt')?.value||'en';
  if($('vA')) $('vA').textContent=`${L('speakIn')} ${s==='auto'?L('detect'):langShort(s)}`;
  if($('vB')) $('vB').textContent=`${L('speakIn')} ${langShort(t)}`;
  if($('vNo')) $('vNo').hidden=sttMode()!=='browser'||!!SR;
  if(typeof updateVoiceLangPills==='function') updateVoiceLangPills();
  updateVoiceAutoEngineDisplay();
  if(typeof updateListenButtonState==='function') updateListenButtonState();
}
