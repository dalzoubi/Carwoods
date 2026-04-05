import type { HttpRequest, HttpResponseInit } from '@azure/functions';
import { getPool, hasDatabaseUrl } from './db.js';
import { corsHeadersForRequest } from './corsHeaders.js';
import { getBearerToken, verifyAccessToken, entraAuthConfigured } from './jwtVerify.js';
import { findUserByClaims, type UserRow } from './usersRepo.js';

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
  request: HttpRequest
): Promise<{ ok: true; ctx: ManagementContext } | { ok: false; response: HttpResponseInit }> {
  const headers = corsHeadersForRequest(request);
  if (request.method === 'OPTIONS') {
    return { ok: false, response: { status: 204, headers } };
  }
  if (!hasDatabaseUrl()) {
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
    return {
      ok: false,
      response: {
        status: 403,
        headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
        jsonBody: { error: 'forbidden' },
      },
    };
  }
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

