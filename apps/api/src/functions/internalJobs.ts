import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
  type Timer,
} from '@azure/functions';
import { getPool } from '../lib/db.js';
import { jsonResponse, requireLandlordOrAdmin } from '../lib/managementRequest.js';
import { logInfo, logWarn } from '../lib/serverLogger.js';
import { listAttachmentBlobPaths, deleteAttachmentBlobIfExists } from '../lib/requestAttachmentStorage.js';
import { writeAudit } from '../lib/auditRepo.js';
import { processNotificationOutboxBatch } from '../lib/processNotificationOutboxBatch.js';
import { processNotificationDeliveryBatch } from '../lib/processNotificationDeliveryBatch.js';
import { expireReadOnlyGraceWindows } from '../lib/tenantLifecycleRepo.js';

const SYSTEM_TIMER_ACTOR_ID = '00000000-0000-0000-0000-000000000000';

function notificationOutboxTimerDisabled(): boolean {
  return String(process.env.NOTIFICATION_OUTBOX_TIMER_DISABLED ?? '').trim().toLowerCase() === 'true';
}

function notificationDeliveryTimerDisabled(): boolean {
  return String(process.env.NOTIFICATION_DELIVERY_TIMER_DISABLED ?? '').trim().toLowerCase() === 'true';
}

function notificationOutboxTimerSchedule(): string {
  const raw = process.env.NOTIFICATION_OUTBOX_TIMER_CRON?.trim();
  return raw && raw.length > 0 ? raw : '0 */1 * * * *';
}

function notificationDeliveryTimerSchedule(): string {
  const raw = process.env.NOTIFICATION_DELIVERY_TIMER_CRON?.trim();
  return raw && raw.length > 0 ? raw : '0 */1 * * * *';
}

function notificationOutboxTimerBatchLimit(): number {
  const n = parseInt(process.env.NOTIFICATION_OUTBOX_TIMER_BATCH_LIMIT ?? '25', 10);
  return Number.isFinite(n) ? n : 25;
}

function notificationDeliveryTimerBatchLimit(): number {
  const n = parseInt(process.env.NOTIFICATION_DELIVERY_TIMER_BATCH_LIMIT ?? '50', 10);
  return Number.isFinite(n) ? n : 50;
}

