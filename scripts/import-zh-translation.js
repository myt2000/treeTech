#!/usr/bin/env node
// Merges TSV translation batches (data/i18n/zh-batches/*.tsv) into data/i18n/zh.json.
// TSV columns: id, name_zh, description_zh. Never edits canonical era JSON.
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'i18n', 'zh.json');
const BATCH_DIR = path.join(DATA_DIR, 'i18n', 'zh-batches');

function canonicalIds() {
  const taxonomy = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'taxonomy.json'), 'utf8'));
  const ids = new Set();
  for (const era of taxonomy.eras) {
    const chunk = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${era.toLowerCase()}.json`), 'utf8'));
    for (const item of chunk) ids.add(item.id);
  }
  return ids;
}

function parseBatch(file) {
  const content = fs.readFileSync(file, 'utf8');
  const rows = [];
  const errors = [];
  content.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    const columns = line.split('\t');
    if (columns.length !== 3) {
      errors.push(`${path.basename(file)}:${index + 1} expected 3 tab-separated columns, found ${columns.length}`);
      return;
    }
    const [id, name, description] = columns.map(column => column.trim());
    if (!id || !name || !description) {
      errors.push(`${path.basename(file)}:${index + 1} all of id / name_zh / description_zh must be non-empty`);
      return;
    }
    if (id !== id.toLowerCase()) {
      errors.push(`${path.basename(file)}:${index + 1} id must be lowercase: ${id}`);
      return;
    }
    rows.push({ id, name, description });
  });
  return { rows, errors };
}

function run() {
  const knownIds = canonicalIds();
  const merged = fs.existsSync(OUTPUT_FILE)
    ? JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'))
    : {};
  const errors = [];
  let added = 0;
  let updated = 0;
  const seenInRun = new Set();

  if (!fs.existsSync(BATCH_DIR)) {
    console.error(`No batch directory at ${path.relative(ROOT_DIR, BATCH_DIR)}; nothing to import.`);
    process.exit(1);
  }

  const batchFiles = fs.readdirSync(BATCH_DIR).filter(file => file.endsWith('.tsv')).sort();
  for (const file of batchFiles) {
    const { rows, errors: parseErrors } = parseBatch(path.join(BATCH_DIR, file));
    errors.push(...parseErrors);
    for (const row of rows) {
      if (seenInRun.has(row.id)) {
        errors.push(`${file}: duplicate id ${row.id}`);
        continue;
      }
      seenInRun.add(row.id);
      if (!knownIds.has(row.id)) {
        errors.push(`${file}: unknown technology id ${row.id}`);
        continue;
      }
      if (merged[row.id]) updated += 1;
      else added += 1;
      merged[row.id] = { name: row.name, description: row.description };
    }
  }

  if (errors.length) {
    for (const error of errors) console.error(`ERROR ${error}`);
    console.error(`Import aborted; ${errors.length} issue(s) found. No file written.`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  const sorted = {};
  for (const id of Object.keys(merged).sort()) sorted[id] = merged[id];
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(sorted, null, 2)}\n`);

  const total = Object.keys(sorted).length;
  console.log(`Imported ${added} new + ${updated} updated translations from ${batchFiles.length} batch file(s).`);
  console.log(`data/i18n/zh.json now covers ${total} technology ids.`);
}

if (require.main === module) {
  run();
}

module.exports = { parseBatch };
