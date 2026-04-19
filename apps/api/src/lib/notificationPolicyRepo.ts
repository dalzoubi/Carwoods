import type { PoolClient, QueryResult } from './db.js';
import {
  normalizeQuietHoursPreference,
  type QuietHoursPreference,
} from './notificationQuietHours.js';
import { getFlowDefault } from '../config/notificationFlowDefaults.js';
import { getEffectiveFlowDefault } from './notificationFlowDefaultsRepo.js';

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

export type NotificationEventCategory = 'ONBOARDING' | 'MAINTENANCE' | 'SECURITY_COMPLIANCE';
export type NotificationScopeType = 'PROPERTY' | 'REQUEST';

export type UserNotificationFlowPreferenceRow = {
  user_id: string;
  event_type_code: string;
  email_enabled: boolean | null;
  in_app_enabled: boolean | null;
  sms_enabled: boolean | null;
  created_at: Date;
  updated_at: Date;
};

export type UserNotificationPreferenceRow = {
  user_id: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
  sms_enabled: boolean;
  sms_opt_in: boolean;
  quiet_hours_timezone: string | null;
  quiet_hours_start_minute: number | null;
  quiet_hours_end_minute: number | null;
  created_at: Date;
  updated_at: Date;
};

export type NotificationScopeOverrideRow = {
  id: string;
  scope_type: NotificationScopeType;
  scope_id: string;
  user_id: string;
  event_category: NotificationEventCategory;
  email_enabled: boolean | null;
  in_app_enabled: boolean | null;
  sms_enabled: boolean | null;
  sms_opt_in: boolean | null;
  override_reason: string;
  overridden_by_user_id: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
};

type PolicyResolutionRow = {
  email_enabled: boolean;
  in_app_enabled: boolean;
  sms_enabled: boolean;
  sms_opt_in: boolean;
};

function toNullableBit(value: boolean | null | undefined): 1 | 0 | null {
  if (value === true) return 1;
  if (value === false) return 0;
  return null;
}

export function deriveEventCategory(eventTypeCode: string): NotificationEventCategory {
  const code = String(eventTypeCode ?? '').trim().toUpperCase();
  if (code.startsWith('ACCOUNT_')) return 'ONBOARDING';
  if (code.startsWith('SECURITY_') || code.startsWith('COMPLIANCE_')) return 'SECURITY_COMPLIANCE';
  return 'MAINTENANCE';
}

export function isMandatoryNotification(eventTypeCode: string): boolean {
  const category = deriveEventCategory(eventTypeCode);
  return category === 'SECURITY_COMPLIANCE';
}

export async function ensureUserNotificationPreference(
  client: Queryable,
  userId: string
): Promise<UserNotificationPreferenceRow> {
  const upsert = await client.query<UserNotificationPreferenceRow>(
    `MERGE user_notification_preferences AS target
     USING (SELECT $1 AS user_id) AS src
       ON target.user_id = src.user_id
     WHEN NOT MATCHED THEN
       INSERT (user_id, email_enabled, in_app_enabled, sms_enabled, sms_opt_in)
       VALUES ($1, 1, 1, 0, 0)
     OUTPUT INSERTED.user_id, INSERTED.email_enabled, INSERTED.in_app_enabled, INSERTED.sms_enabled,
            INSERTED.sms_opt_in, INSERTED.quiet_hours_timezone, INSERTED.quiet_hours_start_minute,
            INSERTED.quiet_hours_end_minute, INSERTED.created_at, INSERTED.updated_at;`,
    [userId]
  );
  if (upsert.rows[0]) return upsert.rows[0];

  const existing = await client.query<UserNotificationPreferenceRow>(
    `SELECT user_id, email_enabled, in_app_enabled, sms_enabled, sms_opt_in,
            quiet_hours_timezone, quiet_hours_start_minute, quiet_hours_end_minute,
            created_at, updated_at
     FROM user_notification_preferences
     WHERE user_id = $1`,
    [userId]
  );
  return existing.rows[0]!;
}

