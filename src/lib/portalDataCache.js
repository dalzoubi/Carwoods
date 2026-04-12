/**
 * In-memory GET cache for portal API: TTL short-circuit, in-flight deduplication,
 * and If-None-Match / 304 support when the API sends ETag.
 *
 * Cache keys documented for operators:
 * - reqlist:{base}|{emailHint}|{path}     — GET requests list (portal or landlord path)
 * - landlords:{base}|{emailHint}|{extra} — GET admin landlords (extra = include flag)
 * - elsa:{base}|{emailHint}|{requestId?}
 * - notifications:{base}|{emailHint}|{limit}
 * - reqmsgs:{base}|{emailHint}|{requestId} — message thread poll
 * - tenant:{base}|{emailHint}|{tenantId}  — GET /api/landlord/tenants/:id (leases payload)
 */

/** @typedef {{ data: unknown, etag: string, expiresAt: number }} PortalCacheEntry */

const store = new Map();
const inFlight = new Map();

/** Clears cached GET entries (call between tests to avoid cross-test leakage). */
export function clearPortalDataCache() {
  store.clear();
  inFlight.clear();
}

export const PORTAL_CACHE_PREFIX = {
  REQUESTS_LIST: 'reqlist:',
  LANDLORDS: 'landlords:',
  ELSA: 'elsa:',
  NOTIFICATIONS: 'notifications:',
  MESSAGES: 'reqmsgs:',
  TENANT_DETAIL: 'tenant:',
};

export const PORTAL_CACHE_TTL_MS = {
  REQUESTS_LIST: 45_000,
  LANDLORDS: 90_000,
  ELSA: 90_000,
  /** Metadata TTL after a successful 200 (always-revalidate mode still hits network) */
  NOTIFICATIONS: 5 * 60_000,
  MESSAGES: 5 * 60_000,
  TENANT_DETAIL: 60_000,
};

/**
 * @param {string} prefix
 * @param {string} baseUrl
 * @param {string} [emailHint]
 * @param {string} [extra]
 */
export function buildPortalCacheKey(prefix, baseUrl, emailHint, extra = '') {
  const root = String(baseUrl ?? '').replace(/\/$/, '');
  const hint = String(emailHint ?? '').trim();
  return `${prefix}${root}|${hint}|${extra}`;
}

export function invalidatePortalCacheByPrefix(prefix) {
  for (const k of [...store.keys()]) {
    if (k.startsWith(prefix)) store.delete(k);
  }
  for (const k of [...inFlight.keys()]) {
    if (k.startsWith(prefix)) inFlight.delete(k);
  }
}

/** @param {string} cacheKey */
export function deletePortalCacheKey(cacheKey) {
  store.delete(cacheKey);
  inFlight.delete(cacheKey);
}

/**
 * @param {string} baseUrl
 * @param {string} [emailHint]
 */
export function invalidateRequestsListCacheForUser(baseUrl, emailHint) {
  invalidatePortalCacheByPrefix(buildPortalCacheKey(PORTAL_CACHE_PREFIX.REQUESTS_LIST, baseUrl, emailHint, ''));
}

/**
 * @param {string} baseUrl
 */
export function invalidateLandlordsCache(baseUrl) {
  invalidatePortalCacheByPrefix(buildPortalCacheKey(PORTAL_CACHE_PREFIX.LANDLORDS, baseUrl, '', ''));
}

/**
 * @param {string} baseUrl
 * @param {string} [emailHint]
 */
export function invalidateElsaCacheForUser(baseUrl, emailHint) {
  invalidatePortalCacheByPrefix(buildPortalCacheKey(PORTAL_CACHE_PREFIX.ELSA, baseUrl, emailHint, ''));
}

/**
 * @param {string} baseUrl
 * @param {string} [emailHint]
 */
export function invalidateNotificationsCacheForUser(baseUrl, emailHint) {
  invalidatePortalCacheByPrefix(buildPortalCacheKey(PORTAL_CACHE_PREFIX.NOTIFICATIONS, baseUrl, emailHint, ''));
}

