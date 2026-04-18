/**
 * Repo for security deposits (and similar held funds) at the lease level,
 * plus disposition records written at move-out.
 */

import type { PoolClient, QueryResult } from './db.js';

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

export type DepositKind = 'SECURITY' | 'PET' | 'KEY' | 'LAST_MONTH' | 'OTHER';

export type LeaseDepositRow = {
  id: string;
  lease_id: string;
  kind: DepositKind;
  amount: number;
  held_since: string;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: Date | null;
};

const DEPOSIT_COLS = `id, lease_id, kind, amount,
       CONVERT(NVARCHAR(10), held_since, 23) AS held_since,
       notes, created_at, updated_at, created_by, updated_by, deleted_at`;

const DEPOSIT_INSERTED_COLS = `INSERTED.id, INSERTED.lease_id, INSERTED.kind, INSERTED.amount,
       CONVERT(NVARCHAR(10), INSERTED.held_since, 23) AS held_since,
       INSERTED.notes, INSERTED.created_at, INSERTED.updated_at,
       INSERTED.created_by, INSERTED.updated_by, INSERTED.deleted_at`;

export async function listDepositsForLease(
  client: Queryable,
  leaseId: string
): Promise<LeaseDepositRow[]> {
  const r = await client.query<LeaseDepositRow>(
    `SELECT ${DEPOSIT_COLS}
     FROM lease_deposits
     WHERE lease_id = $1 AND deleted_at IS NULL
     ORDER BY held_since, created_at`,
    [leaseId]
  );
  return r.rows;
}

export async function getDepositById(
  client: Queryable,
  id: string
): Promise<LeaseDepositRow | null> {
  const r = await client.query<LeaseDepositRow>(
    `SELECT ${DEPOSIT_COLS} FROM lease_deposits
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return r.rows[0] ?? null;
}

export async function insertDeposit(
  client: PoolClient,
  input: {
    leaseId: string;
    kind?: DepositKind;
    amount: number;
    heldSince: string;
    notes?: string | null;
    actorUserId: string;
  }
): Promise<LeaseDepositRow> {
  const r = await client.query<LeaseDepositRow>(
    `INSERT INTO lease_deposits (id, lease_id, kind, amount, held_since, notes, created_by, updated_by)
     OUTPUT ${DEPOSIT_INSERTED_COLS}
     VALUES (NEWID(), $1, $2, $3, $4, $5, $6, $6)`,
    [
      input.leaseId,
      input.kind ?? 'SECURITY',
      input.amount,
      input.heldSince,
      input.notes ?? null,
      input.actorUserId,
    ]
  );
  return r.rows[0]!;
}

export async function updateDeposit(
  client: PoolClient,
  id: string,
  patch: {
    kind?: DepositKind;
    amount?: number;
    heldSince?: string;
    notes?: string | null;
  },
  actorUserId: string
): Promise<LeaseDepositRow | null> {
  const cur = await getDepositById(client, id);
  if (!cur) return null;
  const kind = patch.kind ?? cur.kind;
  const amount = patch.amount ?? cur.amount;
  const held_since = patch.heldSince ?? cur.held_since;
  const notes = patch.notes !== undefined ? patch.notes : cur.notes;
  const r = await client.query<LeaseDepositRow>(
    `UPDATE lease_deposits SET
       kind       = $2,
       amount     = $3,
       held_since = $4,
       notes      = $5,
       updated_by = $6,
       updated_at = SYSDATETIMEOFFSET()
     OUTPUT ${DEPOSIT_INSERTED_COLS}
     WHERE id = $1 AND deleted_at IS NULL`,
    [id, kind, amount, held_since, notes, actorUserId]
  );
  return r.rows[0] ?? null;
}

export async function softDeleteDeposit(
  client: PoolClient,
  id: string,
  actorUserId: string
): Promise<boolean> {
  const r = await client.query(
    `UPDATE lease_deposits
        SET deleted_at = SYSDATETIMEOFFSET(), updated_by = $2, updated_at = SYSDATETIMEOFFSET()
      WHERE id = $1 AND deleted_at IS NULL`,
    [id, actorUserId]
  );
  return (r.rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// lease_deposit_dispositions
// ---------------------------------------------------------------------------

export type LeaseDepositDispositionRow = {
  id: string;
  lease_deposit_id: string;
  refunded_amount: number;
  withheld_amount: number;
  withholding_reason: string | null;
  processed_on: string | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
};

const DISPO_COLS = `id, lease_deposit_id, refunded_amount, withheld_amount, withholding_reason,
       CONVERT(NVARCHAR(10), processed_on, 23) AS processed_on,
       created_at, updated_at, created_by, updated_by`;

const DISPO_COLS_D = `d.id, d.lease_deposit_id, d.refunded_amount, d.withheld_amount, d.withholding_reason,
       CONVERT(NVARCHAR(10), d.processed_on, 23) AS processed_on,
       d.created_at, d.updated_at, d.created_by, d.updated_by`;

export async function getDispositionForDeposit(
  client: Queryable,
  leaseDepositId: string
): Promise<LeaseDepositDispositionRow | null> {
  const r = await client.query<LeaseDepositDispositionRow>(
    `SELECT ${DISPO_COLS} FROM lease_deposit_dispositions WHERE lease_deposit_id = $1`,
    [leaseDepositId]
  );
  return r.rows[0] ?? null;
}

export async function listDispositionsForLease(
  client: Queryable,
  leaseId: string
): Promise<LeaseDepositDispositionRow[]> {
  const r = await client.query<LeaseDepositDispositionRow>(
    `SELECT ${DISPO_COLS_D}
     FROM lease_deposit_dispositions d
     INNER JOIN lease_deposits ld ON ld.id = d.lease_deposit_id
     WHERE ld.lease_id = $1 AND ld.deleted_at IS NULL`,
    [leaseId]
  );
  return r.rows;
}

export async function upsertDisposition(
  client: PoolClient,
  input: {
    leaseDepositId: string;
    refundedAmount: number;
    withheldAmount: number;
    withholdingReason?: string | null;
    processedOn?: string | null;
    actorUserId: string;
  }
): Promise<LeaseDepositDispositionRow> {
  await client.query(
    `MERGE lease_deposit_dispositions AS tgt
     USING (SELECT $1 AS lease_deposit_id) AS src ON tgt.lease_deposit_id = src.lease_deposit_id
     WHEN MATCHED THEN UPDATE SET
       refunded_amount    = $2,
       withheld_amount    = $3,
       withholding_reason = $4,
       processed_on       = $5,
       updated_by         = $6,
       updated_at         = SYSDATETIMEOFFSET()
     WHEN NOT MATCHED THEN INSERT
       (id, lease_deposit_id, refunded_amount, withheld_amount,
        withholding_reason, processed_on, created_by, updated_by)
       VALUES (NEWID(), $1, $2, $3, $4, $5, $6, $6);`,
    [
      input.leaseDepositId,
      input.refundedAmount,
      input.withheldAmount,
      input.withholdingReason ?? null,
      input.processedOn ?? null,
      input.actorUserId,
    ]
  );
  const row = await getDispositionForDeposit(client, input.leaseDepositId);
  if (!row) throw new Error('disposition_upsert_failed');
  return row;
}

export async function deleteDisposition(
  client: PoolClient,
  leaseDepositId: string
): Promise<boolean> {
  const r = await client.query(
    `DELETE FROM lease_deposit_dispositions WHERE lease_deposit_id = $1`,
    [leaseDepositId]
  );
  return (r.rowCount ?? 0) > 0;
}