export async function updateUserNotificationPreference(
  client: Queryable,
  params: {
    userId: string;
    emailEnabled?: boolean;
    inAppEnabled?: boolean;
    smsEnabled?: boolean;
    smsOptIn?: boolean;
    /** When set (including explicit nulls), replaces all three quiet-hour columns. */
    quietHours?: {
      timezone: string | null;
      startMinute: number | null;
      endMinute: number | null;
    };
  }
): Promise<UserNotificationPreferenceRow> {
  await ensureUserNotificationPreference(client, params.userId);
  await client.query(
    `UPDATE user_notification_preferences
        SET email_enabled = COALESCE($2, email_enabled),
            in_app_enabled = COALESCE($3, in_app_enabled),
            sms_enabled = COALESCE($4, sms_enabled),
            sms_opt_in = COALESCE($5, sms_opt_in),
            updated_at = SYSDATETIMEOFFSET()
     WHERE user_id = $1`,
    [
      params.userId,
      toNullableBit(params.emailEnabled),
      toNullableBit(params.inAppEnabled),
      toNullableBit(params.smsEnabled),
      toNullableBit(params.smsOptIn),
    ]
  );
  if (params.quietHours !== undefined) {
    const qh = params.quietHours;
    await client.query(
      `UPDATE user_notification_preferences
          SET quiet_hours_timezone = $2,
              quiet_hours_start_minute = $3,
              quiet_hours_end_minute = $4,
              updated_at = SYSDATETIMEOFFSET()
       WHERE user_id = $1`,
      [params.userId, qh.timezone ?? null, qh.startMinute ?? null, qh.endMinute ?? null]
    );
  }
  const out = await client.query<UserNotificationPreferenceRow>(
    `SELECT user_id, email_enabled, in_app_enabled, sms_enabled, sms_opt_in,
            quiet_hours_timezone, quiet_hours_start_minute, quiet_hours_end_minute,
            created_at, updated_at
     FROM user_notification_preferences
     WHERE user_id = $1`,
    [params.userId]
  );
  return out.rows[0]!;
}

export async function getUserQuietHoursPreference(
  client: Queryable,
  userId: string
): Promise<QuietHoursPreference> {
  const r = await client.query<{
    quiet_hours_timezone: string | null;
    quiet_hours_start_minute: number | null;
    quiet_hours_end_minute: number | null;
  }>(
    `SELECT quiet_hours_timezone, quiet_hours_start_minute, quiet_hours_end_minute
     FROM user_notification_preferences
     WHERE user_id = $1`,
    [userId]
  );
  const row = r.rows[0];
  return normalizeQuietHoursPreference({
    timezone: row?.quiet_hours_timezone ?? null,
    startMinute: row?.quiet_hours_start_minute ?? null,
    endMinute: row?.quiet_hours_end_minute ?? null,
  });
}

export async function listNotificationScopeOverrides(
  client: Queryable,
  params: {
    scopeType: NotificationScopeType;
    scopeId: string;
    userId?: string;
    eventCategory?: NotificationEventCategory;
  }
): Promise<NotificationScopeOverrideRow[]> {
  const r = await client.query<NotificationScopeOverrideRow>(
    `SELECT id, scope_type, scope_id, user_id, event_category, email_enabled, in_app_enabled,
            sms_enabled, sms_opt_in, override_reason, overridden_by_user_id, active, created_at, updated_at
     FROM notification_scope_overrides
     WHERE scope_type = $1
       AND scope_id = $2
       AND active = 1
       AND ($3 IS NULL OR user_id = $3)
       AND ($4 IS NULL OR event_category = $4)
     ORDER BY updated_at DESC`,
    [params.scopeType, params.scopeId, params.userId ?? null, params.eventCategory ?? null]
  );
  return r.rows;
}

