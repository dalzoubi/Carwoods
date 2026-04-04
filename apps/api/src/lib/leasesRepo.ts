import type { PoolClient, QueryResult } from './db.js';

export type LeaseRowFull = {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string | null;
  month_to_month: boolean;
  status: string;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

export async function listLeasesForProperty(
  client: Queryable,
  propertyId: string
): Promise<LeaseRowFull[]> {
  const r = await client.query<LeaseRowFull>(
    `SELECT id, property_id, start_date, end_date, month_to_month, status, notes,
            created_at, updated_at, deleted_at
     FROM leases
     WHERE property_id = $1 AND deleted_at IS NULL
     ORDER BY start_date DESC`,
    [propertyId]
  );
  return r.rows;
}

export async function listLeasesLandlord(
  client: Queryable
): Promise<LeaseRowFull[]> {
  const r = await client.query<LeaseRowFull>(
    `SELECT id, property_id, start_date, end_date, month_to_month, status, notes,
            created_at, updated_at, deleted_at
     FROM leases
     WHERE deleted_at IS NULL
     ORDER BY created_at DESC`
  );
  return r.rows;
}

export async function getLeaseById(
  client: Queryable,
  id: string
): Promise<LeaseRowFull | null> {
  const r = await client.query<LeaseRowFull>(
    `SELECT id, property_id, start_date, end_date, month_to_month, status, notes,
            created_at, updated_at, deleted_at
     FROM leases WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return r.rows[0] ?? null;
}

export async function insertLease(
  client: PoolClient,
  params: {
    property_id: string;
    start_date: string;
    end_date: string | null;
    month_to_month: boolean;
    status: string;
    notes: string | null;
    created_by: string;
  }
): Promise<LeaseRowFull> {
  const r = await client.query<LeaseRowFull>(
    `INSERT INTO leases (id, property_id, start_date, end_date, month_to_month, status, notes, created_by, updated_by)
     OUTPUT INSERTED.id, INSERTED.property_id, INSERTED.start_date, INSERTED.end_date,
            INSERTED.month_to_month, INSERTED.status, INSERTED.notes,
            INSERTED.created_at, INSERTED.updated_at, INSERTED.deleted_at
     VALUES (NEWID(), $1, $2, $3, $4, $5, $6, $7, $7)`,
    [
      params.property_id,
      params.start_date,
      params.end_date,
      params.month_to_month ? 1 : 0,
      params.status,
      params.notes,
      params.created_by,
    ]
  );
  return r.rows[0]!;
}

export type LeasePatch = {
  start_date?: string;
  end_date?: string | null;
  month_to_month?: boolean;
  status?: string;
  notes?: string | null;
};

export async function updateLease(
  client: PoolClient,
  id: string,
  patch: LeasePatch,
  updatedBy: string
): Promise<LeaseRowFull | null> {
  const cur = await getLeaseById(client, id);
  if (!cur) return null;
  const start_date = patch.start_date ?? cur.start_date;
  const end_date = patch.end_date !== undefined ? patch.end_date : cur.end_date;
  const month_to_month = patch.month_to_month ?? cur.month_to_month;
  const status = patch.status ?? cur.status;
  const notes = patch.notes !== undefined ? patch.notes : cur.notes;

  const r = await client.query<LeaseRowFull>(
    `UPDATE leases SET
       start_date     = $2,
       end_date       = $3,
       month_to_month = $4,
       status         = $5,
       notes          = $6,
       updated_by     = $7,
       updated_at     = GETUTCDATE()
     OUTPUT INSERTED.id, INSERTED.property_id, INSERTED.start_date, INSERTED.end_date,
            INSERTED.month_to_month, INSERTED.status, INSERTED.notes,
            INSERTED.created_at, INSERTED.updated_at, INSERTED.deleted_at
     WHERE id = $1 AND deleted_at IS NULL`,
    [id, start_date, end_date, month_to_month ? 1 : 0, status, notes, updatedBy]
  );
  return r.rows[0] ?? null;
}

export async function softDeleteLease(
  client: PoolClient,
  id: string,
  updatedBy: string
): Promise<boolean> {
  const r = await client.query(
    `UPDATE leases SET deleted_at = GETUTCDATE(), updated_by = $2, updated_at = GETUTCDATE()
     WHERE id = $1 AND deleted_at IS NULL`,
    [id, updatedBy]
  );
  return (r.rowCount ?? 0) > 0;
}

export async function linkLeaseTenant(
  client: PoolClient,
  leaseId: string,
  userId: string
): Promise<{ id: string; lease_id: string; user_id: string }> {
  // T-SQL equivalent of INSERT … ON CONFLICT DO NOTHING: MERGE with WHEN NOT MATCHED only
  await client.query(
    `MERGE lease_tenants AS target
     USING (SELECT $1 AS lease_id, $2 AS user_id) AS src
       ON target.lease_id = src.lease_id AND target.user_id = src.user_id
     WHEN NOT MATCHED THEN
       INSERT (id, lease_id, user_id) VALUES (NEWID(), $1, $2);`,
    [leaseId, userId]
  );
  const sel = await client.query<{ id: string; lease_id: string; user_id: string }>(
    `SELECT id, lease_id, user_id FROM lease_tenants WHERE lease_id = $1 AND user_id = $2`,
    [leaseId, userId]
  );
  return sel.rows[0]!;
}
