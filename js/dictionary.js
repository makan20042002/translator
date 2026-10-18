/* ---------- OFFLINE DICTIONARY (packs from Wiktionary, CC BY-SA; see extension/dictionary.js) ---------- */
// The packs on offer come from dict/packs.json (generated from the folders under dict/): nothing is hard-coded per language.
let DICT_PAIRS=[];
const langLabel=c=>{const l=LANGS.find(x=>x[0]===c);return l?l[1].split(' · ').pop():c.toUpperCase()};
const packName=id=>{const i=MakanDict.PAIR_INFO[id];return i?`${langLabel(i.from)} → ${langLabel(i.to)}`:id};
const dictBytes=pair=>async rel=>{const i=MakanDict.PAIR_INFO[pair];const r=await fetch(`dict/${i.dir}/${rel}`);if(!r.ok)throw new Error('dictionary file '+rel+': HTTP '+r.status);return r.arrayBuffer()};
const dictReady=fetch('dict/packs.json').then(r=>r.ok?r.json():{packs:[]}).catch(()=>({packs:[]})).then(l=>{
  MakanDict.setPacks(l.packs);DICT_PAIRS=l.packs.map(p=>p.id);dictBuildUi();return DICT_PAIRS;
});
function dictBuildUi(){
  const box=$('dictPackRows');box.innerHTML='';
  for(const id of DICT_PAIRS){
    const i=MakanDict.PAIR_INFO[id],mb=(i.bytes/1048576).toFixed(1);
    const row=document.createElement('div');row.className='dlrow';
    row.innerHTML=`<span class="dot" id="dictDot-${id}"></span><strong>${esc(L('tabDict'))} · ${esc(packName(id))} · ~${mb} MB · ${i.entries}</strong><span class="sp"></span><span class="meta" id="dictSt-${id}"></span><button class="btn" id="dictDl-${id}" type="button">${esc(L('download'))}</button><button class="btn ghost" id="dictRm-${id}" type="button" hidden>${esc(L('dictRemove'))}</button>`;
    box.append(row);
    $('dictDl-'+id).onclick=async()=>{
      const btn=$('dictDl-'+id),st=$('dictSt-'+id);btn.disabled=true;
      try{
        await MakanDict.install(id,{getBytes:dictBytes(id),onProgress:f=>{st.textContent=`${L('dictDownloading')} ${Math.round(f*100)}%`}});
        toast(L('ready'),'ok');
      }catch(e){toast(scrubKeys(e.message||e),'err')}
      btn.disabled=false;dictRefreshPacks();
    };
    $('dictRm-'+id).onclick=async()=>{await MakanDict.remove(id);dictRefreshPacks()};
  }
  // the pair menu of the Dictionary tab
  const sel=$('dcPair'),cur=sel.value;
  sel.innerHTML=`<option value="">${esc(L('dictAuto'))}</option>`+DICT_PAIRS.map(id=>`<option value="${id}">${esc(packName(id))}</option>`).join('');
  sel.value=cur&&DICT_PAIRS.includes(cur)?cur:'';
  dictRefreshPacks();
}
async function dictRefreshPacks(){
  for(const pair of DICT_PAIRS){
    const st=await MakanDict.status(pair);
    const dot=$('dictDot-'+pair),stEl=$('dictSt-'+pair);if(!dot)continue;
    dot.classList.toggle('ok',!!st);stEl.textContent=st?`${L('ready')} · ${st.entries}`:L('notDl');
    $('dictRm-'+pair).hidden=!st;$('dictDl-'+pair).hidden=!!st;
  }
}
const showVulgar=()=>!!store.get('showVulgar',false);
$('dcVulgar').checked=showVulgar();
$('dcVulgar').onchange=()=>{store.set('showVulgar',$('dcVulgar').checked);if($('dcSearch').value.trim())dictSearch()};

