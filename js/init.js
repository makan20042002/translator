/* ---------- shell ---------- */
$('tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  document.querySelectorAll('#tabs button').forEach(x=>x.classList.toggle('on',x===b));
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on',x.id==='tab-'+b.dataset.tab));
  if(b.dataset.tab!=='voice'){
    stopLive();
  }
  if(b.dataset.tab==='voice')checkFileProtoNotice();
  if(b.dataset.tab==='hist')renderHist();if(b.dataset.tab==='gls')renderGloss();
  if(b.dataset.tab==='sub')updateSubEngineNotice();
  if($('tModeGrp'))$('tModeGrp').hidden=(b.dataset.tab!=='text');
});
$('src').onchange=()=>{store.set('src',$('src').value);voiceLabels()};
$('tgt').onchange=()=>{store.set('tgt',$('tgt').value);voiceLabels();fillVoices();fillAskLangs()};
$('engine').onchange=()=>{store.set('engine',$('engine').value);updateSubEngineNotice()};
if($('tMode'))$('tMode').onchange=()=>store.set('tMode',$('tMode').value);
$('tone').onchange=()=>store.set('tone',$('tone').value);
if($('subStyle'))$('subStyle').onchange=()=>{store.set('subStyle',$('subStyle').value);updateSubEngineNotice()};
if($('subFamily'))$('subFamily').onchange=()=>{store.set('subFamily',$('subFamily').checked)};
$('swap').onclick=()=>{const s=$('src').value,t=$('tgt').value;if(s==='auto'||s==='finglish'){toast(L('sameLang'),'warn');return}
  $('src').value=t;$('tgt').value=s;const a=$('tIn').value;if($('tOut').value){$('tIn').value=$('tOut').value;$('tOut').value=a}
  $('src').onchange();$('tgt').onchange();$('tIn').dispatchEvent(new Event('input'))};
$('uiLang').onclick=()=>{ui=ui==='en'?'fa':'en';store.set('ui',ui);boot()};
function checkFileProtoNotice(){
  const el=$('vFileProtoNotice');
  if(el)el.hidden=(location.protocol!=='file:');
}
function boot(){
  const s=$('src').value,t=$('tgt').value;
  applyI18n();fillLangs();if(s){$('src').value=s;$('tgt').value=t}
  checkFileProtoNotice();
  fillEngines();if($('tMode'))$('tMode').value=getDefaultTransMode();$('tone').value=store.get('tone','');voiceLabels();renderGloss();renderVoice();fillAskLangs();
  document.querySelectorAll('select#vSilenceWait').forEach(el=>{el.value=String(cfg.silenceWait||800)});
  if($('vLiveVoiceSpeed'))$('vLiveVoiceSpeed').value=store.get('liveVoiceSpeed','fast');
  if($('subStyle'))$('subStyle').value=store.get('subStyle','film');
  if($('subFamily'))$('subFamily').checked=store.get('subFamily',false);
  updateSubEngineNotice();
  const rawParams = (location.hash && location.hash.length > 1)
    ? location.hash.slice(1)
    : ((location.search && location.search.length > 1) ? location.search.slice(1) : '');
  if (rawParams) {
    try {
      const p = new URLSearchParams(rawParams);
      const text = p.get('text');
      const srcP = p.get('src');
      const tgtP = p.get('tgt');
      if (text !== null) {
        $('tIn').value = text.slice(0, 5000);
      }
      if (srcP && (srcP === 'auto' || LANGS.some(l => l[0] === srcP))) {
        $('src').value = srcP;
      }
      if (tgtP && LANGS.some(l => l[0] === tgtP)) {
        $('tgt').value = tgtP;
      }
      voiceLabels();
      history.replaceState(null, '', location.pathname || '/');
    } catch (e) {}
  }
  $('tIn').dispatchEvent(new Event('input'));
}
boot();
