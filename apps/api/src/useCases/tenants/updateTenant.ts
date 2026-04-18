import { findUserByEmail } from '../../lib/usersRepo.js';
import {
  getTenantById,
  listLeasesEligibleForTenantPropertyMove,
  setLeaseProperty,
  updateTenantProfile,
  type TenantRow,
} from '../../lib/tenantsRepo.js';
import {
  listLeaseTenantUserIds,
  checkPropertyExclusiveTenantConflict,
} from '../../lib/leasesRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { validateProfileUpdate } from '../../domain/userValidation.js';
import { conflictError, forbidden, notFound, validationError } from '../../domain/errors.js';
import { hasLandlordAccess, Role } from '../../domain/constants.js';
import { getPropertyByIdForActor } from '../../lib/propertiesRepo.js';
import type { TransactionPool } from '../types.js';

export type UpdateTenantInput = {
  actorUserId: string;
  actorRole: string;
  tenantId: string;
  email: string | undefined;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  propertyId?: string;
};

export type UpdateTenantOutput = {
  tenant: TenantRow;
};

export async function updateTenant(
  db: TransactionPool,
  input: UpdateTenantInput
): Promise<UpdateTenantOutput> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();

  const validation = validateProfileUpdate({
    email: input.email,
    firstName: input.firstName ?? undefined,
    lastName: input.lastName ?? undefined,
    phone: input.phone ?? undefined,
  });
  if (!validation.valid) throw validationError(validation.message);

  const normalizedPropertyId = String(input.propertyId ?? '').trim();
  const shouldReassignLandlord = normalizedPropertyId.length > 0;
  if (shouldReassignLandlord && input.actorRole.trim().toUpperCase() !== Role.ADMIN) {
    throw forbidden();
  }

  const before = await getTenantById(db, input.tenantId, input.actorRole, input.actorUserId);
  if (!before) throw notFound('tenant_not_found');

  const existingByEmail = await findUserByEmail(db, input.email!);
  if (existingByEmail && existingByEmail.id !== input.tenantId) {
    throw conflictError('email_already_in_use');
  }

  if (shouldReassignLandlord) {
    const property = await getPropertyByIdForActor(
      db,
      normalizedPropertyId,
      input.actorRole,
      input.actorUserId
    );
    if (!property) throw notFound('property_not_found');
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const updated = await updateTenantProfile(
      client as Parameters<typeof updateTenantProfile>[0],
      input.tenantId,
      {
        email: input.email!,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        phone: input.phone ?? null,
      }
    );
    if (!updated) {
      await client.query('ROLLBACK');
      throw notFound('tenant_not_found');
    }

    if (shouldReassignLandlord) {
      const leasesToMove = await listLeasesEligibleForTenantPropertyMove(
        client as Parameters<typeof listLeasesEligibleForTenantPropertyMove>[0],
        input.tenantId
      );
      if (leasesToMove.length === 0) {
        await client.query('ROLLBACK');
        throw notFound('active_lease_not_found');
      }

      for (const leaseRow of leasesToMove) {
        const leaseEnd = leaseRow.month_to_month ? null : leaseRow.end_date;
        const tenantsOnLease = await listLeaseTenantUserIds(
          client as Parameters<typeof listLeaseTenantUserIds>[0],
          leaseRow.id
        );
        const propertyConflict = await checkPropertyExclusiveTenantConflict(
          client as Parameters<typeof checkPropertyExclusiveTenantConflict>[0],
          {
            propertyId: normalizedPropertyId,
            startDate: leaseRow.start_date,
            endDate: leaseEnd,
            excludeLeaseId: leaseRow.id,
            allowedUserIds: tenantsOnLease,
          }
        );
        if (propertyConflict) {
          await client.query('ROLLBACK');
          throw conflictError('property_lease_occupancy_conflict');
        }
      }

      for (const leaseRow of leasesToMove) {
        const changed = await setLeaseProperty(
          client as Parameters<typeof setLeaseProperty>[0],
          leaseRow.id,
          normalizedPropertyId,
          input.actorUserId
        );
        if (!changed) {
          await client.query('ROLLBACK');
          throw notFound('active_lease_not_found');
        }
      }
    }

    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'TENANT',
      entityId: input.tenantId,
      action: 'UPDATE',
      before,
      after: updated,
    });

    await client.query('COMMIT');
    return { tenant: updated };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
