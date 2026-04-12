import type { PoolClient, QueryResult } from './db.js';
import { deriveEventCategory } from './notificationPolicyRepo.js';

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

export function notificationOutboxMaxAttempts(): number {
  const n = parseInt(process.env.NOTIFICATION_OUTBOX_MAX_ATTEMPTS ?? '16', 10);
  return Number.isFinite(n) ? Math.max(1, Math.min(64, n)) : 16;
}

export function notificationOnboardingFailureAlertThreshold(): number {
  const n = parseInt(process.env.NOTIFICATION_ONBOARDING_FAILURE_ALERT_THRESHOLD ?? '3', 10);
  return Number.isFinite(n) ? Math.max(1, Math.min(20, n)) : 3;
}

export function computeNotificationRetryDelayMinutes(attemptsBeforeIncrement: number): number {
  const base = parseInt(process.env.NOTIFICATION_RETRY_BASE_MINUTES ?? '5', 10);
  const safeBase = Number.isFinite(base) && base > 0 ? base : 5;
  const raw = safeBase * 2 ** attemptsBeforeIncrement;
  return Math.min(raw, 24 * 60);
}

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

export async function enqueueSecurityDeliveryFailureAlert(
  client: PoolClient,
  params: {
    failedOutboxId: string;
    failedEventTypeCode: string;
    attempts: number;
    lastError: string;
  }
): Promise<void> {
  const summary = `Onboarding/ops notification failed after ${params.attempts} attempt(s): ${params.failedEventTypeCode}.`;
  await enqueueNotification(client, {
    eventTypeCode: 'SECURITY_NOTIFICATION_DELIVERY_FAILURE',
    payload: {
      failed_outbox_id: params.failedOutboxId,
      failed_event_type_code: params.failedEventTypeCode,
      attempts: params.attempts,
      last_error: params.lastError.slice(0, 500),
      summary,
    },
    idempotencyKey: `sec-delivery-failure:${params.failedOutboxId}`,
  });
}

export async function setNotificationOutboxAdminAlertSent(
  client: PoolClient,
  outboxId: string
): Promise<void> {
  await client.query(
    `UPDATE notification_outbox SET admin_failure_alert_sent = 1 WHERE id = $1`,
    [outboxId]
  );
}

export async function listPendingNotifications(
  client: Queryable,
  limit: number,
  maxAttempts: number = notificationOutboxMaxAttempts()
): Promise<NotificationOutboxRow[]> {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const safeMax = Math.max(1, Math.min(maxAttempts, 64));
  const r = await client.query<NotificationOutboxRow>(
    `SELECT TOP (${safeLimit}) id, event_type_code, payload, idempotency_key, status,
            attempts, last_error, created_at, processed_at
     FROM notification_outbox
     WHERE status IN ('PENDING', 'FAILED')
       AND attempts < $1
       AND (next_attempt_at IS NULL OR next_attempt_at <= SYSDATETIMEOFFSET())
     ORDER BY created_at ASC`,
    [safeMax]
  );
  return r.rows;
}

export async function markNotificationSent(client: PoolClient, id: string): Promise<void> {
  await client.query(
    `UPDATE notification_outbox
        SET status = 'SENT',
            attempts = attempts + 1,
            processed_at = SYSDATETIMEOFFSET(),
            last_error = NULL,
            next_attempt_at = NULL
      WHERE id = $1`,
    [id]
  );
}

export type MarkNotificationFailedResult = {
  newAttempts: number;
  eventTypeCode: string;
  onboardingFailureAlertNeeded: boolean;
  retriesExhausted: boolean;
};

export async function markNotificationFailed(
  client: PoolClient,
  id: string,
  errorMessage: string
): Promise<MarkNotificationFailedResult | null> {
  const maxA = notificationOutboxMaxAttempts();
  const sel = await client.query<{
    attempts: number;
    event_type_code: string;
    admin_failure_alert_sent: boolean | number | null;
  }>(`SELECT attempts, event_type_code, admin_failure_alert_sent FROM notification_outbox WHERE id = $1`, [id]);
  const cur = sel.rows[0];
  if (!cur) return null;
  if (cur.attempts >= maxA) {
    return {
      newAttempts: cur.attempts,
      eventTypeCode: cur.event_type_code,
      onboardingFailureAlertNeeded: false,
      retriesExhausted: true,
    };
  }

  const delayMin = computeNotificationRetryDelayMinutes(cur.attempts);
  const nextAttempts = cur.attempts + 1;
  const onboarding = deriveEventCategory(cur.event_type_code) === 'ONBOARDING';
  const alertSent = Boolean(cur.admin_failure_alert_sent);
  const threshold = notificationOnboardingFailureAlertThreshold();
  const onboardingFailureAlertNeeded = onboarding && nextAttempts >= threshold && !alertSent;

  await client.query(
    `UPDATE notification_outbox
        SET status = 'FAILED',
            attempts = attempts + 1,
            last_error = $2,
            next_attempt_at = CASE WHEN attempts + 1 >= $4 THEN NULL ELSE DATEADD(MINUTE, $3, SYSDATETIMEOFFSET()) END
      WHERE id = $1 AND attempts < $4`,
    [id, errorMessage.slice(0, 2000), delayMin, maxA]
  );

  return {
    newAttempts: nextAttempts,
    eventTypeCode: cur.event_type_code,
    onboardingFailureAlertNeeded,
    retriesExhausted: nextAttempts >= maxA,
  };
}

/**
 * True if a delivery row already exists for this outbox + channel template + recipient (retry safety).
 */
export async function notificationDeliveryExistsForOutboxRecipient(
  client: PoolClient,
  params: { outboxId: string; recipientTarget: string; templateId: string }
): Promise<boolean> {
  const r = await client.query<{ count_value: number }>(
    `SELECT COUNT(*) AS count_value
     FROM notification_deliveries
     WHERE outbox_id = $1
       AND recipient_email = $2
       AND template_id = $3`,
    [params.outboxId, params.recipientTarget, params.templateId]
  );
  return Number(r.rows[0]?.count_value ?? 0) > 0;
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
    scheduledSendAt?: Date | null;
    /** Optional JSON string (e.g. admin test subject/body for downstream senders). */
    payloadJson?: string | null;
  }
): Promise<NotificationDeliveryRow> {
  const r = await client.query<NotificationDeliveryRow>(
    `INSERT INTO notification_deliveries (
       id, outbox_id, recipient_email, template_id, status, provider_message_id, error, scheduled_send_at, payload_json
     )
     OUTPUT INSERTED.id, INSERTED.outbox_id, INSERTED.recipient_email, INSERTED.template_id,
            INSERTED.status, INSERTED.provider_message_id, INSERTED.error, INSERTED.created_at
     VALUES (NEWID(), $1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      params.outboxId,
      params.recipientTarget,
      params.templateId,
      params.status,
      params.providerMessageId ?? null,
      params.error ?? null,
      params.scheduledSendAt ?? null,
      params.payloadJson ?? null,
    ]
  );
  return r.rows[0]!;
}
