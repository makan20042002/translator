/* ---------- shell ---------- */
$('tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  document.querySelectorAll('#tabs button').forEach(x=>x.classList.toggle('on',x===b));
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on',x.id==='tab-'+b.dataset.tab));
  if($('speakNotice'))$('speakNotice').classList.toggle('voice-mode',b.dataset.tab==='voice');
  if($('sidebar'))$('sidebar').classList.remove('open');
  if($('sidebarBackdrop'))$('sidebarBackdrop').classList.remove('open');
  if(b.dataset.tab!=='voice'){
    stopLive();
  }
  if(b.dataset.tab==='voice')checkFileProtoNotice();
  if(b.dataset.tab==='hist')renderHist();if(b.dataset.tab==='gls')renderGloss();
  if(b.dataset.tab==='models'){if(typeof renderModelHub==='function')renderModelHub();if(typeof mcScan==='function')mcScan().then(()=>{if(typeof renderModelHub==='function')renderModelHub();});}
  if(b.dataset.tab==='sub')updateSubEngineNotice();
  if($('tModeGrp'))$('tModeGrp').hidden=(b.dataset.tab!=='text');
});
if($('sidebarToggleBtn'))$('sidebarToggleBtn').onclick=()=>{
  const s=$('sidebar'),bd=$('sidebarBackdrop');
  if(s){
    const open=s.classList.toggle('open');
    if(bd)bd.classList.toggle('open',open);
  }
};
if($('sidebarBackdrop'))$('sidebarBackdrop').onclick=()=>{
  $('sidebar')?.classList.remove('open');
  $('sidebarBackdrop')?.classList.remove('open');
};
$('src').onchange=()=>{store.set('src',$('src').value);voiceLabels();if(typeof updateCardLangNames==='function')updateCardLangNames()};
$('tgt').onchange=()=>{store.set('tgt',$('tgt').value);voiceLabels();fillVoices();fillAskLangs();if(typeof updateCardLangNames==='function'){updateCardLangNames();updateTargetCardDirection();updateListenButtonState()}};
$('engine').onchange=()=>{store.set('engine',$('engine').value);updateSubEngineNotice()};
if($('tMode'))$('tMode').onchange=()=>store.set('tMode',$('tMode').value);
$('tone').onchange=()=>store.set('tone',$('tone').value);
if($('subStyle'))$('subStyle').onchange=()=>{store.set('subStyle',$('subStyle').value);updateSubEngineNotice()};
if($('subFamily'))$('subFamily').onchange=()=>{store.set('subFamily',$('subFamily').checked)};
$('swap').onclick=()=>{const s=$('src').value,t=$('tgt').value;if(s==='auto'||s==='finglish'){toast(L('sameLang'),'warn');return}
  $('src').value=t;$('tgt').value=s;const a=$('tIn').value;if($('tOut').value){$('tIn').value=$('tOut').value;$('tOut').value=a}
  $('src').onchange();$('tgt').onchange();$('tIn').dispatchEvent(new Event('input'))};
$('uiLang').onclick=()=>{ui=ui==='en'?'fa':'en';store.set('ui',ui);boot()};
if($('sidebarSettingsBtn'))$('sidebarSettingsBtn').onclick=()=>$('openSet')?.click();
if($('topbarSettingsBtn'))$('topbarSettingsBtn').onclick=()=>$('openSet')?.click();
if($('tabScreenLaunchBtn'))$('tabScreenLaunchBtn').onclick=()=>{
  if(window.makanDesktop?.startScreenTranslator)window.makanDesktop.startScreenTranslator();
  else if($('btnScreenTrans'))$('btnScreenTrans').click();
};
if($('tabScreenOpenOcrBtn'))$('tabScreenOpenOcrBtn').onclick=()=>{
  $('openSet')?.click();$('setTabBtnOcr')?.click();
};
if($('tabModelsOpenSetBtn'))$('tabModelsOpenSetBtn').onclick=()=>{
  $('openSet')?.click();$('setTabBtnTrModels')?.click();
};
function updateStatusPill(){
  const pill=$('sidebarStatusPill');
  if(!pill)return;
  const isReady=(typeof trAnyReady==='function')?trAnyReady():false;
  pill.classList.toggle('ready',isReady);
  const dot=$('sidebarStatusDot')||pill.querySelector('.status-dot');
  if(dot)dot.classList.toggle('ready',isReady);
  const txt=$('sidebarStatusText')||pill.querySelector('.status-text')||pill;
  if(txt)txt.textContent=isReady?(L('statusOfflineReady')||'Offline ready'):(L('statusOnlineOnly')||'Online only');
  if(typeof renderTextStatusStrip==='function')renderTextStatusStrip();
}
async function updateStorageCard(){
  const card=$('sidebarStorageCard');
  if(!card)return;
  if(!navigator.storage||typeof navigator.storage.estimate!=='function'){
    card.hidden=true;
    return;
  }
  try{
    const est=await navigator.storage.estimate();
    if(typeof est?.usage!=='number'||typeof est?.quota!=='number'||est.quota<=0){
      card.hidden=true;
      return;
    }
    const usageMB=est.usage<1048576?(est.usage/1024).toFixed(0)+' KB':(est.usage/(1024*1024)).toFixed(1)+' MB';
    const quotaGB=(est.quota/(1024*1024*1024)).toFixed(1)+' GB';
    const pct=Math.min(100,Math.max(0,Math.round((est.usage/est.quota)*100)));
    const usageEl=$('sidebarStorageUsage');
    const barEl=$('sidebarStorageBar');
    if(usageEl)usageEl.textContent=`${usageMB} / ${quotaGB}`;
    if(barEl)barEl.style.width=pct+'%';
    card.hidden=false;
  }catch(e){
    card.hidden=true;
  }
}
function checkFileProtoNotice(){
  const el=$('vFileProtoNotice');
  if(el)el.hidden=(location.protocol!=='file:');
}
function boot(){
  const s=$('src').value,t=$('tgt').value;
  applyI18n();fillLangs();if(s){$('src').value=s;$('tgt').value=t}
  updateStatusPill();
  updateStorageCard();
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
  if (typeof updateListenButtonState === 'function') updateListenButtonState();
  if (typeof renderTextStatusStrip === 'function') renderTextStatusStrip();
  $('tIn').dispatchEvent(new Event('input'));
}
boot();
