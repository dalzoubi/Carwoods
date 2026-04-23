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
  authConfigured,
} from '../lib/jwtVerify.js';
import {
  findUserByClaims,
  findUserByEmail,
  reactivateDisabledUserAsLandlord,
  registerLandlordByClaims,
} from '../lib/usersRepo.js';
import { enqueueNotification } from '../lib/notificationRepo.js';
import { logError, logInfo, logWarn } from '../lib/serverLogger.js';
import { Role } from '../domain/constants.js';
import { safeErrorResponseBody } from '../lib/safeErrorResponse.js';
import { withRateLimit } from '../lib/rateLimiter.js';

function jsonResponse(
  status: number,
  headers: Record<string, string>,
  body: unknown
): HttpResponseInit {
  return {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
    jsonBody: safeErrorResponseBody(status, body),
  };
}

type RegisterPayload = {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
};

function parsePayload(raw: unknown): RegisterPayload {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  return {
    first_name: typeof r.first_name === 'string' ? r.first_name : null,
    last_name: typeof r.last_name === 'string' ? r.last_name : null,
    phone: typeof r.phone === 'string' ? r.phone : null,
  };
}

export async function portalRegisterLandlordHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const headers = corsHeadersForRequest(request);
  if (request.method === 'OPTIONS') {
    return { status: 204, headers };
  }
  if (request.method !== 'POST') {
    return jsonResponse(405, headers, { error: 'method_not_allowed' });
  }

  const token = getBearerToken(request.headers.get('authorization'));
  if (!token) {
    return jsonResponse(401, headers, { error: 'unauthorized' });
  }
  if (!authConfigured()) {
    return jsonResponse(503, headers, { error: 'auth_unconfigured' });
  }
  if (!hasDatabaseUrl()) {
    return jsonResponse(503, headers, { error: 'database_unconfigured' });
  }

  let claims;
  try {
    claims = await verifyAccessToken(token);
  } catch {
    return jsonResponse(401, headers, { error: 'invalid_token' });
  }

  const emailHint = request.headers.get('x-email-hint')?.trim() || undefined;

  let payload: RegisterPayload = {};
  try {
    const body = await request.json();
    payload = parsePayload(body);
  } catch {
    payload = {};
  }

  const pool = getPool();

  const tokenEmail = primaryEmailFromClaims(claims) ?? emailHint;
  if (!tokenEmail) {
    return jsonResponse(400, headers, { error: 'email_required' });
  }

  const fromClaims = await findUserByClaims(pool, claims, { emailHint, logger: context });
  const fromEmail = await findUserByEmail(pool, tokenEmail);
  const row = fromClaims ?? fromEmail;

  if (row) {
    const st = String(row.status ?? '').toUpperCase();
    if (st === 'DISABLED') {
      const r = String(row.role ?? '').toUpperCase();
      if (r !== Role.LANDLORD && r !== Role.TENANT) {
        logWarn(context, 'portal.register_landlord.reactivate.role_blocked', {
          userId: row.id,
          role: row.role,
        });
        return jsonResponse(409, headers, { error: 'email_already_registered' });
      }
      let reactivated;
      try {
        reactivated = await reactivateDisabledUserAsLandlord(pool, row.id, claims, emailHint, {
          firstName: payload.first_name ?? null,
          lastName: payload.last_name ?? null,
          phone: payload.phone ?? null,
        });
      } catch (error) {
        logError(context, 'portal.register_landlord.reactivate.error', {
          message: error instanceof Error ? error.message : 'unknown',
        });
        return jsonResponse(500, headers, { error: 'registration_failed' });
      }
      if (!reactivated) {
        return jsonResponse(500, headers, { error: 'registration_failed' });
      }
      logInfo(context, 'portal.register_landlord.reactivated', {
        userId: reactivated.id,
        subject: claims.sub,
        oid: claims.oid ?? null,
      });
      try {
        const notifyClient = await pool.connect();
        try {
          await enqueueNotification(notifyClient, {
            eventTypeCode: 'ACCOUNT_LANDLORD_CREATED',
            payload: {
              landlord_user_id: reactivated.id,
              landlord_email: reactivated.email,
              email: reactivated.email,
              first_name: reactivated.first_name ?? null,
              last_name: reactivated.last_name ?? null,
              source: 'SELF_REGISTRATION',
            },
            idempotencyKey: `account-landlord-created:${reactivated.id}:self`,
          });
        } finally {
          notifyClient.release();
        }
      } catch (notifyErr) {
        logWarn(context, 'portal.register_landlord.notify_admins.failed', {
          userId: reactivated.id,
          message: notifyErr instanceof Error ? notifyErr.message : String(notifyErr),
        });
      }
      return jsonResponse(201, headers, { ok: true });
    }

    logWarn(context, 'portal.register_landlord.already_exists', {
      userId: row.id,
      role: row.role,
      status: row.status,
    });
    return jsonResponse(409, headers, { error: 'account_already_exists' });
  }

  let user;
  try {
    user = await registerLandlordByClaims(pool, claims, emailHint, {
      firstName: payload.first_name ?? null,
      lastName: payload.last_name ?? null,
      phone: payload.phone ?? null,
    });
  } catch (error) {
    logError(context, 'portal.register_landlord.error', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return jsonResponse(500, headers, { error: 'registration_failed' });
  }

  if (!user) {
    return jsonResponse(400, headers, { error: 'email_required' });
  }

  logInfo(context, 'portal.register_landlord.ok', {
    userId: user.id,
    subject: claims.sub,
    oid: claims.oid ?? null,
  });

  try {
    const notifyClient = await pool.connect();
    try {
      await enqueueNotification(notifyClient, {
        eventTypeCode: 'ACCOUNT_LANDLORD_CREATED',
        payload: {
          landlord_user_id: user.id,
          landlord_email: user.email,
          email: user.email,
          first_name: user.first_name ?? null,
          last_name: user.last_name ?? null,
          source: 'SELF_REGISTRATION',
        },
        idempotencyKey: `account-landlord-created:${user.id}:self`,
      });
    } finally {
      notifyClient.release();
    }
  } catch (notifyErr) {
    logWarn(context, 'portal.register_landlord.notify_admins.failed', {
      userId: user.id,
      message: notifyErr instanceof Error ? notifyErr.message : String(notifyErr),
    });
  }

  return jsonResponse(201, headers, { ok: true });
}

app.http('portalRegisterLandlord', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/register/landlord',
  handler: withRateLimit(portalRegisterLandlordHandler),
});
