/**
 * Add a new lease for an existing tenant.
 *
 * Business rules:
 * - Actor must have landlord/admin access.
 * - Tenant must exist and is accessible to actor.
 * - Property must exist and is accessible to actor.
 * - New lease dates must not overlap any existing lease for this tenant (and co-tenants being linked).
 * - The property must not already have another tenant on an overlapping lease outside the allowed household.
 * - Optional co-tenants must share an existing lease at this property with the primary tenant.
 * - Month-to-month leases have no end date.
 */

import { getTenantById, checkLeaseOverlapForTenant } from '../../lib/tenantsRepo.js';
import {
  insertLease,
  linkLeaseTenant,
  tenantsShareALeaseAtProperty,
  checkPropertyExclusiveTenantConflict,
  hasOverlappingLeaseAtProperty,
  type LeaseRowFull,
} from '../../lib/leasesRepo.js';
import { getPropertyByIdForActor } from '../../lib/propertiesRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { validateAddTenantLease } from '../../domain/tenantValidation.js';
import { parseRentAmountInput } from '../../domain/leaseValidation.js';
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
  /** Co-tenant user IDs on an existing shared lease at this property to link to the new lease row. */
  additionalTenantUserIds?: string[];
  rent_amount?: unknown;
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

  const tenant = await getTenantById(db, input.tenantId, input.actorRole, input.actorUserId);
  if (!tenant) throw notFound('tenant_not_found');

  const prop = await getPropertyByIdForActor(
    db,
    input.propertyId,
    input.actorRole,
    input.actorUserId
  );
  if (!prop) throw notFound('property_not_found');

  const monthToMonth = input.monthToMonth ?? false;
  const endDate = monthToMonth ? null : (input.endDate ?? null);

  const rentParsed = parseRentAmountInput(input.rent_amount);
  if (!rentParsed.ok) throw validationError(rentParsed.message);
  const rentAmount = rentParsed.amount === undefined ? null : rentParsed.amount;

  const rawAdditional = input.additionalTenantUserIds ?? [];
  const additionalUnique = [...new Set(rawAdditional.map((id) => id.trim()).filter(Boolean))].filter(
    (id) => id !== input.tenantId
  );

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const pool = client as Parameters<typeof checkLeaseOverlapForTenant>[0];

    for (const uid of additionalUnique) {
      const shared = await tenantsShareALeaseAtProperty(pool, input.tenantId, uid, input.propertyId!);
      if (!shared) {
        await client.query('ROLLBACK');
        throw validationError('co_tenant_not_on_shared_lease');
      }
    }

    const allLeaseholders = [input.tenantId, ...additionalUnique];

    const hasTenantOverlap = await checkLeaseOverlapForTenant(pool, input.tenantId, input.startDate!, endDate);
    if (hasTenantOverlap) {
      await client.query('ROLLBACK');
      throw conflictError('lease_dates_overlap');
    }

    for (const uid of additionalUnique) {
      const overlapOther = await checkLeaseOverlapForTenant(pool, uid, input.startDate!, endDate);
      if (overlapOther) {
        await client.query('ROLLBACK');
        throw conflictError('lease_dates_overlap');
      }
    }

    const hasPropertyConflict = await checkPropertyExclusiveTenantConflict(pool, {
      propertyId: input.propertyId,
      startDate: input.startDate!,
      endDate,
      excludeLeaseId: null,
      allowedUserIds: allLeaseholders,
    });
    if (hasPropertyConflict) {
      await client.query('ROLLBACK');
      throw conflictError('property_lease_occupancy_conflict');
    }

    const overlapsCalendar = await hasOverlappingLeaseAtProperty(pool, {
      propertyId: input.propertyId,
      startDate: input.startDate!,
      endDate,
      excludeLeaseId: null,
    });
    if (overlapsCalendar) {
      await client.query('ROLLBACK');
      throw conflictError('property_lease_overlap');
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
      rent_amount: rentAmount,
      created_by: input.actorUserId,
    });

    await linkLeaseTenant(client as Parameters<typeof linkLeaseTenant>[0], lease.id, input.tenantId);

    for (const uid of additionalUnique) {
      const link = await linkLeaseTenant(client as Parameters<typeof linkLeaseTenant>[0], lease.id, uid);
      await writeAudit(client as Parameters<typeof writeAudit>[0], {
        actorUserId: input.actorUserId,
        entityType: 'LEASE_TENANT',
        entityId: link.id,
        action: 'LINK',
        before: null,
        after: { lease_id: lease.id, user_id: uid, link_id: link.id },
      });
    }

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
