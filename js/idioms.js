/* ---------- IDIOMS ---------- */
const mk=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n};
const idiomOpts=()=>({ui,chain:getAiEngineChain(),src:$('src').value,tgt:$('tgt').value});
// The stored entry (from the packs' phrases lists) comes first and at once; the AI explanation follows when an AI engine exists.
async function renderIdiomInto(box,text){
  box.replaceChildren();
  await dictReady;
  const stored=await MakanDict.lookupPhrase(text,{hints:{to:$('tgt').value},showVulgar:showVulgar()}).catch(()=>null);
  let aiMeaning='';
  const sep=stored&&['fa','ar','he','ur'].includes(stored.to)?'، ':'; ';
  if(stored){
    const head=mk('div','dict-head');head.append(mk('span','w',stored.headword),mk('span','dict-idiom',L('idStored')));
    box.append(head);
    const m=mk('div','dict-meanings',stored.meanings.slice(0,4).join(sep));m.dir='auto';box.append(m);
    if(stored.example){const x=mk('div','dict-ex',stored.example);x.dir='auto';box.append(x)}
  }
  const save=mk('button','btn ghost',L('idSave'));save.type='button';save.id='idSave';
  save.onclick=()=>{saveWord({w:stored?stored.headword:text,pair:'idiom',pos:'idiom',idiom:true,meanings:[stored?stored.meanings[0]:aiMeaning].filter(Boolean)});save.textContent=L('dictSaved')};
  if(!aiAvailable()){
    box.append(mk('p','hint',stored?L('idNoAiStored'):L('idNoAiNone')));
    if(stored)box.append(save);
    return;
  }
  const out=mk('div','dict-ai',L('idAsking'));box.append(out);
  try{
    const r=await explainIdiomAi(text,idiomOpts(),cfg);
    out.replaceChildren();out.style.whiteSpace='normal';
    if(!r.isIdiom&&!stored){out.textContent=L('idNotIdiom');return}
    aiMeaning=r.meaning;
    out.append(mk('div','dict-pos',L('idAiH')));
    const dl=mk('dl','idiom-box');
    const row=(k,v)=>{if(!v)return;dl.append(mk('dt',null,L(k)));const dd=mk('dd',null,v);dd.dir='auto';dl.append(dd)};
    row('idMeaning',r.meaning);row('idLiteral',r.literal);row('idEquivalent',r.equivalent);row('idRegister',r.register);
    if(r.examples.length){dl.append(mk('dt',null,L('idExamples')));const dd=mk('dd');
      for(const x of r.examples){const a=mk('div',null,x.text);a.dir='auto';const b=mk('div','dict-ex',x.translation);b.dir='auto';dd.append(a,b)}
      dl.append(dd)}
    out.append(dl);
    box.append(save);
  }catch(e){out.textContent=scrubKeys(plainFailure(e))}
}
async function idSearch(){const raw=$('idSearch').value.trim();const box=$('idResult');if(!raw){box.replaceChildren();return}const fg=await finglishWord(raw);await renderIdiomInto(box,fg.text);if(fg.persian)box.prepend(fgBox(fg.persian))}
$('idGo').onclick=idSearch;
$('idSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();idSearch()}});
// Reverse search: describe a meaning, get idioms in both languages (AI only).
async function idFind(){
  const d=$('idDescribe').value.trim(),box=$('idFindResult');box.replaceChildren();if(!d)return;
  if(!aiAvailable()){box.append(mk('p','hint',L('idFindNoAi')));return}
  const wait=mk('div','dict-ai',L('idAsking'));box.append(wait);
  try{
    const list=await findIdiomsAi(d,idiomOpts(),cfg);
    box.replaceChildren();
    if(!list.length){box.append(mk('p','hint',L('idNoMatch')));return}
    for(const lang of ['en','fa']){
      const part=list.filter(x=>x.language===lang);if(!part.length)continue;
      box.append(mk('div','dict-pos',lang==='fa'?'فارسی':'English'));
      for(const x of part){
        const row=mk('div','dict-entry');const h=mk('div','dict-head');const w=mk('button','btn ghost',x.idiom);w.type='button';w.className+=' id-hit';w.dir='auto';
        w.onclick=()=>{$('idSearch').value=x.idiom;idSearch();$('idSearch').scrollIntoView({block:'center'})};
        h.append(w);row.append(h);
        const m=mk('div','dict-meanings',x.meaning);m.dir='auto';row.append(m);
        if(x.equivalent){const q=mk('div','dict-ex',`${L('idEquivalent')}: ${x.equivalent}`);q.dir='auto';row.append(q)}
        box.append(row);
      }
    }
  }catch(e){box.replaceChildren(mk('p','hint',scrubKeys(plainFailure(e))))}
}
$('idFind').onclick=idFind;
$('idDescribe').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();idFind()}});

