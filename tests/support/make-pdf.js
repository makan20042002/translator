'use strict';
// MAKAN Translate — Dependency-free generator of valid text PDFs.
// Creates valid PDF 1.4 documents with Helvetica text, xref table, and optional drawing.

const fs = require('fs');
const path = require('path');

function escapePdfString(str) {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function buildPdf(options = {}) {
  const {
    pages = null,
    pageCount = 1,
    repeatedHeader = null,
    repeatedFooter = null,
    noText = false,
    rectangles = false
  } = options;

  let pageList = [];
  if (Array.isArray(pages) && pages.length > 0) {
    pageList = pages;
  } else {
    for (let i = 1; i <= pageCount; i++) {
      pageList.push({
        lines: [
          { text: `Page ${i} content`, size: 12, x: 72, y: 700 }
        ]
      });
    }
  }

  const numPages = pageList.length;

  const catalogObjNum = 1;
  const pagesObjNum = 2;
  const fontF1ObjNum = 3;
  const fontF2ObjNum = 4;

  const pageObjNums = [];
  for (let i = 0; i < numPages; i++) {
    pageObjNums.push(5 + i * 2);
  }

  const objects = [];

  // Obj 1: Catalog
  objects.push({
    num: catalogObjNum,
    content: `<< /Type /Catalog /Pages ${pagesObjNum} 0 R >>`
  });

  // Obj 2: Pages root
  const kidsStr = pageObjNums.map(n => `${n} 0 R`).join(' ');
  objects.push({
    num: pagesObjNum,
    content: `<< /Type /Pages /Kids [${kidsStr}] /Count ${numPages} >>`
  });

  // Obj 3: Font F1 (Helvetica Regular)
  objects.push({
    num: fontF1ObjNum,
    content: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`
  });

  // Obj 4: Font F2 (Helvetica Bold)
  objects.push({
    num: fontF2ObjNum,
    content: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`
  });

  for (let i = 0; i < numPages; i++) {
    const pageData = pageList[i] || {};
    const pageObjNum = 5 + i * 2;
    const contentObjNum = pageObjNum + 1;

    // Page object
    objects.push({
      num: pageObjNum,
      content: `<< /Type /Page /Parent ${pagesObjNum} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontF1ObjNum} 0 R /F2 ${fontF2ObjNum} 0 R >> >> /Contents ${contentObjNum} 0 R >>`
    });

    // Content stream
    let streamBody = '';
    if (noText) {
      // Rectangle drawing with 0 text
      streamBody += '0 0 0 rg\n100 100 200 200 re f\n';
    } else {
      if (rectangles) {
        streamBody += '0.8 0.8 0.8 rg\n50 50 512 692 re f\n';
      }

      const linesToRender = [];

      // Repeated header (top 8%, y >= 792 * 0.92 = 728.64; e.g. 750)
      if (repeatedHeader) {
        linesToRender.push({
          text: repeatedHeader,
          size: 10,
          font: 'F1',
          x: 72,
          y: 750
        });
      }

      // Page body lines
      if (Array.isArray(pageData.lines)) {
        for (const l of pageData.lines) {
          if (typeof l === 'string') {
            linesToRender.push({ text: l, size: 12, font: 'F1', x: 72, y: 700 });
          } else {
            linesToRender.push({
              text: l.text || '',
              size: l.size || 12,
              font: l.font || (l.size >= 16 ? 'F2' : 'F1'),
              x: l.x != null ? l.x : 72,
              y: l.y != null ? l.y : 700
            });
          }
        }
      }

      // Page numbers (bottom 8%, e.g. y = 36)
      if (pageData.pageNumber != null) {
        linesToRender.push({
          text: String(pageData.pageNumber),
          size: 10,
          font: 'F1',
          x: 290,
          y: 36
        });
      }

      // Repeated footer (bottom 8%, y <= 792 * 0.08 = 63.36; e.g. 40)
      if (repeatedFooter) {
        linesToRender.push({
          text: repeatedFooter,
          size: 10,
          font: 'F1',
          x: 72,
          y: 40
        });
      }

      // Render text commands
      for (const item of linesToRender) {
        const escaped = escapePdfString(item.text);
        streamBody += `BT\n/${item.font} ${item.size} Tf\n1 0 0 1 ${item.x} ${item.y} Tm\n(${escaped}) Tj\nET\n`;
      }
    }

    const streamBuffer = Buffer.from(streamBody, 'utf8');
    objects.push({
      num: contentObjNum,
      content: `<< /Length ${streamBuffer.length} >>\nstream\n${streamBody}\nendstream`
    });
  }

  const parts = [];
  let currentOffset = 0;

  const headerStr = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const headerBuf = Buffer.from(headerStr, 'binary');
  parts.push(headerBuf);
  currentOffset += headerBuf.length;

  const totalObjects = objects.length;
  const offsets = new Array(totalObjects + 1).fill(0);

  objects.sort((a, b) => a.num - b.num);

  for (const obj of objects) {
    offsets[obj.num] = currentOffset;
    const objHeader = `${obj.num} 0 obj\n`;
    const objFooter = `\nendobj\n`;
    const objBuf = Buffer.concat([
      Buffer.from(objHeader, 'utf8'),
      Buffer.from(obj.content, 'utf8'),
      Buffer.from(objFooter, 'utf8')
    ]);
    parts.push(objBuf);
    currentOffset += objBuf.length;
  }

  const startXref = currentOffset;
  let xrefStr = `xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= totalObjects; i++) {
    const off = String(offsets[i]).padStart(10, '0');
    xrefStr += `${off} 00000 n \n`;
  }
  const trailerStr = `trailer\n<< /Size ${totalObjects + 1} /Root ${catalogObjNum} 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

  parts.push(Buffer.from(xrefStr, 'utf8'));
  parts.push(Buffer.from(trailerStr, 'utf8'));

  return Buffer.concat(parts);
}

function writePdfSync(filePath, options = {}) {
  const buf = buildPdf(options);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buf);
  return filePath;
}

module.exports = {
  buildPdf,
  writePdfSync
};
