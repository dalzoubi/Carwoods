import type { PoolClient, QueryResult } from './db.js';
import {
  NOTIFICATION_FLOW_DEFAULTS,
  type NotificationFlowDefault,
} from '../config/notificationFlowDefaults.js';

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

export type NotificationFlowDefaultsConfigRow = {
  event_type_code: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
  sms_enabled: boolean;
  quiet_hours_bypass: boolean | null;
  updated_by_user_id: string | null;
  updated_at: Date;
};

/**
 * Effective per-flow default: compile-time map merged with admin override row
 * if one exists. Admin rows are sparse — missing rows fall through to code.
 */
export type EffectiveFlowDefault = NotificationFlowDefault & {
  eventTypeCode: string;
  source: 'CODE' | 'ADMIN';
  updatedByUserId: string | null;
  updatedAt: Date | null;
};

export async function listNotificationFlowDefaultOverrides(
  client: Queryable
): Promise<NotificationFlowDefaultsConfigRow[]> {
  const r = await client.query<NotificationFlowDefaultsConfigRow>(
    `SELECT event_type_code, email_enabled, in_app_enabled, sms_enabled,
            quiet_hours_bypass, updated_by_user_id, updated_at
     FROM notification_flow_defaults_config`
  );
  return r.rows;
}

export async function listEffectiveFlowDefaults(
  client: Queryable
): Promise<EffectiveFlowDefault[]> {
  const overrides = await listNotificationFlowDefaultOverrides(client);
  const overrideByCode = new Map(overrides.map((row) => [row.event_type_code, row]));
  return Object.entries(NOTIFICATION_FLOW_DEFAULTS).map(([code, codeDefault]) => {
    const ov = overrideByCode.get(code);
    if (!ov) {
      return {
        ...codeDefault,
        eventTypeCode: code,
        source: 'CODE',
        updatedByUserId: null,
        updatedAt: null,
      };
    }
    return {
      ...codeDefault,
      eventTypeCode: code,
      email: Boolean(ov.email_enabled),
      inApp: Boolean(ov.in_app_enabled),
      sms: Boolean(ov.sms_enabled),
      quietHoursBypass: ov.quiet_hours_bypass === null
        ? codeDefault.quietHoursBypass
        : Boolean(ov.quiet_hours_bypass),
      source: 'ADMIN',
      updatedByUserId: ov.updated_by_user_id,
      updatedAt: ov.updated_at,
    };
  });
}

/**
 * Fast lookup used by resolveNotificationPolicy for a single event code.
 * Falls back to the compile-time map when no admin override exists.
 */
export async function getEffectiveFlowDefault(
  client: Queryable,
  eventTypeCode: string
): Promise<NotificationFlowDefault | null> {
  const code = String(eventTypeCode ?? '').trim().toUpperCase();
  const codeDefault = NOTIFICATION_FLOW_DEFAULTS[code];
  if (!codeDefault) return null;
  const r = await client.query<NotificationFlowDefaultsConfigRow>(
    `SELECT TOP 1 event_type_code, email_enabled, in_app_enabled, sms_enabled,
            quiet_hours_bypass, updated_by_user_id, updated_at
     FROM notification_flow_defaults_config
     WHERE event_type_code = $1`,
    [code]
  );
  const ov = r.rows[0];
  if (!ov) return codeDefault;
  return {
    ...codeDefault,
    email: Boolean(ov.email_enabled),
    inApp: Boolean(ov.in_app_enabled),
    sms: Boolean(ov.sms_enabled),
    quietHoursBypass: ov.quiet_hours_bypass === null
      ? codeDefault.quietHoursBypass
      : Boolean(ov.quiet_hours_bypass),
  };
}

export async function upsertNotificationFlowDefaultOverride(
  client: PoolClient,
  params: {
    eventTypeCode: string;
    emailEnabled: boolean;
    inAppEnabled: boolean;
    smsEnabled: boolean;
    quietHoursBypass?: boolean | null;
    updatedByUserId: string;
  }
): Promise<NotificationFlowDefaultsConfigRow> {
  const code = String(params.eventTypeCode ?? '').trim().toUpperCase();
  if (!code || !NOTIFICATION_FLOW_DEFAULTS[code]) {
    throw new Error('unknown_event_type_code');
  }
  const r = await client.query<NotificationFlowDefaultsConfigRow>(
    `MERGE notification_flow_defaults_config AS target
     USING (SELECT $1 AS event_type_code) AS src
       ON target.event_type_code = src.event_type_code
     WHEN MATCHED THEN
       UPDATE SET email_enabled = $2,
                  in_app_enabled = $3,
                  sms_enabled = $4,
                  quiet_hours_bypass = $5,
                  updated_by_user_id = $6,
                  updated_at = SYSDATETIMEOFFSET()
     WHEN NOT MATCHED THEN
       INSERT (event_type_code, email_enabled, in_app_enabled, sms_enabled,
               quiet_hours_bypass, updated_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
     OUTPUT INSERTED.event_type_code, INSERTED.email_enabled, INSERTED.in_app_enabled,
            INSERTED.sms_enabled, INSERTED.quiet_hours_bypass, INSERTED.updated_by_user_id,
            INSERTED.updated_at;`,
    [
      code,
      params.emailEnabled ? 1 : 0,
      params.inAppEnabled ? 1 : 0,
      params.smsEnabled ? 1 : 0,
      params.quietHoursBypass === null || params.quietHoursBypass === undefined
        ? null
        : params.quietHoursBypass ? 1 : 0,
      params.updatedByUserId,
    ]
  );
  return r.rows[0]!;
}

export async function deleteNotificationFlowDefaultOverride(
  client: PoolClient,
  eventTypeCode: string
): Promise<void> {
  const code = String(eventTypeCode ?? '').trim().toUpperCase();
  await client.query(
    `DELETE FROM notification_flow_defaults_config WHERE event_type_code = $1`,
    [code]
  );
}
