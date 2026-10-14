/**
 * MAKAN Translate - Options & Settings Script (Manifest V3)
 * Never logs or prints API keys.
 */

// Text that came from outside (stored values, an imported file, the system's voice list) is always
// escaped before it is put into the page.
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

document.addEventListener('DOMContentLoaded', async () => {
  let cfg = null;
  let connResults = {};

  const I18N = {
    en: {
      dir: 'ltr',
      langBtn: 'فارسی',
      title: 'Engines & Settings',
      sub: 'Configure translation providers, API keys, fallback priority, and extension behavior. Keys remain in your local browser extension storage only.',
      syncTitle: 'Sync with MAKAN Web App',
      syncDesc: 'Already configured your API keys in the MAKAN web app? Export settings from the app and import them here with one click.',
      btnImport: 'Import Settings File',
      btnPaste: 'Paste JSON',
      btnExport: 'Export Backup',
      secBehavior: 'Extension Behavior',
      lblTrigger: 'Selection Translation Button:',
      triggerAuto: 'Always show button when text is selected (Recommended)',
      triggerAlt: 'Only show button when Alt key is held',
      triggerNever: 'Never show button (Use right-click context menu only)',
      lblDefaultTgt: 'Default Target Language:',
      lblDefaultTone: 'Default Translation Tone:',
      lblAppUrl: 'App address:',
      lblWebAppUrl: 'Web App URL:',
      lblDictLookup: 'Enable dictionary lookup on single-word double-click (displays phonetic, definitions and examples via AI)',
      secEngines: 'Translation Engines & Keys',
      subEngines: 'Engines are tried from top to bottom. If a provider hits rate limits or fails, the next available engine takes over seamlessly.',
      btnCheckConn: 'Check Connections',
      checkingConn: 'Testing connections…',
      openApp: 'Open Web App',
      keyPh: 'API Key',
      modelPh: 'Model Name',
      basePh: 'Base URL',
      works: 'Works',
      saved: 'Saved',
      secSiteCheck: 'Site Compatibility Self-Check',
      secCredits: 'About & credits',
      secDictPacks: 'More dictionaries',
      dictPacksNote: 'Other language pairs are not inside the extension. They are downloaded once from your web app address ({url}) and kept in this browser.',
      dictNone: 'Your web app address offers no other dictionaries.', dictUnreachable: 'The web app address could not be reached, so no more dictionaries can be offered now.',
      dictDownload: 'Download', dictDelete: 'Delete', dictReady: 'Ready', dictNotDl: 'Not downloaded', dictDownloading: 'Downloading', dictFailed: 'Download failed', dictRemoved: 'Dictionary deleted',
      creditsText: 'Offline dictionary: data from Wiktionary (CC BY-SA 4.0 / GFDL), extracted with Wiktextract and distributed by Kaikki.org; entries chosen with the wordfreq ranking by Robyn Speer (CC BY-SA 4.0). The dictionary is shared under the same CC BY-SA licence. Attribution does not imply endorsement.',
      subSiteCheck: 'Diagnose whether MAKAN Translate can run on your current site and troubleshoot browser permissions or injection status.',
      btnCheckActiveTab: 'Check Active Tab',
      checkingTab: 'Diagnosing tab…',
      secVoice: 'Voice & Read-Aloud (TTS)',
      subVoice: 'Choose voices per language, adjust speed, and configure AI speech fallback when no system voice is installed.',
      lblPreferGeminiVoice: 'Prefer Gemini AI Voice — High-fidelity neural speech for Persian & English with Gemini key.',
      lblGeminiVoice: 'Gemini AI Voice Model:',
      lblTtsRate: 'Speech Speed (Rate):',
      lblVoiceFa: 'Persian Voice (فارسی):',
      lblVoiceEn: 'English Voice:',
      btnTestVoice: 'Test Voice',
      testingVoice: 'Speaking test…'
    },
    fa: {
      dir: 'rtl',
      langBtn: 'English',
      title: 'موتورها و تنظیمات',
      sub: 'پیکربندی سرویس‌های ترجمه، کلیدهای API، ترتیب جایگزینی و رفتار افزونه. کلیدها فقط در حافظه محلی مرورگر شما ذخیره می‌شوند.',
      syncTitle: 'همگام‌سازی با نسخه وب MAKAN',
      syncDesc: 'کلیدهای خود را قبلاً در نسخه وب تنظیم کرده‌اید؟ تنظیمات را از برنامه وب خروجی گرفته و با یک کلیک اینجا وارد کنید.',
      btnImport: 'وارد کردن فایل تنظیمات',
      btnPaste: 'چسباندن متن JSON',
      btnExport: 'خروجی پشتیبان',
      secBehavior: 'رفتار افزونه در صفحات وب',
      lblTrigger: 'دکمه شناور ترجمه متن انتخاب‌شده:',
      triggerAuto: 'همیشه با انتخاب متن دکمه نمایش داده شود (پیشنهادی)',
      triggerAlt: 'فقط زمانی که کلید Alt نگه داشته شده است',
      triggerNever: 'هرگز دکمه نمایش داده نشود (فقط از منوی کلیک راست استفاده شود)',
      lblDefaultTgt: 'زبان مقصد پیش‌فرض:',
      lblDefaultTone: 'لحن پیش‌فرض ترجمه:',
      lblAppUrl: 'آدرس برنامه ویندوز (App address):',
      lblWebAppUrl: 'آدرس وب‌اپلیکیشن:',
      lblDictLookup: 'فعال‌سازی حالت دیکشنری با دوبار کلیک روی کلمه (تلفظ، معانی و مثال با هوش مصنوعی)',
      secEngines: 'موتورهای ترجمه و کلیدها',
      subEngines: 'موتورها از بالا به پایین امتحان می‌شوند. در صورت بروز محدودیت نرخ (429) یا خطا، موتور بعدی به طور خودکار جایگزین می‌شود.',
      btnCheckConn: 'بررسی اتصال‌ها',
      checkingConn: 'در حال بررسی اتصال‌ها…',
      openApp: 'باز کردن نسخه وب',
      keyPh: 'کلید API',
      modelPh: 'نام مدل',
      basePh: 'آدرس سرور',
      works: 'کار می‌کند',
      saved: 'ذخیره شد',
      secSiteCheck: 'بررسی سازگاری با سایت جاری',
      secCredits: 'درباره و منابع',
      secDictPacks: 'دیکشنری‌های بیشتر',
      dictPacksNote: 'جفت‌زبان‌های دیگر داخل افزونه نیستند. یک بار از نشانی برنامه‌ی وب شما ({url}) دانلود می‌شوند و در همین مرورگر می‌مانند.',
      dictNone: 'نشانی برنامه‌ی وب شما دیکشنری دیگری ارائه نمی‌دهد.', dictUnreachable: 'به نشانی برنامه‌ی وب دسترسی نشد، پس فعلاً دیکشنری بیشتری پیشنهاد نمی‌شود.',
      dictDownload: 'دانلود', dictDelete: 'حذف', dictReady: 'آماده', dictNotDl: 'دانلود نشده', dictDownloading: 'در حال دانلود', dictFailed: 'دانلود ناموفق بود', dictRemoved: 'دیکشنری حذف شد',
      creditsText: 'فرهنگ لغت آفلاین: داده‌ها از ویکی‌واژه (CC BY-SA 4.0 / GFDL) با Wiktextract و Kaikki.org؛ انتخاب مدخل‌ها با رتبه‌بندی wordfreq از Robyn Speer (CC BY-SA 4.0). این فرهنگ لغت با همان مجوز CC BY-SA منتشر می‌شود. ذکر منبع به معنای تأیید نیست.',
      subSiteCheck: 'بررسی وضعیت اجرای افزونه در برگه فعال و عیب‌یابی دسترسی‌ها و تزریق اسکریپت.',
      btnCheckActiveTab: 'بررسی برگه فعال',
      checkingTab: 'در حال بررسی برگه…',
      secVoice: 'صدا و خواندن متن (TTS)',
      subVoice: 'انتخاب صدا برای هر زبان، تنظیم سرعت گفتار و جایگزینی خودکار صدای هوش مصنوعی در نبود صدای سیستمی.',
      lblPreferGeminiVoice: 'استفاده ترجیحی از صدای هوش مصنوعی جمینای — گفتار طبیعی فارسی و انگلیسی با کلید جمینای.',
      lblGeminiVoice: 'مدل صدای هوش مصنوعی:',
      lblTtsRate: 'سرعت خواندن متن:',
      lblVoiceFa: 'صدای زبان فارسی:',
      lblVoiceEn: 'صدای زبان انگلیسی:',
      btnTestVoice: 'تست صدا',
      testingVoice: 'در حال پخش تست…'
    }
  };

  // Elements
  const optLangToggle = document.getElementById('optLangToggle');
  const optTitle = document.getElementById('optTitle');
  const optSub = document.getElementById('optSub');
  const syncTitle = document.getElementById('syncTitle');
  const syncDesc = document.getElementById('syncDesc');
  const btnImportFile = document.getElementById('btnImportFile');
  const btnImportText = document.getElementById('btnImportText');
  const btnPasteJson = document.getElementById('btnPasteJson');
  const btnPasteText = document.getElementById('btnPasteText');
  const btnExportSettings = document.getElementById('btnExportSettings');
  const btnExportText = document.getElementById('btnExportText');
  const fileImportInput = document.getElementById('fileImportInput');
  const secBehavior = document.getElementById('secBehavior');
  const lblTrigger = document.getElementById('lblTrigger');
  const selTrigger = document.getElementById('selTrigger');
  const lblDefaultTgt = document.getElementById('lblDefaultTgt');
  const selDefaultTgt = document.getElementById('selDefaultTgt');
  const lblDefaultTone = document.getElementById('lblDefaultTone');
  const selDefaultTone = document.getElementById('selDefaultTone');
  const lblAppUrl = document.getElementById('lblAppUrl');
  const txtAppUrl = document.getElementById('txtAppUrl');
  const lblWebAppUrl = document.getElementById('lblWebAppUrl');
  const txtWebAppUrl = document.getElementById('txtWebAppUrl');
  const chkDictLookup = document.getElementById('chkDictLookup');
  const chkShowVulgar = document.getElementById('chkShowVulgar');
  const lblDictLookup = document.getElementById('lblDictLookup');
  const secEngines = document.getElementById('secEngines');
  const subEngines = document.getElementById('subEngines');
  const btnCheckConn = document.getElementById('btnCheckConn');
  const btnCheckConnText = document.getElementById('btnCheckConnText');
  const optEngineList = document.getElementById('optEngineList');
  const optOpenApp = document.getElementById('optOpenApp');
  const modalPasteOv = document.getElementById('modalPasteOv');
  const modalPasteArea = document.getElementById('modalPasteArea');
  const modalPasteCancel = document.getElementById('modalPasteCancel');
  const modalPasteSave = document.getElementById('modalPasteSave');
  const optToasts = document.getElementById('optToasts');

  // Site Check Elements
  const secSiteCheck = document.getElementById('secSiteCheck');
  const subSiteCheck = document.getElementById('subSiteCheck');
  const btnRefreshSiteCheck = document.getElementById('btnRefreshSiteCheck');
  const btnRefreshSiteCheckText = document.getElementById('btnRefreshSiteCheckText');
  const siteCheckBadge = document.getElementById('siteCheckBadge');
  const siteCheckUrl = document.getElementById('siteCheckUrl');
  const siteCheckDetail = document.getElementById('siteCheckDetail');
  const btnInjectScript = document.getElementById('btnInjectScript');
  const btnToggleSiteDisable = document.getElementById('btnToggleSiteDisable');

  // Voice Elements
  const secVoice = document.getElementById('secVoice');
  const subVoice = document.getElementById('subVoice');
  const btnTestVoice = document.getElementById('btnTestVoice');
  const btnTestVoiceText = document.getElementById('btnTestVoiceText');
  const chkPreferGeminiVoice = document.getElementById('chkPreferGeminiVoice');
  const lblPreferGeminiVoice = document.getElementById('lblPreferGeminiVoice');
  const lblGeminiVoice = document.getElementById('lblGeminiVoice');
  const selGeminiVoice = document.getElementById('selGeminiVoice');
  const lblTtsRate = document.getElementById('lblTtsRate');
  const selTtsRate = document.getElementById('selTtsRate');
  const lblVoiceFa = document.getElementById('lblVoiceFa');
  const selVoiceFa = document.getElementById('selVoiceFa');
  const lblVoiceEn = document.getElementById('lblVoiceEn');
  const selVoiceEn = document.getElementById('selVoiceEn');

  // Load config directly from local storage with background fallback
  try {
    if (typeof loadConfig === 'function') {
      cfg = await loadConfig();
    }
  } catch {}
  if (!cfg) {
    try {
      if (window.chrome?.runtime?.sendMessage) {
        const res = await Promise.race([
          chrome.runtime.sendMessage({ action: 'get-config' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 300))
        ]);
        if (res && res.cfg) cfg = res.cfg;
      }
    } catch {}
  }
  if (!cfg) {
    cfg = typeof DEFAULT_CFG !== 'undefined' ? JSON.parse(JSON.stringify(DEFAULT_CFG)) : {};
  }

  let currentUi = cfg.ui || 'en';

  function toast(msg, kind = 'ok') {
    const d = document.createElement('div');
    d.className = `opt-toast ${kind}`;
    d.textContent = msg;
    optToasts.appendChild(d);
    setTimeout(() => d.remove(), 4000);
  }

  /* ----- More dictionaries: pairs the web app offers that are not inside the extension ----- */
  const DICT_EXTRA_KEY = 'makanDictExtra';
  const dictBase = () => String(cfg.webAppUrl || 'http://localhost:8080').replace(/\/+$/, '');
  const validPack = p => p && /^[a-z]{2,3}-[a-z]{2,3}$/.test(p.id) && /^[a-z]{2,3}-[a-z]{2,3}\/pack-\d+$/.test(p.dir || '') && p.from && p.to;
  const dictExtras = async () => ((await chrome.storage.local.get(DICT_EXTRA_KEY))[DICT_EXTRA_KEY] || []).filter(validPack);
  let dictRenderSeq = 0;
  async function renderDictPacks() {
    const box = document.getElementById('dictPackRows');
    if (!box || !cfg) return;
    const T = I18N[currentUi];
    document.getElementById('secDictPacks').textContent = T.secDictPacks;
    document.getElementById('dictPacksNote').textContent = T.dictPacksNote.replace('{url}', dictBase());
    const mySeq = ++dictRenderSeq;
    let bundled = [], offered = [], reachable = true;
    try { bundled = (await (await fetch(chrome.runtime.getURL('dict/packs.json'))).json()).packs.map(p => p.id); } catch {}
    if (mySeq !== dictRenderSeq) return;
    try {
      const r = await fetch(dictBase() + '/dict/packs.json', { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      offered = (await r.json()).packs.filter(p => validPack(p) && !bundled.includes(p.id));
    } catch { reachable = false; }
    if (mySeq !== dictRenderSeq) return;
    const extras = await dictExtras();
    if (mySeq !== dictRenderSeq) return;
    const list = [...offered, ...extras.filter(e => !offered.some(o => o.id === e.id))];   // a downloaded pair can always be deleted, even offline
    if (mySeq !== dictRenderSeq) return;
    MakanDict.setPacks(list);
    if (!list.length) {
      box.replaceChildren();
      const p = document.createElement('p'); p.className = 'opt-sub'; p.textContent = reachable ? T.dictNone : T.dictUnreachable;
      box.append(p); return;
    }
    const nameOf = c => ((LANGS.find(l => l[0] === c) || [])[currentUi === 'fa' ? 2 : 1] || c).split(' · ').pop();
    const rows = [];
    for (const info of list) {
      if (mySeq !== dictRenderSeq) return;
      const ready = !!(await MakanDict.status(info.id));
      if (mySeq !== dictRenderSeq) return;
      const row = document.createElement('div'); row.className = 'opt-dict-row'; row.dataset.pack = info.id;
      const name = document.createElement('strong'); name.textContent = `${nameOf(info.from)} → ${nameOf(info.to)}`;
      const size = document.createElement('span'); size.className = 'opt-sub opt-dict-size'; size.textContent = `${(info.bytes / 1048576).toFixed(1)} MB`;
      const state = document.createElement('span'); state.className = 'opt-sub opt-dict-state'; state.textContent = ready ? T.dictReady : T.dictNotDl;
      const btn = document.createElement('button'); btn.className = 'opt-btn' + (ready ? ' ghost' : ' cta'); btn.type = 'button'; btn.textContent = ready ? T.dictDelete : T.dictDownload;
      btn.onclick = async () => {
        btn.disabled = true;
        try {
          if (ready) {
            await MakanDict.remove(info.id);
            await chrome.storage.local.set({ [DICT_EXTRA_KEY]: (await dictExtras()).filter(p => p.id !== info.id) });
            toast(T.dictRemoved);
          } else {
            await MakanDict.install(info.id, {
              getBytes: async rel => { const r = await fetch(`${dictBase()}/dict/${info.dir}/${rel}`); if (!r.ok) throw new Error(`${rel}: HTTP ${r.status}`); return r.arrayBuffer(); },
              onProgress: f => { state.textContent = `${T.dictDownloading} ${Math.round(f * 100)}%`; }
            });
            const keep = (await dictExtras()).filter(p => p.id !== info.id);
            await chrome.storage.local.set({ [DICT_EXTRA_KEY]: [...keep, { id: info.id, from: info.from, to: info.to, entries: info.entries, phrases: info.phrases, bytes: info.bytes, dir: info.dir, credits: null }] });
            toast(T.dictReady);
          }
        } catch (e) { toast(`${T.dictFailed}: ${e.message}`, 'err'); }
        renderDictPacks();
      };
      row.append(name, size, state, btn);
      rows.push(row);
    }
    if (mySeq !== dictRenderSeq) return;
    box.replaceChildren(...rows);
  }

  function applyUi(lang) {
    currentUi = lang;
    document.body.dir = I18N[lang].dir;
    optLangToggle.textContent = I18N[lang].langBtn;
    optTitle.textContent = I18N[lang].title;
    optSub.textContent = I18N[lang].sub;
    syncTitle.textContent = I18N[lang].syncTitle;
    syncDesc.textContent = I18N[lang].syncDesc;
    btnImportText.textContent = I18N[lang].btnImport;
    btnPasteText.textContent = I18N[lang].btnPaste;
    btnExportText.textContent = I18N[lang].btnExport;
    secBehavior.textContent = I18N[lang].secBehavior;
    lblTrigger.textContent = I18N[lang].lblTrigger;
    selTrigger.options[0].text = I18N[lang].triggerAuto;
    selTrigger.options[1].text = I18N[lang].triggerAlt;
    selTrigger.options[2].text = I18N[lang].triggerNever;
    lblDefaultTgt.textContent = I18N[lang].lblDefaultTgt;
    lblDefaultTone.textContent = I18N[lang].lblDefaultTone;
    if (lblAppUrl) lblAppUrl.textContent = I18N[lang].lblAppUrl;
    lblWebAppUrl.textContent = I18N[lang].lblWebAppUrl;
    lblDictLookup.textContent = I18N[lang].lblDictLookup;
    secEngines.textContent = I18N[lang].secEngines;
    subEngines.textContent = I18N[lang].subEngines;
    btnCheckConnText.textContent = I18N[lang].btnCheckConn;
    optOpenApp.querySelector('span').textContent = I18N[lang].openApp;

    if (secSiteCheck) secSiteCheck.textContent = I18N[lang].secSiteCheck;
    renderDictPacks();
    { const a = document.getElementById('secCredits'), b = document.getElementById('creditsText'); if (a) a.textContent = I18N[lang].secCredits; if (b) b.textContent = I18N[lang].creditsText; }
    if (subSiteCheck) subSiteCheck.textContent = I18N[lang].subSiteCheck;
    if (btnRefreshSiteCheckText) btnRefreshSiteCheckText.textContent = I18N[lang].btnCheckActiveTab;
    if (secVoice) secVoice.textContent = I18N[lang].secVoice;
    if (subVoice) subVoice.textContent = I18N[lang].subVoice;
    if (lblPreferGeminiVoice) lblPreferGeminiVoice.innerHTML = `<strong>${lang === 'fa' ? 'استفاده ترجیحی از صدای هوش مصنوعی جمینای' : 'Prefer Gemini AI Voice'}</strong> — ${I18N[lang].lblPreferGeminiVoice}`;
    if (lblGeminiVoice) lblGeminiVoice.textContent = I18N[lang].lblGeminiVoice;
    if (lblTtsRate) lblTtsRate.textContent = I18N[lang].lblTtsRate;
    if (lblVoiceFa) lblVoiceFa.textContent = I18N[lang].lblVoiceFa;
    if (lblVoiceEn) lblVoiceEn.textContent = I18N[lang].lblVoiceEn;
    if (btnTestVoiceText) btnTestVoiceText.textContent = I18N[lang].btnTestVoice;
  }

  // Populate Languages Dropdown
  selDefaultTgt.innerHTML = '';
  LANGS.forEach(([code, name, faName]) => {
    const label = currentUi === 'fa' ? faName : name;
    selDefaultTgt.innerHTML += `<option value="${code}">${label}</option>`;
  });

  // Populate Initial Values
  selTrigger.value = cfg.trigger || 'auto';
  selDefaultTgt.value = cfg.tgt || 'fa';
  selDefaultTone.value = cfg.tone || 'neutral';
  if (txtAppUrl) txtAppUrl.value = cfg.appUrl || 'http://127.0.0.1:50505';
  txtWebAppUrl.value = cfg.webAppUrl || 'http://localhost:8080';
  chkDictLookup.checked = cfg.dictLookup !== false;
  chkShowVulgar.checked = cfg.showVulgar === true;
  optOpenApp.href = cfg.webAppUrl || 'http://localhost:8080';

  applyUi(currentUi);

  // Render Engines List
  function renderEngines() {
    optEngineList.innerHTML = '';

    cfg.order.forEach((id, index) => {
      const def = ENG[id];
      if (!def) return;
      const engCfg = cfg.eng[id] || { on: true, key: '', model: def.model || '', base: def.base || '' };

      const row = document.createElement('div');
      row.className = `opt-eng-row ${engCfg.on ? '' : 'disabled'}`;
      row.dataset.id = id;

      const conn = connResults[id];
      const statusHtml = conn
        ? `<span class="opt-status-pill ${conn.code === 'works' ? 'works' : (conn.code === 'needsKey' ? 'needsKey' : 'err')}">${esc(conn.text)}</span>`
        : '';

      const tierClass = def.tier || 'free';
      const tierText = def.tier === 'freekey' ? 'Free Key' : def.tier;

      row.innerHTML = `
        <div class="opt-eng-head">
          <div class="opt-eng-order">
            <button class="opt-arrow-btn" data-action="up" data-idx="${index}" title="Move up" ${index === 0 ? 'disabled' : ''}>▲</button>
            <button class="opt-arrow-btn" data-action="down" data-idx="${index}" title="Move down" ${index === cfg.order.length - 1 ? 'disabled' : ''}>▼</button>
          </div>
          <label class="opt-chk">
            <input type="checkbox" class="opt-eng-on" data-id="${id}" ${engCfg.on ? 'checked' : ''}>
          </label>
          <div class="opt-eng-name">
            <span>${esc(def.name)}</span>
            <span class="opt-tier-pill ${esc(tierClass)}">${esc(tierText)}</span>
          </div>
          <div class="opt-sp"></div>
          ${statusHtml}
          ${def.url ? `<a href="${esc(def.url)}" target="_blank" rel="noopener" class="opt-btn ghost" style="font-size:11px;height:24px;padding:0 8px">Get Key ↗</a>` : ''}
        </div>
        ${(def.key || def.ai || def.tier === 'custom') ? `
        <div class="opt-eng-fields">
          ${def.key ? `
          <div class="opt-key-wrap">
            <input type="password" class="opt-eng-input" data-id="${id}" data-prop="key" value="${esc(engCfg.key || '')}" placeholder="${esc(I18N[currentUi].keyPh)}">
            <button type="button" class="opt-eye-btn" title="Show/hide key">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>` : ''}
          ${def.ai ? `
          <div class="opt-model-wrap">
            <input type="text" class="opt-eng-input" data-id="${id}" data-prop="model" value="${esc(engCfg.model || def.model || '')}" placeholder="${esc(I18N[currentUi].modelPh)}">
          </div>` : ''}
          ${(def.tier === 'custom' || id === 'ollama') ? `
          <div class="opt-base-wrap">
            <input type="text" class="opt-eng-input" data-id="${id}" data-prop="base" value="${esc(engCfg.base || def.base || '')}" placeholder="${esc(I18N[currentUi].basePh)}">
          </div>` : ''}
        </div>` : ''}
      `;

      optEngineList.appendChild(row);
    });

    // Hook listeners
    optEngineList.querySelectorAll('.opt-eng-on').forEach(chk => {
      chk.onchange = e => {
        const id = e.target.dataset.id;
        cfg.eng[id].on = e.target.checked;
        saveAndNotify();
        renderEngines();
      };
    });

    optEngineList.querySelectorAll('.opt-arrow-btn').forEach(btn => {
      btn.onclick = e => {
        const idx = +btn.dataset.idx;
        const act = btn.dataset.action;
        const targetIdx = act === 'up' ? idx - 1 : idx + 1;
        if (targetIdx >= 0 && targetIdx < cfg.order.length) {
          const temp = cfg.order[idx];
          cfg.order[idx] = cfg.order[targetIdx];
          cfg.order[targetIdx] = temp;
          saveAndNotify();
          renderEngines();
        }
      };
    });

    optEngineList.querySelectorAll('.opt-eng-input').forEach(inp => {
      inp.onchange = e => {
        const id = e.target.dataset.id;
        const prop = e.target.dataset.prop;
        cfg.eng[id][prop] = e.target.value.trim();
        saveAndNotify();
      };
    });

    optEngineList.querySelectorAll('.opt-eye-btn').forEach(btn => {
      btn.onclick = () => {
        const inp = btn.previousElementSibling;
        if (inp.type === 'password') {
          inp.type = 'text';
          btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m2 2 20 20"/><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/></svg>`;
        } else {
          inp.type = 'password';
          btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
        }
      };
    });
  }

  async function saveAndNotify() {
    try {
      if (typeof saveConfig === 'function') {
        await saveConfig(cfg);
      } else if (window.chrome?.storage?.local) {
        await chrome.storage.local.set({ makan_cfg: cfg });
      }
      if (window.chrome?.runtime?.sendMessage) {
        await chrome.runtime.sendMessage({ action: 'save-config', cfg });
      } else if (window.localStorage) {
        localStorage.setItem('makan-ext-cfg', JSON.stringify(cfg));
      }
    } catch {}
  }

  renderEngines();

  // Behavior Settings handlers
  selTrigger.onchange = () => {
    cfg.trigger = selTrigger.value;
    saveAndNotify();
    toast(I18N[currentUi].saved);
  };

  selDefaultTgt.onchange = () => {
    cfg.tgt = selDefaultTgt.value;
    saveAndNotify();
    toast(I18N[currentUi].saved);
  };

  selDefaultTone.onchange = () => {
    cfg.tone = selDefaultTone.value;
    saveAndNotify();
    toast(I18N[currentUi].saved);
  };

  if (txtAppUrl) {
    txtAppUrl.onchange = () => {
      const typed = txtAppUrl.value.trim() || 'http://127.0.0.1:50505';
      if (!isAllowListedLocalAddress(typed)) {
        txtAppUrl.value = cfg.appUrl || 'http://127.0.0.1:50505';
        toast('App address must be an allow-listed local address (127.0.0.1 / localhost with fixed ports)', 'warn');
        return;
      }
      cfg.appUrl = new URL(typed).origin;
      saveAndNotify();
      toast(I18N[currentUi].saved);
    };
  }

  txtWebAppUrl.onchange = () => {
    const typed = txtWebAppUrl.value.trim() || 'http://localhost:8080';
    const checked = safeHttpUrl(typed, null);
    if (!checked) {
      txtWebAppUrl.value = cfg.webAppUrl;
      toast('The web app address must start with http:// or https://', 'warn');
      return;
    }
    cfg.webAppUrl = checked;
    optOpenApp.href = cfg.webAppUrl;
    saveAndNotify();
    toast(I18N[currentUi].saved);
  };

  optOpenApp.onclick = async (e) => {
    e.preventDefault();
    const res = await chooseAppAddress({
      appUrl: cfg.appUrl || 'http://127.0.0.1:50505',
      webAppUrl: cfg.webAppUrl || 'http://localhost:8080',
      timeoutMs: 400
    });
    if (res.ok && res.url) {
      window.open(res.url, '_blank');
    } else {
      toast(res.error || 'Start MAKAN Translate first', 'warn');
    }
  };

  chkShowVulgar.onchange = () => {
    cfg.showVulgar = chkShowVulgar.checked;
    saveAndNotify();
    toast(I18N[currentUi].saved);
  };
  chkDictLookup.onchange = () => {
    cfg.dictLookup = chkDictLookup.checked;
    saveAndNotify();
    toast(I18N[currentUi].saved);
  };

  // ==================== SITE COMPATIBILITY SELF-CHECK ====================
  let activeTabInfo = null;

  async function runSiteCheck() {
    siteCheckBadge.className = 'opt-check-badge warn';
    siteCheckBadge.textContent = 'Checking…';
    siteCheckUrl.textContent = 'Detecting active tab…';
    siteCheckDetail.textContent = 'Querying browser tab state…';
    btnInjectScript.style.display = 'none';
    btnToggleSiteDisable.style.display = 'none';

    try {
      let res = null;
      if (window.chrome?.runtime?.sendMessage) {
        res = await chrome.runtime.sendMessage({ action: 'check-tab-status' });
      }

      if (!res || !res.ok) {
        siteCheckBadge.className = 'opt-check-badge warn';
        siteCheckBadge.textContent = 'Unavailable';
        siteCheckUrl.textContent = 'No tab info';
        siteCheckDetail.textContent = res?.reason || 'Could not determine active tab. Make sure a web page is open in this window.';
        return;
      }

      activeTabInfo = res;
      siteCheckUrl.textContent = res.url || 'about:blank';

      if (res.isInternal) {
        siteCheckBadge.className = 'opt-check-badge err';
        siteCheckBadge.textContent = 'Restricted';
        siteCheckDetail.textContent = `Browser security policies restrict extension content scripts on internal pages (${res.url.split(':')[0]}://). MAKAN Translate cannot run on browser settings or internal utility pages.`;
      } else if (res.isStore) {
        siteCheckBadge.className = 'opt-check-badge err';
        siteCheckBadge.textContent = 'Restricted';
        siteCheckDetail.textContent = 'Browser web store pages block extension execution by browser security policy. Please test on any normal website (e.g. Wikipedia, BBC, GitHub).';
      } else if (res.isDomainDisabled) {
        siteCheckBadge.className = 'opt-check-badge warn';
        siteCheckBadge.textContent = 'Disabled on Site';
        siteCheckDetail.textContent = `MAKAN is currently disabled on ${res.host} in your settings. Click the button below to re-enable it.`;
        btnToggleSiteDisable.style.display = 'inline-block';
        btnToggleSiteDisable.textContent = `Re-enable on ${res.host}`;
      } else if (!res.contentScriptResponding) {
        siteCheckBadge.className = 'opt-check-badge warn';
        siteCheckBadge.textContent = 'Not Injected Yet';
        siteCheckDetail.textContent = `This tab was opened before MAKAN Translate was installed or reloaded, or site access is pending. Reload the tab once, or click "Inject Script Now" below.`;
        btnInjectScript.style.display = 'inline-block';
        btnInjectScript.textContent = 'Inject Script Now';
      } else {
        siteCheckBadge.className = 'opt-check-badge ok';
        siteCheckBadge.textContent = 'Active & Ready';
        siteCheckDetail.textContent = `MAKAN Translate is active and fully operational on ${res.host || 'this site'}. Text selection button, right-click menu, Alt-selection, and whole-page translation are ready.`;
        btnToggleSiteDisable.style.display = 'inline-block';
        btnToggleSiteDisable.textContent = `Disable MAKAN on ${res.host}`;
      }
    } catch (e) {
      siteCheckBadge.className = 'opt-check-badge err';
      siteCheckBadge.textContent = 'Error';
      siteCheckDetail.textContent = 'Failed to check tab status: ' + e.message;
    }
  }

  btnRefreshSiteCheck.onclick = runSiteCheck;

  btnInjectScript.onclick = async () => {
    if (!activeTabInfo?.tabId) return;
    btnInjectScript.disabled = true;
    btnInjectScript.textContent = 'Injecting…';
    try {
      const res = await chrome.runtime.sendMessage({ action: 'inject-into-tab', tabId: activeTabInfo.tabId });
      if (res && res.ok) {
        toast('Content script injected successfully!', 'ok');
      } else {
        toast('Could not inject script: ' + (res?.error || 'Unknown error'), 'warn');
      }
    } catch (e) {
      toast('Injection failed: ' + e.message, 'err');
    } finally {
      btnInjectScript.disabled = false;
      await runSiteCheck();
    }
  };

  btnToggleSiteDisable.onclick = async () => {
    if (!activeTabInfo?.host) return;
    try {
      const res = await chrome.runtime.sendMessage({ action: 'toggle-site-disabled', host: activeTabInfo.host });
      if (res && res.ok) {
        toast(res.isSiteDisabled ? `Disabled on ${activeTabInfo.host}` : `Enabled on ${activeTabInfo.host}`, 'ok');
      }
    } catch (e) {
      toast('Toggle failed: ' + e.message, 'err');
    }
    await runSiteCheck();
  };

  // Run initial tab diagnostics
  runSiteCheck();

  // ==================== VOICE / TTS SETTINGS ====================
  cfg.tts = cfg.tts || {};
  chkPreferGeminiVoice.checked = !!cfg.tts.preferGemini;
  selGeminiVoice.value = cfg.tts.geminiVoice || 'Kore';
  selTtsRate.value = String(cfg.tts.rate || 1.0);

  function populateVoices() {
    if (!window.speechSynthesis) return;
    const voices = window.speechSynthesis.getVoices();
    const faVoices = voices.filter(v => v.lang.toLowerCase().startsWith('fa'));
    const enVoices = voices.filter(v => v.lang.toLowerCase().startsWith('en'));

    selVoiceFa.innerHTML = '';
    if (!faVoices.length) {
      selVoiceFa.innerHTML = '<option value="">None installed (Uses Gemini AI voice)</option>';
    } else {
      selVoiceFa.innerHTML = '<option value="">Auto (Best system voice)</option>';
      faVoices.forEach(v => {
        selVoiceFa.innerHTML += `<option value="${esc(v.voiceURI)}">${esc(v.name)} (${esc(v.lang)})</option>`;
      });
    }

    selVoiceEn.innerHTML = '<option value="">Auto (Best system voice)</option>';
    enVoices.forEach(v => {
      selVoiceEn.innerHTML += `<option value="${esc(v.voiceURI)}">${esc(v.name)} (${esc(v.lang)})</option>`;
    });

    if (cfg.tts.voices?.fa) selVoiceFa.value = cfg.tts.voices.fa;
    if (cfg.tts.voices?.en) selVoiceEn.value = cfg.tts.voices.en;
  }

  populateVoices();
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = populateVoices;
  }

  chkPreferGeminiVoice.onchange = () => {
    cfg.tts.preferGemini = chkPreferGeminiVoice.checked;
    saveAndNotify();
    toast(I18N[currentUi].saved);
  };

  selGeminiVoice.onchange = () => {
    cfg.tts.geminiVoice = selGeminiVoice.value;
    saveAndNotify();
    toast(I18N[currentUi].saved);
  };

  selTtsRate.onchange = () => {
    cfg.tts.rate = parseFloat(selTtsRate.value) || 1.0;
    saveAndNotify();
    toast(I18N[currentUi].saved);
  };

  selVoiceFa.onchange = () => {
    cfg.tts.voices = cfg.tts.voices || {};
    cfg.tts.voices.fa = selVoiceFa.value;
    saveAndNotify();
    toast(I18N[currentUi].saved);
  };

  selVoiceEn.onchange = () => {
    cfg.tts.voices = cfg.tts.voices || {};
    cfg.tts.voices.en = selVoiceEn.value;
    saveAndNotify();
    toast(I18N[currentUi].saved);
  };

  // Test Voice Handler
  let isTestingVoice = false;
  btnTestVoice.onclick = async () => {
    if (isTestingVoice) {
      try { window.speechSynthesis?.cancel(); } catch {}
      try { chrome.runtime.sendMessage({ action: 'stop-tts' }); } catch {}
      isTestingVoice = false;
      btnTestVoiceText.textContent = I18N[currentUi].btnTestVoice;
      return;
    }

    isTestingVoice = true;
    btnTestVoiceText.textContent = I18N[currentUi].testingVoice;

    const testText = currentUi === 'fa'
      ? 'سلام! خواندن متن مکان به درستی کار می‌کند.'
      : 'Hello! MAKAN Translate read-aloud is working properly.';
    const testLang = currentUi === 'fa' ? 'fa' : 'en';

    const finishTest = () => {
      isTestingVoice = false;
      btnTestVoiceText.textContent = I18N[currentUi].btnTestVoice;
    };

    try {
      const preferGemini = !!cfg.tts.preferGemini;
      const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
      const v = typeof pickBestVoice === 'function' ? pickBestVoice(testLang, voices, cfg.tts.voices) : null;

      if (preferGemini || !v) {
        const resp = await chrome.runtime.sendMessage({
          action: 'play-gemini-tts',
          text: testText,
          voice: cfg.tts.geminiVoice || 'Kore',
          rate: cfg.tts.rate || 1.0
        });
        if (resp && resp.ok) {
          if (resp.audioDataUrl) {
            const a = new Audio(resp.audioDataUrl);
            a.onended = finishTest;
            a.onerror = finishTest;
            await a.play();
            return;
          }
          setTimeout(finishTest, 3500);
          return;
        } else if (!v) {
          toast(resp?.error || 'No voice installed and Gemini API key not set.', 'warn');
          finishTest();
          return;
        }
      }

      if (v && window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(testText);
        u.voice = v;
        u.lang = v.lang || testLang;
        u.rate = cfg.tts.rate || 1.0;
        u.onend = finishTest;
        u.onerror = finishTest;
        window.speechSynthesis.speak(u);
      } else {
        finishTest();
      }
    } catch (e) {
      toast('Test voice failed: ' + e.message, 'err');
      finishTest();
    }
  };

  // Check connections
  btnCheckConn.onclick = async () => {
    btnCheckConn.disabled = true;
    btnCheckConnText.textContent = I18N[currentUi].checkingConn;
    toast(I18N[currentUi].checkingConn, 'warn');

    try {
      let resp = null;
      if (window.chrome?.runtime?.sendMessage) {
        try {
          resp = await chrome.runtime.sendMessage({ action: 'test-all-engines' });
        } catch {}
      }

      if (resp && resp.ok && resp.results) {
        connResults = resp.results;
      } else if (typeof MakanEngine !== 'undefined') {
        connResults = await MakanEngine.testAllConnections(cfg);
      }

      if (connResults) {
        renderEngines();
        let ok = 0;
        Object.values(connResults).forEach(v => { if (v.code === 'works') ok++; });
        toast(`Connections checked: ${ok}/${cfg.order.length} working`, 'ok');
      }
    } catch (e) {
      toast('Connection check error: ' + e.message, 'err');
    } finally {
      btnCheckConn.disabled = false;
      btnCheckConnText.textContent = I18N[currentUi].btnCheckConn;
    }
  };

  // Toggle UI language
  optLangToggle.onclick = () => {
    const next = currentUi === 'en' ? 'fa' : 'en';
    cfg.ui = next;
    saveAndNotify();
    applyUi(next);
    renderEngines();
  };

  // Import from Web App via file
  btnImportFile.onclick = () => fileImportInput.click();
  fileImportInput.onchange = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const txt = await file.text();
      applySettingsJson(txt);
      fileImportInput.value = '';
    } catch (err) {
      toast('Invalid file: ' + err.message, 'err');
    }
  };

  // Paste JSON modal
  btnPasteJson.onclick = () => {
    modalPasteOv.hidden = false;
    modalPasteArea.value = '';
    modalPasteArea.focus();
  };
  modalPasteCancel.onclick = () => modalPasteOv.hidden = true;
  modalPasteSave.onclick = () => {
    const val = modalPasteArea.value.trim();
    if (!val) return;
    if (applySettingsJson(val)) {
      modalPasteOv.hidden = true;
    }
  };

  async function applySettingsJson(rawJson) {
    try {
      const data = JSON.parse(rawJson);
      if (!data || typeof data !== 'object') throw new Error('not a settings file');
      // Support the web app's export (settings nested under "cfg"), a stored copy, or a plain settings object.
      const importedCfg = (data.cfg && typeof data.cfg === 'object') ? data.cfg : ((data.makan_cfg && typeof data.makan_cfg === 'object') ? data.makan_cfg : data);

      const next = Object.assign({}, cfg);
      if (Array.isArray(importedCfg.order)) next.order = importedCfg.order;
      if (importedCfg.eng && typeof importedCfg.eng === 'object') {
        next.eng = Object.assign({}, cfg.eng);
        for (const [k, v] of Object.entries(importedCfg.eng)) {
          if (ENG[k] && v && typeof v === 'object') next.eng[k] = Object.assign({}, cfg.eng[k], v);
        }
      }
      if (importedCfg.tts && typeof importedCfg.tts === 'object') {
        next.tts = Object.assign({}, cfg.tts, importedCfg.tts);
        if (!next.eng?.gemini?.key && importedCfg.tts.key) {
          next.eng = next.eng || {};
          next.eng.gemini = next.eng.gemini || {};
          next.eng.gemini.key = String(importedCfg.tts.key).trim();
        }
      }
      if (!next.eng?.gemini?.key && (importedCfg.geminiKey || importedCfg.gemini_key)) {
        next.eng = next.eng || {};
        next.eng.gemini = next.eng.gemini || {};
        next.eng.gemini.key = String(importedCfg.geminiKey || importedCfg.gemini_key).trim();
      }
      if (Array.isArray(importedCfg.glossary)) next.glossary = importedCfg.glossary;
      for (const k of ['tone', 'src', 'tgt']) if (importedCfg[k]) next[k] = importedCfg[k];
      // Keep only values this extension understands (the web app's export also lists engines that exist only there).
      const clean = sanitizeConfig(next, cfg);
      for (const k of Object.keys(cfg)) delete cfg[k];
      Object.assign(cfg, clean);

      await saveAndNotify();
      selDefaultTgt.value = cfg.tgt || 'fa';
      selDefaultTone.value = cfg.tone || 'neutral';
      renderEngines();
      toast('Settings and API keys imported successfully!', 'ok');
      return true;
    } catch (e) {
      toast('Failed to parse settings JSON: ' + e.message, 'err');
      return false;
    }
  }

  // Export settings backup
  btnExportSettings.onclick = () => {
    const exportData = {
      app: 'MAKAN Translate',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      order: cfg.order,
      eng: cfg.eng,
      src: cfg.src,
      tgt: cfg.tgt,
      tone: cfg.tone,
      glossary: cfg.glossary
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'makan-translate-settings.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('Settings exported to makan-translate-settings.json', 'ok');
  };

  // ==================== DIAGNOSTICS AND RESET ====================
  // A short report for support. It never contains a key: only whether one is present.
  async function buildDiagnostics() {
    let lastErrors = {};
    try { lastErrors = (await chrome.storage.local.get('makan_last_errors')).makan_last_errors || {}; } catch {}
    const lines = [];
    let version = '?';
    try { version = chrome.runtime.getManifest().version; } catch {}
    lines.push(`MAKAN Translate extension ${version}`);
    lines.push(`Browser: ${navigator.userAgent}`);
    lines.push(`Languages: ${cfg.src || 'auto'} -> ${cfg.tgt || '?'}, mode: ${cfg.transMode || 'default'}`);
    lines.push('Engines (in order):');
    for (const id of cfg.order || []) {
      const e = (cfg.eng || {})[id] || {};
      const info = (typeof ENG !== 'undefined' && ENG[id]) || {};
      const err = lastErrors[id];
      lines.push(`- ${info.name || id}: ${e.on === false ? 'off' : 'on'}, key: ${e.key ? 'yes' : 'no'}${info.ai ? `, model: ${e.model || '(none)'}` : ''}, last error: ${err ? `${err.reason} (${err.time})` : 'none'}`);
    }
    lines.push(`Read-aloud: ${(cfg.tts && cfg.tts.mode) || 'browser'}, key: ${cfg.tts && cfg.tts.key ? 'yes' : 'no'}`);
    return lines.join('\n');
  }
  const btnCopyDiagnostics = document.getElementById('btnCopyDiagnostics');
  btnCopyDiagnostics.onclick = async () => {
    const text = await buildDiagnostics();
    try { await navigator.clipboard.writeText(text); toast('Diagnostics copied. They contain no keys.', 'ok'); }
    catch { toast('Could not copy automatically; the report is shown in the console.', 'warn'); console.log(text); }
  };

  const btnResetSettings = document.getElementById('btnResetSettings');
  let resetArmed = null;
  btnResetSettings.onclick = async () => {
    const label = document.getElementById('btnResetSettingsText');
    if (!resetArmed) {
      label.textContent = 'Click again to erase all settings and keys';
      resetArmed = setTimeout(() => { resetArmed = null; label.textContent = 'Reset extension settings'; }, 6000);
      return;
    }
    clearTimeout(resetArmed); resetArmed = null;
    try { await chrome.storage.local.remove(['makan_cfg', 'makan_last_errors']); } catch {}
    toast('Settings erased. Reloading…', 'ok');
    setTimeout(() => location.reload(), 400);
  };
});
