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
import {
  findRequestLandlordUserId,
  getGlobalAttachmentUploadConfigCached,
  getLandlordAttachmentUploadOverrideCached,
} from '../../lib/attachmentUploadConfigRepo.js';
import { enqueueNotification } from '../../lib/notificationRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import {
  detectMediaType,
  validateRequestId,
  type UploadMediaType,
} from '../../domain/requestValidation.js';
import { extensionFromFilename, mimeMatchesAllowed } from '../../domain/attachmentUploadConfig.js';
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
  fileDurationSeconds?: number;
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

  if (
    !input.storagePath
    || !input.filename
    || !input.contentType
    || !Number.isFinite(input.fileSizeBytes)
    || input.fileSizeBytes <= 0
  ) {
    throw validationError('missing_or_invalid_file_fields');
  }

  const mediaType = detectMediaType(input.contentType) as UploadMediaType | null;
  if (!mediaType) throw validationError('unsupported_mime_type');
  const globalConfig = await getGlobalAttachmentUploadConfigCached(db);
  if (!globalConfig) throw validationError('attachment_config_missing');
  const landlordUserId = await findRequestLandlordUserId(db, requestId);
  const landlordOverride = landlordUserId
    ? await getLandlordAttachmentUploadOverrideCached(db, landlordUserId)
    : null;
  const effectiveConfig = landlordOverride ?? globalConfig;

  const extension = extensionFromFilename(input.filename);
  if (!mimeMatchesAllowed(input.contentType, effectiveConfig.allowed_mime_types)) {
    throw validationError('unsupported_mime_type');
  }
  if (extension && !effectiveConfig.allowed_extensions.includes(extension)) {
    throw validationError('unsupported_file_extension');
  }
  const maxBytes = mediaType === 'PHOTO'
    ? effectiveConfig.max_image_bytes
    : effectiveConfig.max_video_bytes;
  if (input.fileSizeBytes > maxBytes) {
    throw Object.assign(validationError('file_too_large'), { max_bytes: maxBytes });
  }
  if (
    mediaType === 'VIDEO'
    && Number.isFinite(input.fileDurationSeconds)
    && Number(input.fileDurationSeconds) > effectiveConfig.max_video_duration_seconds
  ) {
    throw Object.assign(validationError('video_too_long'), {
      max_seconds: effectiveConfig.max_video_duration_seconds,
    });
  }

  const attachmentsCount = await countRequestAttachments(db, requestId);
  if (attachmentsCount >= effectiveConfig.max_attachments) {
    throw Object.assign(validationError('attachment_limit_exceeded'), { max: effectiveConfig.max_attachments });
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
