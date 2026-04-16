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
 * @param {string} monthlyRentLabel
 * @returns {number}
 */
function monthlyRentSortValue(monthlyRentLabel) {
  if (typeof monthlyRentLabel !== 'string') return Number.POSITIVE_INFINITY;
  const numericMatches = monthlyRentLabel.match(/\d[\d,]*(?:\.\d{1,2})?/g);
  if (!numericMatches || numericMatches.length === 0) return Number.POSITIVE_INFINITY;
  const values = numericMatches
    .map((value) => Number.parseFloat(value.replace(/,/g, '')))
    .filter((value) => Number.isFinite(value));
  if (values.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...values);
}

/**
 * @param {ApplyPropertyTile[]} tiles
 * @returns {ApplyPropertyTile[]}
 */
function sortApplyPropertiesByRentAscending(tiles) {
  return tiles
    .map((tile, index) => ({ tile, index }))
    .sort((left, right) => {
      const priceDelta = monthlyRentSortValue(left.tile.monthlyRentLabel)
        - monthlyRentSortValue(right.tile.monthlyRentLabel);
      if (priceDelta !== 0) return priceDelta;
      return left.index - right.index;
    })
    .map(({ tile }) => tile);
}

export const APPLY_PROPERTIES_SESSION_KEY = 'carwoods:applyProperties:v1';
const APPLY_PROPERTIES_SESSION_MS = 30 * 60 * 1000;

function readApplyPropertiesSession(root) {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(APPLY_PROPERTIES_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed
      || parsed.root !== root
      || typeof parsed.fetchedAt !== 'number'
      || Date.now() - parsed.fetchedAt > APPLY_PROPERTIES_SESSION_MS
      || !Array.isArray(parsed.tiles)
    ) {
      return null;
    }
    return parsed.tiles.map(normalizeApplyPropertyTile);
  } catch {
    return null;
  }
}

function writeApplyPropertiesSession(root, tiles) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(
      APPLY_PROPERTIES_SESSION_KEY,
      JSON.stringify({ root, fetchedAt: Date.now(), tiles })
    );
  } catch {
    // quota / private mode
  }
}

/**
 * @param {string} baseUrl
 * @returns {Promise<ApplyPropertyTile[]>}
 */
export async function fetchPublicApplyProperties(baseUrl) {
  const root = baseUrl.replace(/\/$/, '');
  const cached = readApplyPropertiesSession(root);
  if (cached) {
    return sortApplyPropertiesByRentAscending(cached);
  }
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
  const tiles = sortApplyPropertiesByRentAscending(list.map(normalizeApplyPropertyTile));
  writeApplyPropertiesSession(root, tiles);
  return tiles;
}
