import { forbidden, validationError } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import {
  listEntriesForLease,
  listEntriesForProperty,
  listEntriesForTenantPortal,
  leaseAccessibleByLandlord,
  propertyAccessibleByLandlord,
  type PaymentEntryRow,
} from '../../lib/paymentEntriesRepo.js';
import { logInfo } from '../../lib/serverLogger.js';
import type { TransactionPool } from '../types.js';

export type ListPaymentEntriesInput = {
  actorUserId: string;
  actorRole: string;
  /** Landlord: list rows for this lease (legacy / narrow). */
  leaseId?: string;
  /** Landlord: list all payment lines for a property (any scope). */
  propertyId?: string;
  /** Optional filters when propertyId is set. */
  filterLeaseId?: string;
  filterTenantUserId?: string;
  /** Tenant portal: limit to one property (optional). */
  propertyIdForTenant?: string | null;
};

export type ListPaymentEntriesOutput = {
  entries: PaymentEntryRow[];
};

export async function listPaymentEntries(
  db: TransactionPool,
  input: ListPaymentEntriesInput
): Promise<ListPaymentEntriesOutput> {
  const role = String(input.actorRole ?? '').trim().toUpperCase();
  const leaseId = input.leaseId?.trim();
  const propertyId = input.propertyId?.trim();
  const isLandlord = hasLandlordAccess(role);

  logInfo(undefined, 'payments.listPaymentEntries.begin', {
    actorUserId: input.actorUserId,
    actorRole: role,
    leaseId: leaseId ?? null,
    propertyId: propertyId ?? null,
  });

  if (isLandlord) {
    if (propertyId) {
      const ok = await propertyAccessibleByLandlord(
        db,
        propertyId,
        input.actorUserId,
        role
      );
      if (!ok) throw forbidden();
      const entries = await listEntriesForProperty(db, {
        propertyId,
        leaseId: input.filterLeaseId?.trim() || null,
        tenantUserId: input.filterTenantUserId?.trim() || null,
      });
      logInfo(undefined, 'payments.listPaymentEntries.complete', {
        branch: 'landlord_property',
        rowCount: entries.length,
      });
      return { entries };
    }
    if (leaseId) {
      const accessible = await leaseAccessibleByLandlord(
        db,
        leaseId,
        input.actorUserId,
        role
      );
      if (!accessible) throw forbidden();
      const entries = await listEntriesForLease(db, leaseId);
      logInfo(undefined, 'payments.listPaymentEntries.complete', {
        branch: 'landlord_lease',
        leaseId,
        rowCount: entries.length,
      });
      return { entries };
    }
    throw validationError('property_id_or_lease_id_required');
  }

  const prop =
    input.propertyIdForTenant !== undefined && input.propertyIdForTenant !== null
      ? String(input.propertyIdForTenant).trim() || null
      : null;
  const entries = await listEntriesForTenantPortal(
    db,
    input.actorUserId,
    prop
  );
  logInfo(undefined, 'payments.listPaymentEntries.complete', {
    branch: 'tenant',
    rowCount: entries.length,
  });
  return { entries };
}
