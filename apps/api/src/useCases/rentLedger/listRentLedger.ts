import { forbidden, validationError } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import {
  listEntriesForLease,
  listEntriesForTenant,
  leaseAccessibleByLandlord,
  type RentLedgerEntryRow,
} from '../../lib/rentLedgerRepo.js';
import type { TransactionPool } from '../types.js';

export type ListRentLedgerInput = {
  actorUserId: string;
  actorRole: string;
  leaseId?: string;
};

export type ListRentLedgerOutput = {
  entries: RentLedgerEntryRow[];
};

export async function listRentLedger(
  db: TransactionPool,
  input: ListRentLedgerInput
): Promise<ListRentLedgerOutput> {
  const role = input.actorRole.trim().toUpperCase();

  if (hasLandlordAccess(role)) {
    if (!input.leaseId?.trim()) throw validationError('lease_id_required');
    const accessible = await leaseAccessibleByLandlord(
      db,
      input.leaseId,
      input.actorUserId,
      role
    );
    if (!accessible) throw forbidden();
    const entries = await listEntriesForLease(db, input.leaseId);
    return { entries };
  }

  // Tenant: sees all entries across their lease(s)
  const entries = await listEntriesForTenant(db, input.actorUserId);
  return { entries };
}
