'use strict';
/** Helpers to check that DOCX / PPTX / XLSX files are structurally sound. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const JSZip = require('jszip');
const { XMLValidator, XMLParser } = require('fast-xml-parser');

/** Open the ZIP and check every .xml / .rels part is well-formed XML. Returns { zip, parts }. */
async function openOffice(bytes) {
  const zip = await JSZip.loadAsync(bytes);
  const parts = {};
  const problems = [];
  for (const name of Object.keys(zip.files)) {
    if (zip.files[name].dir || !/\.(xml|rels)$/i.test(name)) continue;
    const xml = await zip.file(name).async('string');
    parts[name] = xml;
    const ok = XMLValidator.validate(xml);
    if (ok !== true) problems.push(`${name}: ${ok.err.msg} (line ${ok.err.line})`);
  }
  if (!parts['[Content_Types].xml']) problems.push('[Content_Types].xml is missing');
  return { zip, parts, problems };
}

/** Parse XML keeping element order, for structure checks. */
const orderedParser = new XMLParser({ preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: '@' });

/** Walk every element; calls fn(name, childrenNames, node). */
function walk(xml, fn) {
  const visit = nodes => {
    for (const n of nodes) {
      const name = Object.keys(n).find(k => k !== ':@' && k !== '#text');
      if (!name) continue;
      const kids = Array.isArray(n[name]) ? n[name] : [];
      fn(name, kids.map(k => Object.keys(k).find(x => x !== ':@' && x !== '#text')).filter(Boolean), n);
      visit(kids);
    }
  };
  visit(orderedParser.parse(xml));
}

/**
 * Element order defined by the Office Open XML schema (ECMA-376 part 1,
 * CT_PPr and CT_RPr). Word documents must list child elements in this order.
 */
const SCHEMA_ORDER = {
  'w:pPr': ['w:pStyle', 'w:keepNext', 'w:keepLines', 'w:pageBreakBefore', 'w:framePr', 'w:widowControl', 'w:numPr', 'w:suppressLineNumbers', 'w:pBdr', 'w:shd', 'w:tabs', 'w:suppressAutoHyphens', 'w:kinsoku', 'w:wordWrap', 'w:overflowPunct', 'w:topLinePunct', 'w:autoSpaceDE', 'w:autoSpaceDN', 'w:bidi', 'w:adjustRightInd', 'w:snapToGrid', 'w:spacing', 'w:ind', 'w:contextualSpacing', 'w:mirrorIndents', 'w:suppressOverlap', 'w:jc', 'w:textDirection', 'w:textAlignment', 'w:textboxTightWrap', 'w:outlineLvl', 'w:divId', 'w:cnfStyle', 'w:rPr', 'w:sectPr', 'w:pPrChange'],
  'w:rPr': ['w:rStyle', 'w:rFonts', 'w:b', 'w:bCs', 'w:i', 'w:iCs', 'w:caps', 'w:smallCaps', 'w:strike', 'w:dstrike', 'w:outline', 'w:shadow', 'w:emboss', 'w:imprint', 'w:noProof', 'w:snapToGrid', 'w:vanish', 'w:webHidden', 'w:color', 'w:spacing', 'w:w', 'w:kern', 'w:position', 'w:sz', 'w:szCs', 'w:highlight', 'w:u', 'w:effect', 'w:bdr', 'w:shd', 'w:fitText', 'w:vertAlign', 'w:rtl', 'w:cs', 'w:em', 'w:lang', 'w:eastAsianLayout', 'w:specVanish', 'w:oMath', 'w:rPrChange']
};

/** List elements whose children are out of the schema order. */
function schemaOrderProblems(xml, partName) {
  const out = [];
  walk(xml, (name, kids) => {
    const order = SCHEMA_ORDER[name];
    if (!order) return;
    let last = -1, lastName = '';
    for (const k of kids) {
      const i = order.indexOf(k);
      if (i < 0) continue;
      if (i < last) { out.push(`${partName}: <${name}> has <${k}> after <${lastName}>`); break; }
      last = i; lastName = k;
    }
  });
  return out;
}

/** Text of each element with the given tag, joining its <x:t> descendants. */
function textsOf(xml, tag, textTag) {
  const re = new RegExp(`<${tag}[ >][\\s\\S]*?</${tag}>`, 'g');
  const tRe = new RegExp(`<${textTag}(?: [^>]*)?>([^<]*)</${textTag}>`, 'g');
  return (xml.match(re) || []).map(block => [...block.matchAll(tRe)].map(m => m[1]).join(''));
}
const count = (xml, tag) => (xml.match(new RegExp(`<${tag}[ >/]`, 'g')) || []).length;

/** Is LibreOffice installed? */
function findSoffice() {
  for (const c of ['soffice', 'libreoffice', 'C:\\Program Files\\LibreOffice\\program\\soffice.exe']) {
    const r = spawnSync(c, ['--version'], { encoding: 'utf8', timeout: 30000 });
    if (r.status === 0) return c;
  }
  return null;
}

/** Ask LibreOffice to open the file and convert it to PDF. Returns { ok, detail }. */
function libreOfficeOpens(soffice, bytes, ext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'makan-lo-'));
  const input = path.join(dir, 'check.' + ext);
  fs.writeFileSync(input, bytes);
  try {
    execFileSync(soffice, [`-env:UserInstallation=file://${dir.replace(/\\/g, '/')}/profile`, '--headless', '--convert-to', 'pdf', '--outdir', dir, input], { timeout: 120000, stdio: 'pipe' });
    const pdf = path.join(dir, 'check.pdf');
    const ok = fs.existsSync(pdf) && fs.statSync(pdf).size > 500;
    return { ok, detail: ok ? `LibreOffice converted it to a ${fs.statSync(pdf).size}-byte PDF` : 'LibreOffice produced no PDF' };
  } catch (e) {
    return { ok: false, detail: 'LibreOffice failed: ' + String(e.stderr || e.message).slice(0, 300) };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = { openOffice, schemaOrderProblems, textsOf, count, findSoffice, libreOfficeOpens };
