/* ---------- COMPARE ---------- */
function initCompareLangs(){
  if(!$('cmpSrc')||!$('cmpTgtList'))return;
  let s=store.get('cmp_src',null);
  if(!s){s=$('src')?.value||'auto';store.set('cmp_src',s)}
  let t=store.get('cmp_tgts',null);
  if(!Array.isArray(t)||!t.length){
    const defTgt=$('tgt')?.value||'fa';
    t=[defTgt];
    store.set('cmp_tgts',t);
  }
  renderCmpLangControls();
}

function renderCmpLangControls(){
  const sSel=$('cmpSrc'),tCont=$('cmpTgtList');
  if(!sSel||!tCont)return;
  const curSrc=store.get('cmp_src', $('src')?.value||'auto');
  sSel.innerHTML=`<option value="auto">${esc(L('detect'))}</option>`+LANGS.map(l=>`<option value="${l[0]}">${esc(l[1])}</option>`).join('');
  sSel.value=curSrc;
  sSel.onchange=()=>{store.set('cmp_src',sSel.value)};

  let tgts=store.get('cmp_tgts',null);
  if(!Array.isArray(tgts)||!tgts.length)tgts=[$('tgt')?.value||'fa'];
  tgts=tgts.slice(0,3);

  tCont.innerHTML=tgts.map((code,i)=>`
    <div class="cmp-tgt-item row" style="gap:4px;align-items:center">
      <select class="cmp-tgt-sel" data-idx="${i}" aria-label="Target language">
        ${LANGS.map(l=>`<option value="${l[0]}" ${l[0]===code?'selected':''}>${esc(l[1])}</option>`).join('')}
      </select>
      <button type="button" class="btn ghost danger sm cmp-del-tgt" data-idx="${i}" ${tgts.length<=1?'disabled style="display:none"':''} title="${esc(L('remLang'))}">✕</button>
    </div>
  `).join('');

  const addBtn=$('cmpAddTgt');
  if(addBtn){
    addBtn.hidden=tgts.length>=3;
    addBtn.disabled=tgts.length>=3;
    addBtn.style.display=tgts.length>=3?'none':'';
  }
}

if($('cmpTgtList')){
  $('cmpTgtList').addEventListener('change',e=>{
    if(e.target.classList.contains('cmp-tgt-sel')){
      const idx=parseInt(e.target.dataset.idx,10);
      let tgts=store.get('cmp_tgts',null);
      if(!Array.isArray(tgts)||!tgts.length)tgts=[$('tgt')?.value||'fa'];
      tgts[idx]=e.target.value;
      store.set('cmp_tgts',tgts);
    }
  });

  $('cmpTgtList').addEventListener('click',e=>{
    const delBtn=e.target.closest('.cmp-del-tgt');
    if(delBtn&&!delBtn.disabled){
      const idx=parseInt(delBtn.dataset.idx,10);
      let tgts=store.get('cmp_tgts',null);
      if(!Array.isArray(tgts)||!tgts.length)tgts=[$('tgt')?.value||'fa'];
      if(tgts.length>1){
        tgts.splice(idx,1);
        store.set('cmp_tgts',tgts);
        renderCmpLangControls();
      }
    }
  });
}

if($('cmpAddTgt')){
  $('cmpAddTgt').onclick=()=>{
    let tgts=store.get('cmp_tgts',null);
    if(!Array.isArray(tgts)||!tgts.length)tgts=[$('tgt')?.value||'fa'];
    if(tgts.length<3){
      const common=['fa','en','de','fr','es','ar','tr','zh','ru'];
      const next=common.find(c=>!tgts.includes(c))||LANGS.find(l=>!tgts.includes(l[0]))?.[0]||'en';
      tgts.push(next);
      store.set('cmp_tgts',tgts);
      renderCmpLangControls();
    }
  };
}

initCompareLangs();

