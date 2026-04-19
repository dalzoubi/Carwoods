/**
 * Create a deposit row against a lease. Landlord/admin scope only.
 */

import { getLeaseById } from '../../lib/leasesRepo.js';
import { getPropertyByIdForActor } from '../../lib/propertiesRepo.js';
import {
  insertDeposit,
  type DepositKind,
  type LeaseDepositRow,
} from '../../lib/leaseDepositsRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type CreateLeaseDepositInput = {
  actorUserId: string;
  actorRole: string;
  leaseId: string;
  kind?: DepositKind;
  amount: number;
  heldSince: string;
  notes?: string | null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_KINDS: DepositKind[] = ['SECURITY', 'PET', 'KEY', 'LAST_MONTH', 'OTHER'];

export async function createLeaseDeposit(
  db: TransactionPool,
  input: CreateLeaseDepositInput
): Promise<{ deposit: LeaseDepositRow }> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();
  const leaseId = String(input.leaseId ?? '').trim();
  if (!leaseId) throw validationError('missing_lease_id');

  const heldSince = String(input.heldSince ?? '').trim();
  if (!ISO_DATE.test(heldSince)) throw validationError('invalid_held_since');

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) throw validationError('invalid_amount');

  const kind = input.kind ?? 'SECURITY';
  if (!VALID_KINDS.includes(kind)) throw validationError('invalid_kind');

  const lease = await getLeaseById(db, leaseId);
  if (!lease) throw notFound('lease_not_found');

  const prop = await getPropertyByIdForActor(db, lease.property_id, input.actorRole, input.actorUserId);
  if (!prop) throw forbidden();

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const deposit = await insertDeposit(client as Parameters<typeof insertDeposit>[0], {
      leaseId,
      kind,
      amount,
      heldSince,
      notes: input.notes ?? null,
      actorUserId: input.actorUserId,
    });
    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'LEASE_DEPOSIT',
      entityId: deposit.id,
      action: 'CREATE',
      before: null,
      after: deposit,
    });
    await client.query('COMMIT');
    return { deposit };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
