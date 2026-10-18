// MAKAN Translate - Bug Report Dialog & Diagnostics
// Collects privacy-safe diagnostic info with zero keys or user text.

(function () {
  'use strict';

  var MAX_ERRORS = 5;
  var errorRing = [];

  function recordError(err) {
    if (!err) return;
    var msg = '';
    if (typeof err === 'string') {
      msg = err;
    } else if (err.message) {
      msg = err.message;
    } else {
      msg = String(err);
    }
    var redactFn = (typeof ENG !== 'undefined' && ENG.redactDiagnosticsText) || defaultRedact;
    var clean = redactFn(msg);
    if (!clean || !clean.trim()) return;
    var time = new Date().toTimeString().slice(0, 8);
    errorRing.push('[' + time + '] ' + clean.trim());
    if (errorRing.length > MAX_ERRORS) {
      errorRing.shift();
    }
  }

  function defaultRedact(str) {
    if (typeof str !== 'string') return '';
    var s = str;
    s = s.replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED_TOKEN]');
    s = s.replace(/(?:AIza[0-9A-Za-z_-]{35}|(?:sk|gsk)_[a-zA-Z0-9_-]{20,})/g, '[REDACTED_KEY]');
    s = s.replace(/\b[a-zA-Z0-9_-]{32,}\b/g, function (m) {
      if (/[0-9]/.test(m) && /[a-zA-Z]/.test(m)) return '[REDACTED_KEY]';
      return m;
    });
    s = s.replace(/[?&][^=\s&]+=[^&\s]*/g, '[REDACTED_QUERY]');
    s = s.replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, '[REDACTED_EMAIL]');
    s = s.replace(/https?:\/\/[^\s"'<>]+/gi, '[REDACTED_URL]');
    return s;
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('error', function (e) {
      recordError(e.message || e.error);
    });
    window.addEventListener('unhandledrejection', function (e) {
      recordError(e.reason);
    });
    if (typeof toast === 'function') {
      var origToast = toast;
      toast = function (msg, kind, ms) {
        if (kind === 'err' || kind === 'error') {
          recordError(msg);
        }
        return origToast.apply(this, arguments);
      };
    }
  }

  function buildDiagnosticsLines() {
    var version = ENG.getAppVersion();
    var lang = (document.documentElement && document.documentElement.lang) || 'en';
    var ua = (typeof navigator !== 'undefined' && navigator.userAgent) || 'unknown';

    var activeTabBtn = document.querySelector('#tabs button.on');
    var activeTab = (activeTabBtn && activeTabBtn.getAttribute('data-tab')) || 'text';

    var mode = (typeof cfg !== 'undefined' && cfg.transMode) ||
      (document.getElementById('transMode') && document.getElementById('transMode').value) ||
      (document.getElementById('mode') && document.getElementById('mode').value) || 'auto';

    var engineNames = [];
    if (typeof cfg !== 'undefined' && Array.isArray(cfg.order)) {
      for (var i = 0; i < cfg.order.length; i++) {
        var id = cfg.order[i];
        var engCfg = (cfg.eng && cfg.eng[id]) || {};
        if (engCfg.on !== false) {
          var info = (typeof ENG !== 'undefined' && ENG[id]) || {};
          engineNames.push(info.name || id);
        }
      }
    }
    if (engineNames.length === 0) engineNames.push('none');

    var isOffline = !!(
      (document.getElementById('chkOffline') && document.getElementById('chkOffline').checked) ||
      (typeof cfg !== 'undefined' && cfg.offline)
    );

    var downloaded = [];
    try {
      if (typeof store !== 'undefined') {
        var mdl = store.get('mdl') || {};
        var cat = (typeof MODEL_CATALOG !== 'undefined' && MODEL_CATALOG.models) || [];
        var keys = Object.keys(mdl);
        for (var k = 0; k < keys.length; k++) {
          var mId = keys[k];
          var found = cat.find(function (m) { return m.id === mId; });
          downloaded.push(found && found.name ? found.name : mId);
        }
      }
    } catch (_) {}
    if (downloaded.length === 0) downloaded.push('none');

    var hasWebGpu = (typeof navigator !== 'undefined' && !!navigator.gpu) ? 'yes' : 'no';
    var isDesktop = (typeof window !== 'undefined' && !!window.makanDesktop) ? 'yes' : 'no';

    return [
      'App Version: ' + version,
      'Interface Language: ' + lang,
      'Active Tab: ' + activeTab,
      'Translation Mode: ' + mode,
      'Enabled Engines: ' + engineNames.join(', '),
      'Offline Mode: ' + (isOffline ? 'on' : 'off'),
      'Downloaded Models: ' + downloaded.join(', '),
      'WebGPU Available: ' + hasWebGpu,
      'Windows Desktop App: ' + isDesktop,
      'Browser / OS: ' + ua
    ];
  }

  function buildReportText(forMailto) {
    var version = ENG.getAppVersion();
    var whatH = document.getElementById('bugWhatHappened');
    var whatE = document.getElementById('bugWhatExpected');
    var happened = (whatH && whatH.value.trim()) || '';
    var expected = (whatE && whatE.value.trim()) || '';

    var diagLines = buildDiagnosticsLines();
    var errors = errorRing.slice();

    function assemble(errList, isTrunc) {
      var parts = [];
      parts.push('MAKAN Translate Bug Report v' + version);
      parts.push('');
      parts.push('What happened:');
      parts.push(happened || '(not specified)');
      parts.push('');
      parts.push('What did you expect:');
      parts.push(expected || '(not specified)');
      parts.push('');
      parts.push('Diagnostics:');
      for (var i = 0; i < diagLines.length; i++) {
        parts.push('- ' + diagLines[i]);
      }
      parts.push('- Recent Errors (last ' + errList.length + '):');
      if (isTrunc) {
        parts.push('  [Diagnostics truncated to fit email client limit]');
      }
      if (errList.length === 0) {
        parts.push('  (none recorded)');
      } else {
        for (var j = 0; j < errList.length; j++) {
          parts.push('  ' + (j + 1) + '. ' + errList[j]);
        }
      }
      return parts.join('\n');
    }

    var report = assemble(errors, false);

    if (forMailto || report.length >= 1800) {
      var isTrunc = false;
      while (errors.length > 0 && assemble(errors, isTrunc).length >= 1750) {
        errors.shift();
        isTrunc = true;
      }
      var finalReport = assemble(errors, isTrunc);
      if (finalReport.length >= 1750) {
        isTrunc = true;
        errors = [];
        diagLines = diagLines.map(function (l) {
          if (l.startsWith('Browser / OS:') && l.length > 80) return l.slice(0, 80) + '...';
          return l;
        });
        finalReport = assemble(errors, isTrunc);
      }
      if (finalReport.length > 1780) {
        finalReport = finalReport.slice(0, 1720) + '\n[Diagnostics truncated to fit email client limit]';
      }
      return { report: finalReport, truncated: isTrunc };
    }

    return { report: report, truncated: false };
  }

  function updateBugReportPreview() {
    var res = buildReportText(true);
    var pre = document.getElementById('bugDiagPreview');
    if (pre) {
      pre.textContent = res.report;
    }
    var sendLink = document.getElementById('bugSendEmail');
    if (sendLink) {
      var version = ENG.getAppVersion();
      var email = (typeof ENG !== 'undefined' && ENG.BUG_REPORT_EMAIL) || 'makan20042002@gmail.com';
      var subject = 'MAKAN Translate bug report v' + version;
      sendLink.href = 'mailto:' + email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(res.report);
    }
  }

  var lastFocusedElement = null;

  function openBugReportModal(openerEl) {
    lastFocusedElement = openerEl || document.activeElement;
    var modal = document.getElementById('bugReportModal');
    if (!modal) return;
    modal.hidden = false;
    updateBugReportPreview();
    var first = document.getElementById('bugWhatHappened');
    if (first) first.focus();
  }

  function closeBugReportModal() {
    var modal = document.getElementById('bugReportModal');
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      try { lastFocusedElement.focus(); } catch (_) {}
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var aboutBtn = document.getElementById('aboutBugReportBtn');
    if (aboutBtn) {
      aboutBtn.onclick = function () {
        openBugReportModal(aboutBtn);
      };
    }

    var helpBtn = document.getElementById('helpBugReportBtn');
    if (helpBtn) {
      helpBtn.onclick = function () {
        openBugReportModal(helpBtn);
      };
    }

    var closeBtn = document.getElementById('bugReportClose');
    if (closeBtn) {
      closeBtn.onclick = function () {
        closeBugReportModal();
      };
    }

    var whatH = document.getElementById('bugWhatHappened');
    if (whatH) whatH.oninput = updateBugReportPreview;

    var whatE = document.getElementById('bugWhatExpected');
    if (whatE) whatE.oninput = updateBugReportPreview;

    var copyBtn = document.getElementById('bugCopyReport');
    if (copyBtn) {
      copyBtn.onclick = async function () {
        var res = buildReportText(false);
        var text = res.report;
        var statusEl = document.getElementById('bugCopyStatus');
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            if (statusEl) {
              statusEl.textContent = (typeof L === 'function' && L('bugCopied')) || 'Copied to clipboard ✓';
              statusEl.style.display = 'inline';
              statusEl.style.color = 'var(--success)';
              setTimeout(function () { statusEl.style.display = 'none'; }, 3000);
            }
            return;
          }
        } catch (_) {}

        var pre = document.getElementById('bugDiagPreview');
        if (pre) {
          var range = document.createRange();
          range.selectNodeContents(pre);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
        if (statusEl) {
          statusEl.textContent = (typeof L === 'function' && L('bugCopyFallback')) || 'Could not copy automatically; please copy from the preview.';
          statusEl.style.display = 'inline';
          statusEl.style.color = 'var(--warning, var(--warn))';
          setTimeout(function () { statusEl.style.display = 'none'; }, 5000);
        }
      };
    }
  });

  // Focus trap and Escape listener
  document.addEventListener('keydown', function (e) {
    var modal = document.getElementById('bugReportModal');
    if (!modal || modal.hidden) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      closeBugReportModal();
      return;
    }

    if (e.key === 'Tab') {
      var focusable = modal.querySelectorAll('button:not([disabled]), textarea:not([disabled]), a[href]:not([disabled]), input:not([disabled]), pre[tabindex]:not([disabled])');
      var list = Array.prototype.slice.call(focusable).filter(function (el) {
        return el.offsetParent !== null || el.getClientRects().length > 0;
      });
      if (!list.length) return;
      var first = list[0];
      var last = list[list.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || !modal.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !modal.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  });
})();
