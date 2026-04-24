import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const LOCALES = ['en', 'es', 'fr', 'ar'];
const BASELINE = 'en';
const TRUNCATE = 20;

const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');

function loadLocale(locale) {
  const path = join(root, 'src', 'locales', locale, 'translation.json');
  try {
    const raw = readFileSync(path, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[checkLocaleKeys] Failed to load ${path}: ${err.message}`);
    process.exit(2);
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function collectLeaves(node, prefix, out) {
  if (!isPlainObject(node)) {
    out.set(prefix, node);
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) {
      collectLeaves(value, path, out);
    } else {
      out.set(path, value);
    }
  }
}

function flatten(obj) {
  const leaves = new Map();
  collectLeaves(obj, '', leaves);
  return leaves;
}

function shapeAt(obj, dotPath) {
  const parts = dotPath.split('.');
  let cur = obj;
  for (const p of parts) {
    if (!isPlainObject(cur)) return 'missing';
    if (!(p in cur)) return 'missing';
    cur = cur[p];
  }
  return isPlainObject(cur) ? 'object' : 'leaf';
}

function diffLocale(enLeaves, enRoot, otherLeaves, otherRoot) {
  const missing = [];
  const orphan = [];
  const shape = [];

  for (const key of enLeaves.keys()) {
    if (!otherLeaves.has(key)) {
      if (shapeAt(otherRoot, key) === 'object') {
        shape.push(key);
      } else {
        missing.push(key);
      }
    }
  }
  for (const key of otherLeaves.keys()) {
    if (!enLeaves.has(key)) {
      if (shapeAt(enRoot, key) === 'object') {
        if (!shape.includes(key)) shape.push(key);
      } else {
        orphan.push(key);
      }
    }
  }

  missing.sort();
  orphan.sort();
  shape.sort();
  return { missing, orphan, shape };
}

function truncateList(list) {
  if (list.length <= TRUNCATE) return { shown: list, more: 0 };
  return { shown: list.slice(0, TRUNCATE), more: list.length - TRUNCATE };
}

function printHuman(total, drift) {
  for (const locale of LOCALES.filter((l) => l !== BASELINE)) {
    const d = drift[locale];
    console.log(`\n[${locale}] missing: ${d.missing.length}  orphan: ${d.orphan.length}  shape: ${d.shape.length}`);
    for (const [label, list] of [
      ['missing (in en, not in ' + locale + ')', d.missing],
      ['orphan  (in ' + locale + ', not in en)', d.orphan],
      ['shape   (leaf/object mismatch)', d.shape],
    ]) {
      if (list.length === 0) continue;
      const { shown, more } = truncateList(list);
      console.log(`  ${label}:`);
      for (const k of shown) console.log(`    - ${k}`);
      if (more > 0) console.log(`    ... and ${more} more`);
    }
  }
  console.log(`\nBaseline en leaf keys: ${total}`);
}

const roots = Object.fromEntries(LOCALES.map((l) => [l, loadLocale(l)]));
const leaves = Object.fromEntries(LOCALES.map((l) => [l, flatten(roots[l])]));
const enLeaves = leaves[BASELINE];
const enRoot = roots[BASELINE];

const drift = {};
let ok = true;
for (const locale of LOCALES.filter((l) => l !== BASELINE)) {
  const d = diffLocale(enLeaves, enRoot, leaves[locale], roots[locale]);
  drift[locale] = d;
  if (d.missing.length || d.orphan.length || d.shape.length) ok = false;
}

if (asJson) {
  const payload = { ok, total: enLeaves.size, drift };
  console.log(JSON.stringify(payload, null, 2));
  process.exit(ok ? 0 : 1);
}

if (ok) {
  console.log(`Locale keys OK: ${enLeaves.size} leaf keys across ${LOCALES.join('/')}`);
  process.exit(0);
}

console.log('Locale key drift detected (baseline: en)');
printHuman(enLeaves.size, drift);
process.exit(1);
