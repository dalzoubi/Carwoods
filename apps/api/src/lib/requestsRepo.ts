import type { PoolClient, QueryResult } from './db.js';
import { Role } from '../domain/constants.js';
import { profilePhotoReadUrlFromStoragePath } from './userProfilePhotoUrl.js';

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

export type RequestRow = {
  id: string;
  property_id: string;
  lease_id: string;
  landlord_user_id?: string | null;
  submitted_by_user_id: string;
  assigned_vendor_id: string | null;
  category_id: string;
  category_code: string | null;
  category_name: string | null;
  priority_id: string;
  priority_code: string | null;
  priority_name: string | null;
  current_status_id: string;
  status_code: string | null;
  status_name: string | null;
  title: string;
  description: string;
  internal_notes: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  scheduled_for: Date | null;
  scheduled_from: Date | null;
  scheduled_to: Date | null;
  vendor_contact_name: string | null;
  vendor_contact_phone: string | null;
  submitted_by_display_name: string | null;
  submitted_by_role: string | null;
  submitted_by_first_name: string | null;
  submitted_by_last_name: string | null;
  submitted_by_profile_photo_url: string | null;
  emergency_disclaimer_acknowledged: boolean;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
  closed_at: Date | null;
  deleted_at: Date | null;
};

export type RequestMessageRow = {
  id: string;
  request_id: string;
  sender_user_id: string;
  sender_display_name: string | null;
  sender_role: string | null;
  sender_first_name: string | null;
  sender_last_name: string | null;
  sender_profile_photo_url: string | null;
  body: string;
  is_internal: boolean;
  source: string;
  created_at: Date;
  updated_at: Date;
};

export type RequestAttachmentRow = {
  id: string;
  request_id: string;
  uploaded_by_user_id: string;
  uploaded_by_display_name: string | null;
  uploaded_by_role: string | null;
  uploaded_by_first_name: string | null;
  uploaded_by_last_name: string | null;
  uploaded_by_profile_photo_url: string | null;
  storage_path: string;
  original_filename: string;
  content_type: string;
  file_size_bytes: number;
  media_type: 'PHOTO' | 'VIDEO';
  created_at: Date;
};

type RequestAttachmentQueryRow = {
  id: string;
  request_id: string;
  uploaded_by_user_id: string;
  uploaded_by_display_name: string | null;
  uploaded_by_role: string | null;
  uploaded_by_first_name: string | null;
  uploaded_by_last_name: string | null;
  uploaded_by_profile_photo_storage_path: string | null;
  storage_path: string;
  original_filename: string;
  content_type: string;
  file_size_bytes: number;
  media_type: 'PHOTO' | 'VIDEO';
  created_at: Date;
};

function mapRequestAttachmentRow(row: RequestAttachmentQueryRow): RequestAttachmentRow {
  const {
    uploaded_by_profile_photo_storage_path,
    uploaded_by_first_name,
    uploaded_by_last_name,
    ...base
  } = row;
  return {
    ...base,
    uploaded_by_first_name: uploaded_by_first_name ?? null,
    uploaded_by_last_name: uploaded_by_last_name ?? null,
    uploaded_by_profile_photo_url: profilePhotoReadUrlFromStoragePath(
      uploaded_by_profile_photo_storage_path ?? null
    ),
  };
}

export type RequestLookupOption = {
  code: string;
  name: string;
};

export type TenantRequestDefaults = {
  property_id: string;
  lease_id: string;
  property_address: string | null;
  /** ISO date YYYY-MM-DD */
  lease_start_date: string | null;
  lease_end_date: string | null;
  month_to_month: boolean;
};

export type TenantLandlordContact = {
  first_name: string | null;
  last_name: string | null;
  email: string;
};

export type RequestNotificationRecipient = {
  user_id: string;
  email: string;
  phone: string | null;
  role: string;
  is_request_submitter: boolean;
  is_management: boolean;
};

export type RequestNotificationScope = {
  request_id: string;
  property_id: string | null;
};

type RequestRowQuery = Omit<RequestRow, 'submitted_by_profile_photo_url'> & {
  submitted_by_profile_photo_storage_path: string | null;
};

function mapRequestRow(row: RequestRowQuery): RequestRow {
  const { submitted_by_profile_photo_storage_path, ...base } = row;
  return {
    ...base,
    submitted_by_profile_photo_url: profilePhotoReadUrlFromStoragePath(
      submitted_by_profile_photo_storage_path
    ),
  };
}

type RequestMessageRowQuery = Omit<RequestMessageRow, 'sender_profile_photo_url'> & {
  sender_profile_photo_storage_path: string | null;
};

function mapRequestMessageRow(row: RequestMessageRowQuery): RequestMessageRow {
  const { sender_profile_photo_storage_path, ...base } = row;
  return {
    ...base,
    sender_profile_photo_url: profilePhotoReadUrlFromStoragePath(sender_profile_photo_storage_path),
  };
}

export async function findStatusIdByCode(client: Queryable, code: string): Promise<string | null> {
  const r = await client.query<{ id: string }>(
    `SELECT id
     FROM request_statuses
     WHERE UPPER(code) = UPPER($1) AND active = 1`,
    [code]
  );
  return r.rows[0]?.id ?? null;
}

export async function findPriorityIdByCode(client: Queryable, code: string): Promise<string | null> {
  const r = await client.query<{ id: string }>(
    `SELECT id
     FROM request_priorities
     WHERE UPPER(code) = UPPER($1) AND active = 1`,
    [code]
  );
  return r.rows[0]?.id ?? null;
}

export async function findSystemDefaultStatusId(client: Queryable): Promise<string | null> {
  const r = await client.query<{ id: string }>(
    `SELECT TOP 1 id
     FROM request_statuses
     WHERE system_default = 1 AND active = 1`
  );
  return r.rows[0]?.id ?? null;
}

export async function listActiveServiceCategories(
  client: Queryable
): Promise<RequestLookupOption[]> {
  const r = await client.query<RequestLookupOption>(
    `SELECT code, name
     FROM service_categories
     WHERE active = 1
     ORDER BY sort_order ASC, name ASC`
  );
  return r.rows;
}

