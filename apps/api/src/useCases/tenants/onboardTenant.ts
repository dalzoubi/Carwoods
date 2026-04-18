/**
 * Onboard a new tenant: creates (or reuses) a tenant user, then either links them
 * to an existing active occupancy lease at the selected property or creates a new lease.
 *
 * Business rules:
 * - Actor must have landlord/admin access.
 * - The property must exist and be accessible to the actor.
 * - Email must not belong to an ADMIN or LANDLORD user.
 * - Lease dates must not overlap any existing lease for this tenant.
 * - The property must not already have another tenant on an overlapping lease (unless
 *   joining the same lease row as an allowed co-tenant).
 * - Month-to-month leases have no end date.
 */

import {
  upsertTenantUserByEmail,
  checkLeaseOverlapForTenant,
  type TenantRow,
} from '../../lib/tenantsRepo.js';
import {
  insertLease,
  linkLeaseTenant,
  listLeaseTenantUserIds,
  findActiveOccupancyLeaseForProperty,
  checkPropertyExclusiveTenantConflict,
  hasOverlappingLeaseAtProperty,
  type LeaseRowFull,
} from '../../lib/leasesRepo.js';
import { getPropertyByIdForActor } from '../../lib/propertiesRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { enqueueNotification } from '../../lib/notificationRepo.js';
import { validateTenantOnboard, validateTenantOnboardReuse } from '../../domain/tenantValidation.js';
import { parseRentAmountInput } from '../../domain/leaseValidation.js';
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
  rent_amount?: unknown;
};

export type OnboardTenantOutput = {
  tenant: TenantRow;
  tenant_created: boolean;
  lease: LeaseRowFull;
  lease_reused: boolean;
};

