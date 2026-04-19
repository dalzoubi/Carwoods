/**
 * Soft-delete a deposit row. Landlord/admin scope only; caller must own the parent lease.
 */

import { getLeaseById } from '../../lib/leasesRepo.js';
import { getPropertyByIdForActor } from '../../lib/propertiesRepo.js';
import { getDepositById, softDeleteDeposit } from '../../lib/leaseDepositsRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type DeleteLeaseDepositInput = {
  actorUserId: string;
  actorRole: string;
  depositId: string;
};

export async function deleteLeaseDeposit(
  db: TransactionPool,
  input: DeleteLeaseDepositInput
): Promise<{ ok: true }> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();
  const depositId = String(input.depositId ?? '').trim();
  if (!depositId) throw validationError('missing_deposit_id');

  const existing = await getDepositById(db, depositId);
  if (!existing) throw notFound('deposit_not_found');

  const lease = await getLeaseById(db, existing.lease_id);
  if (!lease) throw notFound('lease_not_found');

  const prop = await getPropertyByIdForActor(db, lease.property_id, input.actorRole, input.actorUserId);
  if (!prop) throw forbidden();

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const ok = await softDeleteDeposit(
      client as Parameters<typeof softDeleteDeposit>[0],
      depositId,
      input.actorUserId
    );
    if (!ok) {
      await client.query('ROLLBACK');
      throw notFound('deposit_not_found');
    }
    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'LEASE_DEPOSIT',
      entityId: depositId,
      action: 'DELETE',
      before: existing,
      after: null,
    });
    await client.query('COMMIT');
    return { ok: true };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
