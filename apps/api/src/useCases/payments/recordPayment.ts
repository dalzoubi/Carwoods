import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import { writeAudit } from '../../lib/auditRepo.js';
import {
  insertEntry,
  updateEntry,
  getEntryById,
  leaseAccessibleByLandlord,
  type LeasePaymentEntryRow,
} from '../../lib/paymentEntriesRepo.js';
import type { TransactionPool } from '../types.js';

const VALID_METHODS = new Set(['CHECK', 'CASH', 'BANK_TRANSFER', 'ZELLE', 'VENMO', 'OTHER']);

function validateFields(params: {
  lease_id?: string;
  period_start?: string;
  amount_due?: number;
  amount_paid?: number;
  due_date?: string;
}): string | null {
  if (!params.lease_id?.trim()) return 'lease_id_required';
  if (!params.period_start?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(params.period_start))
    return 'period_start_invalid';
  if (!params.due_date?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(params.due_date))
    return 'due_date_invalid';
  if (
    typeof params.amount_due !== 'number'
    || !Number.isFinite(params.amount_due)
    || params.amount_due < 0
  )
    return 'amount_due_invalid';
  if (
    typeof params.amount_paid !== 'number'
    || !Number.isFinite(params.amount_paid)
    || params.amount_paid < 0
  )
    return 'amount_paid_invalid';
  return null;
}

export type RecordPaymentInput = {
  actorUserId: string;
  actorRole: string;
  lease_id?: string;
  period_start?: string;
  amount_due?: number;
  amount_paid?: number;
  due_date?: string;
  paid_date?: string | null;
  payment_method?: string | null;
  notes?: string | null;
};

export type RecordPaymentOutput = { entry: LeasePaymentEntryRow };

export async function recordPayment(
  db: TransactionPool,
  input: RecordPaymentInput
): Promise<RecordPaymentOutput> {
  const actorRole = String(input.actorRole ?? '').trim().toUpperCase();
  if (!hasLandlordAccess(actorRole)) throw forbidden();

  const err = validateFields({
    lease_id: input.lease_id,
    period_start: input.period_start,
    amount_due: input.amount_due,
    amount_paid: input.amount_paid,
    due_date: input.due_date,
  });
  if (err) throw validationError(err);

  const method = input.payment_method?.trim().toUpperCase() ?? null;
  if (method && !VALID_METHODS.has(method)) throw validationError('payment_method_invalid');

  const accessible = await leaseAccessibleByLandlord(
    db,
    input.lease_id!,
    input.actorUserId,
    actorRole
  );
  if (!accessible) throw forbidden();

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const row = await insertEntry(client, {
      lease_id: input.lease_id!,
      period_start: input.period_start!,
      amount_due: input.amount_due!,
      amount_paid: input.amount_paid ?? 0,
      due_date: input.due_date!,
      paid_date: input.paid_date?.trim() || null,
      payment_method: method,
      notes: input.notes?.trim() || null,
      recorded_by: input.actorUserId,
    });
    await writeAudit(client, {
      actorUserId: input.actorUserId,
      entityType: 'LEASE_PAYMENT_ENTRY',
      entityId: row.id,
      action: 'CREATE',
      before: null,
      after: row,
    });
    await client.query('COMMIT');
    return { entry: row };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export type UpdatePaymentInput = {
  actorUserId: string;
  actorRole: string;
  entryId: string;
  amount_due?: number;
  amount_paid?: number;
  due_date?: string;
  paid_date?: string | null;
  payment_method?: string | null;
  notes?: string | null;
};

export type UpdatePaymentOutput = { entry: LeasePaymentEntryRow };

export async function updatePayment(
  db: TransactionPool,
  input: UpdatePaymentInput
): Promise<UpdatePaymentOutput> {
  if (!hasLandlordAccess(input.actorRole.trim().toUpperCase())) throw forbidden();
  if (!input.entryId?.trim()) throw validationError('entry_id_required');

  const current = await getEntryById(db, input.entryId);
  if (!current) throw notFound();

  const accessible = await leaseAccessibleByLandlord(
    db,
    current.lease_id,
    input.actorUserId,
    input.actorRole.trim().toUpperCase()
  );
  if (!accessible) throw forbidden();

  const amount_due = input.amount_due ?? current.amount_due;
  const amount_paid = input.amount_paid ?? current.amount_paid;
  const due_date = input.due_date?.trim() || current.due_date;
  const paid_date =
    input.paid_date !== undefined ? (input.paid_date?.trim() || null) : current.paid_date;
  const method =
    input.payment_method !== undefined
      ? (input.payment_method?.trim().toUpperCase() || null)
      : current.payment_method;

  if (method && !VALID_METHODS.has(method)) throw validationError('payment_method_invalid');
  if (typeof amount_due !== 'number' || amount_due < 0) throw validationError('amount_due_invalid');
  if (typeof amount_paid !== 'number' || amount_paid < 0) throw validationError('amount_paid_invalid');

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const updated = await updateEntry(client, input.entryId, {
      amount_due,
      amount_paid,
      due_date,
      paid_date,
      payment_method: method,
      notes: input.notes !== undefined ? (input.notes?.trim() || null) : current.notes,
      recorded_by: input.actorUserId,
    });
    if (!updated) throw notFound();
    await writeAudit(client, {
      actorUserId: input.actorUserId,
      entityType: 'LEASE_PAYMENT_ENTRY',
      entityId: input.entryId,
      action: 'UPDATE',
      before: current,
      after: updated,
    });
    await client.query('COMMIT');
    return { entry: updated };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
