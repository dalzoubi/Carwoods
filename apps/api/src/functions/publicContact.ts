import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { corsHeadersForRequest } from '../lib/corsHeaders.js';
import { hasDatabaseUrl, getPool } from '../lib/db.js';
import { logError, logInfo, logWarn } from '../lib/serverLogger.js';
import { withRateLimit } from '../lib/rateLimiter.js';
import { isDomainError } from '../domain/errors.js';
import { submitContactRequest } from '../useCases/contactRequests/submitContactRequest.js';

function asOptionalString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function publicContactHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  logInfo(context, 'public.contact.start', { method: request.method });
  const headers = corsHeadersForRequest(request);

  if (request.method === 'OPTIONS') {
    return { status: 204, headers };
  }

  if (request.method !== 'POST') {
    return {
      status: 405,
      headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
      jsonBody: { error: 'method_not_allowed' },
    };
  }

  if (!hasDatabaseUrl()) {
    logWarn(context, 'public.contact.database_unconfigured');
    return {
      status: 503,
      headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
      jsonBody: { error: 'database_unconfigured' },
    };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      status: 400,
      headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
      jsonBody: { error: 'invalid_json' },
    };
  }

  const b = (body && typeof body === 'object' && !Array.isArray(body))
    ? (body as Record<string, unknown>)
    : {};

  const name = asOptionalString(b.name) ?? '';
  const email = asOptionalString(b.email) ?? '';
  const phone = asOptionalString(b.phone);
  const subject = asOptionalString(b.subject) ?? '';
  const message = asOptionalString(b.message) ?? '';
  const recaptchaToken = asOptionalString(b.recaptchaToken);

  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('client-ip') ??
    null;

  try {
    const pool = getPool();
    const row = await submitContactRequest(
      pool,
      { name, email, phone, subject, message, recaptchaToken, ipAddress },
      context
    );
    logInfo(context, 'public.contact.success', { id: row.id });
    return {
      status: 201,
      headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
      jsonBody: { success: true, id: row.id },
    };
  } catch (err) {
    if (isDomainError(err)) {
      logWarn(context, 'public.contact.domain_error', { code: err.code, message: err.message });
      return {
        status: err.code === 'VALIDATION' ? 400 : 422,
        headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
        jsonBody: { error: err.message },
      };
    }
    logError(context, 'public.contact.error', {
      message: err instanceof Error ? err.message : 'unknown_error',
    });
    return {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
      jsonBody: { error: 'internal_error' },
    };
  }
}

app.http('publicContact', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'public/contact',
  handler: withRateLimit(publicContactHandler),
});
