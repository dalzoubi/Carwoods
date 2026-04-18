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
import { findUserByClaims, autoAssignFreeTier, autoRegisterLandlordByClaims } from '../lib/usersRepo.js';
import { getGlobalAttachmentUploadConfigCached } from '../lib/attachmentUploadConfigRepo.js';
import { getTierById, getTierByName } from '../lib/subscriptionTiersRepo.js';
import { addProfilePhotoReadUrl } from '../lib/userProfilePhotoUrl.js';
import { ensureUserNotificationPreference } from '../lib/notificationPolicyRepo.js';
import { enqueueNotification } from '../lib/notificationRepo.js';
import { logError, logInfo, logWarn } from '../lib/serverLogger.js';
import { withRateLimit } from '../lib/rateLimiter.js';
import { safeErrorResponseBody } from '../lib/safeErrorResponse.js';
import { getSubscriptionTierForTenantPrimaryLease } from '../lib/subscriptionTierCapabilities.js';
import { Role } from '../domain/constants.js';

type PortalMeDeps = {
  hasDatabaseUrl: typeof hasDatabaseUrl;
  getPool: typeof getPool;
  verifyAccessToken: typeof verifyAccessToken;
  authConfigured: typeof authConfigured;
  findUserByClaims: typeof findUserByClaims;
  autoRegisterLandlordByClaims: typeof autoRegisterLandlordByClaims;
  ensureUserNotificationPreference: typeof ensureUserNotificationPreference;
  getGlobalAttachmentUploadConfigCached: typeof getGlobalAttachmentUploadConfigCached;
};

const DEFAULT_PORTAL_ME_DEPS: PortalMeDeps = {
  hasDatabaseUrl,
  getPool,
  verifyAccessToken,
  authConfigured,
  findUserByClaims,
  autoRegisterLandlordByClaims,
  ensureUserNotificationPreference,
  getGlobalAttachmentUploadConfigCached,
};

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

