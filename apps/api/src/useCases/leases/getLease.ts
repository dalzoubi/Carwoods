/**
 * Fetch a single lease by ID (management access required).
 */

import { getLeaseById, type LeaseRowFull } from '../../lib/leasesRepo.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { Queryable } from '../types.js';

export type GetLeaseInput = {
  leaseId: string | undefined;
  actorUserId: string;
  actorRole: string;
};

export type GetLeaseOutput = {
  lease: LeaseRowFull;
};

export async function getLease(
  db: Queryable,
  input: GetLeaseInput
): Promise<GetLeaseOutput> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();
  if (!input.leaseId) throw validationError('missing_id');

  const lease = await getLeaseById(db, input.leaseId);
  if (!lease) throw notFound();
  return { lease };
}
