/**
 * HAR listing ID / preview response parsing for the landlord portal admin UI.
 */

function decodeHtmlEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
}

/**
 * Extract listing tile from HAR preview JSON (handles occasional proxy/wrapper shapes).
 */
export function listingFromHarPreviewPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.listing && typeof payload.listing === 'object') return payload.listing;
  const nested = payload.body ?? payload.data ?? payload.result;
  if (nested && typeof nested === 'object' && nested.listing && typeof nested.listing === 'object') {
    return nested.listing;
  }
  if (typeof nested === 'string') {
    try {
      return listingFromHarPreviewPayload(JSON.parse(nested));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Extract the numeric HAR listing ID from either a full homedetail URL or a bare
 * numeric string.  e.g.:
 *   "https://www.har.com/homedetail/6314-bonnie-chase-ln-katy-tx-77449/8469293" → "8469293"
 *   "8469293" → "8469293"
 * Returns null when the input looks like a URL but contains no trailing numeric segment.
 */
export function parseHarInput(raw) {
  let trimmed = raw.trim().replace(/^\uFEFF/, '');
  trimmed = decodeHtmlEntities(trimmed);

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      const segments = u.pathname.split('/').filter(Boolean);
      const lastNumeric = [...segments].reverse().find((seg) => /^\d+$/.test(seg));
      if (lastNumeric) return lastNumeric;
    } catch {
      /* fall through to regex */
    }
    const m = trimmed.match(/\/(\d+)\/?(?:[?#].*)?$/);
    return m ? m[1] : null;
  }

  if (/^\d+$/.test(trimmed)) return trimmed;
  const embedded = trimmed.match(/\b(\d{5,12})\b/);
  if (embedded) return embedded[1];
  return trimmed || null;
}