// ---- my words (local only) ----
const myWords=()=>store.get('words',[]);
function saveWord(w){const l=myWords();if(l.some(x=>x.w===w.w&&x.pair===w.pair&&x.pos===w.pos))return;l.unshift(Object.assign({ts:Date.now()},w));store.set('words',l.slice(0,2000));renderMyWords()}
function removeWord(i){const l=myWords();l.splice(i,1);store.set('words',l);renderMyWords()}
function renderMyWords(){
  const l=myWords(),box=$('dcWords');if(!box)return;
  $('dcWordCount').textContent=l.length?String(l.length):'';
  box.innerHTML=l.map((x,i)=>`<div class="my-word"><strong dir="auto">${esc(x.w)}</strong><span class="meta">${x.idiom?esc(L('idIdiomBadge')):esc(x.pos||'')}</span><span dir="auto" style="flex:1">${esc((x.meanings||[]).join(x.pair==='en-fa'?'، ':'; '))}</span><button class="btn ghost" data-rm="${i}" type="button" aria-label="Remove">✕</button></div>`).join('');
}
$('dcWords').addEventListener('click',e=>{const b=e.target.closest('[data-rm]');if(b)removeWord(+b.dataset.rm)});
$('dcClear').onclick=()=>{store.set('words',[]);renderMyWords()};
const csvCell=v=>{let t=String(v==null?'':v);if(/^[=+\-@\t\r]/.test(t))t="'"+t;return /[",\n\r]/.test(t)?'"'+t.replace(/"/g,'""')+'"':t};
function wordsCsv(){
  const rows=[['word','pair','part_of_speech','meanings','saved_at'],...myWords().map(x=>[x.w,x.pair,x.pos||'',(x.meanings||[]).join('; '),new Date(x.ts).toISOString()])];
  return rows.map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
$('dcExport').onclick=()=>download('makan-my-words.csv',wordsCsv(),'text/csv');
renderMyWords();

// ---- rendering an entry (text only) ----
function dictRender(res,box,opts={}){
  box.replaceChildren();
  const toFa=['fa','ar','he','ur'].includes(res.to),sep=toFa?'، ':'; ';
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n};
  if(!res.groups.length&&!res.extra.length&&!res.phrases.length){box.append(el('p','hint',res.hidden?L('dictHidden'):L('dictNotFound')));return}
  if(res.hidden)box.append(el('p','hint',L('dictHiddenSome')));
  for(const g of res.groups){
    box.append(el('div','dict-pos',g.pos));
    for(const e of g.entries){
      const row=el('div','dict-entry');
      const head=el('div','dict-head');head.append(el('span','w',e.headword));
      const saved=myWords().some(x=>x.w===e.headword&&x.pair===res.pair&&x.pos===g.pos);
      const sb=el('button','btn ghost',saved?L('dictSaved'):L('dictSave'));sb.type='button';sb.className+=' dict-save';
      sb.onclick=()=>{saveWord({w:e.headword,pair:res.pair,pos:g.pos,meanings:e.meanings.slice(0,5)});sb.textContent=L('dictSaved')};
      head.append(sb);row.append(head);
      if(e.viaForm)row.append(el('div','dict-via',`${e.viaForm.form} — ${L('dictFormOf')} ${e.headword}${e.viaForm.tags&&e.viaForm.tags.length?' ('+e.viaForm.tags.join(', ')+')':''}`));
      const m=el('div','dict-meanings',e.meanings.slice(0,6).join(sep));m.dir='auto';row.append(m);
      if(e.example){const x=el('div','dict-ex',e.example);x.dir='auto';row.append(x)}
      if(e.forms&&e.forms.length)row.append(el('div','dict-forms',`${L('dictForms')}: ${e.forms.slice(0,8).map(f=>f.form).join(', ')}`));
      box.append(row);
    }
  }
  if(res.extra.length){const x=el('div','dict-extra',`${L('dictAlso')}: ${res.extra.slice(0,6).map(x=>x.headword).join(sep)}`);x.dir='auto';box.append(x)}
  if(res.phrases.length){
    box.append(el('div','dict-pos',L('dictPhrases')));
    for(const p of res.phrases.slice(0,opts.maxPhrases||12)){
      const row=el('div','dict-entry');
      const h=el('div','dict-head');h.append(el('span','w',p.headword),el('span','dict-idiom','idiom'));row.append(h);
      const m=el('div','dict-meanings',p.meanings.slice(0,3).join(sep));m.dir='auto';row.append(m);
      if(p.example){const x=el('div','dict-ex',p.example);x.dir='auto';row.append(x)}
      box.append(row);
    }
  }
}
// "Explain with AI": usage, register and examples from the Smart engine, shown after (never instead of) the entry.
async function dictExplain(word,box,btn){
  const out=document.createElement('div');out.className='dict-ai';out.textContent=L('dictExplaining');box.append(out);
  if(btn)btn.disabled=true;
  try{
    const ui=L('dictAiAsk');
    const txt=await chat([{role:'user',content:`${ui}\n\n${word}`}],{system:`You are a concise bilingual (English/Persian) dictionary assistant. Answer in ${ui==='fa'?'Persian':'English'}.`});
    out.textContent=txt;
  }catch(e){out.textContent=e&&e.message&&!/noAi/.test(e.message)?scrubKeys(e.message):L('dictNoAi')}
  if(btn)btn.disabled=false;
}
const aiAvailable=()=>cfg.order.some(id=>(typeof isAiEngineReady==='function'?isAiEngineReady(id):(typeof ENG!=='undefined'&&ENG.isAiEngineReady?ENG.isAiEngineReady(id):false)));

// ---- the Dictionary tab ----
async function dictSearch(){
  await dictReady;
  let word=$('dcSearch').value.trim();const box=$('dcResult');box.replaceChildren();
  if(!word){$('dcNoPack').hidden=true;return}
  const fg=await finglishWord(word);word=fg.text;
  let pair=$('dcPair').value;
  if(!pair){
    pair=await MakanDict.guessPair(word,{to:$('tgt').value});
    if(!pair){ // nothing installed for this script: say which pack would help
      const from=MakanDict.detectLang(word),want=DICT_PAIRS.find(id=>MakanDict.PAIR_INFO[id].from===from);
      $('dcNoPackText').textContent=L('dictNoPack')+(want?` (${packName(want)})`:'');$('dcNoPack').hidden=false;if(fg.persian)box.prepend(fgBox(fg.persian));return;
    }
  }
  const res=await MakanDict.lookup(word,{pair,showVulgar:showVulgar()});
  if(!res){$('dcNoPackText').textContent=L('dictNoPack')+` (${packName(pair)})`;$('dcNoPack').hidden=false;if(fg.persian)box.prepend(fgBox(fg.persian));return}
  $('dcNoPack').hidden=true;
  dictRender(res,box);
  if(fg.persian)box.prepend(fgBox(fg.persian));
  const b=document.createElement('button');b.className='btn';b.type='button';b.id='dcExplain';b.textContent=L('dictExplain');b.style.marginTop='12px';
  b.onclick=()=>dictExplain(word,box,b);box.append(b);
}
$('dcGo').onclick=dictSearch;
$('dcPair').onchange=()=>{if($('dcSearch').value.trim())dictSearch()};
$('dcSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();dictSearch()}});
$('dcOpenSettings').onclick=()=>{$('openSet').click()};

// ---- Text tab: click a word in the source or the result ----
function wordAt(ta){
  if(ta.selectionStart!==ta.selectionEnd)return '';
  const v=ta.value,i=ta.selectionStart,re=/[\p{L}\p{M}\p{N}'’\-]/u;
  let a=i,b=i;while(a>0&&re.test(v[a-1]))a--;while(b<v.length&&re.test(v[b]))b++;
  return v.slice(a,b).replace(/^['’\-]+|['’\-]+$/g,'');
}
let wordCardSeq=0;
function hideWordCard(){wordCardSeq++;$('wordCard').hidden=true}
async function showWordCard(word,x,y,hintTo){
  const seq=++wordCardSeq,card=$('wordCard');
  const res=await MakanDict.lookup(word,{hints:{to:hintTo||$('tgt').value},showVulgar:showVulgar()});
  if(seq!==wordCardSeq)return;
  if(!res){hideWordCard();return}
  card.replaceChildren();
  const box=document.createElement('div');card.append(box);
  dictRender(res,box,{maxPhrases:3});
  if(!res.groups.length&&!res.extra.length){hideWordCard();return}
  card.style.left=Math.max(8,Math.min(x,innerWidth-380))+'px';card.style.top=Math.min(y+14,innerHeight-120)+'px';
  card.hidden=false;
  // The entry above is already there; the AI detail follows when an AI engine is available.
  if(aiAvailable()){
    const out=document.createElement('div');out.className='dict-ai';out.textContent=L('dictExplaining');card.append(out);
    try{
      const txt=await chat([{role:'user',content:`${L('dictAiAsk')}\n\n${word}`}],{system:`You are a concise bilingual (English/Persian) dictionary assistant. Answer in ${ui==='fa'?'Persian':'English'}.`});
      if(seq===wordCardSeq)out.textContent=txt;
    }catch{if(seq===wordCardSeq)out.remove()}
  }
}
['tIn','tOut'].forEach(id=>$(id).addEventListener('click',e=>{
  const w=wordAt($(id));if(!w||w.length<2){hideWordCard();return}
  showWordCard(w,e.clientX,e.clientY,id==='tOut'?$('src').value:$('tgt').value);
}));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){hideWordCard();$('creditsBox').hidden=true}});
document.addEventListener('mousedown',e=>{if(!e.target.closest('#wordCard')&&!e.target.closest('#tIn,#tOut'))hideWordCard()});
$('tIn').addEventListener('input',hideWordCard);

// ---- credits ----
$('creditsBtn').onclick=()=>{$('creditsBox').hidden=!$('creditsBox').hidden};
$('creditsClose').onclick=()=>{$('creditsBox').hidden=true};
