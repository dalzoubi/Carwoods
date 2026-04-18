import type { PoolClient, QueryResult } from './db.js';

export type LeaseRowFull = {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string | null;
  month_to_month: boolean;
  status: string;
  notes: string | null;
  /** Monthly rent in USD (nullable if not recorded). */
  rent_amount: number | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  /**
   * Populated by `listLeases` use case: comma-separated tenant display names on this lease.
   */
  tenant_names?: string | null;
};

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

export async function listLeasesForProperty(
  client: Queryable,
  propertyId: string
): Promise<LeaseRowFull[]> {
  const r = await client.query<LeaseRowFull>(
    `SELECT id, property_id, start_date, end_date, month_to_month, status, notes, rent_amount,
            created_at, updated_at, deleted_at
     FROM leases
     WHERE property_id = $1 AND deleted_at IS NULL
     ORDER BY start_date DESC`,
    [propertyId]
  );
  return r.rows;
}

/**
 * Normalize lease id strings for Map lookup (GUID casing / braces / mssql uniqueidentifier Buffer).
 */
export function normalizeLeaseUuidKey(id: unknown): string {
  if (Buffer.isBuffer(id) && id.length === 16) {
    const b = id;
    const p1 = b.subarray(0, 4).reverse().toString('hex');
    const p2 = b.subarray(4, 6).reverse().toString('hex');
    const p3 = b.subarray(6, 8).reverse().toString('hex');
    const p4 = b.subarray(8, 16).toString('hex');
    const hex = p1 + p2 + p3 + p4;
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`.toLowerCase();
  }
  let s = String(id ?? '').trim();
  if (s.startsWith('{') && s.endsWith('}')) s = s.slice(1, -1);
  return s.toLowerCase();
}

/**
 * One display label per tenant user: trimmed "First Last", else email, else phone.
 * Used when aggregating names per lease (batch query — avoids correlated subquery driver quirks).
 */
function tenantDisplaySqlFragment(alias = 'u'): string {
  /* STRING_AGG ignores NULL inputs — if name/email/phone are all empty, still emit a label
     so linked tenants do not disappear from landlord lease lists (e.g. Portal Payments). */
  return `COALESCE(
    NULLIF(LTRIM(RTRIM(CONCAT(COALESCE(${alias}.first_name, N''), N' ', COALESCE(${alias}.last_name, N'')))), N''),
    NULLIF(LTRIM(COALESCE(${alias}.email, N'')), N''),
    NULLIF(LTRIM(COALESCE(${alias}.phone, N'')), N''),
    LEFT(CAST(${alias}.id AS NVARCHAR(36)), 8)
  )`;
}

/**
 * Aggregated tenant labels per lease (for landlord lease lists). Empty map if none or no ids.
 */
export async function listTenantNamesByLeaseIds(
  client: Queryable,
  leaseIds: unknown[]
): Promise<Map<string, string>> {
  const ids = leaseIds.map((id) => normalizeLeaseUuidKey(id)).filter(Boolean);
  if (ids.length === 0) return new Map();

  const label = tenantDisplaySqlFragment('u');
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
  const r = await client.query<{ lease_id: string; tenant_names: string | null }>(
    `SELECT CAST(lt.lease_id AS NVARCHAR(36)) AS lease_id,
            STRING_AGG(${label}, N', ')
              WITHIN GROUP (ORDER BY u.last_name, u.first_name, u.email) AS tenant_names
     FROM lease_tenants lt
     INNER JOIN users u ON u.id = lt.user_id
     WHERE lt.lease_id IN (${placeholders})
     GROUP BY lt.lease_id`,
    ids
  );

  const map = new Map<string, string>();
  for (const row of r.rows) {
    const id = normalizeLeaseUuidKey(row.lease_id);
    const tn = row.tenant_names != null ? String(row.tenant_names).trim() : '';
    if (id && tn) map.set(id, tn);
  }
  return map;
}

/**
 * Leases whose property is visible to the actor (LANDLORD: own properties only; ADMIN: all).
 * Optionally restrict to one property_id (still requires access to that property).
 */
export async function listLeasesForActor(
  client: Queryable,
  actorRole: string,
  actorUserId: string,
  propertyId?: string | null
): Promise<LeaseRowFull[]> {
  const role = actorRole.trim().toUpperCase();
  const pid = propertyId?.trim();
  if (pid) {
    const r = await client.query<LeaseRowFull>(
      `SELECT l.id, l.property_id, l.start_date, l.end_date, l.month_to_month, l.status, l.notes, l.rent_amount,
              l.created_at, l.updated_at, l.deleted_at
       FROM leases l
       INNER JOIN properties p ON p.id = l.property_id AND p.deleted_at IS NULL
       WHERE l.deleted_at IS NULL
         AND l.property_id = $1
         AND ($2 = 'ADMIN' OR p.created_by = $3)
       ORDER BY l.start_date DESC`,
      [pid, role, actorUserId]
    );
    return r.rows;
  }
  const r = await client.query<LeaseRowFull>(
    `SELECT l.id, l.property_id, l.start_date, l.end_date, l.month_to_month, l.status, l.notes, l.rent_amount,
            l.created_at, l.updated_at, l.deleted_at
     FROM leases l
     INNER JOIN properties p ON p.id = l.property_id AND p.deleted_at IS NULL
     WHERE l.deleted_at IS NULL
       AND ($1 = 'ADMIN' OR p.created_by = $2)
     ORDER BY l.created_at DESC`,
    [role, actorUserId]
  );
  return r.rows;
}

/** @deprecated Prefer listLeasesForActor — this returned every lease with no landlord scope. */
export async function listLeasesLandlord(
  client: Queryable
): Promise<LeaseRowFull[]> {
  const r = await client.query<LeaseRowFull>(
    `SELECT id, property_id, start_date, end_date, month_to_month, status, notes, rent_amount,
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
    `SELECT id, property_id, start_date, end_date, month_to_month, status, notes, rent_amount,
            created_at, updated_at, deleted_at
     FROM leases WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return r.rows[0] ?? null;
}

/**
 * Lease IDs for this tenant on properties owned by `landlordUserId` (`properties.created_by`).
 */
export async function listLeaseIdsForTenantUnderLandlord(
  client: Queryable,
  tenantUserId: string,
  landlordUserId: string
): Promise<string[]> {
  const r = await client.query<{ id: string }>(
    `SELECT CAST(l.id AS NVARCHAR(36)) AS id
     FROM leases l
     INNER JOIN lease_tenants lt ON lt.lease_id = l.id AND lt.user_id = $1
     INNER JOIN properties p ON p.id = l.property_id AND p.deleted_at IS NULL
     WHERE l.deleted_at IS NULL
       AND p.created_by = $2`,
    [tenantUserId, landlordUserId]
  );
  return r.rows.map((row) => normalizeLeaseUuidKey(row.id));
}

/**
 * Current occupancy lease at this property: ACTIVE, not ended, most recent start.
 * Used when onboarding a tenant onto an address that already has an active lease row.
 */
export async function findActiveOccupancyLeaseForProperty(
  client: Queryable,
  propertyId: string
): Promise<LeaseRowFull | null> {
  const r = await client.query<LeaseRowFull>(
    `SELECT TOP 1 id, property_id, start_date, end_date, month_to_month, status, notes, rent_amount,
            created_at, updated_at, deleted_at
       FROM leases
      WHERE property_id = $1
        AND deleted_at IS NULL
        AND status = 'ACTIVE'
        AND (
          month_to_month = 1
          OR end_date IS NULL
          OR end_date >= CAST(GETUTCDATE() AS DATE)
        )
      ORDER BY start_date DESC`,
    [propertyId]
  );
  return r.rows[0] ?? null;
}

/** True if both users appear on the same lease row for this property (roommates). */
export async function tenantsShareALeaseAtProperty(
  client: Queryable,
  tenantUserIdA: string,
  tenantUserIdB: string,
  propertyId: string
): Promise<boolean> {
  const r = await client.query<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt
     FROM lease_tenants lt_a
     INNER JOIN leases l ON l.id = lt_a.lease_id AND l.deleted_at IS NULL AND l.property_id = $3
     INNER JOIN lease_tenants lt_b ON lt_b.lease_id = lt_a.lease_id AND lt_b.user_id = $2
     WHERE lt_a.user_id = $1`,
    [tenantUserIdA, tenantUserIdB, propertyId]
  );
  return Number(r.rows[0]?.cnt ?? 0) > 0;
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
    rent_amount: number | null;
    created_by: string;
  }
): Promise<LeaseRowFull> {
  const r = await client.query<LeaseRowFull>(
    `INSERT INTO leases (id, property_id, start_date, end_date, month_to_month, status, notes, rent_amount, created_by, updated_by)
     OUTPUT INSERTED.id, INSERTED.property_id, INSERTED.start_date, INSERTED.end_date,
            INSERTED.month_to_month, INSERTED.status, INSERTED.notes, INSERTED.rent_amount,
            INSERTED.created_at, INSERTED.updated_at, INSERTED.deleted_at
     VALUES (NEWID(), $1, $2, $3, $4, $5, $6, $7, $8, $8)`,
    [
      params.property_id,
      params.start_date,
      params.end_date,
      params.month_to_month ? 1 : 0,
      params.status,
      params.notes,
      params.rent_amount,
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
  rent_amount?: number | null;
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
  const rent_amount = patch.rent_amount !== undefined ? patch.rent_amount : cur.rent_amount;

  const r = await client.query<LeaseRowFull>(
    `UPDATE leases SET
       start_date     = $2,
       end_date       = $3,
       month_to_month = $4,
       status         = $5,
       notes          = $6,
       rent_amount    = $7,
       updated_by     = $8,
       updated_at     = GETUTCDATE()
     OUTPUT INSERTED.id, INSERTED.property_id, INSERTED.start_date, INSERTED.end_date,
            INSERTED.month_to_month, INSERTED.status, INSERTED.notes, INSERTED.rent_amount,
            INSERTED.created_at, INSERTED.updated_at, INSERTED.deleted_at
     WHERE id = $1 AND deleted_at IS NULL`,
    [id, start_date, end_date, month_to_month ? 1 : 0, status, notes, rent_amount, updatedBy]
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

/** Delete a lease–tenant link row. Returns the deleted row, or null if none matched. */
export async function unlinkLeaseTenantRow(
  client: PoolClient,
  leaseId: string,
  userId: string
): Promise<{ id: string; lease_id: string; user_id: string } | null> {
  const r = await client.query<{ id: string; lease_id: string; user_id: string }>(
    `DELETE FROM lease_tenants
     OUTPUT DELETED.id, DELETED.lease_id, DELETED.user_id
     WHERE lease_id = $1 AND user_id = $2`,
    [leaseId, userId]
  );
  return r.rows[0] ?? null;
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

/** User IDs linked to a lease (roommates share one lease row). */
export async function listLeaseTenantUserIds(client: Queryable, leaseId: string): Promise<string[]> {
  const r = await client.query<{ user_id: string }>(
    `SELECT user_id FROM lease_tenants WHERE lease_id = $1`,
    [leaseId]
  );
  return r.rows.map((row) => row.user_id);
}

/**
 * True if another lease on the same property overlaps the given date range and has a tenant
 * outside `allowedUserIds` (tenants who may share this occupancy window, e.g. same household).
 * Excludes `excludeLeaseId` (the lease being created/updated/linked).
 */
export async function checkPropertyExclusiveTenantConflict(
  client: Queryable,
  params: {
    propertyId: string;
    startDate: string;
    endDate: string | null;
    excludeLeaseId: string | null;
    allowedUserIds: string[];
  }
): Promise<boolean> {
  const { propertyId, startDate, endDate, excludeLeaseId, allowedUserIds } = params;
  if (allowedUserIds.length === 0) return false;

  const allowedPlaceholders = allowedUserIds.map((_, i) => `$${5 + i}`).join(', ');
  const sql = `SELECT COUNT(*) AS overlap_count
     FROM leases l2
     WHERE l2.property_id = $1
       AND l2.deleted_at IS NULL
       AND ($2 IS NULL OR l2.id <> $2)
       AND ($3 <= COALESCE(l2.end_date, '9999-12-31'))
       AND (COALESCE($4, '9999-12-31') >= l2.start_date)
       AND EXISTS (
         SELECT 1
           FROM lease_tenants lt
          WHERE lt.lease_id = l2.id
            AND lt.user_id NOT IN (${allowedPlaceholders})
       )`;

  const values: unknown[] = [propertyId, excludeLeaseId, startDate, endDate, ...allowedUserIds];
  const r = await client.query<{ overlap_count: number }>(sql, values);
  return Number(r.rows[0]?.overlap_count ?? 0) > 0;
}

/**
 * True if another non-deleted lease on the same property overlaps `[startDate, endDate]` on the calendar
 * (inclusive ranges; open-ended leases use COALESCE(end, '9999-12-31')).
 */
export async function hasOverlappingLeaseAtProperty(
  client: Queryable,
  params: {
    propertyId: string;
    startDate: string;
    endDate: string | null;
    excludeLeaseId: string | null;
  }
): Promise<boolean> {
  const { propertyId, startDate, endDate, excludeLeaseId } = params;
  const sql = `SELECT COUNT(*) AS overlap_count
     FROM leases l2
     WHERE l2.property_id = $1
       AND l2.deleted_at IS NULL
       AND ($2 IS NULL OR l2.id <> $2)
       AND ($3 <= COALESCE(l2.end_date, '9999-12-31'))
       AND (COALESCE($4, '9999-12-31') >= l2.start_date)`;

  const r = await client.query<{ overlap_count: number }>(sql, [
    propertyId,
    excludeLeaseId,
    startDate,
    endDate,
  ]);
  return Number(r.rows[0]?.overlap_count ?? 0) > 0;
}