export async function onboardTenant(
  db: TransactionPool,
  input: OnboardTenantInput
): Promise<OnboardTenantOutput> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();

  const propertyId = input.propertyId?.trim() ?? '';
  if (!propertyId) throw validationError('missing_property_id');

  // Verify property exists and actor can access it
  const prop = await getPropertyByIdForActor(
    db,
    propertyId,
    input.actorRole,
    input.actorUserId
  );
  if (!prop) throw notFound('property_not_found');

  const existingOccupancyLease = await findActiveOccupancyLeaseForProperty(db, propertyId);

  const validation = existingOccupancyLease
    ? validateTenantOnboardReuse({
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        propertyId,
      })
    : validateTenantOnboard({
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        propertyId,
        startDate: input.startDate,
        endDate: input.endDate,
        monthToMonth: input.monthToMonth,
      });
  if (!validation.valid) throw validationError(validation.message);

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

    // --- Link to existing active lease at this property (roommate / co-tenant onboard) ---
    if (existingOccupancyLease) {
      const leaseRef = existingOccupancyLease;
      const leaseEnd = leaseRef.month_to_month ? null : leaseRef.end_date;

      const hasOverlap = await checkLeaseOverlapForTenant(
        client as Parameters<typeof checkLeaseOverlapForTenant>[0],
        tenantResult.user.id,
        leaseRef.start_date,
        leaseEnd,
        null
      );
      if (hasOverlap) {
        await client.query('ROLLBACK');
        throw conflictError('lease_dates_overlap');
      }

      const existingOnLease = await listLeaseTenantUserIds(
        client as Parameters<typeof listLeaseTenantUserIds>[0],
        leaseRef.id
      );
      const allowedUserIds = [...new Set([...existingOnLease, tenantResult.user.id])];
      const hasPropertyConflict = await checkPropertyExclusiveTenantConflict(
        client as Parameters<typeof checkPropertyExclusiveTenantConflict>[0],
        {
          propertyId,
          startDate: leaseRef.start_date,
          endDate: leaseEnd,
          excludeLeaseId: leaseRef.id,
          allowedUserIds,
        }
      );
      if (hasPropertyConflict) {
        await client.query('ROLLBACK');
        throw conflictError('property_lease_occupancy_conflict');
      }

      const link = await linkLeaseTenant(
        client as Parameters<typeof linkLeaseTenant>[0],
        leaseRef.id,
        tenantResult.user.id
      );

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
        entityType: 'LEASE_TENANT',
        entityId: link.id,
        action: 'LINK',
        before: null,
        after: { lease_id: leaseRef.id, user_id: tenantResult.user.id, link_id: link.id },
      });

      await enqueueNotification(client as Parameters<typeof enqueueNotification>[0], {
        eventTypeCode: 'ACCOUNT_ONBOARDED_WELCOME',
        payload: {
          user_id: tenantResult.user.id,
          email: tenantResult.user.email,
          phone: tenantResult.user.phone,
          role: tenantResult.user.role,
          lease_id: leaseRef.id,
          property_id: propertyId,
        },
        idempotencyKey: `onboard-welcome:${tenantResult.user.id}:${leaseRef.id}`,
      });

      await enqueueNotification(client as Parameters<typeof enqueueNotification>[0], {
        eventTypeCode: 'ACCOUNT_EMAIL_VERIFICATION',
        payload: {
          user_id: tenantResult.user.id,
          email: tenantResult.user.email,
          phone: tenantResult.user.phone,
          role: tenantResult.user.role,
        },
        idempotencyKey: `onboard-email-verification:${tenantResult.user.id}:${leaseRef.id}`,
      });

      await client.query('COMMIT');
      return {
        tenant: tenantResult.user,
        tenant_created: tenantResult.created,
        lease: leaseRef,
        lease_reused: true,
      };
    }

    // --- Create new lease ---
    const rentParsed = parseRentAmountInput(input.rent_amount);
    if (!rentParsed.ok) {
      await client.query('ROLLBACK');
      throw validationError(rentParsed.message);
    }
    const rentForInsert = rentParsed.amount === undefined ? null : rentParsed.amount;

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

    const hasPropertyConflict = await checkPropertyExclusiveTenantConflict(
      client as Parameters<typeof checkPropertyExclusiveTenantConflict>[0],
      {
        propertyId,
        startDate: input.startDate!,
        endDate,
        excludeLeaseId: null,
        allowedUserIds: [tenantResult.user.id],
      }
    );
    if (hasPropertyConflict) {
      await client.query('ROLLBACK');
      throw conflictError('property_lease_occupancy_conflict');
    }

    const overlapsCalendar = await hasOverlappingLeaseAtProperty(
      client as Parameters<typeof hasOverlappingLeaseAtProperty>[0],
      {
        propertyId,
        startDate: input.startDate!,
        endDate,
        excludeLeaseId: null,
      }
    );
    if (overlapsCalendar) {
      await client.query('ROLLBACK');
      throw conflictError('property_lease_overlap');
    }

    const today = new Date().toISOString().slice(0, 10);
    const leaseStatus = input.startDate! <= today ? 'ACTIVE' : 'UPCOMING';

    const lease = await insertLease(client as Parameters<typeof insertLease>[0], {
      property_id: propertyId,
      start_date: input.startDate!,
      end_date: endDate,
      month_to_month: monthToMonth,
      status: leaseStatus,
      notes: input.notes ?? null,
      rent_amount: rentForInsert,
      created_by: input.actorUserId,
    });

    await linkLeaseTenant(
      client as Parameters<typeof linkLeaseTenant>[0],
      lease.id,
      tenantResult.user.id
    );

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

    await enqueueNotification(client as Parameters<typeof enqueueNotification>[0], {
      eventTypeCode: 'ACCOUNT_ONBOARDED_WELCOME',
      payload: {
        user_id: tenantResult.user.id,
        email: tenantResult.user.email,
        phone: tenantResult.user.phone,
        role: tenantResult.user.role,
        lease_id: lease.id,
        property_id: propertyId,
      },
      idempotencyKey: `onboard-welcome:${tenantResult.user.id}:${lease.id}`,
    });

    await enqueueNotification(client as Parameters<typeof enqueueNotification>[0], {
      eventTypeCode: 'ACCOUNT_EMAIL_VERIFICATION',
      payload: {
        user_id: tenantResult.user.id,
        email: tenantResult.user.email,
        phone: tenantResult.user.phone,
        role: tenantResult.user.role,
      },
      idempotencyKey: `onboard-email-verification:${tenantResult.user.id}:${lease.id}`,
    });

    await client.query('COMMIT');
    return {
      tenant: tenantResult.user,
      tenant_created: tenantResult.created,
      lease,
      lease_reused: false,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
