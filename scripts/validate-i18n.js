#!/usr/bin/env node
// Validates data/i18n/zh.json against the canonical dataset.
// Default mode reports coverage and only fails on structural errors; --strict
// additionally requires 100% id coverage (used before a bilingual release gate).
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'i18n', 'zh.json');

function canonicalItems() {
  const taxonomy = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'taxonomy.json'), 'utf8'));
  const items = [];
  for (const era of taxonomy.eras) {
    const chunk = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${era.toLowerCase()}.json`), 'utf8'));
    items.push(...chunk);
  }
  return items;
}

function run() {
  const strict = process.argv.includes('--strict');
  const items = canonicalItems();
  const knownIds = new Set(items.map(item => item.id));
  const errors = [];

  if (!fs.existsSync(OUTPUT_FILE)) {
    console.log('data/i18n/zh.json does not exist yet; Chinese coverage is 0%.');
    if (strict) process.exit(1);
    process.exit(0);
  }

  let translations;
  try {
    translations = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
  } catch (error) {
    console.error(`ERROR data/i18n/zh.json is not valid JSON: ${error.message}`);
    process.exit(1);
  }
  if (!translations || typeof translations !== 'object' || Array.isArray(translations)) {
    console.error('ERROR data/i18n/zh.json must contain a JSON object keyed by technology id.');
    process.exit(1);
  }

  const translatedIds = new Set();
  for (const [id, entry] of Object.entries(translations)) {
    if (!knownIds.has(id)) {
      errors.push(`unknown technology id: ${id}`);
      continue;
    }
    translatedIds.add(id);
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${id}: entry must be an object with name and description`);
      continue;
    }
    for (const field of ['name', 'description']) {
      if (typeof entry[field] !== 'string' || !entry[field].trim()) {
        errors.push(`${id}: ${field} must be a non-empty string`);
      } else if (/[\t\r\n]/.test(entry[field])) {
        errors.push(`${id}: ${field} must not contain tabs or newlines`);
      }
    }
    const extraKeys = Object.keys(entry).filter(key => key !== 'name' && key !== 'description');
    if (extraKeys.length) {
      errors.push(`${id}: unexpected keys ${extraKeys.join(', ')} (only name and description are allowed)`);
    }
  }

  const coverage = `${((translatedIds.size / knownIds.size) * 100).toFixed(1)}%`;
  console.log(`Chinese translations: ${translatedIds.size}/${knownIds.size} technology ids (${coverage}).`);
  for (const error of errors) console.error(`ERROR ${error}`);

  if (errors.length) process.exit(1);
  if (strict && translatedIds.size < knownIds.size) {
    console.error(`ERROR strict mode requires 100% coverage; missing ${knownIds.size - translatedIds.size} id(s).`);
    process.exit(1);
  }
  if (translatedIds.size < knownIds.size) {
    console.log('Coverage below 100% (warning only; run with --strict to enforce).');
  }
}

if (require.main === module) {
  run();
}

module.exports = {};
