/**
 * List attachments for a maintenance request.
 *
 * Tenants may only list attachments on their own requests.
 */

import {
  listRequestAttachments as listAttachments,
  tenantCanAccessRequest,
  type RequestAttachmentRow,
} from '../../lib/requestsRepo.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { validateRequestId } from '../../domain/requestValidation.js';
import { Role, hasLandlordAccess } from '../../domain/constants.js';
import type { Queryable } from '../types.js';
import {
  BlobSASPermissions,
  SASProtocol,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob';

export type ListRequestAttachmentsInput = {
  requestId: string | undefined;
  actorUserId: string;
  actorRole: string;
};

export type ListRequestAttachmentsOutput = {
  attachments: Array<RequestAttachmentRow & { file_url: string | null }>;
};

function buildAttachmentReadUrl(storagePath: string): string | null {
  const storageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME?.trim();
  const storageContainerName = process.env.AZURE_STORAGE_CONTAINER_NAME?.trim();
  const storageAccountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY?.trim();
  if (!storageAccountName || !storageContainerName || !storageAccountKey) return null;

  const now = new Date();
  const expiresOn = new Date(now.getTime() + 15 * 60 * 1000);
  const sharedKeyCredential = new StorageSharedKeyCredential(storageAccountName, storageAccountKey);
  const sasToken = generateBlobSASQueryParameters(
    {
      containerName: storageContainerName,
      blobName: storagePath,
      permissions: BlobSASPermissions.parse('r'),
      startsOn: now,
      expiresOn,
      protocol: SASProtocol.Https,
    },
    sharedKeyCredential
  ).toString();
  return `https://${storageAccountName}.blob.core.windows.net/${encodeURIComponent(
    storageContainerName
  )}/${storagePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}?${sasToken}`;
}

export async function listRequestAttachments(
  db: Queryable,
  input: ListRequestAttachmentsInput
): Promise<ListRequestAttachmentsOutput> {
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

  const attachments = (await listAttachments(db, requestId)).map((attachment) => ({
    ...attachment,
    file_url: buildAttachmentReadUrl(attachment.storage_path),
  }));
  return { attachments };
}