async function notificationOutboxOnTimer(_timer: Timer, context: InvocationContext): Promise<void> {
  if (notificationOutboxTimerDisabled()) {
    return;
  }
  try {
    const result = await processNotificationOutboxBatch(context, {
      limit: notificationOutboxTimerBatchLimit(),
      auditActorUserId: SYSTEM_TIMER_ACTOR_ID,
    });
    if (result.attempted > 0) {
      logInfo(context, 'notifications.timer.batch_complete', result);
    }
  } catch (error) {
    logWarn(context, 'notifications.timer.batch_failed', {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function processNotificationOutbox(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;
  if (request.method !== 'POST') {
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }
  const limit = Number(request.query.get('limit') ?? 25);
  const result = await processNotificationOutboxBatch(context, {
    limit: Number.isFinite(limit) ? limit : 25,
    auditActorUserId: ctx.user.id,
  });
  return jsonResponse(200, ctx.headers, {
    attempted: result.attempted,
    sent: result.sent,
    failed: result.failed,
    in_app_created: result.in_app_created,
    queued_deliveries: result.queued_deliveries,
  });
}

async function revokeExpiredLeaseAccess(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;
  if (request.method !== 'POST') {
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updateResult = await client.query(
      `UPDATE lt
          SET access_end_at = SYSDATETIMEOFFSET()
       FROM lease_tenants lt
       JOIN leases l ON l.id = lt.lease_id
       WHERE lt.access_end_at IS NULL
         AND l.deleted_at IS NULL
         AND l.month_to_month = 0
         AND l.end_date IS NOT NULL
         AND CAST(l.end_date AS DATE) < CAST(GETUTCDATE() AS DATE)`
    );
    const revokedCount = updateResult.rowCount ?? 0;

    await writeAudit(client, {
      actorUserId: ctx.user.id,
      entityType: 'LEASE_TENANT_ACCESS',
      entityId: '00000000-0000-0000-0000-000000000000',
      action: 'REVOKE_EXPIRED',
      before: null,
      after: { revoked_count: revokedCount },
    });
    await client.query('COMMIT');
    logInfo(context, 'jobs.revoke_expired_leases.success', {
      revoked: revokedCount,
      actorUserId: ctx.user.id,
    });
    return jsonResponse(200, ctx.headers, { revoked_count: revokedCount });
  } catch (error) {
    await client.query('ROLLBACK');
    logWarn(context, 'jobs.revoke_expired_leases.error', {
      message: error instanceof Error ? error.message : 'unknown_error',
    });
    throw error;
  } finally {
    client.release();
  }
}

function looksLikeRequestAttachmentPath(path: string): boolean {
  const firstSegment = String(path).split('/')[0] ?? '';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(firstSegment);
}

async function reconcileRequestAttachmentsStorage(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;
  if (request.method !== 'POST') {
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }

  const prefix = request.query.get('prefix') ?? process.env.REQUEST_ATTACHMENT_STORAGE_PREFIX ?? '';
  const dryRun = String(request.query.get('dry_run') ?? 'false').toLowerCase() === 'true';

  const dbRows = await getPool().query<{ storage_path: string }>(
    'SELECT storage_path FROM request_attachments'
  );
  const dbPathSet = new Set(
    dbRows.rows
      .map((row) => String(row.storage_path ?? '').trim())
      .filter(Boolean)
  );
  const allBlobPaths = await listAttachmentBlobPaths(prefix);
  const candidateOrphans = allBlobPaths.filter(
    (path) => looksLikeRequestAttachmentPath(path) && !dbPathSet.has(path)
  );

  let deletedCount = 0;
  if (!dryRun) {
    for (const path of candidateOrphans) {
      try {
        await deleteAttachmentBlobIfExists(path);
        deletedCount += 1;
      } catch {
        // Keep reconciling other paths. A future run can retry failed deletes.
      }
    }
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await writeAudit(client, {
      actorUserId: ctx.user.id,
      entityType: 'REQUEST_ATTACHMENT_STORAGE',
      entityId: '00000000-0000-0000-0000-000000000000',
      action: dryRun ? 'RECONCILE_DRY_RUN' : 'RECONCILE',
      before: null,
      after: {
        prefix,
        dry_run: dryRun,
        total_blob_paths: allBlobPaths.length,
        orphan_candidates: candidateOrphans.length,
        deleted_count: deletedCount,
      },
    });
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return jsonResponse(200, ctx.headers, {
    prefix,
    dry_run: dryRun,
    total_blob_paths: allBlobPaths.length,
    orphan_candidates: candidateOrphans.length,
    deleted_count: deletedCount,
  });
}

app.http('internalNotificationsProcess', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'internal/jobs/process-notifications',
  handler: processNotificationOutbox,
});

/** When disabled, omit registration so local `func start` works without Azurite/storage for timer leases. */
if (!notificationOutboxTimerDisabled()) {
  app.timer('notificationOutboxTimer', {
    schedule: notificationOutboxTimerSchedule(),
    handler: notificationOutboxOnTimer,
  });
}

async function notificationDeliveryOnTimer(_timer: Timer, context: InvocationContext): Promise<void> {
  if (notificationDeliveryTimerDisabled()) {
    return;
  }
  try {
    const result = await processNotificationDeliveryBatch(context, {
      limit: notificationDeliveryTimerBatchLimit(),
      auditActorUserId: SYSTEM_TIMER_ACTOR_ID,
    });
    if (result.attempted > 0) {
      logInfo(context, 'delivery.timer.batch_complete', result);
    }
  } catch (error) {
    logWarn(context, 'delivery.timer.batch_failed', {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function processNotificationDeliveries(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;
  if (request.method !== 'POST') {
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }
  const limit = Number(request.query.get('limit') ?? 50);
  const result = await processNotificationDeliveryBatch(context, {
    limit: Number.isFinite(limit) ? limit : 50,
    auditActorUserId: ctx.user.id,
  });
  return jsonResponse(200, ctx.headers, result);
}

if (!notificationDeliveryTimerDisabled()) {
  app.timer('notificationDeliveryTimer', {
    schedule: notificationDeliveryTimerSchedule(),
    handler: notificationDeliveryOnTimer,
  });
}

app.http('internalDeliveriesProcess', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'internal/jobs/process-deliveries',
  handler: processNotificationDeliveries,
});

app.http('internalRevokeExpiredLeases', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'internal/jobs/revoke-expired-leases',
  handler: revokeExpiredLeaseAccess,
});

app.http('internalReconcileRequestAttachmentsStorage', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'internal/jobs/reconcile-request-attachments-storage',
  handler: reconcileRequestAttachmentsStorage,
});

// ---------------------------------------------------------------------------
// Portal-access grace-window expiry
// ---------------------------------------------------------------------------
// After a move-out / early termination we mark the tenant READ_ONLY with an
// effective_until. Once that date passes we flip them to REVOKED so the portal
// stops serving data. Runs every hour by default.

function portalAccessExpiryTimerDisabled(): boolean {
  return String(process.env.PORTAL_ACCESS_EXPIRY_TIMER_DISABLED ?? '').trim().toLowerCase() === 'true';
}

function portalAccessExpiryTimerSchedule(): string {
  const raw = process.env.PORTAL_ACCESS_EXPIRY_TIMER_CRON?.trim();
  return raw && raw.length > 0 ? raw : '0 0 * * * *';
}

async function runPortalAccessExpiry(context: InvocationContext, actorUserId: string): Promise<number> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const expired = await expireReadOnlyGraceWindows(client as Parameters<typeof expireReadOnlyGraceWindows>[0]);
    for (const row of expired) {
      await writeAudit(client as Parameters<typeof writeAudit>[0], {
        actorUserId,
        entityType: 'TENANT_PORTAL_ACCESS',
        entityId: row.id,
        action: 'REVOKE_ON_EXPIRY',
        before: null,
        after: row,
      });
    }
    await client.query('COMMIT');
    if (expired.length > 0) {
      logInfo(context, 'portalAccess.expiry.complete', { revoked: expired.length });
    }
    return expired.length;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function portalAccessExpiryOnTimer(_timer: Timer, context: InvocationContext): Promise<void> {
  if (portalAccessExpiryTimerDisabled()) return;
  try {
    await runPortalAccessExpiry(context, SYSTEM_TIMER_ACTOR_ID);
  } catch (error) {
    logWarn(context, 'portalAccess.expiry.failed', {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function portalAccessExpiryHttp(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;
  if (request.method !== 'POST') {
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }
  const revoked = await runPortalAccessExpiry(context, ctx.user.id);
  return jsonResponse(200, ctx.headers, { revoked });
}

app.http('internalPortalAccessExpiry', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'internal/jobs/expire-portal-access',
  handler: portalAccessExpiryHttp,
});

if (!portalAccessExpiryTimerDisabled()) {
  app.timer('portalAccessExpiryTimer', {
    schedule: portalAccessExpiryTimerSchedule(),
    handler: portalAccessExpiryOnTimer,
  });
}
