import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { getPool } from '../lib/db.js';
import { jsonResponse, mapDomainError, requireLandlordOrAdmin } from '../lib/managementRequest.js';
import { validationError } from '../domain/errors.js';
import { getTierLimitsForUserId } from '../lib/subscriptionTierCapabilities.js';
import { getTierByName } from '../lib/subscriptionTiersRepo.js';
import {
  deriveEventCategory,
  listNotificationScopeOverrides,
  upsertNotificationScopeOverride,
  type NotificationEventCategory,
  type NotificationScopeType,
} from '../lib/notificationPolicyRepo.js';
import { writeAudit } from '../lib/auditRepo.js';
import { Role } from '../domain/constants.js';
import { logError, logInfo, logWarn } from '../lib/serverLogger.js';
import { profilePhotoReadUrlFromStoragePath } from '../lib/userProfilePhotoUrl.js';

type NotificationPolicyUserOptionDb = {
  user_id: string;
  display_name: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
  profile_photo_storage_path: string | null;
};

type NotificationPolicyUserOption = {
  user_id: string;
  display_name: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
  profile_photo_url: string | null;
};

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v.trim() : undefined;
}

function asBoolOrNull(v: unknown): boolean | null | undefined {
  if (v === null) return null;
  if (typeof v === 'boolean') return v;
  return undefined;
}

function normalizeScopeType(v: string | undefined): NotificationScopeType | null {
  const value = String(v ?? '').trim().toUpperCase();
  if (value === 'PROPERTY' || value === 'REQUEST') return value;
  return null;
}

function normalizeEventCategory(v: string | undefined, fallbackEventCode?: string): NotificationEventCategory {
  const value = String(v ?? '').trim().toUpperCase();
  if (value === 'ONBOARDING' || value === 'MAINTENANCE' || value === 'SECURITY_COMPLIANCE') {
    return value;
  }
  return deriveEventCategory(fallbackEventCode ?? 'REQUEST_MESSAGE_CREATED');
}

async function actorCanManageScope(
  request: HttpRequest,
  context: InvocationContext
): Promise<{ ok: true; ctx: { userId: string; role: string; headers: Record<string, string> } } | { ok: false; response: HttpResponseInit }> {
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate;
  return {
    ok: true,
    ctx: {
      userId: gate.ctx.user.id,
      role: gate.ctx.user.role,
      headers: gate.ctx.headers,
    },
  };
}

async function landlordOwnsScope(
  actorUserId: string,
  scopeType: NotificationScopeType,
  scopeId: string
): Promise<boolean> {
  const pool = getPool();
  if (scopeType === 'PROPERTY') {
    const r = await pool.query<{ ok: number }>(
      `SELECT TOP 1 1 AS ok
       FROM properties
       WHERE id = $1
         AND created_by = $2
         AND deleted_at IS NULL`,
      [scopeId, actorUserId]
    );
    return r.rows.length > 0;
  }
  const r = await pool.query<{ ok: number }>(
    `SELECT TOP 1 1 AS ok
     FROM maintenance_requests mr
     JOIN properties p ON p.id = mr.property_id
     WHERE mr.id = $1
       AND mr.deleted_at IS NULL
       AND p.created_by = $2
       AND p.deleted_at IS NULL`,
    [scopeId, actorUserId]
  );
  return r.rows.length > 0;
}

