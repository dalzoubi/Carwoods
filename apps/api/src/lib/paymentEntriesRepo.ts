import type { QueryResult } from './db.js';

export type PaymentEntryRow = {
  id: string;
  lease_id: string | null;
  property_id: string | null;
  tenant_user_id: string | null;
  show_in_tenant_portal: boolean;
  period_start: string; // ISO date YYYY-MM-DD
  amount_due: number;
  amount_paid: number;
  due_date: string;
  paid_date: string | null;
  payment_method: string | null;
  payment_type: string;
  notes: string | null;
  recorded_by: string | null;
  created_at: Date;
  updated_at: Date;
  payment_status: 'PAID' | 'PARTIAL' | 'OVERDUE' | 'PENDING';
};

/** @deprecated use PaymentEntryRow */
export type LeasePaymentEntryRow = PaymentEntryRow;

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

const STATUS_CASE = `
  CASE
    WHEN pe.amount_paid >= pe.amount_due                          THEN 'PAID'
    WHEN pe.amount_paid > 0                                         THEN 'PARTIAL'
    WHEN CAST(SYSDATETIMEOFFSET() AS DATE) > pe.due_date            THEN 'OVERDUE'
    ELSE 'PENDING'
  END AS payment_status`;

const SELECT_COLS = `
  pe.id, pe.lease_id, pe.property_id, pe.tenant_user_id, pe.show_in_tenant_portal,
  CONVERT(NVARCHAR(10), pe.period_start, 23) AS period_start,
  pe.amount_due, pe.amount_paid,
  CONVERT(NVARCHAR(10), pe.due_date, 23)     AS due_date,
  CONVERT(NVARCHAR(10), pe.paid_date, 23)    AS paid_date,
  pe.payment_method, pe.payment_type, pe.notes, pe.recorded_by,
  pe.created_at, pe.updated_at,
  ${STATUS_CASE}`;

const OUTPUT_RETURNING = `
       INSERTED.id, INSERTED.lease_id, INSERTED.property_id, INSERTED.tenant_user_id, INSERTED.show_in_tenant_portal,
       CONVERT(NVARCHAR(10), INSERTED.period_start, 23) AS period_start,
       INSERTED.amount_due, INSERTED.amount_paid,
       CONVERT(NVARCHAR(10), INSERTED.due_date, 23)     AS due_date,
       CONVERT(NVARCHAR(10), INSERTED.paid_date, 23)    AS paid_date,
       INSERTED.payment_method, INSERTED.payment_type, INSERTED.notes, INSERTED.recorded_by,
       INSERTED.created_at, INSERTED.updated_at,
       CASE
         WHEN INSERTED.amount_paid >= INSERTED.amount_due                               THEN 'PAID'
         WHEN INSERTED.amount_paid > 0                                                  THEN 'PARTIAL'
         WHEN CAST(SYSDATETIMEOFFSET() AS DATE) > INSERTED.due_date                    THEN 'OVERDUE'
         ELSE 'PENDING'
       END AS payment_status`;

function rowToPaymentEntry(r: Record<string, unknown>): PaymentEntryRow {
  const sip = r.show_in_tenant_portal;
  return {
    id: String(r.id),
    lease_id: r.lease_id != null ? String(r.lease_id) : null,
    property_id: r.property_id != null ? String(r.property_id) : null,
    tenant_user_id: r.tenant_user_id != null ? String(r.tenant_user_id) : null,
    show_in_tenant_portal: sip === true || sip === 1 || sip === '1',
    period_start: String(r.period_start ?? ''),
    amount_due: Number(r.amount_due),
    amount_paid: Number(r.amount_paid),
    due_date: String(r.due_date ?? ''),
    paid_date: r.paid_date != null && r.paid_date !== '' ? String(r.paid_date) : null,
    payment_method: r.payment_method != null ? String(r.payment_method) : null,
    payment_type: r.payment_type != null && r.payment_type !== '' ? String(r.payment_type) : 'RENT',
    notes: r.notes != null ? String(r.notes) : null,
    recorded_by: r.recorded_by != null ? String(r.recorded_by) : null,
    created_at: r.created_at as Date,
    updated_at: r.updated_at as Date,
    payment_status: r.payment_status as PaymentEntryRow['payment_status'],
  };
}

