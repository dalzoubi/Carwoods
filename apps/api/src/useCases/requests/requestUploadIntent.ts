/**
 * Generate a pre-signed upload intent for a request attachment.
 *
 * Business rules:
 * - Tenant must own the request (or actor is landlord/admin).
 * - File type must be supported and within size limits.
 * - Photo/video counts must not exceed the per-request caps.
 */

import {
  countRequestAttachments,
  managementCanAccessRequest,
  tenantCanAccessRequest,
} from '../../lib/requestsRepo.js';
import {
  findRequestLandlordUserId,
  getGlobalAttachmentUploadConfigCached,
  getLandlordAttachmentUploadOverrideCached,
} from '../../lib/attachmentUploadConfigRepo.js';
import {
  detectMediaType,
  validateRequestId,
  type UploadMediaType,
} from '../../domain/requestValidation.js';
import {
  ATTACHMENT_CONFIG_RANGES,
  extensionFromFilename,
  mimeMatchesAllowed,
} from '../../domain/attachmentUploadConfig.js';
import { validateVideoDurationSeconds } from '../../domain/requestAttachmentPolicy.js';
import { forbidden, notFound, unprocessable, validationError } from '../../domain/errors.js';
import { Role, hasLandlordAccess } from '../../domain/constants.js';
import type { Queryable } from '../types.js';
import { buildAttachmentUploadUrl } from '../../lib/requestAttachmentStorage.js';

export type RequestUploadIntentInput = {
  requestId: string | undefined;
  actorUserId: string;
  actorRole: string;
  filename: string | undefined;
  contentType: string | undefined;
  fileSizeBytes: number;
  fileDurationSeconds?: number;
};

export type RequestUploadIntentOutput = {
  upload_url: string;
  storage_path: string;
  media_type: UploadMediaType;
  expires_in_seconds: number;
};

export async function requestUploadIntent(
  db: Queryable,
  input: RequestUploadIntentInput
): Promise<RequestUploadIntentOutput> {
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
  } else {
    const allowed = await managementCanAccessRequest(db, requestId, role, input.actorUserId);
    if (!allowed) throw notFound();
  }

  if (!input.filename || !input.contentType || !Number.isFinite(input.fileSizeBytes) || input.fileSizeBytes <= 0) {
    throw validationError('missing_or_invalid_file_fields');
  }
  const mediaType = detectMediaType(input.contentType);
  if (!mediaType) throw validationError('unsupported_mime_type');

  const globalConfig = await getGlobalAttachmentUploadConfigCached(db);
  if (!globalConfig) throw unprocessable('attachment_config_missing');
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
  validateVideoDurationSeconds(
    mediaType,
    input.fileDurationSeconds,
    effectiveConfig.max_video_duration_seconds
  );

  const attachmentsCount = await countRequestAttachments(db, requestId);
  if (attachmentsCount >= effectiveConfig.max_attachments) {
    throw Object.assign(validationError('attachment_limit_exceeded'), { max: effectiveConfig.max_attachments });
  }

  const safeFileName = input.filename!.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storage_path = `${requestId}/${Date.now()}-${safeFileName}`;
  const uploadUrl = buildAttachmentUploadUrl(storage_path, input.contentType!, 300);
  if (!uploadUrl) {
    throw unprocessable('storage_not_configured');
  }

  const expiresInSeconds = Math.min(
    Math.max(300, effectiveConfig.share_expiry_seconds),
    ATTACHMENT_CONFIG_RANGES.shareExpirySeconds.max
  );
  return { upload_url: uploadUrl, storage_path, media_type: mediaType, expires_in_seconds: expiresInSeconds };
}
