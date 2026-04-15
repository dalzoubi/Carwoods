import type { QueryResult } from './db.js';

/** Shape returned to the SPA (`portal.me`, admin tiers); includes legacy `notification_channels` array. */
export type TierLimits = {
  max_properties: number;
  max_tenants: number;
  ai_routing_enabled: boolean;
  csv_export_enabled: boolean;
  custom_notifications_enabled: boolean;
  notification_channels: string[];
  maintenance_request_history_days: number;
  request_photo_video_attachments_enabled: boolean;
  property_apply_visibility_editable: boolean;
  property_elsa_auto_send_editable: boolean;
};

export type TierRow = {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  limits: TierLimits;
};

type TierRowRaw = {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  is_active: boolean | Buffer;
  created_at: Date | string;
  max_properties: number;
  max_tenants: number;
  ai_routing_enabled: boolean | Buffer;
  csv_export_enabled: boolean | Buffer;
  custom_notifications_enabled: boolean | Buffer;
  notification_email_enabled: boolean | Buffer;
  notification_sms_enabled: boolean | Buffer;
  maintenance_request_history_days: number;
  request_photo_video_attachments_enabled: boolean | Buffer;
  property_apply_visibility_editable: boolean | Buffer;
  property_elsa_auto_send_editable: boolean | Buffer;
};

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

const TIER_COLUMNS = `id, name, display_name, description, is_active, created_at,
  max_properties, max_tenants, ai_routing_enabled, csv_export_enabled,
  custom_notifications_enabled, notification_email_enabled, notification_sms_enabled,
  maintenance_request_history_days, request_photo_video_attachments_enabled,
  property_apply_visibility_editable, property_elsa_auto_send_editable`;

function asBool(v: boolean | Buffer | undefined): boolean {
  if (typeof v === 'boolean') return v;
  if (Buffer.isBuffer(v)) return v[0] === 1;
  return Boolean(v);
}

