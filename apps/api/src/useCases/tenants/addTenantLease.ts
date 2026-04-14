/**
 * Add a new lease for an existing tenant.
 *
 * Business rules:
 * - Actor must have landlord/admin access.
 * - Tenant must exist and be accessible to actor.
 * - Property must exist and be accessible to actor.
 * - New lease dates must not overlap any existing lease for this tenant.
 * - The property must not already have another tenant on an overlapping lease
 *   (same household may share one lease; roommates stay on that lease).
 * - Month-to-month leases have no end date.
 */

import { getTenantById, checkLeaseOverlapForTenant } from '../../lib/tenantsRepo.js';
import {
  insertLease,
  linkLeaseTenant,
  checkPropertyExclusiveTenantConflict,
  type LeaseRowFull,
} from '../../lib/leasesRepo.js';
import { getPropertyByIdForActor } from '../../lib/propertiesRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { validateAddTenantLease } from '../../domain/tenantValidation.js';
import { forbidden, notFound, validationError, conflictError } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type AddTenantLeaseInput = {
  actorUserId: string;
  actorRole: string;
  tenantId: string;
  propertyId: string | undefined;
  startDate: string | undefined;
  endDate?: string | null;
  monthToMonth?: boolean;
  notes?: string | null;
};

export type AddTenantLeaseOutput = {
  lease: LeaseRowFull;
};

export async function addTenantLease(
  db: TransactionPool,
  input: AddTenantLeaseInput
): Promise<AddTenantLeaseOutput> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();

  const validation = validateAddTenantLease({
    startDate: input.startDate,
    endDate: input.endDate,
    monthToMonth: input.monthToMonth,
  });
  if (!validation.valid) throw validationError(validation.message);

  if (!input.propertyId) throw validationError('missing_property_id');

  // Verify tenant exists and actor can access it
  const tenant = await getTenantById(db, input.tenantId, input.actorRole, input.actorUserId);
  if (!tenant) throw notFound('tenant_not_found');

  // Verify property exists and actor can access it
  const prop = await getPropertyByIdForActor(
    db,
    input.propertyId,
    input.actorRole,
    input.actorUserId
  );
  if (!prop) throw notFound('property_not_found');

  const monthToMonth = input.monthToMonth ?? false;
  const endDate = monthToMonth ? null : (input.endDate ?? null);

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const hasTenantOverlap = await checkLeaseOverlapForTenant(
      client as Parameters<typeof checkLeaseOverlapForTenant>[0],
      input.tenantId,
      input.startDate!,
      endDate
    );
    if (hasTenantOverlap) {
      await client.query('ROLLBACK');
      throw conflictError('lease_dates_overlap');
    }

    const hasPropertyConflict = await checkPropertyExclusiveTenantConflict(
      client as Parameters<typeof checkPropertyExclusiveTenantConflict>[0],
      {
        propertyId: input.propertyId,
        startDate: input.startDate!,
        endDate: endDate,
        excludeLeaseId: null,
        allowedUserIds: [input.tenantId],
      }
    );
    if (hasPropertyConflict) {
      await client.query('ROLLBACK');
      throw conflictError('property_lease_occupancy_conflict');
    }

    const today = new Date().toISOString().slice(0, 10);
    const leaseStatus = input.startDate! <= today ? 'ACTIVE' : 'UPCOMING';

    const lease = await insertLease(client as Parameters<typeof insertLease>[0], {
      property_id: input.propertyId,
      start_date: input.startDate!,
      end_date: endDate,
      month_to_month: monthToMonth,
      status: leaseStatus,
      notes: input.notes ?? null,
      created_by: input.actorUserId,
    });

    await linkLeaseTenant(
      client as Parameters<typeof linkLeaseTenant>[0],
      lease.id,
      input.tenantId
    );

    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'LEASE',
      entityId: lease.id,
      action: 'CREATE',
      before: null,
      after: lease,
    });

    await client.query('COMMIT');
    return { lease };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