export async function upsertNotificationScopeOverride(
  client: PoolClient,
  params: {
    scopeType: NotificationScopeType;
    scopeId: string;
    userId: string;
    eventCategory: NotificationEventCategory;
    emailEnabled?: boolean | null;
    inAppEnabled?: boolean | null;
    smsEnabled?: boolean | null;
    smsOptIn?: boolean | null;
    overrideReason: string;
    overriddenByUserId: string;
    active?: boolean;
  }
): Promise<NotificationScopeOverrideRow> {
  const reason = params.overrideReason.trim();
  const r = await client.query<NotificationScopeOverrideRow>(
    `MERGE notification_scope_overrides AS target
     USING (
       SELECT
         $1 AS scope_type,
         $2 AS scope_id,
         $3 AS user_id,
         $4 AS event_category
     ) AS src
       ON target.scope_type = src.scope_type
      AND target.scope_id = src.scope_id
      AND target.user_id = src.user_id
      AND target.event_category = src.event_category
     WHEN MATCHED THEN
       UPDATE SET
         email_enabled = $5,
         in_app_enabled = $6,
         sms_enabled = $7,
         sms_opt_in = $8,
         override_reason = $9,
         overridden_by_user_id = $10,
         active = $11,
         updated_at = SYSDATETIMEOFFSET()
     WHEN NOT MATCHED THEN
       INSERT (
         id, scope_type, scope_id, user_id, event_category,
         email_enabled, in_app_enabled, sms_enabled, sms_opt_in,
         override_reason, overridden_by_user_id, active
       )
       VALUES (
         NEWID(), $1, $2, $3, $4,
         $5, $6, $7, $8,
         $9, $10, $11
       )
     OUTPUT INSERTED.id, INSERTED.scope_type, INSERTED.scope_id, INSERTED.user_id,
            INSERTED.event_category, INSERTED.email_enabled, INSERTED.in_app_enabled,
            INSERTED.sms_enabled, INSERTED.sms_opt_in, INSERTED.override_reason,
            INSERTED.overridden_by_user_id, INSERTED.active, INSERTED.created_at, INSERTED.updated_at;`,
    [
      params.scopeType,
      params.scopeId,
      params.userId,
      params.eventCategory,
      toNullableBit(params.emailEnabled),
      toNullableBit(params.inAppEnabled),
      toNullableBit(params.smsEnabled),
      toNullableBit(params.smsOptIn),
      reason.slice(0, 1000),
      params.overriddenByUserId,
      params.active === false ? 0 : 1,
    ]
  );
  return r.rows[0]!;
}

