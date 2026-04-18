/**
 * Typed portal API client.
 *
 * Pure async functions — no React imports, no stored state. Each function
 * accepts the API base URL and a pre-resolved Bearer access token directly,
 * so callers retain full control over token acquisition timing.
 *
 * On a non-2xx response every function throws a plain object:
 *   { status: number, code: string, message: string }
 * where `code` is the sanitized `error` field from the JSON body when present.
 * `message` intentionally excludes backend codes so it is safe for UI fallback text.
 */

import {
  portalCachedJsonGet,
  buildPortalCacheKey,
  PORTAL_CACHE_PREFIX,
  PORTAL_CACHE_TTL_MS,
  invalidateRequestsListCacheForUser,
  invalidateLandlordsCache,
  invalidateElsaCacheForUser,
  invalidateNotificationsCacheForUser,
  invalidateMessagesCacheForRequest,
  invalidateTenantDetailCache,
  invalidateAllTenantDetailCachesForUser,
} from './portalDataCache.js';

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

function apiError(status, code, details) {
  const message =
    status === 0
      ? 'Network error'
      : `HTTP ${status}`;
  return details ? { status, code, message, details } : { status, code, message };
}

/** Browser blocked the response or the host was unreachable (no HTTP status). */
function wrapFetchFailure(err, info) {
  const msg = err instanceof Error ? err.message : String(err);
  const code =
    err instanceof TypeError || /failed to fetch/i.test(msg)
      ? 'fetch_failed_cors_or_network'
      : 'fetch_threw';
  return apiError(0, code, { cause: msg, ...info });
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
  const url = buildUrl(baseUrl, path);
  const cacheKey = buildPortalCacheKey(PORTAL_CACHE_PREFIX.REQUESTS_LIST, baseUrl, emailHint, path);
  return portalCachedJsonGet({
    cacheKey,
    ttlMs: PORTAL_CACHE_TTL_MS.REQUESTS_LIST,
    fetchMode: 'ttl',
    url,
    prepareHeaders: () => getHeaders(accessToken, emailHint),
  });
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

  const [detailRes, messagesRes, attachmentsRes] = await Promise.all([
    fetch(buildUrl(baseUrl, detailPath), {
      method: 'GET',
      headers,
      credentials: 'omit',
    }),
    fetch(buildUrl(baseUrl, messagesPath), {
      method: 'GET',
      headers,
      credentials: 'omit',
    }),
    fetch(buildUrl(baseUrl, attachmentsPath), {
      method: 'GET',
      headers,
      credentials: 'omit',
    }),
  ]);

  if (!detailRes.ok) {
    const code = await readErrorBody(detailRes);
    throw apiError(detailRes.status, code);
  }
  const detailPayload = await detailRes.json();

  if (!messagesRes.ok) {
    const code = await readErrorBody(messagesRes);
    throw apiError(messagesRes.status, code);
  }
  const messagesPayload = await messagesRes.json();

  if (!attachmentsRes.ok) {
    const code = await readErrorBody(attachmentsRes);
    throw apiError(attachmentsRes.status, code);
  }
  const attachmentsPayload = await attachmentsRes.json();

  return {
    detail: detailPayload?.request ?? null,
    subscriptionFeatures: detailPayload?.subscription_features ?? null,
    messagesPayload,
    attachmentsPayload,
  };
}

/**
 * GET request audit events (admin-only).
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {{ requestId: string, emailHint?: string }} params
 * @returns {Promise<object>}
 */
