import type { PoolClient, QueryResult } from './db.js';
import { Role } from '../domain/constants.js';

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

export type RequestRow = {
  id: string;
  property_id: string;
  lease_id: string;
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
  vendor_contact_email: string | null;
  vendor_contact_phone: string | null;
  submitted_by_display_name: string | null;
  submitted_by_role: string | null;
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
  storage_path: string;
  original_filename: string;
  content_type: string;
  file_size_bytes: number;
  media_type: 'PHOTO' | 'VIDEO' | 'FILE';
  created_at: Date;
};

export type RequestLookupOption = {
  code: string;
  name: string;
};

export type TenantRequestDefaults = {
  property_id: string;
  lease_id: string;
  property_address: string | null;
  lease_end_date: string | null;
  month_to_month: boolean;
};

export type TenantLandlordContact = {
  first_name: string | null;
  last_name: string | null;
  email: string;
};

export async function findStatusIdByCode(client: Queryable, code: string): Promise<string | null> {
  const r = await client.query<{ id: string }>(
    `SELECT id
     FROM request_statuses
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

export async function findTenantRequestDefaults(
  client: Queryable,
  tenantUserId: string
): Promise<TenantRequestDefaults | null> {
  const r = await client.query<TenantRequestDefaults>(
    `SELECT TOP 1
        l.property_id,
        lt.lease_id,
        CONCAT(p.street, ', ', p.city, ', ', p.state, ' ', p.zip) AS property_address,
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
  const r = await client.query<RequestRow>(
    `SELECT mr.id, mr.property_id, mr.lease_id, mr.submitted_by_user_id, mr.assigned_vendor_id,
            mr.category_id, sc.code AS category_code, sc.name AS category_name,
            mr.priority_id, rp.code AS priority_code, rp.name AS priority_name,
            mr.current_status_id,
            rs.code AS status_code, rs.name AS status_name,
            mr.title, mr.description,
            mr.internal_notes, mr.estimated_cost, mr.actual_cost, mr.scheduled_for,
            mr.scheduled_from, mr.scheduled_to,
            mr.vendor_contact_name, mr.vendor_contact_email, mr.vendor_contact_phone,
            CASE
              WHEN LTRIM(RTRIM(ISNULL(su.first_name, '') + ' ' + ISNULL(su.last_name, ''))) = '' THEN su.email
              ELSE LTRIM(RTRIM(ISNULL(su.first_name, '') + ' ' + ISNULL(su.last_name, '')))
            END AS submitted_by_display_name,
            su.role AS submitted_by_role,
            mr.emergency_disclaimer_acknowledged, mr.created_at, mr.updated_at,
            mr.completed_at, mr.closed_at, mr.deleted_at
     FROM maintenance_requests mr
     JOIN lease_tenants lt ON lt.lease_id = mr.lease_id
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
  return r.rows;
}

export async function listRequestsForManagement(client: Queryable): Promise<RequestRow[]> {
  const r = await client.query<RequestRow>(
    `SELECT mr.id, mr.property_id, mr.lease_id, mr.submitted_by_user_id, mr.assigned_vendor_id,
            mr.category_id, sc.code AS category_code, sc.name AS category_name,
            mr.priority_id, rp.code AS priority_code, rp.name AS priority_name,
            mr.current_status_id,
            rs.code AS status_code, rs.name AS status_name,
            mr.title, mr.description,
            mr.internal_notes, mr.estimated_cost, mr.actual_cost, mr.scheduled_for,
            mr.scheduled_from, mr.scheduled_to,
            mr.vendor_contact_name, mr.vendor_contact_email, mr.vendor_contact_phone,
            CASE
              WHEN LTRIM(RTRIM(ISNULL(su.first_name, '') + ' ' + ISNULL(su.last_name, ''))) = '' THEN su.email
              ELSE LTRIM(RTRIM(ISNULL(su.first_name, '') + ' ' + ISNULL(su.last_name, '')))
            END AS submitted_by_display_name,
            su.role AS submitted_by_role,
            mr.emergency_disclaimer_acknowledged, mr.created_at, mr.updated_at,
            mr.completed_at, mr.closed_at, mr.deleted_at
     FROM maintenance_requests mr
     LEFT JOIN service_categories sc ON sc.id = mr.category_id
     LEFT JOIN request_priorities rp ON rp.id = mr.priority_id
     LEFT JOIN request_statuses rs ON rs.id = mr.current_status_id
     LEFT JOIN users su ON su.id = mr.submitted_by_user_id
     WHERE mr.deleted_at IS NULL
     ORDER BY mr.updated_at DESC`
  );
  return r.rows;
}

export async function getRequestById(client: Queryable, id: string): Promise<RequestRow | null> {
  const r = await client.query<RequestRow>(
    `SELECT mr.id, mr.property_id, mr.lease_id, mr.submitted_by_user_id, mr.assigned_vendor_id,
            mr.category_id, sc.code AS category_code, sc.name AS category_name,
            mr.priority_id, rp.code AS priority_code, rp.name AS priority_name,
            mr.current_status_id,
            rs.code AS status_code, rs.name AS status_name,
            mr.title, mr.description,
            mr.internal_notes, mr.estimated_cost, mr.actual_cost, mr.scheduled_for,
            mr.scheduled_from, mr.scheduled_to,
            mr.vendor_contact_name, mr.vendor_contact_email, mr.vendor_contact_phone,
            CASE
              WHEN LTRIM(RTRIM(ISNULL(su.first_name, '') + ' ' + ISNULL(su.last_name, ''))) = '' THEN su.email
              ELSE LTRIM(RTRIM(ISNULL(su.first_name, '') + ' ' + ISNULL(su.last_name, '')))
            END AS submitted_by_display_name,
            su.role AS submitted_by_role,
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
  return r.rows[0] ?? null;
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
  const r = await client.query<RequestRow>(
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
            INSERTED.vendor_contact_name, INSERTED.vendor_contact_email,
            INSERTED.vendor_contact_phone, INSERTED.emergency_disclaimer_acknowledged,
            NULL AS submitted_by_display_name, NULL AS submitted_by_role,
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
  return r.rows[0]!;
}

export async function updateRequestManagementFields(
  client: PoolClient,
  requestId: string,
  patch: {
    currentStatusId?: string;
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

  const r = await client.query<RequestRow>(
    `UPDATE maintenance_requests
       SET current_status_id = $2,
           assigned_vendor_id = $3,
           scheduled_for = $4,
           scheduled_from = $5,
           scheduled_to = $6,
           vendor_contact_name = $7,
           vendor_contact_phone = $8,
           internal_notes = $9,
           updated_at = SYSDATETIMEOFFSET()
     OUTPUT INSERTED.id, INSERTED.property_id, INSERTED.lease_id, INSERTED.submitted_by_user_id,
            INSERTED.assigned_vendor_id, INSERTED.category_id, NULL AS category_code, NULL AS category_name,
            INSERTED.priority_id, NULL AS priority_code, NULL AS priority_name,
            INSERTED.current_status_id, NULL AS status_code, NULL AS status_name,
            INSERTED.title, INSERTED.description,
            INSERTED.internal_notes, INSERTED.estimated_cost, INSERTED.actual_cost,
            INSERTED.scheduled_for, INSERTED.scheduled_from, INSERTED.scheduled_to,
            INSERTED.vendor_contact_name, INSERTED.vendor_contact_email,
            INSERTED.vendor_contact_phone, INSERTED.emergency_disclaimer_acknowledged,
            NULL AS submitted_by_display_name, NULL AS submitted_by_role,
            INSERTED.created_at, INSERTED.updated_at, INSERTED.completed_at, INSERTED.closed_at,
            INSERTED.deleted_at
     WHERE id = $1 AND deleted_at IS NULL`,
    [requestId, currentStatusId, assignedVendorId, scheduledFor, scheduledFrom, scheduledTo, vendorContactName, vendorContactPhone, internalNotes]
  );
  return r.rows[0] ?? null;
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
  const r = await client.query<RequestMessageRow>(
    `INSERT INTO request_messages (
       id, request_id, sender_user_id, body, is_internal, source
     )
     OUTPUT INSERTED.id, INSERTED.request_id, INSERTED.sender_user_id, INSERTED.body,
            INSERTED.is_internal, INSERTED.source, INSERTED.created_at, INSERTED.updated_at
     VALUES (NEWID(), $1, $2, $3, $4, $5)`,
    [
      params.requestId,
      params.senderUserId,
      params.body,
      params.isInternal ? 1 : 0,
      params.source ?? 'PORTAL',
    ]
  );
  return r.rows[0]!;
}

export async function listRequestMessages(
  client: Queryable,
  requestId: string,
  includeInternal: boolean
): Promise<RequestMessageRow[]> {
  const r = await client.query<RequestMessageRow>(
    `SELECT rm.id, rm.request_id, rm.sender_user_id,
            CASE
              WHEN LTRIM(RTRIM(ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, ''))) = '' THEN u.email
              ELSE LTRIM(RTRIM(ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '')))
            END AS sender_display_name,
            u.role AS sender_role,
            rm.body, rm.is_internal, rm.source, rm.created_at, rm.updated_at
     FROM request_messages rm
     LEFT JOIN users u ON u.id = rm.sender_user_id
     WHERE rm.request_id = $1
       AND ($2 = 1 OR rm.is_internal = 0)
     ORDER BY rm.created_at ASC`,
    [requestId, includeInternal ? 1 : 0]
  );
  return r.rows;
}

export async function getRequestMessageById(
  client: Queryable,
  requestId: string,
  messageId: string
): Promise<RequestMessageRow | null> {
  const r = await client.query<RequestMessageRow>(
    `SELECT TOP 1 rm.id, rm.request_id, rm.sender_user_id,
            CASE
              WHEN LTRIM(RTRIM(ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, ''))) = '' THEN u.email
              ELSE LTRIM(RTRIM(ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '')))
            END AS sender_display_name,
            u.role AS sender_role,
            rm.body, rm.is_internal, rm.source, rm.created_at, rm.updated_at
     FROM request_messages rm
     LEFT JOIN users u ON u.id = rm.sender_user_id
     WHERE rm.request_id = $1
       AND rm.id = $2`,
    [requestId, messageId]
  );
  return r.rows[0] ?? null;
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
  const r = await client.query<RequestMessageRow>(
    `DELETE FROM request_messages
     OUTPUT DELETED.id, DELETED.request_id, DELETED.sender_user_id,
            NULL AS sender_display_name, NULL AS sender_role,
            DELETED.body, DELETED.is_internal, DELETED.source, DELETED.created_at, DELETED.updated_at
     WHERE request_id = $1
       AND id = $2`,
    [requestId, messageId]
  );
  return r.rows[0] ?? null;
}

export async function countRequestAttachmentMedia(
  client: Queryable,
  requestId: string
): Promise<{ photos: number; videos: number }> {
  const r = await client.query<{ media_type: string; count_value: number }>(
    `SELECT media_type, COUNT(*) AS count_value
     FROM request_attachments
     WHERE request_id = $1
     GROUP BY media_type`,
    [requestId]
  );
  let photos = 0;
  let videos = 0;
  for (const row of r.rows) {
    if (row.media_type === 'PHOTO') photos = Number(row.count_value ?? 0);
    if (row.media_type === 'VIDEO') videos = Number(row.count_value ?? 0);
  }
  return { photos, videos };
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
    mediaType: 'PHOTO' | 'VIDEO' | 'FILE';
  }
): Promise<RequestAttachmentRow> {
  const r = await client.query<RequestAttachmentRow>(
    `INSERT INTO request_attachments (
       id, request_id, uploaded_by_user_id, storage_path, original_filename,
       content_type, file_size_bytes, media_type
     )
     OUTPUT INSERTED.id, INSERTED.request_id, INSERTED.uploaded_by_user_id, INSERTED.storage_path,
            INSERTED.original_filename, INSERTED.content_type, INSERTED.file_size_bytes,
            INSERTED.media_type, INSERTED.created_at
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
  return r.rows[0]!;
}

export async function listRequestAttachments(
  client: Queryable,
  requestId: string
): Promise<RequestAttachmentRow[]> {
  const r = await client.query<RequestAttachmentRow>(
    `SELECT id, request_id, uploaded_by_user_id, storage_path, original_filename,
            content_type, file_size_bytes, media_type, created_at
     FROM request_attachments
     WHERE request_id = $1
     ORDER BY created_at ASC`,
    [requestId]
  );
  return r.rows;
}

