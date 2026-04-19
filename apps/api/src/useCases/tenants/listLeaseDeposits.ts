/**
 * List deposits (and any dispositions) for a lease. Landlord/admin scope only.
 */

import { getLeaseById } from '../../lib/leasesRepo.js';
import { getPropertyByIdForActor } from '../../lib/propertiesRepo.js';
import {
  listDepositsForLease,
  listDispositionsForLease,
  type LeaseDepositRow,
  type LeaseDepositDispositionRow,
} from '../../lib/leaseDepositsRepo.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type ListLeaseDepositsInput = {
  actorUserId: string;
  actorRole: string;
  leaseId: string;
};

export async function listLeaseDeposits(
  db: TransactionPool,
  input: ListLeaseDepositsInput
): Promise<{ deposits: LeaseDepositRow[]; dispositions: LeaseDepositDispositionRow[] }> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();
  const leaseId = String(input.leaseId ?? '').trim();
  if (!leaseId) throw validationError('missing_lease_id');

  const lease = await getLeaseById(db, leaseId);
  if (!lease) throw notFound('lease_not_found');

  const prop = await getPropertyByIdForActor(db, lease.property_id, input.actorRole, input.actorUserId);
  if (!prop) throw forbidden();

  const [deposits, dispositions] = await Promise.all([
    listDepositsForLease(db, leaseId),
    listDispositionsForLease(db, leaseId),
  ]);
  return { deposits, dispositions };
}