export async function listActiveRequestPriorities(
  client: Queryable
): Promise<RequestLookupOption[]> {
  const r = await client.query<RequestLookupOption>(
    `SELECT code, name
     FROM request_priorities
     WHERE active = 1
     ORDER BY sort_order ASC, name ASC`
  );
  return r.rows;
}

export async function tenantCanSubmitForLease(
  client: Queryable,
  leaseId: string,
  tenantUserId: string
): Promise<boolean> {
  const r = await client.query<{ ok: number }>(
    `SELECT TOP 1 1 AS ok
     FROM lease_tenants lt
     JOIN leases l ON l.id = lt.lease_id
     WHERE lt.lease_id = $1
       AND lt.user_id = $2
       AND l.deleted_at IS NULL
       AND (lt.access_end_at IS NULL OR lt.access_end_at > SYSDATETIMEOFFSET())`,
    [leaseId, tenantUserId]
  );
  return r.rows.length > 0;
}

/** Confirms lease exists and `propertyId` matches the lease row. */
export async function leasePropertyMatches(
  client: Queryable,
  leaseId: string,
  propertyId: string
): Promise<boolean> {
  const r = await client.query<{ ok: number }>(
    `SELECT TOP 1 1 AS ok
     FROM leases l
     WHERE l.id = $1
       AND l.property_id = $2
       AND l.deleted_at IS NULL`,
    [leaseId, propertyId]
  );
  return r.rows.length > 0;
}

export type ManagementCreateRequestLeaseOption = TenantRequestDefaults & {
  /** Comma-separated tenant names/emails for the lease (active access only). */
  tenant_names: string | null;
  /** Lowercase UUIDs, comma-separated, for tenants with active access on this lease (portal filters). */
  tenant_user_ids: string | null;
  /** ACTIVE | UPCOMING | ENDED | TERMINATED (Document Center lease picker label). */
  lease_status: string;
  /** Populated when status is ENDED or TERMINATED — actual tenancy end (ISO date). */
  lease_ended_on: string | null;
};

/**
 * Leases a landlord (or filtered admin) may file a maintenance request against:
 * property in scope, lease active, at least one linked tenant user with active access.
 */
export async function listManagementCreateRequestLeaseOptions(
  client: Queryable,
  params: {
    actorRole: string;
    actorUserId: string;
    /** When actor is ADMIN, restrict to this landlord's properties; omit or null → no rows. */
    adminLandlordUserId: string | null | undefined;
  }
): Promise<ManagementCreateRequestLeaseOption[]> {
  const role = params.actorRole.trim().toUpperCase();
  if (role === Role.LANDLORD) {
    const r = await client.query<ManagementCreateRequestLeaseOption>(
      `SELECT
         l.id AS lease_id,
         l.property_id,
         CONCAT(p.street, ', ', p.city, ', ', p.state, ' ', p.zip) AS property_address,
         CONVERT(NVARCHAR(10), l.start_date, 23) AS lease_start_date,
         CONVERT(NVARCHAR(10), l.end_date, 23) AS lease_end_date,
         CONVERT(NVARCHAR(10), l.ended_on, 23) AS lease_ended_on,
         CAST(l.month_to_month AS BIT) AS month_to_month,
         UPPER(LTRIM(RTRIM(l.status))) AS lease_status,
         STUFF((
           SELECT ', ' + COALESCE(
             NULLIF(LTRIM(RTRIM(CONCAT(COALESCE(u2.first_name, N''), N' ', COALESCE(u2.last_name, N'')))), N''),
             u2.email
           )
           FROM lease_tenants lt2
           INNER JOIN users u2 ON u2.id = lt2.user_id AND UPPER(LTRIM(RTRIM(u2.role))) = '${Role.TENANT}'
           WHERE lt2.lease_id = l.id
             AND (lt2.access_end_at IS NULL OR lt2.access_end_at > SYSDATETIMEOFFSET())
           FOR XML PATH(''), TYPE
         ).value(N'.[1]', N'NVARCHAR(MAX)'), 1, 2, N'') AS tenant_names,
         STUFF((
           SELECT ',' + LOWER(CAST(lt3.user_id AS NVARCHAR(36)))
           FROM lease_tenants lt3
           INNER JOIN users u3 ON u3.id = lt3.user_id AND UPPER(LTRIM(RTRIM(u3.role))) = '${Role.TENANT}'
           WHERE lt3.lease_id = l.id
             AND (lt3.access_end_at IS NULL OR lt3.access_end_at > SYSDATETIMEOFFSET())
           FOR XML PATH(''), TYPE
         ).value(N'.[1]', N'NVARCHAR(MAX)'), 1, 1, N'') AS tenant_user_ids
       FROM leases l
       INNER JOIN properties p ON p.id = l.property_id AND p.deleted_at IS NULL
       WHERE l.deleted_at IS NULL
         AND p.created_by = $1
         AND EXISTS (
           SELECT 1
             FROM lease_tenants lt
             INNER JOIN users u ON u.id = lt.user_id AND UPPER(LTRIM(RTRIM(u.role))) = '${Role.TENANT}'
            WHERE lt.lease_id = l.id
              AND (lt.access_end_at IS NULL OR lt.access_end_at > SYSDATETIMEOFFSET())
         )
       ORDER BY property_address ASC, l.id ASC`,
      [params.actorUserId]
    );
    return r.rows;
  }

  if (role === Role.ADMIN) {
    const landlordId = params.adminLandlordUserId?.trim() || null;
    if (!landlordId) {
      return [];
    }
    const r = await client.query<ManagementCreateRequestLeaseOption>(
      `SELECT
         l.id AS lease_id,
         l.property_id,
         CONCAT(p.street, ', ', p.city, ', ', p.state, ' ', p.zip) AS property_address,
         CONVERT(NVARCHAR(10), l.start_date, 23) AS lease_start_date,
         CONVERT(NVARCHAR(10), l.end_date, 23) AS lease_end_date,
         CONVERT(NVARCHAR(10), l.ended_on, 23) AS lease_ended_on,
         CAST(l.month_to_month AS BIT) AS month_to_month,
         UPPER(LTRIM(RTRIM(l.status))) AS lease_status,
         STUFF((
           SELECT ', ' + COALESCE(
             NULLIF(LTRIM(RTRIM(CONCAT(COALESCE(u2.first_name, N''), N' ', COALESCE(u2.last_name, N'')))), N''),
             u2.email
           )
           FROM lease_tenants lt2
           INNER JOIN users u2 ON u2.id = lt2.user_id AND UPPER(LTRIM(RTRIM(u2.role))) = '${Role.TENANT}'
           WHERE lt2.lease_id = l.id
             AND (lt2.access_end_at IS NULL OR lt2.access_end_at > SYSDATETIMEOFFSET())
           FOR XML PATH(''), TYPE
         ).value(N'.[1]', N'NVARCHAR(MAX)'), 1, 2, N'') AS tenant_names,
         STUFF((
           SELECT ',' + LOWER(CAST(lt3.user_id AS NVARCHAR(36)))
           FROM lease_tenants lt3
           INNER JOIN users u3 ON u3.id = lt3.user_id AND UPPER(LTRIM(RTRIM(u3.role))) = '${Role.TENANT}'
           WHERE lt3.lease_id = l.id
             AND (lt3.access_end_at IS NULL OR lt3.access_end_at > SYSDATETIMEOFFSET())
           FOR XML PATH(''), TYPE
         ).value(N'.[1]', N'NVARCHAR(MAX)'), 1, 1, N'') AS tenant_user_ids
       FROM leases l
       INNER JOIN properties p ON p.id = l.property_id AND p.deleted_at IS NULL
       WHERE l.deleted_at IS NULL
         AND p.created_by = $1
         AND EXISTS (
           SELECT 1
             FROM lease_tenants lt
             INNER JOIN users u ON u.id = lt.user_id AND UPPER(LTRIM(RTRIM(u.role))) = '${Role.TENANT}'
            WHERE lt.lease_id = l.id
              AND (lt.access_end_at IS NULL OR lt.access_end_at > SYSDATETIMEOFFSET())
         )
       ORDER BY property_address ASC, l.id ASC`,
      [landlordId]
    );
    return r.rows;
  }

  return [];
}

