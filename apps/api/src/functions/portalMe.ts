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
import { logError, logInfo, logWarn } from '../lib/serverLogger.js';

async function portalMeHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  logInfo(context, 'portal.me.start', { method: request.method });
  const headers = corsHeadersForRequest(request);
  if (request.method === 'OPTIONS') {
    logInfo(context, 'portal.me.options');
    return { status: 204, headers };
  }
  if (request.method !== 'GET') {
    logWarn(context, 'portal.me.method_not_allowed', { method: request.method });
    return {
      status: 405,
      headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
      jsonBody: { error: 'method_not_allowed' },
    };
  }

  const token = getBearerToken(request.headers.get('authorization'));
  if (!token) {
    logWarn(context, 'portal.me.unauthorized', { reason: 'missing_bearer_token' });
    return {
      status: 401,
      headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
      jsonBody: { error: 'unauthorized' },
    };
  }

  if (!entraAuthConfigured()) {
    logWarn(context, 'portal.me.unavailable', { reason: 'entra_unconfigured' });
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
    logWarn(context, 'portal.me.unauthorized', { reason: 'invalid_token' });
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
      logError(context, 'portal.me.user_lookup.error', {
        message: error instanceof Error ? error.message : 'unknown_error',
      });
      context.warn?.(
        `portalMe DB lookup failed: ${error instanceof Error ? error.message : 'unknown_error'}`
      );
      user = null;
    }
  }

  const tokenRole = claims.role ?? claims.roles?.[0] ?? claims.app_roles?.[0] ?? null;
  logInfo(context, 'portal.me.success', {
    subject: claims.sub,
    oid: claims.oid ?? null,
    resolvedRole: user?.role ?? tokenRole,
    hasUserRecord: Boolean(user),
  });

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
