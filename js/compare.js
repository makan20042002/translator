/* ---------- COMPARE ---------- */
$('cGo').onclick=async()=>{
  const text=$('cIn').value.trim(),ids=[...$('cEng').querySelectorAll('input:checked')].map(i=>i.value).slice(0,4);
  if(!text)return;if(!ids.length){toast(L('pick2'),'warn');return}
  $('cOut').innerHTML=ids.map(id=>`<div class="card res" id="c_${id}"><h4>${esc(ENG[id].name)}<span class="sp"></span><span class="meta">…</span></h4><p dir="auto"></p><button class="btn ghost" hidden>${esc(L('copy'))}</button></div>`).join('');
  $('cGo').disabled=true;
  await Promise.all(ids.map(async id=>{
    const box=$('c_'+id),t0=performance.now();
    try{const r=await translateItems(text.split('\n'),opts({engine:id}));const res=r.out.join('\n');
      box.querySelector('p').textContent=res;box.querySelector('.meta').textContent=((performance.now()-t0)/1000).toFixed(1)+'s';
      const b=box.querySelector('button');b.hidden=false;b.onclick=()=>copy(res);
    }catch(e){box.querySelector('p').textContent=e.message;box.querySelector('p').style.color='var(--err)';box.querySelector('.meta').textContent=L('failed')}
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
