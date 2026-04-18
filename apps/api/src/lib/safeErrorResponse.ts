type ErrorBody = {
  error?: unknown;
  message?: unknown;
  [key: string]: unknown;
};

const SAFE_ERROR_METADATA = new Set([
  'max',
  'max_bytes',
  'max_seconds',
  'passcode_required',
]);

const INTERNAL_ERROR_CODES = new Set([
  'auth_unconfigured',
  'database_unconfigured',
  'document_center_unavailable',
  'har_access_denied',
  'har_unreachable',
  'ingest_unconfigured',
  'purge_failed',
  'storage_not_configured',
  'user_lookup_unavailable',
]);

function genericErrorCode(status: number): string {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 405) return 'method_not_allowed';
  if (status === 409) return 'conflict';
  if (status === 413) return 'payload_too_large';
  if (status === 429) return 'rate_limit_exceeded';
  if (status === 422) return 'validation_failed';
  if (status >= 500) return 'service_unavailable';
  if (status >= 400) return 'invalid_request';
  return 'request_failed';
}

function publicErrorCode(status: number, code: string): string {
  if (!code || INTERNAL_ERROR_CODES.has(code)) return genericErrorCode(status);
  if (status >= 500) return genericErrorCode(status);
  if (status === 401) return 'unauthorized';
  return code;
}

export function safeErrorResponseBody(status: number, body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;

  const errorBody = body as ErrorBody;
  if (typeof errorBody.error !== 'string') return body;

  const safeBody: Record<string, unknown> = {
    error: publicErrorCode(status, errorBody.error),
  };

  for (const key of SAFE_ERROR_METADATA) {
    if (Object.prototype.hasOwnProperty.call(errorBody, key)) {
      safeBody[key] = errorBody[key];
    }
  }

  return safeBody;
}