export async function portalMeHandler(
  request: HttpRequest,
  context: InvocationContext,
  deps: PortalMeDeps = DEFAULT_PORTAL_ME_DEPS
): Promise<HttpResponseInit> {
  logInfo(context, 'portal.me.start', { method: request.method });
  const headers = corsHeadersForRequest(request);
  if (request.method === 'OPTIONS') {
    logInfo(context, 'portal.me.options');
    return { status: 204, headers };
  }
  if (request.method !== 'GET') {
    logWarn(context, 'portal.me.method_not_allowed', { method: request.method });
    return jsonResponse(405, headers, { error: 'method_not_allowed' });
  }

  const token = getBearerToken(request.headers.get('authorization'));
  if (!token) {
    logWarn(context, 'portal.me.unauthorized', { reason: 'missing_bearer_token' });
    return jsonResponse(401, headers, { error: 'unauthorized' });
  }

  if (!deps.authConfigured()) {
    logWarn(context, 'portal.me.unavailable', { reason: 'auth_unconfigured' });
    return jsonResponse(503, headers, { error: 'auth_unconfigured' });
  }

  let claims;
  try {
    claims = await deps.verifyAccessToken(token);
  } catch {
    logWarn(context, 'portal.me.unauthorized', { reason: 'invalid_token' });
    return jsonResponse(401, headers, { error: 'invalid_token' });
  }

  const emailHint = request.headers.get('x-email-hint')?.trim() || undefined;

  let user: Awaited<ReturnType<typeof findUserByClaims>> = null;
  let notificationPreferences: Awaited<ReturnType<typeof ensureUserNotificationPreference>> | null = null;
  let userLookupFailed = false;
  if (deps.hasDatabaseUrl()) {
    try {
      const pool = deps.getPool();
      user = await deps.findUserByClaims(pool, claims, { emailHint, logger: context });
      if (user) {
        notificationPreferences = await deps.ensureUserNotificationPreference(pool, user.id);
      }
    } catch (error) {
      userLookupFailed = true;
      logError(context, 'portal.me.user_lookup.error', {
        message: error instanceof Error ? error.message : 'unknown_error',
      });
      context.warn?.(
        `portalMe DB lookup failed: ${error instanceof Error ? error.message : 'unknown_error'}`
      );
      user = null;
    }
  }

  if (userLookupFailed) {
    return jsonResponse(503, headers, { error: 'user_lookup_unavailable' });
  }

  // No existing user — auto-register as a Free-tier landlord on first sign-in
  if (!user && deps.hasDatabaseUrl()) {
    try {
      const pool = deps.getPool();
      const newUser = await deps.autoRegisterLandlordByClaims(pool, claims, emailHint);
      if (newUser) {
        user = newUser;
        notificationPreferences = await deps.ensureUserNotificationPreference(pool, user.id);
        logInfo(context, 'portal.me.auto_registered', {
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
          logWarn(context, 'portal.me.landlord_notify_admins.failed', {
            userId: user.id,
            message: notifyErr instanceof Error ? notifyErr.message : String(notifyErr),
          });
        }
      }
    } catch (error) {
      logError(context, 'portal.me.auto_register.error', {
        message: error instanceof Error ? error.message : 'unknown',
        subject: claims.sub,
      });
    }
  }

  if (!user) {
    // Auto-registration skipped (no email in token) or already handled above
    logWarn(context, 'portal.me.forbidden', {
      reason: 'user_not_found',
      subject: claims.sub,
      oid: claims.oid ?? null,
    });
    return jsonResponse(403, headers, { error: 'no_portal_access' });
  }

  const role = String(user.role ?? '').trim().toUpperCase();
  const status = String(user.status ?? '').trim().toUpperCase();
  const isAllowedRole =
    role === Role.TENANT
    || role === Role.LANDLORD
    || role === Role.ADMIN
    || role === Role.AI_AGENT;
  const isActive = status === 'ACTIVE' || status === 'INVITED';
  if (!isAllowedRole || !isActive) {
    const isDisabled = status === 'DISABLED';
    logWarn(context, 'portal.me.forbidden', {
      reason: isDisabled ? 'account_disabled' : 'forbidden_role_or_status',
      role,
      status,
      userId: user.id,
      subject: claims.sub,
      oid: claims.oid ?? null,
    });
    return jsonResponse(403, headers, { error: isDisabled ? 'account_disabled' : 'no_portal_access' });
  }

  logInfo(context, 'portal.me.success', {
    subject: claims.sub,
    oid: claims.oid ?? null,
    resolvedRole: user.role,
    userId: user.id,
  });

  let attachment_upload_limits: { max_image_bytes: number } | null = null;
  if (deps.hasDatabaseUrl()) {
    try {
      const pool = deps.getPool();
      const cfg = await deps.getGlobalAttachmentUploadConfigCached(pool);
      if (cfg) {
        attachment_upload_limits = { max_image_bytes: cfg.max_image_bytes };
      }
    } catch (error) {
      logWarn(context, 'portal.me.attachment_limits.failed', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Tier: auto-assign FREE for LANDLORD users who don't yet have a tier
  let tier: { id: string; name: string; display_name: string; limits: import('../lib/subscriptionTiersRepo.js').TierLimits } | null = null;
  /** SMS opt-in for portal notifications is not gated on subscription tier (landlord plan / lease). */
  const sms_notifications_allowed = true;
  if (deps.hasDatabaseUrl()) {
    try {
      const pool = deps.getPool();
      if (user.role === Role.LANDLORD && !user.tier_id) {
        const freeTier = await getTierByName(pool, 'FREE');
        if (freeTier) {
          await autoAssignFreeTier(pool, user.id, freeTier.id);
          user = { ...user, tier_id: freeTier.id };
          tier = { id: freeTier.id, name: freeTier.name, display_name: freeTier.display_name, limits: freeTier.limits };
        }
      } else if (user.role === Role.TENANT) {
        tier = await getSubscriptionTierForTenantPrimaryLease(pool, user.id);
      } else if (user.tier_id) {
        const t = await getTierById(pool, user.tier_id);
        if (t) tier = { id: t.id, name: t.name, display_name: t.display_name, limits: t.limits };
      }
    } catch (tierErr) {
      logWarn(context, 'portal.me.tier_lookup.failed', {
        message: tierErr instanceof Error ? tierErr.message : String(tierErr),
      });
    }
  }

  return {
    status: 200,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
    jsonBody: {
      subject: claims.sub,
      oid: claims.oid ?? null,
      email: primaryEmailFromClaims(claims) ?? null,
      role: user.role,
      attachment_upload_limits,
      user: {
        ...addProfilePhotoReadUrl(user),
        notification_preferences: notificationPreferences,
        ui_language: user.ui_language ?? null,
        ui_color_scheme: user.ui_color_scheme ?? null,
        portal_tour_completed: Boolean(user.portal_tour_completed),
        tier,
        sms_notifications_allowed,
      },
    },
  };
}

app.http('portalMe', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/me',
  handler: withRateLimit(portalMeHandler),
});