/**
 * Whether management may create a request for this lease (tenant on lease, scope matches role).
 */
export async function managementCanCreateRequestForLease(
  client: Queryable,
  leaseId: string,
  actorRole: string,
  actorUserId: string
): Promise<boolean> {
  const role = actorRole.trim().toUpperCase();
  const r = await client.query<{ ok: number }>(
    `SELECT TOP 1 1 AS ok
     FROM leases l
     INNER JOIN properties p ON p.id = l.property_id AND p.deleted_at IS NULL
     WHERE l.id = $1
       AND l.deleted_at IS NULL
       AND EXISTS (
         SELECT 1
           FROM lease_tenants lt
           INNER JOIN users u ON u.id = lt.user_id AND UPPER(LTRIM(RTRIM(u.role))) = '${Role.TENANT}'
          WHERE lt.lease_id = l.id
            AND (lt.access_end_at IS NULL OR lt.access_end_at > SYSDATETIMEOFFSET())
       )
       AND (
         ($2 = '${Role.ADMIN}')
         OR ($2 = '${Role.LANDLORD}' AND p.created_by = $3)
       )`,
    [leaseId, role, actorUserId]
  );
  return r.rows.length > 0;
}

export async function findTenantRequestDefaults(
  client: Queryable,
  tenantUserId: string
): Promise<TenantRequestDefaults | null> {
  const r = await client.query<TenantRequestDefaults>(
    `SELECT TOP 1
        l.property_id,
        lt.lease_id,
        CONCAT(p.street, ', ', p.city, ', ', p.state, ' ', p.zip) AS property_address,
        CONVERT(NVARCHAR(10), l.start_date, 23) AS lease_start_date,
        CONVERT(NVARCHAR(10), l.end_date, 23) AS lease_end_date,
        CAST(l.month_to_month AS BIT) AS month_to_month
     FROM lease_tenants lt
     JOIN leases l ON l.id = lt.lease_id
     LEFT JOIN properties p ON p.id = l.property_id
     WHERE lt.user_id = $1
       AND l.deleted_at IS NULL
       AND (lt.access_end_at IS NULL OR lt.access_end_at > SYSDATETIMEOFFSET())
     ORDER BY
       CASE WHEN lt.access_end_at IS NULL THEN 0 ELSE 1 END,
       lt.access_start_at DESC,
       lt.created_at DESC`,
    [tenantUserId]
  );
  return r.rows[0] ?? null;
}

export async function findTenantLandlordContact(
  client: Queryable,
  tenantUserId: string
): Promise<TenantLandlordContact | null> {
  const linked = await client.query<TenantLandlordContact>(
    `SELECT TOP 1 u.first_name, u.last_name, u.email
     FROM lease_tenants lt
     JOIN leases l ON l.id = lt.lease_id
     LEFT JOIN properties p ON p.id = l.property_id
     JOIN users u
       ON u.id = COALESCE(l.updated_by, l.created_by, p.updated_by, p.created_by)
     WHERE lt.user_id = $1
       AND u.email IS NOT NULL
       AND LTRIM(RTRIM(u.email)) <> ''
       AND u.role IN ('${Role.LANDLORD}', '${Role.ADMIN}')
     ORDER BY
       CASE
         WHEN lt.access_end_at IS NULL OR lt.access_end_at > SYSDATETIMEOFFSET() THEN 0
         ELSE 1
       END,
       lt.access_start_at DESC,
       lt.created_at DESC`,
    [tenantUserId]
  );
  if (linked.rows[0]) return linked.rows[0];

  // Fallback: if the tenant has no lease linkage yet, provide a general
  // active management contact so the UI can still show actionable guidance.
  const fallback = await client.query<TenantLandlordContact>(
    `SELECT TOP 1 first_name, last_name, email
     FROM users
     WHERE role IN ('${Role.LANDLORD}', '${Role.ADMIN}')
       AND status IN ('ACTIVE', 'INVITED')
       AND email IS NOT NULL
       AND LTRIM(RTRIM(email)) <> ''
     ORDER BY
       CASE WHEN role = '${Role.LANDLORD}' THEN 0 ELSE 1 END,
       CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END,
       last_name ASC,
       first_name ASC,
       email ASC`
  );
  return fallback.rows[0] ?? null;
}

