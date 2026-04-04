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
  _context: InvocationContext
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

  let user: Awaited<ReturnType<typeof findUserByClaims>> = null;
  if (hasDatabaseUrl()) {
    const pool = getPool();
    const c = await pool.connect();
    try {
      user = await findUserByClaims(c, claims);
    } finally {
      c.release();
    }
  }

  return {
    status: 200,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
    jsonBody: {
      subject: claims.sub,
      oid: claims.oid ?? null,
      email: primaryEmailFromClaims(claims) ?? null,
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
