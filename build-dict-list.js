/**
 * Writes dict/packs.json: the small list of dictionary packs the app and the extension offer.
 * Every folder dict/<from>-<to>/ with at least one pack-N/pack.json is a language pair; the pack with the most
 * entries is used (the smaller one on a tie). Add a language pair by adding its folder, then run `npm run build`.
 *
 *   node build-dict-list.js
 */
const fs = require('fs');
const path = require('path');

const DICT_DIR = path.join(__dirname, 'dict');

function buildList(root = DICT_DIR) {
  const packs = [];
  if (!fs.existsSync(root)) return packs;
  for (const name of fs.readdirSync(root).sort()) {
    const m = /^([a-z]{2,3})-([a-z]{2,3})$/.exec(name);
    const dir = path.join(root, name);
    if (!m || !fs.statSync(dir).isDirectory()) continue;
    let best = null;
    for (const sub of fs.readdirSync(dir)) {
      const pj = path.join(dir, sub, 'pack.json');
      if (!/^pack-\d+$/.test(sub) || !fs.existsSync(pj)) continue;
      const meta = JSON.parse(fs.readFileSync(pj, 'utf8'));
      const entries = meta.entry_count || 0;
      if (!best || entries > best.entries || (entries === best.entries && (meta.requested_size || 0) < best.size)) {
        best = { entries, size: meta.requested_size || 0, sub, meta };
      }
    }
    if (!best) continue;
    packs.push({
      id: name, from: m[1], to: m[2],
      entries: best.entries, phrases: best.meta.phrase_count || 0,
      bytes: best.meta.compressed_bytes || 0,
      dir: `${name}/${best.sub}`,
      credits: fs.existsSync(path.join(dir, 'credits.txt')) ? `${name}/credits.txt` : null
    });
  }
  return packs;
}

function writeList() {
  const list = { format: 'makan-dictionary-list', packs: buildList() };
  fs.writeFileSync(path.join(DICT_DIR, 'packs.json'), JSON.stringify(list, null, 2) + '\n');
  return list;
}

if (require.main === module) {
  const l = writeList();
  console.log(`📚 dict/packs.json: ${l.packs.map(p => p.id).join(', ') || '(no packs)'}`);
}
module.exports = { buildList, writeList };
