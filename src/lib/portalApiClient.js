/**
 * Typed portal API client.
 *
 * Pure async functions — no React imports, no stored state. Each function
 * accepts the API base URL and a pre-resolved Bearer access token directly,
 * so callers retain full control over token acquisition timing.
 *
 * On a non-2xx response every function throws a plain object:
 *   { status: number, code: string, message: string }
 * where `code` is the `error` field from the JSON body when present, and
 * `message` is the human-readable summary used for display.
 */

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
    // best-effort; keep empty code if body is not JSON
  }
  return code;
}

function apiError(status, code) {
  const message = code ? `HTTP ${status} (${code})` : `HTTP ${status}`;
  return { status, code, message };
}

function jsonHeaders(accessToken, emailHint) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
  if (emailHint) headers['X-Email-Hint'] = emailHint;
  return headers;
}

function getHeaders(accessToken, emailHint) {
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
  if (emailHint) headers['X-Email-Hint'] = emailHint;
  return headers;
}

// ---------------------------------------------------------------------------
// /api/portal/me
// ---------------------------------------------------------------------------

/**
 * GET /api/portal/me
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} [emailHint]  Value of X-Email-Hint header (omitted when falsy)
 * @param {AbortSignal} [signal]
 * @returns {Promise<object>}  Parsed JSON payload
 */
