import type { PoolClient, QueryResult } from './db.js';

export type RentLedgerEntryRow = {
  id: string;
  lease_id: string;
  period_start: string;       // ISO date YYYY-MM-DD
  amount_due: number;
  amount_paid: number;
  due_date: string;           // ISO date YYYY-MM-DD
  paid_date: string | null;   // ISO date YYYY-MM-DD
  payment_method: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: Date;
  updated_at: Date;
  // Computed by SELECT
  payment_status: 'PAID' | 'PARTIAL' | 'OVERDUE' | 'PENDING';
};

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

const SELECT_COLS = `
  id, lease_id,
  CONVERT(NVARCHAR(10), period_start, 23) AS period_start,
  amount_due, amount_paid,
  CONVERT(NVARCHAR(10), due_date, 23)     AS due_date,
  CONVERT(NVARCHAR(10), paid_date, 23)    AS paid_date,
  payment_method, notes, recorded_by,
  created_at, updated_at,
  CASE
    WHEN amount_paid >= amount_due                          THEN 'PAID'
    WHEN amount_paid > 0                                    THEN 'PARTIAL'
    WHEN CAST(SYSDATETIMEOFFSET() AS DATE) > due_date      THEN 'OVERDUE'
    ELSE 'PENDING'
  END AS payment_status
`;

export async function listEntriesForLease(
  client: Queryable,
  leaseId: string
): Promise<RentLedgerEntryRow[]> {
  const r = await client.query<RentLedgerEntryRow>(
    `SELECT ${SELECT_COLS}
     FROM rent_ledger_entries
     WHERE lease_id = $1 AND deleted_at IS NULL
     ORDER BY period_start DESC`,
    [leaseId]
  );
  return r.rows;
}

export async function listEntriesForTenant(
  client: Queryable,
  actorUserId: string
): Promise<RentLedgerEntryRow[]> {
  const r = await client.query<RentLedgerEntryRow>(
    `SELECT ${SELECT_COLS}
     FROM rent_ledger_entries rle
     JOIN lease_tenants lt ON lt.lease_id = rle.lease_id
     WHERE lt.user_id = $1 AND rle.deleted_at IS NULL
     ORDER BY rle.period_start DESC`,
    [actorUserId]
  );
  return r.rows;
}

export async function getEntryById(
  client: Queryable,
  id: string
): Promise<RentLedgerEntryRow | null> {
  const r = await client.query<RentLedgerEntryRow>(
    `SELECT ${SELECT_COLS}
     FROM rent_ledger_entries
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return r.rows[0] ?? null;
}

export async function insertEntry(
  client: PoolClient,
  params: {
    lease_id: string;
    period_start: string;
    amount_due: number;
    amount_paid: number;
    due_date: string;
    paid_date: string | null;
    payment_method: string | null;
    notes: string | null;
    recorded_by: string;
  }
): Promise<RentLedgerEntryRow> {
  const r = await client.query<RentLedgerEntryRow>(
    `INSERT INTO rent_ledger_entries
       (id, lease_id, period_start, amount_due, amount_paid, due_date,
        paid_date, payment_method, notes, recorded_by)
     OUTPUT
       INSERTED.id, INSERTED.lease_id,
       CONVERT(NVARCHAR(10), INSERTED.period_start, 23) AS period_start,
       INSERTED.amount_due, INSERTED.amount_paid,
       CONVERT(NVARCHAR(10), INSERTED.due_date, 23)     AS due_date,
       CONVERT(NVARCHAR(10), INSERTED.paid_date, 23)    AS paid_date,
       INSERTED.payment_method, INSERTED.notes, INSERTED.recorded_by,
       INSERTED.created_at, INSERTED.updated_at,
       CASE
         WHEN INSERTED.amount_paid >= INSERTED.amount_due                               THEN 'PAID'
         WHEN INSERTED.amount_paid > 0                                                  THEN 'PARTIAL'
         WHEN CAST(SYSDATETIMEOFFSET() AS DATE) > INSERTED.due_date                    THEN 'OVERDUE'
         ELSE 'PENDING'
       END AS payment_status
     VALUES (NEWID(), $1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      params.lease_id,
      params.period_start,
      params.amount_due,
      params.amount_paid,
      params.due_date,
      params.paid_date,
      params.payment_method,
      params.notes,
      params.recorded_by,
    ]
  );
  return r.rows[0]!;
}

export async function updateEntry(
  client: PoolClient,
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
): Promise<RentLedgerEntryRow | null> {
  const r = await client.query<RentLedgerEntryRow>(
    `UPDATE rent_ledger_entries
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
       INSERTED.payment_method, INSERTED.notes, INSERTED.recorded_by,
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
