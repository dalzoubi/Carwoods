import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import { writeAudit } from '../../lib/auditRepo.js';
import {
  insertEntry,
  updateEntry,
  getEntryById,
  leaseAccessibleByLandlord,
  propertyAccessibleByLandlord,
  tenantUserOnProperty,
  paymentEntryAccessibleByLandlord,
  type PaymentEntryRow,
} from '../../lib/paymentEntriesRepo.js';
import type { TransactionPool } from '../types.js';

const VALID_METHODS = new Set(['CHECK', 'CASH', 'BANK_TRANSFER', 'ZELLE', 'VENMO', 'OTHER']);

const VALID_PAYMENT_TYPES = new Set([
  'RENT',
  'SECURITY_DEPOSIT',
  'LATE_FEE',
  'PET_FEE',
  'PARKING',
  'UTILITY',
  'APPLICATION_FEE',
  'ADMIN_FEE',
  'NSF_FEE',
  'MAINTENANCE',
  'OTHER',
]);

function validateAmounts(params: {
  period_start?: string;
  amount_due?: number;
  amount_paid?: number;
  due_date?: string;
}): string | null {
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
  lease_id?: string | null;
  property_id?: string | null;
  tenant_user_id?: string | null;
  show_in_tenant_portal?: boolean | null;
  period_start?: string;
  amount_due?: number;
  amount_paid?: number;
  due_date?: string;
  paid_date?: string | null;
  payment_method?: string | null;
  payment_type?: string | null;
  notes?: string | null;
};

export type RecordPaymentOutput = { entry: PaymentEntryRow };

export async function recordPayment(
  db: TransactionPool,
  input: RecordPaymentInput
): Promise<RecordPaymentOutput> {
  const actorRole = String(input.actorRole ?? '').trim().toUpperCase();
  if (!hasLandlordAccess(actorRole)) throw forbidden();

  const err = validateAmounts({
    period_start: input.period_start,
    amount_due: input.amount_due,
    amount_paid: input.amount_paid,
    due_date: input.due_date,
  });
  if (err) throw validationError(err);

  const method = input.payment_method?.trim().toUpperCase() ?? null;
  if (method && !VALID_METHODS.has(method)) throw validationError('payment_method_invalid');

  const paymentType = (input.payment_type?.trim().toUpperCase() || 'RENT');
  if (!VALID_PAYMENT_TYPES.has(paymentType)) throw validationError('payment_type_invalid');

  const leaseId = input.lease_id?.trim() || null;
  const propertyId = input.property_id?.trim() || null;
  const tenantUserId = input.tenant_user_id?.trim() || null;

  let showPortal = false;
  if (leaseId) {
    if (propertyId || tenantUserId) throw validationError('lease_scope_mixed');
    const accessible = await leaseAccessibleByLandlord(
      db,
      leaseId,
      input.actorUserId,
      actorRole
    );
    if (!accessible) throw forbidden();
    showPortal = input.show_in_tenant_portal !== false;
  } else if (propertyId && tenantUserId) {
    const acc = await propertyAccessibleByLandlord(
      db,
      propertyId,
      input.actorUserId,
      actorRole
    );
    if (!acc) throw forbidden();
    const onProp = await tenantUserOnProperty(db, propertyId, tenantUserId);
    if (!onProp) throw validationError('tenant_not_on_property');
    showPortal = input.show_in_tenant_portal === true;
  } else if (propertyId) {
    const acc = await propertyAccessibleByLandlord(
      db,
      propertyId,
      input.actorUserId,
      actorRole
    );
    if (!acc) throw forbidden();
    showPortal = input.show_in_tenant_portal === true;
  } else {
    throw validationError('payment_scope_required');
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const row = await insertEntry(client, {
      lease_id: leaseId,
      property_id: leaseId ? null : propertyId,
      tenant_user_id: leaseId || !propertyId ? null : tenantUserId,
      show_in_tenant_portal: showPortal,
      period_start: input.period_start!,
      amount_due: input.amount_due!,
      amount_paid: input.amount_paid ?? 0,
      due_date: input.due_date!,
      paid_date: input.paid_date?.trim() || null,
      payment_method: method,
      payment_type: paymentType,
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
  show_in_tenant_portal?: boolean | null;
};

export type UpdatePaymentOutput = { entry: PaymentEntryRow };

export async function updatePayment(
  db: TransactionPool,
  input: UpdatePaymentInput
): Promise<UpdatePaymentOutput> {
  if (!hasLandlordAccess(input.actorRole.trim().toUpperCase())) throw forbidden();
  if (!input.entryId?.trim()) throw validationError('entry_id_required');

  const current = await getEntryById(db, input.entryId);
  if (!current) throw notFound();

  const allowed = await paymentEntryAccessibleByLandlord(
    db,
    current,
    input.actorUserId,
    input.actorRole.trim().toUpperCase()
  );
  if (!allowed) throw forbidden();

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
    let showFlag: boolean | undefined;
    if (input.show_in_tenant_portal === true) showFlag = true;
    else if (input.show_in_tenant_portal === false) showFlag = false;
    const updated = await updateEntry(client, input.entryId, {
      amount_due,
      amount_paid,
      due_date,
      paid_date,
      payment_method: method,
      notes: input.notes !== undefined ? (input.notes?.trim() || null) : current.notes,
      show_in_tenant_portal: showFlag,
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
