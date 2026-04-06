/**
 * Patch an existing lease (management access required).
 *
 * Business rules:
 * - Lease must exist.
 * - Status must be valid if provided.
 */

import {
  getLeaseById,
  updateLease as updateLeaseRepo,
  type LeaseRowFull,
  type LeasePatch,
} from '../../lib/leasesRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { validateLeaseStatus } from '../../domain/leaseValidation.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type UpdateLeaseInput = {
  leaseId: string | undefined;
  actorUserId: string;
  actorRole: string;
  start_date?: string;
  end_date?: string | null;
  end_date_present?: boolean;
  month_to_month?: boolean;
  status?: string;
  notes?: string | null;
  notes_present?: boolean;
};

export type UpdateLeaseOutput = {
  lease: LeaseRowFull;
};

export async function updateLease(
  db: TransactionPool,
  input: UpdateLeaseInput
): Promise<UpdateLeaseOutput> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();
  if (!input.leaseId) throw validationError('missing_id');

  const statusValidation = validateLeaseStatus(input.status);
  if (!statusValidation.valid) throw validationError(statusValidation.message);

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const before = await getLeaseById(client, input.leaseId);
    const patch: LeasePatch = {
      start_date: input.start_date,
      end_date: input.end_date_present ? input.end_date : undefined,
      month_to_month: input.month_to_month,
      status: input.status,
      notes: input.notes_present ? input.notes : undefined,
    };
    const row = await updateLeaseRepo(
      client as Parameters<typeof updateLeaseRepo>[0],
      input.leaseId,
      patch,
      input.actorUserId
    );
    if (!row) {
      await client.query('ROLLBACK');
      throw notFound();
    }
    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'LEASE',
      entityId: row.id,
      action: 'UPDATE',
      before: before ?? null,
      after: row,
    });
    await client.query('COMMIT');
    return { lease: row };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
