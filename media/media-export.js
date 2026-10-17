/*
 * media-export.js - turns cues into subtitle files. Pure functions, no DOM. Adds only MediaTranslate.exporter.
 *
 * cue  : { s, e, o, t }   o = original text, t = translation ('' when not translated); "\n" between lines
 * mode : 'original' | 'translated' | 'bilingual'
 *   original   the text in o
 *   translated the text in t (cues that are not translated are LEFT OUT)
 *   bilingual  original line(s) first, then the translation line(s); an untranslated cue keeps only its original
 *
 * Rules every file follows:
 *  - cues with no text are left out and the rest are numbered 1, 2, 3...
 *  - blank lines inside a cue are removed (a blank line would end the cue in SRT and VTT)
 *  - times are rounded to whole milliseconds with integer maths (59.9996 s becomes 00:01:00,000, not 00:00:60,000)
 *  - SRT: HH:MM:SS,mmm  and CRLF line ends.  VTT: header WEBVTT, HH:MM:SS.mmm, & < > escaped.  TXT: one line per cue.
 *  - toBlob adds a UTF-8 byte-order mark to SRT and TXT (Windows players then read Persian and Arabic correctly).
 *
 * API: fmtTime(sec, sep), escapeCue(text), textOf(cue, mode), srt(cues, mode), vtt(cues, mode), txt(cues, mode),
 *      toBlob(kind, text), baseName(fileName), safeName(name), fileName(base, ext, langs)
 */
