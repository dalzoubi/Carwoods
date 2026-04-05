import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { corsHeadersForRequest } from '../lib/corsHeaders.js';
import { hasDatabaseUrl, getPool } from '../lib/db.js';
import {
  getBearerToken,
  primaryEmailFromClaims,
  verifyAccessToken,
  entraAuthConfigured,
} from '../lib/jwtVerify.js';
import { findUserByClaims } from '../lib/usersRepo.js';

async function portalMeHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const headers = corsHeadersForRequest(request);
  if (request.method === 'OPTIONS') {
    return { status: 204, headers };
  }
  if (request.method !== 'GET') {
    return {
      status: 405,
      headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
      jsonBody: { error: 'method_not_allowed' },
    };
  }

  const token = getBearerToken(request.headers.get('authorization'));
  if (!token) {
    return {
      status: 401,
      headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
      jsonBody: { error: 'unauthorized' },
    };
  }

  if (!entraAuthConfigured()) {
    return {
      status: 503,
      headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
      jsonBody: { error: 'entra_unconfigured' },
    };
  }

  let claims;
  try {
    claims = await verifyAccessToken(token);
  } catch {
    return {
      status: 401,
      headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
      jsonBody: { error: 'invalid_token' },
    };
  }

  const emailHint = request.headers.get('x-email-hint')?.trim() || undefined;

  let user: Awaited<ReturnType<typeof findUserByClaims>> = null;
  if (hasDatabaseUrl()) {
    try {
      const pool = getPool();
      user = await findUserByClaims(pool, claims, { emailHint, logger: context });
    } catch (error) {
      context.warn?.(
        `portalMe DB lookup failed: ${error instanceof Error ? error.message : 'unknown_error'}`
      );
      user = null;
    }
  }

  const tokenRole = claims.role ?? claims.roles?.[0] ?? claims.app_roles?.[0] ?? null;

  return {
    status: 200,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
    jsonBody: {
      subject: claims.sub,
      oid: claims.oid ?? null,
      email: primaryEmailFromClaims(claims) ?? null,
      role: user?.role ?? tokenRole,
      user,
    },
  };
}

app.http('portalMe', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/me',
  handler: portalMeHandler,
});
