/**
 * Fetch a single maintenance request.
 *
 * Tenants may only view requests linked to their active leases.
 * Landlords may view requests for their properties only; admins may view any request.
 * Management roles receive the internal_notes field.
 */

import {
  getRequestById,
  landlordOwnsRequestProperty,
  tenantCanAccessRequest,
  type RequestRow,
} from '../../lib/requestsRepo.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { validateRequestId } from '../../domain/requestValidation.js';
import { Role, hasLandlordAccess } from '../../domain/constants.js';
import type { Queryable } from '../types.js';

export type GetRequestInput = {
  requestId: string | undefined;
  actorUserId: string;
  actorRole: string;
};

export type GetRequestOutput = {
  request: RequestRow;
};

export async function getRequest(
  db: Queryable,
  input: GetRequestInput
): Promise<GetRequestOutput> {
  const idValidation = validateRequestId(input.requestId);
  if (!idValidation.valid) {
    if (idValidation.message === 'missing_id') throw validationError('missing_id');
    throw notFound();
  }

  const requestId = input.requestId!;
  const role = input.actorRole.trim().toUpperCase();
  const isManagement = hasLandlordAccess(role);

  if (role === Role.TENANT) {
    const allowed = await tenantCanAccessRequest(db, requestId, input.actorUserId);
    if (!allowed) throw notFound();
  } else if (role === Role.LANDLORD) {
    const allowed = await landlordOwnsRequestProperty(db, requestId, input.actorUserId);
    if (!allowed) throw notFound();
  } else if (role !== Role.ADMIN) {
    throw forbidden();
  }

  const row = await getRequestById(db, requestId);
  if (!row) throw notFound();

  if (!isManagement) {
    return { request: { ...row, internal_notes: null } };
  }
  return { request: row };
}
