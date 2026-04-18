/**
 * Patch an existing lease (management access required).
 *
 * Business rules:
 * - Lease must exist.
 * - Status must be valid if provided.
 * - If start/end/month-to-month change: each linked tenant must not overlap their
 *   other leases; the property must not have another tenant outside this lease
 *   on an overlapping lease; and no other lease row on the property may overlap
 *   this lease's date range (one occupancy window per property at a time).
 */

import {
  getLeaseById,
  updateLease as updateLeaseRepo,
  listLeaseTenantUserIds,
  checkPropertyExclusiveTenantConflict,
  hasOverlappingLeaseAtProperty,
  type LeaseRowFull,
  type LeasePatch,
} from '../../lib/leasesRepo.js';
import { checkLeaseOverlapForTenant } from '../../lib/tenantsRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { validateLeaseStatus, parseRentAmountInput } from '../../domain/leaseValidation.js';
import { forbidden, notFound, validationError, conflictError } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type UpdateLeaseInput = {
  leaseId: string | undefined;
  actorUserId: string;
  actorRole: string;
  start_date?: string;
  end_date?: string | null;
  end_date_present?: boolean;
  month_to_month?: boolean;
  status?: string;
  notes?: string | null;
  notes_present?: boolean;
  rent_amount?: unknown;
  rent_amount_present?: boolean;
};

export type UpdateLeaseOutput = {
  lease: LeaseRowFull;
};

export async function updateLease(
  db: TransactionPool,
  input: UpdateLeaseInput
): Promise<UpdateLeaseOutput> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();
  if (!input.leaseId) throw validationError('missing_id');

  const statusValidation = validateLeaseStatus(input.status);
  if (!statusValidation.valid) throw validationError(statusValidation.message);

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const before = await getLeaseById(client, input.leaseId);
    if (!before) {
      await client.query('ROLLBACK');
      throw notFound();
    }

    const mergedStart = input.start_date ?? before.start_date;
    const mergedEnd = input.end_date_present ? (input.end_date ?? null) : before.end_date;
    const mergedMonthToMonth = input.month_to_month ?? before.month_to_month;
    const mergedEffectiveEnd: string | null = mergedMonthToMonth ? null : (mergedEnd ?? null);

    const occupancyUnchanged =
      mergedStart === before.start_date &&
      mergedEnd === before.end_date &&
      mergedMonthToMonth === before.month_to_month;

    if (!occupancyUnchanged) {
      const overlapsCalendar = await hasOverlappingLeaseAtProperty(
        client as Parameters<typeof hasOverlappingLeaseAtProperty>[0],
        {
          propertyId: before.property_id,
          startDate: mergedStart,
          endDate: mergedEffectiveEnd,
          excludeLeaseId: input.leaseId,
        }
      );
      if (overlapsCalendar) {
        await client.query('ROLLBACK');
        throw conflictError('property_lease_overlap');
      }

      const tenantIds = await listLeaseTenantUserIds(
        client as Parameters<typeof listLeaseTenantUserIds>[0],
        input.leaseId
      );
      if (tenantIds.length > 0) {
        for (const uid of tenantIds) {
          const overlaps = await checkLeaseOverlapForTenant(
            client as Parameters<typeof checkLeaseOverlapForTenant>[0],
            uid,
            mergedStart,
            mergedEffectiveEnd,
            input.leaseId
          );
          if (overlaps) {
            await client.query('ROLLBACK');
            throw conflictError('lease_dates_overlap');
          }
        }
        const propertyConflict = await checkPropertyExclusiveTenantConflict(
          client as Parameters<typeof checkPropertyExclusiveTenantConflict>[0],
          {
            propertyId: before.property_id,
            startDate: mergedStart,
            endDate: mergedEffectiveEnd,
            excludeLeaseId: input.leaseId,
            allowedUserIds: tenantIds,
          }
        );
        if (propertyConflict) {
          await client.query('ROLLBACK');
          throw conflictError('property_lease_occupancy_conflict');
        }
      }
    }

    let rentPatch: number | null | undefined = undefined;
    if (input.rent_amount_present) {
      const rp = parseRentAmountInput(input.rent_amount);
      if (!rp.ok) {
        await client.query('ROLLBACK');
        throw validationError(rp.message);
      }
      rentPatch = rp.amount === undefined ? null : rp.amount;
    }

    const patch: LeasePatch = {
      start_date: input.start_date,
      end_date: input.end_date_present ? input.end_date : undefined,
      month_to_month: input.month_to_month,
      status: input.status,
      notes: input.notes_present ? input.notes : undefined,
      ...(input.rent_amount_present ? { rent_amount: rentPatch } : {}),
    };
    const row = await updateLeaseRepo(
      client as Parameters<typeof updateLeaseRepo>[0],
      input.leaseId,
      patch,
      input.actorUserId
    );
    if (!row) {
      await client.query('ROLLBACK');
      throw notFound();
    }
    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'LEASE',
      entityId: row.id,
      action: 'UPDATE',
      before: before ?? null,
      after: row,
    });
    await client.query('COMMIT');
    return { lease: row };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