(function () {
  'use strict';
  var MT = (window.MediaTranslate = window.MediaTranslate || {});

  function pad(n, w) {
    var s = String(n);
    while (s.length < w) s = '0' + s;
    return s;
  }

  // sep is ',' for SRT and '.' for VTT. Negative or broken times become 0.
  function fmtTime(sec, sep) {
    var ms = Math.round((isFinite(sec) && sec > 0 ? sec : 0) * 1000);
    var h = Math.floor(ms / 3600000);
    ms -= h * 3600000;
    var m = Math.floor(ms / 60000);
    ms -= m * 60000;
    var s = Math.floor(ms / 1000);
    ms -= s * 1000;
    return pad(h, 2) + ':' + pad(m, 2) + ':' + pad(s, 2) + (sep || ',') + pad(ms, 3);
  }

  function escapeCue(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Lines trimmed, blank lines removed, "\r\n" understood.
  function tidy(text) {
    return String(text == null ? '' : text)
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map(function (l) { return l.trim(); })
      .filter(function (l) { return l.length > 0; })
      .join('\n');
  }

  function textOf(cue, mode) {
    var o = tidy(cue && cue.o);
    var t = tidy(cue && cue.t);
    if (mode === 'translated') return t;
    if (mode === 'bilingual') return o && t ? o + '\n' + t : o || t;
    return o;
  }

  // The cues of a mode that have text, in the same order: [{ s, e, text }]
  function pick(cues, mode) {
    var out = [];
    (Array.isArray(cues) ? cues : []).forEach(function (c) {
      var text = textOf(c, mode);
      if (text) out.push({ s: c.s, e: c.e, text: text });
    });
    return out;
  }

  // style (optional): { fontName?, color? }. SRT has no real styling; the <font> tag is understood by VLC, MPC-HC and
  // many (not all) players. Each line is wrapped on its own so a line break never splits a tag.
  function srtFont(style) {
    if (!style) return null;
    var attrs = '';
    if (style.fontName && /^[A-Za-z0-9 ._-]{1,40}$/.test(style.fontName)) attrs += ' face="' + style.fontName + '"';
    if (style.color && /^#[0-9a-f]{6}$/i.test(style.color)) attrs += ' color="' + style.color.toLowerCase() + '"';
    return attrs ? attrs : null;
  }
  function srt(cues, mode, style) {
    var attrs = srtFont(style);
    return pick(cues, mode).map(function (c, i) {
      var text = attrs ? c.text.split('\n').map(function (l) { return '<font' + attrs + '>' + l + '</font>'; }).join('\n') : c.text;
      return (i + 1) + '\r\n' + fmtTime(c.s, ',') + ' --> ' + fmtTime(c.e, ',') + '\r\n' + text.replace(/\n/g, '\r\n') + '\r\n';
    }).join('\r\n');
  }

  // note (optional): who translated this. WebVTT allows a NOTE block between or after cues; players ignore it.
  // It goes after the last cue so the file still starts with the cues. No note for the original-language version.
  function noteOf(text) {
    return String(text || '').replace(/\s+/g, ' ').replace(/-->/g, '->').trim();
  }
  // style (optional): { fontCss, size, color, bgCss } becomes a STYLE block (::cue) right after the header.
  function cssValue(v) { return String(v == null ? '' : v).replace(/[;{}<>\n\r]/g, '').trim(); }
  function vttStyleBlock(style) {
    if (!style) return '';
    var rules = [];
    if (style.color && /^#[0-9a-f]{6}$/i.test(style.color)) rules.push('color: ' + style.color.toLowerCase());
    if (style.bgCss) rules.push('background-color: ' + cssValue(style.bgCss));
    if (style.fontCss) rules.push('font-family: ' + cssValue(style.fontCss));
    if (style.size >= 8 && style.size <= 96) rules.push('font-size: ' + Math.round(style.size) + 'px');
    return rules.length ? 'STYLE\n::cue {\n  ' + rules.join(';\n  ') + ';\n}\n\n' : '';
  }
  function vtt(cues, mode, note, style) {
    var body = pick(cues, mode).map(function (c, i) {
      return (i + 1) + '\n' + fmtTime(c.s, '.') + ' --> ' + fmtTime(c.e, '.') + '\n' + escapeCue(c.text) + '\n';
    }).join('\n');
    var n = mode !== 'original' && body ? noteOf(note) : '';
    return 'WEBVTT\n\n' + (body ? vttStyleBlock(style) : '') + body + (n ? '\nNOTE Translated by ' + n + '\n' : '');
  }

  // ---------- ASS (Advanced SubStation Alpha): the format made for styled subtitles ----------
  // style: { fontName, size, color, bg: 'dark'|'black'|'light'|'none' } (size is the preview size in px).
  // ASS colours are &HAABBGGRR with alpha 00 = solid.
  function assColor(hex, alpha) {
    var h = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : 'ffffff';
    var a = Math.max(0, Math.min(255, Math.round(alpha || 0)));
    var rr = h.slice(0, 2);
    var gg = h.slice(2, 4);
    var bb = h.slice(4, 6);
    return ('&H' + pad(a.toString(16), 2) + bb + gg + rr).toUpperCase();
  }
  function assTime(sec) {
    var cs = Math.round((isFinite(sec) && sec > 0 ? sec : 0) * 100);
    var h = Math.floor(cs / 360000);
    cs -= h * 360000;
    var m = Math.floor(cs / 6000);
    cs -= m * 6000;
    var s = Math.floor(cs / 100);
    cs -= s * 100;
    return h + ':' + pad(m, 2) + ':' + pad(s, 2) + '.' + pad(cs, 2);
  }
  function ass(cues, mode, style, note) {
    var st = style || {};
    var name = String(st.fontName || 'Segoe UI').replace(/[^A-Za-z0-9 ._-]/g, '').trim() || 'Segoe UI';
    var size = Math.round((st.size >= 8 && st.size <= 96 ? st.size : 24) * 1.5); // preview px -> a 720p picture
    var bg = st.bg === 'black' || st.bg === 'light' || st.bg === 'none' ? st.bg : 'dark';
    var box = bg !== 'none';
    var back = bg === 'black' ? assColor('#000000', 0) : bg === 'light' ? assColor('#ffffff', 38) : assColor('#000000', 102);
    var primary = assColor(st.color, 0);
    var outline = box ? back : assColor('#000000', 0);
    var n = mode !== 'original' ? noteOf(note) : '';
    var head = '[Script Info]\n; Made by MAKAN Media Translate\n' + (n ? '; Translated by ' + n + '\n' : '') +
      'ScriptType: v4.00+\nPlayResX: 1280\nPlayResY: 720\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n' +
      '[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n' +
      'Style: Default,' + name + ',' + size + ',' + primary + ',' + primary + ',' + outline + ',' + back + ',0,0,0,0,100,100,0,0,' + (box ? 3 : 1) + ',2,0,2,40,40,40,1\n\n' +
      '[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';
    var lines = pick(cues, mode).map(function (c) {
      var text = c.text.replace(/\{/g, '\\{').replace(/\}/g, '\\}').replace(/\n/g, '\\N');
      return 'Dialogue: 0,' + assTime(c.s) + ',' + assTime(c.e) + ',Default,,0,0,0,,' + text;
    });
    return head + lines.join('\n') + (lines.length ? '\n' : '');
  }

  function txt(cues, mode) {
    var lines = pick(cues, mode).map(function (c) {
      return c.text.replace(/\n/g, mode === 'bilingual' ? '\r\n' : ' ');
    });
    return lines.join('\r\n') + (lines.length ? '\r\n' : '');
  }

  var TYPES = {
    srt: 'application/x-subrip;charset=utf-8',
    vtt: 'text/vtt;charset=utf-8',
    txt: 'text/plain;charset=utf-8',
    ass: 'text/x-ssa;charset=utf-8'
  };

  function toBlob(kind, text) {
    var bom = kind === 'srt' || kind === 'txt' || kind === 'ass' ? '﻿' : '';
    return new Blob([bom + text], { type: TYPES[kind] || TYPES.txt });
  }

  // "talk.final.mp4" -> "talk.final"; "noext" -> "noext"
  function baseName(fileName) {
    var n = String(fileName || '');
    var dot = n.lastIndexOf('.');
    return dot > 0 ? n.slice(0, dot) : n;
  }

  // Characters Windows does not allow in file names become "_".
  function safeName(name) {
    var s = String(name || '').replace(/[\\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^[ .]+|[ .]+$/g, '');
    return s || 'subtitles';
  }

  // fileName('talk', 'srt', ['en','fa']) -> 'talk.en-fa.srt'; unknown languages are left out.
  function fileName(base, ext, langs) {
    var tags = (langs || []).filter(function (l) { return typeof l === 'string' && /^[A-Za-z0-9_-]{1,12}$/.test(l); });
    return safeName(base) + (tags.length ? '.' + tags.join('-') : '') + '.' + ext;
  }

  MT.exporter = {
    fmtTime: fmtTime,
    escapeCue: escapeCue,
    textOf: textOf,
    srt: srt,
    vtt: vtt,
    ass: ass,
    txt: txt,
    toBlob: toBlob,
    baseName: baseName,
    safeName: safeName,
    fileName: fileName
  };
})();
