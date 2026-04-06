/**
 * Authenticated client for the landlord/properties API endpoints.
 *
 * Provides a short-lived in-memory cache (default TTL: 30 s) so the portal
 * UI avoids hitting the database on every render without keeping stale data
 * around for long.
 *
 * Cache is keyed by base URL so it works correctly in dev environments that
 * point to multiple API instances simultaneously.
 *
 * Write operations (create, update, delete) always go straight to the API and
 * invalidate the list cache on success so the next read is fresh.
 */

const DEFAULT_TTL_MS = 30_000;

/** @type {Map<string, { data: unknown, expiresAt: number }>} */
const _cache = new Map();

function cacheKey(baseUrl) {
  return `landlord-properties:${baseUrl}`;
}

function cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _cache.delete(key);
    return null;
  }
  return entry.data;
}

function cacheSet(key, data, ttlMs = DEFAULT_TTL_MS) {
  _cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function invalidatePropertiesCache(baseUrl) {
  _cache.delete(cacheKey(baseUrl));
}

/** Exposed for tests only. */
export function _clearAllCaches() {
  _cache.clear();
}

// ---------------------------------------------------------------------------
// HTTP helpers (mirrors portalApiClient.js pattern)
// ---------------------------------------------------------------------------

function buildUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

async function readErrorBody(res) {
  let code = '';
  try {
    const payload = await res.json();
    if (payload && typeof payload.error === 'string') {
      code = payload.error;
    }
  } catch {
    // best-effort
  }
  return code;
}

function apiError(status, code) {
  const message = code ? `HTTP ${status} (${code})` : `HTTP ${status}`;
  return { status, code, message };
}

function authHeaders(accessToken) {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
}

function jsonAuthHeaders(accessToken) {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
}

// ---------------------------------------------------------------------------
// GET /api/landlord/properties  (with cache)
// ---------------------------------------------------------------------------

/**
 * List all non-deleted properties visible to the authenticated user.
 * Results are cached for `ttlMs` milliseconds (default 30 s) per base URL.
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {{ ttlMs?: number, signal?: AbortSignal }} [opts]
 * @returns {Promise<object[]>}  Array of PropertyRowFull records
 */
export async function listPropertiesApi(baseUrl, accessToken, opts = {}) {
  const key = cacheKey(baseUrl);
  const cached = cacheGet(key);
  if (cached) return cached;

  const res = await fetch(buildUrl(baseUrl, '/api/landlord/properties'), {
    method: 'GET',
    headers: authHeaders(accessToken),
    credentials: 'omit',
    ...(opts.signal ? { signal: opts.signal } : {}),
  });
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  const payload = await res.json();
  const properties = Array.isArray(payload.properties) ? payload.properties : [];
  cacheSet(key, properties, opts.ttlMs ?? DEFAULT_TTL_MS);
  return properties;
}

// ---------------------------------------------------------------------------
// POST /api/landlord/properties
// ---------------------------------------------------------------------------

/**
 * Create a new property. Invalidates the list cache on success.
 *
 * The API accepts the DB column names (street, city, state, zip, …) plus an
 * optional `metadata.apply` sub-object for the fields the Apply page needs.
 *
 * This helper accepts the flat form shape used by the portal UI and converts
 * it to the expected API body.
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {object} data  Flat portal form record
 * @returns {Promise<object>}  Created PropertyRowFull record
 */
export async function createPropertyApi(baseUrl, accessToken, data) {
  const body = formDataToApiBody(data);
  const res = await fetch(buildUrl(baseUrl, '/api/landlord/properties'), {
    method: 'POST',
    headers: jsonAuthHeaders(accessToken),
    credentials: 'omit',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  const payload = await res.json();
  invalidatePropertiesCache(baseUrl);
  return payload.property;
}

// ---------------------------------------------------------------------------
// PATCH /api/landlord/properties/:id
// ---------------------------------------------------------------------------

/**
 * Update an existing property. Invalidates the list cache on success.
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} id  Property UUID
 * @param {object} data  Flat portal form record (same shape as createPropertyApi)
 * @returns {Promise<object>}  Updated PropertyRowFull record
 */
export async function updatePropertyApi(baseUrl, accessToken, id, data) {
  const body = formDataToApiBody(data);
  const res = await fetch(
    buildUrl(baseUrl, `/api/landlord/properties/${encodeURIComponent(id)}`),
    {
      method: 'PATCH',
      headers: jsonAuthHeaders(accessToken),
      credentials: 'omit',
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  const payload = await res.json();
  invalidatePropertiesCache(baseUrl);
  return payload.property;
}

// ---------------------------------------------------------------------------
// DELETE /api/landlord/properties/:id
// ---------------------------------------------------------------------------

/**
 * Soft-delete a property. Invalidates the list cache on success.
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} id  Property UUID
 * @returns {Promise<void>}
 */
export async function deletePropertyApi(baseUrl, accessToken, id) {
  const res = await fetch(
    buildUrl(baseUrl, `/api/landlord/properties/${encodeURIComponent(id)}`),
    {
      method: 'DELETE',
      headers: authHeaders(accessToken),
      credentials: 'omit',
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  invalidatePropertiesCache(baseUrl);
}

// ---------------------------------------------------------------------------
// Shape conversion: portal UI form → API body
// ---------------------------------------------------------------------------

/**
 * Convert the flat portal UI form/record shape into the body the API expects.
 *
 * The API expects DB-level fields for the address (street / city / state / zip)
 * plus a `metadata.apply` block for the Apply-page presentation fields.
 *
 * We derive street/city/state/zip by splitting the flat `cityStateZip` and
 * `addressLine` values that the form uses; the API also accepts them within
 * metadata for the Apply mapper.
 *
 * @param {object} data
 * @returns {object}
 */
export function formDataToApiBody(data) {
  // Split "City, TX 77001" → city / state / zip as best-effort; the DB
  // stores structured fields while the UI uses the combined label.
  const { city, state, zip } = parseCityStateZip(data.cityStateZip ?? '');

  return {
    street: data.addressLine?.trim() || '',
    city,
    state,
    zip,
    har_listing_id: data.harId?.trim() || null,
    landlord_user_id: data.landlordUserId?.trim() || undefined,
    apply_visible: Boolean(data.showOnApplyPage),
    metadata: {
      apply: {
        addressLine: data.addressLine?.trim() || '',
        cityStateZip: data.cityStateZip?.trim() || '',
        monthlyRentLabel: data.monthlyRentLabel?.trim() || '',
        photoUrl: data.photoUrl?.trim() || '',
        harListingUrl: data.harListingUrl?.trim() || '',
        applyUrl: data.applyUrl?.trim() || '',
        detailLines: Array.isArray(data.detailLines) ? data.detailLines : [],
      },
    },
  };
}

/**
 * Parse "City, State Zip" or "City, ST 12345" into structured parts.
 * Falls back gracefully — the backend validates required fields.
 *
 * @param {string} raw
 * @returns {{ city: string, state: string, zip: string }}
 */
function parseCityStateZip(raw) {
  const s = raw.trim();
  if (!s) return { city: '', state: '', zip: '' };

  // Match "City, ST 12345-6789" or "City, State 12345"
  const match = s.match(/^(.+?),\s*([A-Za-z ]+?)\s+(\d{5}(?:-\d{4})?)$/);
  if (match) {
    return {
      city: match[1].trim(),
      state: match[2].trim(),
      zip: match[3].trim(),
    };
  }

  // Match "City, ST" (no zip)
  const noZip = s.match(/^(.+?),\s*([A-Za-z ]+)$/);
  if (noZip) {
    return { city: noZip[1].trim(), state: noZip[2].trim(), zip: '' };
  }

  // Last resort: put everything in city
  return { city: s, state: '', zip: '' };
}

// ---------------------------------------------------------------------------
// Shape conversion: API response → portal UI display record
// ---------------------------------------------------------------------------

/**
 * Convert a PropertyRowFull record from the API into the flat display shape
 * used by the portal grid / form.  Mirrors the inverse of formDataToApiBody.
 *
 * @param {object} row  PropertyRowFull from the API
 * @returns {object}
 */
export function apiPropertyToDisplay(row) {
  const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  const apply = meta.apply && typeof meta.apply === 'object' ? meta.apply : {};

  const addressLine =
    (typeof apply.addressLine === 'string' && apply.addressLine.trim()) ||
    row.street ||
    '';

  const cityStateZip =
    (typeof apply.cityStateZip === 'string' && apply.cityStateZip.trim()) ||
    [row.city, row.state].filter(Boolean).join(', ') + (row.zip ? ` ${row.zip}` : '');

  return {
    id: row.id,
    harId: row.har_listing_id ?? '',
    addressLine,
    cityStateZip,
    monthlyRentLabel: typeof apply.monthlyRentLabel === 'string' ? apply.monthlyRentLabel : '',
    photoUrl: typeof apply.photoUrl === 'string' ? apply.photoUrl : '',
    harListingUrl: typeof apply.harListingUrl === 'string' ? apply.harListingUrl : '',
    applyUrl: typeof apply.applyUrl === 'string' ? apply.applyUrl : '',
    detailLines: Array.isArray(apply.detailLines) ? apply.detailLines : [],
    showOnApplyPage: Boolean(row.apply_visible),
    landlordName:
      (typeof row.landlord_name === 'string' && row.landlord_name.trim()) ||
      [row.landlord_first_name, row.landlord_last_name]
        .map((part) => (typeof part === 'string' ? part.trim() : ''))
        .filter(Boolean)
        .join(' ') ||
      '',
    landlordUserId: typeof row.landlord_user_id === 'string' ? row.landlord_user_id : '',
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  };
}
