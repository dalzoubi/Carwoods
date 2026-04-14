import {
  deleteRequestAttachmentById,
  getRequestAttachmentById,
  managementCanAccessRequest,
  type RequestAttachmentRow,
  tenantCanAccessRequest,
} from '../../lib/requestsRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { deleteAttachmentBlobIfExists } from '../../lib/requestAttachmentStorage.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { Role, hasLandlordAccess } from '../../domain/constants.js';
import { isValidUuid } from '../../domain/validation.js';
import { validateRequestId } from '../../domain/requestValidation.js';
import type { TransactionPool } from '../types.js';

export type DeleteRequestAttachmentInput = {
  requestId: string | undefined;
  attachmentId: string | undefined;
  actorUserId: string;
  actorRole: string;
};

export type DeleteRequestAttachmentOutput = {
  attachment: RequestAttachmentRow;
};

export async function deleteRequestAttachment(
  db: TransactionPool,
  input: DeleteRequestAttachmentInput
): Promise<DeleteRequestAttachmentOutput> {
  const idValidation = validateRequestId(input.requestId);
  if (!idValidation.valid) {
    if (idValidation.message === 'missing_id') throw validationError('missing_id');
    throw notFound();
  }
  if (!input.attachmentId || !isValidUuid(input.attachmentId)) {
    throw validationError('invalid_attachment_id');
  }

  const requestId = input.requestId!;
  const role = input.actorRole.trim().toUpperCase();
  const isManagement = hasLandlordAccess(role);

  if (!isManagement) {
    if (role !== Role.TENANT) throw forbidden();
    const allowed = await tenantCanAccessRequest(db, requestId, input.actorUserId);
    if (!allowed) throw notFound();
  } else {
    const allowed = await managementCanAccessRequest(db, requestId, role, input.actorUserId);
    if (!allowed) throw notFound();
  }

  const existingAttachment = await getRequestAttachmentById(db, requestId, input.attachmentId);
  if (!existingAttachment) throw notFound();

  if (!isManagement && existingAttachment.uploaded_by_user_id !== input.actorUserId) {
    throw forbidden();
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const deleted = await deleteRequestAttachmentById(
      client as Parameters<typeof deleteRequestAttachmentById>[0],
      requestId,
      input.attachmentId
    );
    if (!deleted) {
      await client.query('ROLLBACK');
      throw notFound();
    }
    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'REQUEST_ATTACHMENT',
      entityId: deleted.id,
      action: 'DELETE',
      before: existingAttachment,
      after: null,
    });
    await client.query('COMMIT');
    try {
      await deleteAttachmentBlobIfExists(existingAttachment.storage_path);
    } catch {
      // Non-fatal: DB delete succeeded; orphan cleanup job will reconcile storage drift.
    }
    return { attachment: deleted };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