export async function listRequestsForTenant(
  client: Queryable,
  tenantUserId: string
): Promise<RequestRow[]> {
  const r = await client.query<RequestRowQuery>(
    `SELECT mr.id, mr.property_id, mr.lease_id, p.created_by AS landlord_user_id,
            mr.submitted_by_user_id, mr.assigned_vendor_id,
            mr.category_id, sc.code AS category_code, sc.name AS category_name,
            mr.priority_id, rp.code AS priority_code, rp.name AS priority_name,
            mr.current_status_id,
            rs.code AS status_code, rs.name AS status_name,
            mr.title, mr.description,
            mr.internal_notes, mr.estimated_cost, mr.actual_cost, mr.scheduled_for,
            mr.scheduled_from, mr.scheduled_to,
            mr.vendor_contact_name, mr.vendor_contact_phone,
            CASE
              WHEN LTRIM(RTRIM(ISNULL(su.first_name, '') + ' ' + ISNULL(su.last_name, ''))) = '' THEN su.email
              ELSE LTRIM(RTRIM(ISNULL(su.first_name, '') + ' ' + ISNULL(su.last_name, '')))
            END AS submitted_by_display_name,
            su.role AS submitted_by_role,
            su.first_name AS submitted_by_first_name,
            su.last_name AS submitted_by_last_name,
            su.profile_photo_storage_path AS submitted_by_profile_photo_storage_path,
            mr.emergency_disclaimer_acknowledged, mr.created_at, mr.updated_at,
            mr.completed_at, mr.closed_at, mr.deleted_at
     FROM maintenance_requests mr
     JOIN lease_tenants lt ON lt.lease_id = mr.lease_id
     LEFT JOIN properties p ON p.id = mr.property_id
     LEFT JOIN service_categories sc ON sc.id = mr.category_id
     LEFT JOIN request_priorities rp ON rp.id = mr.priority_id
     LEFT JOIN request_statuses rs ON rs.id = mr.current_status_id
     LEFT JOIN users su ON su.id = mr.submitted_by_user_id
     WHERE lt.user_id = $1
       AND mr.deleted_at IS NULL
       AND (lt.access_end_at IS NULL OR lt.access_end_at > SYSDATETIMEOFFSET())
     ORDER BY mr.updated_at DESC`,
    [tenantUserId]
  );
  return r.rows.map(mapRequestRow);
}

export async function listRequestsForManagement(client: Queryable): Promise<RequestRow[]> {
  const r = await client.query<RequestRowQuery>(
    `SELECT mr.id, mr.property_id, mr.lease_id, p.created_by AS landlord_user_id,
            mr.submitted_by_user_id, mr.assigned_vendor_id,
            mr.category_id, sc.code AS category_code, sc.name AS category_name,
            mr.priority_id, rp.code AS priority_code, rp.name AS priority_name,
            mr.current_status_id,
            rs.code AS status_code, rs.name AS status_name,
            mr.title, mr.description,
            mr.internal_notes, mr.estimated_cost, mr.actual_cost, mr.scheduled_for,
            mr.scheduled_from, mr.scheduled_to,
            mr.vendor_contact_name, mr.vendor_contact_phone,
            CASE
              WHEN LTRIM(RTRIM(ISNULL(su.first_name, '') + ' ' + ISNULL(su.last_name, ''))) = '' THEN su.email
              ELSE LTRIM(RTRIM(ISNULL(su.first_name, '') + ' ' + ISNULL(su.last_name, '')))
            END AS submitted_by_display_name,
            su.role AS submitted_by_role,
            su.first_name AS submitted_by_first_name,
            su.last_name AS submitted_by_last_name,
            su.profile_photo_storage_path AS submitted_by_profile_photo_storage_path,
            mr.emergency_disclaimer_acknowledged, mr.created_at, mr.updated_at,
            mr.completed_at, mr.closed_at, mr.deleted_at
     FROM maintenance_requests mr
     LEFT JOIN properties p ON p.id = mr.property_id
     LEFT JOIN service_categories sc ON sc.id = mr.category_id
     LEFT JOIN request_priorities rp ON rp.id = mr.priority_id
     LEFT JOIN request_statuses rs ON rs.id = mr.current_status_id
     LEFT JOIN users su ON su.id = mr.submitted_by_user_id
     WHERE mr.deleted_at IS NULL
     ORDER BY mr.updated_at DESC`
  );
  return r.rows.map(mapRequestRow);
}

/** Landlord dashboard: requests whose property was created by this landlord user. */
export async function listRequestsForLandlord(
  client: Queryable,
  landlordUserId: string
): Promise<RequestRow[]> {
  const r = await client.query<RequestRowQuery>(
    `SELECT mr.id, mr.property_id, mr.lease_id, p.created_by AS landlord_user_id,
            mr.submitted_by_user_id, mr.assigned_vendor_id,
            mr.category_id, sc.code AS category_code, sc.name AS category_name,
            mr.priority_id, rp.code AS priority_code, rp.name AS priority_name,
            mr.current_status_id,
            rs.code AS status_code, rs.name AS status_name,
            mr.title, mr.description,
            mr.internal_notes, mr.estimated_cost, mr.actual_cost, mr.scheduled_for,
            mr.scheduled_from, mr.scheduled_to,
            mr.vendor_contact_name, mr.vendor_contact_phone,
            CASE
              WHEN LTRIM(RTRIM(ISNULL(su.first_name, '') + ' ' + ISNULL(su.last_name, ''))) = '' THEN su.email
              ELSE LTRIM(RTRIM(ISNULL(su.first_name, '') + ' ' + ISNULL(su.last_name, '')))
            END AS submitted_by_display_name,
            su.role AS submitted_by_role,
            su.first_name AS submitted_by_first_name,
            su.last_name AS submitted_by_last_name,
            su.profile_photo_storage_path AS submitted_by_profile_photo_storage_path,
            mr.emergency_disclaimer_acknowledged, mr.created_at, mr.updated_at,
            mr.completed_at, mr.closed_at, mr.deleted_at
     FROM maintenance_requests mr
     INNER JOIN properties p ON p.id = mr.property_id AND p.created_by = $1
     LEFT JOIN service_categories sc ON sc.id = mr.category_id
     LEFT JOIN request_priorities rp ON rp.id = mr.priority_id
     LEFT JOIN request_statuses rs ON rs.id = mr.current_status_id
     LEFT JOIN users su ON su.id = mr.submitted_by_user_id
     WHERE mr.deleted_at IS NULL
     ORDER BY mr.updated_at DESC`,
    [landlordUserId]
  );
  return r.rows.map(mapRequestRow);
}

