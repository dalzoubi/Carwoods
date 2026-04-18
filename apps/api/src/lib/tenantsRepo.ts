import type { PoolClient, QueryResult } from './db.js';
import { Role } from '../domain/constants.js';

export type TenantRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: string;
  status: string;
};

export type TenantWithContextRow = TenantRow & {
  profile_photo_storage_path: string | null;
  property_id: string | null;
  property_street: string | null;
  property_city: string | null;
  property_state: string | null;
  property_zip: string | null;
  landlord_id: string | null;
  landlord_email: string | null;
  landlord_first_name: string | null;
  landlord_last_name: string | null;
};

export type TenantLeaseRow = {
  id: string;
  property_id: string;
  property_street: string;
  property_city: string;
  property_state: string;
  property_zip: string;
  start_date: string;
  end_date: string | null;
  month_to_month: boolean;
  status: string;
  notes: string | null;
  rent_amount: number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  /** Comma-separated UUIDs — all tenant users linked to this lease row (roommates). */
  tenant_user_ids: string | null;
};

export type ActiveTenantLeaseRow = {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string | null;
  month_to_month: boolean;
};

/** Lease row eligible to follow the tenant when an admin moves them to another landlord's property. */
export type TenantLeaseMoveCandidateRow = {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string | null;
  month_to_month: boolean;
};

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeNamePart(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function placeholderExternalAuthOidForTenantEmail(email: string): string {
  return `seed:tenant:${normalizeEmail(email)}`;
}

export type UpsertTenantResult = {
  user: TenantRow;
  created: boolean;
};

/**
 * Creates a new tenant user or returns the existing one by email.
 * Throws if the email belongs to an ADMIN or LANDLORD.
 */
export async function upsertTenantUserByEmail(
  client: PoolClient,
  params: {
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone?: string | null;
  }
): Promise<UpsertTenantResult> {
  const normalizedEmail = normalizeEmail(params.email);
  const firstName = normalizeNamePart(params.firstName);
  const lastName = normalizeNamePart(params.lastName);
  const phone = normalizePhone(params.phone);

  const existing = await client.query<TenantRow>(
    `SELECT id, email, first_name, last_name, phone, role, status
     FROM users WHERE LOWER(email) = $1`,
    [normalizedEmail]
  );
  const existingRow = existing.rows[0] ?? null;

  if (existingRow) {
    const existingRole = String(existingRow.role ?? '').toUpperCase();
    if (existingRole === Role.ADMIN) {
      throw new Error('email_belongs_to_admin');
    }
    if (existingRole === Role.LANDLORD) {
      throw new Error('email_belongs_to_landlord');
    }
    // Already a tenant — reactivate if disabled
    const updated = await client.query<TenantRow>(
      `UPDATE users
          SET status     = 'ACTIVE',
              first_name = COALESCE(NULLIF($2, ''), first_name),
              last_name  = COALESCE(NULLIF($3, ''), last_name),
              phone      = COALESCE($4, phone),
              updated_at = GETUTCDATE()
        OUTPUT INSERTED.id, INSERTED.email, INSERTED.first_name, INSERTED.last_name,
               INSERTED.phone, INSERTED.role, INSERTED.status
        WHERE id = $1`,
      [existingRow.id, firstName, lastName, phone]
    );
    return { user: updated.rows[0] ?? existingRow, created: false };
  }

  const inserted = await client.query<TenantRow>(
    `INSERT INTO users (id, external_auth_oid, email, first_name, last_name, phone, role, status)
     OUTPUT INSERTED.id, INSERTED.email, INSERTED.first_name, INSERTED.last_name,
            INSERTED.phone, INSERTED.role, INSERTED.status
     VALUES (NEWID(), $1, $2, $3, $4, $5, '${Role.TENANT}', 'ACTIVE')`,
    [
      placeholderExternalAuthOidForTenantEmail(normalizedEmail),
      normalizedEmail,
      firstName,
      lastName,
      phone,
    ]
  );
  return { user: inserted.rows[0]!, created: true };
}

/**
 * Lists all tenants visible to the actor.
 *
 * Each tenant appears once, using their primary lease among **non-expired** rows only
 * (same predicate as {@link listLeasesEligibleForTenantPropertyMove}: month-to-month,
 * open-ended, end_date today or future — includes upcoming leases). The winner is the
 * most recent `start_date`. Expired fixed-term leases are ignored here so history on an
 * old landlord does not duplicate or override the current row.
 *
 * - LANDLORD: only tenants with leases on their properties.
 * - ADMIN with landlordId filter: tenants for that specific landlord.
 * - ADMIN without filter: all tenants.
 */
export async function listTenantsForActor(
  client: Queryable,
  actorRole: string,
  actorUserId: string,
  landlordId?: string | null
): Promise<TenantWithContextRow[]> {
  const role = actorRole.trim().toUpperCase();
  const effectiveLandlordId = role === Role.ADMIN ? (landlordId ?? null) : actorUserId;

  const r = await client.query<TenantWithContextRow>(
    `WITH ranked AS (
       SELECT
         lt.user_id,
         l.id AS lease_id,
         ROW_NUMBER() OVER (
           PARTITION BY lt.user_id
           ORDER BY l.start_date DESC, l.created_at DESC
         ) AS rn
       FROM lease_tenants lt
       INNER JOIN leases l ON l.id = lt.lease_id AND l.deleted_at IS NULL
       WHERE (l.month_to_month = 1 OR l.end_date IS NULL OR l.end_date >= CAST(GETUTCDATE() AS DATE))
     )
     SELECT
       u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.status,
       u.profile_photo_storage_path,
       p.id   AS property_id,
       p.street AS property_street,
       p.city   AS property_city,
       p.state  AS property_state,
       p.zip    AS property_zip,
       landlord.id         AS landlord_id,
       landlord.email      AS landlord_email,
       landlord.first_name AS landlord_first_name,
       landlord.last_name  AS landlord_last_name
     FROM users u
     INNER JOIN ranked r ON r.user_id = u.id AND r.rn = 1
     INNER JOIN leases l ON l.id = r.lease_id AND l.deleted_at IS NULL
     INNER JOIN properties p ON p.id = l.property_id AND p.deleted_at IS NULL
     INNER JOIN users landlord ON landlord.id = p.created_by
     WHERE u.role = '${Role.TENANT}'
       AND ($1 = 'ADMIN' OR landlord.id = $2)
       AND ($3 IS NULL OR landlord.id = $3)
     ORDER BY u.last_name, u.first_name, u.email`,
    [role, actorUserId, effectiveLandlordId]
  );
  return r.rows;
}

/**
 * Gets a single tenant row, checking actor access.
 * Returns null if not found or actor cannot access.
 */
export async function getTenantById(
  client: Queryable,
  tenantId: string,
  actorRole: string,
  actorUserId: string
): Promise<TenantRow | null> {
  const role = actorRole.trim().toUpperCase();
  const r = await client.query<TenantRow>(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.status
     FROM users u
     WHERE u.id = $1
       AND u.role = '${Role.TENANT}'
       AND (
         $2 = 'ADMIN'
         OR EXISTS (
           SELECT 1
           FROM lease_tenants lt
           JOIN leases l       ON l.id = lt.lease_id AND l.deleted_at IS NULL
           JOIN properties p   ON p.id = l.property_id AND p.deleted_at IS NULL
           WHERE lt.user_id = u.id
             AND p.created_by = $3
         )
       )`,
    [tenantId, role, actorUserId]
  );
  return r.rows[0] ?? null;
}

/**
 * Gets all leases for a tenant (with property info), respecting actor access.
 * Includes a derived is_active flag.
 */
export async function listLeasesForTenant(
  client: Queryable,
  tenantId: string,
  actorRole: string,
  actorUserId: string
): Promise<TenantLeaseRow[]> {
  const role = actorRole.trim().toUpperCase();
  const r = await client.query<TenantLeaseRow>(
    `SELECT l.id, l.property_id,
            p.street AS property_street, p.city AS property_city,
            p.state AS property_state, p.zip AS property_zip,
            l.start_date, l.end_date, l.month_to_month, l.status, l.notes, l.rent_amount,
            l.created_at, l.updated_at,
            CASE
              WHEN l.month_to_month = 1 OR l.end_date IS NULL THEN 1
              WHEN l.end_date >= CAST(GETUTCDATE() AS DATE) THEN 1
              ELSE 0
            END AS is_active,
            (SELECT STRING_AGG(CAST(lt_all.user_id AS NVARCHAR(36)), ',')
                      WITHIN GROUP (ORDER BY lt_all.user_id)
               FROM lease_tenants lt_all
              WHERE lt_all.lease_id = l.id) AS tenant_user_ids
     FROM leases l
     JOIN lease_tenants lt ON lt.lease_id = l.id AND lt.user_id = $1
     JOIN properties p ON p.id = l.property_id AND p.deleted_at IS NULL
     WHERE l.deleted_at IS NULL
       AND (
         $2 = 'ADMIN'
         OR p.created_by = $3
       )
     ORDER BY l.start_date DESC`,
    [tenantId, role, actorUserId]
  );
  return r.rows;
}

/**
 * Sets the active/disabled status for a tenant user.
 * Only updates users with role = TENANT.
 */
export async function setTenantStatus(
  client: Queryable,
  tenantId: string,
  active: boolean
): Promise<TenantRow | null> {
  const nextStatus = active ? 'ACTIVE' : 'DISABLED';
  const r = await client.query<TenantRow>(
    `UPDATE users
        SET status = $2, updated_at = GETUTCDATE()
      OUTPUT INSERTED.id, INSERTED.email, INSERTED.first_name, INSERTED.last_name,
             INSERTED.phone, INSERTED.role, INSERTED.status
      WHERE id = $1 AND role = '${Role.TENANT}'`,
    [tenantId, nextStatus]
  );
  return r.rows[0] ?? null;
}

/** True if the tenant is still linked to at least one non-deleted lease. */
export async function tenantHasAnyNonDeletedLease(
  client: Queryable,
  tenantUserId: string
): Promise<boolean> {
  const r = await client.query<{ n: number }>(
    `SELECT COUNT(*) AS n
     FROM lease_tenants lt
     INNER JOIN leases l ON l.id = lt.lease_id AND l.deleted_at IS NULL
     WHERE lt.user_id = $1`,
    [tenantUserId]
  );
  return Number(r.rows[0]?.n ?? 0) > 0;
}

/**
 * How many distinct property owners (`properties.created_by`) this tenant has non-deleted leases with.
 */
export async function countDistinctLandlordsForTenant(
  client: Queryable,
  tenantUserId: string
): Promise<number> {
  const r = await client.query<{ n: number }>(
    `SELECT COUNT(DISTINCT p.created_by) AS n
     FROM lease_tenants lt
     INNER JOIN leases l ON l.id = lt.lease_id AND l.deleted_at IS NULL
     INNER JOIN properties p ON p.id = l.property_id AND p.deleted_at IS NULL
     WHERE lt.user_id = $1`,
    [tenantUserId]
  );
  return Number(r.rows[0]?.n ?? 0);
}

/** Tenant user row by id (no landlord access filter). For responses after scoped lease changes. */
export async function getTenantUserById(
  client: Queryable,
  tenantId: string
): Promise<TenantRow | null> {
  const r = await client.query<TenantRow>(
    `SELECT id, email, first_name, last_name, phone, role, status
     FROM users
     WHERE id = $1 AND role = '${Role.TENANT}'`,
    [tenantId]
  );
  return r.rows[0] ?? null;
}

/**
 * Updates editable tenant profile fields.
 * Only updates users with role = TENANT.
 */
export async function updateTenantProfile(
  client: Queryable,
  tenantId: string,
  profile: {
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
  }
): Promise<TenantRow | null> {
  const normalizedEmail = normalizeEmail(profile.email);
  const firstName = normalizeNamePart(profile.firstName);
  const lastName = normalizeNamePart(profile.lastName);
  const phone = normalizePhone(profile.phone);
  const r = await client.query<TenantRow>(
    `UPDATE users
        SET email = $2,
            first_name = $3,
            last_name = $4,
            phone = $5,
            updated_at = GETUTCDATE()
      OUTPUT INSERTED.id, INSERTED.email, INSERTED.first_name, INSERTED.last_name,
             INSERTED.phone, INSERTED.role, INSERTED.status
      WHERE id = $1
        AND role = '${Role.TENANT}'`,
    [tenantId, normalizedEmail, firstName, lastName, phone]
  );
  return r.rows[0] ?? null;
}

/**
 * Returns the tenant's currently active lease, if any.
 */
export async function getActiveLeaseForTenant(
  client: Queryable,
  tenantId: string
): Promise<ActiveTenantLeaseRow | null> {
  const r = await client.query<ActiveTenantLeaseRow>(
    `SELECT TOP 1 l.id, l.property_id, l.start_date, l.end_date, l.month_to_month
     FROM leases l
     JOIN lease_tenants lt ON lt.lease_id = l.id
     WHERE lt.user_id = $1
       AND l.deleted_at IS NULL
       AND (
         l.month_to_month = 1
         OR l.end_date IS NULL
         OR l.end_date >= CAST(GETUTCDATE() AS DATE)
       )
     ORDER BY l.start_date DESC, l.created_at DESC`,
    [tenantId]
  );
  return r.rows[0] ?? null;
}

/**
 * Leases for this tenant that are not strictly ended in the past (fixed-term with end_date before today).
 * Month-to-month and open-ended leases stay included. Used when admin reassigns the tenant to a property
 * under another landlord: these leases get `property_id` updated; calendar-expired leases stay on the prior property.
 */
export async function listLeasesEligibleForTenantPropertyMove(
  client: Queryable,
  tenantId: string
): Promise<TenantLeaseMoveCandidateRow[]> {
  const r = await client.query<TenantLeaseMoveCandidateRow>(
    `SELECT l.id, l.property_id, l.start_date, l.end_date, l.month_to_month
     FROM leases l
     INNER JOIN lease_tenants lt ON lt.lease_id = l.id AND lt.user_id = $1
     WHERE l.deleted_at IS NULL
       AND NOT (
         l.month_to_month = 0
         AND l.end_date IS NOT NULL
         AND l.end_date < CAST(GETUTCDATE() AS DATE)
       )
     ORDER BY l.start_date ASC, l.created_at ASC`,
    [tenantId]
  );
  return r.rows;
}

/**
 * Reassigns a lease to a different property.
 */
export async function setLeaseProperty(
  client: Queryable,
  leaseId: string,
  propertyId: string,
  actorUserId: string
): Promise<boolean> {
  const r = await client.query(
    `UPDATE leases
        SET property_id = $2,
            updated_by = $3,
            updated_at = GETUTCDATE()
      WHERE id = $1
        AND deleted_at IS NULL`,
    [leaseId, propertyId, actorUserId]
  );
  return (r.rowCount ?? 0) > 0;
}

/**
 * Checks if a proposed lease date range overlaps any existing lease for this tenant.
 * For month-to-month (no end date), treats end_date as unbounded (year 9999).
 * Excludes a specific lease ID (useful when updating an existing lease).
 */
export async function checkLeaseOverlapForTenant(
  client: Queryable,
  tenantId: string,
  startDate: string,
  endDate: string | null,
  excludeLeaseId?: string | null
): Promise<boolean> {
  const r = await client.query<{ overlap_count: number }>(
    `SELECT COUNT(*) AS overlap_count
     FROM leases l
     JOIN lease_tenants lt ON lt.lease_id = l.id AND lt.user_id = $1
     WHERE l.deleted_at IS NULL
       AND ($4 IS NULL OR l.id <> $4)
       AND ($2 <= COALESCE(l.end_date, '9999-12-31'))
       AND (COALESCE($3, '9999-12-31') >= l.start_date)`,
    [tenantId, startDate, endDate, excludeLeaseId ?? null]
  );
  return Number(r.rows[0]?.overlap_count ?? 0) > 0;
}
