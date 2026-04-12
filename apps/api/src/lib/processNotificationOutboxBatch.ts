import type { InvocationContext } from '@azure/functions';
import { getPool, hasDatabaseUrl } from './db.js';
import {
  listPendingNotifications,
  markNotificationFailed,
  markNotificationSent,
  notificationOutboxMaxAttempts,
  enqueueSecurityDeliveryFailureAlert,
  setNotificationOutboxAdminAlertSent,
} from './notificationRepo.js';
import { dispatchOutboxNotification } from './notificationDispatch.js';
import { writeAudit } from './auditRepo.js';
import { logWarn } from './serverLogger.js';
import {
  runMaintenanceNotificationAiPhase,
  applyAiUrgencyOverrideIfNeeded,
  persistNotificationAiSignalRow,
  isMaintenanceNotificationEventType,
} from './notificationAiEnrichment.js';

export type ProcessNotificationOutboxBatchResult = {
  attempted: number;
  sent: number;
  failed: number;
  in_app_created: number;
  queued_deliveries: number;
};

/**
 * Drains pending `notification_outbox` rows: AI enrichment, in-app rows, delivery queue.
 * Used by the HTTP internal job and the optional timer trigger.
 */
export async function processNotificationOutboxBatch(
  context: InvocationContext,
  options: { limit: number; auditActorUserId: string }
): Promise<ProcessNotificationOutboxBatchResult> {
  if (!hasDatabaseUrl()) {
    return { attempted: 0, sent: 0, failed: 0, in_app_created: 0, queued_deliveries: 0 };
  }

  const pool = getPool();
  const safeLimit = Number.isFinite(options.limit) ? Math.max(1, Math.min(100, options.limit)) : 25;
  const maxAttempts = notificationOutboxMaxAttempts();
  const pending = await listPendingNotifications(pool, safeLimit, maxAttempts);
  const actorId = options.auditActorUserId;

  let sent = 0;
  let failed = 0;
  let inAppCreated = 0;
  let queuedDeliveries = 0;
  const clock = { now: new Date() };

  for (const row of pending) {
    let aiBundle = null as Awaited<ReturnType<typeof runMaintenanceNotificationAiPhase>>;
    try {
      if (isMaintenanceNotificationEventType(row.event_type_code)) {
        aiBundle = await runMaintenanceNotificationAiPhase(pool, row);
      }
    } catch (e) {
      logWarn(context, 'notifications.ai_enrichment.failed_open', {
        outboxId: row.id,
        message: e instanceof Error ? e.message : String(e),
      });
      aiBundle = null;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let priorityApplied = false;
      if (aiBundle) {
        priorityApplied = await applyAiUrgencyOverrideIfNeeded(client, aiBundle, row.id);
        await persistNotificationAiSignalRow(client, {
          outboxId: row.id,
          bundle: aiBundle,
          priorityOverrideApplied: priorityApplied,
        });
      }

      const dispatch = await dispatchOutboxNotification(client, row, aiBundle, clock);
      inAppCreated += dispatch.createdInApp;
      queuedDeliveries += dispatch.queuedDeliveries;
      await markNotificationSent(client, row.id);
      await writeAudit(client, {
        actorUserId: actorId,
        entityType: 'NOTIFICATION_OUTBOX',
        entityId: row.id,
        action: 'DISPATCHED',
        before: null,
        after: {
          event_type_code: row.event_type_code,
          in_app_created: dispatch.createdInApp,
          queued_deliveries: dispatch.queuedDeliveries,
        },
      });
      await client.query('COMMIT');
      sent += 1;
    } catch (error) {
      await client.query('ROLLBACK');
      failed += 1;
      const failClient = await pool.connect();
      try {
        await failClient.query('BEGIN');
        const failResult = await markNotificationFailed(
          failClient,
          row.id,
          error instanceof Error ? error.message : 'send_failed'
        );
        if (failResult?.onboardingFailureAlertNeeded) {
          await enqueueSecurityDeliveryFailureAlert(failClient, {
            failedOutboxId: row.id,
            failedEventTypeCode: failResult.eventTypeCode,
            attempts: failResult.newAttempts,
            lastError: error instanceof Error ? error.message : 'send_failed',
          });
          await setNotificationOutboxAdminAlertSent(failClient, row.id);
        }
        await writeAudit(failClient, {
          actorUserId: actorId,
          entityType: 'NOTIFICATION_OUTBOX',
          entityId: row.id,
          action: 'DISPATCH_FAILED',
          before: null,
          after: {
            attempts: failResult?.newAttempts ?? null,
            error: error instanceof Error ? error.message : 'send_failed',
            onboarding_alert: Boolean(failResult?.onboardingFailureAlertNeeded),
          },
        });
        await failClient.query('COMMIT');
      } catch (inner) {
        await failClient.query('ROLLBACK');
        logWarn(context, 'notifications.mark_failed.error', {
          outboxId: row.id,
          message: inner instanceof Error ? inner.message : String(inner),
        });
      } finally {
        failClient.release();
      }
    } finally {
      client.release();
    }
  }

  if (pending.length > 0) {
    const summaryClient = await pool.connect();
    try {
      await summaryClient.query('BEGIN');
      await writeAudit(summaryClient, {
        actorUserId: actorId,
        entityType: 'NOTIFICATION_OUTBOX',
        entityId: '00000000-0000-0000-0000-000000000000',
        action: 'PROCESS_BATCH',
        before: null,
        after: {
          attempted: pending.length,
          sent,
          failed,
          in_app_created: inAppCreated,
          queued_deliveries: queuedDeliveries,
        },
      });
      await summaryClient.query('COMMIT');
    } catch (summaryError) {
      await summaryClient.query('ROLLBACK');
      throw summaryError;
    } finally {
      summaryClient.release();
    }
  }

  return {
    attempted: pending.length,
    sent,
    failed,
    in_app_created: inAppCreated,
    queued_deliveries: queuedDeliveries,
  };
}
