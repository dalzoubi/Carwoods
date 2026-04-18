/**
 * Remove a tenant user from a lease (management access required).
 *
 * Business rules:
 * - Lease must exist.
 * - User must be linked to this lease.
 * - At least one tenant must remain on the lease after removal.
 */

import {
  getLeaseById,
  listLeaseTenantUserIds,
  unlinkLeaseTenantRow,
} from '../../lib/leasesRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type UnlinkLeaseTenantInput = {
  leaseId: string | undefined;
  tenantUserId: string | undefined;
  actorUserId: string;
  actorRole: string;
};

export type UnlinkLeaseTenantOutput = {
  removed: { id: string; lease_id: string; user_id: string };
};

export async function unlinkLeaseTenant(
  db: TransactionPool,
  input: UnlinkLeaseTenantInput
): Promise<UnlinkLeaseTenantOutput> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();
  if (!input.leaseId) throw validationError('missing_lease_id');
  if (!input.tenantUserId) throw validationError('missing_user_id');

  const lease = await getLeaseById(db, input.leaseId);
  if (!lease) throw notFound('lease_not_found');

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const onLease = await listLeaseTenantUserIds(
      client as Parameters<typeof listLeaseTenantUserIds>[0],
      input.leaseId
    );
    const target = input.tenantUserId.trim().toLowerCase();
    const normalizedOn = onLease.map((id) => id.trim().toLowerCase());
    if (!normalizedOn.includes(target)) {
      await client.query('ROLLBACK');
      throw validationError('lease_tenant_not_linked');
    }
    if (onLease.length <= 1) {
      await client.query('ROLLBACK');
      throw validationError('cannot_remove_last_leaseholder');
    }

    const rawUserId = onLease[normalizedOn.indexOf(target)]!;
    const removed = await unlinkLeaseTenantRow(
      client as Parameters<typeof unlinkLeaseTenantRow>[0],
      input.leaseId,
      rawUserId
    );
    if (!removed) {
      await client.query('ROLLBACK');
      throw validationError('lease_tenant_not_linked');
    }

    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'LEASE_TENANT',
      entityId: removed.id,
      action: 'UNLINK',
      before: { lease_id: input.leaseId, user_id: removed.user_id, link_id: removed.id },
      after: null,
    });
    await client.query('COMMIT');
    return { removed };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