export async function resolveNotificationPolicy(
  client: Queryable,
  params: {
    userId: string;
    eventTypeCode: string;
    propertyId?: string | null;
    requestId?: string | null;
  }
): Promise<{ emailEnabled: boolean; inAppEnabled: boolean; smsEnabled: boolean }> {
  const eventCategory = deriveEventCategory(params.eventTypeCode);
  const mandatory = isMandatoryNotification(params.eventTypeCode);
  // Admin-tunable defaults override the compile-time map; falls back to code when no row exists.
  const flowDefault =
    (await getEffectiveFlowDefault(client, params.eventTypeCode))
    ?? getFlowDefault(params.eventTypeCode);

  await ensureUserNotificationPreference(client, params.userId);
  const r = await client.query<{
    global_email_enabled: boolean;
    global_in_app_enabled: boolean;
    global_sms_enabled: boolean;
    global_sms_opt_in: boolean;
    scope_email_enabled: boolean | null;
    scope_in_app_enabled: boolean | null;
    scope_sms_enabled: boolean | null;
    scope_sms_opt_in: boolean | null;
    flow_email_enabled: boolean | null;
    flow_in_app_enabled: boolean | null;
    flow_sms_enabled: boolean | null;
  }>(
    `WITH base AS (
      SELECT email_enabled, in_app_enabled, sms_enabled, sms_opt_in
      FROM user_notification_preferences
      WHERE user_id = $1
    ),
    flow_pref AS (
      SELECT TOP 1 email_enabled, in_app_enabled, sms_enabled
      FROM user_notification_flow_preferences
      WHERE user_id = $1 AND event_type_code = $5
    ),
    property_override AS (
      SELECT TOP 1 email_enabled, in_app_enabled, sms_enabled, sms_opt_in
      FROM notification_scope_overrides
      WHERE scope_type = 'PROPERTY'
        AND scope_id = $2
        AND user_id = $1
        AND event_category = $4
        AND active = 1
      ORDER BY updated_at DESC
    ),
    request_override AS (
      SELECT TOP 1 email_enabled, in_app_enabled, sms_enabled, sms_opt_in
      FROM notification_scope_overrides
      WHERE scope_type = 'REQUEST'
        AND scope_id = $3
        AND user_id = $1
        AND event_category = $4
        AND active = 1
      ORDER BY updated_at DESC
    )
    SELECT
      COALESCE(b.email_enabled, CAST(1 AS BIT)) AS global_email_enabled,
      COALESCE(b.in_app_enabled, CAST(1 AS BIT)) AS global_in_app_enabled,
      COALESCE(b.sms_enabled, CAST(0 AS BIT)) AS global_sms_enabled,
      COALESCE(b.sms_opt_in, CAST(0 AS BIT)) AS global_sms_opt_in,
      COALESCE(ro.email_enabled, po.email_enabled) AS scope_email_enabled,
      COALESCE(ro.in_app_enabled, po.in_app_enabled) AS scope_in_app_enabled,
      COALESCE(ro.sms_enabled, po.sms_enabled) AS scope_sms_enabled,
      COALESCE(ro.sms_opt_in, po.sms_opt_in) AS scope_sms_opt_in,
      fp.email_enabled AS flow_email_enabled,
      fp.in_app_enabled AS flow_in_app_enabled,
      fp.sms_enabled AS flow_sms_enabled
    FROM base b
    LEFT JOIN property_override po ON 1 = 1
    LEFT JOIN request_override ro ON 1 = 1
    LEFT JOIN flow_pref fp ON 1 = 1`,
    [
      params.userId,
      params.propertyId ?? null,
      params.requestId ?? null,
      eventCategory,
      String(params.eventTypeCode ?? '').trim().toUpperCase(),
    ]
  );

  const row = r.rows[0] ?? {
    global_email_enabled: true,
    global_in_app_enabled: true,
    global_sms_enabled: false,
    global_sms_opt_in: false,
    scope_email_enabled: null,
    scope_in_app_enabled: null,
    scope_sms_enabled: null,
    scope_sms_opt_in: null,
    flow_email_enabled: null,
    flow_in_app_enabled: null,
    flow_sms_enabled: null,
  };

  // Mandatory flows (e.g. SECURITY_*) always deliver on the channels their
  // default declares; users cannot suppress them, but the scope overrides for
  // SECURITY_COMPLIANCE still apply (admins may redirect a mandatory alert).
  if (mandatory || flowDefault?.userOverridable === false) {
    const scoped = (scope: boolean | null, dflt: boolean): boolean =>
      scope === null || scope === undefined ? dflt : Boolean(scope);
    return {
      emailEnabled: scoped(row.scope_email_enabled, flowDefault?.email ?? true),
      inAppEnabled: scoped(row.scope_in_app_enabled, flowDefault?.inApp ?? true),
      smsEnabled:
        scoped(row.scope_sms_enabled, flowDefault?.sms ?? false)
        && Boolean(row.global_sms_opt_in),
    };
  }

  // Resolution for overridable flows, per channel:
  //   1. scope override (PROPERTY or REQUEST)  — if explicit, wins
  //   2. per-flow user pref                    — if explicit, wins
  //   3. compile-time flow default AND global master toggle must both be ON
  const resolveChannel = (
    scopeValue: boolean | null,
    flowValue: boolean | null,
    flowDefaultChannel: boolean,
    globalMaster: boolean
  ): boolean => {
    if (scopeValue !== null && scopeValue !== undefined) return Boolean(scopeValue);
    if (flowValue !== null && flowValue !== undefined) {
      return Boolean(flowValue) && globalMaster;
    }
    return flowDefaultChannel && globalMaster;
  };

  const emailEnabled = resolveChannel(
    row.scope_email_enabled,
    row.flow_email_enabled,
    flowDefault?.email ?? true,
    Boolean(row.global_email_enabled)
  );
  const inAppEnabled = resolveChannel(
    row.scope_in_app_enabled,
    row.flow_in_app_enabled,
    flowDefault?.inApp ?? true,
    Boolean(row.global_in_app_enabled)
  );
  const smsResolved = resolveChannel(
    row.scope_sms_enabled,
    row.flow_sms_enabled,
    flowDefault?.sms ?? false,
    Boolean(row.global_sms_enabled)
  );

  return {
    emailEnabled,
    inAppEnabled,
    smsEnabled: smsResolved && Boolean(row.global_sms_opt_in),
  };
}

