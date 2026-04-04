import type { HttpRequest, HttpResponseInit } from '@azure/functions';
import { getPool, hasDatabaseUrl } from './db.js';
import { corsHeadersForRequest } from './corsHeaders.js';
import { getBearerToken, verifyAccessToken, entraAuthConfigured } from './jwtVerify.js';
import { resolveManagementRole } from './managementGate.js';
import {
  ensureManagementUser,
  UserRole,
  type UserRow,
} from './usersRepo.js';

export type ManagementContext = {
  user: UserRow;
  role: 'ADMIN' | 'LANDLORD';
  headers: Record<string, string>;
};

/**
 * OPTIONS, missing DB, missing Entra config, bad/missing token, or non-management user → HttpResponseInit.
 * Otherwise DB client + management user (upserted).
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

  const resolvedRole = resolveManagementRole(claims.oid, claims.sub);
  if (!resolvedRole) {
    return {
      ok: false,
      response: {
        status: 403,
        headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
        jsonBody: { error: 'forbidden' },
      },
    };
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await ensureManagementUser(
      client,
      claims,
      resolvedRole === 'ADMIN' ? UserRole.ADMIN : UserRole.LANDLORD
    );
    await client.query('COMMIT');
    return { ok: true, ctx: { user, role: resolvedRole, headers } };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
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

