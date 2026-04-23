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
import { findUserByClaims, autoAssignFreeTier } from '../lib/usersRepo.js';
import { getGlobalAttachmentUploadConfigCached } from '../lib/attachmentUploadConfigRepo.js';
import { getTierById, getTierByName } from '../lib/subscriptionTiersRepo.js';
import { addProfilePhotoReadUrl } from '../lib/userProfilePhotoUrl.js';
import {
  ensureUserNotificationPreference,
  listUserNotificationFlowPreferences,
} from '../lib/notificationPolicyRepo.js';
import { NOTIFICATION_FLOW_DEFAULTS } from '../config/notificationFlowDefaults.js';
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
  ensureUserNotificationPreference: typeof ensureUserNotificationPreference;
  listUserNotificationFlowPreferences: typeof listUserNotificationFlowPreferences;
  getGlobalAttachmentUploadConfigCached: typeof getGlobalAttachmentUploadConfigCached;
};

const DEFAULT_PORTAL_ME_DEPS: PortalMeDeps = {
  hasDatabaseUrl,
  getPool,
  verifyAccessToken,
  authConfigured,
  findUserByClaims,
  ensureUserNotificationPreference,
  listUserNotificationFlowPreferences,
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

type ClaimsForMe = Awaited<ReturnType<typeof verifyAccessToken>>;

function buildNeedsRoleSelectionResponse(
  claims: ClaimsForMe,
  emailHint: string | undefined,
  headers: Record<string, string>,
  context: InvocationContext,
  logReason: 'no_user' | 'disabled'
): HttpResponseInit | null {
  const tokenEmail = primaryEmailFromClaims(claims) ?? emailHint ?? null;
  if (!tokenEmail) {
    return null;
  }
  logInfo(
    context,
    logReason === 'disabled' ? 'portal.me.needs_role_selection_reactivation' : 'portal.me.needs_role_selection',
    { subject: claims.sub, oid: claims.oid ?? null, reason: logReason }
  );
  return {
    status: 200,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
    jsonBody: {
      needs_role_selection: true,
      email: tokenEmail,
      suggested_first_name:
        claims.given_name
        ?? (claims.name ? claims.name.split(' ')[0] : null)
        ?? null,
      suggested_last_name:
        claims.family_name
        ?? (claims.name ? claims.name.split(' ').slice(1).join(' ') : null)
        ?? null,
    },
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
  let flowPreferences: Awaited<ReturnType<typeof listUserNotificationFlowPreferences>> = [];
  let userLookupFailed = false;
  if (deps.hasDatabaseUrl()) {
    try {
      const pool = deps.getPool();
      user = await deps.findUserByClaims(pool, claims, { emailHint, logger: context });
      if (user) {
        const st = String(user.status ?? '').trim().toUpperCase();
        if (st !== 'DISABLED') {
          notificationPreferences = await deps.ensureUserNotificationPreference(pool, user.id);
          flowPreferences = await deps.listUserNotificationFlowPreferences(pool, user.id);
        }
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

  // No existing user — ask the client to show the role-selection gate.
  // We deliberately do NOT auto-create anything here: a tenant who mistakes
  // the landlord portal for their tenant login used to become a landlord
  // automatically, which is the bug this flow fixes. Landlord rows are now
  // created only by the explicit POST /api/portal/register/landlord call.
  if (!user) {
    const res = buildNeedsRoleSelectionResponse(claims, emailHint, headers, context, 'no_user');
    if (res) {
      return res;
    }
    // No email claim at all — we can't even show a useful gate. Deny access.
    logWarn(context, 'portal.me.forbidden', {
      reason: 'user_not_found_no_email',
      subject: claims.sub,
      oid: claims.oid ?? null,
    });
    return jsonResponse(403, headers, { error: 'no_portal_access' });
  }

  const status = String(user.status ?? '').trim().toUpperCase();
  // Soft-deleted or removed tenants keep a DISABLED row; send them back through the
  // same landlord/tenant gate as a first-time user instead of account_disabled 403.
  if (status === 'DISABLED') {
    const res = buildNeedsRoleSelectionResponse(claims, emailHint, headers, context, 'disabled');
    if (res) {
      return res;
    }
    logWarn(context, 'portal.me.forbidden', {
      reason: 'disabled_user_no_email',
      userId: user.id,
      subject: claims.sub,
      oid: claims.oid ?? null,
    });
    return jsonResponse(403, headers, { error: 'no_portal_access' });
  }

  const role = String(user.role ?? '').trim().toUpperCase();
  const isAllowedRole =
    role === Role.TENANT
    || role === Role.LANDLORD
    || role === Role.ADMIN
    || role === Role.AI_AGENT;
  const isActive = status === 'ACTIVE' || status === 'INVITED';
  if (!isAllowedRole || !isActive) {
    logWarn(context, 'portal.me.forbidden', {
      reason: 'forbidden_role_or_status',
      role,
      status,
      userId: user.id,
      subject: claims.sub,
      oid: claims.oid ?? null,
    });
    return jsonResponse(403, headers, { error: 'no_portal_access' });
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
        notification_flow_preferences: flowPreferences.map((p) => ({
          event_type_code: p.event_type_code,
          email_enabled: p.email_enabled,
          in_app_enabled: p.in_app_enabled,
          sms_enabled: p.sms_enabled,
        })),
        notification_flow_catalog: Object.entries(NOTIFICATION_FLOW_DEFAULTS).map(([code, f]) => ({
          event_type_code: code,
          category: f.category,
          role: f.role,
          default_email: f.email,
          default_in_app: f.inApp,
          default_sms: f.sms,
          user_overridable: f.userOverridable,
          quiet_hours_bypass: f.quietHoursBypass,
          label_key: f.labelKey,
          info_key: f.infoKey,
        })),
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
