import { getRequestAttachmentById } from '../../lib/requestsRepo.js';
import { downloadAttachmentBuffer } from '../../lib/requestAttachmentStorage.js';
import { verifyAttachmentAccessToken } from '../../lib/secureSignedToken.js';
import { getRequest } from './getRequest.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { validateRequestId } from '../../domain/requestValidation.js';
import { isValidUuid } from '../../domain/validation.js';
import type { Queryable } from '../types.js';

export type DownloadRequestAttachmentFileInput = {
  requestId: string | undefined;
  attachmentId: string | undefined;
  accessToken: string | undefined;
  actorUserId: string;
  actorRole: string;
};

export type DownloadRequestAttachmentFileOutput = {
  buffer: Buffer;
  contentType: string;
  filename: string;
};

export async function downloadRequestAttachmentFile(
  db: Queryable,
  input: DownloadRequestAttachmentFileInput
): Promise<DownloadRequestAttachmentFileOutput> {
  const idValidation = validateRequestId(input.requestId);
  if (!idValidation.valid) {
    if (idValidation.message === 'missing_id') throw validationError('missing_id');
    throw notFound();
  }
  if (!input.attachmentId || !isValidUuid(input.attachmentId)) {
    throw validationError('invalid_attachment_id');
  }
  const token = typeof input.accessToken === 'string' ? input.accessToken.trim() : '';
  if (!token) throw validationError('missing_attachment_token');

  const claims = verifyAttachmentAccessToken(token);
  if (!claims || claims.requestId !== input.requestId || claims.attachmentId !== input.attachmentId) {
    throw forbidden('invalid_attachment_token');
  }

  const requestId = input.requestId!;
  await getRequest(db, {
    requestId,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
  });

  const attachment = await getRequestAttachmentById(db, requestId, input.attachmentId);
  if (!attachment) throw notFound();

  const buffer = await downloadAttachmentBuffer(attachment.storage_path);
  if (!buffer) throw notFound('attachment_blob_missing');

  return {
    buffer,
    contentType: attachment.content_type || 'application/octet-stream',
    filename: attachment.original_filename || 'attachment',
  };
}
