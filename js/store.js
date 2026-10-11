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
