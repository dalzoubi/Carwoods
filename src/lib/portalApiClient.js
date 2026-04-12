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

function apiError(status, code, details) {
  const message = code ? `HTTP ${status} (${code})` : `HTTP ${status}`;
  return details ? { status, code, message, details } : { status, code, message };
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

/**
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} requestId
 * @param {{ emailHint?: string }} [params]
 * @returns {Promise<object>}
 */
export async function fetchRequestMessages(baseUrl, accessToken, requestId, params) {
  const emailHint = params?.emailHint;
  const res = await fetch(
    buildUrl(baseUrl, `/api/portal/requests/${encodeURIComponent(requestId)}/messages`),
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
// PATCH /api/portal/requests/:id  (tenant cancel)
// ---------------------------------------------------------------------------

/**
 * Cancel a maintenance request. Only allowed for tenants on requests in
 * NOT_STARTED or ACKNOWLEDGED status.
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
  return res.json();
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
  return res.json();
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
  return res.json();
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

/**
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} notificationId
 * @param {{ emailHint?: string }} [params]
 * @returns {Promise<object>}
 */
export async function markNotificationRead(baseUrl, accessToken, notificationId, params) {
  const emailHint = params?.emailHint;
  const res = await fetch(
    buildUrl(baseUrl, `/api/portal/notifications/${encodeURIComponent(notificationId)}`),
    {
      method: 'PATCH',
      headers: jsonHeaders(accessToken, emailHint),
      credentials: 'omit',
      body: JSON.stringify({ read: true }),
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

export async function fetchElsaSettings(baseUrl, accessToken, params) {
  const emailHint = params?.emailHint;
  const requestParam = params?.requestId ? `?request_id=${encodeURIComponent(params.requestId)}` : '';
  const res = await fetch(buildUrl(baseUrl, `/api/landlord/elsa/settings${requestParam}`), {
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
  return res.json();
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
  return res.json();
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
  return res.json();
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
  return res.json();
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
  return res.json();
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
  return res.json();
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
  const res = await fetch(
    buildUrl(baseUrl, `/api/landlord/tenants/${encodeURIComponent(tenantId)}`),
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

/**
 * PATCH /api/landlord/tenants/:id  (enable/disable access)
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} tenantId
 * @param {{ emailHint?: string, active: boolean }} payload
 * @returns {Promise<object>}
 */
export async function patchTenantAccess(baseUrl, accessToken, tenantId, payload) {
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
  return res.json();
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
  return res.json();
}

/**
 * DELETE /api/landlord/tenants/:id  (remove tenant from landlord's list — disables user)
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} tenantId
 * @param {{ emailHint?: string }} [params]
 * @returns {Promise<void>}
 */
export async function deleteTenant(baseUrl, accessToken, tenantId, params) {
  const emailHint = params?.emailHint;
  const res = await fetch(
    buildUrl(baseUrl, `/api/landlord/tenants/${encodeURIComponent(tenantId)}`),
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

/**
 * POST /api/landlord/tenants/:id/leases  (add a lease)
 *
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} tenantId
 * @param {{ emailHint?: string, property_id: string, start_date: string, end_date?: string|null, month_to_month?: boolean, notes?: string }} payload
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
  return res.json();
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
