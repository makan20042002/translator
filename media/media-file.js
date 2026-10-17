/*
 * media-file.js - pure helpers about the chosen file (no DOM, no network).
 * Adds only to the single exported object MediaTranslate (as MediaTranslate.file).
 */
(function () {
  'use strict';
  var MT = (window.MediaTranslate = window.MediaTranslate || {});

  var AUDIO_EXTS = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'opus', 'flac'];
  var VIDEO_EXTS = ['mp4', 'mkv', 'webm', 'mov', 'avi'];
  var ACCEPT = AUDIO_EXTS.concat(VIDEO_EXTS).map(function (e) { return '.' + e; }).join(',');

  // Big-file warning: STRICTLY above these values (exactly 60 min / exactly 500 MB is fine).
  var MAX_SECONDS = 60 * 60;
  var MAX_BYTES = 500 * 1024 * 1024;

  function extOf(name) {
    var m = /\.([A-Za-z0-9]+)$/.exec(String(name || ''));
    return m ? m[1].toLowerCase() : '';
  }

  // Decide from the file NAME (browsers often give mkv/avi an empty MIME type).
  // Returns { ok:true, ext, kind:'audio'|'video' } or { ok:false, reason:<i18n key> }.
  // Order of checks: extension missing -> unsupported -> empty (0 bytes).
  function classifyFile(file) {
    if (!file || typeof file.name !== 'string') return { ok: false, reason: 'mediaErrUnsupported' };
    var ext = extOf(file.name);
    if (!ext) return { ok: false, reason: 'mediaErrNoExt' };
    var kind = AUDIO_EXTS.indexOf(ext) >= 0 ? 'audio' : VIDEO_EXTS.indexOf(ext) >= 0 ? 'video' : '';
    if (!kind) return { ok: false, reason: 'mediaErrUnsupported' };
    if (!file.size) return { ok: false, reason: 'mediaErrEmpty' };
    return { ok: true, ext: ext, kind: kind };
  }

  // 1024-based units, one decimal (bytes are whole numbers): 1536 -> "1.5 KB".
  function formatSize(bytes) {
    var units = ['B', 'KB', 'MB', 'GB'];
    var v = Number(bytes);
    if (!isFinite(v) || v < 0) return '';
    var i = 0;
    while (i < 3 && Math.round(v * 10) / 10 >= 1024) {
      v /= 1024;
      i += 1;
    }
    return i === 0 ? Math.round(v) + ' B' : v.toFixed(1) + ' ' + units[i];
  }

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  // Seconds -> "m:ss" or "h:mm:ss" (rounded to whole seconds). Unknown -> "".
  function formatDuration(seconds) {
    var s = Number(seconds);
    if (!isFinite(s) || s < 0) return '';
    s = Math.round(s);
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    return h > 0 ? h + ':' + pad2(m) + ':' + pad2(sec) : m + ':' + pad2(sec);
  }

  // info = { bytes, seconds } ; seconds may be NaN/null when unknown (then only size counts).
  function needsBigWarning(info, limits) {
    var maxBytes = limits && limits.maxBytes != null ? limits.maxBytes : MAX_BYTES;
    var maxSeconds = limits && limits.maxSeconds != null ? limits.maxSeconds : MAX_SECONDS;
    var tooBig = info.bytes > maxBytes;
    var tooLong = typeof info.seconds === 'number' && isFinite(info.seconds) && info.seconds > maxSeconds;
    return tooBig || tooLong;
  }

  MT.file = {
    AUDIO_EXTS: AUDIO_EXTS,
    VIDEO_EXTS: VIDEO_EXTS,
    ACCEPT: ACCEPT,
    MAX_SECONDS: MAX_SECONDS,
    MAX_BYTES: MAX_BYTES,
    extOf: extOf,
    classifyFile: classifyFile,
    formatSize: formatSize,
    formatDuration: formatDuration,
    needsBigWarning: needsBigWarning
  };
})();
