/**
 * Cancel a maintenance request (tenant-only action).
 *
 * Business rules:
 * - Actor must have the TENANT role.
 * - Tenant must own the request (active lease linkage).
 * - Request must be in a cancellable status: NOT_STARTED or ACKNOWLEDGED.
 *   Once scheduled or in-progress the property manager must handle it.
 */

import {
  findStatusIdByCode,
  getRequestById,
  insertRequestStatusHistory,
  updateRequestManagementFields,
  tenantCanAccessRequest,
  type RequestRow,
} from '../../lib/requestsRepo.js';
import { enqueueNotification } from '../../lib/notificationRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { validateRequestId } from '../../domain/requestValidation.js';
import { Role } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

const CANCELLABLE_STATUS_CODES = new Set(['NOT_STARTED', 'ACKNOWLEDGED']);

export type CancelRequestInput = {
  requestId: string | undefined;
  actorUserId: string;
  actorRole: string;
};

export type CancelRequestOutput = {
  request: RequestRow;
};

export async function cancelRequest(
  db: TransactionPool,
  input: CancelRequestInput
): Promise<CancelRequestOutput> {
  const role = input.actorRole.trim().toUpperCase();
  if (role !== Role.TENANT) {
    throw forbidden('only_tenants_can_cancel_requests');
  }

  const idValidation = validateRequestId(input.requestId);
  if (!idValidation.valid) {
    if (idValidation.message === 'missing_id') throw validationError('missing_id');
    throw notFound();
  }

  const requestId = input.requestId!;

  const allowed = await tenantCanAccessRequest(db, requestId, input.actorUserId);
  if (!allowed) throw notFound();

  const current = await getRequestById(db, requestId);
  if (!current) throw notFound();

  if (!current.status_code || !CANCELLABLE_STATUS_CODES.has(current.status_code.toUpperCase())) {
    throw validationError('request_not_cancellable');
  }

  const cancelledStatusId = await findStatusIdByCode(db, 'CANCELLED');
  if (!cancelledStatusId) {
    throw validationError('invalid_lookup_codes');
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const updated = await updateRequestManagementFields(
      client as Parameters<typeof updateRequestManagementFields>[0],
      requestId,
      { currentStatusId: cancelledStatusId }
    );
    if (!updated) {
      await client.query('ROLLBACK');
      throw notFound();
    }

    await insertRequestStatusHistory(
      client as Parameters<typeof insertRequestStatusHistory>[0],
      {
        requestId,
        fromStatusId: current.current_status_id,
        toStatusId: cancelledStatusId,
        changedByUserId: input.actorUserId,
        note: 'Cancelled by tenant',
      }
    );

    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'MAINTENANCE_REQUEST',
      entityId: requestId,
      action: 'CANCEL',
      before: current,
      after: updated,
    });

    await enqueueNotification(client as Parameters<typeof enqueueNotification>[0], {
      eventTypeCode: 'REQUEST_CANCELLED',
      payload: {
        request_id: requestId,
        property_id: current.property_id,
        lease_id: current.lease_id,
        title: current.title,
      },
      idempotencyKey: `request-cancelled:${requestId}`,
    });

    await client.query('COMMIT');
    const refreshed = (await getRequestById(client as Parameters<typeof getRequestById>[0], requestId)) ?? updated;
    return { request: refreshed };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
