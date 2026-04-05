import type { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getPool, hasDatabaseUrl } from './db.js';
import { corsHeadersForRequest } from './corsHeaders.js';
import { getBearerToken, verifyAccessToken, entraAuthConfigured } from './jwtVerify.js';
import { findUserByClaims, type UserRow } from './usersRepo.js';
import { logInfo, logWarn } from './serverLogger.js';

export type ManagementContext = {
  user: UserRow;
  role: 'ADMIN' | 'LANDLORD';
  headers: Record<string, string>;
};

/**
 * OPTIONS, missing DB, missing Entra config, bad/missing token, or non-management user → HttpResponseInit.
 * Otherwise DB-backed management user resolved from JWT email.
 */
export async function requireLandlordOrAdmin(
  request: HttpRequest,
  context?: InvocationContext
): Promise<{ ok: true; ctx: ManagementContext } | { ok: false; response: HttpResponseInit }> {
  const headers = corsHeadersForRequest(request);
  logInfo(context, 'management.auth.start', { method: request.method });
  if (request.method === 'OPTIONS') {
    logInfo(context, 'management.auth.options');
    return { ok: false, response: { status: 204, headers } };
  }
  if (!hasDatabaseUrl()) {
    logWarn(context, 'management.auth.failed', { reason: 'database_unconfigured' });
    return {
      ok: false,
      response: {
        status: 503,
        headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
        jsonBody: { error: 'database_unconfigured' },
      },
    };
  }
  if (!entraAuthConfigured()) {
    logWarn(context, 'management.auth.failed', { reason: 'entra_unconfigured' });
    return {
      ok: false,
      response: {
        status: 503,
        headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
        jsonBody: { error: 'entra_unconfigured' },
      },
    };
  }

  const token = getBearerToken(request.headers.get('authorization'));
  if (!token) {
    logWarn(context, 'management.auth.failed', { reason: 'missing_bearer_token' });
    return {
      ok: false,
      response: {
        status: 401,
        headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
        jsonBody: { error: 'unauthorized' },
      },
    };
  }

  let claims;
  try {
    claims = await verifyAccessToken(token);
  } catch {
    logWarn(context, 'management.auth.failed', { reason: 'invalid_token' });
    return {
      ok: false,
      response: {
        status: 401,
        headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
        jsonBody: { error: 'invalid_token' },
      },
    };
  }

  const emailHint = request.headers.get('x-email-hint')?.trim() || undefined;
  const pool = getPool();
  const user = await findUserByClaims(pool, claims, { emailHint });
  if (!user) {
    logWarn(context, 'management.auth.failed', {
      reason: 'user_not_found',
      subject: claims.sub,
      oid: claims.oid ?? null,
    });
    return {
      ok: false,
      response: {
        status: 403,
        headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
        jsonBody: { error: 'forbidden' },
      },
    };
  }
  const role = String(user.role ?? '').toUpperCase();
  const status = String(user.status ?? '').toUpperCase();
  const isActive = status === 'ACTIVE' || status === 'INVITED';
  const isAllowedRole = role === 'ADMIN' || role === 'LANDLORD';
  if (!isActive || !isAllowedRole) {
    logWarn(context, 'management.auth.failed', {
      reason: 'forbidden_role_or_status',
      role,
      status,
      userId: user.id,
    });
    return {
      ok: false,
      response: {
        status: 403,
        headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
        jsonBody: { error: 'forbidden' },
      },
    };
  }
  logInfo(context, 'management.auth.success', { userId: user.id, role });
  return { ok: true, ctx: { user, role: role as 'ADMIN' | 'LANDLORD', headers } };
}

export function jsonResponse(
  status: number,
  headers: Record<string, string>,
  body: unknown
): HttpResponseInit {
  if (status === 204) {
    return { status: 204, headers };
  }
  return {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
    jsonBody: body,
  };
}

