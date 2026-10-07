'use strict';
/**
 * A small PDF checker in plain JavaScript (no poppler needed, so it works on Windows too).
 * It reads the file the way a PDF viewer starts: header, "startxref", the cross-reference table
 * (every offset must land on the right "n 0 obj"), the page tree, and the pictures on the pages.
 */
function inspectPdf(buf) {
  const text = buf.toString('latin1');
  const problems = [];
  if (!text.startsWith('%PDF-')) problems.push('missing %PDF- header');
  if (!/%%EOF\s*$/.test(text)) problems.push('missing %%EOF at the end');
  const sx = /startxref\s+(\d+)\s+%%EOF\s*$/.exec(text);
  let objects = 0;
  if (!sx) problems.push('missing startxref');
  else {
    const at = +sx[1];
    const m = /^xref\s+0 (\d+)\s+/.exec(text.slice(at));
    if (!m) problems.push('startxref does not point at an xref table');
    else {
      objects = +m[1];
      const rows = text.slice(at + m[0].length).split('\n').slice(0, objects);
      rows.forEach((row, i) => {
        if (i === 0) return;
        const off = +row.slice(0, 10);
        if (!new RegExp('^' + i + ' 0 obj').test(text.slice(off, off + 20))) problems.push(`xref entry ${i} (offset ${off}) does not point at object ${i}`);
      });
    }
  }
  const pages = (text.match(/\/Type \/Page(?![s\w])/g) || []).length;
  const count = +((/\/Type \/Pages[^>]*\/Count (\d+)/.exec(text) || /\/Count (\d+)[^>]*\/Type \/Pages/.exec(text) || [])[1] || 0);
  if (count !== pages) problems.push(`page tree says ${count} pages but ${pages} page objects exist`);
  const mb = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(text);
  // Pictures: DCT (JPEG) streams. Each must start with FFD8 and end with FFD9.
  const images = [];
  const re = /\/Width (\d+) \/Height (\d+)[^>]*\/Filter \/DCTDecode \/Length (\d+) >>\nstream\n/g;
  let r;
  while ((r = re.exec(text))) {
    const start = r.index + r[0].length, len = +r[3], bytes = buf.subarray(start, start + len);
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[len - 2] !== 0xff || bytes[len - 1] !== 0xd9) problems.push('a page picture is not a complete JPEG');
    images.push({ width: +r[1], height: +r[2], bytes: len });
  }
  return { problems, pages, objects, mediaBox: mb ? [+mb[1], +mb[2]] : null, images };
}

module.exports = { inspectPdf };
