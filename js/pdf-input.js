// MAKAN Translate — PDF text extraction and layout reconstruction.
// Classic script, runs in browser and node. No build step.

let _pdfJsPromise = null;

function ensurePdfJsLoaded() {
  if (typeof globalThis !== 'undefined' && globalThis.pdfjsLib) {
    return Promise.resolve(globalThis.pdfjsLib);
  }
  if (_pdfJsPromise) return _pdfJsPromise;

  _pdfJsPromise = new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      try {
        const lib = require('../vendor/pdfjs/pdf.min.js');
        if (lib) {
          if (typeof globalThis !== 'undefined') globalThis.pdfjsLib = lib;
          resolve(lib);
          return;
        }
      } catch (e) {
        _pdfJsPromise = null;
        reject(e);
        return;
      }
    }

    const script = document.createElement('script');
    script.src = 'vendor/pdfjs/pdf.min.js';
    script.async = true;
    script.onload = () => {
      const lib = (typeof window !== 'undefined' ? window.pdfjsLib : null) ||
                  (typeof globalThis !== 'undefined' ? globalThis.pdfjsLib : null);
      if (lib) {
        if (lib.GlobalWorkerOptions && !lib.GlobalWorkerOptions.workerSrc) {
          lib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';
        }
        resolve(lib);
      } else {
        _pdfJsPromise = null;
        reject(new Error('pdfjsLib is not defined after script load'));
      }
    };
    script.onerror = (err) => {
      _pdfJsPromise = null;
      reject(err || new Error('Failed to load vendor/pdfjs/pdf.min.js'));
    };
    (document.head || document.documentElement).appendChild(script);
  });

  return _pdfJsPromise;
}

const ROMAN_NUMERALS_20 = new Set([
  'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x',
  'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx'
]);

function normalizeLigatures(str) {
  if (!str) return '';
  return str
    .replace(/\uFB01/g, 'fi')
    .replace(/\uFB02/g, 'fl')
    .replace(/\uFB00/g, 'ff')
    .replace(/\uFB03/g, 'ffi')
    .replace(/\uFB04/g, 'ffl')
    .replace(/\uFB05/g, 'ft')
    .replace(/\uFB06/g, 'st')
    .replace(/\u00AD/g, '')     // soft hyphen
    .replace(/\u00A0/g, ' ');    // non-breaking space
}

function isStandalonePageNumber(text) {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  // Digits only
  if (/^[\d\u06F0-\u06F9]+$/.test(t)) return true;
  // "Page N", "page N", "صفحه N"
  if (/^(?:page|صفحه)\s+[\d\u06F0-\u06F9]+$/i.test(t)) return true;
  // "N of M", "N / M", "N - M"
  if (/^[\d\u06F0-\u06F9]+\s*(?:of|\/|-)\s*[\d\u06F0-\u06F9]+$/i.test(t)) return true;
  // Roman numerals up to 20
  if (ROMAN_NUMERALS_20.has(t)) return true;
  return false;
}