async function listScopeUserOptions(
  scopeType: NotificationScopeType,
  scopeId: string,
  context: InvocationContext | undefined,
  actorRole: string
): Promise<NotificationPolicyUserOption[]> {
  const pool = getPool();
  const scopePredicate =
    scopeType === 'PROPERTY'
      ? `p.id = $1 AND p.deleted_at IS NULL`
      : `mr.id = $1 AND mr.deleted_at IS NULL`;

  const isAdmin = actorRole.trim().toUpperCase() === Role.ADMIN;

  const scopeUserCte = isAdmin
    ? scopeType === 'PROPERTY'
      ? `SELECT p.created_by AS user_id
         FROM properties p
         WHERE p.id = $1
           AND p.deleted_at IS NULL
         UNION
         SELECT lt.user_id
         FROM leases l
         JOIN lease_tenants lt ON lt.lease_id = l.id
         WHERE l.property_id = $1
           AND l.deleted_at IS NULL`
      : `SELECT mr.submitted_by_user_id AS user_id
         FROM maintenance_requests mr
         WHERE mr.id = $1
           AND mr.deleted_at IS NULL
         UNION
         SELECT p.created_by AS user_id
         FROM maintenance_requests mr
         JOIN properties p ON p.id = mr.property_id
         WHERE mr.id = $1
           AND mr.deleted_at IS NULL
           AND p.deleted_at IS NULL
         UNION
         SELECT lt.user_id
         FROM maintenance_requests mr
         JOIN lease_tenants lt ON lt.lease_id = mr.lease_id
         WHERE mr.id = $1
           AND mr.deleted_at IS NULL`
    : scopeType === 'PROPERTY'
      ? `SELECT lt.user_id
         FROM leases l
         JOIN lease_tenants lt ON lt.lease_id = l.id
         WHERE l.property_id = $1
           AND l.deleted_at IS NULL`
      : `SELECT lt.user_id
         FROM maintenance_requests mr
         JOIN lease_tenants lt ON lt.lease_id = mr.lease_id
         WHERE mr.id = $1
           AND mr.deleted_at IS NULL
         UNION
         SELECT mr.submitted_by_user_id
         FROM maintenance_requests mr
         WHERE mr.id = $1
           AND mr.deleted_at IS NULL
           AND mr.submitted_by_user_id IS NOT NULL`;

  const adminUnion = isAdmin
    ? `
       UNION
       SELECT u.id AS user_id
       FROM users u
       WHERE UPPER(u.role) = '${Role.ADMIN}'
         AND UPPER(ISNULL(u.status, '')) IN ('ACTIVE', 'INVITED')`
    : '';

  const tenantFilter = isAdmin
    ? ''
    : ` AND UPPER(ISNULL(u.role, '')) = '${Role.TENANT}'
         AND UPPER(ISNULL(u.status, '')) IN ('ACTIVE', 'INVITED')`;

  const rows = await pool.query<NotificationPolicyUserOptionDb>(
    `WITH scoped_scope AS (
       SELECT 1 AS ok
       FROM ${scopeType === 'PROPERTY' ? 'properties p' : 'maintenance_requests mr'}
       WHERE ${scopePredicate}
     ),
     scoped_users AS (
       ${scopeUserCte}
       ${adminUnion}
     )
     SELECT DISTINCT
       u.id AS user_id,
       CASE
         WHEN LTRIM(RTRIM(ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, ''))) = '' THEN u.email
         ELSE LTRIM(RTRIM(ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '')))
       END AS display_name,
       u.role,
       u.first_name,
       u.last_name,
       u.profile_photo_storage_path
     FROM scoped_scope ss
     JOIN scoped_users su ON 1 = 1
     JOIN users u ON u.id = su.user_id
     WHERE u.id IS NOT NULL
       ${tenantFilter}
     ORDER BY display_name ASC`,
    [scopeId]
  );

  logInfo(context, 'notification.policies.scope_users.resolved', {
    scopeType,
    scopeId,
    actorRole: actorRole.trim().toUpperCase(),
    userCount: rows.rows.length,
  });
  return rows.rows.map((row) => {
    const { profile_photo_storage_path, ...rest } = row;
    return {
      ...rest,
      profile_photo_url: profilePhotoReadUrlFromStoragePath(profile_photo_storage_path),
    };
  });
}