export async function getRequestById(client: Queryable, id: string): Promise<RequestRow | null> {
  const r = await client.query<RequestRowQuery>(
    `SELECT mr.id, mr.property_id, mr.lease_id, mr.submitted_by_user_id, mr.assigned_vendor_id,
            mr.category_id, sc.code AS category_code, sc.name AS category_name,
            mr.priority_id, rp.code AS priority_code, rp.name AS priority_name,
            mr.current_status_id,
            rs.code AS status_code, rs.name AS status_name,
            mr.title, mr.description,
            mr.internal_notes, mr.estimated_cost, mr.actual_cost, mr.scheduled_for,
            mr.scheduled_from, mr.scheduled_to,
            mr.vendor_contact_name, mr.vendor_contact_phone,
            CASE
              WHEN LTRIM(RTRIM(ISNULL(su.first_name, '') + ' ' + ISNULL(su.last_name, ''))) = '' THEN su.email
              ELSE LTRIM(RTRIM(ISNULL(su.first_name, '') + ' ' + ISNULL(su.last_name, '')))
            END AS submitted_by_display_name,
            su.role AS submitted_by_role,
            su.first_name AS submitted_by_first_name,
            su.last_name AS submitted_by_last_name,
            su.profile_photo_storage_path AS submitted_by_profile_photo_storage_path,
            mr.emergency_disclaimer_acknowledged, mr.created_at, mr.updated_at,
            mr.completed_at, mr.closed_at, mr.deleted_at
     FROM maintenance_requests mr
     LEFT JOIN service_categories sc ON sc.id = mr.category_id
     LEFT JOIN request_priorities rp ON rp.id = mr.priority_id
     LEFT JOIN request_statuses rs ON rs.id = mr.current_status_id
     LEFT JOIN users su ON su.id = mr.submitted_by_user_id
     WHERE mr.id = $1 AND mr.deleted_at IS NULL`,
    [id]
  );
  const row = r.rows[0];
  return row ? mapRequestRow(row) : null;
}

/**
 * Counts "open" maintenance requests the actor should see in their inbox.
 * Open = status is not COMPLETE / CANCELLED.
 * TENANT → requests on leases they're on. LANDLORD → requests on their properties.
 * ADMIN → all.
 */
export async function countOpenRequestsForActor(
  client: Queryable,
  actorRole: string,
  actorUserId: string
): Promise<number> {
  const role = actorRole.trim().toUpperCase();
  const r = await client.query<{ cnt: number }>(
    `SELECT COUNT(DISTINCT mr.id) AS cnt
     FROM maintenance_requests mr
     LEFT JOIN request_statuses rs ON rs.id = mr.current_status_id
     LEFT JOIN properties p ON p.id = mr.property_id
     LEFT JOIN lease_tenants lt
       ON lt.lease_id = mr.lease_id
      AND lt.user_id = $2
      AND (lt.access_end_at IS NULL OR lt.access_end_at > SYSDATETIMEOFFSET())
     WHERE mr.deleted_at IS NULL
       AND (rs.code IS NULL OR rs.code NOT IN ('COMPLETE', 'CANCELLED'))
       AND (
         $1 = 'ADMIN'
         OR ($1 = 'LANDLORD' AND p.created_by = $2)
         OR ($1 = 'TENANT' AND lt.user_id IS NOT NULL)
       )`,
    [role, actorUserId]
  );
  return Number(r.rows[0]?.cnt ?? 0);
}

export async function tenantCanAccessRequest(
  client: Queryable,
  requestId: string,
  tenantUserId: string
): Promise<boolean> {
  const r = await client.query<{ ok: number }>(
    `SELECT TOP 1 1 AS ok
     FROM maintenance_requests mr
     JOIN lease_tenants lt ON lt.lease_id = mr.lease_id
     WHERE mr.id = $1
       AND mr.deleted_at IS NULL
       AND lt.user_id = $2
       AND (lt.access_end_at IS NULL OR lt.access_end_at > SYSDATETIMEOFFSET())`,
    [requestId, tenantUserId]
  );
  return r.rows.length > 0;
}

/** Property manager (landlord) scope: request's property was created by this landlord user. */
export async function landlordOwnsRequestProperty(
  client: Queryable,
  requestId: string,
  landlordUserId: string
): Promise<boolean> {
  const r = await client.query<{ ok: number }>(
    `SELECT TOP 1 1 AS ok
     FROM maintenance_requests mr
     INNER JOIN properties p ON p.id = mr.property_id
     WHERE mr.id = $1
       AND mr.deleted_at IS NULL
       AND p.created_by = $2`,
    [requestId, landlordUserId]
  );
  return r.rows.length > 0;
}

/**
 * Whether a landlord or admin may access a maintenance request in management APIs.
 * Admins may access any non-deleted request; landlords only their properties.
 */
export async function managementCanAccessRequest(
  client: Queryable,
  requestId: string,
  actorRole: string,
  actorUserId: string
): Promise<boolean> {
  const r = actorRole.trim().toUpperCase();
  if (r === Role.ADMIN) {
    const exists = await client.query<{ ok: number }>(
      `SELECT TOP 1 1 AS ok
       FROM maintenance_requests
       WHERE id = $1 AND deleted_at IS NULL`,
      [requestId]
    );
    return exists.rows.length > 0;
  }
  if (r === Role.LANDLORD) {
    return landlordOwnsRequestProperty(client, requestId, actorUserId);
  }
  return false;
}