export async function fetchMe(baseUrl, accessToken, emailHint, signal) {
  const res = await fetch(buildUrl(baseUrl, '/api/portal/me'), {
    method: 'GET',
    headers: getHeaders(accessToken, emailHint),
    credentials: 'omit',
    ...(signal ? { signal } : {}),
  });
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// /api/portal/requests  and  /api/landlord/requests
// ---------------------------------------------------------------------------

/**
 * GET requests list.
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {{ path: string, emailHint?: string }} params
 *   path — full path including query string, e.g. '/api/portal/requests'
 * @returns {Promise<object>}
 */
export async function fetchRequests(baseUrl, accessToken, params) {
  const { path, emailHint } = params;
  const res = await fetch(buildUrl(baseUrl, path), {
    method: 'GET',
    headers: getHeaders(accessToken, emailHint),
    credentials: 'omit',
  });
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// /api/portal/requests/:id  and  /api/landlord/requests/:id
// ---------------------------------------------------------------------------

/**
 * GET request detail, messages, and attachments (three sequential GETs).
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {{ detailPath: string, messagesPath: string, attachmentsPath: string, emailHint?: string }} params
 * @returns {Promise<{ detail: object|null, messagesPayload: object, attachmentsPayload: object }>}
 */
export async function fetchRequestDetail(baseUrl, accessToken, params) {
  const { detailPath, messagesPath, attachmentsPath, emailHint } = params;
  const headers = getHeaders(accessToken, emailHint);

  const detailRes = await fetch(buildUrl(baseUrl, detailPath), {
    method: 'GET',
    headers,
    credentials: 'omit',
  });
  if (!detailRes.ok) {
    const code = await readErrorBody(detailRes);
    throw apiError(detailRes.status, code);
  }
  const detailPayload = await detailRes.json();

  const messagesRes = await fetch(buildUrl(baseUrl, messagesPath), {
    method: 'GET',
    headers,
    credentials: 'omit',
  });
  if (!messagesRes.ok) {
    const code = await readErrorBody(messagesRes);
    throw apiError(messagesRes.status, code);
  }
  const messagesPayload = await messagesRes.json();

  const attachmentsRes = await fetch(buildUrl(baseUrl, attachmentsPath), {
    method: 'GET',
    headers,
    credentials: 'omit',
  });
  if (!attachmentsRes.ok) {
    const code = await readErrorBody(attachmentsRes);
    throw apiError(attachmentsRes.status, code);
  }
  const attachmentsPayload = await attachmentsRes.json();

  return {
    detail: detailPayload?.request ?? null,
    messagesPayload,
    attachmentsPayload,
  };
}

// ---------------------------------------------------------------------------
// POST /api/portal/requests  (create maintenance request)
// ---------------------------------------------------------------------------

/**
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {{ emailHint?: string } & object} payload  Request body fields merged with emailHint
 * @returns {Promise<object>}
 */
export async function createRequest(baseUrl, accessToken, payload) {
  const { emailHint, ...body } = payload;
  const res = await fetch(buildUrl(baseUrl, '/api/portal/requests'), {
    method: 'POST',
    headers: jsonHeaders(accessToken, emailHint),
    credentials: 'omit',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// POST /api/portal/requests/:id/messages
// ---------------------------------------------------------------------------

/**
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} requestId
 * @param {{ emailHint?: string, body: string, is_internal: boolean }} payload
 * @returns {Promise<object>}
 */
export async function postMessage(baseUrl, accessToken, requestId, payload) {
  const { emailHint, ...body } = payload;
  const res = await fetch(
    buildUrl(baseUrl, `/api/portal/requests/${encodeURIComponent(requestId)}/messages`),
    {
      method: 'POST',
      headers: jsonHeaders(accessToken, emailHint),
      credentials: 'omit',
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// POST /api/portal/requests/:id/uploads/intent
// ---------------------------------------------------------------------------

/**
 * Request a pre-signed upload URL from the backend.
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} requestId
 * @param {{ emailHint?: string, filename: string, content_type: string, file_size_bytes: number }} payload
 * @returns {Promise<object>}  Contains upload.storage_path on success
 */
export async function requestUploadIntent(baseUrl, accessToken, requestId, payload) {
  const { emailHint, ...body } = payload;
  const res = await fetch(
    buildUrl(
      baseUrl,
      `/api/portal/requests/${encodeURIComponent(requestId)}/uploads/intent`
    ),
    {
      method: 'POST',
      headers: jsonHeaders(accessToken, emailHint),
      credentials: 'omit',
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// POST /api/portal/requests/:id/attachments/finalize
// ---------------------------------------------------------------------------

/**
 * Finalize an upload after the blob has been written to storage.
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} requestId
 * @param {{ emailHint?: string, storage_path: string, filename: string, content_type: string, file_size_bytes: number }} payload
 * @returns {Promise<object>}
 */
export async function finalizeUpload(baseUrl, accessToken, requestId, payload) {
  const { emailHint, ...body } = payload;
  const res = await fetch(
    buildUrl(
      baseUrl,
      `/api/portal/requests/${encodeURIComponent(requestId)}/attachments/finalize`
    ),
    {
      method: 'POST',
      headers: jsonHeaders(accessToken, emailHint),
      credentials: 'omit',
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// GET /api/portal/request-lookups
// ---------------------------------------------------------------------------

/**
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {{ emailHint?: string }} [params]
 * @returns {Promise<object>}
 */
export async function fetchRequestLookups(baseUrl, accessToken, params) {
  const emailHint = params?.emailHint;
  const res = await fetch(buildUrl(baseUrl, '/api/portal/request-lookups'), {
    method: 'GET',
    headers: getHeaders(accessToken, emailHint),
    credentials: 'omit',
  });
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// PATCH /api/portal/profile
// ---------------------------------------------------------------------------

/**
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {{ emailHint?: string, email: string, first_name: string, last_name: string, phone: string }} payload
 * @returns {Promise<object>}
 */
export async function patchProfile(baseUrl, accessToken, payload) {
  const { emailHint, ...body } = payload;
  const res = await fetch(buildUrl(baseUrl, '/api/portal/profile'), {
    method: 'PATCH',
    headers: jsonHeaders(accessToken, emailHint),
    credentials: 'omit',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// PATCH /api/portal/admin/landlords/:id
// PATCH /api/landlord/requests/:id
// ---------------------------------------------------------------------------

/**
 * Generic authenticated PATCH.  Used for both the landlord admin toggle and
 * the management request update where body shape differs per caller.
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} path          Full path (without base), e.g. '/api/portal/admin/landlords/123'
 * @param {{ emailHint?: string } & object} payload
 * @returns {Promise<object>}
 */
export async function patchResource(baseUrl, accessToken, path, payload) {
  const { emailHint, ...body } = payload;
  const res = await fetch(buildUrl(baseUrl, path), {
    method: 'PATCH',
    headers: jsonHeaders(accessToken, emailHint),
    credentials: 'omit',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// POST /api/portal/admin/landlords  (create landlord)
// ---------------------------------------------------------------------------

/**
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {{ emailHint?: string, email: string, first_name: string, last_name: string }} payload
 * @returns {Promise<object>}
 */
export async function createLandlord(baseUrl, accessToken, payload) {
  const { emailHint, ...body } = payload;
  const res = await fetch(buildUrl(baseUrl, '/api/portal/admin/landlords'), {
    method: 'POST',
    headers: jsonHeaders(accessToken, emailHint),
    credentials: 'omit',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// GET /api/portal/admin/landlords
// ---------------------------------------------------------------------------

/**
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {{ includeInactive?: boolean }} [params]
 * @returns {Promise<object>}
 */
export async function fetchLandlords(baseUrl, accessToken, params) {
  const path = params?.includeInactive
    ? '/api/portal/admin/landlords?include_inactive=true'
    : '/api/portal/admin/landlords';
  const res = await fetch(buildUrl(baseUrl, path), {
    method: 'GET',
    headers: getHeaders(accessToken),
    credentials: 'omit',
  });
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// POST /api/landlord/requests/:id/suggest-reply
// ---------------------------------------------------------------------------

/**
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} requestId
 * @param {{ emailHint?: string }} [params]
 * @returns {Promise<object>}
 */
export async function fetchSuggestReply(baseUrl, accessToken, requestId, params) {
  const emailHint = params?.emailHint;
  const res = await fetch(
    buildUrl(
      baseUrl,
      `/api/landlord/requests/${encodeURIComponent(requestId)}/suggest-reply`
    ),
    {
      method: 'POST',
      headers: jsonHeaders(accessToken, emailHint),
      credentials: 'omit',
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// GET /api/landlord/exports/requests.csv
// ---------------------------------------------------------------------------

/**
 * Fetches the CSV export and returns a Blob.
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {{ emailHint?: string }} [params]
 * @returns {Promise<Blob>}
 */
export async function fetchExportCsv(baseUrl, accessToken, params) {
  const emailHint = params?.emailHint;
  const headers = { Accept: 'text/csv', Authorization: `Bearer ${accessToken}` };
  if (emailHint) headers['X-Email-Hint'] = emailHint;
  const res = await fetch(buildUrl(baseUrl, '/api/landlord/exports/requests.csv'), {
    method: 'GET',
    headers,
    credentials: 'omit',
  });
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  return res.blob();
}

// ---------------------------------------------------------------------------
// GET /api/landlord/har-preview?id=:id
// ---------------------------------------------------------------------------

/**
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} harId
 * @returns {Promise<object>}  Raw JSON payload; callers apply listingFromHarPreviewPayload
 */
export async function fetchHarPreview(baseUrl, accessToken, harId) {
  const res = await fetch(
    buildUrl(baseUrl, `/api/landlord/har-preview?id=${encodeURIComponent(harId)}`),
    {
      headers: getHeaders(accessToken),
      credentials: 'omit',
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// GET /api/health  (unauthenticated)
// ---------------------------------------------------------------------------

/**
 * @param {string} baseUrl
 * @returns {Promise<object>}
 */
export async function fetchHealth(baseUrl) {
  const res = await fetch(buildUrl(baseUrl, '/api/health'), {
    headers: { Accept: 'application/json' },
    credentials: 'omit',
  });
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  return res.json();
}