export async function fetchRequestAudit(baseUrl, accessToken, params) {
  const { requestId, emailHint } = params;
  const res = await fetch(
    buildUrl(baseUrl, `/api/landlord/requests/${encodeURIComponent(requestId)}/audit`),
    {
      method: 'GET',
      headers: getHeaders(accessToken, emailHint),
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
  const data = await res.json();
  invalidateRequestsListCacheForUser(baseUrl, emailHint);
  return data;
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
  const data = await res.json();
  invalidateMessagesCacheForRequest(baseUrl, emailHint, requestId);
  invalidateRequestsListCacheForUser(baseUrl, emailHint);
  return data;
}

/**
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} requestId
 * @param {{ emailHint?: string }} [params]
 * @returns {Promise<object>}
 */
export async function fetchRequestMessages(baseUrl, accessToken, requestId, params) {
  const emailHint = params?.emailHint;
  const url = buildUrl(baseUrl, `/api/portal/requests/${encodeURIComponent(requestId)}/messages`);
  const cacheKey = buildPortalCacheKey(PORTAL_CACHE_PREFIX.MESSAGES, baseUrl, emailHint, requestId);
  return portalCachedJsonGet({
    cacheKey,
    ttlMs: PORTAL_CACHE_TTL_MS.MESSAGES,
    fetchMode: 'always',
    url,
    prepareHeaders: () => getHeaders(accessToken, emailHint),
  });
}

/**
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} requestId
 * @param {string} messageId
 * @param {{ emailHint?: string }} [params]
 * @returns {Promise<object>}
 */
export async function deleteRequestMessage(baseUrl, accessToken, requestId, messageId, params) {
  const emailHint = params?.emailHint;
  const res = await fetch(
    buildUrl(
      baseUrl,
      `/api/portal/requests/${encodeURIComponent(requestId)}/messages/${encodeURIComponent(messageId)}`
    ),
    {
      method: 'DELETE',
      headers: getHeaders(accessToken, emailHint),
      credentials: 'omit',
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  const data = await res.json();
  invalidateMessagesCacheForRequest(baseUrl, emailHint, requestId);
  return data;
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
// PATCH /api/portal/requests/:id  (tenant cancel)
// ---------------------------------------------------------------------------

/**
 * Cancel a maintenance request. Only allowed for tenants on requests in
 * NOT_STARTED, ACKNOWLEDGED, or WAITING_ON_TENANT status.
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} requestId
 * @param {{ emailHint?: string }} [params]
 * @returns {Promise<object>}
 */
export async function cancelRequest(baseUrl, accessToken, requestId, params) {
  const emailHint = params?.emailHint;
  const res = await fetch(
    buildUrl(baseUrl, `/api/portal/requests/${encodeURIComponent(requestId)}`),
    {
      method: 'PATCH',
      headers: jsonHeaders(accessToken, emailHint),
      credentials: 'omit',
      body: JSON.stringify({ action: 'cancel' }),
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  const data = await res.json();
  invalidateRequestsListCacheForUser(baseUrl, emailHint);
  return data;
}

// ---------------------------------------------------------------------------
// PUT <upload_url>  (direct Azure Blob Storage upload — no auth header)
// ---------------------------------------------------------------------------

/**
 * Upload a file's bytes directly to a pre-signed Azure Blob Storage URL.
 * The URL already contains a SAS token so no Authorization header is sent.
 *
 * @param {string} uploadUrl   Pre-signed Azure Blob SAS URL from requestUploadIntent
 * @param {File} file          The File object to upload
 * @param {(percent: number) => void} [onProgress] Optional upload progress callback
 * @returns {Promise<void>}
 */
export async function putBlobToStorage(uploadUrl, file, onProgress) {
  const uploadTarget = (() => {
    try {
      const parsed = new URL(uploadUrl);
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return 'invalid_upload_url';
    }
  })();
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob');
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return;
      const percent = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
      onProgress(percent);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(apiError(xhr.status || 500, 'blob_upload_failed', {
        uploadTarget,
        statusText: xhr.statusText || '',
        responseSnippet: String(xhr.responseText || '').slice(0, 300),
      }));
    };
    xhr.onerror = () => reject(apiError(500, 'blob_upload_failed', {
      uploadTarget,
      reason: 'network_error',
    }));
    xhr.send(file);
  });
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
  const data = await res.json();
  invalidateRequestsListCacheForUser(baseUrl, emailHint);
  return data;
}

/**
 * Delete an attachment by id.
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} requestId
 * @param {string} attachmentId
 * @param {{ emailHint?: string }} [params]
 * @returns {Promise<object>}
 */
export async function deleteRequestAttachment(baseUrl, accessToken, requestId, attachmentId, params) {
  const emailHint = params?.emailHint;
  const res = await fetch(
    buildUrl(
      baseUrl,
      `/api/portal/requests/${encodeURIComponent(requestId)}/attachments/${encodeURIComponent(attachmentId)}`
    ),
    {
      method: 'DELETE',
      headers: getHeaders(accessToken, emailHint),
      credentials: 'omit',
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  const delData = await res.json();
  invalidateRequestsListCacheForUser(baseUrl, emailHint);
  return delData;
}

/**
 * Generate an expiring share link for an attachment (management roles).
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} requestId
 * @param {string} attachmentId
 * @param {{ emailHint?: string }} [params]
 * @returns {Promise<object>}
 */
export async function createRequestAttachmentShareLink(
  baseUrl,
  accessToken,
  requestId,
  attachmentId,
  params
) {
  const emailHint = params?.emailHint;
  const res = await fetch(
    buildUrl(
      baseUrl,
      `/api/portal/requests/${encodeURIComponent(requestId)}/attachments/${encodeURIComponent(attachmentId)}/share`
    ),
    {
      method: 'POST',
      headers: getHeaders(accessToken, emailHint),
      credentials: 'omit',
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  return res.json();
}

/**
 * Download attachment bytes using signed portal link token (requires portal auth).
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} requestId
 * @param {string} attachmentId
 * @param {string} atoken
 * @param {{ emailHint?: string }} [params]
 * @returns {Promise<Blob>}
 */
export async function fetchRequestAttachmentFileWithToken(
  baseUrl,
  accessToken,
  requestId,
  attachmentId,
  atoken,
  params
) {
  const emailHint = params?.emailHint;
  const q = new URLSearchParams({ atoken });
  const res = await fetch(
    buildUrl(
      baseUrl,
      `/api/portal/requests/${encodeURIComponent(requestId)}/attachments/${encodeURIComponent(attachmentId)}/file?${q.toString()}`
    ),
    {
      method: 'GET',
      headers: getHeaders(accessToken, emailHint),
      credentials: 'omit',
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  return res.blob();
}

// ---------------------------------------------------------------------------
// GET /api/portal/request-lookups
// ---------------------------------------------------------------------------

/**
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {{ emailHint?: string, landlordId?: string }} [params]
 * @returns {Promise<object>}
 */
export async function fetchRequestLookups(baseUrl, accessToken, params) {
  const emailHint = params?.emailHint;
  const landlordId = typeof params?.landlordId === 'string' ? params.landlordId.trim() : '';
  const path =
    landlordId.length > 0
      ? `/api/portal/request-lookups?${new URLSearchParams({ landlord_id: landlordId }).toString()}`
      : '/api/portal/request-lookups';
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
// PATCH /api/portal/profile  (ui preferences only — thin wrapper)
// ---------------------------------------------------------------------------

/**
 * Persist UI language and/or color-scheme preference for the authenticated
 * user.  Only the supplied fields are sent; omitted fields are not cleared.
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {{ emailHint?: string, ui_language?: string|null, ui_color_scheme?: string|null, portal_tour_completed?: boolean }} payload
 * @returns {Promise<object>}
 */
export async function patchUiPreferences(baseUrl, accessToken, payload) {
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
// POST /api/portal/profile/photo/upload-intent
// POST /api/portal/profile/photo/finalize
// DELETE /api/portal/profile/photo
// ---------------------------------------------------------------------------

/**
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {{ emailHint?: string, content_type: string, file_size_bytes: number, filename?: string }} payload
 * @returns {Promise<{ upload_url: string, storage_path: string, expires_in_seconds: number }>}
 */
export async function postProfilePhotoUploadIntent(baseUrl, accessToken, payload) {
  const { emailHint, ...body } = payload;
  const res = await fetch(buildUrl(baseUrl, '/api/portal/profile/photo/upload-intent'), {
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

/**
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {{ emailHint?: string, storage_path: string, content_type: string, file_size_bytes: number }} payload
 * @returns {Promise<object>}
 */
export async function finalizeProfilePhoto(baseUrl, accessToken, payload) {
  const { emailHint, ...body } = payload;
  const res = await fetch(buildUrl(baseUrl, '/api/portal/profile/photo/finalize'), {
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

/**
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {{ emailHint?: string }} [params]
 * @returns {Promise<object>}
 */
export async function deleteProfilePhoto(baseUrl, accessToken, params) {
  const emailHint = params?.emailHint;
  const res = await fetch(buildUrl(baseUrl, '/api/portal/profile/photo'), {
    method: 'DELETE',
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
// GET /api/portal/notifications
// PATCH /api/portal/notifications/:id
// ---------------------------------------------------------------------------

/**
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {{ emailHint?: string, limit?: number }} [params]
 * @returns {Promise<object>}
 */
export async function fetchNotifications(baseUrl, accessToken, params) {
  const emailHint = params?.emailHint;
  const limitValue = Number.isFinite(Number(params?.limit)) ? Number(params.limit) : 20;
  const path = `/api/portal/notifications?limit=${encodeURIComponent(String(limitValue))}`;
  const url = buildUrl(baseUrl, path);
  const cacheKey = buildPortalCacheKey(
    PORTAL_CACHE_PREFIX.NOTIFICATIONS,
    baseUrl,
    emailHint,
    String(limitValue)
  );
  return portalCachedJsonGet({
    cacheKey,
    ttlMs: PORTAL_CACHE_TTL_MS.NOTIFICATIONS,
    fetchMode: 'always',
    url,
    prepareHeaders: () => getHeaders(accessToken, emailHint),
  });
}

/**
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} notificationId
 * @param {{ emailHint?: string }} [params]
 * @returns {Promise<object>}
 */
/**
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} notificationId
 * @param {{ read?: boolean, dismiss_from_tray?: boolean }} body
 * @param {{ emailHint?: string }} [params]
 * @returns {Promise<object>}
 */
export async function patchPortalNotification(baseUrl, accessToken, notificationId, body, params) {
  const emailHint = params?.emailHint;
  const read = body?.read === true;
  const dismissFromTray = body?.dismiss_from_tray === true;
  if (!read && !dismissFromTray) {
    throw apiError(400, 'invalid_client_body', 'read or dismiss_from_tray required');
  }
  const res = await fetch(
    buildUrl(baseUrl, `/api/portal/notifications/${encodeURIComponent(notificationId)}`),
    {
      method: 'PATCH',
      headers: jsonHeaders(accessToken, emailHint),
      credentials: 'omit',
      body: JSON.stringify({ read: read || undefined, dismiss_from_tray: dismissFromTray || undefined }),
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  const payload = await res.json();
  invalidateNotificationsCacheForUser(baseUrl, emailHint);
  return payload;
}

export async function markNotificationRead(baseUrl, accessToken, notificationId, params) {
  return patchPortalNotification(
    baseUrl,
    accessToken,
    notificationId,
    { read: true },
    params ?? {}
  );
}

/**
 * Persist bell/inbox dismiss (read + hidden from tray); syncs across devices.
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} notificationId
 * @param {{ emailHint?: string }} [params]
 * @returns {Promise<object>}
 */
export async function dismissPortalNotificationFromTray(baseUrl, accessToken, notificationId, params) {
  return patchPortalNotification(
    baseUrl,
    accessToken,
    notificationId,
    { dismiss_from_tray: true },
    params ?? {}
  );
}

/**
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {{ emailHint?: string }} [params]
 * @returns {Promise<object>}
 */
export async function markAllNotificationsRead(baseUrl, accessToken, params) {
  const emailHint = params?.emailHint;
  const res = await fetch(
    buildUrl(baseUrl, '/api/portal/notifications/mark-all-read'),
    {
      method: 'PATCH',
      headers: jsonHeaders(accessToken, emailHint),
      credentials: 'omit',
      body: JSON.stringify({}),
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  const allReadPayload = await res.json();
  invalidateNotificationsCacheForUser(baseUrl, emailHint);
  return allReadPayload;
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
  const patchData = await res.json();
  if (path.includes('/api/portal/admin/landlords')) {
    invalidateLandlordsCache(baseUrl);
  }
  if (path.includes('/api/landlord/requests/')) {
    invalidateRequestsListCacheForUser(baseUrl, emailHint);
    const m = path.match(/\/api\/landlord\/requests\/([^/]+)/);
    if (m?.[1]) {
      invalidateMessagesCacheForRequest(baseUrl, emailHint, m[1]);
    }
  }
  return patchData;
}

// ---------------------------------------------------------------------------
// POST /api/portal/admin/landlords  (create landlord)
// ---------------------------------------------------------------------------

/**
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {{ emailHint?: string, email: string, first_name: string, last_name: string, phone?: string|null, tier_id?: string }} payload
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
  const createdLandlord = await res.json();
  invalidateLandlordsCache(baseUrl);
  return createdLandlord;
}

// ---------------------------------------------------------------------------
// POST /api/portal/admin/notifications/test  (admin only)
// ---------------------------------------------------------------------------

/**
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {{ emailHint?: string, channel: 'in_app'|'email'|'sms', email?: string, phone?: string, title?: string, body?: string }} payload
 * @returns {Promise<object>}
 */
export async function postAdminNotificationTest(baseUrl, accessToken, payload) {
  const { emailHint, ...body } = payload;
  const res = await fetch(buildUrl(baseUrl, '/api/portal/admin/notifications/test'), {
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
  const url = buildUrl(baseUrl, path);
  // Bump `extra` when the list payload shape changes so TTL cache cannot serve stale rows.
  const cacheKey = buildPortalCacheKey(
    PORTAL_CACHE_PREFIX.LANDLORDS,
    baseUrl,
    '',
    params?.includeInactive ? 'inactive:v2' : 'active:v2'
  );
  return portalCachedJsonGet({
    cacheKey,
    ttlMs: PORTAL_CACHE_TTL_MS.LANDLORDS,
    fetchMode: 'ttl',
    url,
    prepareHeaders: () => getHeaders(accessToken),
  });
}

// ---------------------------------------------------------------------------
// GET /api/portal/admin/tiers
// ---------------------------------------------------------------------------

/**
 * @param {string} baseUrl
 * @param {string} accessToken
 * @returns {Promise<{ tiers: object[] }>}
 */
export async function fetchAdminSubscriptionTiers(baseUrl, accessToken) {
  const res = await fetch(buildUrl(baseUrl, '/api/portal/admin/tiers'), {
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
// GET/PATCH/DELETE /api/portal/admin/contact-requests
// ---------------------------------------------------------------------------

/**
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {{ status?: string, emailHint?: string }} [params]
 * @returns {Promise<{ contact_requests?: object[], total?: number, unread_count?: number }>}
 */
export async function fetchAdminContactRequests(baseUrl, accessToken, params) {
  const emailHint = params?.emailHint;
  const status = params?.status && params.status !== 'ALL' ? String(params.status) : '';
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(buildUrl(baseUrl, `/api/portal/admin/contact-requests${qs}`), {
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

/**
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {{ requestId: string, status: string, emailHint?: string }} params
 */
export async function patchAdminContactRequestStatus(baseUrl, accessToken, params) {
  const { requestId, status, emailHint } = params;
  const res = await fetch(
    buildUrl(baseUrl, `/api/portal/admin/contact-requests/${encodeURIComponent(requestId)}`),
    {
      method: 'PATCH',
      headers: jsonHeaders(accessToken, emailHint),
      body: JSON.stringify({ status }),
      credentials: 'omit',
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  return res.json();
}

/**
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {{ requestId: string, emailHint?: string }} params
 */
export async function deleteAdminContactRequest(baseUrl, accessToken, params) {
  const { requestId, emailHint } = params;
  const res = await fetch(
    buildUrl(baseUrl, `/api/portal/admin/contact-requests/${encodeURIComponent(requestId)}`),
    {
      method: 'DELETE',
      headers: getHeaders(accessToken, emailHint),
      credentials: 'omit',
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
}

// ---------------------------------------------------------------------------
// GET /api/portal/admin/users  (admin — portal users for tooling, e.g. notification test)
// ---------------------------------------------------------------------------

/**
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {{ includeInactive?: boolean, emailHint?: string }} [params]
 * @returns {Promise<object>}
 */
export async function fetchAdminPortalUsers(baseUrl, accessToken, params) {
  const emailHint = params?.emailHint;
  const path = params?.includeInactive
    ? '/api/portal/admin/users?include_inactive=true'
    : '/api/portal/admin/users';
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

export async function fetchElsaSettings(baseUrl, accessToken, params) {
  const emailHint = params?.emailHint;
  const requestParam = params?.requestId ? `?request_id=${encodeURIComponent(params.requestId)}` : '';
  const url = buildUrl(baseUrl, `/api/landlord/elsa/settings${requestParam}`);
  const cacheKey = buildPortalCacheKey(
    PORTAL_CACHE_PREFIX.ELSA,
    baseUrl,
    emailHint,
    params?.requestId ? String(params.requestId) : ''
  );
  return portalCachedJsonGet({
    cacheKey,
    ttlMs: PORTAL_CACHE_TTL_MS.ELSA,
    fetchMode: 'ttl',
    url,
    prepareHeaders: () => getHeaders(accessToken, emailHint),
  });
}

export async function patchElsaSettings(baseUrl, accessToken, payload) {
  const { emailHint, ...body } = payload;
  const res = await fetch(buildUrl(baseUrl, '/api/landlord/elsa/settings'), {
    method: 'PATCH',
    headers: jsonHeaders(accessToken, emailHint),
    credentials: 'omit',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  const elsaPatch = await res.json();
  invalidateElsaCacheForUser(baseUrl, emailHint);
  return elsaPatch;
}

export async function patchElsaRequestAutoRespond(baseUrl, accessToken, requestId, payload) {
  const { emailHint, ...body } = payload;
  const res = await fetch(
    buildUrl(baseUrl, `/api/landlord/requests/${encodeURIComponent(requestId)}/elsa/auto-respond`),
    {
      method: 'PATCH',
      headers: jsonHeaders(accessToken, emailHint),
      credentials: 'omit',
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  const autoResp = await res.json();
  invalidateElsaCacheForUser(baseUrl, emailHint);
  return autoResp;
}

export async function processElsaRequest(baseUrl, accessToken, requestId, payload = {}) {
  const { emailHint, ...body } = payload;
  const res = await fetch(
    buildUrl(baseUrl, `/api/landlord/requests/${encodeURIComponent(requestId)}/elsa/process`),
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
  const processPayload = await res.json();
  invalidateElsaCacheForUser(baseUrl, emailHint);
  invalidateMessagesCacheForRequest(baseUrl, emailHint, requestId);
  return processPayload;
}

/**
 * POST /api/landlord/requests/:id/elsa/summarize
 * Read-only AI summary for management UI (does not invalidate caches).
 */
export async function summarizeElsaRequest(baseUrl, accessToken, requestId, payload = {}) {
  const { emailHint, ...body } = payload;
  const res = await fetch(
    buildUrl(baseUrl, `/api/landlord/requests/${encodeURIComponent(requestId)}/elsa/summarize`),
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

export async function fetchElsaDecisions(baseUrl, accessToken, requestId, params) {
  const emailHint = params?.emailHint;
  const res = await fetch(
    buildUrl(baseUrl, `/api/landlord/requests/${encodeURIComponent(requestId)}/elsa/decisions`),
    {
      method: 'GET',
      headers: getHeaders(accessToken, emailHint),
      credentials: 'omit',
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  return res.json();
}

export async function patchElsaDecisionReview(baseUrl, accessToken, requestId, decisionId, payload) {
  const { emailHint, ...body } = payload;
  const res = await fetch(
    buildUrl(
      baseUrl,
      `/api/landlord/requests/${encodeURIComponent(requestId)}/elsa/decisions/${encodeURIComponent(decisionId)}`
    ),
    {
      method: 'PATCH',
      headers: jsonHeaders(accessToken, emailHint),
      credentials: 'omit',
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  const decisionReview = await res.json();
  invalidateElsaCacheForUser(baseUrl, emailHint);
  return decisionReview;
}

export async function patchElsaCategoryPolicy(baseUrl, accessToken, categoryCode, payload) {
  const { emailHint, ...body } = payload;
  const res = await fetch(
    buildUrl(baseUrl, `/api/landlord/elsa/settings/categories/${encodeURIComponent(categoryCode)}`),
    {
      method: 'PATCH',
      headers: jsonHeaders(accessToken, emailHint),
      credentials: 'omit',
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  const catPol = await res.json();
  invalidateElsaCacheForUser(baseUrl, emailHint);
  return catPol;
}

export async function patchElsaPriorityPolicy(baseUrl, accessToken, priorityCode, payload) {
  const { emailHint, ...body } = payload;
  const res = await fetch(
    buildUrl(baseUrl, `/api/landlord/elsa/settings/priorities/${encodeURIComponent(priorityCode)}`),
    {
      method: 'PATCH',
      headers: jsonHeaders(accessToken, emailHint),
      credentials: 'omit',
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  const priPol = await res.json();
  invalidateElsaCacheForUser(baseUrl, emailHint);
  return priPol;
}

export async function patchElsaPropertyPolicy(baseUrl, accessToken, propertyId, payload) {
  const { emailHint, ...body } = payload;
  const res = await fetch(
    buildUrl(baseUrl, `/api/landlord/elsa/settings/properties/${encodeURIComponent(propertyId)}`),
    {
      method: 'PATCH',
      headers: jsonHeaders(accessToken, emailHint),
      credentials: 'omit',
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  const propPol = await res.json();
  invalidateElsaCacheForUser(baseUrl, emailHint);
  return propPol;
}

export async function fetchAttachmentUploadConfig(baseUrl, accessToken, params) {
  const emailHint = params?.emailHint;
  const res = await fetch(buildUrl(baseUrl, '/api/landlord/attachments/config'), {
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

export async function fetchNotificationPolicies(baseUrl, accessToken, params) {
  const emailHint = params?.emailHint;
  const query = new URLSearchParams();
  query.set('scope_type', String(params?.scopeType || 'PROPERTY').toUpperCase());
  query.set('scope_id', String(params?.scopeId || ''));
  if (params?.userId) query.set('user_id', params.userId);
  if (params?.eventCategory) query.set('event_category', String(params.eventCategory).toUpperCase());
  const res = await fetch(
    buildUrl(baseUrl, `/api/landlord/notifications/policies?${query.toString()}`),
    {
      method: 'GET',
      headers: getHeaders(accessToken, emailHint),
      credentials: 'omit',
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  return res.json();
}

export async function patchNotificationPolicy(baseUrl, accessToken, payload) {
  const { emailHint, ...body } = payload;
  const res = await fetch(buildUrl(baseUrl, '/api/landlord/notifications/policies'), {
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

export async function patchAttachmentUploadGlobalConfig(baseUrl, accessToken, payload) {
  const { emailHint, ...body } = payload;
  const res = await fetch(buildUrl(baseUrl, '/api/landlord/attachments/config'), {
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

export async function patchAttachmentUploadLandlordConfig(baseUrl, accessToken, landlordUserId, payload) {
  const { emailHint, ...body } = payload;
  const res = await fetch(
    buildUrl(baseUrl, `/api/landlord/attachments/config/landlords/${encodeURIComponent(landlordUserId)}`),
    {
      method: 'PATCH',
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

export async function deleteAttachmentUploadLandlordConfig(baseUrl, accessToken, landlordUserId, params) {
  const emailHint = params?.emailHint;
  const res = await fetch(
    buildUrl(baseUrl, `/api/landlord/attachments/config/landlords/${encodeURIComponent(landlordUserId)}`),
    {
      method: 'DELETE',
      headers: getHeaders(accessToken, emailHint),
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
// Document Center
// ---------------------------------------------------------------------------

export async function fetchDocuments(baseUrl, accessToken, params = {}) {
  const emailHint = params?.emailHint;
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  if (params?.list === 'active' || params?.list === 'deleted') query.set('list', params.list);
  if (params?.property_id) query.set('property_id', params.property_id);
  if (params?.lease_id) query.set('lease_id', params.lease_id);
  if (params?.tenant_user_id) query.set('tenant_user_id', params.tenant_user_id);
  if (params?.document_type) query.set('document_type', params.document_type);
  const qs = query.toString();
  const res = await fetch(buildUrl(baseUrl, `/api/portal/documents${qs ? `?${qs}` : ''}`), {
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

export async function requestDocumentUploadIntent(baseUrl, accessToken, payload) {
  const { emailHint, ...body } = payload;
  const res = await fetch(buildUrl(baseUrl, '/api/portal/documents/uploads/intent'), {
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

export async function finalizeDocumentUpload(baseUrl, accessToken, payload) {
  const { emailHint, ...body } = payload;
  const res = await fetch(buildUrl(baseUrl, '/api/portal/documents/finalize'), {
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

export async function fetchDocumentFileUrl(baseUrl, accessToken, documentId, params = {}) {
  const emailHint = params?.emailHint;
  const q = new URLSearchParams();
  if (params?.disposition) q.set('disposition', params.disposition);
  const res = await fetch(
    buildUrl(baseUrl, `/api/portal/documents/${encodeURIComponent(documentId)}/file-url?${q.toString()}`),
    {
      method: 'GET',
      headers: getHeaders(accessToken, emailHint),
      credentials: 'omit',
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  return res.json();
}

export async function deleteDocument(baseUrl, accessToken, documentId, params = {}) {
  const emailHint = params?.emailHint;
  const res = await fetch(buildUrl(baseUrl, `/api/portal/documents/${encodeURIComponent(documentId)}`), {
    method: 'DELETE',
    headers: getHeaders(accessToken, emailHint),
    credentials: 'omit',
  });
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  return res.json();
}

/**
 * PATCH /api/portal/documents/:id
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} documentId
 * @param {{ emailHint?: string, title?: string|null, note?: string|null, document_type?: string, share_with_tenants?: boolean }} [payload]
 * @returns {Promise<object>}
 */
export async function patchPortalDocument(baseUrl, accessToken, documentId, payload = {}) {
  const { emailHint, ...body } = payload;
  const res = await fetch(buildUrl(baseUrl, `/api/portal/documents/${encodeURIComponent(documentId)}`), {
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

export async function restoreDocument(baseUrl, accessToken, documentId, params = {}) {
  const emailHint = params?.emailHint;
  const res = await fetch(
    buildUrl(baseUrl, `/api/portal/documents/${encodeURIComponent(documentId)}/restore`),
    {
      method: 'POST',
      headers: getHeaders(accessToken, emailHint),
      credentials: 'omit',
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  return res.json();
}

/** POST permanently removes a soft-deleted document (body must include confirmation: "delete"). */
export async function purgePortalDocument(baseUrl, accessToken, documentId, params = {}) {
  const emailHint = params?.emailHint;
  const res = await fetch(buildUrl(baseUrl, `/api/portal/documents/${encodeURIComponent(documentId)}/purge`), {
    method: 'POST',
    headers: jsonHeaders(accessToken, emailHint),
    credentials: 'omit',
    body: JSON.stringify({ confirmation: 'delete' }),
  });
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  return res.json();
}

export async function createDocumentShareLink(baseUrl, accessToken, documentId, payload = {}) {
  const { emailHint, ...body } = payload;
  const res = await fetch(
    buildUrl(baseUrl, `/api/portal/documents/${encodeURIComponent(documentId)}/share-links`),
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

export async function fetchDocumentShareLinks(baseUrl, accessToken, documentId, params = {}) {
  const emailHint = params?.emailHint;
  const res = await fetch(
    buildUrl(baseUrl, `/api/portal/documents/${encodeURIComponent(documentId)}/share-links`),
    {
      method: 'GET',
      headers: getHeaders(accessToken, emailHint),
      credentials: 'omit',
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  return res.json();
}

export async function revokeDocumentShareLink(baseUrl, accessToken, linkId, params = {}) {
  const emailHint = params?.emailHint;
  const res = await fetch(
    buildUrl(baseUrl, `/api/portal/document-share-links/${encodeURIComponent(linkId)}`),
    {
      method: 'DELETE',
      headers: getHeaders(accessToken, emailHint),
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
// GET/POST /api/landlord/tenants
// ---------------------------------------------------------------------------

/**
 * List tenants visible to the actor.
 * Admin may pass landlordId to filter by a specific landlord.
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {{ emailHint?: string, landlordId?: string }} [params]
 * @returns {Promise<object>}
 */
export async function fetchTenants(baseUrl, accessToken, params) {
  const { emailHint, landlordId } = params ?? {};
  const qs = landlordId ? `?landlord_id=${encodeURIComponent(landlordId)}` : '';
  const res = await fetch(buildUrl(baseUrl, `/api/landlord/tenants${qs}`), {
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

/**
 * Onboard a new tenant.
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {{ emailHint?: string, email: string, first_name: string, last_name: string, phone?: string, property_id: string, lease: object }} payload
 * @returns {Promise<object>}
 */
export async function createTenant(baseUrl, accessToken, payload) {
  const { emailHint, ...body } = payload;
  const res = await fetch(buildUrl(baseUrl, '/api/landlord/tenants'), {
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

/**
 * GET /api/landlord/tenants/:id
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} tenantId
 * @param {{ emailHint?: string }} [params]
 * @returns {Promise<object>}
 */
export async function fetchTenant(baseUrl, accessToken, tenantId, params) {
  const emailHint = params?.emailHint;
  const url = buildUrl(baseUrl, `/api/landlord/tenants/${encodeURIComponent(tenantId)}`);
  const cacheKey = buildPortalCacheKey(PORTAL_CACHE_PREFIX.TENANT_DETAIL, baseUrl, emailHint, tenantId);
  return portalCachedJsonGet({
    cacheKey,
    ttlMs: PORTAL_CACHE_TTL_MS.TENANT_DETAIL,
    fetchMode: 'ttl',
    url,
    prepareHeaders: () => getHeaders(accessToken, emailHint),
  });
}

/**
 * PATCH /api/landlord/tenants/:id  (enable/disable access)
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} tenantId
 * @param {{ emailHint?: string, active: boolean, landlordId?: string }} payload — admin may pass landlordId when deactivating (query `landlord_id`)
 * @returns {Promise<object>}
 */
export async function patchTenantAccess(baseUrl, accessToken, tenantId, payload) {
  const { emailHint, landlordId, ...body } = payload;
  const landlordRaw = typeof landlordId === 'string' ? landlordId.trim() : '';
  const qs =
    landlordRaw.length > 0 ? `?landlord_id=${encodeURIComponent(landlordRaw)}` : '';
  const res = await fetch(
    buildUrl(baseUrl, `/api/landlord/tenants/${encodeURIComponent(tenantId)}${qs}`),
    {
      method: 'PATCH',
      headers: jsonHeaders(accessToken, emailHint),
      credentials: 'omit',
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  const accessPayload = await res.json();
  invalidateTenantDetailCache(baseUrl, emailHint, tenantId);
  return accessPayload;
}

/**
 * PATCH /api/landlord/tenants/:id  (edit tenant profile)
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} tenantId
 * @param {{ emailHint?: string, email: string, first_name: string, last_name: string, phone?: string|null, property_id?: string }} payload
 * @returns {Promise<object>}
 */
export async function updateTenant(baseUrl, accessToken, tenantId, payload) {
  const { emailHint, ...body } = payload;
  const res = await fetch(
    buildUrl(baseUrl, `/api/landlord/tenants/${encodeURIComponent(tenantId)}`),
    {
      method: 'PATCH',
      headers: jsonHeaders(accessToken, emailHint),
      credentials: 'omit',
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  const updatedTenantPayload = await res.json();
  invalidateTenantDetailCache(baseUrl, emailHint, tenantId);
  return updatedTenantPayload;
}

/**
 * DELETE /api/landlord/tenants/:id  (remove tenant from this landlord's leases; disable account only if no leases remain)
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} tenantId
 * @param {{ emailHint?: string, landlordId?: string }} [params] — admin must pass `landlordId` (query `landlord_id`)
 * @returns {Promise<{ tenant?: object, disabled_account?: boolean }>}
 */
export async function deleteTenant(baseUrl, accessToken, tenantId, params) {
  const emailHint = params?.emailHint;
  const landlordRaw = typeof params?.landlordId === 'string' ? params.landlordId.trim() : '';
  const qs = landlordRaw.length > 0 ? `?landlord_id=${encodeURIComponent(landlordRaw)}` : '';
  const res = await fetch(
    buildUrl(baseUrl, `/api/landlord/tenants/${encodeURIComponent(tenantId)}${qs}`),
    {
      method: 'DELETE',
      headers: getHeaders(accessToken, emailHint),
      credentials: 'omit',
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  let payload = {};
  try {
    payload = await res.json();
  } catch {
    // ignore empty body
  }
  invalidateTenantDetailCache(baseUrl, emailHint, tenantId);
  return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
}

/**
 * POST /api/landlord/tenants/:id/leases  (add a lease)
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} tenantId
 * @param {{ emailHint?: string, property_id: string, start_date: string, end_date?: string|null, month_to_month?: boolean, notes?: string, link_co_tenant_user_ids?: string[] }} payload
 * @returns {Promise<object>}
 */
export async function addTenantLease(baseUrl, accessToken, tenantId, payload) {
  const { emailHint, ...body } = payload;
  const res = await fetch(
    buildUrl(baseUrl, `/api/landlord/tenants/${encodeURIComponent(tenantId)}/leases`),
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
  const leaseCreated = await res.json();
  invalidateTenantDetailCache(baseUrl, emailHint, tenantId);
  if (Array.isArray(body.link_co_tenant_user_ids) && body.link_co_tenant_user_ids.length > 0) {
    invalidateAllTenantDetailCachesForUser(baseUrl, emailHint);
  }
  return leaseCreated;
}

/**
 * POST /api/landlord/leases/:leaseId/tenants  (link another tenant user to the same lease)
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} leaseId
 * @param {{ emailHint?: string, userId: string }} payload
 * @returns {Promise<object>}
 */
export async function linkTenantToLease(baseUrl, accessToken, leaseId, payload) {
  const { emailHint, ...body } = payload;
  const res = await fetch(
    buildUrl(baseUrl, `/api/landlord/leases/${encodeURIComponent(leaseId)}/tenants`),
    {
      method: 'POST',
      headers: jsonHeaders(accessToken, emailHint),
      credentials: 'omit',
      body: JSON.stringify({ userId: body.userId }),
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  invalidateAllTenantDetailCachesForUser(baseUrl, emailHint);
  return res.json();
}

/**
 * DELETE /api/landlord/leases/:leaseId/tenants/:tenantUserId  — remove a tenant user from this lease row
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} leaseId
 * @param {string} tenantUserId
 * @param {{ emailHint?: string }} [opts]
 * @returns {Promise<object>}
 */
export async function unlinkTenantFromLease(baseUrl, accessToken, leaseId, tenantUserId, opts = {}) {
  const { emailHint } = opts;
  const path = `/api/landlord/leases/${encodeURIComponent(leaseId)}/tenants/${encodeURIComponent(tenantUserId)}`;
  const res = await fetch(buildUrl(baseUrl, path), {
    method: 'DELETE',
    headers: jsonHeaders(accessToken, emailHint),
    credentials: 'omit',
  });
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  invalidateAllTenantDetailCachesForUser(baseUrl, emailHint);
  return res.json();
}

/**
 * PATCH /api/landlord/leases/:id  (edit a lease)
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} leaseId
 * @param {{ emailHint?: string, start_date?: string, end_date?: string|null, month_to_month?: boolean, notes?: string|null }} payload
 * @returns {Promise<object>}
 */
export async function updateLease(baseUrl, accessToken, leaseId, payload) {
  const { emailHint, ...body } = payload;
  const res = await fetch(
    buildUrl(baseUrl, `/api/landlord/leases/${encodeURIComponent(leaseId)}`),
    {
      method: 'PATCH',
      headers: jsonHeaders(accessToken, emailHint),
      credentials: 'omit',
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  const leaseUpdated = await res.json();
  invalidateAllTenantDetailCachesForUser(baseUrl, emailHint);
  return leaseUpdated;
}

/**
 * DELETE /api/landlord/leases/:id  (delete a lease)
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} leaseId
 * @param {{ emailHint?: string }} [params]
 * @returns {Promise<void>}
 */
export async function deleteLease(baseUrl, accessToken, leaseId, params) {
  const emailHint = params?.emailHint;
  const res = await fetch(
    buildUrl(baseUrl, `/api/landlord/leases/${encodeURIComponent(leaseId)}`),
    {
      method: 'DELETE',
      headers: getHeaders(accessToken, emailHint),
      credentials: 'omit',
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  invalidateAllTenantDetailCachesForUser(baseUrl, emailHint);
}

/**
 * POST /api/landlord/leases/{leaseId}/move-out — finalize lease move-out.
 */
export async function moveOutLease(baseUrl, accessToken, leaseId, payload, params) {
  const emailHint = params?.emailHint;
  const res = await fetch(
    buildUrl(baseUrl, `/api/landlord/leases/${encodeURIComponent(leaseId)}/move-out`),
    {
      method: 'POST',
      headers: { ...getHeaders(accessToken, emailHint), 'content-type': 'application/json' },
      credentials: 'omit',
      body: JSON.stringify(payload ?? {}),
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  invalidateAllTenantDetailCachesForUser(baseUrl, emailHint);
  return res.json();
}

/**
 * POST /api/landlord/leases/{leaseId}/terminate — eviction or early termination.
 */
export async function terminateLease(baseUrl, accessToken, leaseId, payload, params) {
  const emailHint = params?.emailHint;
  const res = await fetch(
    buildUrl(baseUrl, `/api/landlord/leases/${encodeURIComponent(leaseId)}/terminate`),
    {
      method: 'POST',
      headers: { ...getHeaders(accessToken, emailHint), 'content-type': 'application/json' },
      credentials: 'omit',
      body: JSON.stringify(payload ?? {}),
    }
  );
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  invalidateAllTenantDetailCachesForUser(baseUrl, emailHint);
  return res.json();
}

/**
 * GET /api/landlord/past-tenants — list tenants with no active/upcoming lease under this landlord.
 */
export async function fetchPastTenants(baseUrl, accessToken, params) {
  const emailHint = params?.emailHint;
  const landlordRaw = typeof params?.landlordId === 'string' ? params.landlordId.trim() : '';
  const qs = landlordRaw.length > 0 ? `?landlord_id=${encodeURIComponent(landlordRaw)}` : '';
  const res = await fetch(buildUrl(baseUrl, `/api/landlord/past-tenants${qs}`), {
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

/**
 * GET /api/landlord/properties  (reusable for property selection dropdowns)
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {{ emailHint?: string }} [params]
 * @returns {Promise<object>}
 */
export async function fetchLandlordProperties(baseUrl, accessToken, params) {
  const emailHint = params?.emailHint;
  const res = await fetch(buildUrl(baseUrl, '/api/landlord/properties'), {
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

/**
 * GET /api/landlord/leases  (optional ?property_id= for filter)
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {{ emailHint?: string, propertyId?: string }} [params]
 * @returns {Promise<object>}
 */
export async function fetchLandlordLeases(baseUrl, accessToken, params) {
  const emailHint = params?.emailHint;
  const propertyId = params?.propertyId?.trim();
  const path =
    propertyId != null && propertyId !== ''
      ? `/api/landlord/leases?property_id=${encodeURIComponent(propertyId)}`
      : '/api/landlord/leases';
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

// ---------------------------------------------------------------------------
// Lease payment entries (portal + landlord APIs)
// ---------------------------------------------------------------------------

export async function fetchPaymentsApi(baseUrl, accessToken, { path, emailHint }) {
  const url = buildUrl(baseUrl, path);
  let res;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: getHeaders(accessToken, emailHint),
      credentials: 'omit',
    });
  } catch (err) {
    throw wrapFetchFailure(err, { url, path });
  }
  if (!res.ok) {
    const code = await readErrorBody(res);
    throw apiError(res.status, code);
  }
  let raw;
  try {
    raw = await res.text();
  } catch (err) {
    throw wrapFetchFailure(err, { url, path, phase: 'readBody' });
  }
  const trimmed = raw.trim();
  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) {
    throw apiError(res.status, 'non_json_response');
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    throw apiError(res.status, 'invalid_json');
  }
}

export async function createLeasePaymentEntry(baseUrl, accessToken, payload) {
  const { emailHint, ...body } = payload;
  const res = await fetch(buildUrl(baseUrl, '/api/landlord/payments'), {
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

export async function updateLeasePaymentEntry(baseUrl, accessToken, entryId, payload) {
  const { emailHint, ...body } = payload;
  const res = await fetch(buildUrl(baseUrl, `/api/landlord/payments/${encodeURIComponent(entryId)}`), {
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
