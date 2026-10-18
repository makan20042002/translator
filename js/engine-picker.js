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

    const testBtn = document.createElement('button');
    testBtn.type = 'button';
    testBtn.className = 'btn ghost engine-picker-test-btn';
    testBtn.setAttribute('data-t', 'engineTestBtn');
    testBtn.textContent = (typeof L === 'function' ? L('engineTestBtn') : 'Test');

    mainRow.appendChild(label);
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
          model = m ? ((typeof mcText === 'function') ? mcText(m.name) : (m.name || m.repo)) : 'NLLB-200 600M';
        }
        usingVal.textContent = eng.name + (model ? ` · ${model}` : '');
      }
    }

    function refresh() {
      labelText.textContent = (typeof L === 'function' ? L('enginePickerLabel') : 'Translate with');
      select.setAttribute('aria-label', labelText.textContent);
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
    }

    select.onchange = () => {
      const val = select.value;
      if (typeof store !== 'undefined') {
        store.set('engine', val);
      }
      updateAllPickers();
      if (typeof updateSubEngineNotice === 'function') {
        updateSubEngineNotice();
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

    const inst = { container, refresh, select, testBtn, updateUsingLine };
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