function asDateString(v: Date | string): string {
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function rawToLimits(raw: TierRowRaw): TierLimits {
  const channels: string[] = ['in_app'];
  if (asBool(raw.notification_email_enabled)) channels.push('email');
  if (asBool(raw.notification_sms_enabled)) channels.push('sms');
  return {
    max_properties: Number(raw.max_properties),
    max_tenants: Number(raw.max_tenants),
    ai_routing_enabled: asBool(raw.ai_routing_enabled),
    csv_export_enabled: asBool(raw.csv_export_enabled),
    custom_notifications_enabled: asBool(raw.custom_notifications_enabled),
    notification_channels: channels,
    maintenance_request_history_days: Number(raw.maintenance_request_history_days),
    request_photo_video_attachments_enabled: asBool(raw.request_photo_video_attachments_enabled),
    property_apply_visibility_editable: asBool(raw.property_apply_visibility_editable),
    property_elsa_auto_send_editable: asBool(raw.property_elsa_auto_send_editable),
  };
}

function mapRawToTierRow(raw: TierRowRaw): TierRow {
  return {
    id: String(raw.id),
    name: String(raw.name),
    display_name: String(raw.display_name),
    description: raw.description == null ? null : String(raw.description),
    is_active: asBool(raw.is_active),
    created_at: asDateString(raw.created_at),
    limits: rawToLimits(raw),
  };
}

function mergeLimits(current: TierLimits, patch: Partial<TierLimits>): TierLimits {
  const merged = patch.notification_channels ?? current.notification_channels;
  const channels = merged.includes('in_app') ? [...merged] : ['in_app', ...merged];
  return {
    max_properties: patch.max_properties ?? current.max_properties,
    max_tenants: patch.max_tenants ?? current.max_tenants,
    ai_routing_enabled: patch.ai_routing_enabled ?? current.ai_routing_enabled,
    csv_export_enabled: patch.csv_export_enabled ?? current.csv_export_enabled,
    custom_notifications_enabled:
      patch.custom_notifications_enabled ?? current.custom_notifications_enabled,
    notification_channels: [...channels],
    maintenance_request_history_days:
      patch.maintenance_request_history_days ?? current.maintenance_request_history_days,
    request_photo_video_attachments_enabled:
      patch.request_photo_video_attachments_enabled ?? current.request_photo_video_attachments_enabled,
    property_apply_visibility_editable:
      patch.property_apply_visibility_editable ?? current.property_apply_visibility_editable,
    property_elsa_auto_send_editable:
      patch.property_elsa_auto_send_editable ?? current.property_elsa_auto_send_editable,
  };
}

function limitsToDbValues(l: TierLimits): {
  max_properties: number;
  max_tenants: number;
  ai_routing_enabled: boolean;
  csv_export_enabled: boolean;
  custom_notifications_enabled: boolean;
  notification_email_enabled: boolean;
  notification_sms_enabled: boolean;
  maintenance_request_history_days: number;
  request_photo_video_attachments_enabled: boolean;
  property_apply_visibility_editable: boolean;
  property_elsa_auto_send_editable: boolean;
} {
  return {
    max_properties: l.max_properties,
    max_tenants: l.max_tenants,
    ai_routing_enabled: l.ai_routing_enabled,
    csv_export_enabled: l.csv_export_enabled,
    custom_notifications_enabled: l.custom_notifications_enabled,
    notification_email_enabled: l.notification_channels.includes('email'),
    notification_sms_enabled: l.notification_channels.includes('sms'),
    maintenance_request_history_days: l.maintenance_request_history_days,
    request_photo_video_attachments_enabled: l.request_photo_video_attachments_enabled,
    property_apply_visibility_editable: l.property_apply_visibility_editable,
    property_elsa_auto_send_editable: l.property_elsa_auto_send_editable,
  };
}

export async function listTiers(db: Queryable, options?: { includeInactive?: boolean }): Promise<TierRow[]> {
  const whereClause = options?.includeInactive ? '' : 'WHERE is_active = 1 ';
  const r = await db.query<TierRowRaw>(
    `SELECT ${TIER_COLUMNS} FROM subscription_tiers ${whereClause}ORDER BY
     CASE name WHEN 'FREE' THEN 1 WHEN 'STARTER' THEN 2 WHEN 'PRO' THEN 3 ELSE 4 END`
  );
  return r.rows.map(mapRawToTierRow);
}

export async function getTierByName(db: Queryable, name: string): Promise<TierRow | null> {
  const r = await db.query<TierRowRaw>(
    `SELECT ${TIER_COLUMNS} FROM subscription_tiers WHERE name = $1`,
    [name]
  );
  const raw = r.rows[0];
  return raw ? mapRawToTierRow(raw) : null;
}

export async function getTierById(db: Queryable, id: string): Promise<TierRow | null> {
  const r = await db.query<TierRowRaw>(
    `SELECT ${TIER_COLUMNS} FROM subscription_tiers WHERE id = $1`,
    [id]
  );
  const raw = r.rows[0];
  return raw ? mapRawToTierRow(raw) : null;
}

export async function updateTier(
  db: Queryable,
  id: string,
  patch: {
    display_name?: string;
    description?: string | null;
    limits?: Partial<TierLimits>;
  }
): Promise<TierRow | null> {
  const current = await getTierById(db, id);
  if (!current) return null;

  const newLimits = patch.limits ? mergeLimits(current.limits, patch.limits) : current.limits;
  const newDisplayName = patch.display_name ?? current.display_name;
  const newDescription = patch.description !== undefined ? patch.description : current.description;
  const cols = limitsToDbValues(newLimits);

  const r = await db.query<TierRowRaw>(
    `UPDATE subscription_tiers
     SET display_name = $2,
         description  = $3,
         max_properties = $4,
         max_tenants = $5,
         ai_routing_enabled = $6,
         csv_export_enabled = $7,
         custom_notifications_enabled = $8,
         notification_email_enabled = $9,
         notification_sms_enabled = $10,
         maintenance_request_history_days = $11,
         request_photo_video_attachments_enabled = $12,
         property_apply_visibility_editable = $13,
         property_elsa_auto_send_editable = $14
     OUTPUT INSERTED.id, INSERTED.name, INSERTED.display_name, INSERTED.description, INSERTED.is_active,
            INSERTED.created_at,
            INSERTED.max_properties, INSERTED.max_tenants, INSERTED.ai_routing_enabled,
            INSERTED.csv_export_enabled, INSERTED.custom_notifications_enabled,
            INSERTED.notification_email_enabled, INSERTED.notification_sms_enabled,
            INSERTED.maintenance_request_history_days, INSERTED.request_photo_video_attachments_enabled,
            INSERTED.property_apply_visibility_editable, INSERTED.property_elsa_auto_send_editable
     WHERE id = $1`,
    [
      id,
      newDisplayName,
      newDescription,
      cols.max_properties,
      cols.max_tenants,
      cols.ai_routing_enabled ? 1 : 0,
      cols.csv_export_enabled ? 1 : 0,
      cols.custom_notifications_enabled ? 1 : 0,
      cols.notification_email_enabled ? 1 : 0,
      cols.notification_sms_enabled ? 1 : 0,
      cols.maintenance_request_history_days,
      cols.request_photo_video_attachments_enabled ? 1 : 0,
      cols.property_apply_visibility_editable ? 1 : 0,
      cols.property_elsa_auto_send_editable ? 1 : 0,
    ]
  );
  const raw = r.rows[0];
  return raw ? mapRawToTierRow(raw) : null;
}
