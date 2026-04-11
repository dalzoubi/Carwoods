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
  tenantCanAccessRequest,
} from '../../lib/requestsRepo.js';
import {
  detectMediaType,
  MAX_REQUEST_ATTACHMENTS,
  maxBytesForMediaType,
  validateUploadFile,
  validateRequestId,
  type UploadMediaType,
} from '../../domain/requestValidation.js';
import { forbidden, notFound, unprocessable, validationError } from '../../domain/errors.js';
import { Role, hasLandlordAccess } from '../../domain/constants.js';
import type { Queryable } from '../types.js';
import {
  BlobSASPermissions,
  SASProtocol,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob';

export type RequestUploadIntentInput = {
  requestId: string | undefined;
  actorUserId: string;
  actorRole: string;
  filename: string | undefined;
  contentType: string | undefined;
  fileSizeBytes: number;
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
  }

  const uploadValidation = validateUploadFile({
    filename: input.filename,
    contentType: input.contentType,
    fileSizeBytes: input.fileSizeBytes,
  });
  if (!uploadValidation.valid) {
    if (uploadValidation.message === 'file_too_large') {
      const mediaType = detectMediaType(input.contentType!)!;
      const maxBytes = maxBytesForMediaType(mediaType);
      throw Object.assign(validationError('file_too_large'), { max_bytes: maxBytes });
    }
    throw validationError(uploadValidation.message);
  }

  const mediaType = detectMediaType(input.contentType!)!;
  const attachmentsCount = await countRequestAttachments(db, requestId);
  if (attachmentsCount >= MAX_REQUEST_ATTACHMENTS) {
    throw Object.assign(validationError('attachment_limit_exceeded'), { max: MAX_REQUEST_ATTACHMENTS });
  }

  const safeFileName = input.filename!.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storage_path = `${requestId}/${Date.now()}-${safeFileName}`;
  const storageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME?.trim();
  const storageContainerName = process.env.AZURE_STORAGE_CONTAINER_NAME?.trim();
  const storageAccountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY?.trim();

  if (!storageAccountName || !storageContainerName || !storageAccountKey) {
    throw unprocessable('storage_not_configured');
  }

  const now = new Date();
  const expiresOn = new Date(now.getTime() + 300 * 1000);
  const sharedKeyCredential = new StorageSharedKeyCredential(
    storageAccountName,
    storageAccountKey
  );
  const sasToken = generateBlobSASQueryParameters(
    {
      containerName: storageContainerName,
      blobName: storage_path,
      permissions: BlobSASPermissions.parse('cw'),
      startsOn: now,
      expiresOn,
      protocol: SASProtocol.Https,
      contentType: input.contentType!,
    },
    sharedKeyCredential
  ).toString();
  const upload_url = `https://${storageAccountName}.blob.core.windows.net/${encodeURIComponent(
    storageContainerName
  )}/${storage_path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}?${sasToken}`;

  return { upload_url, storage_path, media_type: mediaType, expires_in_seconds: 300 };
}
