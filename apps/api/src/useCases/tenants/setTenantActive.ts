import {
  countDistinctLandlordsForTenant,
  getTenantById,
  getTenantUserById,
  setTenantStatus,
  type TenantRow,
} from '../../lib/tenantsRepo.js';
import { listLeaseIdsForTenantUnderLandlord } from '../../lib/leasesRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { hasLandlordAccess, Role } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';
import { detachTenantFromLandlordLeases } from './removeTenantFromLandlord.js';

export type SetTenantActiveInput = {
  actorUserId: string;
  actorRole: string;
  tenantId: string;
  active: boolean;
  /**
   * When the actor is ADMIN and deactivating a tenant linked to multiple landlords,
   * required: `properties.created_by` for the landlord whose leases to end (query `landlord_id`).
   */
  scopeLandlordUserId?: string | null;
};

export type SetTenantActiveOutput = {
  tenant: TenantRow;
  /**
   * True when access was turned off only for this landlord's leases; the account may stay ACTIVE
   * if the tenant still leases elsewhere.
   */
  scoped_deactivate?: boolean;
};

export async function setTenantActive(
  db: TransactionPool,
  input: SetTenantActiveInput
): Promise<SetTenantActiveOutput> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();

  const tenantId = String(input.tenantId ?? '').trim();
  if (!tenantId) throw validationError('missing_tenant_id');

  const before = await getTenantById(db, tenantId, input.actorRole, input.actorUserId);
  if (!before) throw notFound('tenant_not_found');

  const role = input.actorRole.trim().toUpperCase();

  if (input.active === true) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const updated = await setTenantStatus(
        client as Parameters<typeof setTenantStatus>[0],
        tenantId,
        true
      );
      if (!updated) {
        await client.query('ROLLBACK');
        throw notFound('tenant_not_found');
      }

      await writeAudit(client as Parameters<typeof writeAudit>[0], {
        actorUserId: input.actorUserId,
        entityType: 'TENANT',
        entityId: tenantId,
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

  // Deactivate
  const landlordCount = await countDistinctLandlordsForTenant(db, tenantId);

  if (landlordCount <= 1) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const updated = await setTenantStatus(
        client as Parameters<typeof setTenantStatus>[0],
        tenantId,
        false
      );
      if (!updated) {
        await client.query('ROLLBACK');
        throw notFound('tenant_not_found');
      }

      await writeAudit(client as Parameters<typeof writeAudit>[0], {
        actorUserId: input.actorUserId,
        entityType: 'TENANT',
        entityId: tenantId,
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

  let scopeLandlordId: string;
  if (role === Role.ADMIN) {
    const raw = String(input.scopeLandlordUserId ?? '').trim();
    if (!raw) throw validationError('landlord_id_required');
    scopeLandlordId = raw;
  } else {
    scopeLandlordId = input.actorUserId;
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { stillLinkedGlobally } = await detachTenantFromLandlordLeases(
      client as Parameters<typeof listLeaseIdsForTenantUnderLandlord>[0],
      {
        tenantId,
        scopeLandlordId,
        actorUserId: input.actorUserId,
      }
    );

    let tenantAfter: TenantRow | null = before;
    if (!stillLinkedGlobally) {
      const disabled = await setTenantStatus(
        client as Parameters<typeof setTenantStatus>[0],
        tenantId,
        false
      );
      if (!disabled) {
        await client.query('ROLLBACK');
        throw notFound('tenant_not_found');
      }
      tenantAfter = disabled;
    } else {
      const row = await getTenantUserById(
        client as Parameters<typeof getTenantUserById>[0],
        tenantId
      );
      if (!row) {
        await client.query('ROLLBACK');
        throw notFound('tenant_not_found');
      }
      tenantAfter = row;
    }

    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'TENANT',
      entityId: tenantId,
      action: 'UPDATE',
      before,
      after: tenantAfter,
    });

    await client.query('COMMIT');
    return {
      tenant: tenantAfter,
      ...(stillLinkedGlobally ? { scoped_deactivate: true as const } : {}),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
