import { forbidden } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import {
  listEntriesForLease,
  listEntriesForTenant,
  leaseAccessibleByLandlord,
  type RentLedgerEntryRow,
} from '../../lib/rentLedgerRepo.js';
import { logInfo } from '../../lib/serverLogger.js';
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
  const role = String(input.actorRole ?? '').trim().toUpperCase();
  const leaseId = input.leaseId?.trim();
  const branch =
    hasLandlordAccess(role) && leaseId ? ('landlord_lease' as const) : ('tenant' as const);

  logInfo(undefined, 'rentLedger.listRentLedger.begin', {
    actorUserId: input.actorUserId,
    actorRole: role,
    leaseId: leaseId ?? null,
    branch,
  });

  // Landlord management list is scoped by lease when lease_id is provided (GET /api/landlord/rent-ledger).
  // Portal GET /api/portal/rent-ledger never passes lease_id — always use tenant scope for that route,
  // even when the user is ADMIN/LANDLORD (those roles use the landlord API when viewing by lease).
  if (hasLandlordAccess(role) && leaseId) {
    const accessible = await leaseAccessibleByLandlord(
      db,
      leaseId,
      input.actorUserId,
      role
    );
    if (!accessible) throw forbidden();
    const entries = await listEntriesForLease(db, leaseId);
    logInfo(undefined, 'rentLedger.listRentLedger.complete', {
      actorUserId: input.actorUserId,
      branch: 'landlord_lease',
      leaseId,
      rowCount: entries.length,
    });
    return { entries };
  }

  const entries = await listEntriesForTenant(db, input.actorUserId);
  logInfo(undefined, 'rentLedger.listRentLedger.complete', {
    actorUserId: input.actorUserId,
    branch: 'tenant',
    leaseId: null,
    rowCount: entries.length,
  });
  return { entries };
}
