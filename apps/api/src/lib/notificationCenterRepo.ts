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
  };
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
            INSERTED.deep_link, INSERTED.request_id, INSERTED.metadata_json, INSERTED.read_at, INSERTED.created_at
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
  return normalizeRow(r.rows[0]!);
}

export async function listPortalNotificationsForUser(
  db: Queryable,
  userId: string,
  limit: number
): Promise<PortalNotificationRow[]> {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const r = await db.query<PortalNotificationRow>(
    `SELECT TOP (${safeLimit})
        id, user_id, event_type_code, title, body, deep_link, request_id, metadata_json, read_at, created_at
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

export async function markPortalNotificationRead(
  client: PoolClient,
  params: { notificationId: string; userId: string }
): Promise<boolean> {
  const r = await client.query<{ id: string }>(
    `UPDATE portal_notifications
        SET read_at = COALESCE(read_at, SYSDATETIMEOFFSET())
      OUTPUT INSERTED.id
      WHERE id = $1
        AND user_id = $2`,
    [params.notificationId, params.userId]
  );
  return r.rows.length > 0;
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

