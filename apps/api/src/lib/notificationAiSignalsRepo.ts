import type { PoolClient } from './db.js';

export async function insertNotificationAiSignal(
  client: PoolClient,
  params: {
    outboxId: string;
    requestId: string | null;
    summaryText: string;
    urgent: boolean;
    confidence: number;
    modelName: string;
    providerUsed: string;
    priorityOverrideApplied: boolean;
    errorDetail: string | null;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO notification_ai_signals (
       id, outbox_id, request_id, summary_text, urgent, confidence,
       model_name, provider_used, priority_override_applied, error_detail
     )
     VALUES (NEWID(), $1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      params.outboxId,
      params.requestId,
      params.summaryText.slice(0, 200),
      params.urgent ? 1 : 0,
      params.confidence,
      params.modelName.slice(0, 200),
      params.providerUsed.slice(0, 50),
      params.priorityOverrideApplied ? 1 : 0,
      params.errorDetail ? params.errorDetail.slice(0, 500) : null,
    ]
  );
}
