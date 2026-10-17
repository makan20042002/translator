/*
 * media-ui.js - UI + state of the Media Translate module.
 *
 * Public API (the ONLY global the module creates is window.MediaTranslate):
 *   MediaTranslate.mount(rootEl, host) -> Promise<handle>
 *   handle = { el, refresh(), unmount(), getFile(), getAudio(), getState(), clear() }
 *     getAudio() -> { samples: Float32Array (16 kHz mono), sampleRate, duration, ... } or null
 *
 * Host contract (see docs/OVERVIEW.md):
 *   host.t(key)      -> string            (required)
 *   host.getLang()   -> 'en' | 'fa'       (optional, default 'en')
 *   host.limits      -> { maxBytes, maxSeconds, metadataTimeoutMs, asrWindowSec }  (optional, mainly for tests)
 *   Speech recognition (item 4). The "Transcribe" card only appears when the host gives getWhisperChoice:
 *   host.getWhisperChoice() -> { repo, name, memMB, ready, gpu? } or null
 *                              (ready === false: chosen model is not downloaded yet)
 *   host.getLanguages()     -> [{ code, name }]   (language list for the Transcribe card)
 *   host.engine             -> { libUrl, workerFactory? }   (Transformers.js address; set by the host)
 *   host.onModelUsed(repo)  -> called once the model is loaded for a run     (optional)
 *   host.openModelHub()     -> opens the host's model page                    (optional)
 *   Translation (item 6). The "Translate subtitles" card appears when the host gives translateCues:
 *   host.translateCues(cues, { src, tgt, onProgress, signal, onInfo }) -> Promise<cues>
 *       cues [{ s, e, o, t }]; the result has the same length and order with t filled in. Rejects with
 *       an Error that has .code (aborted | nokey | badkey | notdownloaded | unsupported | memory |
 *       engine | network | rate | badreply | failed) and .partial (cues finished so far).
 *       onInfo({ name, kind:'offline'|'online', model?, licence? }) tells which engine is translating.
 *   host.getTranslateChoice() -> { name, kind, model?, licence?, licenceNote?, ready?, needsKey? }  (optional)
 *
 * Needs media-i18n.js, media-file.js and media-decode.js loaded first (media-asr.js is optional:
 * without it there is simply no Transcribe card; media-cues.js is optional too: without it there are
 * no subtitle cues, handle.getCues() gives null).
 * Leak rules: no top-level state outside this IIFE, no window.* writes besides
 * MediaTranslate, every listener/element/stylesheet we add is removed on unmount.
 */
