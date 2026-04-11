/**
 * Finalize a previously-uploaded file and record the attachment.
 *
 * Business rules:
 * - Tenant must own the request (or actor is landlord/admin).
 * - File metadata must be valid (type, size, path).
 * - Photo/video counts must not exceed the per-request caps.
 */

import {
  countRequestAttachments,
  insertRequestAttachment,
  tenantCanAccessRequest,
  type RequestAttachmentRow,
} from '../../lib/requestsRepo.js';
import { enqueueNotification } from '../../lib/notificationRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import {
  detectMediaType,
  MAX_REQUEST_ATTACHMENTS,
  maxBytesForMediaType,
  validateFinalizeUpload,
  validateRequestId,
  type UploadMediaType,
} from '../../domain/requestValidation.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { Role, hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type FinalizeRequestAttachmentInput = {
  requestId: string | undefined;
  actorUserId: string;
  actorRole: string;
  storagePath: string | undefined;
  filename: string | undefined;
  contentType: string | undefined;
  fileSizeBytes: number;
};

export type FinalizeRequestAttachmentOutput = {
  attachment: RequestAttachmentRow;
};

export async function finalizeRequestAttachment(
  db: TransactionPool,
  input: FinalizeRequestAttachmentInput
): Promise<FinalizeRequestAttachmentOutput> {
  const idValidation = validateRequestId(input.requestId);
  if (!idValidation.valid) {
    if (idValidation.message === 'missing_id') throw validationError('missing_id');
    throw notFound();
  }

  const requestId = input.requestId!;
  const role = input.actorRole.trim().toUpperCase();
  const isManagement = hasLandlordAccess(role);

  if (!isManagement) {
    if (role !== Role.TENANT) throw forbidden();
    const allowed = await tenantCanAccessRequest(db, requestId, input.actorUserId);
    if (!allowed) throw notFound();
  }

  const finalizeValidation = validateFinalizeUpload({
    storagePath: input.storagePath,
    filename: input.filename,
    contentType: input.contentType,
    fileSizeBytes: input.fileSizeBytes,
  });
  if (!finalizeValidation.valid) {
    if (finalizeValidation.message === 'file_too_large' && input.contentType) {
      const mediaType = detectMediaType(input.contentType);
      if (mediaType) {
        const maxBytes = maxBytesForMediaType(mediaType);
        throw Object.assign(validationError('file_too_large'), { max_bytes: maxBytes });
      }
    }
    throw validationError(finalizeValidation.message);
  }

  const mediaType = detectMediaType(input.contentType!)! as UploadMediaType;
  const attachmentsCount = await countRequestAttachments(db, requestId);
  if (attachmentsCount >= MAX_REQUEST_ATTACHMENTS) {
    throw Object.assign(validationError('attachment_limit_exceeded'), { max: MAX_REQUEST_ATTACHMENTS });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const created = await insertRequestAttachment(
      client as Parameters<typeof insertRequestAttachment>[0],
      {
        requestId,
        uploadedByUserId: input.actorUserId,
        storagePath: input.storagePath!,
        originalFilename: input.filename!,
        contentType: input.contentType!,
        fileSizeBytes: input.fileSizeBytes,
        mediaType,
      }
    );
    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'REQUEST_ATTACHMENT',
      entityId: created.id,
      action: 'CREATE',
      before: null,
      after: created,
    });
    await enqueueNotification(client as Parameters<typeof enqueueNotification>[0], {
      eventTypeCode: 'REQUEST_ATTACHMENT_ADDED',
      payload: {
        request_id: requestId,
        attachment_id: created.id,
      },
      idempotencyKey: `request-attachment:${created.id}`,
    });
    await client.query('COMMIT');
    return { attachment: created };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
