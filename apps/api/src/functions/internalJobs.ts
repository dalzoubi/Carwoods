import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { getPool } from '../lib/db.js';
import { jsonResponse, requireLandlordOrAdmin } from '../lib/managementRequest.js';
import {
  listPendingNotifications,
  markNotificationFailed,
  markNotificationSent,
} from '../lib/notificationRepo.js';
import { writeAudit } from '../lib/auditRepo.js';
import { logInfo, logWarn } from '../lib/serverLogger.js';
import { listAttachmentBlobPaths, deleteAttachmentBlobIfExists } from '../lib/requestAttachmentStorage.js';

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
  const pool = getPool();
  const limit = Number(request.query.get('limit') ?? 25);
  const pending = await listPendingNotifications(pool, Number.isFinite(limit) ? limit : 25);

  let sent = 0;
  let failed = 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const row of pending) {
      try {
        // Placeholder sender: mark as sent if payload exists; keeps retry semantics in DB.
        if (!row.payload) {
          throw new Error('missing_payload');
        }
        await markNotificationSent(client, row.id);
        sent += 1;
      } catch (error) {
        failed += 1;
        await markNotificationFailed(
          client,
          row.id,
          error instanceof Error ? error.message : 'send_failed'
        );
      }
    }
    await writeAudit(client, {
      actorUserId: ctx.user.id,
      entityType: 'NOTIFICATION_OUTBOX',
      entityId: '00000000-0000-0000-0000-000000000000',
      action: 'PROCESS_BATCH',
      before: null,
      after: { attempted: pending.length, sent, failed },
    });
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return jsonResponse(200, ctx.headers, {
    attempted: pending.length,
    sent,
    failed,
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

