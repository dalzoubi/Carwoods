/**
 * List maintenance requests.
 *
 * - Tenants see only their own requests (scoped to their active leases).
 * - Landlords see requests for properties they own (properties.created_by).
 * - Admins see all requests.
 */

import {
  listRequestsForTenant,
  listRequestsForManagement,
  listRequestsForLandlord,
  type RequestRow,
} from '../../lib/requestsRepo.js';
import { forbidden } from '../../domain/errors.js';
import { Role } from '../../domain/constants.js';
import type { Queryable } from '../types.js';

export type ListRequestsInput = {
  actorUserId: string;
  actorRole: string;
};

export type ListRequestsOutput = {
  requests: RequestRow[];
};

export async function listRequests(
  db: Queryable,
  input: ListRequestsInput
): Promise<ListRequestsOutput> {
  const role = input.actorRole.trim().toUpperCase();

  if (role === Role.TENANT) {
    const requests = await listRequestsForTenant(db, input.actorUserId);
    return { requests };
  }

  if (role === Role.LANDLORD) {
    const requests = await listRequestsForLandlord(db, input.actorUserId);
    return { requests };
  }

  if (role === Role.ADMIN) {
    const requests = await listRequestsForManagement(db);
    return { requests };
  }

  throw forbidden('insufficient_role');
}
