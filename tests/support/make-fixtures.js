'use strict';
/**
 * Creates the sample files the tests upload, in tests/.generated/.
 * They are rebuilt on every run so no binary test files live in git.
 */
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '..', '.generated');

const SRT = [
  '1', '00:00:01,000 --> 00:00:03,500', 'Hello there.', '',
  '2', '00:00:04,000 --> 00:00:06,250', 'Where are you going?', '',
  '3', '00:00:07,000 --> 00:00:09,000', '- I am going home.', '- Wait for me!', '',
  '4', '00:00:10,120 --> 00:00:12,900', 'This line will be edited by hand.', '',
  '5', '01:02:03,004 --> 01:02:05,006', 'The last line, after one hour.', ''
].join('\r\n');

const TXT = 'The first line of plain text.\nThe second line.\n\nA line after an empty line.\n';

const MD = [
  '# Project title',
  '',
  'A paragraph with **bold** words and a [link](https://example.com/page).',
  '',
  '- First list item',
  '- Second list item',
  '',
  '```js',
  'const keepMe = "code is not translated";',
  '```',
  '',
  '> A quoted sentence.',
  ''
].join('\n');

const JSON_DOC = {
  title: 'Welcome to the application',
  count: 42,
  enabled: true,
  menu: { open: 'Open file', save: 'Save file', items: ['Cut text', 'Copy text', 7] },
  empty: ''
};

const CSV = 'name,description,price\r\nApple,"Fresh, red and sweet",1.25\r\nBread,Whole wheat loaf,2.50\r\n';

function wav(seconds, sampleRate, fill) {
  const n = Math.floor(seconds * sampleRate);
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(fill(i / sampleRate) * 32767))), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

/** 0.5 s quiet, 1.6 s of a loud warbling tone ("speech"), 2 s quiet; Chromium loops it. */
function speechLikeWav() {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) - 0.5;
  return wav(4.1, 48000, t => {
    if (t < 0.5 || t > 2.1) return rnd() * 0.002;
    const env = 0.35 * (0.6 + 0.4 * Math.sin(2 * Math.PI * 4 * t));
    return env * Math.sin(2 * Math.PI * (180 + 60 * Math.sin(2 * Math.PI * 3 * t)) * t) + rnd() * 0.02;
  });
}

async function makeDocx(file) {
  const d = require('docx');
  const doc = new d.Document({
    footnotes: { 1: { children: [new d.Paragraph('An original footnote.')] } },
    sections: [{
      children: [
        new d.Paragraph({ text: 'Quarterly report', heading: d.HeadingLevel.HEADING_1 }),
        // A paragraph whose text is split over several formatted runs, with
        // paragraph-mark formatting (w:pPr/w:rPr), as Word itself writes it.
        new d.Paragraph({
          run: { bold: true },
          children: [new d.TextRun('The system uses a '), new d.TextRun({ text: 'cache', bold: true }), new d.TextRun(' to speed up reads.'), new d.FootnoteReferenceRun(1)]
        }),
        new d.Paragraph('A second plain paragraph of text.'),
        new d.Table({
          rows: [
            new d.TableRow({ children: [new d.TableCell({ children: [new d.Paragraph('Name')] }), new d.TableCell({ children: [new d.Paragraph('Value')] })] }),
            new d.TableRow({ children: [new d.TableCell({ children: [new d.Paragraph('Speed')] }), new d.TableCell({ children: [new d.Paragraph('Very fast')] })] })
          ]
        })
      ]
    }]
  });
  fs.writeFileSync(file, await d.Packer.toBuffer(doc));
}

async function makePptx(file) {
  const PptxGenJS = require('pptxgenjs');
  const pptx = new PptxGenJS();
  const s1 = pptx.addSlide();
  s1.addText('Welcome slide title', { x: 0.5, y: 0.5, w: 8, h: 1, fontSize: 32 });
  s1.addText('A short subtitle under the title', { x: 0.5, y: 1.6, w: 8, h: 0.8, fontSize: 18 });
  const s2 = pptx.addSlide();
  s2.addText([{ text: 'First bullet point', options: { bullet: true, breakLine: true } }, { text: 'Second bullet point', options: { bullet: true } }], { x: 0.5, y: 0.5, w: 8, h: 2 });
  const buf = await pptx.write({ outputType: 'nodebuffer' });
  fs.writeFileSync(file, buf);
}

async function makeXlsx(file) {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  // Excel always writes a <sheetView> for each sheet; give the sample one too.
  const a = wb.addWorksheet('Prices', { views: [{ state: 'normal' }] });
  a.addRow(['Product', 'Price', 'Double']);
  a.addRow(['Green apple', 3, { formula: 'B2*2', result: 6 }]);
  a.addRow(['Fresh bread', 5, { formula: 'B3*2', result: 10 }]);
  const b = wb.addWorksheet('Notes', { views: [{ state: 'normal' }] });
  b.addRow(['Remember to check the totals']);
  await wb.xlsx.writeFile(file);
}

async function makeFixtures() {
  fs.mkdirSync(OUT, { recursive: true });
  const files = {
    srt: path.join(OUT, 'sample.srt'),
    txt: path.join(OUT, 'sample.txt'),
    md: path.join(OUT, 'sample.md'),
    json: path.join(OUT, 'sample.json'),
    csv: path.join(OUT, 'sample.csv'),
    docx: path.join(OUT, 'sample.docx'),
    pptx: path.join(OUT, 'sample.pptx'),
    xlsx: path.join(OUT, 'sample.xlsx'),
    wav: path.join(OUT, 'speech-like.wav')
  };
  fs.writeFileSync(files.srt, SRT);
  fs.writeFileSync(files.txt, TXT);
  fs.writeFileSync(files.md, MD);
  fs.writeFileSync(files.json, JSON.stringify(JSON_DOC, null, 2));
  fs.writeFileSync(files.csv, CSV);
  fs.writeFileSync(files.wav, speechLikeWav());
  await makeDocx(files.docx);
  await makePptx(files.pptx);
  await makeXlsx(files.xlsx);
  return files;
}

module.exports = { makeFixtures, OUT, JSON_DOC, SRT, TXT, MD, CSV };

if (require.main === module) makeFixtures().then(f => console.log(f));
