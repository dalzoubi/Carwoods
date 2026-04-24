/**
 * Soft-delete a lease that was created by mistake. Strict for landlords — only allowed when
 * the lease has zero history (no payments, no requests, no notices, no move-out/eviction row,
 * and not already ENDED/TERMINATED). Admin may pass `force = true` to override.
 *
 * Tenant account rows are never deleted here: if the tenant is left with no leases, the
 * existing tenant-deactivation path (setTenantActive) can be invoked separately.
 */

import { getLeaseById, softDeleteLease } from '../../lib/leasesRepo.js';
import { getPropertyByIdForActor } from '../../lib/propertiesRepo.js';
import {
  getMoveOutForLease,
  getEvictionForLease,
  listNoticesForLease,
} from '../../lib/tenantLifecycleRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { hasLandlordAccess, Role } from '../../domain/constants.js';
import type { TransactionPool, Queryable } from '../types.js';

export type DeleteLeaseAsMistakeInput = {
  actorUserId: string;
  actorRole: string;
  leaseId: string;
  /** Admin-only override for non-empty leases. */
  force?: boolean;
};

async function leaseHasPayments(db: Queryable, leaseId: string): Promise<boolean> {
  const r = await db.query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM payment_entries
     WHERE lease_id = $1 AND deleted_at IS NULL`,
    [leaseId]
  );
  return Number(r.rows[0]?.n ?? 0) > 0;
}

async function leaseHasRequests(db: Queryable, leaseId: string): Promise<boolean> {
  const r = await db.query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM requests
     WHERE lease_id = $1 AND deleted_at IS NULL`,
    [leaseId]
  );
  return Number(r.rows[0]?.n ?? 0) > 0;
}

export async function deleteLeaseAsMistake(
  db: TransactionPool,
  input: DeleteLeaseAsMistakeInput
) {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();

  const leaseId = String(input.leaseId ?? '').trim();
  if (!leaseId) throw validationError('missing_lease_id');

  const lease = await getLeaseById(db, leaseId);
  if (!lease) throw notFound('lease_not_found');

  const prop = await getPropertyByIdForActor(db, lease.property_id, input.actorRole, input.actorUserId);
  if (!prop) throw forbidden();

  const isAdmin = input.actorRole.trim().toUpperCase() === Role.ADMIN;
  const force = Boolean(input.force) && isAdmin;

  if (!force) {
    if (lease.status === 'ENDED' || lease.status === 'TERMINATED') {
      throw validationError('lease_has_history');
    }
    if (await leaseHasPayments(db, leaseId)) throw validationError('lease_has_payments');
    if (await leaseHasRequests(db, leaseId)) throw validationError('lease_has_requests');
    if (await getMoveOutForLease(db, leaseId)) throw validationError('lease_has_move_out');
    if (await getEvictionForLease(db, leaseId)) throw validationError('lease_has_eviction');
    const notices = await listNoticesForLease(db, leaseId);
    if (notices.length > 0) throw validationError('lease_has_notices');
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const ok = await softDeleteLease(
      client as Parameters<typeof softDeleteLease>[0],
      leaseId,
      input.actorUserId
    );
    if (!ok) {
      await client.query('ROLLBACK');
      throw notFound('lease_not_found');
    }

    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'LEASE',
      entityId: leaseId,
      action: 'DELETE_AS_MISTAKE',
      before: lease,
      after: { ...lease, deleted_at: new Date(), forced: force },
    });

    await client.query('COMMIT');
    return { lease_id: leaseId, forced: force };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
