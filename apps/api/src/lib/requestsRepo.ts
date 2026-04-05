import type { PoolClient, QueryResult } from './db.js';

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

export type RequestRow = {
  id: string;
  property_id: string;
  lease_id: string;
  submitted_by_user_id: string;
  assigned_vendor_id: string | null;
  category_id: string;
  priority_id: string;
  current_status_id: string;
  title: string;
  description: string;
  internal_notes: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  scheduled_for: Date | null;
  vendor_contact_name: string | null;
  vendor_contact_email: string | null;
  vendor_contact_phone: string | null;
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

export async function findStatusIdByCode(client: Queryable, code: string): Promise<string | null> {
  const r = await client.query<{ id: string }>(
    `SELECT id
     FROM request_statuses
     WHERE UPPER(code) = UPPER($1) AND active = 1`,
    [code]
  );
  return r.rows[0]?.id ?? null;
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

export async function listRequestsForTenant(
  client: Queryable,
  tenantUserId: string
): Promise<RequestRow[]> {
  const r = await client.query<RequestRow>(
    `SELECT mr.id, mr.property_id, mr.lease_id, mr.submitted_by_user_id, mr.assigned_vendor_id,
            mr.category_id, mr.priority_id, mr.current_status_id, mr.title, mr.description,
            mr.internal_notes, mr.estimated_cost, mr.actual_cost, mr.scheduled_for,
            mr.vendor_contact_name, mr.vendor_contact_email, mr.vendor_contact_phone,
            mr.emergency_disclaimer_acknowledged, mr.created_at, mr.updated_at,
            mr.completed_at, mr.closed_at, mr.deleted_at
     FROM maintenance_requests mr
     JOIN lease_tenants lt ON lt.lease_id = mr.lease_id
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
    `SELECT id, property_id, lease_id, submitted_by_user_id, assigned_vendor_id,
            category_id, priority_id, current_status_id, title, description,
            internal_notes, estimated_cost, actual_cost, scheduled_for,
            vendor_contact_name, vendor_contact_email, vendor_contact_phone,
            emergency_disclaimer_acknowledged, created_at, updated_at,
            completed_at, closed_at, deleted_at
     FROM maintenance_requests
     WHERE deleted_at IS NULL
     ORDER BY updated_at DESC`
  );
  return r.rows;
}

export async function getRequestById(client: Queryable, id: string): Promise<RequestRow | null> {
  const r = await client.query<RequestRow>(
    `SELECT id, property_id, lease_id, submitted_by_user_id, assigned_vendor_id,
            category_id, priority_id, current_status_id, title, description,
            internal_notes, estimated_cost, actual_cost, scheduled_for,
            vendor_contact_name, vendor_contact_email, vendor_contact_phone,
            emergency_disclaimer_acknowledged, created_at, updated_at,
            completed_at, closed_at, deleted_at
     FROM maintenance_requests
     WHERE id = $1 AND deleted_at IS NULL`,
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
            INSERTED.assigned_vendor_id, INSERTED.category_id, INSERTED.priority_id,
            INSERTED.current_status_id, INSERTED.title, INSERTED.description,
            INSERTED.internal_notes, INSERTED.estimated_cost, INSERTED.actual_cost,
            INSERTED.scheduled_for, INSERTED.vendor_contact_name, INSERTED.vendor_contact_email,
            INSERTED.vendor_contact_phone, INSERTED.emergency_disclaimer_acknowledged,
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
    internalNotes?: string | null;
  }
): Promise<RequestRow | null> {
  const cur = await getRequestById(client, requestId);
  if (!cur) return null;
  const currentStatusId = patch.currentStatusId ?? cur.current_status_id;
  const assignedVendorId =
    patch.assignedVendorId !== undefined ? patch.assignedVendorId : cur.assigned_vendor_id;
  const internalNotes =
    patch.internalNotes !== undefined ? patch.internalNotes : cur.internal_notes;

  const r = await client.query<RequestRow>(
    `UPDATE maintenance_requests
       SET current_status_id = $2,
           assigned_vendor_id = $3,
           internal_notes = $4,
           updated_at = SYSDATETIMEOFFSET()
     OUTPUT INSERTED.id, INSERTED.property_id, INSERTED.lease_id, INSERTED.submitted_by_user_id,
            INSERTED.assigned_vendor_id, INSERTED.category_id, INSERTED.priority_id,
            INSERTED.current_status_id, INSERTED.title, INSERTED.description,
            INSERTED.internal_notes, INSERTED.estimated_cost, INSERTED.actual_cost,
            INSERTED.scheduled_for, INSERTED.vendor_contact_name, INSERTED.vendor_contact_email,
            INSERTED.vendor_contact_phone, INSERTED.emergency_disclaimer_acknowledged,
            INSERTED.created_at, INSERTED.updated_at, INSERTED.completed_at, INSERTED.closed_at,
            INSERTED.deleted_at
     WHERE id = $1 AND deleted_at IS NULL`,
    [requestId, currentStatusId, assignedVendorId, internalNotes]
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
    `SELECT id, request_id, sender_user_id, body, is_internal, source, created_at, updated_at
     FROM request_messages
     WHERE request_id = $1
       AND ($2 = 1 OR is_internal = 0)
     ORDER BY created_at ASC`,
    [requestId, includeInternal ? 1 : 0]
  );
  return r.rows;
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

