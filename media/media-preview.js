/*
 * media-preview.js - the "Preview and export" card: player, live subtitles, cue list, export buttons.
 * Adds only MediaTranslate.preview. Needs media-export.js (MediaTranslate.exporter) loaded first.
 *
 *   MediaTranslate.preview.create({ card, host }) -> { update(model), destroy() }
 *
 *   model = { visible, file, kind:'video'|'audio', name, cues, version, srcLang, tgtLang }
 *     cues     the module's own cue objects { s, e, o, t }. Editing a line changes them in place.
 *     version  a number the module raises whenever it replaces or refills the cues. The list and the
 *              subtitle track are rebuilt only when it changes, so progress updates cost nothing.
 *     strings  a number the module raises when the language changes (the list texts are repainted)
 *     visible  false: the player is torn down (its object URL revoked, the source removed).
 *
 * What it does:
 *  - plays the file in a <video> or <audio> element from an object URL (revoked on teardown, on a new
 *    file, and on destroy);
 *  - keeps ONE live subtitle track (addTextTrack + VTTCue, so there is no extra URL to revoke) with the
 *    original or the translation, chosen in "Show"; the track follows every edit at once;
 *  - the list: the time button (or a click on the text) jumps the player to that cue; Edit turns the
 *    line into a text box (Ctrl+Enter or leaving the box saves, Escape cancels); the line playing now
 *    is marked while the player runs;
 *  - export buttons call host.saveFile(name, blob): original SRT, translated SRT, bilingual SRT,
 *    VTT and TXT (the last two use the version shown). Without host.saveFile the buttons are hidden.
 * Every listener, element and object URL it makes is removed by destroy().
 */
