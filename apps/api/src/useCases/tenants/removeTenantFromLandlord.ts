/**
 * Remove a tenant from the acting landlord's portfolio (unlink from leases on that landlord's
 * properties, or soft-delete single-tenant leases). If the tenant has no remaining leases with
 * any landlord, disable their portal account.
 */

import {
  getTenantById,
  setTenantStatus,
  tenantHasAnyNonDeletedLease,
  type TenantRow,
} from '../../lib/tenantsRepo.js';
import {
  listLeaseIdsForTenantUnderLandlord,
  listLeaseTenantUserIds,
  softDeleteLease,
  unlinkLeaseTenantRow,
} from '../../lib/leasesRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { hasLandlordAccess, Role } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type RemoveTenantFromLandlordInput = {
  actorUserId: string;
  actorRole: string;
  tenantId: string;
  /**
   * When the actor is ADMIN, required: landlord whose properties to detach from (`properties.created_by`).
   * Ignored for LANDLORD (always the actor).
   */
  scopeLandlordUserId?: string | null;
};

export type RemoveTenantFromLandlordOutput = {
  tenant: TenantRow;
  /** True when the user had no leases left anywhere and was disabled. */
  disabled_account: boolean;
};

type DetachClient = Parameters<typeof listLeaseIdsForTenantUnderLandlord>[0];

/**
 * Unlinks this tenant from all leases on the given landlord's properties (or soft-deletes
 * single-tenant leases). Caller manages transaction boundaries.
 *
 * @returns whether the tenant still has any non-deleted lease anywhere afterward.
 */
export async function detachTenantFromLandlordLeases(
  client: DetachClient,
  params: {
    tenantId: string;
    scopeLandlordId: string;
    actorUserId: string;
  }
): Promise<{ stillLinkedGlobally: boolean }> {
  const tenantId = params.tenantId.trim();
  const leaseIds = await listLeaseIdsForTenantUnderLandlord(
    client,
    tenantId,
    params.scopeLandlordId
  );

  if (leaseIds.length === 0) {
    throw validationError('no_leases_under_landlord');
  }

  const tidLower = tenantId.trim().toLowerCase();

  for (const leaseId of leaseIds) {
    const userIds = await listLeaseTenantUserIds(
      client as Parameters<typeof listLeaseTenantUserIds>[0],
      leaseId
    );
    const rawTenantId = userIds.find((id) => id.trim().toLowerCase() === tidLower);
    if (!rawTenantId) {
      throw validationError('lease_tenant_not_linked');
    }

    if (userIds.length > 1) {
      const removed = await unlinkLeaseTenantRow(
        client as Parameters<typeof unlinkLeaseTenantRow>[0],
        leaseId,
        rawTenantId
      );
      if (!removed) {
        throw validationError('lease_tenant_not_linked');
      }
    } else {
      const ok = await softDeleteLease(
        client as Parameters<typeof softDeleteLease>[0],
        leaseId,
        params.actorUserId
      );
      if (!ok) {
        throw notFound();
      }
    }
  }

  const stillLinkedGlobally = await tenantHasAnyNonDeletedLease(
    client as Parameters<typeof tenantHasAnyNonDeletedLease>[0],
    tenantId
  );
  return { stillLinkedGlobally };
}

export async function removeTenantFromLandlord(
  db: TransactionPool,
  input: RemoveTenantFromLandlordInput
): Promise<RemoveTenantFromLandlordOutput> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();

  const role = input.actorRole.trim().toUpperCase();
  const tenantId = String(input.tenantId ?? '').trim();
  if (!tenantId) throw validationError('missing_tenant_id');

  let scopeLandlordId: string;
  if (role === Role.ADMIN) {
    const raw = String(input.scopeLandlordUserId ?? '').trim();
    if (!raw) throw validationError('landlord_id_required');
    scopeLandlordId = raw;
  } else {
    scopeLandlordId = input.actorUserId;
  }

  const beforeTenant = await getTenantById(db, tenantId, input.actorRole, input.actorUserId);
  if (!beforeTenant) throw notFound();

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { stillLinkedGlobally: stillLinked } = await detachTenantFromLandlordLeases(
      client as DetachClient,
      {
        tenantId,
        scopeLandlordId,
        actorUserId: input.actorUserId,
      }
    );

    let tenantAfter: TenantRow = beforeTenant;
    if (!stillLinked) {
      const disabled = await setTenantStatus(
        client as Parameters<typeof setTenantStatus>[0],
        tenantId,
        false
      );
      if (!disabled) {
        await client.query('ROLLBACK');
        throw notFound();
      }
      tenantAfter = disabled;
    }

    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'TENANT',
      entityId: tenantId,
      action: 'DELETE',
      before: beforeTenant,
      after: tenantAfter,
    });

    await client.query('COMMIT');
    return { tenant: tenantAfter, disabled_account: !stillLinked };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
