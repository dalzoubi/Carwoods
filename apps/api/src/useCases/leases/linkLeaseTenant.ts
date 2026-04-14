/**
 * Link a tenant user to an existing lease (management access required).
 *
 * Business rules:
 * - Lease must exist.
 * - User must exist in the users table.
 * - User must not have another overlapping lease (excluding this lease).
 * - Property must not have another tenant outside this lease on an overlapping lease.
 */

import {
  getLeaseById,
  linkLeaseTenant as linkTenantRepo,
  listLeaseTenantUserIds,
  checkPropertyExclusiveTenantConflict,
} from '../../lib/leasesRepo.js';
import { checkLeaseOverlapForTenant } from '../../lib/tenantsRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { forbidden, notFound, validationError, conflictError } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type LinkLeaseTenantInput = {
  leaseId: string | undefined;
  tenantUserId: string | undefined;
  actorUserId: string;
  actorRole: string;
};

export type LinkLeaseTenantOutput = {
  lease_tenant: { id: string; lease_id: string; user_id: string };
};

export async function linkLeaseTenant(
  db: TransactionPool,
  input: LinkLeaseTenantInput
): Promise<LinkLeaseTenantOutput> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();
  if (!input.leaseId) throw validationError('missing_lease_id');
  if (!input.tenantUserId) throw validationError('missing_user_id');

  const lease = await getLeaseById(db, input.leaseId);
  if (!lease) throw notFound('lease_not_found');

  const userCheck = await db.query<{ id: string }>(
    `SELECT id FROM users WHERE id = $1::uuid`,
    [input.tenantUserId]
  );
  if (userCheck.rows.length === 0) throw validationError('user_not_found');

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const leaseEnd = lease.month_to_month ? null : lease.end_date;
    const hasTenantOverlap = await checkLeaseOverlapForTenant(
      client as Parameters<typeof checkLeaseOverlapForTenant>[0],
      input.tenantUserId,
      lease.start_date,
      leaseEnd,
      input.leaseId
    );
    if (hasTenantOverlap) {
      await client.query('ROLLBACK');
      throw conflictError('lease_dates_overlap');
    }

    const existingOnLease = await listLeaseTenantUserIds(
      client as Parameters<typeof listLeaseTenantUserIds>[0],
      input.leaseId
    );
    const allowedUserIds = [...new Set([...existingOnLease, input.tenantUserId])];
    const hasPropertyConflict = await checkPropertyExclusiveTenantConflict(
      client as Parameters<typeof checkPropertyExclusiveTenantConflict>[0],
      {
        propertyId: lease.property_id,
        startDate: lease.start_date,
        endDate: leaseEnd,
        excludeLeaseId: input.leaseId,
        allowedUserIds,
      }
    );
    if (hasPropertyConflict) {
      await client.query('ROLLBACK');
      throw conflictError('property_lease_occupancy_conflict');
    }

    const link = await linkTenantRepo(
      client as Parameters<typeof linkTenantRepo>[0],
      input.leaseId,
      input.tenantUserId
    );
    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'LEASE_TENANT',
      entityId: link.id,
      action: 'LINK',
      before: null,
      after: { lease_id: input.leaseId, user_id: input.tenantUserId, link_id: link.id },
    });
    await client.query('COMMIT');
    return { lease_tenant: link };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