export async function listEntriesForLease(
  client: Queryable,
  leaseId: string
): Promise<PaymentEntryRow[]> {
  const r = await client.query<Record<string, unknown>>(
    `SELECT ${SELECT_COLS}
     FROM payment_entries pe
     WHERE pe.lease_id = $1 AND pe.deleted_at IS NULL
     ORDER BY pe.period_start DESC`,
    [leaseId]
  );
  return (r.rows ?? []).map(rowToPaymentEntry);
}

export type ListForPropertyFilters = {
  propertyId: string;
  /** Narrow to a single lease under the property. */
  leaseId?: string | null;
  /** Narrow to a tenant (property + tenant scope lines or lease lines for that tenant. */
  tenantUserId?: string | null;
};

/**
 * All payment lines visible to the landlord for a property (all scopes that belong to the property).
 */
export async function listEntriesForProperty(
  client: Queryable,
  filters: ListForPropertyFilters
): Promise<PaymentEntryRow[]> {
  const propertyId = filters.propertyId;
  const leaseId = filters.leaseId?.trim() || null;
  const tenantUserId = filters.tenantUserId?.trim() || null;
  let sql = `SELECT ${SELECT_COLS}
     FROM payment_entries pe
     LEFT JOIN leases l ON l.id = pe.lease_id AND l.deleted_at IS NULL
     WHERE pe.deleted_at IS NULL
     AND (
       (pe.lease_id IS NULL AND pe.property_id = $1)
       OR (pe.lease_id IS NOT NULL AND l.property_id = $1)
     )`;
  const params: unknown[] = [propertyId];
  let p = 2;
  if (leaseId) {
    sql += ` AND pe.lease_id = $${p}`;
    params.push(leaseId);
    p += 1;
  }
  if (tenantUserId) {
    sql += ` AND (
        (pe.lease_id IS NULL AND pe.tenant_user_id = $${p})
        OR (pe.lease_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM lease_tenants lt
          WHERE lt.lease_id = pe.lease_id AND lt.user_id = $${p}
        ))
      )`;
    params.push(tenantUserId);
  }
  sql += ' ORDER BY pe.period_start DESC';
  const r = await client.query<Record<string, unknown>>(sql, params);
  return (r.rows ?? []).map(rowToPaymentEntry);
}

/**
 * Portal tenant: rows the tenant may see when the landlord enabled visibility, scoped
 * to leases/properties the tenant is on. Optional `propertyId` limits to one property.
 */
export async function listEntriesForTenantPortal(
  client: Queryable,
  userId: string,
  propertyId: string | null
): Promise<PaymentEntryRow[]> {
  const propClause =
    propertyId && propertyId.trim() !== ''
      ? `AND (
            l.property_id = $2
            OR (pe.lease_id IS NULL AND pe.property_id = $2)
         )`
      : '';
  const params =
    propertyId && propertyId.trim() !== '' ? [userId, propertyId.trim()] : [userId];
  const r = await client.query<Record<string, unknown>>(
    `SELECT ${SELECT_COLS}
     FROM payment_entries pe
     LEFT JOIN leases l ON l.id = pe.lease_id AND l.deleted_at IS NULL
     WHERE pe.deleted_at IS NULL
       AND pe.show_in_tenant_portal = 1
       ${propClause}
       AND (
         (pe.lease_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM lease_tenants lt
            WHERE lt.lease_id = pe.lease_id AND lt.user_id = $1
          ))
         OR
         (pe.lease_id IS NULL AND pe.tenant_user_id IS NULL
          AND pe.property_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM lease_tenants lt2
            INNER JOIN leases l2 ON l2.id = lt2.lease_id AND l2.deleted_at IS NULL
            WHERE lt2.user_id = $1 AND l2.property_id = pe.property_id
          ))
         OR
         (pe.lease_id IS NULL
          AND pe.tenant_user_id = $1
          AND pe.property_id IS NOT NULL)
       )
     ORDER BY pe.period_start DESC`,
    params
  );
  return (r.rows ?? []).map(rowToPaymentEntry);
}

