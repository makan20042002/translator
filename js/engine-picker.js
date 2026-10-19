(function () {
  'use strict';

  const mountedInstances = [];

  function getStateLabel(state) {
    if (typeof L === 'function') {
      if (state === 'ready') return L('engineStateReady') || 'ready';
      if (state === 'needs-key') return L('engineStateNeedsKey') || 'needs a key';
      if (state === 'not-downloaded') return L('engineStateNotDownloaded') || 'not downloaded';
      if (state === 'offline-blocked') return L('engineStateOfflineBlocked') || 'offline mode blocks it';
      if (state === 'not-here') return L('engineStateNotHere') || 'not supported in this browser';
    }
    return state;
  }

  function updateAllPickers() {
    for (let i = mountedInstances.length - 1; i >= 0; i--) {
      const inst = mountedInstances[i];
      if (!inst.container || !inst.container.isConnected) {
        mountedInstances.splice(i, 1);
        continue;
      }
      inst.refresh();
    }
  }

  function mountEnginePicker(container, opts = {}) {
    if (!container) return null;

    const wrapper = document.createElement('div');
    wrapper.className = 'engine-picker';
    if (opts.context) wrapper.dataset.pickerContext = opts.context;

    const mainRow = document.createElement('div');
    mainRow.className = 'engine-picker-main-row';

    const label = document.createElement('label');
    label.className = 'engine-picker-label';

    const labelText = document.createElement('span');
    labelText.className = 'engine-picker-label-text';
    labelText.setAttribute('data-t', 'enginePickerLabel');
    labelText.textContent = (typeof L === 'function' ? L('enginePickerLabel') : 'Translate with');

    const select = document.createElement('select');
    select.className = 'engine-picker-select';
    select.setAttribute('aria-label', (typeof L === 'function' ? L('enginePickerLabel') : 'Translate with'));

    label.appendChild(labelText);
    label.appendChild(select);

    const modelLabel = document.createElement('label');
    modelLabel.className = 'engine-picker-model-label';
    modelLabel.hidden = true;

    const modelLabelText = document.createElement('span');
    modelLabelText.className = 'engine-picker-model-label-text';
    modelLabelText.setAttribute('data-t', 'model');
    modelLabelText.textContent = (typeof L === 'function' ? L('model') : 'Model');

    const modelSelect = document.createElement('select');
    modelSelect.className = 'engine-picker-model-select';
    modelSelect.setAttribute('aria-label', (typeof L === 'function' ? L('model') : 'Model'));

    modelLabel.appendChild(modelLabelText);
    modelLabel.appendChild(modelSelect);

    const hubLink = document.createElement('a');
    hubLink.href = '#';
    hubLink.className = 'engine-picker-hub-link';
    hubLink.setAttribute('data-t', 'engineGetModelsHub');
    hubLink.textContent = (typeof L === 'function' ? L('engineGetModelsHub') || 'Get models' : 'Get models');
    hubLink.hidden = true;
    hubLink.onclick = (e) => {
      e.preventDefault();
      const hubBtn = document.querySelector('#tabs button[data-tab="models"]');
      if (hubBtn) { hubBtn.click(); return; }
      if (typeof openOfflineSettings === 'function') { openOfflineSettings(); return; }
    };

    const testBtn = document.createElement('button');
    testBtn.type = 'button';
    testBtn.className = 'btn ghost engine-picker-test-btn';
    testBtn.setAttribute('data-t', 'engineTestBtn');
    testBtn.textContent = (typeof L === 'function' ? L('engineTestBtn') : 'Test');

    mainRow.appendChild(label);
    mainRow.appendChild(modelLabel);
    mainRow.appendChild(hubLink);
    mainRow.appendChild(testBtn);

    const subRow = document.createElement('div');
    subRow.className = 'engine-picker-sub-row';

    const usingSpan = document.createElement('span');
    usingSpan.className = 'engine-picker-using';
    const usingLabel = document.createElement('span');
    usingLabel.className = 'engine-picker-using-label';
    usingLabel.setAttribute('data-t', 'engineUsing');
    usingLabel.textContent = (typeof L === 'function' ? L('engineUsing') : 'Using') + ': ';
    const usingVal = document.createElement('strong');
    usingVal.className = 'engine-picker-using-val';
    usingSpan.appendChild(usingLabel);
    usingSpan.appendChild(usingVal);

    const sep = document.createElement('span');
    sep.className = 'engine-picker-sep';
    sep.setAttribute('aria-hidden', 'true');
    sep.textContent = '·';

    const link = document.createElement('a');
    link.href = '#';
    link.className = 'engine-picker-keys-link';
    link.setAttribute('data-t', 'engineGetModelsKeys');
    link.textContent = (typeof L === 'function' ? L('engineGetModelsKeys') : 'Get models / keys');

    subRow.appendChild(usingSpan);
    subRow.appendChild(sep);
    subRow.appendChild(link);

    const statusEl = document.createElement('div');
    statusEl.className = 'engine-picker-status';
    statusEl.setAttribute('aria-live', 'polite');
    statusEl.hidden = true;

    wrapper.appendChild(mainRow);
    wrapper.appendChild(subRow);
    wrapper.appendChild(statusEl);

    container.innerHTML = '';
    container.appendChild(wrapper);

    const API_ENGINE_MODELS = {
      gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
      openrouter: ['meta-llama/llama-3.3-70b-instruct:free', 'google/gemini-2.0-flash-exp:free', 'deepseek/deepseek-r1:free', 'mistralai/mistral-7b-instruct:free'],
      mistral: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest', 'codestral-latest', 'open-mistral-nemo'],
      cerebras: ['gpt-oss-120b', 'llama-3.3-70b', 'llama3.1-8b', 'llama3.1-70b'],
      openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1', 'o3-mini'],
      claude: ['claude-haiku-4-5', 'claude-sonnet-4-5', 'claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest'],
      groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it']
    };

    function updateUsingLine() {
      const curChoice = select.value;
      let effectiveId = curChoice;
      if (curChoice === 'auto') {
        const order = (typeof cfg !== 'undefined' && cfg.order) ? cfg.order : [];
        effectiveId = order.find(id => (typeof usable === 'function' ? usable(id) : (typeof ENG !== 'undefined' && ENG.getStatus?.(id)?.usable))) || null;
      }

      if (!effectiveId || typeof ENG === 'undefined' || !ENG[effectiveId]) {
        usingVal.textContent = (typeof L === 'function' ? L('noEngine') : 'None');
      } else {
        const eng = ENG[effectiveId];
        let model = (typeof cfg !== 'undefined' && cfg.eng?.[effectiveId]?.model) || eng.model || '';
        if (effectiveId === 'nllb') {
          const langs = opts.getLangs ? opts.getLangs() : {};
          const s = langs.src || (typeof $ === 'function' && $('src')?.value) || 'en';
          const t = langs.tgt || (typeof $ === 'function' && $('tgt')?.value) || 'fa';
          const m = (typeof pickTr === 'function') ? pickTr(s, t) : null;
          if (m) {
            model = (typeof mcText === 'function') ? mcText(m.name) : (m.name || m.repo);
          } else if (typeof cfg !== 'undefined' && cfg.trModel && cfg.trModel !== 'auto' && typeof MC !== 'undefined' && MC.models) {
            const direct = MC.models.find(x => x.id === cfg.trModel);
            if (direct) model = (typeof mcText === 'function') ? mcText(direct.name) : (direct.name || direct.repo);
          }
          if (!model) model = 'NLLB-200 600M';
        }
        usingVal.textContent = eng.name + (model ? ` · ${model}` : '');
      }
    }

    let refreshSeq = 0;
    async function updateModelPicker(curChoice) {
      const seq = ++refreshSeq;
      modelSelect.onchange = null;
      hubLink.hidden = true;

      if (!curChoice || curChoice === 'auto' || curChoice === 'google' || curChoice === 'mymemory' || curChoice === 'chrome') {
        modelLabel.hidden = true;
        return;
      }

      if (API_ENGINE_MODELS[curChoice]) {
        modelLabel.hidden = false;
        const list = API_ENGINE_MODELS[curChoice].slice();
        const saved = (typeof cfg !== 'undefined' && cfg.eng?.[curChoice]?.model) || '';
        if (saved && !list.includes(saved)) {
          list.unshift(saved);
        }
        const datalist = document.getElementById('models');
        if (datalist && datalist.options) {
          for (let i = 0; i < datalist.options.length; i++) {
            const v = datalist.options[i].value;
            if (v && !list.includes(v)) list.push(v);
          }
        }
        modelSelect.innerHTML = '';
        for (const m of list) {
          const opt = document.createElement('option');
          opt.value = m;
          opt.textContent = m;
          modelSelect.appendChild(opt);
        }
        modelSelect.value = saved || list[0];
        modelSelect.onchange = () => {
          const chosen = modelSelect.value;
          if (typeof cfg !== 'undefined' && cfg.eng?.[curChoice]) {
            cfg.eng[curChoice].model = chosen;
            if (typeof saveCfg === 'function') saveCfg();
            if (typeof showSettingsAutoSaved === 'function') showSettingsAutoSaved();
            const setInp = document.querySelector(`#engList .eng[data-id="${curChoice}"] input[data-f="model"]`);
            if (setInp) setInp.value = chosen;
            updateAllPickers();
          }
        };
        return;
      }

      if (curChoice === 'ollama') {
        const offline = (typeof isOff === 'function' && isOff()) || (typeof cfg !== 'undefined' && !!cfg.offline);
        const ollamaOn = (typeof cfg !== 'undefined' && cfg.eng?.ollama?.on !== false);
        if (offline || !ollamaOn) {
          modelLabel.hidden = true;
          return;
        }
        modelLabel.hidden = false;
        let models = null;
        try {
          if (typeof fetchOllamaModels === 'function') {
            models = await fetchOllamaModels();
          }
        } catch (_) {
          models = null;
        }
        if (seq !== refreshSeq || select.value !== 'ollama') return;
        modelSelect.innerHTML = '';
        if (models && models.length > 0) {
          for (const m of models) {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            modelSelect.appendChild(opt);
          }
          const saved = (typeof cfg !== 'undefined' && cfg.eng?.ollama?.model) || '';
          if (saved && models.includes(saved)) {
            modelSelect.value = saved;
          } else {
            modelSelect.value = models[0];
            if (!saved && typeof cfg !== 'undefined' && cfg.eng?.ollama) {
              cfg.eng.ollama.model = models[0];
              if (typeof saveCfg === 'function') saveCfg();
            }
          }
          modelSelect.onchange = () => {
            const chosen = modelSelect.value;
            if (chosen && typeof cfg !== 'undefined' && cfg.eng?.ollama) {
              cfg.eng.ollama.model = chosen;
              if (typeof saveCfg === 'function') saveCfg();
              if (typeof showSettingsAutoSaved === 'function') showSettingsAutoSaved();
              const inp = document.querySelector('#engList .eng[data-id="ollama"] input[data-f="model"]');
              if (inp) inp.value = chosen;
              updateAllPickers();
            }
          };
        } else {
          const notRunningText = (typeof L === 'function' ? (L('connLocalDown') || 'not running') : 'not running');
          const opt = document.createElement('option');
          opt.value = '';
          opt.textContent = notRunningText;
          opt.disabled = true;
          opt.selected = true;
          modelSelect.appendChild(opt);
        }
        return;
      }

      if (curChoice === 'custom') {
        modelLabel.hidden = false;
        let models = null;
        try {
          if (typeof listModels === 'function') {
            models = await listModels('custom');
          }
        } catch (_) {
          models = null;
        }
        if (seq !== refreshSeq || select.value !== 'custom') return;
        modelSelect.innerHTML = '';
        if (models && models.length > 0) {
          for (const m of models) {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            modelSelect.appendChild(opt);
          }
          const saved = (typeof cfg !== 'undefined' && cfg.eng?.custom?.model) || '';
          if (saved && models.includes(saved)) {
            modelSelect.value = saved;
          } else {
            modelSelect.value = models[0];
            if (!saved && typeof cfg !== 'undefined' && cfg.eng?.custom) {
              cfg.eng.custom.model = models[0];
              if (typeof saveCfg === 'function') saveCfg();
            }
          }
          modelSelect.onchange = () => {
            const chosen = modelSelect.value;
            if (chosen && typeof cfg !== 'undefined' && cfg.eng?.custom) {
              cfg.eng.custom.model = chosen;
              if (typeof saveCfg === 'function') saveCfg();
              if (typeof showSettingsAutoSaved === 'function') showSettingsAutoSaved();
              const inp = document.querySelector('#engList .eng[data-id="custom"] input[data-f="model"]');
              if (inp) inp.value = chosen;
              updateAllPickers();
            }
          };
        } else {
          const notRunningText = (typeof L === 'function' ? (L('connLocalDown') || 'not running') : 'not running');
          const opt = document.createElement('option');
          opt.value = '';
          opt.textContent = notRunningText;
          opt.disabled = true;
          opt.selected = true;
          modelSelect.appendChild(opt);
        }
        return;
      }

      if (curChoice === 'nllb') {
        modelLabel.hidden = false;
        hubLink.hidden = false;
        const allTr = (typeof trModels === 'function')
          ? trModels()
          : ((typeof MC !== 'undefined' && MC.models) ? MC.models.filter(m => m.job === 'translate') : []);

        modelSelect.innerHTML = '';
        for (const m of allTr) {
          const opt = document.createElement('option');
          opt.value = m.id;
          const isReady = (typeof mcReady === 'function') ? mcReady(m) : false;
          const size = (typeof mcSize === 'function' && m.bytes) ? mcSize(m.bytes) : '';
          const name = (typeof mcText === 'function') ? mcText(m.name) : (m.name || m.repo);
          const readyText = isReady
            ? (typeof L === 'function' ? (L('ready') || 'ready') : 'ready')
            : (typeof L === 'function' ? (L('engineStateNotDownloaded') || 'not downloaded') : 'not downloaded');
          const licenceNote = (m.id === 'tr-nllb-600' || m.kind === 'nllb') ? ' · CC BY-NC 4.0' : '';
          opt.textContent = `${name}${size ? ' (' + size + ')' : ''} — ${readyText}${licenceNote}`;
          if (!isReady) {
            opt.disabled = true;
          }
          modelSelect.appendChild(opt);
        }

        const savedTr = (typeof cfg !== 'undefined' && cfg.trModel) ? cfg.trModel : 'tr-nllb-600';
        if (savedTr && savedTr !== 'auto') {
          modelSelect.value = savedTr;
        } else {
          const autoM = (typeof pickAutoTr === 'function') ? pickAutoTr() : null;
          modelSelect.value = autoM ? autoM.id : 'tr-nllb-600';
        }

        modelSelect.onchange = () => {
          const chosen = modelSelect.value;
          if (chosen && typeof cfg !== 'undefined') {
            cfg.trModel = chosen;
            if (typeof saveCfg === 'function') saveCfg();
            if (typeof mcRender === 'function') mcRender();
            if (typeof fillEngines === 'function') fillEngines();
            const trSel = document.getElementById('offTrModelSel');
            if (trSel) trSel.value = chosen;
            updateAllPickers();
          }
        };
        return;
      }

      modelLabel.hidden = true;
    }

    function refresh() {
      labelText.textContent = (typeof L === 'function' ? L('enginePickerLabel') : 'Translate with');
      select.setAttribute('aria-label', labelText.textContent);
      modelLabelText.textContent = (typeof L === 'function' ? L('model') : 'Model');
      modelSelect.setAttribute('aria-label', modelLabelText.textContent);
      hubLink.textContent = (typeof L === 'function' ? L('engineGetModelsHub') || 'Get models' : 'Get models');
      if (!testCtl) {
        testBtn.textContent = (typeof L === 'function' ? L('engineTestBtn') : 'Test');
      }
      usingLabel.textContent = (typeof L === 'function' ? L('engineUsing') : 'Using') + ': ';
      link.textContent = (typeof L === 'function' ? L('engineGetModelsKeys') : 'Get models / keys');

      const curChoice = (typeof store !== 'undefined' ? store.get('engine', 'auto') : 'auto');
      const langs = opts.getLangs ? opts.getLangs() : {};
      select.innerHTML = '';

      // Auto option
      const autoOpt = document.createElement('option');
      autoOpt.value = 'auto';
      autoOpt.textContent = (typeof L === 'function' ? L('enginePickerAuto') : 'Auto (your order in Settings)');
      select.appendChild(autoOpt);

      const order = (typeof cfg !== 'undefined' && cfg.order) ? cfg.order : (typeof DEF_ORDER !== 'undefined' ? DEF_ORDER : []);
      if (typeof ENG !== 'undefined') {
        for (const id of order) {
          if (!ENG[id]) continue;
          const st = (typeof ENG.getStatus === 'function') ? ENG.getStatus(id, langs) : { state: 'ready', usable: true };
          if (st.state === 'not-here') continue;

          const opt = document.createElement('option');
          opt.value = id;
          const stateLabel = getStateLabel(st.state);
          opt.textContent = `${ENG[id].name} — ${stateLabel}`;
          if (!st.usable) {
            opt.disabled = true;
          }
          select.appendChild(opt);
        }
      }

      select.value = curChoice;
      if (select.value !== curChoice) {
        select.value = 'auto';
      }

      updateUsingLine();
      updateModelPicker(select.value);
    }

    select.onchange = () => {
      const val = select.value;
      if (typeof store !== 'undefined') {
        store.set('engine', val);
      }
      if (typeof $ === 'function') {
        const engEl = $('engine');
        if (engEl && engEl !== select) engEl.value = val;
        const dEng = $('dEngineSel');
        if (dEng && dEng !== select) dEng.value = (val === 'auto' ? '' : val);
      }
      updateAllPickers();
      if (typeof updateSubEngineNotice === 'function') {
        updateSubEngineNotice();
      }
      if (typeof updateDocEngineNoticeFromPicker === 'function') {
        updateDocEngineNoticeFromPicker();
      }
    };

    link.onclick = (e) => {
      e.preventDefault();
      const curChoice = select.value;
      if (curChoice === 'nllb') {
        const hubBtn = document.querySelector('#tabs button[data-tab="models"]');
        if (hubBtn) { hubBtn.click(); return; }
        if (typeof openOfflineSettings === 'function') { openOfflineSettings(); return; }
      }
      const openSet = document.getElementById('openSet');
      if (openSet) openSet.click();
      const enginesTab = document.getElementById('setTabBtnEngines');
      if (enginesTab) enginesTab.click();
    };

    let testCtl = null;
    testBtn.onclick = async () => {
      if (testCtl) {
        testCtl.abort();
        testCtl = null;
        testBtn.textContent = (typeof L === 'function' ? L('engineTestBtn') : 'Test');
        statusEl.hidden = false;
        statusEl.className = 'engine-picker-status';
        statusEl.textContent = (typeof L === 'function' ? L('stopped') : 'Cancelled.');
        return;
      }

      const curChoice = select.value;
      let targetEngine = curChoice;
      if (curChoice === 'auto') {
        const order = (typeof cfg !== 'undefined' && cfg.order) ? cfg.order : [];
        targetEngine = order.find(id => (typeof usable === 'function' ? usable(id) : ENG?.getStatus?.(id)?.usable)) || null;
        if (!targetEngine) {
          statusEl.hidden = false;
          statusEl.className = 'engine-picker-status err';
          statusEl.textContent = (typeof L === 'function' ? (isOff() ? L('noOff') : L('noEngine')) : 'No engine available');
          return;
        }
      } else {
        if (typeof usable === 'function' && !usable(targetEngine)) {
          statusEl.hidden = false;
          statusEl.className = 'engine-picker-status err';
          statusEl.textContent = (typeof why === 'function' && why(targetEngine)) || 'Engine unavailable';
          return;
        }
      }

      testCtl = new AbortController();
      testBtn.textContent = (typeof L === 'function' ? L('stop') : 'Stop');
      statusEl.hidden = false;
      statusEl.className = 'engine-picker-status';
      statusEl.textContent = (typeof L === 'function' ? L('engineTesting') : 'Testing…');

      const langs = opts.getLangs ? opts.getLangs() : {};
      const tgt = langs.tgt || (typeof $ === 'function' && $('tgt')?.value) || 'fa';
      const startTime = Date.now();
      try {
        const res = await translateItems(['Hello, how are you?'], {
          src: 'en',
          tgt: tgt,
          engine: targetEngine,
          chain: [targetEngine],
          signal: testCtl.signal
        });
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const text = res?.out?.[0] || '';
        statusEl.className = 'engine-picker-status ok';
        statusEl.textContent = `${text} (${elapsed}s)`;
      } catch (err) {
        if (err.name === 'AbortError' || testCtl?.signal.aborted) {
          statusEl.className = 'engine-picker-status';
          statusEl.textContent = (typeof L === 'function' ? L('stopped') : 'Cancelled.');
        } else {
          statusEl.className = 'engine-picker-status err';
          const plain = (typeof toPlainReason === 'function' ? toPlainReason(err) : '') || err.message || 'Failed';
          statusEl.textContent = (typeof scrubKeys === 'function' ? scrubKeys(plain) : plain);
        }
      } finally {
        testCtl = null;
        testBtn.textContent = (typeof L === 'function' ? L('engineTestBtn') : 'Test');
      }
    };

    const inst = { container, refresh, select, modelSelect, modelLabel, hubLink, testBtn, updateUsingLine };
    mountedInstances.push(inst);
    refresh();
    return inst;
  }

  if (typeof ENG !== 'undefined') {
    ENG.mountEnginePicker = mountEnginePicker;
    ENG.renderEnginePicker = mountEnginePicker;
    ENG.updateEnginePickers = updateAllPickers;
  }
  if (typeof window !== 'undefined' && window.ENG) {
    window.ENG.mountEnginePicker = mountEnginePicker;
    window.ENG.renderEnginePicker = mountEnginePicker;
    window.ENG.updateEnginePickers = updateAllPickers;
  }
})();
