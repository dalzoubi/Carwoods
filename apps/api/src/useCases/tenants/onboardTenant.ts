/**
 * Onboard a new tenant: creates (or reuses) a tenant user, creates a lease
 * for the selected property, and links the tenant to that lease.
 *
 * Business rules:
 * - Actor must have landlord/admin access.
 * - The property must exist and be accessible to the actor.
 * - Email must not belong to an ADMIN or LANDLORD user.
 * - Lease dates must not overlap any existing lease for this tenant.
 * - Month-to-month leases have no end date.
 */

import {
  upsertTenantUserByEmail,
  checkLeaseOverlapForTenant,
  type TenantRow,
} from '../../lib/tenantsRepo.js';
import { insertLease, linkLeaseTenant, type LeaseRowFull } from '../../lib/leasesRepo.js';
import { getPropertyByIdForActor } from '../../lib/propertiesRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { validateTenantOnboard } from '../../domain/tenantValidation.js';
import {
  forbidden,
  notFound,
  validationError,
  conflictError,
} from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type OnboardTenantInput = {
  actorUserId: string;
  actorRole: string;
  email: string | undefined;
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  phone?: string | null;
  propertyId: string | undefined;
  startDate: string | undefined;
  endDate?: string | null;
  monthToMonth?: boolean;
  notes?: string | null;
};

export type OnboardTenantOutput = {
  tenant: TenantRow;
  tenant_created: boolean;
  lease: LeaseRowFull;
};

export async function onboardTenant(
  db: TransactionPool,
  input: OnboardTenantInput
): Promise<OnboardTenantOutput> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();

  const validation = validateTenantOnboard({
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    propertyId: input.propertyId,
    startDate: input.startDate,
    endDate: input.endDate,
    monthToMonth: input.monthToMonth,
  });
  if (!validation.valid) throw validationError(validation.message);

  // Verify property exists and actor can access it
  const prop = await getPropertyByIdForActor(
    db,
    input.propertyId!,
    input.actorRole,
    input.actorUserId
  );
  if (!prop) throw notFound('property_not_found');

  const monthToMonth = input.monthToMonth ?? false;
  const endDate = monthToMonth ? null : (input.endDate ?? null);

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Create or reuse the tenant user
    let tenantResult: Awaited<ReturnType<typeof upsertTenantUserByEmail>>;
    try {
      tenantResult = await upsertTenantUserByEmail(
        client as Parameters<typeof upsertTenantUserByEmail>[0],
        {
          email: input.email!,
          firstName: input.firstName ?? null,
          lastName: input.lastName ?? null,
          phone: input.phone ?? null,
        }
      );
    } catch (e) {
      await client.query('ROLLBACK');
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'email_belongs_to_admin') throw conflictError('email_belongs_to_admin');
      if (msg === 'email_belongs_to_landlord') throw conflictError('email_belongs_to_landlord');
      throw e;
    }

    // Check for overlapping leases
    const hasOverlap = await checkLeaseOverlapForTenant(
      client as Parameters<typeof checkLeaseOverlapForTenant>[0],
      tenantResult.user.id,
      input.startDate!,
      endDate
    );
    if (hasOverlap) {
      await client.query('ROLLBACK');
      throw conflictError('lease_dates_overlap');
    }

    // Derive status: ACTIVE if start_date <= today, else UPCOMING
    const today = new Date().toISOString().slice(0, 10);
    const leaseStatus = input.startDate! <= today ? 'ACTIVE' : 'UPCOMING';

    // Create the lease
    const lease = await insertLease(client as Parameters<typeof insertLease>[0], {
      property_id: input.propertyId!,
      start_date: input.startDate!,
      end_date: endDate,
      month_to_month: monthToMonth,
      status: leaseStatus,
      notes: input.notes ?? null,
      created_by: input.actorUserId,
    });

    // Link tenant to lease
    await linkLeaseTenant(
      client as Parameters<typeof linkLeaseTenant>[0],
      lease.id,
      tenantResult.user.id
    );

    // Audit logs
    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'TENANT',
      entityId: tenantResult.user.id,
      action: tenantResult.created ? 'CREATE' : 'UPDATE',
      before: null,
      after: tenantResult.user,
    });
    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'LEASE',
      entityId: lease.id,
      action: 'CREATE',
      before: null,
      after: lease,
    });

    await client.query('COMMIT');
    return {
      tenant: tenantResult.user,
      tenant_created: tenantResult.created,
      lease,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
