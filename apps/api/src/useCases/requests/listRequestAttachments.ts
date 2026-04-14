/**
 * List attachments for a maintenance request.
 *
 * Tenants may only list attachments on their own requests.
 */

import {
  listRequestAttachments as listAttachments,
  managementCanAccessRequest,
  tenantCanAccessRequest,
  type RequestAttachmentRow,
} from '../../lib/requestsRepo.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { validateRequestId } from '../../domain/requestValidation.js';
import { Role, hasLandlordAccess } from '../../domain/constants.js';
import type { Queryable } from '../types.js';
import { buildAttachmentReadUrl } from '../../lib/requestAttachmentStorage.js';

export type ListRequestAttachmentsInput = {
  requestId: string | undefined;
  actorUserId: string;
  actorRole: string;
};

export type ListRequestAttachmentsOutput = {
  attachments: Array<RequestAttachmentRow & { file_url: string | null }>;
};

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
  } else {
    const allowed = await managementCanAccessRequest(db, requestId, role, input.actorUserId);
    if (!allowed) throw notFound();
  }

  const attachments = (await listAttachments(db, requestId)).map((attachment) => ({
    ...attachment,
    file_url: buildAttachmentReadUrl(attachment.storage_path, 15 * 60),
  }));
  return { attachments };
}
