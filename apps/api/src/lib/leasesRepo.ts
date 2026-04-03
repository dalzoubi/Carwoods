import type pg from 'pg';

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

export async function listLeasesForProperty(
  client: pg.Pool | pg.PoolClient,
  propertyId: string
): Promise<LeaseRowFull[]> {
  const r = await client.query<LeaseRowFull>(
    `SELECT id, property_id, start_date, end_date, month_to_month, status, notes,
            created_at, updated_at, deleted_at
     FROM leases
     WHERE property_id = $1::uuid AND deleted_at IS NULL
     ORDER BY start_date DESC`,
    [propertyId]
  );
  return r.rows;
}

export async function listLeasesAdmin(
  client: pg.Pool | pg.PoolClient
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
  client: pg.Pool | pg.PoolClient,
  id: string
): Promise<LeaseRowFull | null> {
  const r = await client.query<LeaseRowFull>(
    `SELECT id, property_id, start_date, end_date, month_to_month, status, notes,
            created_at, updated_at, deleted_at
     FROM leases WHERE id = $1::uuid AND deleted_at IS NULL`,
    [id]
  );
  return r.rows[0] ?? null;
}

export async function insertLease(
  client: pg.PoolClient,
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
    `INSERT INTO leases (
       property_id, start_date, end_date, month_to_month, status, notes, created_by, updated_by
     ) VALUES ($1::uuid, $2::date, $3::date, $4, $5, $6, $7::uuid, $7::uuid)
     RETURNING id, property_id, start_date, end_date, month_to_month, status, notes,
       created_at, updated_at, deleted_at`,
    [
      params.property_id,
      params.start_date,
      params.end_date,
      params.month_to_month,
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
  client: pg.PoolClient,
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
       start_date = $2::date,
       end_date = $3::date,
       month_to_month = $4,
       status = $5,
       notes = $6,
       updated_by = $7::uuid,
       updated_at = now()
     WHERE id = $1::uuid AND deleted_at IS NULL
     RETURNING id, property_id, start_date, end_date, month_to_month, status, notes,
       created_at, updated_at, deleted_at`,
    [id, start_date, end_date, month_to_month, status, notes, updatedBy]
  );
  return r.rows[0] ?? null;
}

export async function softDeleteLease(
  client: pg.PoolClient,
  id: string,
  updatedBy: string
): Promise<boolean> {
  const r = await client.query(
    `UPDATE leases SET deleted_at = now(), updated_by = $2::uuid, updated_at = now()
     WHERE id = $1::uuid AND deleted_at IS NULL`,
    [id, updatedBy]
  );
  return (r.rowCount ?? 0) > 0;
}

export async function linkLeaseTenant(
  client: pg.PoolClient,
  leaseId: string,
  userId: string
): Promise<{ id: string; lease_id: string; user_id: string }> {
  const ins = await client.query<{ id: string; lease_id: string; user_id: string }>(
    `INSERT INTO lease_tenants (lease_id, user_id)
     VALUES ($1::uuid, $2::uuid)
     ON CONFLICT (lease_id, user_id) DO NOTHING
     RETURNING id, lease_id, user_id`,
    [leaseId, userId]
  );
  if (ins.rows[0]) return ins.rows[0];
  const sel = await client.query<{ id: string; lease_id: string; user_id: string }>(
    `SELECT id, lease_id, user_id FROM lease_tenants WHERE lease_id = $1::uuid AND user_id = $2::uuid`,
    [leaseId, userId]
  );
  return sel.rows[0]!;
}
