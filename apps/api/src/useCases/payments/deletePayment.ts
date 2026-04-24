import { forbidden, validationError } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import { writeAudit } from '../../lib/auditRepo.js';
import {
  getEntryById,
  getEntryExistsState,
  paymentEntryAccessibleByLandlord,
  softDeleteEntryById,
} from '../../lib/paymentEntriesRepo.js';
import type { TransactionPool } from '../types.js';

export type DeletePaymentInput = {
  actorUserId: string;
  actorRole: string;
  entryId: string;
};

export type DeletePaymentResult = 'ok' | 'not_found' | 'already_deleted';

/**
 * Soft-delete. Idempotent: already-deleted id returns already_deleted (HTTP 204).
 */
export async function deletePayment(
  db: TransactionPool,
  input: DeletePaymentInput
): Promise<DeletePaymentResult> {
  const role = String(input.actorRole ?? '').trim().toUpperCase();
  if (!hasLandlordAccess(role)) throw forbidden();
  if (!input.entryId?.trim()) throw validationError('entry_id_required');

  const state = await getEntryExistsState(db, input.entryId);
  if (state === 'missing') return 'not_found';
  if (state === 'deleted') return 'already_deleted';

  const current = await getEntryById(db, input.entryId);
  if (!current) return 'not_found';

  const allowed = await paymentEntryAccessibleByLandlord(
    db,
    current,
    input.actorUserId,
    role
  );
  if (!allowed) throw forbidden();

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const ok = await softDeleteEntryById(client, input.entryId, input.actorUserId);
    if (!ok) {
      await client.query('ROLLBACK');
      return 'not_found';
    }
    await writeAudit(client, {
      actorUserId: input.actorUserId,
      entityType: 'LEASE_PAYMENT_ENTRY',
      entityId: input.entryId,
      action: 'DELETE',
      before: current,
      after: null,
    });
    await client.query('COMMIT');
    return 'ok';
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
