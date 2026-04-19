/**
 * Record or update the disposition (refund + withhold split) for a single deposit.
 * Landlord/admin scope; caller must own the parent lease.
 */

import { getLeaseById } from '../../lib/leasesRepo.js';
import { getPropertyByIdForActor } from '../../lib/propertiesRepo.js';
import {
  getDepositById,
  getDispositionForDeposit,
  upsertDisposition,
  type LeaseDepositDispositionRow,
} from '../../lib/leaseDepositsRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type UpsertDepositDispositionInput = {
  actorUserId: string;
  actorRole: string;
  depositId: string;
  refundedAmount: number;
  withheldAmount: number;
  withholdingReason?: string | null;
  processedOn?: string | null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function upsertDepositDisposition(
  db: TransactionPool,
  input: UpsertDepositDispositionInput
): Promise<{ disposition: LeaseDepositDispositionRow }> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();
  const depositId = String(input.depositId ?? '').trim();
  if (!depositId) throw validationError('missing_deposit_id');

  const refunded = Number(input.refundedAmount);
  const withheld = Number(input.withheldAmount);
  if (!Number.isFinite(refunded) || refunded < 0) throw validationError('invalid_refunded_amount');
  if (!Number.isFinite(withheld) || withheld < 0) throw validationError('invalid_withheld_amount');
  if (input.processedOn && !ISO_DATE.test(input.processedOn)) {
    throw validationError('invalid_processed_on');
  }

  const deposit = await getDepositById(db, depositId);
  if (!deposit) throw notFound('deposit_not_found');
  if (refunded + withheld > deposit.amount) {
    throw validationError('disposition_exceeds_deposit_amount');
  }
  if (withheld > 0 && !String(input.withholdingReason ?? '').trim()) {
    throw validationError('withholding_reason_required');
  }

  const lease = await getLeaseById(db, deposit.lease_id);
  if (!lease) throw notFound('lease_not_found');

  const prop = await getPropertyByIdForActor(db, lease.property_id, input.actorRole, input.actorUserId);
  if (!prop) throw forbidden();

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const before = await getDispositionForDeposit(
      client as Parameters<typeof getDispositionForDeposit>[0],
      depositId
    );
    const disposition = await upsertDisposition(client as Parameters<typeof upsertDisposition>[0], {
      leaseDepositId: depositId,
      refundedAmount: refunded,
      withheldAmount: withheld,
      withholdingReason: input.withholdingReason ?? null,
      processedOn: input.processedOn ?? null,
      actorUserId: input.actorUserId,
    });
    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'LEASE_DEPOSIT_DISPOSITION',
      entityId: disposition.id,
      action: before ? 'UPDATE' : 'CREATE',
      before,
      after: disposition,
    });
    await client.query('COMMIT');
    return { disposition };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