export async function listUserNotificationFlowPreferences(
  client: Queryable,
  userId: string
): Promise<UserNotificationFlowPreferenceRow[]> {
  const r = await client.query<UserNotificationFlowPreferenceRow>(
    `SELECT user_id, event_type_code, email_enabled, in_app_enabled, sms_enabled,
            created_at, updated_at
     FROM user_notification_flow_preferences
     WHERE user_id = $1
     ORDER BY event_type_code`,
    [userId]
  );
  return r.rows;
}

export async function upsertUserNotificationFlowPreference(
  client: Queryable,
  params: {
    userId: string;
    eventTypeCode: string;
    emailEnabled?: boolean | null;
    inAppEnabled?: boolean | null;
    smsEnabled?: boolean | null;
  }
): Promise<UserNotificationFlowPreferenceRow> {
  const code = String(params.eventTypeCode ?? '').trim().toUpperCase();
  if (!code) throw new Error('event_type_code_required');
  const flowDefault = getFlowDefault(code);
  if (!flowDefault) throw new Error('unknown_event_type_code');
  if (!flowDefault.userOverridable) throw new Error('flow_not_user_overridable');

  const email = toNullableBit(params.emailEnabled);
  const inApp = toNullableBit(params.inAppEnabled);
  const sms = toNullableBit(params.smsEnabled);

  // If every channel was cleared back to null (match default), drop the row.
  if (email === null && inApp === null && sms === null) {
    await client.query(
      `DELETE FROM user_notification_flow_preferences
       WHERE user_id = $1 AND event_type_code = $2`,
      [params.userId, code]
    );
    return {
      user_id: params.userId,
      event_type_code: code,
      email_enabled: null,
      in_app_enabled: null,
      sms_enabled: null,
      created_at: new Date(),
      updated_at: new Date(),
    };
  }

  const r = await client.query<UserNotificationFlowPreferenceRow>(
    `MERGE user_notification_flow_preferences AS target
     USING (SELECT $1 AS user_id, $2 AS event_type_code) AS src
       ON target.user_id = src.user_id AND target.event_type_code = src.event_type_code
     WHEN MATCHED THEN
       UPDATE SET email_enabled = $3,
                  in_app_enabled = $4,
                  sms_enabled = $5,
                  updated_at = SYSDATETIMEOFFSET()
     WHEN NOT MATCHED THEN
       INSERT (user_id, event_type_code, email_enabled, in_app_enabled, sms_enabled)
       VALUES ($1, $2, $3, $4, $5)
     OUTPUT INSERTED.user_id, INSERTED.event_type_code, INSERTED.email_enabled,
            INSERTED.in_app_enabled, INSERTED.sms_enabled,
            INSERTED.created_at, INSERTED.updated_at;`,
    [params.userId, code, email, inApp, sms]
  );
  return r.rows[0]!;
}