/** @deprecated alias — same as listEntriesForTenantPortal with no property filter. */
export async function listEntriesForTenant(
  client: Queryable,
  actorUserId: string
): Promise<PaymentEntryRow[]> {
  return listEntriesForTenantPortal(client, actorUserId, null);
}

export async function getEntryById(
  client: Queryable,
  id: string
): Promise<PaymentEntryRow | null> {
  const r = await client.query<Record<string, unknown>>(
    `SELECT ${SELECT_COLS}
     FROM payment_entries pe
     WHERE pe.id = $1 AND pe.deleted_at IS NULL`,
    [id]
  );
  const row = r.rows?.[0];
  return row ? rowToPaymentEntry(row) : null;
}

/** For DELETE idempotency: row missing vs soft-deleted vs active. */
export async function getEntryExistsState(
  client: Queryable,
  id: string
): Promise<'missing' | 'active' | 'deleted'> {
  const r = await client.query<{ deleted_at: unknown }>(
    `SELECT deleted_at FROM payment_entries WHERE id = $1`,
    [id]
  );
  const row = r.rows?.[0];
  if (!row) return 'missing';
  return row.deleted_at != null ? 'deleted' : 'active';
}

export async function insertEntry(
  client: Queryable,
  params: {
    lease_id: string | null;
    property_id: string | null;
    tenant_user_id: string | null;
    show_in_tenant_portal: boolean;
    period_start: string;
    amount_due: number;
    amount_paid: number;
    due_date: string;
    paid_date: string | null;
    payment_method: string | null;
    payment_type: string;
    notes: string | null;
    recorded_by: string;
  }
): Promise<PaymentEntryRow> {
  const r = await client.query<Record<string, unknown>>(
    `INSERT INTO payment_entries
       (id, lease_id, property_id, tenant_user_id, show_in_tenant_portal, period_start, amount_due, amount_paid, due_date,
        paid_date, payment_method, payment_type, notes, recorded_by)
     OUTPUT
      ${OUTPUT_RETURNING}
     VALUES (NEWID(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      params.lease_id,
      params.property_id,
      params.tenant_user_id,
      params.show_in_tenant_portal ? 1 : 0,
      params.period_start,
      params.amount_due,
      params.amount_paid,
      params.due_date,
      params.paid_date,
      params.payment_method,
      params.payment_type,
      params.notes,
      params.recorded_by,
    ]
  );
  return rowToPaymentEntry(r.rows![0]);
}

export async function updateEntry(
  client: Queryable,
  id: string,
  params: {
    amount_due: number;
    amount_paid: number;
    due_date: string;
    paid_date: string | null;
    payment_method: string | null;
    notes: string | null;
    show_in_tenant_portal?: boolean;
    recorded_by: string;
  }
): Promise<PaymentEntryRow | null> {
  const touchVisibility = params.show_in_tenant_portal !== undefined;
  const sql = touchVisibility
    ? `UPDATE payment_entries
     SET amount_due     = $1,
         amount_paid    = $2,
         due_date       = $3,
         paid_date      = $4,
         payment_method = $5,
         notes          = $6,
         show_in_tenant_portal = $7,
         recorded_by    = $8,
         updated_at     = SYSDATETIMEOFFSET()
     OUTPUT
      ${OUTPUT_RETURNING}
     WHERE id = $9 AND deleted_at IS NULL`
    : `UPDATE payment_entries
     SET amount_due     = $1,
         amount_paid    = $2,
         due_date       = $3,
         paid_date      = $4,
         payment_method = $5,
         notes          = $6,
         recorded_by    = $7,
         updated_at     = SYSDATETIMEOFFSET()
     OUTPUT
      ${OUTPUT_RETURNING}
     WHERE id = $8 AND deleted_at IS NULL`;
  const args = touchVisibility
    ? [
        params.amount_due,
        params.amount_paid,
        params.due_date,
        params.paid_date,
        params.payment_method,
        params.notes,
        params.show_in_tenant_portal ? 1 : 0,
        params.recorded_by,
        id,
      ]
    : [
        params.amount_due,
        params.amount_paid,
        params.due_date,
        params.paid_date,
        params.payment_method,
        params.notes,
        params.recorded_by,
        id,
      ];
  const r = await client.query<Record<string, unknown>>(sql, args);
  const row = r.rows?.[0];
  return row ? rowToPaymentEntry(row) : null;
}

export async function softDeleteEntryById(
  client: Queryable,
  id: string,
  recordedBy: string
): Promise<boolean> {
  const r = await client.query(
    `UPDATE payment_entries
     SET deleted_at = SYSDATETIMEOFFSET(), updated_at = SYSDATETIMEOFFSET(), recorded_by = $2
     WHERE id = $1 AND deleted_at IS NULL`,
    [id, recordedBy]
  );
  return (r.rowCount ?? 0) > 0;
}

export async function leaseAccessibleByTenant(
  client: Queryable,
  leaseId: string,
  userId: string
): Promise<boolean> {
  const r = await client.query<{ cnt: number }>(
    `SELECT COUNT(1) AS cnt FROM lease_tenants
     WHERE lease_id = $1 AND user_id = $2`,
    [leaseId, userId]
  );
  return (r.rows[0]?.cnt ?? 0) > 0;
}

export async function leaseAccessibleByLandlord(
  client: Queryable,
  leaseId: string,
  landlordUserId: string,
  actorRole: string
): Promise<boolean> {
  if (actorRole === 'ADMIN') return true;
  const r = await client.query<{ cnt: number }>(
    `SELECT COUNT(1) AS cnt
     FROM leases l
     JOIN properties p ON p.id = l.property_id
     WHERE l.id = $1 AND p.created_by = $2 AND l.deleted_at IS NULL`,
    [leaseId, landlordUserId]
  );
  return (r.rows[0]?.cnt ?? 0) > 0;
}

export async function propertyAccessibleByLandlord(
  client: Queryable,
  propertyId: string,
  landlordUserId: string,
  actorRole: string
): Promise<boolean> {
  if (actorRole === 'ADMIN') return true;
  const r = await client.query<{ cnt: number }>(
    `SELECT COUNT(1) AS cnt
     FROM properties p
     WHERE p.id = $1 AND p.created_by = $2 AND p.deleted_at IS NULL`,
    [propertyId, landlordUserId]
  );
  return (r.rows[0]?.cnt ?? 0) > 0;
}

/** Tenant is linked to at least one non-deleted lease on this property. */
export async function tenantUserOnProperty(
  client: Queryable,
  propertyId: string,
  userId: string
): Promise<boolean> {
  const r = await client.query<{ cnt: number }>(
    `SELECT COUNT(1) AS cnt
     FROM lease_tenants lt
     INNER JOIN leases l ON l.id = lt.lease_id AND l.deleted_at IS NULL
     WHERE l.property_id = $1 AND lt.user_id = $2`,
    [propertyId, userId]
  );
  return (r.rows[0]?.cnt ?? 0) > 0;
}

/**
 * True if the actor can manage this payment line (lease-owned property, or direct property scope).
 */
export async function paymentEntryAccessibleByLandlord(
  client: Queryable,
  row: { lease_id: string | null; property_id: string | null; tenant_user_id: string | null },
  landlordUserId: string,
  actorRole: string
): Promise<boolean> {
  if (row.lease_id) {
    return leaseAccessibleByLandlord(client, row.lease_id, landlordUserId, actorRole);
  }
  if (row.property_id) {
    return propertyAccessibleByLandlord(client, row.property_id, landlordUserId, actorRole);
  }
  return false;
}
