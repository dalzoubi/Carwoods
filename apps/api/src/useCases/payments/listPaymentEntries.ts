import { forbidden } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import {
  listEntriesForLease,
  listEntriesForTenant,
  leaseAccessibleByLandlord,
  type LeasePaymentEntryRow,
} from '../../lib/paymentEntriesRepo.js';
import { logInfo } from '../../lib/serverLogger.js';
import type { TransactionPool } from '../types.js';

export type ListPaymentEntriesInput = {
  actorUserId: string;
  actorRole: string;
  leaseId?: string;
};

export type ListPaymentEntriesOutput = {
  entries: LeasePaymentEntryRow[];
};

export async function listPaymentEntries(
  db: TransactionPool,
  input: ListPaymentEntriesInput
): Promise<ListPaymentEntriesOutput> {
  const role = String(input.actorRole ?? '').trim().toUpperCase();
  const leaseId = input.leaseId?.trim();
  const branch =
    hasLandlordAccess(role) && leaseId ? ('landlord_lease' as const) : ('tenant' as const);

  logInfo(undefined, 'payments.listPaymentEntries.begin', {
    actorUserId: input.actorUserId,
    actorRole: role,
    leaseId: leaseId ?? null,
    branch,
  });

  // Landlord list when lease_id is provided (GET /api/landlord/payments?lease_id=).
  // Portal GET /api/portal/payments never passes lease_id — tenant scope only.
  if (hasLandlordAccess(role) && leaseId) {
    const accessible = await leaseAccessibleByLandlord(
      db,
      leaseId,
      input.actorUserId,
      role
    );
    if (!accessible) throw forbidden();
    const entries = await listEntriesForLease(db, leaseId);
    logInfo(undefined, 'payments.listPaymentEntries.complete', {
      actorUserId: input.actorUserId,
      branch: 'landlord_lease',
      leaseId,
      rowCount: entries.length,
    });
    return { entries };
  }

  const entries = await listEntriesForTenant(db, input.actorUserId);
  logInfo(undefined, 'payments.listPaymentEntries.complete', {
    actorUserId: input.actorUserId,
    branch: 'tenant',
    leaseId: null,
    rowCount: entries.length,
  });
  return { entries };
}
