/**
 * Fetches apply-visible listings from the portal public API.
 * Expected response: `{ properties: ApplyPropertyTile[] }` or a raw array.
 *
 * @typedef {object} ApplyPropertyTile
 * @property {string} id
 * @property {string} addressLine
 * @property {string} cityStateZip
 * @property {string} monthlyRentLabel
 * @property {string} photoUrl
 * @property {string} harListingUrl
 * @property {string} applyUrl
 * @property {string[]} detailLines
 */

const REQUIRED_KEYS = [
  'id',
  'addressLine',
  'cityStateZip',
  'monthlyRentLabel',
  'photoUrl',
  'harListingUrl',
  'applyUrl',
  'detailLines',
];

/**
 * @param {unknown} raw
 * @returns {ApplyPropertyTile}
 */
export function normalizeApplyPropertyTile(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid property entry');
  }
  const o = /** @type {Record<string, unknown>} */ (raw);
  for (const k of REQUIRED_KEYS) {
    if (!(k in o)) {
      throw new Error(`Missing property field: ${k}`);
    }
  }
  const detailLines = o.detailLines;
  if (!Array.isArray(detailLines) || !detailLines.every((x) => typeof x === 'string')) {
    throw new Error('detailLines must be an array of strings');
  }
  return {
    id: String(o.id),
    addressLine: String(o.addressLine),
    cityStateZip: String(o.cityStateZip),
    monthlyRentLabel: String(o.monthlyRentLabel),
    photoUrl: String(o.photoUrl),
    harListingUrl: String(o.harListingUrl),
    applyUrl: String(o.applyUrl),
    detailLines: detailLines.map(String),
  };
}

/**
 * @param {string} baseUrl
 * @returns {Promise<ApplyPropertyTile[]>}
 */
export async function fetchPublicApplyProperties(baseUrl) {
  const root = baseUrl.replace(/\/$/, '');
  const url = `${root}/api/public/apply-properties`;
  const res = await fetch(url, {
    credentials: 'omit',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`apply-properties: HTTP ${res.status}`);
  }
  const data = await res.json();
  const list = Array.isArray(data) ? data : data?.properties;
  if (!Array.isArray(list)) {
    throw new Error('apply-properties: expected array or { properties: [] }');
  }
  return list.map(normalizeApplyPropertyTile);
}

/**
 * @param {ApplyPropertyTile} p
 * @returns {Record<string, unknown>}
 */
function stableShape(p) {
  return {
    id: p.id,
    addressLine: p.addressLine,
    cityStateZip: p.cityStateZip,
    monthlyRentLabel: p.monthlyRentLabel,
    photoUrl: p.photoUrl,
    harListingUrl: p.harListingUrl,
    applyUrl: p.applyUrl,
    detailLines: [...p.detailLines].sort(),
  };
}

/**
 * Dev-only: compare API tiles to build-time generated tiles and log differences.
 * @param {ApplyPropertyTile[]} apiTiles
 * @param {ApplyPropertyTile[]} generatedTiles
 */
export function logDualSourceApplyMismatch(apiTiles, generatedTiles) {
  const apiMap = new Map(apiTiles.map((p) => [p.id, p]));
  const genMap = new Map(generatedTiles.map((p) => [p.id, p]));
  const ids = new Set([...apiMap.keys(), ...genMap.keys()]);
  /** @type {unknown[]} */
  const diffs = [];
  for (const id of ids) {
    const a = apiMap.get(id);
    const g = genMap.get(id);
    if (a && !g) diffs.push({ id, issue: 'only_in_api' });
    else if (!a && g) diffs.push({ id, issue: 'only_in_generated' });
    else if (a && g) {
      const sa = JSON.stringify(stableShape(a));
      const sg = JSON.stringify(stableShape(g));
      if (sa !== sg) {
        diffs.push({ id, issue: 'field_mismatch' });
      }
    }
  }
  if (diffs.length > 0) {
    // eslint-disable-next-line no-console -- intentional dev diagnostics
    console.warn('[apply-properties] Dual-source compare (dev): differences vs generated file', diffs);
  }
}
