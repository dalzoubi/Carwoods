import type { HttpRequest, HttpResponseInit } from '@azure/functions';
import { getPool, hasDatabaseUrl } from './db.js';
import { corsHeadersForRequest } from './corsHeaders.js';
import { getBearerToken, verifyAccessToken, entraAuthConfigured } from './jwtVerify.js';
import { isAdminOid } from './adminGate.js';
import { ensureAdminUser, type UserRow } from './usersRepo.js';

export type AdminContext = {
  user: UserRow;
  headers: Record<string, string>;
};

/**
 * OPTIONS, missing DB, missing Entra config, bad/missing token, or non-admin → HttpResponseInit.
 * Otherwise DB client + admin user (upserted).
 */
export async function requireAdmin(
  request: HttpRequest
): Promise<{ ok: true; ctx: AdminContext } | { ok: false; response: HttpResponseInit }> {
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

  if (!isAdminOid(claims.oid, claims.sub)) {
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
    const user = await ensureAdminUser(client, claims);
    await client.query('COMMIT');
    return { ok: true, ctx: { user, headers } };
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
