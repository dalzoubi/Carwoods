import type { QueryResult } from './db.js';
import type { PoolClient } from './db.js';

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

export type PortalNotificationRow = {
  id: string;
  user_id: string;
  event_type_code: string;
  title: string;
  body: string;
  deep_link: string | null;
  request_id: string | null;
  metadata_json: unknown;
  read_at: Date | null;
  dismissed_from_tray_at?: Date | null;
  created_at: Date;
};

function parseMetadata(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw ?? {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function normalizeRow(row: PortalNotificationRow): PortalNotificationRow {
  return {
    ...row,
    metadata_json: parseMetadata(row.metadata_json),
    dismissed_from_tray_at: row.dismissed_from_tray_at ?? null,
  };
}

const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractOutboxIdFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const v = (metadata as Record<string, unknown>).outbox_id;
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return UUID_LIKE.test(s) ? s : null;
}

/** Append-only issuance row for metrics (same transaction as inbox insert). */
async function insertPortalNotificationIssuanceEvent(
  client: PoolClient,
  params: {
    occurredAt: Date;
    userId: string;
    eventTypeCode: string;
    requestId: string | null;
    portalNotificationId: string;
    metadata: unknown;
  }
): Promise<void> {
  const outboxId = extractOutboxIdFromMetadata(params.metadata);
  await client.query(
    `INSERT INTO portal_notification_events (
       occurred_at, user_id, event_type_code, request_id, portal_notification_id, outbox_id
     ) VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      params.occurredAt,
      params.userId,
      params.eventTypeCode,
      params.requestId,
      params.portalNotificationId,
      outboxId,
    ]
  );
}

/**
 * True if this user already has an in-app row for this outbox (retry / partial-dispatch safety).
 * Matches metadata_json.outbox_id set during dispatch.
 */
export async function portalNotificationExistsForOutboxRecipient(
  client: PoolClient,
  params: { userId: string; outboxId: string }
): Promise<boolean> {
  const r = await client.query<{ count_value: number }>(
    `SELECT COUNT(*) AS count_value
     FROM portal_notifications
     WHERE user_id = $1
       AND ISJSON(metadata_json) = 1
       AND LOWER(LTRIM(RTRIM(JSON_VALUE(metadata_json, '$.outbox_id'))))
         = LOWER(LTRIM(RTRIM(CAST($2 AS NVARCHAR(64)))))`,
    [params.userId, params.outboxId]
  );
  return Number(r.rows[0]?.count_value ?? 0) > 0;
}

export async function createPortalNotification(
  client: PoolClient,
  params: {
    userId: string;
    eventTypeCode: string;
    title: string;
    body: string;
    deepLink?: string | null;
    requestId?: string | null;
    metadata?: unknown;
  }
): Promise<PortalNotificationRow> {
  const r = await client.query<PortalNotificationRow>(
    `INSERT INTO portal_notifications (
       id, user_id, event_type_code, title, body, deep_link, request_id, metadata_json
     )
     OUTPUT INSERTED.id, INSERTED.user_id, INSERTED.event_type_code, INSERTED.title, INSERTED.body,
            INSERTED.deep_link, INSERTED.request_id, INSERTED.metadata_json, INSERTED.read_at,
            INSERTED.dismissed_from_tray_at, INSERTED.created_at
     VALUES (NEWID(), $1, $2, $3, $4, $5, $6, $7)`,
    [
      params.userId,
      params.eventTypeCode,
      params.title,
      params.body,
      params.deepLink ?? null,
      params.requestId ?? null,
      JSON.stringify(params.metadata ?? {}),
    ]
  );
  const row = normalizeRow(r.rows[0]!);
  await insertPortalNotificationIssuanceEvent(client, {
    occurredAt: row.created_at,
    userId: row.user_id,
    eventTypeCode: row.event_type_code,
    requestId: row.request_id,
    portalNotificationId: row.id,
    metadata: params.metadata,
  });
  return row;
}

export async function listPortalNotificationsForUser(
  db: Queryable,
  userId: string,
  limit: number
): Promise<PortalNotificationRow[]> {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const r = await db.query<PortalNotificationRow>(
    `SELECT TOP (${safeLimit})
        id, user_id, event_type_code, title, body, deep_link, request_id, metadata_json, read_at,
        dismissed_from_tray_at, created_at
     FROM portal_notifications
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return r.rows.map(normalizeRow);
}

export async function countUnreadPortalNotifications(
  db: Queryable,
  userId: string
): Promise<number> {
  const r = await db.query<{ count_value: number }>(
    `SELECT COUNT(*) AS count_value
     FROM portal_notifications
     WHERE user_id = $1
       AND read_at IS NULL`,
    [userId]
  );
  return Number(r.rows[0]?.count_value ?? 0);
}

/**
 * Patch read / tray-dismiss for one row. At least one of markRead or dismissFromTray must be true.
 * dismissFromTray also sets read_at when it was null (same UX as bell dismiss).
 */
export async function patchPortalNotificationForUser(
  client: PoolClient,
  params: {
    notificationId: string;
    userId: string;
    markRead: boolean;
    dismissFromTray: boolean;
  }
): Promise<boolean> {
  if (!params.markRead && !params.dismissFromTray) return false;
  const sets: string[] = [];
  if (params.markRead || params.dismissFromTray) {
    sets.push('read_at = COALESCE(read_at, SYSDATETIMEOFFSET())');
  }
  if (params.dismissFromTray) {
    sets.push('dismissed_from_tray_at = COALESCE(dismissed_from_tray_at, SYSDATETIMEOFFSET())');
  }
  const r = await client.query<{ id: string }>(
    `UPDATE portal_notifications
        SET ${sets.join(', ')}
      OUTPUT INSERTED.id
      WHERE id = $1
        AND user_id = $2`,
    [params.notificationId, params.userId]
  );
  return r.rows.length > 0;
}

export async function markPortalNotificationRead(
  client: PoolClient,
  params: { notificationId: string; userId: string }
): Promise<boolean> {
  return patchPortalNotificationForUser(client, {
    notificationId: params.notificationId,
    userId: params.userId,
    markRead: true,
    dismissFromTray: false,
  });
}

export async function markPortalNotificationsReadForRequest(
  db: Queryable,
  params: { userId: string; requestId: string }
): Promise<void> {
  await db.query(
    `UPDATE portal_notifications
        SET read_at = COALESCE(read_at, SYSDATETIMEOFFSET())
      WHERE user_id = $1
        AND request_id = $2
        AND read_at IS NULL`,
    [params.userId, params.requestId]
  );
}

export async function markAllPortalNotificationsRead(
  client: PoolClient,
  userId: string
): Promise<number> {
  const r = await client.query<{ id: string }>(
    `UPDATE portal_notifications
        SET read_at = COALESCE(read_at, SYSDATETIMEOFFSET())
      OUTPUT INSERTED.id
      WHERE user_id = $1
        AND read_at IS NULL`,
    [userId]
  );
  return r.rows.length;
}

function normalizeNotificationIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    if (typeof x !== 'string') continue;
    const s = x.trim();
    if (!UUID_LIKE.test(s)) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/** Permanently remove in-app notification rows owned by the user. */
export async function deletePortalNotificationsForUser(
  client: PoolClient,
  params: { userId: string; notificationIds: unknown }
): Promise<number> {
  const ids = normalizeNotificationIdList(params.notificationIds);
  if (ids.length === 0) return 0;
  const maxBatch = 100;
  const capped = ids.slice(0, maxBatch);
  const placeholders = capped.map((_, i) => `$${i + 2}`).join(', ');
  const r = await client.query<{ id: string }>(
    `DELETE FROM portal_notifications
      OUTPUT DELETED.id
      WHERE user_id = $1
        AND id IN (${placeholders})`,
    [params.userId, ...capped]
  );
  return r.rows.length;
}

