/**
 * List leases (management access required).
 * Optionally filtered by property_id.
 */

import {
  listLeasesForActor,
  listTenantAggregatesByLeaseIds,
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

  const leaseIdKeys = leases.map((l) => l.id).filter(Boolean);
  const aggByLease = await listTenantAggregatesByLeaseIds(db, leaseIdKeys);
  for (const lease of leases) {
    const key = normalizeLeaseUuidKey(lease.id);
    const agg = aggByLease.get(key);
    if (agg) {
      if (agg.tenant_names) {
        lease.tenant_names = agg.tenant_names;
      }
      if (agg.tenant_user_ids) {
        lease.tenant_user_ids = agg.tenant_user_ids;
      }
    }
  }

  // JSON must carry string UUIDs: mssql can return uniqueidentifier as Buffer, which breaks
  // client property/lease matching and tenant_user_ids join with selected property.
  for (const lease of leases) {
    lease.id = normalizeLeaseUuidKey(lease.id);
    lease.property_id = normalizeLeaseUuidKey(lease.property_id);
  }

  return { leases };
}
