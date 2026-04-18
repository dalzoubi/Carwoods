/**
 * List leases (management access required).
 * Optionally filtered by property_id.
 */

import {
  listLeasesForActor,
  listTenantNamesByLeaseIds,
  normalizeLeaseUuidKey,
  type LeaseRowFull,
} from '../../lib/leasesRepo.js';
import { forbidden } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { Queryable } from '../types.js';

export type ListLeasesInput = {
  actorUserId: string;
  actorRole: string;
  propertyId?: string;
};

export type ListLeasesOutput = {
  leases: LeaseRowFull[];
};

export async function listLeases(
  db: Queryable,
  input: ListLeasesInput
): Promise<ListLeasesOutput> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();

  const leases = await listLeasesForActor(
    db,
    input.actorRole,
    input.actorUserId,
    input.propertyId
  );

  const namesByLeaseId = await listTenantNamesByLeaseIds(
    db,
    leases.map((l) => l.id).filter(Boolean)
  );
  for (const lease of leases) {
    const tn = namesByLeaseId.get(normalizeLeaseUuidKey(lease.id));
    if (tn) {
      lease.tenant_names = tn;
    }
  }

  return { leases };
}