/** Non-admin callers may only set overrides for tenant users tied to the scope (not admins, landlords, or unrelated users). */
async function isTenantPolicyTargetInScope(
  scopeType: NotificationScopeType,
  scopeId: string,
  targetUserId: string
): Promise<boolean> {
  const pool = getPool();
  const tenantRole = Role.TENANT;
  if (scopeType === 'PROPERTY') {
    const r = await pool.query<{ ok: number }>(
      `SELECT TOP 1 1 AS ok
       FROM leases l
       JOIN lease_tenants lt ON lt.lease_id = l.id
       JOIN users u ON u.id = lt.user_id
       WHERE l.property_id = $1
         AND l.deleted_at IS NULL
         AND u.id = $2
         AND UPPER(ISNULL(u.role, '')) = $3
         AND UPPER(ISNULL(u.status, '')) IN ('ACTIVE', 'INVITED')`,
      [scopeId, targetUserId, tenantRole]
    );
    return r.rows.length > 0;
  }
  const r = await pool.query<{ ok: number }>(
    `SELECT TOP 1 1 AS ok
     FROM maintenance_requests mr
     WHERE mr.id = $1
       AND mr.deleted_at IS NULL
       AND (
         EXISTS (
           SELECT 1
           FROM lease_tenants lt
           JOIN users u ON u.id = lt.user_id
           WHERE lt.lease_id = mr.lease_id
             AND u.id = $2
             AND UPPER(ISNULL(u.role, '')) = $3
             AND UPPER(ISNULL(u.status, '')) IN ('ACTIVE', 'INVITED')
         )
         OR (
           mr.submitted_by_user_id = $2
           AND EXISTS (
             SELECT 1
             FROM users u
             WHERE u.id = $2
               AND UPPER(ISNULL(u.role, '')) = $3
               AND UPPER(ISNULL(u.status, '')) IN ('ACTIVE', 'INVITED')
           )
         )
       )`,
    [scopeId, targetUserId, tenantRole]
  );
  return r.rows.length > 0;
}

async function listNotificationPoliciesHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  logInfo(context, 'notification.policies.list.start', { method: request.method });
  const auth = await actorCanManageScope(request, context);
  if (!auth.ok) return auth.response;
  const { headers, role, userId } = auth.ctx;

  if (request.method !== 'GET') {
    return jsonResponse(405, headers, { error: 'method_not_allowed' });
  }

  const scopeType = normalizeScopeType(request.query.get('scope_type') ?? undefined);
  const scopeId = asString(request.query.get('scope_id') ?? undefined);
  if (!scopeType || !scopeId) {
    logWarn(context, 'notification.policies.list.invalid_scope', { scopeType, scopeId });
    return jsonResponse(400, headers, { error: 'invalid_scope' });
  }
  if (role !== Role.ADMIN) {
    const owns = await landlordOwnsScope(userId, scopeType, scopeId);
    if (!owns) {
      logWarn(context, 'notification.policies.list.forbidden_scope', { actorUserId: userId, scopeType, scopeId });
      return jsonResponse(403, headers, { error: 'forbidden' });
    }
  }

  const userIdFilter = asString(request.query.get('user_id') ?? undefined);
  const categoryRaw = asString(request.query.get('event_category') ?? undefined);
  const eventCategory = categoryRaw
    ? normalizeEventCategory(categoryRaw)
    : undefined;

  const scopeUsers = await listScopeUserOptions(scopeType, scopeId, context, role);
  const allowedTenantIds = new Set(scopeUsers.map((u) => u.user_id));

  const rows = await listNotificationScopeOverrides(getPool(), {
    scopeType,
    scopeId,
    userId: userIdFilter,
    eventCategory,
  });
  const policies =
    role === Role.ADMIN ? rows : rows.filter((row) => allowedTenantIds.has(row.user_id));
  logInfo(context, 'notification.policies.list.success', {
    actorUserId: userId,
    actorRole: role,
    scopeType,
    scopeId,
    policiesCount: policies.length,
    usersCount: scopeUsers.length,
  });
  return jsonResponse(200, headers, { policies, users: scopeUsers });
}

