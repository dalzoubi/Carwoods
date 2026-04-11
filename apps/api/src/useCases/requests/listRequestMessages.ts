/**
 * List messages on a maintenance request.
 *
 * Internal messages are only visible to landlords/admins.
 * Tenants see non-internal messages for their own requests only.
 */

import {
  listRequestMessages as listMsgs,
  tenantCanAccessRequest,
  type RequestMessageRow,
} from '../../lib/requestsRepo.js';
import { markPortalNotificationsReadForRequest } from '../../lib/notificationCenterRepo.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { validateRequestId } from '../../domain/requestValidation.js';
import { Role, hasLandlordAccess } from '../../domain/constants.js';
import type { Queryable } from '../types.js';

export type ListRequestMessagesInput = {
  requestId: string | undefined;
  actorUserId: string;
  actorRole: string;
};

export type ListRequestMessagesOutput = {
  messages: RequestMessageRow[];
};

export async function listRequestMessages(
  db: Queryable,
  input: ListRequestMessagesInput
): Promise<ListRequestMessagesOutput> {
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

  const messages = await listMsgs(db, requestId, isManagement);
  await markPortalNotificationsReadForRequest(db, {
    userId: input.actorUserId,
    requestId,
  });
  return { messages };
}