export async function insertMaintenanceRequest(
  client: PoolClient,
  params: {
    propertyId: string;
    leaseId: string;
    submittedByUserId: string;
    categoryId: string;
    priorityId: string;
    currentStatusId: string;
    title: string;
    description: string;
    emergencyAcknowledged: boolean;
  }
): Promise<RequestRow> {
  const r = await client.query<RequestRowQuery>(
    `INSERT INTO maintenance_requests (
       id, property_id, lease_id, submitted_by_user_id, category_id, priority_id, current_status_id,
       title, description, emergency_disclaimer_acknowledged
     )
     OUTPUT INSERTED.id, INSERTED.property_id, INSERTED.lease_id, INSERTED.submitted_by_user_id,
            INSERTED.assigned_vendor_id, INSERTED.category_id, NULL AS category_code, NULL AS category_name,
            INSERTED.priority_id, NULL AS priority_code, NULL AS priority_name,
            INSERTED.current_status_id, NULL AS status_code, NULL AS status_name,
            INSERTED.title, INSERTED.description,
            INSERTED.internal_notes, INSERTED.estimated_cost, INSERTED.actual_cost,
            INSERTED.scheduled_for, INSERTED.scheduled_from, INSERTED.scheduled_to,
            INSERTED.vendor_contact_name, INSERTED.vendor_contact_phone,
            INSERTED.emergency_disclaimer_acknowledged,
            NULL AS submitted_by_display_name, NULL AS submitted_by_role,
            NULL AS submitted_by_first_name, NULL AS submitted_by_last_name,
            NULL AS submitted_by_profile_photo_storage_path,
            INSERTED.created_at, INSERTED.updated_at, INSERTED.completed_at, INSERTED.closed_at,
            INSERTED.deleted_at
     VALUES (NEWID(), $1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      params.propertyId,
      params.leaseId,
      params.submittedByUserId,
      params.categoryId,
      params.priorityId,
      params.currentStatusId,
      params.title,
      params.description,
      params.emergencyAcknowledged ? 1 : 0,
    ]
  );
  return mapRequestRow(r.rows[0]!);
}

export async function updateRequestManagementFields(
  client: PoolClient,
  requestId: string,
  patch: {
    currentStatusId?: string;
    priorityId?: string;
    assignedVendorId?: string | null;
    scheduledFor?: Date | null;
    scheduledFrom?: Date | null;
    scheduledTo?: Date | null;
    vendorContactName?: string | null;
    vendorContactPhone?: string | null;
    internalNotes?: string | null;
  }
): Promise<RequestRow | null> {
  const cur = await getRequestById(client, requestId);
  if (!cur) return null;
  const currentStatusId = patch.currentStatusId ?? cur.current_status_id;
  const priorityId = patch.priorityId ?? cur.priority_id;
  const assignedVendorId =
    patch.assignedVendorId !== undefined ? patch.assignedVendorId : cur.assigned_vendor_id;
  const scheduledFor = patch.scheduledFor !== undefined ? patch.scheduledFor : cur.scheduled_for;
  const scheduledFrom = patch.scheduledFrom !== undefined ? patch.scheduledFrom : cur.scheduled_from;
  const scheduledTo = patch.scheduledTo !== undefined ? patch.scheduledTo : cur.scheduled_to;
  const vendorContactName =
    patch.vendorContactName !== undefined ? patch.vendorContactName : cur.vendor_contact_name;
  const vendorContactPhone =
    patch.vendorContactPhone !== undefined ? patch.vendorContactPhone : cur.vendor_contact_phone;
  const internalNotes =
    patch.internalNotes !== undefined ? patch.internalNotes : cur.internal_notes;

  const r = await client.query<RequestRowQuery>(
    `UPDATE maintenance_requests
       SET current_status_id = $2,
           priority_id = $3,
           assigned_vendor_id = $4,
           scheduled_for = $5,
           scheduled_from = $6,
           scheduled_to = $7,
           vendor_contact_name = $8,
           vendor_contact_phone = $9,
           internal_notes = $10,
           updated_at = SYSDATETIMEOFFSET()
     OUTPUT INSERTED.id, INSERTED.property_id, INSERTED.lease_id, INSERTED.submitted_by_user_id,
            INSERTED.assigned_vendor_id, INSERTED.category_id, NULL AS category_code, NULL AS category_name,
            INSERTED.priority_id, NULL AS priority_code, NULL AS priority_name,
            INSERTED.current_status_id, NULL AS status_code, NULL AS status_name,
            INSERTED.title, INSERTED.description,
            INSERTED.internal_notes, INSERTED.estimated_cost, INSERTED.actual_cost,
            INSERTED.scheduled_for, INSERTED.scheduled_from, INSERTED.scheduled_to,
            INSERTED.vendor_contact_name, INSERTED.vendor_contact_phone,
            INSERTED.emergency_disclaimer_acknowledged,
            NULL AS submitted_by_display_name, NULL AS submitted_by_role,
            NULL AS submitted_by_first_name, NULL AS submitted_by_last_name,
            NULL AS submitted_by_profile_photo_storage_path,
            INSERTED.created_at, INSERTED.updated_at, INSERTED.completed_at, INSERTED.closed_at,
            INSERTED.deleted_at
     WHERE id = $1 AND deleted_at IS NULL`,
    [
      requestId,
      currentStatusId,
      priorityId,
      assignedVendorId,
      scheduledFor,
      scheduledFrom,
      scheduledTo,
      vendorContactName,
      vendorContactPhone,
      internalNotes,
    ]
  );
  const row = r.rows[0];
  return row ? mapRequestRow(row) : null;
}

export async function insertRequestStatusHistory(
  client: PoolClient,
  params: {
    requestId: string;
    fromStatusId: string | null;
    toStatusId: string;
    changedByUserId: string;
    note: string | null;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO request_status_history (
       id, request_id, from_status_id, to_status_id, changed_by_user_id, note
     )
     VALUES (NEWID(), $1, $2, $3, $4, $5)`,
    [
      params.requestId,
      params.fromStatusId,
      params.toStatusId,
      params.changedByUserId,
      params.note,
    ]
  );
}

