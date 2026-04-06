/**
 * Soft-delete a lease (management access required).
 */

import {
  getLeaseById,
  softDeleteLease,
} from '../../lib/leasesRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type DeleteLeaseInput = {
  leaseId: string | undefined;
  actorUserId: string;
  actorRole: string;
};

export async function deleteLease(
  db: TransactionPool,
  input: DeleteLeaseInput
): Promise<void> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();
  if (!input.leaseId) throw validationError('missing_id');

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const before = await getLeaseById(client, input.leaseId);
    if (!before) {
      await client.query('ROLLBACK');
      throw notFound();
    }
    const ok = await softDeleteLease(
      client as Parameters<typeof softDeleteLease>[0],
      input.leaseId,
      input.actorUserId
    );
    if (!ok) {
      await client.query('ROLLBACK');
      throw notFound();
    }
    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'LEASE',
      entityId: input.leaseId,
      action: 'DELETE',
      before,
      after: { deleted: true },
    });
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
