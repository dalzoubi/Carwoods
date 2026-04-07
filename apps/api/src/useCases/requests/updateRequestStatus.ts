/**
 * Update a maintenance request's management fields (status, vendor, notes).
 *
 * Business rules enforced:
 * - Actor must have landlord or admin role.
 * - The request must exist.
 * - Status code must be a valid lookup code (when provided).
 * - Status history entry is written on transition.
 */

import {
  findStatusIdByCode,
  getRequestById,
  insertRequestStatusHistory,
  updateRequestManagementFields,
  type RequestRow,
} from '../../lib/requestsRepo.js';
import { enqueueNotification } from '../../lib/notificationRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type UpdateRequestStatusInput = {
  requestId: string;
  actorUserId: string;
  actorRole: string;
  statusCode?: string;
  assignedVendorId?: string | null;
  internalNotes?: string | null;
};

export type UpdateRequestStatusOutput = {
  request: RequestRow;
};

export async function updateRequestStatus(
  db: TransactionPool,
  input: UpdateRequestStatusInput
): Promise<UpdateRequestStatusOutput> {
  if (!hasLandlordAccess(input.actorRole)) {
    throw forbidden();
  }

  if (!input.requestId) {
    throw validationError('missing_id');
  }

  const pool = db;
  const current = await getRequestById(pool, input.requestId);
  if (!current) throw notFound();

  let newStatusId: string | undefined;
  if (input.statusCode) {
    const statusId = await findStatusIdByCode(pool, input.statusCode);
    if (!statusId) throw validationError('invalid_status_code');
    newStatusId = statusId;
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const updated = await updateRequestManagementFields(
      client as Parameters<typeof updateRequestManagementFields>[0],
      input.requestId,
      {
        currentStatusId: newStatusId,
        assignedVendorId: input.assignedVendorId,
        internalNotes: input.internalNotes,
      }
    );
    if (!updated) {
      await client.query('ROLLBACK');
      throw notFound();
    }

    if (newStatusId && newStatusId !== current.current_status_id) {
      await insertRequestStatusHistory(
        client as Parameters<typeof insertRequestStatusHistory>[0],
        {
          requestId: input.requestId,
          fromStatusId: current.current_status_id,
          toStatusId: newStatusId,
          changedByUserId: input.actorUserId,
          note: null,
        }
      );
    }

    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'MAINTENANCE_REQUEST',
      entityId: input.requestId,
      action: 'UPDATE',
      before: current,
      after: updated,
    });

    await enqueueNotification(client as Parameters<typeof enqueueNotification>[0], {
      eventTypeCode: 'REQUEST_UPDATED',
      payload: {
        request_id: input.requestId,
        status_changed: Boolean(newStatusId && newStatusId !== current.current_status_id),
        assigned_vendor_id: updated.assigned_vendor_id,
      },
      idempotencyKey: `request-updated:${input.requestId}:${updated.updated_at.toISOString()}`,
    });

    await client.query('COMMIT');
    const refreshed = (await getRequestById(client as Parameters<typeof getRequestById>[0], input.requestId)) ?? updated;
    return { request: refreshed };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