export async function insertRequestMessage(
  client: PoolClient,
  params: {
    requestId: string;
    senderUserId: string;
    body: string;
    isInternal: boolean;
    source?: string;
  }
): Promise<RequestMessageRow> {
  const r = await client.query<{ id: string }>(
    `INSERT INTO request_messages (
       id, request_id, sender_user_id, body, is_internal, source
     )
     OUTPUT INSERTED.id
     VALUES (NEWID(), $1, $2, $3, $4, $5)`,
    [
      params.requestId,
      params.senderUserId,
      params.body,
      params.isInternal ? 1 : 0,
      params.source ?? 'PORTAL',
    ]
  );
  const id = r.rows[0]?.id;
  if (!id) {
    throw new Error('insert_request_message_failed');
  }
  const full = await getRequestMessageById(client, params.requestId, id);
  if (!full) {
    throw new Error('insert_request_message_load_failed');
  }
  return full;
}

export async function listRequestMessages(
  client: Queryable,
  requestId: string,
  includeInternal: boolean
): Promise<RequestMessageRow[]> {
  const r = await client.query<RequestMessageRowQuery>(
    `SELECT rm.id, rm.request_id, rm.sender_user_id,
            CASE
              WHEN LTRIM(RTRIM(ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, ''))) = '' THEN u.email
              ELSE LTRIM(RTRIM(ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '')))
            END AS sender_display_name,
            u.role AS sender_role,
            u.first_name AS sender_first_name,
            u.last_name AS sender_last_name,
            u.profile_photo_storage_path AS sender_profile_photo_storage_path,
            rm.body, rm.is_internal, rm.source, rm.created_at, rm.updated_at
     FROM request_messages rm
     LEFT JOIN users u ON u.id = rm.sender_user_id
     WHERE rm.request_id = $1
       AND ($2 = 1 OR rm.is_internal = 0)
     ORDER BY rm.created_at ASC`,
    [requestId, includeInternal ? 1 : 0]
  );
  return r.rows.map(mapRequestMessageRow);
}

export async function getRequestMessageById(
  client: Queryable,
  requestId: string,
  messageId: string
): Promise<RequestMessageRow | null> {
  const r = await client.query<RequestMessageRowQuery>(
    `SELECT TOP 1 rm.id, rm.request_id, rm.sender_user_id,
            CASE
              WHEN LTRIM(RTRIM(ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, ''))) = '' THEN u.email
              ELSE LTRIM(RTRIM(ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '')))
            END AS sender_display_name,
            u.role AS sender_role,
            u.first_name AS sender_first_name,
            u.last_name AS sender_last_name,
            u.profile_photo_storage_path AS sender_profile_photo_storage_path,
            rm.body, rm.is_internal, rm.source, rm.created_at, rm.updated_at
     FROM request_messages rm
     LEFT JOIN users u ON u.id = rm.sender_user_id
     WHERE rm.request_id = $1
       AND rm.id = $2`,
    [requestId, messageId]
  );
  const row = r.rows[0];
  return row ? mapRequestMessageRow(row) : null;
}

export async function isMessageReferencedByElsaDecision(
  client: Queryable,
  messageId: string
): Promise<boolean> {
  const r = await client.query<{ ok: number }>(
    `SELECT TOP 1 1 AS ok
     FROM elsa_decisions
     WHERE sent_message_id = $1
       AND ISNULL(review_status, '') <> 'DISMISSED'`,
    [messageId]
  );
  return r.rows.length > 0;
}

export async function clearElsaDecisionMessageReference(
  client: Queryable,
  messageId: string
): Promise<void> {
  await client.query(
    `UPDATE elsa_decisions
     SET sent_message_id = NULL
     WHERE sent_message_id = $1`,
    [messageId]
  );
}

export async function deleteRequestMessageById(
  client: PoolClient,
  requestId: string,
  messageId: string
): Promise<RequestMessageRow | null> {
  const r = await client.query<RequestMessageRowQuery>(
    `DELETE FROM request_messages
     OUTPUT DELETED.id, DELETED.request_id, DELETED.sender_user_id,
            NULL AS sender_display_name, NULL AS sender_role,
            NULL AS sender_first_name, NULL AS sender_last_name,
            NULL AS sender_profile_photo_storage_path,
            DELETED.body, DELETED.is_internal, DELETED.source, DELETED.created_at, DELETED.updated_at
     WHERE request_id = $1
       AND id = $2`,
    [requestId, messageId]
  );
  const row = r.rows[0];
  return row ? mapRequestMessageRow(row) : null;
}

export async function countRequestAttachments(
  client: Queryable,
  requestId: string
): Promise<number> {
  const r = await client.query<{ count_value: number }>(
    `SELECT COUNT(*) AS count_value
     FROM request_attachments
     WHERE request_id = $1`,
    [requestId]
  );
  return Number(r.rows[0]?.count_value ?? 0);
}

export async function insertRequestAttachment(
  client: PoolClient,
  params: {
    requestId: string;
    uploadedByUserId: string;
    storagePath: string;
    originalFilename: string;
    contentType: string;
    fileSizeBytes: number;
    mediaType: 'PHOTO' | 'VIDEO';
  }
): Promise<RequestAttachmentRow> {
  const r = await client.query<RequestAttachmentQueryRow>(
    `INSERT INTO request_attachments (
       id, request_id, uploaded_by_user_id, storage_path, original_filename,
       content_type, file_size_bytes, media_type
     )
     OUTPUT INSERTED.id, INSERTED.request_id, INSERTED.uploaded_by_user_id,
            NULL AS uploaded_by_display_name, NULL AS uploaded_by_role,
            NULL AS uploaded_by_first_name, NULL AS uploaded_by_last_name,
            NULL AS uploaded_by_profile_photo_storage_path,
            INSERTED.storage_path, INSERTED.original_filename, INSERTED.content_type,
            INSERTED.file_size_bytes, INSERTED.media_type, INSERTED.created_at
     VALUES (NEWID(), $1, $2, $3, $4, $5, $6, $7)`,
    [
      params.requestId,
      params.uploadedByUserId,
      params.storagePath,
      params.originalFilename,
      params.contentType,
      params.fileSizeBytes,
      params.mediaType,
    ]
  );
  return mapRequestAttachmentRow(r.rows[0]!);
}

