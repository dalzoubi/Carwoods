import type { PoolClient, QueryResult } from './db.js';

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

export type NotificationOutboxRow = {
  id: string;
  event_type_code: string;
  payload: unknown;
  idempotency_key: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  attempts: number;
  last_error: string | null;
  created_at: Date;
  processed_at: Date | null;
};

export async function enqueueNotification(
  client: PoolClient,
  params: {
    eventTypeCode: string;
    payload: unknown;
    idempotencyKey: string;
  }
): Promise<void> {
  await client.query(
    `MERGE notification_outbox AS target
     USING (SELECT $1 AS idempotency_key) AS src
       ON target.idempotency_key = src.idempotency_key
     WHEN NOT MATCHED THEN
       INSERT (id, event_type_code, payload, idempotency_key, status, attempts)
       VALUES (NEWID(), $2, $3, $1, 'PENDING', 0);`,
    [params.idempotencyKey, params.eventTypeCode, JSON.stringify(params.payload ?? {})]
  );
}

export async function listPendingNotifications(
  client: Queryable,
  limit: number
): Promise<NotificationOutboxRow[]> {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const r = await client.query<NotificationOutboxRow>(
    `SELECT TOP (${safeLimit}) id, event_type_code, payload, idempotency_key, status,
            attempts, last_error, created_at, processed_at
     FROM notification_outbox
     WHERE status IN ('PENDING', 'FAILED')
       AND attempts < 5
     ORDER BY created_at ASC`
  );
  return r.rows;
}

export async function markNotificationSent(client: PoolClient, id: string): Promise<void> {
  await client.query(
    `UPDATE notification_outbox
        SET status = 'SENT',
            attempts = attempts + 1,
            processed_at = SYSDATETIMEOFFSET(),
            last_error = NULL
      WHERE id = $1`,
    [id]
  );
}

export async function markNotificationFailed(
  client: PoolClient,
  id: string,
  errorMessage: string
): Promise<void> {
  await client.query(
    `UPDATE notification_outbox
        SET status = 'FAILED',
            attempts = attempts + 1,
            last_error = $2
      WHERE id = $1`,
    [id, errorMessage.slice(0, 2000)]
  );
}

