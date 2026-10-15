/* ---------- engines ---------- */
const ENG={
 google:{name:'Google Translate (web)',tier:'free',items:40,chars:1800},
 mymemory:{name:'MyMemory',tier:'free',items:1,chars:450},
 chrome:{name:'Chrome on-device',tier:'free',off:1,items:30,chars:4000},
 gemini:{name:'Google Gemini',tier:'freekey',ai:1,key:1,model:'gemini-2.5-flash',url:'https://aistudio.google.com/apikey'},
 openrouter:{name:'OpenRouter',tier:'freekey',ai:1,key:1,base:'https://openrouter.ai/api/v1',model:'meta-llama/llama-3.3-70b-instruct:free',url:'https://openrouter.ai/keys'},
 mistral:{name:'Mistral AI',tier:'freekey',ai:1,key:1,base:'https://api.mistral.ai/v1',model:'mistral-small-latest',url:'https://console.mistral.ai/api-keys/'},
 cerebras:{name:'Cerebras',tier:'freekey',ai:1,key:1,base:'https://api.cerebras.ai/v1',model:'gpt-oss-120b',url:'https://cloud.cerebras.ai/'},
 openai:{name:'OpenAI',tier:'paid',ai:1,key:1,base:'https://api.openai.com/v1',model:'gpt-4o-mini',url:'https://platform.openai.com/api-keys'},
 claude:{name:'Anthropic Claude',tier:'paid',ai:1,key:1,model:'claude-haiku-4-5',url:'https://console.anthropic.com/settings/keys'},
 ollama:{name:'Ollama (local AI)',tier:'local',ai:1,off:1,base:'http://localhost:11434/v1',model:'',url:'https://ollama.com/download',hint:'ollamaHint'},
 custom:{name:'Custom server (LM Studio, any OpenAI-compatible)',tier:'custom',ai:1,model:'',hint:'customHint'},
 nllb:{name:'Offline model (NLLB · in browser)',tier:'offline',off:1,items:6,chars:320},
 groq:{name:'Groq',tier:'freekey',ai:1,key:1,base:'https://api.groq.com/openai/v1',model:'llama-3.3-70b-versatile',url:'https://console.groq.com/keys'}
};
const DEF_ORDER=['gemini','openrouter','mistral','cerebras','openai','claude','ollama','custom','chrome','google','mymemory','nllb','groq'];
let cfg=store.get('cfg',{order:DEF_ORDER.slice(),eng:{},mmEmail:''});
DEF_ORDER.forEach(id=>{
  if(!cfg.order.includes(id))cfg.order.push(id);
  const defOn=id!=='groq';
  cfg.eng[id]=Object.assign({on:defOn,key:'',model:ENG[id].model||'',base:ENG[id].base||''},cfg.eng[id]);
});
// A key may only go to its own provider. For fixed providers the address always comes from
// ENG above, never from saved settings; only Ollama and Custom have an address the user can set.
DEF_ORDER.forEach(id=>{if(ENG[id].base&&id!=='custom'&&id!=='ollama')cfg.eng[id].base=ENG[id].base});
if(!store.get('groq_order_fixed',false)){
  if(!cfg.order.includes('groq')) cfg.order.push('groq');
  if(cfg.eng.groq && typeof cfg.eng.groq.on !== 'boolean') cfg.eng.groq.on=false;
  store.set('groq_order_fixed',true);
}
cfg.order=cfg.order.filter(id=>ENG[id]);
let engineConnStatus=store.get('eng_conn',{});
const saveCfg=()=>{
  store.set('cfg',cfg);
  if(window.makanDesktop?.saveAppConfig) {
    try { window.makanDesktop.saveAppConfig(cfg); } catch {}
  }
};
if (window.makanDesktop?.loadAppConfig) {
  window.makanDesktop.loadAppConfig().then(diskCfg => {
    if (diskCfg && diskCfg.eng) {
      let changed = false;
      for (const [id, e] of Object.entries(diskCfg.eng)) {
        if (e && e.key && (!cfg.eng[id] || !cfg.eng[id].key)) {
          if (!cfg.eng[id]) cfg.eng[id] = {};
          cfg.eng[id].key = e.key;
          if (e.model) cfg.eng[id].model = e.model;
          if (e.base) cfg.eng[id].base = e.base;
          changed = true;
        }
      }
      if (diskCfg.mmEmail && !cfg.mmEmail) { cfg.mmEmail = diskCfg.mmEmail; changed = true; }
      if (diskCfg.tts && !cfg.tts?.key && diskCfg.tts.key) { cfg.tts.key = diskCfg.tts.key; changed = true; }
      if (diskCfg.audioInput && cfg.audioInput !== diskCfg.audioInput) { cfg.audioInput = diskCfg.audioInput; if (typeof syncAudioInputUI === 'function') syncAudioInputUI(); changed = true; }
      if (changed) {
        saveCfg();
        if (typeof fillEngines === 'function') fillEngines();
        if (typeof renderEngines === 'function') renderEngines();
      }
    }
  }).catch(() => {});
}
cfg.stt=cfg.stt||'auto';cfg.whisper=cfg.whisper||(store.get('whisper')||'auto');cfg.offline=!!cfg.offline;cfg.trModel=cfg.trModel||(store.get('nllb')?'tr-nllb-600':'auto');cfg.trPair=!!cfg.trPair;cfg.tm=(cfg.tm!==undefined)?!!cfg.tm:true;cfg.helperUrl=cfg.helperUrl||'http://127.0.0.1:8765';cfg.helperModel=cfg.helperModel||'whisper-large-v3';
cfg.audioInput=cfg.audioInput||'mic';
cfg.tts=Object.assign({mode:'device',voices:{},base:'http://localhost:8000/v1',key:'',model:'csm-1b',voice:'alloy',rate:1.0},cfg.tts);
cfg.tts.rate=+cfg.tts.rate||1.0;
const isLocalUrl=u=>/\/\/(localhost|127\.0\.0\.1|\[::1\]|192\.168\.|10\.)/.test(u||'');
const isOff=()=>cfg.offline||!navigator.onLine;
const offCapable=id=>!!ENG[id]?.off||(id==='custom'&&isLocalUrl(cfg.eng?.[id]?.base));
let glossary=store.get('gls',[]);
const lim=id=>id==='ollama'?{items:8,chars:1500}:(ENG[id].ai?{items:50,chars:5000}:{items:ENG[id].items,chars:ENG[id].chars});
function why(id){
  if(!id||!ENG[id]||!cfg.eng?.[id])return 'unknown';
  const e=cfg.eng[id];
  if(ENG[id].key&&!e.key)return L('needKey');
  if(id==='custom'&&!e.base)return L('needUrl');
  if(ENG[id].ai&&!e.model)return L('needModel');
  if(id==='chrome'&&!('Translator' in self))return L('notHere');
  if(id==='nllb'&&!trAnyReady())return L('needDl');
  return '';
}
const sessionBlocked=new Set();
function isBlockError(err){
  const m=String(err?.message||err||'').toLowerCase();
  return /403|access denied|network settings|region|country|forbidden|geograph|not available in your|not supported in your/.test(m);
}
function markBlocked(id){
  if(!id||sessionBlocked.has(id))return;
  sessionBlocked.add(id);
  fillEngines();
  voiceLabels();
}
const usable=id=>Boolean(id&&ENG[id]&&cfg.eng?.[id]?.on&&!sessionBlocked.has(id)&&!why(id)&&(!isOff()||offCapable(id)));

function isLocalAddress(url){
  if(!url)return false;
  try{
    const u=new URL(url.includes('://')?url:'http://'+url);
    const h=u.hostname.toLowerCase();
    return h==='localhost'||h==='127.0.0.1'||h==='[::1]'||h==='0.0.0.0'||h.endsWith('.localhost');
  }catch{
    return /localhost|127\.0\.0\.1|\[::1\]/i.test(String(url));
  }
}