async function patchNotificationPolicyHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  logInfo(context, 'notification.policies.patch.start', { method: request.method });
  const auth = await actorCanManageScope(request, context);
  if (!auth.ok) return auth.response;
  const { headers, role, userId } = auth.ctx;

  if (request.method !== 'PATCH') {
    return jsonResponse(405, headers, { error: 'method_not_allowed' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, headers, { error: 'invalid_json' });
  }
  const payload = asRecord(body);
  const scopeType = normalizeScopeType(asString(payload.scope_type));
  const scopeId = asString(payload.scope_id);
  const targetUserId = asString(payload.user_id);
  const eventCategory = normalizeEventCategory(
    asString(payload.event_category),
    asString(payload.event_type_code)
  );
  const overrideReason = asString(payload.override_reason);
  if (!scopeType || !scopeId || !targetUserId || !overrideReason) {
    logWarn(context, 'notification.policies.patch.invalid_payload', {
      scopeType,
      scopeId,
      targetUserId,
      hasOverrideReason: Boolean(overrideReason),
    });
    return jsonResponse(400, headers, { error: 'invalid_payload' });
  }
  if (role !== Role.ADMIN) {
    const owns = await landlordOwnsScope(userId, scopeType, scopeId);
    if (!owns) {
      logWarn(context, 'notification.policies.patch.forbidden_scope', { actorUserId: userId, scopeType, scopeId });
      return jsonResponse(403, headers, { error: 'forbidden' });
    }
    const tenantOk = await isTenantPolicyTargetInScope(scopeType, scopeId, targetUserId);
    if (!tenantOk) {
      logWarn(context, 'notification.policies.patch.forbidden_target_user', {
        actorUserId: userId,
        scopeType,
        scopeId,
        targetUserId,
      });
      return jsonResponse(403, headers, { error: 'forbidden_target_user' });
    }
  }

  const emailEnabled = asBoolOrNull(payload.email_enabled);
  const inAppEnabled = asBoolOrNull(payload.in_app_enabled);
  const smsEnabled = asBoolOrNull(payload.sms_enabled);
  const smsOptIn = asBoolOrNull(payload.sms_opt_in);
  const activeValue = asBoolOrNull(payload.active);

  try {
    if (role !== Role.ADMIN) {
      const wantsSms = smsEnabled === true || smsOptIn === true;
      if (wantsSms) {
        let lim = await getTierLimitsForUserId(getPool(), userId);
        if (!lim) {
          const free = await getTierByName(getPool(), 'FREE');
          lim = free?.limits ?? null;
        }
        if (lim && !lim.notification_channels.includes('sms')) {
          throw validationError('sms_not_available');
        }
      }
    }
  } catch (e) {
    const mapped = mapDomainError(e, headers);
    if (mapped) return mapped;
    throw e;
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const saved = await upsertNotificationScopeOverride(client, {
      scopeType,
      scopeId,
      userId: targetUserId,
      eventCategory,
      emailEnabled,
      inAppEnabled,
      smsEnabled,
      smsOptIn,
      overrideReason,
      overriddenByUserId: userId,
      active: activeValue === false ? false : true,
    });
    await writeAudit(client, {
      actorUserId: userId,
      entityType: 'NOTIFICATION_POLICY_OVERRIDE',
      entityId: saved.id,
      action: 'UPSERT',
      before: null,
      after: saved,
    });
    await client.query('COMMIT');
    logInfo(context, 'notification.policies.patch.success', {
      actorUserId: userId,
      actorRole: role,
      scopeType,
      scopeId,
      targetUserId,
      eventCategory,
      policyId: saved.id,
    });
    return jsonResponse(200, headers, { policy: saved });
  } catch (error) {
    await client.query('ROLLBACK');
    logError(context, 'notification.policies.patch.error', {
      actorUserId: userId,
      scopeType,
      scopeId,
      targetUserId,
      message: error instanceof Error ? error.message : 'unknown_error',
    });
    throw error;
  } finally {
    client.release();
  }
}

/** Single route: Azure Functions v4 rejects two functions with the same `route` even for different methods. */
async function landlordNotificationPoliciesHttp(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === 'GET') {
    return listNotificationPoliciesHandler(request, context);
  }
  if (request.method === 'PATCH') {
    return patchNotificationPolicyHandler(request, context);
  }
  if (request.method === 'OPTIONS') {
    const auth = await actorCanManageScope(request, context);
    return auth.ok ? jsonResponse(405, auth.ctx.headers, { error: 'method_not_allowed' }) : auth.response;
  }
  const auth = await actorCanManageScope(request, context);
  if (!auth.ok) return auth.response;
  return jsonResponse(405, auth.ctx.headers, { error: 'method_not_allowed' });
}

app.http('landlordNotificationPolicies', {
  methods: ['GET', 'PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/notifications/policies',
  handler: landlordNotificationPoliciesHttp,
});
