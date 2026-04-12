import { hasAiAgentAccess, RequestStatus } from '../../domain/constants.js';
import { validationError } from '../../domain/errors.js';
import { writeAudit } from '../../lib/auditRepo.js';
import type { PoolClient } from '../../lib/db.js';
import { enqueueNotification } from '../../lib/notificationRepo.js';
import {
  findStatusIdByCode,
  getRequestById,
  insertRequestStatusHistory,
  updateRequestManagementFields,
} from '../../lib/requestsRepo.js';

/**
 * After Elsa posts a tenant-visible reply (auto-send or review send), move the
 * request to WAITING_ON_TENANT when it is not already there.
 *
 * AI automation (`AI_AGENT`) may perform this transition only while the request
 * is still NOT_STARTED; human landlords/admins are not restricted.
 */
export async function applyWaitingOnTenantAfterElsaTenantMessage(
  client: PoolClient,
  params: { requestId: string; actorUserId: string; actorRole?: string }
): Promise<void> {
  const waitingId = await findStatusIdByCode(client, RequestStatus.WAITING_ON_TENANT);
  if (!waitingId) throw validationError('invalid_status_code');

  const before = await getRequestById(client, params.requestId);
  if (!before) return;
  if (hasAiAgentAccess(params.actorRole ?? '')) {
    const code = String(before.status_code ?? '').trim().toUpperCase();
    if (code !== RequestStatus.NOT_STARTED) return;
  }
  if (before.current_status_id === waitingId) return;

  const after = await updateRequestManagementFields(client, params.requestId, {
    currentStatusId: waitingId,
  });
  if (!after) return;

  await insertRequestStatusHistory(client, {
    requestId: params.requestId,
    fromStatusId: before.current_status_id,
    toStatusId: waitingId,
    changedByUserId: params.actorUserId,
    note: null,
  });

  await writeAudit(client, {
    actorUserId: params.actorUserId,
    entityType: 'MAINTENANCE_REQUEST',
    entityId: params.requestId,
    action: 'UPDATE',
    before,
    after,
  });

  await enqueueNotification(client, {
    eventTypeCode: 'REQUEST_UPDATED',
    payload: {
      request_id: params.requestId,
      status_changed: true,
      assigned_vendor_id: after.assigned_vendor_id,
    },
    idempotencyKey: `request-updated:${params.requestId}:${after.updated_at.toISOString()}`,
  });
}