function calcMedian(numbers) {
  if (!numbers || numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function mapPdfError(err, stats) {
  if (!err && !stats) return 'unknown';

  const name = err?.name || '';
  const msg = err?.message || '';
  const code = err?.code || '';

  if (name === 'PasswordException' || /password/i.test(name) || /password/i.test(msg)) {
    return 'password';
  }

  if (
    name === 'InvalidPDFException' ||
    name === 'MissingPDFException' ||
    name === 'UnexpectedResponseException' ||
    name === 'FormatError' ||
    code === 'corrupt' ||
    /invalid pdf|missing pdf|corrupt|damaged|unexpected response/i.test(msg) ||
    /invalid pdf|missing pdf|corrupt/i.test(name)
  ) {
    return 'corrupt';
  }

  if (
    code === 'too_big' ||
    err?.numPages > 1000 ||
    err?.byteLength > 200 * 1024 * 1024 ||
    (stats && (stats.pageCount > 1000 || (stats.byteLength && stats.byteLength > 200 * 1024 * 1024)))
  ) {
    return 'too_big';
  }

  if (
    code === 'no_text' ||
    (stats && stats.pageCount > 0 && (stats.charCount === 0 || stats.avgCharsPerPage < 20))
  ) {
    return 'no_text';
  }

  if (name === 'AbortError' || /abort/i.test(msg) || /abort/i.test(name)) {
    return 'aborted';
  }

  return 'unknown';
}

async function extractPdfParagraphs(arrayBuffer, options = {}) {
  const { onProgress, signal } = options;

  if (signal && signal.aborted) {
    const abortErr = new Error('Aborted');
    abortErr.name = 'AbortError';
    throw abortErr;
  }

  const byteLength = arrayBuffer ? (arrayBuffer.byteLength || arrayBuffer.length || 0) : 0;
  if (byteLength > 200 * 1024 * 1024) {
    const err = new Error(`PDF file size is ${Math.round(byteLength / 1024 / 1024)} MB (limit 200 MB)`);
    err.code = 'too_big';
    err.byteLength = byteLength;
    err.numPages = 0;
    throw err;
  }

  const pdfjs = await ensurePdfJsLoaded();

  const data = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);

  const loadingTask = pdfjs.getDocument({
    data,
    isEvalSupported: false,
    enableScripting: false,
    useSystemFonts: true,
    standardFontDataUrl: undefined
  });

  let pdfDoc = null;
  try {
    pdfDoc = await loadingTask.promise;
    const pageCount = pdfDoc.numPages;

    if (pageCount > 1000) {
      const err = new Error(`PDF has ${pageCount} pages (limit 1000)`);
      err.code = 'too_big';
      err.numPages = pageCount;
      err.byteLength = byteLength;
      throw err;
    }

    const pagesRaw = [];
    let removedLinesCount = 0;

    // First pass: extract lines page by page, immediately cleaning up raw pdf page
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      if (signal && signal.aborted) {
        const abortErr = new Error('Aborted');
        abortErr.name = 'AbortError';
        throw abortErr;
      }

      const delayMs = (typeof window !== 'undefined' && window.__pdfPageDelayMs) || 0;
      if (delayMs > 0) {
        await new Promise(r => setTimeout(r, delayMs));
      }

      if (signal && signal.aborted) {
        const abortErr = new Error('Aborted');
        abortErr.name = 'AbortError';
        throw abortErr;
      }

      if (typeof onProgress === 'function') {
        try {
          onProgress({ current: pageNum, total: pageCount });
        } catch (_) {}
      }

      const page = await pdfDoc.getPage(pageNum);
      let textContent = null;
      let pageViewHeight = 792;
      try {
        if (page.view && page.view.length >= 4) {
          pageViewHeight = Math.abs(page.view[3] - page.view[1]) || 792;
        }
        textContent = await page.getTextContent();
      } finally {
        page.cleanup();
      }

      const items = (textContent.items || []).map(it => {
        const tr = it.transform || [1, 0, 0, 1, 0, 0];
        const fs = Math.max(1, Math.hypot(tr[0], tr[1]) || it.height || 12);
        return {
          str: normalizeLigatures(it.str || ''),
          x: tr[4],
          y: tr[5],
          width: it.width || 0,
          fontSize: fs,
          hasEOL: !!it.hasEOL
        };
      }).filter(it => it.str.length > 0);

      // Group items into lines by baseline y with tolerance ~0.4 * fontSize
      const lines = [];
      // Sort items by y descending (top to bottom)
      const sortedByY = [...items].sort((a, b) => b.y - a.y);

      for (const item of sortedByY) {
        let line = null;
        for (const l of lines) {
          if (Math.abs(l.y - item.y) <= 0.4 * Math.max(l.fontSize, item.fontSize)) {
            line = l;
            break;
          }
        }
        if (line) {
          line.items.push(item);
          line.fontSize = Math.max(line.fontSize, item.fontSize);
        } else {
          lines.push({
            y: item.y,
            fontSize: item.fontSize,
            items: [item]
          });
        }
      }

      // Sort lines top to bottom (y descending in PDF coordinate space)
      lines.sort((a, b) => b.y - a.y);

      // Process items on each line
      for (const line of lines) {
        // RTL check: if line contains Arabic/Persian characters, keep pdf.js order; otherwise sort LTR
        const hasRtl = line.items.some(it => /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(it.str));
        if (!hasRtl) {
          line.items.sort((a, b) => a.x - b.x);
        }

        let lineText = '';
        for (let i = 0; i < line.items.length; i++) {
          const cur = line.items[i];
          if (i === 0) {
            lineText = cur.str;
          } else {
            const prev = line.items[i - 1];
            const gap = cur.x - (prev.x + prev.width);
            const needsSpace = !lineText.endsWith(' ') && !cur.str.startsWith(' ') && (gap > 0.2 * prev.fontSize || cur.str.length > 0);
            if (needsSpace) {
              lineText += ' ' + cur.str;
            } else {
              lineText += cur.str;
            }
          }
        }

        line.text = lineText.replace(/[\t ]+/g, ' ').trim();
        line.x = line.items[0]?.x || 0;
        const last = line.items[line.items.length - 1];
        line.endX = (last?.x || 0) + (last?.width || 0);
        line.width = Math.max(0, line.endX - line.x);
      }

      // Filter empty lines
      const validLines = lines.filter(l => l.text.length > 0);

      pagesRaw.push({
        n: pageNum,
        height: pageViewHeight,
        lines: validLines
      });
    }

    // Identify running headers and footers across pages:
    // lines that repeat at the same position (top or bottom 8% of page)
    // on at least half of the pages and at least 3 pages.
    const topCandidates = new Map(); // text -> Set of page numbers
    const bottomCandidates = new Map();

    for (const pg of pagesRaw) {
      const topBoundary = pg.height * 0.92;
      const bottomBoundary = pg.height * 0.08;

      for (const l of pg.lines) {
        const norm = l.text.toLowerCase().trim();
        if (l.y >= topBoundary) {
          if (!topCandidates.has(norm)) topCandidates.set(norm, new Set());
          topCandidates.get(norm).add(pg.n);
        }
        if (l.y <= bottomBoundary) {
          if (!bottomCandidates.has(norm)) bottomCandidates.set(norm, new Set());
          bottomCandidates.get(norm).add(pg.n);
        }
      }
    }

    const minPagesForRepeat = Math.max(3, Math.ceil(pageCount / 2));
    const runningTopHeaders = new Set();
    const runningBottomFooters = new Set();

    if (pageCount >= 3) {
      for (const [norm, set] of topCandidates.entries()) {
        if (set.size >= minPagesForRepeat) runningTopHeaders.add(norm);
      }
      for (const [norm, set] of bottomCandidates.entries()) {
        if (set.size >= minPagesForRepeat) runningBottomFooters.add(norm);
      }
    }

    // Filter out running headers/footers and standalone page numbers
    for (const pg of pagesRaw) {
      const filteredLines = [];
      const topBoundary = pg.height * 0.92;
      const bottomBoundary = pg.height * 0.08;

      for (const l of pg.lines) {
        const norm = l.text.toLowerCase().trim();

        // 1. Standalone page number check
        if (isStandalonePageNumber(l.text)) {
          removedLinesCount++;
          continue;
        }

        // 2. Running header/footer check
        if (l.y >= topBoundary && runningTopHeaders.has(norm)) {
          removedLinesCount++;
          continue;
        }
        if (l.y <= bottomBoundary && runningBottomFooters.has(norm)) {
          removedLinesCount++;
          continue;
        }

        filteredLines.push(l);
      }
      pg.lines = filteredLines;
    }

    // Collect all font sizes across all body lines to find median document body font size
    const allLineSizes = [];
    for (const pg of pagesRaw) {
      for (const l of pg.lines) {
        allLineSizes.push(l.fontSize);
      }
    }
    const medianDocBodySize = calcMedian(allLineSizes) || 12;

    // Build paragraphs for each page
    const finalPages = [];
    for (const pg of pagesRaw) {
      const lines = pg.lines;
      if (lines.length === 0) {
        finalPages.push({ n: pg.n, paragraphs: [] });
        continue;
      }

      // Calculate page statistics for paragraph boundaries
      const lineGaps = [];
      for (let i = 0; i < lines.length - 1; i++) {
        const g = lines[i].y - lines[i + 1].y;
        if (g > 0) lineGaps.push(g);
      }
      const medianLineGap = calcMedian(lineGaps) || (1.2 * (lines[0].fontSize || 12));
      const pageTextWidth = Math.max(...lines.map(l => l.width), 1);
      const typicalLineLength = calcMedian(lines.map(l => l.text.length)) || 60;

      const rawParas = [];
      let currentParaLines = [lines[0]];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const prevLine = lines[i - 1];
        const firstLine = currentParaLines[0];

        const gap = prevLine.y - line.y;
        const gapCondition = gap > 1.4 * medianLineGap;

        const indent = line.x - firstLine.x;
        const indentCondition = indent > 1.5 * line.fontSize && prevLine.width < (pageTextWidth * 0.9);

        const prevEndsWithPunct = /[.!?؟।]$/.test(prevLine.text.trim());
        const punctCondition = prevEndsWithPunct && (prevLine.text.length < typicalLineLength * 0.8);

        if (gapCondition || indentCondition || punctCondition) {
          rawParas.push(currentParaLines);
          currentParaLines = [line];
        } else {
          currentParaLines.push(line);
        }
      }
      if (currentParaLines.length > 0) {
        rawParas.push(currentParaLines);
      }

      // Reconstruct paragraph text with de-hyphenation
      const pageParagraphs = [];
      for (const pLines of rawParas) {
        let pText = '';
        let totalSize = 0;

        for (let i = 0; i < pLines.length; i++) {
          const cur = pLines[i];
          totalSize += cur.fontSize;

          if (i === 0) {
            pText = cur.text;
          } else {
            if (pText.endsWith('-')) {
              const nextFirstChar = cur.text.charAt(0);
              // De-hyphenate: if line ends with '-' and next line starts with lowercase letter, join without hyphen
              // Keep hyphen when next line starts uppercase or digit
              const isLower = /^\p{Ll}/u.test(nextFirstChar);
              if (isLower) {
                pText = pText.slice(0, -1) + cur.text;
              } else {
                pText = pText + ' ' + cur.text;
              }
            } else {
              pText = pText + ' ' + cur.text;
            }
          }
        }

        pText = pText.replace(/[\t ]+/g, ' ').trim();
        if (pText.length === 0) continue;

        const avgSize = Math.round(totalSize / pLines.length);

        // Heading rule: font size >= 1.25 x document's median body size, short (< 120 chars), no sentence-ending period
        const isHeading = (avgSize >= 1.25 * medianDocBodySize) &&
                          (pText.length < 120) &&
                          (!/[.!?؟।]$/.test(pText));

        pageParagraphs.push({
          text: pText,
          size: avgSize,
          heading: isHeading
        });
      }

      finalPages.push({
        n: pg.n,
        paragraphs: pageParagraphs
      });
    }

    // Compute final document stats
    const paragraphCount = finalPages.reduce((acc, p) => acc + p.paragraphs.length, 0);
    const charCount = finalPages.reduce((acc, p) => acc + p.paragraphs.reduce((c, item) => c + item.text.length, 0), 0);
    const avgCharsPerPage = pageCount > 0 ? Math.round(charCount / pageCount) : 0;

    const stats = {
      pageCount,
      charCount,
      paragraphCount,
      avgCharsPerPage,
      removedLines: removedLinesCount
    };

    if (charCount === 0 || avgCharsPerPage < 20) {
      const noTextErr = new Error('This PDF has no selectable text');
      noTextErr.code = 'no_text';
      noTextErr.stats = stats;
      throw noTextErr;
    }

    return {
      pages: finalPages,
      stats
    };
  } finally {
    try {
      await loadingTask.destroy();
    } catch (_) {}
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ensurePdfJsLoaded,
    extractPdfParagraphs,
    mapPdfError,
    isStandalonePageNumber,
    normalizeLigatures
  };
}