// ---- the idiom card (Text tab) ----
async function showIdiomCard(text,x,y){
  const seq=++wordCardSeq,card=$('wordCard');
  card.replaceChildren();const box=document.createElement('div');card.append(box);
  card.style.left=Math.max(8,Math.min(x,innerWidth-380))+'px';card.style.top=Math.min(y+14,innerHeight-160)+'px';card.hidden=false;
  await renderIdiomInto(box,text);
  if(seq!==wordCardSeq)hideWordCard();
}

// ---- Text tab: idioms in the source text get a subtle underline ----
// Stored idioms are marked with no AI; when an AI engine translated the text, the idioms it finds are marked too.
let idiomAiList=[];
const markBack=mk('div','mark-back');markBack.id='tInBack';markBack.dir='auto';markBack.setAttribute('aria-hidden','true');
{const ta=$('tIn'),wrap=mk('div','mark-wrap');ta.parentNode.insertBefore(wrap,ta);wrap.append(markBack,ta);ta.addEventListener('scroll',()=>{markBack.scrollTop=ta.scrollTop})}
let idiomRanges=[];
const isMarkable=p=>{const n=p.headword.trim().split(/\s+/).length;return n>=2&&p.pos!=='interjection'&&!(p.pos==='phrase'&&n<=3)};
async function storedIdiomRanges(text){
  const pair=await MakanDict.guessPair(text,{to:$('tgt').value});if(!pair)return [];
  const idx=await MakanDict.phraseIndex(pair);if(!idx)return [];
  const toks=[...text.matchAll(/[\p{L}\p{M}\p{N}'’]+/gu)].map(m=>({s:m.index,e:m.index+m[0].length,n:MakanDict.normalize(m[0],idx.lang)}));
  const out=[];
  for(let i=0;i<toks.length;){
    let hit=0;
    for(let n=Math.min(idx.maxWords,toks.length-i);n>=2;n--){
      const key=toks.slice(i,i+n).map(t=>t.n).join(' ');
      const list=idx.byLookup.get(key);
      if(list&&list.some(isMarkable)&&!(!showVulgar()&&list.every(p=>MakanDict.isVulgarWord(p.headword,idx.lang)))){hit=n;break}
    }
    if(hit){out.push({s:toks[i].s,e:toks[i+hit-1].e});i+=hit}else i++;
  }
  return out;
}
function aiIdiomRanges(text){
  const out=[],low=text.toLowerCase();
  for(const x of idiomAiList){const k=x.toLowerCase();let i=0;while((i=low.indexOf(k,i))>=0){out.push({s:i,e:i+k.length});i+=k.length}}
  return out;
}
function mergeRanges(a){
  a.sort((x,y)=>x.s-y.s||y.e-x.e);const out=[];
  for(const r of a){const last=out[out.length-1];if(last&&r.s<last.e)last.e=Math.max(last.e,r.e);else out.push({s:r.s,e:r.e})}
  return out;
}
function paintMarks(){
  const t=$('tIn').value;let html='',pos=0;
  for(const r of idiomRanges){html+=esc(t.slice(pos,r.s))+'<mark>'+esc(t.slice(r.s,r.e))+'</mark>';pos=r.e}
  markBack.innerHTML=html+esc(t.slice(pos))+'\n';
  markBack.scrollTop=$('tIn').scrollTop;
}
let marksSeq=0;
async function refreshMarks(){
  const seq=++marksSeq,text=$('tIn').value;
  if(!text.trim()){idiomRanges=[];paintMarks();return}
  let stored=[];try{stored=await storedIdiomRanges(text)}catch{}
  if(seq!==marksSeq)return;
  idiomRanges=mergeRanges([...stored,...aiIdiomRanges(text)]);paintMarks();
}
let marksTimer=null;
$('tIn').addEventListener('input',()=>{clearTimeout(marksTimer);marksTimer=setTimeout(refreshMarks,250)});
new ResizeObserver(()=>paintMarks()).observe($('tIn'));
async function markIdiomsAi(text){
  try{
    const list=await detectIdiomsAi(text,idiomOpts(),cfg);
    if($('tIn').value!==text)return;
    idiomAiList=list;refreshMarks();
  }catch{}
}
// Clicking a marked idiom opens the idiom card instead of the word card.
$('tIn').addEventListener('click',e=>{
  const ta=$('tIn');if(ta.selectionStart!==ta.selectionEnd)return;
  const i=ta.selectionStart,r=idiomRanges.find(x=>i>=x.s&&i<=x.e);
  if(r){e.stopImmediatePropagation();showIdiomCard(ta.value.slice(r.s,r.e),e.clientX,e.clientY)}
},true);
refreshMarks();
