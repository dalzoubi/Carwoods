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

export type NotificationDeliveryRow = {
  id: string;
  outbox_id: string | null;
  recipient_email: string;
  template_id: string | null;
  status: 'QUEUED' | 'SENT' | 'FAILED';
  provider_message_id: string | null;
  error: string | null;
  created_at: Date;
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

export async function insertNotificationDelivery(
  client: PoolClient,
  params: {
    outboxId: string | null;
    recipientTarget: string;
    templateId: string | null;
    status: 'QUEUED' | 'SENT' | 'FAILED';
    providerMessageId?: string | null;
    error?: string | null;
  }
): Promise<NotificationDeliveryRow> {
  const r = await client.query<NotificationDeliveryRow>(
    `INSERT INTO notification_deliveries (
       id, outbox_id, recipient_email, template_id, status, provider_message_id, error
     )
     OUTPUT INSERTED.id, INSERTED.outbox_id, INSERTED.recipient_email, INSERTED.template_id,
            INSERTED.status, INSERTED.provider_message_id, INSERTED.error, INSERTED.created_at
     VALUES (NEWID(), $1, $2, $3, $4, $5, $6)`,
    [
      params.outboxId,
      params.recipientTarget,
      params.templateId,
      params.status,
      params.providerMessageId ?? null,
      params.error ?? null,
    ]
  );
  return r.rows[0]!;
}

