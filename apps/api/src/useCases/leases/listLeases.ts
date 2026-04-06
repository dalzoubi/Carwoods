/**
 * List leases (management access required).
 * Optionally filtered by property_id.
 */

import {
  listLeasesLandlord,
  listLeasesForProperty,
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

  const leases = input.propertyId
    ? await listLeasesForProperty(db, input.propertyId)
    : await listLeasesLandlord(db);

  return { leases };
}