(function () {
  'use strict';
  var MT = (window.MediaTranslate = window.MediaTranslate || {});

  function fmt(text, map) {
    return String(text).replace(/\{(\w+)\}/g, function (m, k) { return map[k] !== undefined ? map[k] : m; });
  }
  function mmss(sec) {
    var s = Math.max(0, Math.floor(sec));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  function create(o) {
    var card = o.card;
    var host = o.host;
    var X = MT.exporter;
    if (!X) throw new Error('MediaTranslate.preview: media-export.js is not loaded');

    function $(sel) { return card.querySelector(sel); }
    var mediaSlot = $('.mt-pv-media');
    var showSel = $('.mt-pv-show');
    var noteEl = $('.mt-pv-note');
    var listEl = $('.mt-pv-list');
    var exportRow = $('.mt-pv-export');
    var nextRow = $('.mt-pv-nextrow');
    var nextBox = $('.mt-pv-nextto');
    var capEl = $('.mt-pv-caption');
    var styleBox = $('.mt-pv-style');
    var fontSel = $('.mt-pv-font');
    var sizeIn = $('.mt-pv-size');
    var sizeOut = $('.mt-pv-size-out');
    var swatchBox = $('.mt-pv-swatches');
    var pickIn = $('.mt-pv-color-pick');
    var bgSel = $('.mt-pv-bg');
    var resetBtn = $('.mt-pv-style-reset');
    var inFilesBox = $('.mt-pv-infiles');
    var btn = {
      orig: $('.mt-pv-exp-orig'), tr: $('.mt-pv-exp-tr'), bi: $('.mt-pv-exp-bi'), vtt: $('.mt-pv-exp-vtt'), ass: $('.mt-pv-exp-ass'), txt: $('.mt-pv-exp-txt')
    };

    var offs = [];
    function on(el, type, fn) {
      el.addEventListener(type, fn);
      offs.push(function () { el.removeEventListener(type, fn); });
    }

    var cues = [];
    var rows = [];
    var show = 'original';
    var hasTr = false;
    var lastVersion = null;
    var lastStrings = null;
    var lastFile = null;
    var lastKind = null;
    var media = null;
    var mediaUrl = null;
    var track = null;
    var trackOff = null;
    var meta = { name: '', srcLang: null, tgtLang: null, engine: '' };
    var editing = -1;
    var closeTimer = null;
    var active = -1;
    var destroyed = false;

    // ---------- subtitle style: font, size, colour, background ----------
    // Only fonts that ship with Windows are listed (nothing is downloaded); a font that is not installed falls
    // back to the next one in its stack. The style is for this preview (and the player's own live subtitles);
    // exported SRT / VTT / TXT files never carry it.
    var FONTS = [
      { id: 'segoe', group: 'en', label: 'Segoe UI', css: "'Segoe UI', Arial, sans-serif" },
      { id: 'arial', group: 'en', label: 'Arial', css: 'Arial, Helvetica, sans-serif' },
      { id: 'verdana', group: 'en', label: 'Verdana', css: 'Verdana, Geneva, sans-serif' },
      { id: 'trebuchet', group: 'en', label: 'Trebuchet MS', css: "'Trebuchet MS', Arial, sans-serif" },
      { id: 'georgia', group: 'en', label: 'Georgia', css: 'Georgia, serif' },
      { id: 'consolas', group: 'en', label: 'Consolas', css: "Consolas, 'Courier New', monospace" },
      { id: 'vazirmatn', group: 'fa', label: 'Vazirmatn', css: "Vazirmatn, Tahoma, 'Segoe UI', sans-serif" },
      { id: 'tahoma', group: 'fa', label: 'Tahoma', css: "Tahoma, 'Segoe UI', sans-serif" },
      { id: 'segoefa', group: 'fa', label: 'Segoe UI', css: "'Segoe UI', Tahoma, sans-serif" },
      { id: 'arialfa', group: 'fa', label: 'Arial', css: "Arial, Tahoma, sans-serif" },
      { id: 'nazanin', group: 'fa', label: 'B Nazanin', css: "'B Nazanin', 'Sakkal Majalla', 'Times New Roman', serif" },
      { id: 'majalla', group: 'fa', label: 'Sakkal Majalla', css: "'Sakkal Majalla', 'Traditional Arabic', 'Times New Roman', serif" },
      { id: 'times', group: 'fa', label: 'Times New Roman', css: "'Times New Roman', 'Traditional Arabic', serif" }
    ];
    var COLORS = [
      '#ffffff', '#e6e6e6', '#bfbfbf', '#808080', '#404040', '#000000',
      '#ffeb3b', '#ffc107', '#ff9800', '#ff5722', '#f44336', '#b71c1c',
      '#e91e63', '#ff80ab', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3',
      '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39'
    ];
    var BACKGROUNDS = [
      { id: 'dark', key: 'mediaPvBgDark', css: 'rgba(0, 0, 0, 0.6)' },
      { id: 'black', key: 'mediaPvBgBlack', css: '#000000' },
      { id: 'light', key: 'mediaPvBgLight', css: 'rgba(255, 255, 255, 0.85)' },
      { id: 'none', key: 'mediaPvBgNone', css: 'transparent' }
    ];
    var DEFAULT_STYLE = { font: 'segoe', size: 24, color: '#ffffff', bg: 'dark' };
    var style = Object.assign({}, DEFAULT_STYLE);

    function findBy(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
    function cleanStyle(s) {
      var out = Object.assign({}, DEFAULT_STYLE);
      if (s && typeof s === 'object') {
        if (findBy(FONTS, s.font)) out.font = s.font;
        var n = Number(s.size);
        if (n >= 14 && n <= 48) out.size = Math.round(n);
        if (typeof s.color === 'string' && /^#[0-9a-f]{6}$/i.test(s.color)) out.color = s.color.toLowerCase();
        if (findBy(BACKGROUNDS, s.bg)) out.bg = s.bg;
      }
      return out;
    }
    function loadStyle() {
      // The host may remember the style between visits (host.loadSubtitleStyle / host.saveSubtitleStyle).
      try { return cleanStyle(typeof host.loadSubtitleStyle === 'function' ? host.loadSubtitleStyle() : null); } catch (e) { return Object.assign({}, DEFAULT_STYLE); }
    }
    function saveStyle() {
      try { if (typeof host.saveSubtitleStyle === 'function') host.saveSubtitleStyle(Object.assign({}, style)); } catch (e) { /* kept for this visit */ }
    }
    function applyStyle() {
      card.style.setProperty('--mt-cap-font', findBy(FONTS, style.font).css);
      card.style.setProperty('--mt-cap-size', style.size + 'px');
      card.style.setProperty('--mt-cap-color', style.color);
      card.style.setProperty('--mt-cap-bg', findBy(BACKGROUNDS, style.bg).css);
      sizeIn.value = String(style.size);
      sizeOut.textContent = style.size + ' px';
      fontSel.value = style.font;
      bgSel.value = style.bg;
      pickIn.value = style.color;
      for (var i = 0; i < swatchBox.children.length; i++) {
        var b = swatchBox.children[i];
        b.setAttribute('aria-pressed', b.dataset.color === style.color ? 'true' : 'false');
      }
    }
    function changeStyle(part) {
      style = cleanStyle(Object.assign({}, style, part));
      applyStyle();
      saveStyle();
    }
    function buildStyleUi() {
      fontSel.textContent = '';
      [['en', 'mediaPvFontEn'], ['fa', 'mediaPvFontFa']].forEach(function (g) {
        var og = document.createElement('optgroup');
        og.dataset.group = g[0];
        FONTS.filter(function (f) { return f.group === g[0]; }).forEach(function (f) {
          var op = document.createElement('option');
          op.value = f.id;
          op.textContent = f.label;
          op.style.fontFamily = f.css;
          og.appendChild(op);
        });
        fontSel.appendChild(og);
      });
      bgSel.textContent = '';
      BACKGROUNDS.forEach(function (b) {
        var op = document.createElement('option');
        op.value = b.id;
        bgSel.appendChild(op);
      });
      swatchBox.textContent = '';
      COLORS.forEach(function (hex) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'mt-pv-swatch';
        b.dataset.color = hex;
        b.style.background = hex;
        b.addEventListener('click', function () { changeStyle({ color: hex }); paintCaption(); });
        swatchBox.appendChild(b);
      });
      style = loadStyle();
      paintStyleTexts();
      applyStyle();
    }
    // Texts that depend on the language.
    function paintStyleTexts() {
      var groups = fontSel.querySelectorAll('optgroup');
      if (groups[0]) groups[0].label = host.t('mediaPvFontEn');
      if (groups[1]) groups[1].label = host.t('mediaPvFontFa');
      for (var i = 0; i < bgSel.options.length; i++) bgSel.options[i].textContent = host.t(findBy(BACKGROUNDS, bgSel.options[i].value).key);
      for (var j = 0; j < swatchBox.children.length; j++) {
        swatchBox.children[j].setAttribute('aria-label', fmt(host.t('mediaPvSwatch'), { color: swatchBox.children[j].dataset.color }));
      }
      swatchBox.setAttribute('aria-label', host.t('mediaPvColor'));
      fontSel.setAttribute('aria-label', host.t('mediaPvFont'));
      sizeIn.setAttribute('aria-label', host.t('mediaPvSize'));
      pickIn.setAttribute('aria-label', host.t('mediaPvPickColor'));
      bgSel.setAttribute('aria-label', host.t('mediaPvBg'));
    }
    on(fontSel, 'change', function () { changeStyle({ font: fontSel.value }); paintCaption(); });
    on(sizeIn, 'input', function () { changeStyle({ size: sizeIn.value }); });
    on(pickIn, 'input', function () { changeStyle({ color: pickIn.value }); });
    on(bgSel, 'change', function () { changeStyle({ bg: bgSel.value }); });
    on(resetBtn, 'click', function () { style = Object.assign({}, DEFAULT_STYLE); applyStyle(); saveStyle(); });

    // What goes into the downloaded files. SRT gets font and colour only when they differ from the defaults, VTT gets a
    // STYLE block when anything differs; both only while the "put my style in the files" box is ticked. ASS always
    // carries the whole style. TXT is plain text and never styled.
    function styleChanged() {
      return style.font !== DEFAULT_STYLE.font || style.size !== DEFAULT_STYLE.size || style.color !== DEFAULT_STYLE.color || style.bg !== DEFAULT_STYLE.bg;
    }
    function fileStyle(kind) {
      var f = findBy(FONTS, style.font);
      var bg = findBy(BACKGROUNDS, style.bg);
      if (kind === 'ass') return { fontName: f.label, size: style.size, color: style.color, bg: style.bg };
      if (!inFilesBox.checked || !styleChanged()) return null;
      if (kind === 'srt') {
        var s = {};
        if (style.font !== DEFAULT_STYLE.font) s.fontName = f.label;
        if (style.color !== DEFAULT_STYLE.color) s.color = style.color;
        return s.fontName || s.color ? s : null;
      }
      return { fontCss: f.css, size: style.size, color: style.color, bgCss: bg.css };
    }

    // The caption box under an audio player (an audio element draws no subtitles of its own). With nothing
    // playing it shows a sample line so the style can be judged. Video keeps the player's own subtitles, styled
    // by the same settings through ::cue.
    function currentCueIndex() {
      if (!media || !cues.length) return -1;
      var t = media.currentTime;
      for (var i = 0; i < cues.length; i++) {
        if (t >= cues[i].s && t < cues[i].e && X.textOf(cues[i], show === 'translated' ? 'translated' : 'original')) return i;
      }
      return -1;
    }
    function paintCaption() {
      var isAudio = !!media && lastKind === 'audio';
      capEl.hidden = !isAudio;
      if (!isAudio) return;
      var i = currentCueIndex();
      var idle = i < 0;
      capEl.classList.toggle('mt-pv-caption-idle', idle);
      capEl.textContent = idle ? host.t('mediaPvSample') : X.textOf(cues[i], show === 'translated' ? 'translated' : 'original');
    }

    // ---------- player ----------
    function teardownMedia() {
      if (trackOff) { trackOff(); trackOff = null; }
      track = null;
      if (media) {
        try { media.pause(); } catch (e) { /* element is being thrown away */ }
        media.removeAttribute('src');
        try { media.load(); } catch (e) { /* element is being thrown away */ }
        media.remove();
        media = null;
      }
      if (mediaUrl) { URL.revokeObjectURL(mediaUrl); mediaUrl = null; }
      lastFile = null;
      lastKind = null;
      capEl.hidden = true;
      capEl.textContent = '';
    }

    function setupMedia(file, kind) {
      teardownMedia();
      if (!file) return;
      media = document.createElement(kind === 'video' ? 'video' : 'audio');
      media.className = 'mt-pv-player';
      media.controls = true;
      media.preload = 'metadata';
      media.setAttribute('aria-label', host.t('mediaPvPlayer'));
      mediaUrl = URL.createObjectURL(file);
      media.src = mediaUrl;
      mediaSlot.appendChild(media);
      lastFile = file;
      lastKind = kind;
      ['timeupdate', 'seeked', 'play', 'pause'].forEach(function (ev) { media.addEventListener(ev, paintCaption); });
      paintCaption();
      try {
        track = media.addTextTrack('subtitles', host.t('mediaPvTrack'), 'und');
        track.mode = 'showing';
        var onChange = function () { markActive(); };
        track.addEventListener('cuechange', onChange);
        trackOff = function () { track.removeEventListener('cuechange', onChange); };
      } catch (e) {
        track = null; // no live subtitles in this browser: the list still works
      }
    }

    // ---------- text shown / edited ----------
    function field() { return show === 'translated' ? 't' : 'o'; }
    function shownText(c) { return String(c[field()] == null ? '' : c[field()]); }

    function rebuildTrack() {
      if (!track) return;
      try {
        while (track.cues && track.cues.length) track.removeCue(track.cues[0]);
        cues.forEach(function (c, i) {
          var text = X.textOf(c, show === 'translated' ? 'translated' : 'original');
          if (!text || !(c.e >= c.s)) return;
          var vc = new VTTCue(c.s, c.e, X.escapeCue(text));
          vc.mtIndex = i;
          track.addCue(vc);
        });
      } catch (e) {
        /* a browser that refuses cues: the list still works */
      }
    }

    // ---------- list ----------
    function clearActive() {
      if (active >= 0 && rows[active]) rows[active].row.classList.remove('mt-pv-active');
      active = -1;
    }
    function markActive() {
      paintCaption();
      var idx = -1;
      if (track && track.activeCues && track.activeCues.length) {
        var first = track.activeCues[0];
        idx = typeof first.mtIndex === 'number' ? first.mtIndex : -1;
      }
      if (idx === active) return;
      if (active >= 0 && rows[active]) rows[active].row.classList.remove('mt-pv-active');
      active = idx;
      if (idx >= 0 && rows[idx]) {
        var r = rows[idx].row;
        r.classList.add('mt-pv-active');
        // scroll the list itself (not the page) just enough to show the line
        if (r.offsetTop < listEl.scrollTop) listEl.scrollTop = r.offsetTop;
        else if (r.offsetTop + r.offsetHeight > listEl.scrollTop + listEl.clientHeight) listEl.scrollTop = r.offsetTop + r.offsetHeight - listEl.clientHeight;
      }
    }

    function paintRow(i) {
      var r = rows[i];
      if (!r) return;
      var c = cues[i];
      var text = shownText(c);
      var fallback = show === 'translated' && !text.trim();
      r.text.textContent = fallback ? String(c.o || '') : text;
      r.text.classList.toggle('mt-pv-fallback', fallback);
      r.time.textContent = mmss(c.s);
      r.time.setAttribute('aria-label', fmt(host.t('mediaPvSeek'), { time: mmss(c.s) }));
      r.edit.textContent = host.t('mediaPvEdit');
      r.edit.setAttribute('aria-label', fmt(host.t('mediaPvEditLabel'), { n: i + 1 }));
    }

    function seek(i) {
      if (!media || !cues[i]) return;
      try { media.currentTime = cues[i].s; } catch (e) { /* not ready yet */ }
    }

    // Closes the text box. save: keep what was typed. delay: leave the box open a moment (used when the box
    // just lost focus, so a click on a button that sits lower on the page is not lost to the list shrinking).
    function stopEdit(save, delay) {
      if (editing < 0) return;
      var i = editing;
      var r = rows[i];
      if (!r || !r.input) { editing = -1; return; }
      if (save && r.input.value !== shownText(cues[i])) {
        cues[i][field()] = r.input.value;
        rebuildTrack();
        clearActive();
        updateStatic();
      }
      if (delay) {
        clearTimeout(closeTimer);
        closeTimer = setTimeout(function () { closeBox(i); }, delay);
        return;
      }
      closeBox(i);
    }

    function closeBox(i) {
      clearTimeout(closeTimer);
      closeTimer = null;
      if (editing !== i) return;
      editing = -1;
      var r = rows[i];
      if (!r || !r.input) return;
      var input = r.input;
      r.input = null;
      input.remove();
      r.text.hidden = false;
      r.edit.hidden = false;
      paintRow(i);
    }

    function startEdit(i) {
      if (editing === i) return;
      stopEdit(true);
      var r = rows[i];
      if (!r) return;
      editing = i;
      var input = document.createElement('textarea');
      input.className = 'mt-pv-input';
      input.setAttribute('dir', 'auto');
      input.rows = Math.max(2, String(shownText(cues[i])).split('\n').length);
      input.value = shownText(cues[i]);
      input.setAttribute('aria-label', fmt(host.t('mediaPvEditLabel'), { n: i + 1 }));
      r.input = input;
      r.text.hidden = true;
      r.edit.hidden = true;
      r.row.appendChild(input);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); stopEdit(false); }
        else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); stopEdit(true); }
      });
      input.addEventListener('blur', function () { if (editing === i && r.input === input) stopEdit(true, 200); });
      input.focus();
    }

    function buildList() {
      clearTimeout(closeTimer);
      closeTimer = null;
      editing = -1;
      active = -1;
      listEl.textContent = '';
      rows = [];
      var frag = document.createDocumentFragment();
      cues.forEach(function (c, i) {
        var row = document.createElement('div');
        row.className = 'mt-pv-line';
        row.setAttribute('role', 'listitem');
        var time = document.createElement('button');
        time.type = 'button';
        time.className = 'mt-pv-time';
        var text = document.createElement('div');
        text.className = 'mt-pv-text';
        text.setAttribute('dir', 'auto');
        var edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'mt-btn mt-btn-quiet mt-pv-edit';
        row.append(time, text, edit);
        frag.appendChild(row);
        rows.push({ row: row, time: time, text: text, edit: edit, input: null });
        time.addEventListener('click', function () { seek(i); });
        text.addEventListener('click', function () { seek(i); });
        edit.addEventListener('click', function () { startEdit(i); });
        paintRow(i);
      });
      listEl.appendChild(frag);
    }

    // Texts that depend on the language and on what exists right now.
    function updateStatic() {
      showSel.options[0].textContent = host.t('mediaPvOriginal');
      showSel.options[1].textContent = host.t('mediaPvTranslated');
      showSel.options[1].disabled = !hasTr;
      showSel.value = show;
      var total = 0;
      var done = 0;
      cues.forEach(function (c) { if (String(c.o || '').trim()) { total += 1; if (String(c.t || '').trim()) done += 1; } });
      hasTr = done > 0;
      showSel.options[1].disabled = !hasTr;
      var partial = hasTr && done < total;
      noteEl.hidden = !partial;
      noteEl.textContent = partial ? fmt(host.t('mediaPvPartial'), { count: done, total: total }) : '';
      var canSave = typeof host.saveFile === 'function';
      exportRow.hidden = !canSave;
      nextRow.hidden = !(canSave && !!lastFile && !!host.desktop && typeof host.desktop.saveNextTo === 'function');
      btn.tr.disabled = !hasTr;
      btn.bi.disabled = !hasTr;
      var any = cues.some(function (c) { return X.textOf(c, 'original') || X.textOf(c, 'translated'); });
      btn.orig.disabled = !any;
      btn.vtt.disabled = !any;
      btn.ass.disabled = !any;
      btn.txt.disabled = !any;
    }

    function repaintAll() {
      for (var i = 0; i < rows.length; i++) if (i !== editing) paintRow(i);
    }

    // ---------- export ----------
    function exportAs(kind) {
      if (typeof host.saveFile !== 'function') return;
      stopEdit(true);
      var base = X.baseName(meta.name);
      var mode;
      var ext;
      var langs;
      if (kind === 'orig') { mode = 'original'; ext = 'srt'; langs = [meta.srcLang]; }
      else if (kind === 'tr') { mode = 'translated'; ext = 'srt'; langs = [meta.tgtLang]; }
      else if (kind === 'bi') { mode = 'bilingual'; ext = 'srt'; langs = [meta.srcLang, meta.tgtLang]; }
      else {
        mode = show === 'translated' ? 'translated' : 'original';
        ext = kind;
        langs = [mode === 'translated' ? meta.tgtLang : meta.srcLang];
      }
      var text = ext === 'srt' ? X.srt(cues, mode, fileStyle('srt')) : ext === 'vtt' ? X.vtt(cues, mode, meta.engine, fileStyle('vtt')) : ext === 'ass' ? X.ass(cues, mode, fileStyle('ass'), meta.engine) : X.txt(cues, mode);
      var name = X.fileName(base, ext, langs);
      var blob = X.toBlob(ext, text);
      function say(msg) { if (typeof host.toast === 'function') host.toast(msg); }
      if (!nextRow.hidden && nextBox.checked && lastFile) {
        // Windows app: write beside the media file; if that fails, fall back to a normal download.
        Promise.resolve().then(function () { return host.desktop.saveNextTo(lastFile, name, blob); }).then(
          function (r) { if (!destroyed) say(fmt(host.t('mediaPvSavedNext'), { name: (r && r.name) || name })); },
          function () { if (destroyed) return; host.saveFile(name, blob); say(host.t('mediaPvNextFail')); }
        );
        return;
      }
      host.saveFile(name, blob);
      say(fmt(host.t('mediaPvSaved'), { name: name }));
    }

    on(btn.orig, 'click', function () { exportAs('orig'); });
    on(btn.tr, 'click', function () { exportAs('tr'); });
    on(btn.bi, 'click', function () { exportAs('bi'); });
    on(btn.vtt, 'click', function () { exportAs('vtt'); });
    on(btn.ass, 'click', function () { exportAs('ass'); });
    on(btn.txt, 'click', function () { exportAs('txt'); });
    on(showSel, 'change', function () {
      stopEdit(true);
      show = showSel.value === 'translated' && hasTr ? 'translated' : 'original';
      rebuildTrack();
      clearActive();
      repaintAll();
    });

    // ---------- public ----------
    function update(m) {
      if (destroyed) return;
      if (!m || !m.visible || !m.file) {
        teardownMedia();
        stopEdit(false);
        lastVersion = null;
        lastStrings = null;
        return;
      }
      cues = m.cues || [];
      meta = { name: m.name || '', srcLang: m.srcLang || null, tgtLang: m.tgtLang || null, engine: m.engine || '' };
      if (m.file !== lastFile || m.kind !== lastKind) setupMedia(m.file, m.kind);
      if (m.version !== lastVersion) {
        lastVersion = m.version;
        stopEdit(true);
        var has = cues.some(function (c) { return String(c.t || '').trim(); });
        if (has && !hasTr) show = 'translated';
        else if (!has) show = 'original';
        hasTr = has;
        buildList();
        rebuildTrack();
      } else if (m.strings !== lastStrings) {
        repaintAll();
      }
      lastStrings = m.strings;
      updateStatic();
      paintStyleTexts();
      paintCaption();
      if (media) media.setAttribute('aria-label', host.t('mediaPvPlayer'));
    }

    buildStyleUi();

    return {
      update: update,
      destroy: function () {
        if (destroyed) return;
        destroyed = true;
        stopEdit(false);
        teardownMedia();
        offs.forEach(function (off) { off(); });
        offs = [];
        listEl.textContent = '';
        rows = [];
      }
    };
  }

  MT.preview = { create: create };
})();
