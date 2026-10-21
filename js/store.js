'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// A wait that the Stop button can cut short.
const sleepAbortable=(ms,signal)=>new Promise((res,rej)=>{
  if(signal?.aborted)return rej(new DOMException('Aborted','AbortError'));
  const ab=()=>{clearTimeout(t);rej(new DOMException('Aborted','AbortError'))};
  const t=setTimeout(()=>{signal?.removeEventListener('abort',ab);res()},ms);
  signal?.addEventListener('abort',ab,{once:true});
});
const mem={};
const store={
  get(k,d){try{const v=localStorage.getItem('mkt_'+k);return v==null?(k in mem?mem[k]:d):JSON.parse(v)}catch{return k in mem?mem[k]:d}},
  set(k,v){mem[k]=v;try{localStorage.setItem('mkt_'+k,JSON.stringify(v))}catch{}}
};

function sanitizePhoneModelChoices() {
  if (typeof window === 'undefined' || !window.isPhone || !window.isPhone()) return;
  try {
    if (typeof store !== 'undefined') {
      const eng = store.get('engine');
      if (eng === 'nllb') {
        store.set('engine', 'google');
      }
      const vEng = store.get('voiceTransEngine');
      if (vEng === 'nllb') {
        store.set('voiceTransEngine', 'google');
      }
      const w = store.get('whisper');
      if (w && !['tiny', 'base', 'small'].includes(w)) {
        store.set('whisper', 'base');
      }
      const tr = store.get('trModel');
      if (tr && tr !== 'auto') {
        store.set('trModel', 'auto');
      }
    }
    if (typeof cfg !== 'undefined') {
      if (cfg.whisper && !['tiny', 'base', 'small'].includes(cfg.whisper)) {
        cfg.whisper = 'base';
        if (typeof saveCfg === 'function') saveCfg();
      }
      if (cfg.trModel && cfg.trModel !== 'auto') {
        cfg.trModel = 'auto';
        if (typeof saveCfg === 'function') saveCfg();
      }
      if (cfg.engine === 'nllb') {
        cfg.engine = 'google';
        if (typeof saveCfg === 'function') saveCfg();
      }
    }
  } catch (_) {}
}

if (typeof window !== 'undefined') {
  window.sanitizePhoneModelChoices = sanitizePhoneModelChoices;
}
sanitizePhoneModelChoices();
