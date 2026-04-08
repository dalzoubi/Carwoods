import type { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getPool, hasDatabaseUrl } from './db.js';
import { corsHeadersForRequest } from './corsHeaders.js';
import { getBearerToken, verifyAccessToken, entraAuthConfigured } from './jwtVerify.js';
import { findUserByClaims, type UserRow } from './usersRepo.js';
import { logInfo, logWarn } from './serverLogger.js';
import { Role } from '../domain/constants.js';
import { isDomainError, type DomainError } from '../domain/errors.js';

export type ManagementContext = {
  user: UserRow;
  role: Role;
  headers: Record<string, string>;
};

export type PortalContext = {
  user: UserRow;
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
  const isAllowedRole = role === Role.ADMIN || role === Role.LANDLORD;
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
  return { ok: true, ctx: { user, role: role as Role, headers } };
}

/**
 * Same base checks as management auth, but restricts to ACTIVE/INVITED ADMIN users.
 */
export async function requireAdmin(
  request: HttpRequest,
  context?: InvocationContext
): Promise<{ ok: true; ctx: ManagementContext } | { ok: false; response: HttpResponseInit }> {
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate;
  if (gate.ctx.role !== Role.ADMIN) {
    return {
      ok: false,
      response: jsonResponse(403, gate.ctx.headers, { error: 'forbidden' }),
    };
  }
  return gate;
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

/**
 * Map a DomainError thrown by a use case to an HttpResponseInit.
 * Returns null if the error is not a DomainError (caller should re-throw).
 */
export function mapDomainError(
  error: unknown,
  headers: Record<string, string>
): HttpResponseInit | null {
  if (!isDomainError(error)) return null;
  const e = error as DomainError & { max_bytes?: number; max?: number };
  const extraFields: Record<string, unknown> = {};
  if (e.max_bytes !== undefined) extraFields.max_bytes = e.max_bytes;
  if (e.max !== undefined) extraFields.max = e.max;

  switch (e.code) {
    case 'NOT_FOUND':
      return jsonResponse(404, headers, { error: e.message, ...extraFields });
    case 'FORBIDDEN':
      return jsonResponse(403, headers, { error: e.message, ...extraFields });
    case 'VALIDATION':
      return jsonResponse(400, headers, { error: e.message, ...extraFields });
    case 'CONFLICT':
      return jsonResponse(409, headers, { error: e.message, ...extraFields });
    case 'UNPROCESSABLE':
      return jsonResponse(422, headers, { error: e.message, ...extraFields });
    default:
      return jsonResponse(500, headers, { error: 'internal_error' });
  }
}

/**
 * OPTIONS, missing DB, missing Entra config, bad/missing token, or missing user row
 * -> HttpResponseInit.
 * Otherwise returns the authenticated active portal user (TENANT/LANDLORD/ADMIN/AI_AGENT).
 */
export async function requirePortalUser(
  request: HttpRequest,
  context?: InvocationContext
): Promise<{ ok: true; ctx: PortalContext } | { ok: false; response: HttpResponseInit }> {
  const headers = corsHeadersForRequest(request);
  logInfo(context, 'portal.auth.start', { method: request.method });
  if (request.method === 'OPTIONS') {
    logInfo(context, 'portal.auth.options');
    return { ok: false, response: { status: 204, headers } };
  }
  if (!hasDatabaseUrl()) {
    logWarn(context, 'portal.auth.failed', { reason: 'database_unconfigured' });
    return {
      ok: false,
      response: jsonResponse(503, headers, { error: 'database_unconfigured' }),
    };
  }
  if (!entraAuthConfigured()) {
    logWarn(context, 'portal.auth.failed', { reason: 'entra_unconfigured' });
    return {
      ok: false,
      response: jsonResponse(503, headers, { error: 'entra_unconfigured' }),
    };
  }

  const token = getBearerToken(request.headers.get('authorization'));
  if (!token) {
    logWarn(context, 'portal.auth.failed', { reason: 'missing_bearer_token' });
    return {
      ok: false,
      response: jsonResponse(401, headers, { error: 'unauthorized' }),
    };
  }

  let claims;
  try {
    claims = await verifyAccessToken(token);
  } catch {
    logWarn(context, 'portal.auth.failed', { reason: 'invalid_token' });
    return {
      ok: false,
      response: jsonResponse(401, headers, { error: 'invalid_token' }),
    };
  }

  const emailHint = request.headers.get('x-email-hint')?.trim() || undefined;
  const pool = getPool();
  const user = await findUserByClaims(pool, claims, { emailHint });
  if (!user) {
    logWarn(context, 'portal.auth.failed', {
      reason: 'user_not_found',
      subject: claims.sub,
      oid: claims.oid ?? null,
    });
    return {
      ok: false,
      response: jsonResponse(403, headers, { error: 'forbidden' }),
    };
  }

  const role = String(user.role ?? '').toUpperCase();
  const status = String(user.status ?? '').toUpperCase();
  const isAllowedRole =
    role === Role.TENANT
    || role === Role.LANDLORD
    || role === Role.ADMIN
    || role === Role.AI_AGENT;
  const isActive = status === 'ACTIVE' || status === 'INVITED';
  if (!isAllowedRole || !isActive) {
    logWarn(context, 'portal.auth.failed', {
      reason: 'forbidden_role_or_status',
      role,
      status,
      userId: user.id,
    });
    return {
      ok: false,
      response: jsonResponse(403, headers, { error: 'forbidden' }),
    };
  }

  logInfo(context, 'portal.auth.success', { userId: user.id, role });
  return { ok: true, ctx: { user, headers } };
}