$('cGo').onclick=async()=>{
  const text=$('cIn').value.trim(),ids=[...$('cEng').querySelectorAll('input:checked')].map(i=>i.value).slice(0,4);
  if(!text)return;if(!ids.length){toast(L('pick2'),'warn');return}

  let srcLang=store.get('cmp_src', $('src')?.value||'auto');
  let tgts=store.get('cmp_tgts', null);
  if(!Array.isArray(tgts)||!tgts.length)tgts=[$('tgt')?.value||'fa'];
  tgts=tgts.slice(0,3);

  let html='';
  for(let gi=0;gi<tgts.length;gi++){
    const tgt=tgts[gi];
    const tgtName=LANGS.find(l=>l[0]===tgt)?.[1]||tgt.toUpperCase();
    html+=`
      <div class="cmp-group" data-tgt="${tgt}" style="margin-bottom:24px">
        <div class="row cmp-group-header" style="align-items:center;margin:16px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--border)">
          <h3 class="cmp-group-title" style="margin:0;font-size:15px;font-weight:700">
            ${esc(tgtName)} <span class="meta" style="font-weight:normal;font-size:12px">(${esc(tgt.toUpperCase())})</span>
          </h3>
          <span class="sp"></span>
          <button type="button" class="btn ghost sm cmp-copy-all" data-tgt="${tgt}" title="${esc(L('copyAll'))}">${esc(L('copyAll'))}</button>
        </div>
        <div class="grid3 cmp-boxes">
          ${ids.map(id=>{
            const innerIdContent=`
              <h4>
                <span class="engine-name">${esc(ENG[id].name)}</span>
                <span class="sp"></span>
                <span class="meta">…</span>
              </h4>
              <p dir="auto"></p>
              <button class="btn ghost" hidden>${esc(L('copy'))}</button>
            `;
            const innerHtml=(gi===0)
              ? `<div id="c_${id}" style="display:contents">${innerIdContent}</div>`
              : innerIdContent;
            return `<div class="card res cmp-res" id="c_${tgt}_${id}" data-engine="${id}" data-tgt="${tgt}">${innerHtml}</div>`;
          }).join('')}
        </div>
      </div>
    `;
  }
  $('cOut').innerHTML=html;
  $('cGo').disabled=true;

  const groupResults={};
  tgts.forEach(tgt=>{groupResults[tgt]={};});

  $('cOut').querySelectorAll('.cmp-copy-all').forEach(btn=>{
    btn.onclick=()=>{
      const tgt=btn.dataset.tgt;
      const texts=ids.map(id=>groupResults[tgt]?.[id]).filter(Boolean);
      if(texts.length){
        copy(texts.join('\n\n'));
      }
    };
  });

  await Promise.all(tgts.flatMap(tgt=>{
    return ids.map(async id=>{
      const box=$(`c_${tgt}_${id}`)||$(`c_${id}`);
      if(!box)return;
      const t0=performance.now();
      const isAi=Boolean(ENG[id]?.ai);
      const modelName=isAi?(cfg.eng[id]?.model||ENG[id]?.model||''):'';
      try{
        const r=await translateItems(text.split('\n'),opts({engine:id,src:srcLang==='finglish'?'auto':srcLang,tgt:tgt}));
        const res=r.out.join('\n');
        groupResults[tgt][id]=res;
        const elapsed=((performance.now()-t0)/1000).toFixed(1);
        const p=box.querySelector('p');if(p)p.textContent=res;
        const meta=box.querySelector('.meta');
        if(meta){
          meta.innerHTML=`<span class="cmp-time">${elapsed}s</span> · <span class="cmp-chars">${res.length} chars</span>${modelName?` · <span class="cmp-model">${esc(modelName)}</span>`:''}`;
        }
        const b=box.querySelector('button.btn')||box.querySelector('button');
        if(b){b.hidden=false;b.onclick=()=>copy(res);}
      }catch(e){
        const p=box.querySelector('p');if(p){p.textContent=e.message;p.style.color='var(--err)';}
        const meta=box.querySelector('.meta');if(meta)meta.textContent=L('failed');
      }
    });
  }));

  $('cGo').disabled=false;
};

/* ---------- GLOSSARY / HISTORY ---------- */
function renderGloss(){
  $('gList').innerHTML=glossary.map((g,i)=>`<div class="gl"><input type="text" dir="auto" data-i="${i}" data-k="s" value="${esc(g.s)}" placeholder="${esc(L('term'))}"><input type="text" dir="auto" data-i="${i}" data-k="t" value="${esc(g.t)}" placeholder="${esc(L('termTo'))}"><button class="btn ghost danger" data-del="${i}">✕</button></div>`).join('');
}
$('gList').addEventListener('input',e=>{const d=e.target.dataset;if(d.k){glossary[d.i][d.k]=e.target.value;store.set('gls',glossary)}});
$('gList').addEventListener('click',e=>{const d=e.target.dataset.del;if(d!=null){glossary.splice(d,1);store.set('gls',glossary);renderGloss()}});
$('gAdd').onclick=()=>{glossary.push({s:'',t:''});renderGloss();$('gList').querySelector('.gl:last-child input').focus()};
function renderHist(){
  const h=store.get('hist',[]);
  $('hList').innerHTML=h.length?h.map((x,i)=>`<div class="item" data-i="${i}"><span class="meta">${new Date(x.ts).toLocaleString()} · ${esc(x.src)} → ${esc(x.tgt)} · ${esc(x.e)}</span><span class="a" dir="auto">${esc(x.i.slice(0,160))}</span><span class="b" dir="auto">${esc(x.o.slice(0,160))}</span></div>`).join(''):`<p class="hint" style="padding:18px">${esc(L('empty'))}</p>`;
}
$('hList').addEventListener('click',e=>{const it=e.target.closest('.item');if(!it)return;const x=store.get('hist',[])[it.dataset.i];
  $('tIn').value=x.i;$('tOut').value=x.o;$('src').value=x.src;$('tgt').value=x.tgt;$('tIn').dispatchEvent(new Event('input'));document.querySelector('[data-tab=text]').click()});
$('hClear').onclick=()=>{store.set('hist',[]);renderHist()};
