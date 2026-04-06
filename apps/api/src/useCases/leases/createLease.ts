/**
 * Create a new lease (management access required).
 *
 * Business rules:
 * - property_id, start_date, and status are required.
 * - Status must be one of the allowed LEASE_STATUSES.
 * - The referenced property must exist.
 */

import { insertLease, type LeaseRowFull } from '../../lib/leasesRepo.js';
import { getPropertyById } from '../../lib/propertiesRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { validateCreateLease } from '../../domain/leaseValidation.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type CreateLeaseInput = {
  actorUserId: string;
  actorRole: string;
  property_id: string | undefined;
  start_date: string | undefined;
  end_date?: string | null;
  month_to_month?: boolean;
  status: string | undefined;
  notes?: string | null;
};

export type CreateLeaseOutput = {
  lease: LeaseRowFull;
};

export async function createLease(
  db: TransactionPool,
  input: CreateLeaseInput
): Promise<CreateLeaseOutput> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();

  const fieldValidation = validateCreateLease({
    property_id: input.property_id,
    start_date: input.start_date,
    status: input.status,
  });
  if (!fieldValidation.valid) throw validationError(fieldValidation.message);

  const prop = await getPropertyById(db, input.property_id!);
  if (!prop) throw notFound('property_not_found');

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const row = await insertLease(client as Parameters<typeof insertLease>[0], {
      property_id: input.property_id!,
      start_date: input.start_date!,
      end_date: input.end_date ?? null,
      month_to_month: input.month_to_month ?? false,
      status: input.status!,
      notes: input.notes ?? null,
      created_by: input.actorUserId,
    });
    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'LEASE',
      entityId: row.id,
      action: 'CREATE',
      before: null,
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
