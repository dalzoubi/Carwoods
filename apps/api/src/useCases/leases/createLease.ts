/**
 * Create a new lease (management access required).
 *
 * Business rules:
 * - property_id, start_date, and status are required.
 * - Status must be one of the allowed LEASE_STATUSES.
 * - The referenced property must exist.
 */

import {
  insertLease,
  hasOverlappingLeaseAtProperty,
  type LeaseRowFull,
} from '../../lib/leasesRepo.js';
import { getPropertyByIdForActor } from '../../lib/propertiesRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { validateCreateLease, parseRentAmountInput } from '../../domain/leaseValidation.js';
import { forbidden, notFound, validationError, conflictError } from '../../domain/errors.js';
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
  rent_amount?: unknown;
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

  const rentParsed = parseRentAmountInput(input.rent_amount);
  if (!rentParsed.ok) throw validationError(rentParsed.message);
  const rentForInsert = rentParsed.amount === undefined ? null : rentParsed.amount;

  const prop = await getPropertyByIdForActor(
    db,
    input.property_id!,
    input.actorRole,
    input.actorUserId
  );
  if (!prop) throw notFound('property_not_found');

  const monthToMonth = input.month_to_month ?? false;
  const proposedEndDate = monthToMonth ? null : (input.end_date ?? null);

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const overlapsProperty = await hasOverlappingLeaseAtProperty(
      client as Parameters<typeof hasOverlappingLeaseAtProperty>[0],
      {
        propertyId: input.property_id!,
        startDate: input.start_date!,
        endDate: proposedEndDate,
        excludeLeaseId: null,
      }
    );
    if (overlapsProperty) {
      await client.query('ROLLBACK');
      throw conflictError('property_lease_overlap');
    }

    const row = await insertLease(client as Parameters<typeof insertLease>[0], {
      property_id: input.property_id!,
      start_date: input.start_date!,
      end_date: proposedEndDate,
      month_to_month: monthToMonth,
      status: input.status!,
      notes: input.notes ?? null,
      rent_amount: rentForInsert,
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