async function checkEngineConn(id){
  const d=ENG[id],e=cfg.eng[id];
  if(!d)return {code:'err',text:'unknown'};
  if(id==='custom'&&!(e.base||'').trim())return {code:'needsUrl',text:L('needUrl')};
  if(id==='chrome'){
    if('Translator' in self)return {code:'works',text:L('connWorks')};
    return {code:'notHere',text:L('notHere')};
  }
  if(id==='nllb'){
    if(trAnyReady())return {code:'works',text:L('connWorks')};
    return {code:'needsDl',text:L('needDl')};
  }
  if(id==='google'){
    try{
      const r=await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=hi');
      if(r.ok)return {code:'works',text:L('connWorks')};
      return {code:'netBlocked',text:L('connNetBlocked')};
    }catch(err){
      if(err.name==='TypeError')return {code:'cors',text:L('connCors')};
      return {code:'netBlocked',text:L('connNetBlocked')};
    }
  }
  if(id==='mymemory'){
    try{
      const r=await fetch('https://api.mymemory.translated.net/get?q=hi&langpair=en|es');
      if(r.ok)return {code:'works',text:L('connWorks')};
      return {code:'netBlocked',text:L('connNetBlocked')};
    }catch(err){
      if(err.name==='TypeError')return {code:'cors',text:L('connCors')};
      return {code:'netBlocked',text:L('connNetBlocked')};
    }
  }
  if(id==='ollama'){
    const base=(e.base||'http://localhost:11434/v1').replace(/\/+$/,'');
    const host=(e.base||'http://localhost:11434').replace(/\/+$/,'').replace(/\/v1$/,'');
    try{
      let r=await fetch(host+'/api/tags').catch(()=>null);
      if(!r||!r.ok) r=await fetch(base+'/models').catch(()=>null);
      if(r&&r.ok)return {code:'works',text:L('connWorks')};
      if(isLocalAddress(base))return {code:'localDown',text:L('connLocalDown')};
      return {code:'netBlocked',text:L('connNetBlocked')};
    }catch(err){
      if(isLocalAddress(base))return {code:'localDown',text:L('connLocalDown')};
      return {code:'netBlocked',text:L('connNetBlocked')};
    }
  }

  // Key-based AI provider without a key: lightweight reachability check
  if(!e.key){
    try{
      let pingUrl='';
      let headers={};
      if(id==='gemini')pingUrl='https://generativelanguage.googleapis.com/v1beta/models';
      else if(id==='claude'){pingUrl='https://api.anthropic.com/v1/models';headers={'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'};}
      else if(id==='cerebras')pingUrl='https://api.cerebras.ai/public/v1/models';
      else if(e.base)pingUrl=e.base.replace(/\/+$/,'')+'/models';

      if(pingUrl){
        const r=await fetch(pingUrl,{method:'GET',headers});
        if(r.status===403){
          let b='';try{b=await r.text()}catch{}
          if(isBlockError(b)||/access denied|network settings|region|country|forbidden/i.test(b)){
            return {code:'netBlocked',text:L('connNetBlocked')};
          }
        }
      }
      return {code:'needsKey',text:L('connNeedsKey')};
    }catch(err){
      if(isLocalAddress(e?.base))return {code:'localDown',text:L('connLocalDown')};
      if(err.name==='TypeError')return {code:'cors',text:L('connCors')};
      return {code:'netBlocked',text:L('connNetBlocked')};
    }
  }

  // Key-based AI provider with a key: tiny real request
  try{
    if(id==='gemini'){
      await withGeminiModel(e.key,'text',e.model,m=>fx(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`,{
        method:'POST',
        headers:{'Content-Type':'application/json','x-goog-api-key':e.key},
        body:JSON.stringify({contents:[{parts:[{text:'Hi'}]}]})
      },1));
      sessionBlocked.delete(id);
      return {code:'works',text:L('connWorks')};
    }else if(id==='claude'){
      await fx('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':e.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
        body:JSON.stringify({model:e.model||'claude-haiku-4-5',max_tokens:1,messages:[{role:'user',content:'Hi'}]})
      },1);
      sessionBlocked.delete(id);
      return {code:'works',text:L('connWorks')};
    }else{
      const h={'Content-Type':'application/json'};
      if(e.key)h.Authorization='Bearer '+e.key;
      await fx(e.base.replace(/\/+$/,'')+'/chat/completions',{
        method:'POST',
        headers:h,
        body:JSON.stringify({model:e.model,messages:[{role:'user',content:'Hi'}],max_tokens:1})
      },1);
      sessionBlocked.delete(id);
      return {code:'works',text:L('connWorks')};
    }
  }catch(err){
    const msg=String(err?.message||err||'').toLowerCase();
    if(isLocalAddress(e?.base))return {code:'localDown',text:L('connLocalDown')};
    if(err.name==='TypeError'||/failed to fetch|cors|networkerror|load failed/i.test(msg)){
      return {code:'cors',text:L('connCors')};
    }
    if(isBlockError(err)||/access denied|network settings|region|forbidden|geograph|country/i.test(msg)){
      return {code:'netBlocked',text:L('connNetBlocked')};
    }
    if(/401|invalid.*key|unauthorized|api_key_invalid|bad api key|key not valid/i.test(msg)){
      return {code:'keyRejected',text:L('connKeyRejected')};
    }
    if(/quota|429/i.test(msg)){
      return {code:'works',text:L('connWorks')+' (quota)'};
    }
    return {code:'err',text:L('connFailed')||'connection failed'};
  }
}
let isCheckingConn=false;
async function runCheckConnections(){
  if(isCheckingConn)return;
  isCheckingConn=true;
  const btn=$('btnCheckConn'),sum=$('checkConnSummary');
  if(btn){btn.disabled=true;btn.innerHTML=`⏳ <span>${esc(L('connChecking'))}</span>`}
  if(sum)sum.textContent=L('connChecking');

  await Promise.allSettled(cfg.order.map(async id=>{
    try{
      engineConnStatus[id]=await checkEngineConn(id);
    }catch(err){
      engineConnStatus[id]={code:'err',text:err.message||'error'};
    }
  }));
  store.set('eng_conn',engineConnStatus);
  renderEngines();
  let ok=0;cfg.order.forEach(id=>{if(engineConnStatus[id]?.code==='works')ok++});
  if(sum)sum.textContent=`${ok}/${cfg.order.length} ${L('connWorks')}`;
  if(btn){btn.disabled=false;btn.innerHTML=`⚡ <span>${esc(L('checkConn'))}</span>`}
  isCheckingConn=false;
  toast(`${L('checkConn')}: ${ok}/${cfg.order.length} ${L('connWorks')}`,'ok',4000);
}

// Provider error text is shown on screen and written to the console; it must never carry one of our keys.
function scrubKeys(s){
  s=String(s);
  const ks=[...Object.values(cfg.eng||{}).map(e=>e&&e.key),cfg.tts&&cfg.tts.key].filter(k=>k&&String(k).length>=8);
  for(const k of ks)s=s.split(k).join('[key hidden]');
  return s;
}

if (typeof window !== 'undefined' && !window.__docDebugLog) {
  window.__docDebugLog = [];
}
let docLogStart = 0;
function docDebugLog(ev, data = {}) {
  if (typeof window === 'undefined') return;
  if (!window.__docDebugLog) window.__docDebugLog = [];
  const origin = window.__docClickTime || docLogStart || Date.now();
  const entry = Object.assign({ t: Date.now() - origin, ev }, data);
  window.__docDebugLog.push(entry);
  if (window.__docDebugLog.length > 200) window.__docDebugLog.shift();
}
if (typeof window !== 'undefined') {
  window.__docDebugLogPush = docDebugLog;
}

function urlHostOnly(url) {
  try {
    return new URL(url.includes('://') ? url : 'http://' + url).host;
  } catch {
    return String(url || '').split('/')[2] || String(url || '').split('/')[0] || '';
  }
}

async function fx(url,opt,tries=2){
  let r;
  const timeoutMs = opt?.timeout || (isLocalUrl(url) ? 60000 : (/clients5\.google|translate\.googleapis|mymemory/i.test(url) ? 18000 : 35000));
  const host = urlHostOnly(url);
  docDebugLog('fx start', { host, timeout: timeoutMs });
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    docDebugLog('fx timer fired', { host, timeout: timeoutMs });
    ctrl.abort();
  }, timeoutMs);
  const extSignal = opt?.signal;
  let abortHandler = null;
  if (extSignal) {
    if (extSignal.aborted) {
      clearTimeout(timer);
      throw new DOMException('Aborted', 'AbortError');
    }
    abortHandler = () => { ctrl.abort(); };
    extSignal.addEventListener('abort', abortHandler, { once: true });
  }

  try {
    const fetchOpt = Object.assign({}, opt, { signal: ctrl.signal });
    delete fetchOpt.timeout;
    r = await fetch(url, fetchOpt);
  } catch(e) {
    if (extSignal?.aborted || (e.name === 'AbortError' && !timedOut)) {
      throw new DOMException('Aborted', 'AbortError');
    }
    if (timedOut) {
      const te = new Error('request timed out');
      te.name = 'TimeoutError';
      te.status = 408;
      throw te;
    }
    throw new Error('network / blocked');
  } finally {
    clearTimeout(timer);
    if (extSignal && abortHandler) extSignal.removeEventListener('abort', abortHandler);
  }

  if((r.status===429||r.status===503)&&tries>1&&!/generativelanguage\.googleapis\.com/.test(url)){
    const w=r.headers?.get ? Math.min(+r.headers.get('retry-after')||2,10) : 2;
    await sleepAbortable(w*1000, extSignal);
    return fx(url,opt,tries-1);
  }
  let j=null;const txt=await r.text();try{j=JSON.parse(txt)}catch{}
  if(!r.ok){const m=j&&(j.error?.message||j.error||j.message);{const er=new Error(scrubKeys(typeof m==='string'?m:'HTTP '+r.status).slice(0,160));er.status=r.status;throw er}}
  if(j==null)throw new Error('bad response');
  return j;
}
function splitLong(s,max){
  const parts=[];let cur='';
  for(const seg of s.split(/(?<=[.!?。！？؟…\n])\s+/)){
    let x=seg;
    while(x.length>max){let cut=x.lastIndexOf(' ',max);if(cut<max/2)cut=max;if(cur){parts.push(cur);cur=''}parts.push(x.slice(0,cut));x=x.slice(cut).trim()}
    if(cur&&(cur+' '+x).length>max){parts.push(cur);cur=x}else cur=cur?cur+' '+x:x;
  }
  if(cur)parts.push(cur);return parts;
}
const reEsc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function preGloss(s){ // for non-AI engines: put the wanted term straight into the source
  for(const g of glossary){if(!g.s||!g.t)continue;s=s.replace(new RegExp('(?<![\\p{L}\\p{N}])'+reEsc(g.s)+'(?![\\p{L}\\p{N}])','giu'),g.t)}
  return s;
}

function withTimeout(promise, ms, signal, errorMsg = 'request timed out') {
  return new Promise((resolve, reject) => {
    let timer = null;
    let onAbort = null;
    let done = false;

    const cleanup = () => {
      done = true;
      if (timer) { clearTimeout(timer); timer = null; }
      if (signal && onAbort) {
        signal.removeEventListener('abort', onAbort);
        onAbort = null;
      }
    };

    if (signal) {
      if (signal.aborted) {
        return reject(new DOMException('Aborted', 'AbortError'));
      }
      onAbort = () => {
        cleanup();
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
    }

    if (typeof ms === 'number' && ms > 0 && ms !== Infinity) {
      timer = setTimeout(() => {
        cleanup();
        docDebugLog('withTimeout fired', { timeout: ms, error: errorMsg });
        const err = new Error(errorMsg);
        err.name = 'TimeoutError';
        err.isTimeout = true;
        reject(err);
      }, ms);
    }

    Promise.resolve(promise).then(
      val => {
        if (!done) { cleanup(); resolve(val); }
      },
      err => {
        if (!done) { cleanup(); reject(err); }
      }
    );
  });
}

/* basic engines */
// Google web translation:
// 1. Primary endpoint: clients5.google.com (/translate_a/t?client=dict-chrome-ex), batch POST with URLSearchParams.
//    Moves to secondary endpoint on: HTTP error (!r.ok), network error/drop, empty or non-JSON reply, length mismatch.
//    Rethrows immediately on AbortError.
// 2. Secondary endpoint: translate.googleapis.com (/translate_a/single?client=gtx), sequential GET per line.
//    If secondary also fails, error bubbles up to translateItems and caller (e.g. Subtitles tab marks Error).
async function eGoogle(items,src,tgt,signal,opt){
  try{
    const body=new URLSearchParams();items.forEach(s=>body.append('q',s));
    const fxOpt={method:'POST',body,signal};
    if(opt?.timeout) fxOpt.timeout=opt.timeout;
    const j=await fx(`https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${src}&tl=${tgt}`,fxOpt,1);
    const out=j.map(x=>Array.isArray(x)?x[0]:x);
    if(out.length!==items.length||out.some(x=>typeof x!=='string'))throw new Error('bad response');
    return out;
  }catch(e){
    if(e.name==='AbortError')throw e;
    const out=[];
    for(const s of items){
      const fxOpt={signal};
      if(opt?.timeout) fxOpt.timeout=opt.timeout;
      const j=await fx(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${src}&tl=${tgt}&dt=t&q=${encodeURIComponent(s)}`,fxOpt,1);
      out.push((j[0]||[]).map(x=>x[0]).join(''));
    }
    return out;
  }
}
async function eMyMemory(items,src,tgt,signal,opt){
  const out=[];
  for(const s of items){
    const u=`https://api.mymemory.translated.net/get?q=${encodeURIComponent(s)}&langpair=${src==='auto'?'Autodetect':src}|${tgt}`+(cfg.mmEmail?`&de=${encodeURIComponent(cfg.mmEmail)}`:'');
    const fxOpt={signal};
    if(opt?.timeout) fxOpt.timeout=opt.timeout;
    const j=await fx(u,fxOpt,1);const tx=j.responseData?.translatedText||'';
    if(+j.responseStatus!==200||j.quotaFinished||/MYMEMORY WARNING/i.test(tx))throw new Error(j.quotaFinished||/WARNING/i.test(tx)?'daily limit reached':(j.responseDetails||'error'));
    out.push(tx);
  }
  return out;
}
const chromeCode=c=>({'zh-CN':'zh','zh-TW':'zh-Hant'}[c]||c);
async function eChrome(items,src,tgt,signal,opts={}){
  if(signal?.aborted) throw new DOMException('Aborted','AbortError');
  const isDoc = !!opts.forDocument;
  const reqTimeout = opts.timeout ?? (typeof window !== 'undefined' && window.__docTimeoutMs ? window.__docTimeoutMs : 20000);
  const availTimeout = opts.chromeAvailTimeoutMs ?? (typeof window !== 'undefined' && window.__chromeAvailTimeoutMs ? window.__chromeAvailTimeoutMs : 2000);

  if(isDoc){
    if(!('Translator' in self) || typeof self.Translator?.availability !== 'function'){
      const err = new Error('on-device translator is not available');
      err.silent = true;
      err.isChromeSkip = true;
      throw err;
    }
  }

  if(src==='auto'){
    if(!('LanguageDetector' in self)){
      if(isDoc){
        const err = new Error('language detector not available');
        err.silent = true;
        err.isChromeSkip = true;
        throw err;
      }
      throw new Error(L('sameLang'));
    }
    const d = isDoc
      ? await withTimeout(LanguageDetector.create(), reqTimeout, signal, 'LanguageDetector create timed out')
      : await LanguageDetector.create();
    const r = isDoc
      ? await withTimeout(d.detect(items.join(' ').slice(0,600)), reqTimeout, signal, 'LanguageDetector detect timed out')
      : await d.detect(items.join(' ').slice(0,600));
    src = r[0]?.detectedLanguage;
    if(!src || src === 'und'){
      if(isDoc){
        const err = new Error('could not detect language');
        err.silent = true;
        err.isChromeSkip = true;
        throw err;
      }
      throw new Error('could not detect language');
    }
  }

  src = chromeCode(src);
  tgt = chromeCode(tgt);
  if(src === tgt) return items.slice();

  if(isDoc){
    let avail;
    try {
      avail = await withTimeout(
        Translator.availability({sourceLanguage:src, targetLanguage:tgt}),
        availTimeout,
        signal,
        'on-device availability check timed out'
      );
    } catch(e) {
      if(e.name === 'AbortError' || signal?.aborted) throw e;
      const err = new Error('language pair not ready on-device');
      err.silent = true;
      err.isChromeSkip = true;
      throw err;
    }
    if(avail !== 'available' && avail !== 'readily'){
      const err = new Error('language pair not ready on-device (' + avail + ')');
      err.silent = true;
      err.isChromeSkip = true;
      throw err;
    }
    const tr = await withTimeout(
      Translator.create({sourceLanguage:src, targetLanguage:tgt}),
      reqTimeout,
      signal,
      `${ENG.chrome.name} did not answer`
    );
    const out = [];
    for(const s of items){
      if(signal?.aborted) throw new DOMException('Aborted','AbortError');
      out.push(await withTimeout(
        tr.translate(s),
        reqTimeout,
        signal,
        `${ENG.chrome.name} did not answer`
      ));
    }
    return out;
  }

  if(await Translator.availability({sourceLanguage:src,targetLanguage:tgt})==='unavailable')throw new Error('language pair not available on-device');
  const tr = await Translator.create({sourceLanguage:src,targetLanguage:tgt});
  const out = [];
  for(const s of items){
    if(signal?.aborted) throw new DOMException('Aborted','AbortError');
    out.push(await tr.translate(s));
  }
  return out;
}

/* offline in-browser models (run in ai-worker.js) */
const NLLB={en:'eng_Latn',fa:'pes_Arab',ar:'arb_Arab',tr:'tur_Latn',de:'deu_Latn',fr:'fra_Latn',es:'spa_Latn',it:'ita_Latn',pt:'por_Latn',ru:'rus_Cyrl','zh-CN':'zho_Hans','zh-TW':'zho_Hant',ja:'jpn_Jpan',ko:'kor_Hang',hi:'hin_Deva',ur:'urd_Arab',ku:'kmr_Latn',az:'azj_Latn',ps:'pbt_Arab',tg:'tgk_Cyrl',hy:'hye_Armn',nl:'nld_Latn',sv:'swe_Latn',no:'nob_Latn',da:'dan_Latn',fi:'fin_Latn',pl:'pol_Latn',uk:'ukr_Cyrl',cs:'ces_Latn',ro:'ron_Latn',hu:'hun_Latn',el:'ell_Grek',he:'heb_Hebr',id:'ind_Latn',ms:'zsm_Latn',th:'tha_Thai',vi:'vie_Latn',bn:'ben_Beng'};
function guessLang(s){
  if(/[\u0600-\u06FF]/.test(s))return /[پچژگکی]/.test(s)?'fa':'ar';
  if(/[\u3040-\u30FF]/.test(s))return 'ja';if(/[\uAC00-\uD7AF]/.test(s))return 'ko';if(/[\u4E00-\u9FFF]/.test(s))return 'zh-CN';
  if(/[\u0400-\u04FF]/.test(s))return 'ru';if(/[\u0590-\u05FF]/.test(s))return 'he';if(/[\u0900-\u097F]/.test(s))return 'hi';
  if(/[\u0E00-\u0E7F]/.test(s))return 'th';if(/[\u0370-\u03FF]/.test(s))return 'el';return 'en';
}
let wk=null,rid=0;const pend={};
const inWorker=new Set();                  // repos the worker already holds in memory (so loading them again is quick)
const asrGuard=import('./asr-guard.js').catch(()=>null);
function worker(){
  if(wk)return wk;
  wk=new Worker('ai-worker.js',{type:'module'});
  wk.onmessage=e=>{const m=e.data;if(m.type==='progress'){onProg(m.p,m.repo);return}if(m.type==='asr'){onAsrProg(m);return}const p=pend[m.id];if(!p)return;delete pend[m.id];m.ok?p.res(m.res):p.rej(new Error(m.err))};
  wk.onerror=()=>{for(const k in pend){pend[k].rej(new Error('offline engine could not start (the app must be opened from a website or localhost, with ai-worker.js next to it)'));delete pend[k]}wk=null;inWorker.clear()};
  return wk;
}
// Tells the worker which model files to use, from the catalogue and the user's choices. Older callers send only a model name.
async function withSpec(cmd,a){
  if(cmd==='asr'||cmd==='loadAsr'){
    const m=asrModel(a.model);
    if(m&&!a.spec)a={...a,spec:{repo:m.repo,gpu:m.gpu&&await checkWebGpu()?m.gpu:null}};
  }
  return a;
}
const rpc=(cmd,a,tr,signal)=>new Promise(async(res,rej)=>{
  let w;try{w=worker()}catch(e){return rej(new Error('offline engine needs the hosted app, not a local file'))}
  const id=++rid;
  try{a=await withSpec(cmd,a||{})}catch(e){return rej(e)}
  let end=()=>{};
  if(cmd==='asr'&&a.audio){                // a longer recording gets more time, and progress keeps the timer alive
    const m=asrModel(a.model),sec=a.audio.length/16000,g=await asrGuard;
    asrJob={id,sec};
    armWorking(g?g.asrBudgetMs(sec,m?.speed,!inWorker.has(a.spec?.repo)):60000+sec*3000);
    end=()=>{if(asrJob?.id===id){asrJob=null;armWorking(20000)}};
  }
  let timer=null;
  if(cmd==='translate'){
    timer=setTimeout(()=>{
      if(pend[id]){
        delete pend[id];
        rej(new Error('offline translation model timed out'));
      }
    },90000);
  }
  let onAbort=null;
  if(signal){
    if(signal.aborted){
      if(timer)clearTimeout(timer);
      return rej(new DOMException('Aborted','AbortError'));
    }
    onAbort=()=>{
      if(timer)clearTimeout(timer);
      if(pend[id]){
        delete pend[id];
        rej(new DOMException('Aborted','AbortError'));
      }
    };
    signal.addEventListener('abort',onAbort,{once:true});
  }
  pend[id]={
    res:v=>{
      if(timer)clearTimeout(timer);
      if(signal&&onAbort)signal.removeEventListener('abort',onAbort);
      if(a.spec?.repo)inWorker.add(a.spec.repo);
      end();
      res(v);
    },
    rej:e=>{
      if(timer)clearTimeout(timer);
      if(signal&&onAbort)signal.removeEventListener('abort',onAbort);
      end();
      rej(e);
    }
  };
  w.postMessage({id,cmd,a},tr||[]);
});
let asrJob=null;
function onAsrProg(m){
  if(!asrJob||asrJob.id!==m.id)return;
  const pct=Math.round(Math.min(1,m.frac||0)*100);
  const txt=`${L('vTranscribing')} ${pct}%`+(m.chunks>1?` · ${m.chunk}/${m.chunks}`:'');
  ['vStatusText','vAskStatusText'].forEach(i=>{if($(i)&&voiceState==='working')$(i).textContent=txt});
  armWorking(60000);                       // it is alive: wait at least another minute from now
}
function onProg(p,repo){
  const m=MC.models.find(x=>x.repo===repo&&mcDownloading[x.id]);
  if(m&&p.status==='progress'&&p.total)mcFileProgress(m,p.file,p.loaded,p.total);
}
// Bar and text of one row while its files come in.
function mcFileProgress(m,file,loaded,total){
  const d=mcDownloading[m.id];if(!d||!total)return;
  d.files[file]=[loaded,total];let a=0,b=0;for(const k in d.files){a+=d.files[k][0];b+=d.files[k][1]}
  const bar=$('mdlBar-'+m.id),st=$('mdlSt-'+m.id),box=$('mdlProg-'+m.id);
  if(box)box.hidden=false;if(bar)bar.style.width=(a/b*100)+'%';
  if(st)st.textContent=`${L('mdlDownloading')} ${(a/1048576).toFixed(0)} / ${(b/1048576).toFixed(0)} MB`;
  const hubBar=$('hubBar-'+m.id),hubSt=$('hubSt-'+m.id),hubProg=$('hubProg-'+m.id);
  if(hubProg)hubProg.hidden=false;if(hubBar)hubBar.style.width=(a/b*100)+'%';
  if(hubSt)hubSt.textContent=`${L('mdlDownloading')} ${(a/1048576).toFixed(0)} / ${(b/1048576).toFixed(0)} MB (${Math.round(a/b*100)}%)`;
}
// The name shown for an engine; the offline engine also says which downloaded model did the work.
let offlineUsed='';
const engLabel=i=>i==='nllb'&&offlineUsed?`${ENG.nllb.name} — ${offlineUsed}`:ENG[i].name;
async function eNllb(items,src,tgt,signal,onStatus){
  if(src==='auto')src=guessLang(items.join(' '));
  if(NLLB[src]&&NLLB[src]===NLLB[tgt])return items.slice();
  const chosen=(cfg.trModel&&cfg.trModel!=='auto')?MC.models.find(x=>x.id===cfg.trModel):null;
  if(chosen&&mcReady(chosen)&&!trCovers(chosen,src,tgt)){
    const pairStr=`${langShort(src)} → ${langShort(tgt)}`;
    const msg=L('mdlUnsupportedFallback').replace('{model}',mcText(chosen.name)).replace('{pair}',pairStr);
    toast(msg,'warn',6000);
    const noticeEl=$('offFallbackNotice');
    if(noticeEl){noticeEl.textContent=msg;noticeEl.hidden=false}
  }else{
    const noticeEl=$('offFallbackNotice');
    if(noticeEl)noticeEl.hidden=true;
  }
  const m=pickTr(src,tgt);
  if(!m)throw new Error('language not in the offline model');
  offlineUsed=mcText(m.name);
  if(!inWorker.has(m.repo)){
    onStatus?.(L('loadingOfflineModel') || (ui==='fa'?'در حال بارگذاری مدل آفلاین…':'Loading offline model…'));
  }
  const codes=m.kind==='opus'?null:trCodes(m.kind);
  return rpc('translate',{items,src:codes?.[src],tgt:codes?.[tgt],spec:{repo:m.repo,kind:m.kind}},undefined,signal);
}

/* offline voices (Piper): a separate worker, all of its code is in vendor/piper/ */
let pwk=null,prid=0;const ppend={};
function pworker(){
  if(pwk)return pwk;
  pwk=new Worker('piper-worker.js');
  pwk.onmessage=e=>{const m=e.data,p=ppend[m.id];if(!p)return;
    if(m.type==='progress'){p.progress?.(m);return}
    if(m.type==='audio'){p.audio?.(m);return}
    delete ppend[m.id];m.ok?p.res(m.res):p.rej(new Error(m.err))};
  pwk.onerror=()=>{for(const k in ppend){ppend[k].rej(new Error('offline voice could not start'));delete ppend[k]}pwk=null};
  return pwk;
}
const prpc=(cmd,a,h={})=>new Promise((res,rej)=>{let w;try{w=pworker()}catch(e){return rej(new Error('offline voices need the hosted app, not a local file'))}const id=++prid;ppend[id]={res,rej,...h};w.postMessage({id,cmd,a})});
const PIPER_ENGINE=['vendor/piper/ort.wasm.min.js','vendor/piper/ort-wasm-simd.wasm','vendor/piper/piper_phonemize.js','vendor/piper/piper_phonemize.wasm','vendor/piper/piper_phonemize.data'];
async function piperEngineFiles(m){
  const total=m.extraBytes||0;let done=0;
  for(const f of PIPER_ENGINE){
    const r=await fetch(f);if(!r.ok)throw new Error('speech engine file missing: '+f);
    const reader=r.body.getReader();let got=0;
    for(;;){const {done:d,value}=await reader.read();if(d)break;got+=value.length;mcFileProgress(m,'engine/'+f,done+got,total||done+got)}
    done+=got;
  }
}
// Speaks one piece of text with a downloaded voice; resolves with a WAV blob. Sentences are joined with a short pause.
async function piperBlob(m,text){
  const parts=[];let rate=22050;
  await prpc('speak',{voice:{path:m.voice},text},{audio:a=>{rate=a.rate;parts.push(a.pcm)}});
  if(!parts.length)throw new Error('the offline voice produced no sound');
  const gap=Math.round(rate*0.18),n=parts.reduce((s,p)=>s+p.length,0)+gap*(parts.length-1),pcm=new Int16Array(n);
  let o=0;for(const p of parts){for(let i=0;i<p.length;i++){const v=Math.max(-1,Math.min(1,p[i]));pcm[o++]=v<0?v*0x8000:v*0x7FFF}o+=gap}
  return pcmToWav(new Uint8Array(pcm.buffer),rate,1);
}
const piperVoices=()=>MC.models.filter(m=>m.kind==='piper'&&mcReady(m));
// The offline voice for a language: the one chosen in the voice menu, else the first downloaded.
function piperFor(b){
  const pref=cfg.tts.voices[b]||'';
  const chosen=pref.startsWith('piper:')&&piperVoices().find(m=>m.id===pref.slice(6)&&m.lang===b);
  return chosen||piperVoices().find(m=>m.lang===b)||null;
}
const piperLabel=m=>`${mcText(m.name)} (${L('mdlOfflineVoice')})`;
let piperStats=null;                       // last time to first sound, for the record
async function playPiper(text,tok,m){
  const t0=performance.now(),parts=splitLong(text,200);
  if(!parts.length)return;
  let next=piperBlob(m,parts[0]);
  for(let i=0;i<parts.length;i++){
    const blob=await next;
    if(tok!==speakTok)return;
    if(i+1<parts.length)next=piperBlob(m,parts[i+1]);       // the next piece is made while this one plays
    if(i===0)piperStats={voice:m.id,firstSoundMs:Math.round(performance.now()-t0)};
    updateSpeakUI('speaking');
    const url=URL.createObjectURL(blob);
    try{
      await new Promise((res,rej)=>{
        const a=curAudio=new Audio(url);if(cfg.tts.rate)a.playbackRate=cfg.tts.rate;
        const end=()=>{if(curAudio===a)curAudio=null;res()};
        a.onended=end;a.onpause=end;a.onerror=()=>{if(curAudio===a)curAudio=null;rej(new Error('audio playback failed'))};
        a.play().catch(e=>{if(curAudio===a)curAudio=null;rej(e)});
      });
    }finally{URL.revokeObjectURL(url);curAudio=null}
  }
}

/* AI engines */
function sysPrompt(src,tgt,tone,kind,subStyle='film',familyFriendly=false,extraOpts={}){
  let p=`You are a professional translator and subtitler. Translate every string in the JSON array from ${langName(src)} to ${langName(tgt)}.`;
  if(kind==='sub'){
    if(subStyle==='film'){
      p+=' CRITICAL SUBTITLE STYLE: Natural, colloquial spoken film & television dialogue. The lines must read like authentic spoken screen dialogue in a modern movie or series, NOT formal, written, or textbook language.';
      if(tgt==='fa'||tgt.startsWith('fa-')){
        p+=' FOR PERSIAN SUBTITLES: You MUST use natural spoken Persian (فارسی محاوره‌ای و گفتاری سینمایی): use spoken contractions and verb forms (e.g. "نمیدونم" NOT "نمیدانم", "میخوام برم" NOT "میخواهم بروم", "داری چیکار میکنی؟" NOT "چه کار می‌کنی؟", "باید بریم" NOT "باید برویم", "چی شده؟", "ولش کن"), spoken suffixes (ـه instead of است), and natural conversational idioms. Avoid stiff bookish Persian.';
      }
      if(!familyFriendly){
        p+=' PROFANITY & SLANG: Keep swearing, vulgarity, curses, and street slang at the exact same emotional intensity and vulgarity as the original dialogue (e.g. translate fuck/shit/damn/asshole into authentic matching Persian swearing/slang like لعنتی، کثافت، عوضی، گندش بزنن، گه). Do NOT censor, soften, sanitize, or omit profanity.';
      }else{
        p+=' FAMILY-FRIENDLY: Soften or politely sanitize harsh profanity and vulgar slang into mild equivalents.';
      }
    }else if(subStyle==='formal'){
      p+=' SUBTITLE STYLE: Formal and literary tone with standard grammar.';
    }else{
      p+=' SUBTITLE STYLE: Balanced, neutral conversational tone.';
    }
    p+=' The strings are consecutive dialogue lines in a scene. Use neighbouring lines as context so short lines, pronouns, and character relationships make sense. Keep translated lines concise and punchy so viewers have ample time to read them on screen. Keep character names and recurring terms strictly consistent across the entire file.';
  }
  if(extraOpts.subject) p+=` DOCUMENT DOMAIN / SUBJECT: ${extraOpts.subject}. Translate domain and technical terminology strictly within this specialized field.`;
  if(extraOpts.register) p+=` REGISTER / TONE: ${extraOpts.register}.`;
  if(extraOpts.terms && extraOpts.terms.length){
    const validTerms = extraOpts.terms.filter(x=>x.s&&x.t);
    if(validTerms.length) p+=' KEY TECHNICAL TERMS (MUST ALWAYS USE THESE TRANSLATIONS): '+validTerms.map(x=>`"${x.s}" → "${x.t}"`).join('; ')+'.';
  }
  if(tone&&kind!=='sub')p+=` Use a ${tone} tone.`;
  const g=glossary.filter(x=>x.s&&x.t);
  if(g.length)p+=' Always use this glossary: '+g.map(x=>`"${x.s}" → "${x.t}"`).join('; ')+'.';
  p+=' Keep numbers, tags, placeholders and Markdown syntax unchanged. Do not merge, split, drop or reorder items.';
  if(extraOpts.includeNotes){
    p+=' TRANSLATOR NOTES: You may attach a short helpful translator note ONLY where a reader could be misled: an ambiguous technical term, an idiom or cultural reference, a term deliberately left untranslated, or a source nuance. Cap notes strictly at most one note per 10-15 segments on average. Do NOT explain common or obvious words. Format output as a JSON array of objects: [{"text":"<translation>","note":"<short note or null>"}, ...] with exactly the same number of items as the input.';
  } else {
    p+=' Reply with ONLY a JSON array of strings with exactly the same number of items as the input.';
  }
  return p;
}
function parseArr(txt,n,includeNotes=false){
  const s=String(txt).replace(/```(?:json)?/g,'').trim();
  let v;try{const a=s.indexOf('['),b=s.lastIndexOf(']');v=JSON.parse(a>=0&&b>a?s.slice(a,b+1):s)}catch{v=null}
  if(v&&!Array.isArray(v)&&typeof v==='object')v=Object.values(v).find(Array.isArray);
  if(n===1){
    if(includeNotes){
      if(Array.isArray(v)&&v.length>0){
        const x=v[0];
        if(x&&typeof x==='object'&&('text' in x||'t' in x)) return [{text:String(x.text??x.t??''),note:x.note?String(x.note).trim():null}];
        return [{text:typeof x==='string'?x:String(x??''),note:null}];
      }
      if(s) return [{text:s.replace(/^"|"$/g,''),note:null}];
    }else{
      if(Array.isArray(v)&&v.length>0){
        const x=v[0];
        if(x&&typeof x==='object'&&('text' in x||'t' in x)) return [String(x.text??x.t??'')];
        return [typeof x==='string'?x:String(x??'')];
      }
      if(s) return [s.replace(/^"|"$/g,'')];
    }
  }
  if(includeNotes){
    if(Array.isArray(v)&&v.length===n){
      return v.map(x=>{
        if(x&&typeof x==='object'&&('text' in x||'t' in x)){
          return {text:String(x.text??x.t??''),note:x.note?String(x.note).trim():null};
        }
        return {text:typeof x==='string'?x:String(x??''),note:null};
      });
    }
    const e=new Error('reply did not match the input lines');e.mismatch=true;throw e;
  }
  if(Array.isArray(v)&&v.length===n){
    return v.map(x=>{
      if(x&&typeof x==='object'&&('text' in x||'t' in x))return String(x.text??x.t??'');
      return typeof x==='string'?x:String(x??'');
    });
  }
  const e=new Error('reply did not match the input lines');e.mismatch=true;throw e;
}
async function eAI(id,items,o){
  const e=cfg.eng[id],sys=sysPrompt(o.src,o.tgt,o.tone,o.kind,o.subStyle,o.familyFriendly,o),user=JSON.stringify(items),signal=o.signal;let txt;
  if(id==='gemini'){
    // Ask the key which Gemini models it can use (a built-in model name may not exist for this key).
    const j=await withGeminiModel(e.key,'text',e.model,m=>fx(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`,{method:'POST',signal,
      headers:{'Content-Type':'application/json','x-goog-api-key':e.key},
      body:JSON.stringify({systemInstruction:{parts:[{text:sys}]},contents:[{role:'user',parts:[{text:user}]}],generationConfig:{temperature:0.2,responseMimeType:'application/json'}})}),signal);
    txt=(j.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('');
    if(!txt)throw new Error(j.promptFeedback?.blockReason||'empty reply');
  }else if(id==='claude'){
    const j=await fx('https://api.anthropic.com/v1/messages',{method:'POST',signal,
      headers:{'Content-Type':'application/json','x-api-key':e.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:e.model,max_tokens:8000,system:sys,messages:[{role:'user',content:user}]})});
    txt=(j.content||[]).map(c=>c.text||'').join('');
  }else{
    const h={'Content-Type':'application/json'};if(e.key)h.Authorization='Bearer '+e.key;
    const bodyObj={model:e.model,messages:[{role:'system',content:sys},{role:'user',content:user}]};
    if(id==='ollama'&&o.forDocument){
      const ka=(typeof window!=='undefined'&&window.__docOllamaKeepAlive!==undefined)
        ? window.__docOllamaKeepAlive
        : '30m';
      if(ka) bodyObj.keep_alive=ka;
    }
    const fxOpt={method:'POST',signal,headers:h,body:JSON.stringify(bodyObj)};
    if(o.timeout) fxOpt.timeout=o.timeout;
    const base=(e?.base||ENG[id]?.base||'http://localhost:11434/v1').replace(/\/+$/,'');
    const j=await fx(base+'/chat/completions',fxOpt);
    txt=j.choices?.[0]?.message?.content||'';
  }
  return parseArr(txt,items.length,!!o.includeNotes);
}
function cleanSpokenText(s){
  return String(s||'')
    .replace(/```[\s\S]*?```/g,'')
    .replace(/`([^`]+)`/g,'$1')
    .replace(/^#{1,6}\s+/gm,'')
    .replace(/(\*\*|__)(.*?)\1/g,'$2')
    .replace(/(\*|_)(.*?)\1/g,'$2')
    .replace(/^\s*[-*+]\s+/gm,'')
    .replace(/^\s*\d+\.\s+/gm,'')
    .replace(/\[([^\]]+)\]\([^)]+\)/g,'$1')
    .replace(/[*~_#>]/g,'')
    .replace(/\s+/g,' ')
    .trim();
}
async function eAIChat(id,messages,o){
  const e=cfg.eng[id],sys=o.system||'Answer concisely.',signal=o.signal;let txt='';
  if(id==='gemini'){
    const contents=messages.map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]}));
    const j=await withGeminiModel(e.key,'text',e.model,m=>fx(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`,{
      method:'POST',signal,
      headers:{'Content-Type':'application/json','x-goog-api-key':e.key},
      body:JSON.stringify({systemInstruction:{parts:[{text:sys}]},contents,generationConfig:{temperature:0.7}})}),signal);
    txt=(j.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('');
    if(!txt)throw new Error(j.promptFeedback?.blockReason||'empty reply');
  }else if(id==='claude'){
    const msgs=messages.map(m=>({role:m.role==='assistant'?'assistant':'user',content:m.content}));
    const j=await fx('https://api.anthropic.com/v1/messages',{
      method:'POST',signal,
      headers:{'Content-Type':'application/json','x-api-key':e.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:e.model,max_tokens:2000,system:sys,messages:msgs})});
    txt=(j.content||[]).map(c=>c.text||'').join('');
  }else{
    const h={'Content-Type':'application/json'};if(e.key)h.Authorization='Bearer '+e.key;
    const msgs=[{role:'system',content:sys},...messages.map(m=>({role:m.role,content:m.content}))];
    const bodyObj={model:e.model,messages:msgs,temperature:0.7};
    if(id==='ollama'&&o.forDocument){
      const ka=(typeof window!=='undefined'&&window.__docOllamaKeepAlive!==undefined)
        ? window.__docOllamaKeepAlive
        : '30m';
      if(ka) bodyObj.keep_alive=ka;
    }
    const fxOpt={method:'POST',signal,headers:h,body:JSON.stringify(bodyObj)};
    if(o.timeout) fxOpt.timeout=o.timeout;
    const base=(e?.base||ENG[id]?.base||'http://localhost:11434/v1').replace(/\/+$/,'');
    const j=await fx(base+'/chat/completions',fxOpt);
    txt=j.choices?.[0]?.message?.content||'';
  }
  return cleanSpokenText(txt);
}
async function chat(messages,o={}){
  const chain=(o.engine&&o.engine!=='auto'&&ENG[o.engine]?.ai?[o.engine]:cfg.order)
    .filter(id=>ENG[id]?.ai&&usable(id)&&(!isOff()||(id==='ollama'||(id==='custom'&&isLocalUrl(cfg.eng[id].base)))));
  if(!chain.length)throw new Error(L('noAiEngine'));
  let lastErr=null;
  for(let i=0;i<chain.length;i++){
    const id=chain[i];
    try{
      const res=await eAIChat(id,messages,o);
      if(!res)throw new Error('empty reply');
      return {text:res,used:ENG[id].name};
    }catch(e){
      if(e.name==='AbortError'||o.signal?.aborted)throw new DOMException('Aborted','AbortError');
      lastErr=e;
      if(isBlockError(e)){
        markBlocked(id);
        toast(`${ENG[id].name}: ${L('regionBlocked')}`,'warn',8000);
      }else if(i+1<chain.length){
        if(!o.silent) toast(`${ENG[id].name} ${L('failed')}: ${e.message} — ${L('switching')} ${ENG[chain[i+1]].name}`,'warn');
      }
    }
  }
  throw new Error(`${ENG[chain[chain.length-1]].name}: ${lastErr?.message||'failed'}`);
}
async function listModels(id){
  const e=cfg.eng[id];
  if(id==='gemini'){const j=await fx('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',{headers:{'x-goog-api-key':e.key}});
    return j.models.filter(m=>(m.supportedGenerationMethods||[]).includes('generateContent')).map(m=>m.name.replace('models/',''))}
  if(id==='claude'){const j=await fx('https://api.anthropic.com/v1/models',{headers:{'x-api-key':e.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'}});return j.data.map(m=>m.id)}
  if(id==='ollama')return await fetchOllamaModels();
  const h={};if(e.key)h.Authorization='Bearer '+e.key;
  const j=await fx(e.base.replace(/\/+$/,'')+'/models',{headers:h});return (j.data||[]).map(m=>m.id);
}

function callEngine(id,items,o){
  if(ENG[id].ai)return eAI(id,items,o);
  const arr=items.map(preGloss);
  let p;
  if(id==='google')p=eGoogle(arr,o.src,o.tgt,o.signal,o);
  else if(id==='mymemory')p=eMyMemory(arr,o.src,o.tgt,o.signal,o);
  else if(id==='nllb')p=eNllb(arr,o.src,o.tgt,o.signal,o.onStatus);
  else p=eChrome(arr,o.src,o.tgt,o.signal,o);
  if(o.includeNotes)return p.then(res=>res.map(x=>({text:x,note:null})));
  return p;
}
async function runBatch(id,arr,o){
  const mx=lim(id).chars;
  const getStr=s=>typeof s==='string'?s:(s?.text||'');
  if(arr.some(s=>getStr(s).length>mx)){
    const out=[];
    for(const s of arr){
      const str=getStr(s);
      if(str.length>mx){
        const r=[];
        for(const p of splitLong(str,mx)){
          const piece=(await callEngine(id,[p],o))[0];
          r.push(getStr(piece));
        }
        out.push(o.includeNotes?{text:r.join(' '),note:null}:r.join(' '));
      } else {
        out.push((await callEngine(id,[str],o))[0]);
      }
      o.onSubProgress?.(1,id);
    }
    return out;
  }
  try{
    const res=await callEngine(id,arr.map(getStr),o);
    o.onSubProgress?.(res.length,id);
    return res;
  }
  catch(e){
    if(e.name==='AbortError'||o.signal?.aborted) throw e;
    const isTimeout=e.isTimeout||e.name==='TimeoutError'||/timed?\s*out|did not answer/i.test(e.message||'');
    docDebugLog('runBatch catch', { errName: e?.name || 'Error', isTimeout: Boolean(isTimeout) });
    if(isTimeout) throw e;
    if((e.mismatch || (ENG[id]?.ai && !isBlockError(e) && e.status !== 429 && !/429|resource_exhausted|rate limit/i.test(e.message||''))) && arr.length > 1){
      const h=arr.length>>1;
      return [...await runBatch(id,arr.slice(0,h),o), ...await runBatch(id,arr.slice(h),o)];
    }
    throw e;
  }
}
/* core: translate a list of strings with batching + fallback chain */
let tipShown=false;
async function translateItems(items,o){
  const chain=o.chain||(o.engine==='auto'?cfg.order.filter(usable):[o.engine]);
  if(!chain.length)throw new Error(L(isOff()?'noOff':'noEngine'));
  if (!docLogStart) docLogStart = Date.now();
  const out=new Array(items.length),notes=new Array(items.length),todo=[],used=new Set();
  items.forEach((s,i)=>{if(s&&s.trim())todo.push(i);else{out[i]=s||'';notes[i]=null}});
  if(todo.length>80&&!ENG[chain[0]].ai&&!tipShown){tipShown=true;toast(L('tipKey'),'warn',7000)}
  let pos=0,ci=0,rateWaits=0;
  let ollamaSuccessCount=0;
  const firstId=chain[0],firstLm=lim(firstId);
  const startReqTimeout=(firstId==='ollama')
    ? ((typeof window!=='undefined'&&window.__docOllamaFirstTimeoutMs!==undefined) ? window.__docOllamaFirstTimeoutMs : 180000)
    : (o.timeout ?? ((typeof window!=='undefined'&&window.__docTimeoutMs) ? window.__docTimeoutMs : 20000));
  const startRetryTimeout=(typeof window!=='undefined'&&window.__docOllamaTimeoutMs!==undefined)
    ? window.__docOllamaTimeoutMs
    : 90000;
  docDebugLog('translateItems start', {
    chain: chain.slice(),
    reqTimeout: startReqTimeout,
    retryTimeout: startRetryTimeout,
    segments: items.length,
    batches: Math.max(1, Math.ceil(todo.length / (firstLm.items || 1)))
  });
  while(pos<todo.length){
    if(o.signal?.aborted)throw new DOMException('Aborted','AbortError');
    const id=chain[ci],lm=lim(id);
    let b=[];let chars=0;
    while(pos+b.length<todo.length&&b.length<lm.items){const s=items[todo[pos+b.length]];if(b.length&&chars+s.length>lm.chars)break;b.push(todo[pos+b.length]);chars+=s.length}
    let reqTimeout;
    if(id==='ollama'){
      if(ollamaSuccessCount===0){
        reqTimeout=(typeof window!=='undefined'&&window.__docOllamaFirstTimeoutMs!==undefined)
          ? window.__docOllamaFirstTimeoutMs
          : 180000;
      }else{
        reqTimeout=(typeof window!=='undefined'&&window.__docOllamaTimeoutMs!==undefined)
          ? window.__docOllamaTimeoutMs
          : 90000;
      }
    }else{
      reqTimeout=o.timeout ?? (typeof window!=='undefined'&&window.__docTimeoutMs ? window.__docTimeoutMs : 20000);
    }
    let batchDone=0;
    const subOpts=Object.assign({},o,{
      timeout:reqTimeout,
      onSubProgress:(count,engId)=>{
        batchDone+=count;
        o.onProgress?.(pos+batchDone,todo.length,engId);
      }
    });

    let ollamaTimer=null;
    let ollamaTickerSec=0;
    const startOllamaProg=()=>{
      if(id!=='ollama') return;
      if(ollamaTimer){clearInterval(ollamaTimer);ollamaTimer=null;}
      ollamaTickerSec=0;
      const isFirst=(ollamaSuccessCount===0);
      docDebugLog('ticker start', { isFirst });
      const getTxt=s=>{
        if(ui==='fa'){
          return isFirst
            ? `در حال انتظار برای Ollama… ${s} ثانیه (پاسخ اول ممکن است در حین بارگذاری مدل یک دقیقه طول بکشد)`
            : `در حال انتظار برای Ollama… ${s} ثانیه`;
        }
        return isFirst
          ? `Waiting for Ollama… ${s} s (the first answer can take a minute while the model loads)`
          : `Waiting for Ollama… ${s} s`;
      };
      o.onStatus?.(getTxt(0));
      ollamaTimer=setInterval(()=>{
        ollamaTickerSec++;
        if(o.signal?.aborted){clearInterval(ollamaTimer);ollamaTimer=null;return;}
        o.onStatus?.(getTxt(ollamaTickerSec));
      },1000);
    };
    const stopOllamaProg=()=>{
      if(ollamaTimer){clearInterval(ollamaTimer);ollamaTimer=null;}
      docDebugLog('ticker stop', { sec: ollamaTickerSec });
    };

    const makeOllamaTimeoutErr=(totalWaitMs)=>{
      const sec=Math.round((totalWaitMs ?? reqTimeout)/1000);
      const msg=ui==='fa'
        ? `Ollama در مدت ${sec} ثانیه پاسخی نداد. یک مدل کوچک‌تر را امتحان کنید یا منتظر بارگذاری مدل بمانید.`
        : `Ollama did not answer within ${sec} seconds. Try a smaller model or wait for the model to load.`;
      const err=new Error(msg);
      err.name='TimeoutError';
      err.isTimeout=true;
      err.ollamaTimeoutSec=sec;
      return err;
    };

    let attemptNum=0;
    const runBatchAttempt=async(indices, attemptTimeout)=>{
      attemptNum++;
      const timeoutMs = attemptTimeout !== undefined ? attemptTimeout : reqTimeout;
      docDebugLog('runBatchAttempt start', { attempt: attemptNum, timeout: timeoutMs, items: indices.length });
      const attemptCtl = new AbortController();
      const onParentAbort = () => attemptCtl.abort();
      if (o.signal) o.signal.addEventListener('abort', onParentAbort, { once: true });
      startOllamaProg();
      try{
        const attemptSubOpts=Object.assign({},subOpts,{timeout:timeoutMs, signal:attemptCtl.signal});
        const batchPromise=runBatch(id,indices.map(i=>items[i]),attemptSubOpts);
        return o.forDocument
          ? await withTimeout(batchPromise, timeoutMs, attemptCtl.signal, `${ENG[id].name} did not answer`)
          : await batchPromise;
      }finally{
        attemptCtl.abort();
        if (o.signal) o.signal.removeEventListener('abort', onParentAbort);
        stopOllamaProg();
      }
    };

    try{
      if(id!=='ollama'){
        o.onStatus?.(ui==='fa'?`در حال ترجمه با ${ENG[id].name}…`:`Translating with ${ENG[id].name}…`);
      }
      let res;
      try{
        res=await runBatchAttempt(b);
      }catch(err){
        if(err.name==='AbortError'||o.signal?.aborted) throw err;
        const isTimeout=err.isTimeout||err.name==='TimeoutError'||/timed?\s*out|did not answer/i.test(err.message||'');
        if(id==='ollama'&&isTimeout){
          // Retry ONCE with half the batch size before giving up, using the normal allowance
          const retryTimeout=(typeof window!=='undefined'&&window.__docOllamaTimeoutMs!==undefined)
            ? window.__docOllamaTimeoutMs
            : 90000;
          const half=Math.max(1,Math.floor(b.length/2));
          const halfB=b.slice(0,half);
          docDebugLog('retry start', { timeout: retryTimeout, items: halfB.length });
          try{
            res=await runBatchAttempt(halfB, retryTimeout);
            b=halfB;
          }catch(retryErr){
            if(retryErr.name==='AbortError'||o.signal?.aborted) throw retryErr;
            const totalWaitMs = reqTimeout + retryTimeout;
            throw makeOllamaTimeoutErr(totalWaitMs);
          }
        }else{
          throw err;
        }
      }
      if(id==='ollama') ollamaSuccessCount++;
      b.forEach((i,k)=>{
        const resItem=res[k];
        if(resItem&&typeof resItem==='object'&&('text' in resItem||'t' in resItem)){
          out[i]=String(resItem.text??resItem.t??'');
          notes[i]=resItem.note?String(resItem.note).trim():null;
        }else{
          out[i]=typeof resItem==='string'?resItem:String(resItem??'');
          notes[i]=null;
        }
      });
      pos+=b.length;used.add(id);rateWaits=0;
      o.onBatch?.(b,res,out,notes);o.onProgress?.(pos,todo.length,id);
    }catch(e){
      if(e.name==='AbortError'||o.signal?.aborted)throw new DOMException('Aborted','AbortError');
      if(e.silent||e.isChromeSkip){
        if(ci+1<chain.length){
          ci++;
          o.onEngineChange?.(chain[ci]);
          continue;
        }else{
          throw new Error(ENG[id].name+': '+(ui==='fa'?'مدل ترجمه روی دستگاه در دسترس نیست':'on-device translator is not available'));
        }
      }
      const isTimeout=e.isTimeout||e.name==='TimeoutError'||/timed?\s*out|did not answer/i.test(e.message||'');
      if(isTimeout){
        if(ci+1<chain.length && (!isOff() || offCapable(chain[ci+1]))){
          const nextName=ENG[chain[ci+1]].name;
          const msg=ui==='fa'
            ?`${ENG[id].name} پاسخی نداد، تلاش با ${nextName}…`
            :`${ENG[id].name} did not answer, trying ${nextName}…`;
          o.onStatus?.(msg);
          ci++;
          continue;
        }else{
          if(e.ollamaTimeoutSec){
            throw e;
          }
          const msg=ui==='fa'
            ?`${ENG[id].name} پاسخی نداد`
            :`${ENG[id].name} did not answer`;
          const te=new Error(msg);
          te.name='TimeoutError';
          te.isTimeout=true;
          throw te;
        }
      }
      const is429=e.status===429||/429|resource_exhausted|rate limit|quota/i.test(e.message||'');
      if(is429){
        let waitSec=4;
        const waitMatch=(e.message||'').match(/retry in (\d+(?:\.\d+)?)s/i) || (e.message||'').match(/retry after (\d+)/i);
        if(waitMatch) waitSec=Math.ceil(parseFloat(waitMatch[1]));
        if(ci+1<chain.length){
          o.onStatus?.(ui==='fa'?`محدودیت نرخ ${ENG[id].name} — تغییر به ${ENG[chain[ci+1]].name}…`:`Rate limit on ${ENG[id].name} — switching to ${ENG[chain[ci+1]].name}…`);
          toast(`${ENG[id].name} (429 Rate Limit) — ${L('switching')} ${ENG[chain[ci+1]].name}`,'warn',6000);
          ci++;
          o.onEngineChange?.(chain[ci]);
          continue;
        }else{
          // Last engine left: wait and try again, but only a few times; then say so instead of waiting forever.
          if(++rateWaits>3)throw new Error(`${ENG[id].name}: ${L('rateLimited')}`);
          waitSec=Math.min(waitSec,20);
          o.onStatus?.(ui==='fa'?`در حال انتظار برای ${ENG[id].name} (محدودیت نرخ، ${waitSec} ثانیه)…`:`Waiting for ${ENG[id].name} (rate limit, ${waitSec}s)…`);
          toast(`${ENG[id].name} (429 Rate Limit) — waiting ${waitSec}s as requested by provider…`,'warn',4000);
          await sleepAbortable(waitSec*1000,o.signal);
          continue;
        }
      }
      if(isBlockError(e)){
        markBlocked(id);
        toast(`${ENG[id].name}: ${L('regionBlocked')}`,'warn',8000);
      }
      if(ci+1<chain.length){
        o.onStatus?.(ui==='fa'?`${ENG[id].name} ناموفق بود — تغییر به ${ENG[chain[ci+1]].name}…`:`${ENG[id].name} failed — switching to ${ENG[chain[ci+1]].name}…`);
        if(!isBlockError(e)) toast(`${ENG[id].name} ${L('failed')}: ${e.message} — ${L('switching')} ${ENG[chain[ci+1]].name}`,'warn');
        ci++;
        o.onEngineChange?.(chain[ci]);
      }else throw new Error(`${ENG[id].name}: ${isBlockError(e)?L('regionBlocked'):plainWithDetail(e)}`);
    }
  }
  return {out,notes,used:[...used].map(engLabel).join(' + ')};
}
// Plain reason first ("key rejected"), then what the provider said (already scrubbed of keys).
function plainWithDetail(e){const p=toPlainReason(e),m=String(e.message||'');return p&&m&&p!==m?`${p} — ${m}`:(p||m)}
// Finglish is not a language any engine knows: the text is converted to Persian first (see finglishStep), other tabs treat it as 'detect'.
let srcOverride=null;
const opts=extra=>Object.assign({
  src:srcOverride||($('src').value==='finglish'?'auto':$('src').value),
  tgt:$('tgt').value,
  engine:$('engine').value,
  tone:$('tone').value,
  subStyle:$('subStyle')?.value||'film',
  familyFriendly:!!$('subFamily')?.checked,
  subject:$('tSubject')?.value?.trim()||'',
},extra);

/* ---------- ui helpers ---------- */
function toast(msg,kind='',ms=4200){const d=document.createElement('div');d.className='toast '+kind;d.textContent=scrubKeys(msg);$('toasts').append(d);setTimeout(()=>d.remove(),ms)}
function openOfflineSettings(){
  renderEngines();
  let ok=0,total=cfg.order.length;
  cfg.order.forEach(id=>{if(engineConnStatus[id]?.code==='works')ok++});
  if(Object.keys(engineConnStatus).length&&$('checkConnSummary'))$('checkConnSummary').textContent=`${ok}/${total} ${L('connWorks')}`;
  $('ov').classList.add('on');
  if(typeof switchSettingsTab==='function')switchSettingsTab('secTrModels');
  setTimeout(()=>{
    const target=document.querySelector('[data-t="offH"]')||$('nllbDot');
    target?.scrollIntoView({behavior:'smooth',block:'center'});
  },50);
}
function showOfflineGuidance(errReason,targetEl){
  const text=L('offHelp');
  document.querySelectorAll('#offHelpToast').forEach(t=>t.remove());
  const d=document.createElement('div');
  d.className='toast warn has-action';
  d.id='offHelpToast';
  const span=document.createElement('span');
  span.textContent=text;
  span.style.flex='1';
  const btn=document.createElement('button');
  btn.className='btn';
  btn.id='offHelpBtn';
  btn.style.padding='4px 10px';
  btn.style.fontSize='12px';
  btn.style.whiteSpace='nowrap';
  btn.textContent=L('engines');
  btn.onclick=()=>{d.remove();openOfflineSettings()};
  d.appendChild(span);
  d.appendChild(btn);
  $('toasts').append(d);
  setTimeout(()=>d.remove(),14000);

  if(targetEl){
    targetEl.innerHTML='';
    const wrap=document.createElement('span');
    wrap.id='offHelpMeta';
    wrap.className='off-help-line';
    wrap.style.display='inline-flex';
    wrap.style.alignItems='center';
    wrap.style.gap='8px';
    wrap.style.color='var(--warn)';
    const s=document.createElement('span');
    s.textContent=text;
    const b=document.createElement('button');
    b.className='btn ghost';
    b.id='offHelpMetaBtn';
    b.style.padding='2px 8px';
    b.style.fontSize='11.5px';
    b.textContent=L('engines');
    b.onclick=()=>openOfflineSettings();
    wrap.appendChild(s);
    wrap.appendChild(b);
    targetEl.appendChild(wrap);
  }
}
function fail(e){if(e.name==='AbortError')toast(L('stopped'),'warn');else if(isOff())showOfflineGuidance(e.message);else toast(e.message,'err',7000)}
async function copy(s){try{await navigator.clipboard.writeText(s);toast(L('copied'),'ok',1500)}catch{toast('Clipboard blocked','err')}}