(function () {
  'use strict';
  var MT = (window.MediaTranslate = window.MediaTranslate || {});

  // Folder this script was loaded from, so the module finds media-tab.html and media.css
  // no matter where the host app puts the folder.
  var script = document.currentScript;
  var BASE = script && script.src ? script.src.replace(/[^\/]*$/, '') : 'media/';

  var fragmentPromise = null; // cached HTML text of media-tab.html
  var cssUsers = 0; // how many mounted tabs currently use the stylesheet
  var cssLink = null; // the single <link> we added (if any)
  var cssReady = null;

  function loadFragment() {
    if (!fragmentPromise) {
      fragmentPromise = fetch(BASE + 'media-tab.html')
        .then(function (r) {
          if (!r.ok) throw new Error('media-tab.html: HTTP ' + r.status);
          return r.text();
        })
        .catch(function (err) {
          fragmentPromise = null; // allow a retry on the next mount
          throw err;
        });
    }
    return fragmentPromise;
  }

  function acquireCss() {
    cssUsers += 1;
    if (cssUsers === 1) {
      cssReady = new Promise(function (resolve) {
        cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = BASE + 'media.css';
        cssLink.setAttribute('data-mt-css', '1');
        cssLink.onload = cssLink.onerror = function () { resolve(); };
        document.head.appendChild(cssLink);
      });
    }
    return cssReady;
  }

  function releaseCss() {
    cssUsers -= 1;
    if (cssUsers === 0 && cssLink) {
      cssLink.remove();
      cssLink = null;
      cssReady = null;
    }
  }

  function currentLang(host) {
    var l = typeof host.getLang === 'function' ? host.getLang() : 'en';
    return l === 'fa' ? 'fa' : 'en';
  }

  function applyStrings(container, host) {
    var lang = currentLang(host);
    container.setAttribute('lang', lang);
    container.setAttribute('dir', lang === 'fa' ? 'rtl' : 'ltr');
    var nodes = container.querySelectorAll('[data-mt-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = host.t(nodes[i].getAttribute('data-mt-i18n'));
    }
  }

  // Ask the browser for the length of the file using a temporary <audio>/<video> element.
  // Resolves with seconds, or NaN when unknown (cannot decode / unknown length / timeout).
  // The object URL is always revoked.
  function readDuration(file, kind, timeoutMs) {
    return new Promise(function (resolve) {
      var el = document.createElement(kind === 'video' ? 'video' : 'audio');
      var url = URL.createObjectURL(file);
      var done = false;
      var timer = null;
      function finish(value) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        el.removeAttribute('src');
        try { el.load(); } catch (e) { /* element is being thrown away anyway */ }
        URL.revokeObjectURL(url);
        resolve(value);
      }
      el.preload = 'metadata';
      el.onloadedmetadata = function () {
        var d = el.duration;
        finish(isFinite(d) && d > 0 ? d : NaN);
      };
      el.onerror = function () { finish(NaN); };
      timer = setTimeout(function () { finish(NaN); }, timeoutMs);
      el.src = url;
    });
  }

  var STAGE_KEYS = { read: 'mediaStageRead', decode: 'mediaStageDecode', mix: 'mediaStageMix', extract: 'mediaStageFfmpeg' };
  // What ffmpeg (Windows app only, through host.desktop) can answer, and the text for each.
  var FF_ERR = {
    noffmpeg: 'mediaErrFfmpegGone', nopath: 'mediaErrFfmpegNoPath', ffmpegfail: 'mediaErrFfmpeg',
    empty: 'mediaErrDecodeEmpty', memory: 'mediaErrDecodeMemory', failed: 'mediaErrFfmpeg'
  };

  MT.mount = async function mount(rootEl, host) {
    if (!rootEl || rootEl.nodeType !== 1) {
      throw new TypeError('MediaTranslate.mount: rootEl must be a DOM element');
    }
    if (!host || typeof host.t !== 'function') {
      throw new TypeError('MediaTranslate.mount: host.t(key) is required');
    }
    var F = MT.file;
    if (!F) throw new Error('MediaTranslate.mount: media-file.js is not loaded');
    if (!MT.decode) throw new Error('MediaTranslate.mount: media-decode.js is not loaded');

    var cssPromise = acquireCss();
    var html;
    try {
      html = await loadFragment();
      await cssPromise;
    } catch (err) {
      releaseCss();
      throw err;
    }

    var lim = Object.assign(
      { maxBytes: F.MAX_BYTES, maxSeconds: F.MAX_SECONDS, metadataTimeoutMs: 10000 },
      host.limits || {}
    );

    var container = document.createElement('div');
    container.className = 'mt-root';
    container.innerHTML = html;
    rootEl.appendChild(container);

    function $(sel) { return container.querySelector(sel); }
    var zone = $('.mt-drop');
    var input = $('.mt-file-input');
    var errEl = $('.mt-error');
    var bigEl = $('.mt-big');
    var infoEl = $('.mt-info');
    var prepareBtn = $('.mt-prepare');
    var cancelBtn = $('.mt-cancel');
    var progressEl = $('.mt-progress');
    var progressFill = $('.mt-progress-fill');
    var progressText = $('.mt-progress-text');
    var okEl = $('.mt-decode-ok');
    var ASR = MT.asr || null; // optional (media-asr.js)
    var CUES = MT.cues || null; // optional (media-cues.js)
    var asrCuesEl = $('.mt-asr-cues');
    var asrCard = $('.mt-asr');
    var asrLang = $('.mt-asr-lang');
    var asrModelEl = $('.mt-asr-model');
    var asrWarnEl = $('.mt-asr-warn');
    var asrBtn = $('.mt-transcribe');
    var asrCancelBtn = $('.mt-asr-cancel');
    var asrHubBtn = $('.mt-asr-hub');
    var asrProgress = $('.mt-asr-progress');
    var asrFill = $('.mt-asr-fill');
    var asrProgressText = $('.mt-asr-progress-text');
    var asrDetectedEl = $('.mt-asr-detected');
    var asrOkEl = $('.mt-asr-ok');
    var asrErrEl = $('.mt-asr-error');
    var asrTextEl = $('.mt-asr-text');
    var trCard = $('.mt-tr');
    var trSrc = $('.mt-tr-src');
    var trTgt = $('.mt-tr-tgt');
    var trEngineEl = $('.mt-tr-engine');
    var trLicenceEl = $('.mt-tr-licence');
    var trSwitchEl = $('.mt-tr-switch');
    var trWaitEl = $('.mt-tr-wait');
    var trUsedEl = $('.mt-tr-used');
    var trWarnEl = $('.mt-tr-warn');
    var trBtn = $('.mt-translate');
    var trCancelBtn = $('.mt-tr-cancel');
    var trHubBtn = $('.mt-tr-hub');
    var trProgress = $('.mt-tr-progress');
    var trFill = $('.mt-tr-fill');
    var trProgressText = $('.mt-tr-progress-text');
    var trOkEl = $('.mt-tr-ok');
    var trErrEl = $('.mt-tr-error');
    var trTextEl = $('.mt-tr-text');
    var ffCard = $('.mt-ff');
    var ffStatusEl = $('.mt-ff-status');
    var ffErrEl = $('.mt-ff-error');
    var ffBtn = $('.mt-ff-choose');
    var ff = { known: false, ok: false, path: '', errorKey: null }; // ffmpeg, when the host is the Windows app
    var pvCard = $('.mt-pv');
    var pv = MT.preview && MT.exporter && pvCard ? MT.preview.create({ card: pvCard, host: host }) : null;
    var pvVersion = 0; // raised whenever the cues are replaced or refilled (the preview rebuilds then)
    var pvStrings = 0; // raised when the language changes
    var decErrEl = $('.mt-decode-error');
    input.accept = F.ACCEPT;

    var unmounted = false;
    var token = 0; // newest file choice wins
    // info/pending = { file, name, bytes, seconds, ext, kind }
    var state = { info: null, pending: null, errorKey: null };
    // Audio preparation (decode) state. status: idle | running | ready | cancelled | error
    var dec = { status: 'idle', stage: null, fraction: 0, errorKey: null, result: null, ctrl: null, run: 0 };
    // Transcription state. status: idle | preparing | loading | running | ready | cancelled | error
    var asr = {
      status: 'idle', fraction: 0, window: 0, windows: 0, loadFraction: null, errorKey: null,
      segments: [], cues: [], lang: null, device: null, modelName: null, windowsDone: 0,
      ctrl: null, run: 0, ctl: null
    };
    // Translation state. status: idle | running | ready | cancelled | error
    var tr = {
      status: 'idle', stage: null, fraction: 0, loadFraction: null, done: 0, total: 0,
      errorKey: null, info: null, ctrl: null, run: 0, srcTouched: false, srcUsed: null, tgtUsed: null
    };
    function desktopAvailable() {
      return !!host.desktop && typeof host.desktop.extractAudio === 'function' && typeof host.desktop.ffmpeg === 'function';
    }
    // With ffmpeg the sound is read in pieces, so memory is no problem: only very long files get a warning.
    function limNow() {
      if (!ff.ok) return lim;
      return Object.assign({}, lim, { maxBytes: Infinity, maxSeconds: Math.max(lim.maxSeconds, 3 * 3600) });
    }
    function refreshFfmpeg() {
      if (!desktopAvailable()) { ff.known = false; ff.ok = false; return Promise.resolve(); }
      return Promise.resolve().then(function () { return host.desktop.ffmpeg(); }).then(
        function (s) { ff.ok = !!(s && s.ok); ff.path = (s && s.path) || ''; ff.known = true; },
        function () { ff.ok = false; ff.path = ''; ff.known = true; }
      );
    }
    function decodeErrorKey(err) {
      var k = MT.decode.errorKey(err && err.code);
      // In the Windows app without ffmpeg the useful advice is "choose ffmpeg", not "open the Windows app".
      if (desktopAvailable() && !ff.ok && (k === 'mediaErrDecodeUnsupported' || k === 'mediaErrDecodeMemory')) return 'mediaErrNeedFfmpeg';
      return k;
    }
    function asrAvailable() { return !!ASR && typeof host.getWhisperChoice === 'function'; }
    function asrBusy() { return asr.status === 'preparing' || asr.status === 'loading' || asr.status === 'running'; }
    // Keeps the recognised segments and builds the subtitle cues from them (silent parts are skipped).
    function applySegments(segs) {
      asr.segments = segs;
      asr.cues = CUES && segs.length
        ? CUES.buildCues(segs, { samples: dec.result ? dec.result.samples : null })
        : [];
      pvVersion += 1;
      resetTr(); // new cues: an older translation no longer fits them
    }
    function fmt(text, map) {
      return text.replace(/\{(\w+)\}/g, function (m, k) { return map[k] !== undefined ? map[k] : m; });
    }
    function langName(code) {
      var list = typeof host.getLanguages === 'function' ? host.getLanguages() : [];
      for (var i = 0; i < list.length; i++) if (list[i].code === code) return list[i].name + ' (' + code + ')';
      return code;
    }

    function render() {
      if (unmounted) return;
      errEl.hidden = !state.errorKey;
      errEl.textContent = state.errorKey ? host.t(state.errorKey) : '';

      bigEl.hidden = !state.pending;
      $('.mt-big-name').textContent = state.pending ? state.pending.name : '';

      var i = state.info;
      infoEl.hidden = !i;
      if (i) {
        $('.mt-info-name').textContent = i.name;
        $('.mt-info-size').textContent = F.formatSize(i.bytes);
        $('.mt-info-duration').textContent = isFinite(i.seconds)
          ? F.formatDuration(i.seconds)
          : host.t('mediaInfoDurationUnknown');
        $('.mt-info-type').textContent =
          host.t(i.kind === 'video' ? 'mediaTypeVideo' : 'mediaTypeAudio') + ' · ' + i.ext.toUpperCase();
      }

      var running = dec.status === 'running';
      prepareBtn.hidden = running || dec.status === 'ready';
      cancelBtn.hidden = !running;
      progressEl.hidden = !running;
      if (running) {
        // read = 0-40 %, decode = 40 % (no real progress available), mix = 40-100 %
        var overall = dec.stage === 'extract' ? dec.fraction : dec.stage === 'read' ? dec.fraction * 0.4 : dec.stage === 'decode' ? 0.4 : 0.4 + dec.fraction * 0.6;
        progressFill.style.width = Math.round(overall * 100) + '%';
        progressText.textContent =
          host.t(STAGE_KEYS[dec.stage] || STAGE_KEYS.read) +
          (dec.stage === 'decode' ? '' : ' ' + Math.round(dec.fraction * 100) + '%');
      }
      okEl.hidden = !(dec.status === 'ready' || dec.status === 'cancelled');
      if (dec.status === 'ready') {
        okEl.textContent = host.t('mediaDecodeReady').replace('{duration}', F.formatDuration(dec.result.duration));
      } else if (dec.status === 'cancelled') {
        okEl.textContent = host.t('mediaDecodeCancelled');
      } else {
        okEl.textContent = '';
      }
      decErrEl.hidden = dec.status !== 'error';
      decErrEl.textContent = dec.status === 'error' ? host.t(dec.errorKey) : '';
      renderFf();
      renderAsr();
      renderTr();
      renderPv();
    }

    function renderFf() {
      ffCard.hidden = !ff.known;
      if (!ff.known) return;
      ffStatusEl.textContent = ff.ok ? fmt(host.t('mediaFfmpegOk'), { path: ff.path }) : host.t('mediaFfmpegMissing');
      ffBtn.hidden = typeof host.desktop.chooseFfmpeg !== 'function';
      ffErrEl.hidden = !ff.errorKey;
      ffErrEl.textContent = ff.errorKey ? host.t(ff.errorKey) : '';
    }

    // Preview and export card: the player, live subtitles, the editable list and the export buttons.
    // The real engine (and model) that translated, for the note in an exported VTT file.
    function engineSummary() {
      var inf = tr.info;
      if (!inf || !tr.tgtUsed) return '';
      var used = Array.isArray(inf.used) ? inf.used.filter(function (u) { return u && u.name; }) : [];
      if (used.length > 1) return used.map(function (u) { return u.name; }).join(', ');
      var name = used.length === 1 ? used[0].name : inf.name;
      if (!name) return '';
      return name + (inf.model ? ' \u00b7 ' + inf.model : '');
    }

    function renderPv() {
      if (!pv) return;
      var i = state.info;
      var show = !!i && asr.cues.length > 0 && !asrBusy();
      pvCard.hidden = !show;
      pv.update({
        visible: show,
        file: show ? i.file : null,
        kind: show ? i.kind : null,
        name: show ? i.name : '',
        cues: asr.cues,
        version: pvVersion,
        strings: pvStrings,
        srcLang: tr.srcUsed || asr.lang,
        tgtLang: tr.tgtUsed,
        engine: engineSummary()
      });
    }

    function mmss(sec) {
      var m = Math.floor(sec / 60);
      var r = Math.floor(sec % 60);
      return m + ':' + (r < 10 ? '0' : '') + r;
    }

    function renderAsr() {
      var show = asrAvailable() && !!state.info;
      asrCard.hidden = !show;
      if (!show) return;
      var ch = host.getWhisperChoice();
      var busy = asrBusy();
      asrModelEl.textContent = ch ? fmt(host.t('mediaAsrModel'), { name: ch.name }) : host.t('mediaAsrNoModel');
      var heavy = !!ch && ch.memMB >= 3000;
      asrWarnEl.hidden = !heavy;
      asrWarnEl.textContent = heavy ? fmt(host.t('mediaAsrHeavy'), { gb: (ch.memMB / 1000).toFixed(1) }) : '';
      asrLang.disabled = busy;
      asrBtn.hidden = busy;
      asrBtn.disabled = !ch;
      asrCancelBtn.hidden = !busy;
      var notReady = !!ch && ch.ready === false;
      var errKey = asr.status === 'error' ? asr.errorKey : notReady && !busy ? 'mediaErrAsrNotDownloaded' : null;
      asrErrEl.hidden = !errKey;
      asrErrEl.textContent = errKey ? fmt(host.t(errKey), { name: ch ? ch.name : '', model: ch && ch.model ? ch.model : '' }) : '';
      asrHubBtn.hidden = !(errKey && typeof host.openModelHub === 'function');

      asrProgress.hidden = !(asr.status === 'loading' || asr.status === 'running');
      if (asr.status === 'loading') {
        asrFill.style.width = Math.round((asr.loadFraction || 0) * 100) + '%';
        asrProgressText.textContent = host.t('mediaAsrLoading') + (asr.loadFraction != null ? ' ' + Math.round(asr.loadFraction * 100) + '%' : '');
      } else if (asr.status === 'running') {
        asrFill.style.width = Math.round(asr.fraction * 100) + '%';
        asrProgressText.textContent = fmt(host.t('mediaAsrRunning'), {
          i: Math.min(asr.window + 1, asr.windows), n: asr.windows, pct: Math.round(asr.fraction * 100)
        });
      } else if (asr.status === 'preparing') {
        asrProgress.hidden = true;
      }

      asrDetectedEl.hidden = !(asr.lang && (asr.status === 'ready' || asr.status === 'cancelled') && !asrLang.value);
      asrDetectedEl.textContent = asrDetectedEl.hidden ? '' : fmt(host.t('mediaAsrDetected'), { lang: langName(asr.lang) });

      var done = asr.status === 'ready' || asr.status === 'cancelled';
      asrOkEl.hidden = !(done || (asr.status === 'error' && asr.segments.length > 0));
      if (!asrOkEl.hidden) {
        var okKey = asr.status === 'ready' ? 'mediaAsrDone' : asr.segments.length > 0 ? 'mediaAsrPartial' : 'mediaAsrCancelled';
        asrOkEl.textContent = fmt(host.t(okKey), {
          count: asr.segments.length, done: asr.windowsDone, n: asr.windows,
          name: asr.modelName || '', device: asr.device || ''
        });
        if (asr.gpuNote) asrOkEl.textContent += ' ' + fmt(host.t('mediaAsrGpuNote'), { reason: asr.gpuNote });
      } else {
        asrOkEl.textContent = '';
      }
      asrCuesEl.hidden = !(CUES && asr.segments.length > 0 && (done || asr.status === 'error'));
      asrCuesEl.textContent = asrCuesEl.hidden ? '' : fmt(host.t('mediaCuesCount'), { count: asr.cues.length });
      asrTextEl.hidden = asr.segments.length === 0;
      asrTextEl.textContent = asr.segments.slice(0, 40).map(function (g) { return '[' + mmss(g.s) + '] ' + g.text; }).join('\n');
    }

    function fillLangs() {
      var keep = asrLang.value;
      asrLang.textContent = '';
      var auto = document.createElement('option');
      auto.value = '';
      auto.textContent = host.t('mediaAsrAuto');
      asrLang.appendChild(auto);
      var list = typeof host.getLanguages === 'function' ? host.getLanguages() : [];
      for (var i = 0; i < list.length; i++) {
        var o = document.createElement('option');
        o.value = list[i].code;
        o.textContent = list[i].name;
        asrLang.appendChild(o);
      }
      asrLang.value = keep;
      fillTrLangs();
    }

    // ---------- transcription ----------
    function resetAsr() {
      resetTr();
      asr.run += 1;
      if (asr.ctrl) { asr.ctrl.abort(); asr.ctrl = null; }
      asr.status = 'idle';
      asr.fraction = 0;
      asr.window = 0;
      asr.windows = 0;
      asr.loadFraction = null;
      asr.errorKey = null;
      asr.segments = [];
      asr.cues = [];
      pvVersion += 1;
      asr.lang = null;
      asr.device = null;
      asr.gpuNote = '';
      asr.modelName = null;
      asr.windowsDone = 0;
    }

    function startTranscribe() {
      if (!asrAvailable() || !state.info || asrBusy() || dec.status === 'running') return;
      var ch = host.getWhisperChoice();
      resetAsr();
      if (!ch) { asr.status = 'error'; asr.errorKey = 'mediaAsrNoModel'; render(); return; }
      if (ch.ready === false) { render(); return; } // the card shows the "not downloaded" message
      asr.modelName = ch.name;
      asr.status = 'preparing';
      render();
      if (dec.status === 'ready') runAsr(ch);
      else startPrepare(function () { runAsr(ch); });
    }

    function runAsr(ch) {
      if (unmounted || asr.status !== 'preparing') return;
      var mine = asr.run;
      var ctrl = new AbortController();
      asr.ctrl = ctrl;
      asr.status = 'loading';
      asr.loadFraction = null;
      render();
      if (!asr.ctl) {
        var eng = host.engine || {};
        asr.ctl = ASR.create({ libUrl: eng.libUrl, workerFactory: eng.workerFactory });
      }
      var spec = { repo: ch.repo, gpu: ch.gpu || null, gpuRepo: ch.gpuRepo || null };
      var samples = dec.result.samples;
      asr.ctl.run({
        samples: samples,
        spec: spec,
        language: asrLang.value || null,
        signal: ctrl.signal,
        windowSec: lim.asrWindowSec,
        onModelReady: function () {
          if (typeof host.onModelUsed === 'function') {
            try { host.onModelUsed(ch.repo); } catch (e) { /* the host's problem, not ours */ }
          }
        },
        onProgress: function (p) {
          if (unmounted || mine !== asr.run) return;
          if (p.stage === 'load') {
            asr.status = 'loading';
            asr.loadFraction = typeof p.fraction === 'number' ? p.fraction : asr.loadFraction;
          } else {
            asr.status = 'running';
            asr.fraction = p.fraction;
            asr.window = p.window;
            asr.windows = p.windows;
          }
          render();
        }
      }).then(
        function (res) {
          if (unmounted || mine !== asr.run) return;
          asr.ctrl = null;
          applySegments(res.segments);
          asr.lang = res.lang;
          asr.device = res.device;
          asr.gpuNote = res.gpuNote || '';
          asr.windows = res.windows;
          asr.windowsDone = res.windowsDone;
          asr.status = 'ready';
          render();
        },
        function (err) {
          if (unmounted || mine !== asr.run) return;
          asr.ctrl = null;
          var part = err && err.partial;
          if (part) {
            applySegments(part.segments);
            asr.lang = part.lang;
            asr.device = part.device;
            asr.gpuNote = part.gpuNote || '';
            asr.windows = part.windows;
            asr.windowsDone = part.windowsDone;
          }
          if (err && err.code === 'aborted') {
            asr.status = 'cancelled';
          } else {
            asr.status = 'error';
            asr.errorKey = ASR.errorKey(err && err.code);
          }
          render();
        }
      );
    }

    function cancelAsr() {
      if (!asrBusy()) return;
      if (asr.status === 'preparing') {
        asr.status = 'cancelled'; // stops the decode too (its own cancel path leaves asr alone now)
        cancelPrepare();
        return;
      }
      if (asr.ctrl) asr.ctrl.abort(); // the run ends with the partial result and status 'cancelled'
    }

    // ---------- translation ----------
    var TR_ERR = {
      nokey: 'mediaErrTrNoKey', badkey: 'mediaErrTrBadKey', notdownloaded: 'mediaErrTrNotDownloaded',
      memory: 'mediaErrTrMemory', engine: 'mediaErrTrEngine', unsupported: 'mediaErrTrUnsupported', notrunning: 'mediaErrTrOllamaDown', nomodel: 'mediaErrTrNoModel',
      network: 'mediaErrTrNetwork', rate: 'mediaErrTrRate', badreply: 'mediaErrTrBadReply', failed: 'mediaErrTrFailed'
    };
    // Errors that the person fixes in the host's model page.
    var TR_HUB_KEYS = ['mediaErrTrNoKey', 'mediaErrTrBadKey', 'mediaErrTrNotDownloaded', 'mediaErrTrUnsupported', 'mediaErrTrOllamaDown', 'mediaErrTrNoModel'];

    function trAvailable() { return typeof host.translateCues === 'function' && !!CUES; }
    function trBusy() { return tr.status === 'running'; }
    function trChoice() { return typeof host.getTranslateChoice === 'function' ? host.getTranslateChoice() : null; }
    function trCounts() {
      var total = 0;
      var done = 0;
      for (var i = 0; i < asr.cues.length; i++) {
        if (String(asr.cues[i].o || '').trim()) { total += 1; if (asr.cues[i].t) done += 1; }
      }
      return { total: total, done: done };
    }
    var WHY = ['rate', 'blocked', 'server', 'timeout', 'network', 'html', 'count', 'empty', 'failed', 'nokey', 'badkey', 'unsupported', 'notdownloaded', 'http', 'notrunning', 'nomodel'];
    function whyText(reason) {
      var r = WHY.indexOf(reason) >= 0 ? reason : 'failed';
      return host.t('mediaTrWhy' + r.charAt(0).toUpperCase() + r.slice(1));
    }
    function engineLabel(c) {
      return c.name + (c.model ? ' · ' + c.model : '');
    }
    function engineText(c) {
      return fmt(host.t('mediaTrEngine'), { name: engineLabel(c), kind: host.t(c.kind === 'online' ? 'mediaTrOnline' : 'mediaTrOffline') });
    }

    function resetTr() {
      tr.run += 1;
      if (tr.ctrl) { tr.ctrl.abort(); tr.ctrl = null; }
      tr.status = 'idle';
      tr.stage = null;
      tr.fraction = 0;
      tr.loadFraction = null;
      tr.done = 0;
      tr.total = 0;
      tr.errorKey = null;
      tr.info = null;
      tr.srcTouched = false;
      tr.srcUsed = null;
      tr.tgtUsed = null;
    }

    function ensureOption(sel, code) {
      for (var i = 0; i < sel.options.length; i++) if (sel.options[i].value === code) return;
      var o = document.createElement('option');
      o.value = code;
      o.textContent = code;
      sel.appendChild(o);
    }

    function fillTrLangs() {
      var list = typeof host.getLanguages === 'function' ? host.getLanguages() : [];
      [trSrc, trTgt].forEach(function (sel) {
        var keep = sel.value;
        sel.textContent = '';
        var first = document.createElement('option');
        first.value = '';
        first.textContent = host.t('mediaTrChoose');
        sel.appendChild(first);
        for (var i = 0; i < list.length; i++) {
          var o = document.createElement('option');
          o.value = list[i].code;
          o.textContent = list[i].name;
          sel.appendChild(o);
        }
        if (keep) ensureOption(sel, keep);
        sel.value = keep;
      });
    }

    function renderTr() {
      var show = trAvailable() && !!state.info && asr.cues.length > 0 && !asrBusy();
      trCard.hidden = !show;
      if (!show) return;
      if (!tr.srcTouched && asr.lang) { ensureOption(trSrc, asr.lang); trSrc.value = asr.lang; }
      var ch = trChoice();
      var busy = trBusy();
      var shown = busy && tr.info ? tr.info : ch;
      trEngineEl.hidden = !shown;
      trEngineEl.textContent = shown ? engineText(shown) : '';
      // Host with several engines (a fallback chain): which engine switched in and why, and who translated what.
      var ti = tr.info && tr.status !== 'idle' ? tr.info : null;
      var chainDone = !!(ti && ti.used && ti.used.length > 0 && !busy);
      if (chainDone) { shown = ti; trEngineEl.hidden = false; trEngineEl.textContent = engineText(ti); }
      var sw = ti && ti.switched ? ti.switched : null;
      trSwitchEl.hidden = !sw;
      trSwitchEl.textContent = sw ? fmt(host.t('mediaTrSwitched'), { name: ti.name, from: sw.from, why: whyText(sw.reason) }) : '';
      var waitMs = busy && ti && ti.waitingMs > 0 ? ti.waitingMs : 0;
      trWaitEl.hidden = !waitMs;
      trWaitEl.textContent = waitMs ? fmt(host.t('mediaTrWaiting'), { sec: Math.ceil(waitMs / 1000) }) : '';
      var usedList = ti && ti.used && ti.used.length > 0 ? ti.used : null;
      trUsedEl.hidden = !usedList;
      trUsedEl.textContent = usedList
        ? fmt(host.t('mediaTrUsed'), { list: usedList.map(function (u) { return u.name + ' (' + u.count + ')'; }).join(', ') })
        : '';
      var licence = shown && shown.licence ? fmt(host.t('mediaTrLicence'), { licence: shown.licence }) + (shown.licenceNote ? ' ' + shown.licenceNote : '') : '';
      trLicenceEl.hidden = !licence;
      trLicenceEl.textContent = licence;
      var same = !!trSrc.value && trSrc.value === trTgt.value;
      var warn = [];
      if (shown && shown.kind === 'online') {
        // Gemini keeps its own wording; a list of engines or any other online engine names who gets the text.
        if (shown.id === 'gemini') warn.push(host.t('mediaTrOnlineWarn'));
        else warn.push(fmt(host.t(shown.id === 'chain' ? 'mediaTrOnlineWarnChain' : 'mediaTrOnlineWarnNamed'), { name: shown.name }));
      }
      if (same) warn.push(host.t('mediaTrSameLang'));
      trWarnEl.hidden = warn.length === 0;
      trWarnEl.textContent = warn.join(' ');

      var needKey = !!ch && !!ch.needsKey;
      var notReady = !!ch && ch.ready === false;
      trSrc.disabled = busy;
      trTgt.disabled = busy;
      trBtn.hidden = busy;
      trBtn.disabled = !trSrc.value || !trTgt.value || same || needKey || notReady;
      trCancelBtn.hidden = !busy;

      var errKey = tr.status === 'error' ? tr.errorKey : needKey ? 'mediaErrTrNoKey' : notReady && !busy ? 'mediaErrTrNotDownloaded' : null;
      trErrEl.hidden = !errKey;
      trErrEl.textContent = errKey ? fmt(host.t(errKey), { name: ch ? ch.name : '' }) : '';
      trHubBtn.hidden = !(errKey && TR_HUB_KEYS.indexOf(errKey) >= 0 && typeof host.openModelHub === 'function');

      trProgress.hidden = !busy;
      if (busy) {
        if (tr.stage === 'load') {
          trFill.style.width = Math.round((tr.loadFraction || 0) * 100) + '%';
          trProgressText.textContent = host.t('mediaTrLoading') + (tr.loadFraction != null ? ' ' + Math.round(tr.loadFraction * 100) + '%' : '');
        } else {
          trFill.style.width = Math.round(tr.fraction * 100) + '%';
          trProgressText.textContent = fmt(host.t('mediaTrRunning'), { done: tr.done, total: tr.total, pct: Math.round(tr.fraction * 100) });
        }
      }

      var c = trCounts();
      var finished = tr.status === 'ready' || tr.status === 'cancelled' || tr.status === 'error';
      trOkEl.hidden = !(finished && (tr.status !== 'error' || c.done > 0) && tr.info);
      if (!trOkEl.hidden) {
        var okKey = tr.status === 'ready' ? 'mediaTrDone' : c.done > 0 ? 'mediaTrPartial' : 'mediaTrCancelled';
        trOkEl.textContent = fmt(host.t(okKey), { count: c.done, total: c.total, engine: engineLabel(tr.info) });
      } else if (finished && tr.status === 'cancelled') {
        trOkEl.hidden = false;
        trOkEl.textContent = host.t('mediaTrCancelled');
      } else {
        trOkEl.textContent = '';
      }
      var lines = [];
      for (var i = 0; i < asr.cues.length && lines.length < 20; i++) {
        if (asr.cues[i].t) lines.push('[' + mmss(asr.cues[i].s) + '] ' + asr.cues[i].t);
      }
      trTextEl.hidden = lines.length === 0;
      trTextEl.textContent = lines.join('\n');
    }

    function applyTranslated(list) {
      if (!Array.isArray(list)) return;
      for (var i = 0; i < asr.cues.length && i < list.length; i++) {
        asr.cues[i].t = typeof list[i].t === 'string' ? list[i].t : '';
      }
      pvVersion += 1;
    }

    function startTranslate() {
      if (!trAvailable() || trBusy() || asr.cues.length === 0) return;
      var src = trSrc.value;
      var tgt = trTgt.value;
      if (!src || !tgt || src === tgt) return;
      var ch = trChoice();
      if (ch && (ch.needsKey || ch.ready === false)) { render(); return; } // the card shows why
      var touched = tr.srcTouched;
      resetTr();
      tr.srcTouched = touched;
      tr.srcUsed = src;
      tr.tgtUsed = tgt;
      var mine = tr.run;
      var ctrl = new AbortController();
      tr.ctrl = ctrl;
      tr.status = 'running';
      tr.stage = 'load';
      asr.cues.forEach(function (c) { c.t = ''; });
      pvVersion += 1;
      var input = asr.cues.map(function (c) { return { s: c.s, e: c.e, o: c.o, t: '' }; });
      render();
      var promise;
      try {
        promise = host.translateCues(input, {
          src: src,
          tgt: tgt,
          signal: ctrl.signal,
          onInfo: function (i) {
            if (unmounted || mine !== tr.run) return;
            tr.info = i;
            render();
          },
          onProgress: function (p) {
            if (unmounted || mine !== tr.run || !p) return;
            if (p.stage === 'load') {
              tr.stage = 'load';
              tr.loadFraction = typeof p.fraction === 'number' ? p.fraction : tr.loadFraction;
            } else {
              tr.stage = 'translate';
              tr.fraction = typeof p.fraction === 'number' ? p.fraction : tr.fraction;
              tr.done = p.done || 0;
              tr.total = p.total || 0;
            }
            render();
          }
        });
      } catch (e) {
        promise = Promise.reject(e);
      }
      Promise.resolve(promise).then(
        function (res) {
          if (unmounted || mine !== tr.run) return;
          tr.ctrl = null;
          applyTranslated(res);
          if (!tr.info) tr.info = { name: ch ? ch.name : '', kind: ch ? ch.kind : 'offline', model: ch ? ch.model : '' };
          tr.status = 'ready';
          render();
        },
        function (err) {
          if (unmounted || mine !== tr.run) return;
          tr.ctrl = null;
          applyTranslated(err && err.partial); // what was finished before the stop is kept
          if (!tr.info) tr.info = { name: ch ? ch.name : '', kind: ch ? ch.kind : 'offline', model: ch ? ch.model : '' };
          if (err && err.code === 'aborted') {
            tr.status = 'cancelled';
          } else {
            tr.status = 'error';
            tr.errorKey = TR_ERR[err && err.code] || 'mediaErrTrFailed';
          }
          render();
        }
      );
    }

    function cancelTranslate() {
      if (tr.ctrl) tr.ctrl.abort(); // the run ends with status 'cancelled' and what was finished so far
    }

    // ---------- audio preparation ----------
    // Stops anything running, frees the decoded samples, back to idle.
    function resetDecode() {
      dec.run += 1; // late results from an older run are ignored (and freed)
      if (dec.ctrl) { dec.ctrl.abort(); dec.ctrl = null; }
      if (dec.result) MT.decode.releaseResult(dec.result);
      dec.result = null;
      dec.status = 'idle';
      dec.stage = null;
      dec.fraction = 0;
      dec.errorKey = null;
    }

    function startPrepare(afterReady) {
      if (!state.info || dec.status === 'running' || dec.status === 'ready') return;
      resetDecode();
      var mine = dec.run;
      var ctrl = new AbortController();
      dec.ctrl = ctrl;
      dec.status = 'running';
      dec.stage = 'read';
      dec.fraction = 0;
      render();
      var useFf = ff.ok && desktopAvailable();
      function onProgress(p) {
        if (unmounted || mine !== dec.run) return;
        dec.stage = p.stage;
        dec.fraction = p.fraction;
        render();
      }
      Promise.resolve()
        .then(function () {
          if (useFf) {
            // Windows app: ffmpeg reads the file in pieces; no browser decoding, no memory spike.
            dec.stage = 'extract';
            return host.desktop.extractAudio(state.info.file, {
              signal: ctrl.signal,
              seconds: isFinite(state.info.seconds) ? state.info.seconds : 0,
              onProgress: onProgress
            });
          }
          // MT.decode.decodeFile is looked up now (not at mount time).
          return MT.decode.decodeFile(state.info.file, { signal: ctrl.signal, onProgress: onProgress });
        })
        .then(
          function (res) {
            if (unmounted || mine !== dec.run) { MT.decode.releaseResult(res); return; }
            dec.ctrl = null;
            dec.result = res;
            dec.status = 'ready';
            render();
            if (typeof afterReady === 'function') afterReady();
          },
          function (err) {
            if (unmounted || mine !== dec.run) return;
            dec.ctrl = null;
            if (err && (err.code === 'aborted' || err.name === 'AbortError')) {
              dec.status = 'cancelled';
            } else {
              dec.status = 'error';
              if (useFf && err && err.code === 'noffmpeg') ff.ok = false; // it went away: the card shows it
              dec.errorKey = useFf ? (FF_ERR[err && err.code] || 'mediaErrFfmpeg') : decodeErrorKey(err);
            }
            if (asr.status === 'preparing') asr.status = 'idle';
            render();
          }
        );
    }

    function cancelPrepare() {
      if (dec.status !== 'running') return;
      dec.run += 1; // ignore whatever the stopped run still reports
      dec.ctrl.abort();
      dec.ctrl = null;
      dec.status = 'cancelled';
      render();
    }

    // The chosen file changes (or goes away): the old prepared audio no longer belongs to it.
    function setInfo(info) {
      resetAsr();
      resetDecode();
      state.info = info;
    }

    function handleFiles(list) {
      state.errorKey = null;
      var files = list ? Array.prototype.slice.call(list) : [];
      if (files.length === 0) { render(); return; }
      if (files.length > 1) { state.errorKey = 'mediaErrMultiple'; render(); return; }
      var file = files[0];
      var c = F.classifyFile(file);
      if (!c.ok) { state.errorKey = c.reason; render(); return; }

      var mine = ++token;
      state.pending = null; // a new choice replaces any open "big file" question
      render();
      readDuration(file, c.kind, lim.metadataTimeoutMs).then(function (seconds) {
        if (unmounted || mine !== token) return;
        var info = { file: file, name: file.name, bytes: file.size, seconds: seconds, ext: c.ext, kind: c.kind };
        if (F.needsBigWarning(info, limNow())) {
          state.pending = info;
        } else {
          setInfo(info);
          state.pending = null;
        }
        render();
      });
    }

    // Listeners: all registered through on() so unmount can remove every one.
    var offs = [];
    function on(el, type, fn) {
      el.addEventListener(type, fn);
      offs.push(function () { el.removeEventListener(type, fn); });
    }

    on(zone, 'click', function () { input.click(); });
    on(zone, 'keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
    });
    on(input, 'change', function () {
      handleFiles(input.files);
      input.value = ''; // lets the user pick the same file again
    });
    function dragOver(e) {
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'copy'; } catch (err) { /* some browsers forbid it */ }
      zone.classList.add('mt-drag-over');
    }
    on(zone, 'dragenter', dragOver);
    on(zone, 'dragover', dragOver);
    on(zone, 'dragleave', function (e) {
      if (!e.relatedTarget || !zone.contains(e.relatedTarget)) zone.classList.remove('mt-drag-over');
    });
    on(zone, 'drop', function (e) {
      e.preventDefault();
      zone.classList.remove('mt-drag-over');
      handleFiles(e.dataTransfer ? e.dataTransfer.files : null);
    });
    on($('.mt-big-continue'), 'click', function () {
      setInfo(state.pending); // Continue: accept the big file
      state.pending = null;
      render();
    });
    on($('.mt-big-cancel'), 'click', function () {
      state.pending = null; // Cancel: drop the new file, keep whatever was loaded before
      render();
    });
    on($('.mt-remove'), 'click', function () {
      setInfo(null);
      render();
    });
    on(prepareBtn, 'click', function () { startPrepare(); });
    on(cancelBtn, 'click', cancelPrepare);
    on(asrBtn, 'click', startTranscribe);
    on(asrCancelBtn, 'click', cancelAsr);
    on(asrHubBtn, 'click', function () { if (typeof host.openModelHub === 'function') host.openModelHub(); });
    on(trBtn, 'click', startTranslate);
    on(trCancelBtn, 'click', cancelTranslate);
    on(trHubBtn, 'click', function () { if (typeof host.openModelHub === 'function') host.openModelHub(); });
    on(trSrc, 'change', function () { tr.srcTouched = true; renderTr(); });
    on(trTgt, 'change', renderTr);

    on(ffBtn, 'click', function () {
      if (!desktopAvailable() || typeof host.desktop.chooseFfmpeg !== 'function') return;
      ff.errorKey = null;
      Promise.resolve().then(function () { return host.desktop.chooseFfmpeg(); }).then(
        function (r) {
          if (unmounted) return;
          if (r && r.ok) { ff.ok = true; ff.path = r.path || ''; }
          else if (r && r.code && r.code !== 'canceled') ff.errorKey = 'mediaFfmpegBad';
          render();
        },
        function () { if (unmounted) return; ff.errorKey = 'mediaFfmpegBad'; render(); }
      );
    });

    applyStrings(container, host);
    fillLangs();
    render();
    refreshFfmpeg().then(function () { if (!unmounted) render(); });

    return {
      el: container,
      getFile: function () { return state.info ? state.info.file : null; },
      getAudio: function () { return dec.status === 'ready' ? dec.result : null; },
      // Subtitle cues [{ s, e, o, t }] built from the transcript (null when nothing was recognised
      // or media-cues.js is not loaded). Copies, so callers cannot change our state.
      getCues: function () {
        if (!CUES || asr.segments.length === 0) return null;
        return asr.cues.map(function (c) { return { s: c.s, e: c.e, o: c.o, t: c.t }; });
      },
      // Raw recognised text with times (item 5 turns it into cues). Copies, so callers cannot change our state.
      getTranscript: function () {
        if (asr.segments.length === 0) return null;
        return {
          segments: asr.segments.map(function (g) { return { s: g.s, e: g.e, text: g.text }; }),
          lang: asr.lang,
          model: asr.modelName,
          device: asr.device,
          partial: asr.status !== 'ready'
        };
      },
      getState: function () {
        var i = state.info;
        return {
          name: i ? i.name : null,
          bytes: i ? i.bytes : null,
          seconds: i && isFinite(i.seconds) ? i.seconds : null,
          kind: i ? i.kind : null,
          ext: i ? i.ext : null,
          pendingName: state.pending ? state.pending.name : null,
          errorKey: state.errorKey,
          decodeStatus: dec.status,
          decodeErrorKey: dec.errorKey,
          cueCount: asr.cues.length,
          asrStatus: asr.status,
          asrErrorKey: asr.errorKey,
          trStatus: tr.status,
          trErrorKey: tr.errorKey,
          translatedCount: trCounts().done,
          pvVisible: !!pv && !pvCard.hidden,
          ffmpegKnown: ff.known,
          ffmpegOk: ff.ok
        };
      },
      clear: function () {
        token += 1;
        setInfo(null);
        state.pending = null;
        state.errorKey = null;
        render();
      },
      refresh: function () {
        if (unmounted) return;
        applyStrings(container, host);
        fillLangs();
        pvStrings += 1;
        render();
      },
      unmount: function () {
        if (unmounted) return;
        resetAsr(); // stops a running transcription
        if (asr.ctl) { asr.ctl.terminate(); asr.ctl = null; } // and ends the worker (frees the model)
        resetDecode(); // stops a running decode and frees the samples
        if (pv) pv.destroy(); // revokes the player's file address
        unmounted = true;
        offs.forEach(function (off) { off(); });
        container.remove();
        releaseCss();
      }
    };
  };
})();