/**
 * @param {string} baseUrl
 * @param {string} [emailHint]
 * @param {string} requestId
 */
export function invalidateMessagesCacheForRequest(baseUrl, emailHint, requestId) {
  deletePortalCacheKey(
    buildPortalCacheKey(PORTAL_CACHE_PREFIX.MESSAGES, baseUrl, emailHint, String(requestId ?? ''))
  );
}

/**
 * @param {string} baseUrl
 * @param {string} [emailHint]
 * @param {string} tenantId
 */
export function invalidateTenantDetailCache(baseUrl, emailHint, tenantId) {
  deletePortalCacheKey(
    buildPortalCacheKey(PORTAL_CACHE_PREFIX.TENANT_DETAIL, baseUrl, emailHint, String(tenantId ?? ''))
  );
}

/** When lease id is mutated without tenant id on hand, drop all cached tenant rows for this user. */
export function invalidateAllTenantDetailCachesForUser(baseUrl, emailHint) {
  invalidatePortalCacheByPrefix(buildPortalCacheKey(PORTAL_CACHE_PREFIX.TENANT_DETAIL, baseUrl, emailHint, ''));
}

function responseEtag(res) {
  try {
    const h = res.headers;
    if (!h || typeof h.get !== 'function') return '';
    return h.get('etag') || h.get('ETag') || '';
  } catch {
    return '';
  }
}

async function readErrorBodyFromResponse(res) {
  let code = '';
  try {
    const payload = await res.json();
    if (payload && typeof payload.error === 'string') {
      code = payload.error;
    }
  } catch {
    // ignore
  }
  return code;
}

function apiErrorFromResponse(status, code) {
  const message = code ? `HTTP ${status} (${code})` : `HTTP ${status}`;
  return { status, code, message };
}

/**
 * @param {object} opts
 * @param {string} opts.cacheKey
 * @param {number} opts.ttlMs
 * @param {'ttl'|'always'} opts.fetchMode  ttl = skip network while fresh; always = revalidate every call (304-friendly)
 * @param {string} opts.url
 * @param {() => Record<string, string>} opts.prepareHeaders  Base GET headers (Authorization, etc.)
 * @returns {Promise<unknown>}
 */
export async function portalCachedJsonGet({ cacheKey, ttlMs, fetchMode, url, prepareHeaders }) {
  const now = Date.now();
  let entry = store.get(cacheKey);

  if (fetchMode === 'ttl' && entry && entry.expiresAt > now) {
    return entry.data;
  }

  if (inFlight.has(cacheKey)) {
    return /** @type {Promise<unknown>} */ (inFlight.get(cacheKey));
  }

  const promise = (async () => {
    const ifNoneMatch = entry?.etag || undefined;
    const headers = { ...prepareHeaders() };
    if (ifNoneMatch) {
      headers['If-None-Match'] = ifNoneMatch;
    }

    const res = await fetch(url, {
      method: 'GET',
      headers,
      credentials: 'omit',
    });

    if (res.status === 304) {
      if (!entry) {
        const retryRes = await fetch(url, {
          method: 'GET',
          headers: { ...prepareHeaders() },
          credentials: 'omit',
        });
        if (!retryRes.ok) {
          const code = await readErrorBodyFromResponse(retryRes);
          throw apiErrorFromResponse(retryRes.status, code);
        }
        const data = await retryRes.json();
        const etag = responseEtag(retryRes);
        store.set(cacheKey, { data, etag, expiresAt: Date.now() + ttlMs });
        return data;
      }
      const nextExpires = Date.now() + ttlMs;
      store.set(cacheKey, { ...entry, expiresAt: nextExpires });
      return entry.data;
    }

    if (!res.ok) {
      const code = await readErrorBodyFromResponse(res);
      throw apiErrorFromResponse(res.status, code);
    }

    const data = await res.json();
    const etag = responseEtag(res);
    store.set(cacheKey, { data, etag, expiresAt: Date.now() + ttlMs });
    return data;
  })();

  inFlight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(cacheKey);
  }
}
