import type { QueryResult } from './db.js';

export type LeasePaymentEntryRow = {
  id: string;
  lease_id: string;
  period_start: string;       // ISO date YYYY-MM-DD
  amount_due: number;
  amount_paid: number;
  due_date: string;           // ISO date YYYY-MM-DD
  paid_date: string | null;   // ISO date YYYY-MM-DD
  payment_method: string | null;
  payment_type: string;
  notes: string | null;
  recorded_by: string | null;
  created_at: Date;
  updated_at: Date;
  // Computed by SELECT
  payment_status: 'PAID' | 'PARTIAL' | 'OVERDUE' | 'PENDING';
};

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

const SELECT_COLS = `
  lpe.id, lpe.lease_id,
  CONVERT(NVARCHAR(10), lpe.period_start, 23) AS period_start,
  lpe.amount_due, lpe.amount_paid,
  CONVERT(NVARCHAR(10), lpe.due_date, 23)     AS due_date,
  CONVERT(NVARCHAR(10), lpe.paid_date, 23)    AS paid_date,
  lpe.payment_method, lpe.payment_type, lpe.notes, lpe.recorded_by,
  lpe.created_at, lpe.updated_at,
  CASE
    WHEN lpe.amount_paid >= lpe.amount_due                          THEN 'PAID'
    WHEN lpe.amount_paid > 0                                         THEN 'PARTIAL'
    WHEN CAST(SYSDATETIMEOFFSET() AS DATE) > lpe.due_date            THEN 'OVERDUE'
    ELSE 'PENDING'
  END AS payment_status
`;

export async function listEntriesForLease(
  client: Queryable,
  leaseId: string
): Promise<LeasePaymentEntryRow[]> {
  const r = await client.query<LeasePaymentEntryRow>(
    `SELECT ${SELECT_COLS}
     FROM lease_payment_entries lpe
     WHERE lpe.lease_id = $1 AND lpe.deleted_at IS NULL
     ORDER BY lpe.period_start DESC`,
    [leaseId]
  );
  return r.rows;
}

export async function listEntriesForTenant(
  client: Queryable,
  actorUserId: string
): Promise<LeasePaymentEntryRow[]> {
  const r = await client.query<LeasePaymentEntryRow>(
    `SELECT ${SELECT_COLS}
     FROM lease_payment_entries lpe
     JOIN lease_tenants lt ON lt.lease_id = lpe.lease_id
     WHERE lt.user_id = $1 AND lpe.deleted_at IS NULL
     ORDER BY lpe.period_start DESC`,
    [actorUserId]
  );
  return r.rows;
}

export async function getEntryById(
  client: Queryable,
  id: string
): Promise<LeasePaymentEntryRow | null> {
  const r = await client.query<LeasePaymentEntryRow>(
    `SELECT ${SELECT_COLS}
     FROM lease_payment_entries lpe
     WHERE lpe.id = $1 AND lpe.deleted_at IS NULL`,
    [id]
  );
  return r.rows[0] ?? null;
}

export async function insertEntry(
  client: Queryable,
  params: {
    lease_id: string;
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
): Promise<LeasePaymentEntryRow> {
  const r = await client.query<LeasePaymentEntryRow>(
    `INSERT INTO lease_payment_entries
       (id, lease_id, period_start, amount_due, amount_paid, due_date,
        paid_date, payment_method, payment_type, notes, recorded_by)
     OUTPUT
       INSERTED.id, INSERTED.lease_id,
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
       END AS payment_status
     VALUES (NEWID(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      params.lease_id,
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
  return r.rows[0]!;
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
    recorded_by: string;
  }
): Promise<LeasePaymentEntryRow | null> {
  const r = await client.query<LeasePaymentEntryRow>(
    `UPDATE lease_payment_entries
     SET amount_due     = $1,
         amount_paid    = $2,
         due_date       = $3,
         paid_date      = $4,
         payment_method = $5,
         notes          = $6,
         recorded_by    = $7,
         updated_at     = SYSDATETIMEOFFSET()
     OUTPUT
       INSERTED.id, INSERTED.lease_id,
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
       END AS payment_status
     WHERE id = $8 AND deleted_at IS NULL`,
    [
      params.amount_due,
      params.amount_paid,
      params.due_date,
      params.paid_date,
      params.payment_method,
      params.notes,
      params.recorded_by,
      id,
    ]
  );
  return r.rows[0] ?? null;
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
