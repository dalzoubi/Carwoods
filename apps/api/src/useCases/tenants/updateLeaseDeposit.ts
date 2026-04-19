/**
 * Patch a deposit row. Landlord/admin scope only; caller must own the parent lease.
 */

import { getLeaseById } from '../../lib/leasesRepo.js';
import { getPropertyByIdForActor } from '../../lib/propertiesRepo.js';
import {
  getDepositById,
  updateDeposit,
  type DepositKind,
  type LeaseDepositRow,
} from '../../lib/leaseDepositsRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type UpdateLeaseDepositInput = {
  actorUserId: string;
  actorRole: string;
  depositId: string;
  kind?: DepositKind;
  amount?: number;
  heldSince?: string;
  notes?: string | null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_KINDS: DepositKind[] = ['SECURITY', 'PET', 'KEY', 'LAST_MONTH', 'OTHER'];

export async function updateLeaseDeposit(
  db: TransactionPool,
  input: UpdateLeaseDepositInput
): Promise<{ deposit: LeaseDepositRow }> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();
  const depositId = String(input.depositId ?? '').trim();
  if (!depositId) throw validationError('missing_deposit_id');

  if (input.heldSince !== undefined && !ISO_DATE.test(String(input.heldSince))) {
    throw validationError('invalid_held_since');
  }
  if (input.amount !== undefined) {
    const n = Number(input.amount);
    if (!Number.isFinite(n) || n < 0) throw validationError('invalid_amount');
  }
  if (input.kind !== undefined && !VALID_KINDS.includes(input.kind)) {
    throw validationError('invalid_kind');
  }

  const existing = await getDepositById(db, depositId);
  if (!existing) throw notFound('deposit_not_found');

  const lease = await getLeaseById(db, existing.lease_id);
  if (!lease) throw notFound('lease_not_found');

  const prop = await getPropertyByIdForActor(db, lease.property_id, input.actorRole, input.actorUserId);
  if (!prop) throw forbidden();

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const updated = await updateDeposit(
      client as Parameters<typeof updateDeposit>[0],
      depositId,
      {
        kind: input.kind,
        amount: input.amount,
        heldSince: input.heldSince,
        notes: input.notes,
      },
      input.actorUserId
    );
    if (!updated) {
      await client.query('ROLLBACK');
      throw notFound('deposit_not_found');
    }
    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'LEASE_DEPOSIT',
      entityId: depositId,
      action: 'UPDATE',
      before: existing,
      after: updated,
    });
    await client.query('COMMIT');
    return { deposit: updated };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