export async function listRequestAttachments(
  client: Queryable,
  requestId: string
): Promise<RequestAttachmentRow[]> {
  const r = await client.query<RequestAttachmentQueryRow>(
    `SELECT ra.id, ra.request_id, ra.uploaded_by_user_id,
            CASE
              WHEN LTRIM(RTRIM(ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, ''))) = '' THEN u.email
              ELSE LTRIM(RTRIM(ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '')))
            END AS uploaded_by_display_name,
            u.role AS uploaded_by_role,
            u.first_name AS uploaded_by_first_name,
            u.last_name AS uploaded_by_last_name,
            u.profile_photo_storage_path AS uploaded_by_profile_photo_storage_path,
            ra.storage_path, ra.original_filename, ra.content_type, ra.file_size_bytes,
            ra.media_type, ra.created_at
     FROM request_attachments ra
     LEFT JOIN users u ON u.id = ra.uploaded_by_user_id
     WHERE request_id = $1
     ORDER BY created_at ASC`,
    [requestId]
  );
  return r.rows.map(mapRequestAttachmentRow);
}

export async function getRequestAttachmentById(
  client: Queryable,
  requestId: string,
  attachmentId: string
): Promise<RequestAttachmentRow | null> {
  const r = await client.query<RequestAttachmentQueryRow>(
    `SELECT TOP 1 ra.id, ra.request_id, ra.uploaded_by_user_id,
            CASE
              WHEN LTRIM(RTRIM(ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, ''))) = '' THEN u.email
              ELSE LTRIM(RTRIM(ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '')))
            END AS uploaded_by_display_name,
            u.role AS uploaded_by_role,
            u.first_name AS uploaded_by_first_name,
            u.last_name AS uploaded_by_last_name,
            u.profile_photo_storage_path AS uploaded_by_profile_photo_storage_path,
            ra.storage_path, ra.original_filename, ra.content_type, ra.file_size_bytes,
            ra.media_type, ra.created_at
     FROM request_attachments ra
     LEFT JOIN users u ON u.id = ra.uploaded_by_user_id
     WHERE ra.request_id = $1
       AND ra.id = $2`,
    [requestId, attachmentId]
  );
  const row = r.rows[0];
  return row ? mapRequestAttachmentRow(row) : null;
}

export async function deleteRequestAttachmentById(
  client: PoolClient,
  requestId: string,
  attachmentId: string
): Promise<RequestAttachmentRow | null> {
  const r = await client.query<RequestAttachmentQueryRow>(
    `DELETE FROM request_attachments
     OUTPUT DELETED.id, DELETED.request_id, DELETED.uploaded_by_user_id,
            NULL AS uploaded_by_display_name, NULL AS uploaded_by_role,
            NULL AS uploaded_by_first_name, NULL AS uploaded_by_last_name,
            NULL AS uploaded_by_profile_photo_storage_path,
            DELETED.storage_path, DELETED.original_filename, DELETED.content_type,
            DELETED.file_size_bytes, DELETED.media_type, DELETED.created_at
     WHERE request_id = $1
       AND id = $2`,
    [requestId, attachmentId]
  );
  const row = r.rows[0];
  return row ? mapRequestAttachmentRow(row) : null;
}

export async function listRequestNotificationRecipients(
  client: Queryable,
  requestId: string
): Promise<RequestNotificationRecipient[]> {
  const r = await client.query<RequestNotificationRecipient>(
    `SELECT DISTINCT
        u.id AS user_id,
        u.email,
        u.phone,
        u.role,
        CASE WHEN u.id = mr.submitted_by_user_id THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS is_request_submitter,
        CASE
          WHEN UPPER(u.role) IN ('${Role.ADMIN}', '${Role.LANDLORD}', '${Role.AI_AGENT}')
            THEN CAST(1 AS BIT)
          ELSE CAST(0 AS BIT)
        END AS is_management
     FROM maintenance_requests mr
     JOIN users tenant ON tenant.id = mr.submitted_by_user_id
     LEFT JOIN properties p ON p.id = mr.property_id
     LEFT JOIN users owner_u ON owner_u.id = p.created_by
     JOIN users u ON u.id IN (
        mr.submitted_by_user_id,
        ISNULL(owner_u.id, mr.submitted_by_user_id)
     )
     WHERE mr.id = $1
       AND mr.deleted_at IS NULL

     UNION

     SELECT
        admin_u.id AS user_id,
        admin_u.email,
        admin_u.phone,
        admin_u.role,
        CAST(0 AS BIT) AS is_request_submitter,
        CAST(1 AS BIT) AS is_management
     FROM users admin_u
     WHERE UPPER(admin_u.role) = '${Role.ADMIN}'
       AND UPPER(admin_u.status) IN ('ACTIVE', 'INVITED')
       AND EXISTS (
         SELECT 1
         FROM maintenance_requests mr_exists
         WHERE mr_exists.id = $1
           AND mr_exists.deleted_at IS NULL
       )`,
    [requestId]
  );
  return r.rows;
}

export async function getRequestNotificationScope(
  client: Queryable,
  requestId: string
): Promise<RequestNotificationScope | null> {
  const r = await client.query<RequestNotificationScope>(
    `SELECT TOP 1 id AS request_id, property_id
     FROM maintenance_requests
     WHERE id = $1
       AND deleted_at IS NULL`,
    [requestId]
  );
  return r.rows[0] ?? null;
}

export async function getRequestMessageSnippetById(
  client: Queryable,
  messageId: string
): Promise<{ body: string; request_id: string } | null> {
  const r = await client.query<{ body: string; request_id: string }>(
    `SELECT TOP 1 body, request_id
     FROM request_messages
     WHERE id = $1`,
    [messageId]
  );
  return r.rows[0] ?? null;
}

export async function getPriorityIdByCode(
  client: Queryable,
  code: string
): Promise<string | null> {
  const r = await client.query<{ id: string }>(
    `SELECT TOP 1 id
     FROM request_priorities
     WHERE LOWER(code) = LOWER($1)
       AND active = 1`,
    [code]
  );
  return r.rows[0]?.id ?? null;
}

