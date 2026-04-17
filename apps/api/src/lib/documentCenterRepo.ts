import crypto from 'node:crypto';
import { Role } from '../domain/constants.js';
import type { QueryResult } from './db.js';

export type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

export const DOCUMENT_TYPES = new Set([
  'LEASE',
  'RENTERS_INSURANCE',
  'NOTICE',
  'HOA_COMPLIANCE',
  'REPAIR_RECEIPT',
  'PROPERTY_INFORMATION',
  'TENANT_SUPPORTING_DOCUMENT',
  'OTHER',
]);

export type DocumentScopeType = 'LEASE' | 'PROPERTY' | 'TENANT_ON_LEASE';
export type DocumentScanStatus = 'PENDING' | 'CLEAN' | 'BLOCKED' | 'FAILED';

export type DocumentRow = {
  id: string;
  landlord_id: string;
  property_id: string;
  lease_id: string | null;
  subject_tenant_user_id: string | null;
  scope_type: DocumentScopeType;
  uploaded_by_user_id: string;
  uploaded_by_role: string;
  uploaded_by_display_name: string | null;
  subject_tenant_display_name: string | null;
  title: string | null;
  original_filename: string;
  document_type: string;
  note: string | null;
  content_type: string;
  file_size_bytes: number;
  storage_path: string;
  visibility: 'LANDLORD_PRIVATE' | 'SHARED_WITH_TENANTS';
  scan_status: DocumentScanStatus;
  preview_status: 'AVAILABLE' | 'DOWNLOAD_ONLY' | 'UNAVAILABLE';
  property_label: string | null;
  lease_label: string | null;
  lease_end_date: string | null;
  grace_expires_at: string | null;
  deleted_at: Date | null;
  blob_deleted_at: Date | null;
  purged_at: Date | null;
  legal_hold_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type UploadIntentRow = {
  id: string;
  storage_path: string;
  expires_at: Date;
};

function displayNameSql(alias: string): string {
  return `CASE
    WHEN ${alias}.id IS NULL THEN NULL
    WHEN LTRIM(RTRIM(ISNULL(${alias}.first_name, '') + ' ' + ISNULL(${alias}.last_name, ''))) = '' THEN ${alias}.email
    ELSE LTRIM(RTRIM(ISNULL(${alias}.first_name, '') + ' ' + ISNULL(${alias}.last_name, '')))
  END`;
}

const DOCUMENT_SELECT = `
  SELECT d.id, d.landlord_id, d.property_id, d.lease_id, d.subject_tenant_user_id,
         d.scope_type, d.uploaded_by_user_id, d.uploaded_by_role,
         ${displayNameSql('u')} AS uploaded_by_display_name,
         ${displayNameSql('su')} AS subject_tenant_display_name,
         d.title, d.original_filename, d.document_type, d.note, d.content_type,
         d.file_size_bytes, d.storage_path, d.visibility, d.scan_status, d.preview_status,
         CONCAT(p.street, ', ', p.city, ', ', p.state, ' ', p.zip) AS property_label,
         CASE WHEN l.id IS NULL THEN NULL ELSE CONCAT(CONVERT(NVARCHAR(10), l.start_date, 23), ' - ', COALESCE(CONVERT(NVARCHAR(10), l.end_date, 23), 'Month-to-month')) END AS lease_label,
         CONVERT(NVARCHAR(10), l.end_date, 23) AS lease_end_date,
         CASE WHEN l.end_date IS NULL THEN NULL ELSE CONVERT(NVARCHAR(30), DATEADD(day, 90, CAST(l.end_date AS DATETIME2)), 126) END AS grace_expires_at,
         d.deleted_at, d.blob_deleted_at, d.purged_at, d.legal_hold_at, d.created_at, d.updated_at
  FROM documents d
  JOIN properties p ON p.id = d.property_id
  LEFT JOIN leases l ON l.id = d.lease_id
  LEFT JOIN users u ON u.id = d.uploaded_by_user_id
  LEFT JOIN users su ON su.id = d.subject_tenant_user_id
`;

export function sha256Base64Url(value: string): string {
  return crypto.createHash('sha256').update(value).digest('base64url');
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function randomPasscode(): string {
  const n = crypto.randomInt(0, 1_000_000);
  return String(n).padStart(6, '0');
}

export function canPreviewContentType(contentType: string): boolean {
  const ct = contentType.toLowerCase();
  return ct === 'application/pdf' || ct.startsWith('image/');
}

export async function getPropertyLandlordId(db: Queryable, propertyId: string): Promise<string | null> {
  const r = await db.query<{ landlord_id: string }>(
    `SELECT TOP 1 created_by AS landlord_id
     FROM properties
     WHERE id = $1 AND deleted_at IS NULL`,
    [propertyId]
  );
  return r.rows[0]?.landlord_id ?? null;
}

export async function getLeaseScope(db: Queryable, leaseId: string): Promise<{
  lease_id: string;
  property_id: string;
  landlord_id: string;
  status: string;
  end_date: string | null;
} | null> {
  const r = await db.query<{
    lease_id: string;
    property_id: string;
    landlord_id: string;
    status: string;
    end_date: string | null;
  }>(
    `SELECT TOP 1 l.id AS lease_id, l.property_id, p.created_by AS landlord_id,
            l.status, CONVERT(NVARCHAR(10), l.end_date, 23) AS end_date
     FROM leases l
     JOIN properties p ON p.id = l.property_id AND p.deleted_at IS NULL
     WHERE l.id = $1 AND l.deleted_at IS NULL`,
    [leaseId]
  );
  return r.rows[0] ?? null;
}

export async function tenantOnLease(db: Queryable, leaseId: string, tenantUserId: string): Promise<boolean> {
  const r = await db.query<{ ok: number }>(
    `SELECT TOP 1 1 AS ok
     FROM lease_tenants lt
     JOIN leases l ON l.id = lt.lease_id AND l.deleted_at IS NULL
     WHERE lt.lease_id = $1
       AND lt.user_id = $2`,
    [leaseId, tenantUserId]
  );
  return r.rows.length > 0;
}

export async function tenantCanUploadForLease(db: Queryable, leaseId: string, tenantUserId: string): Promise<boolean> {
  const r = await db.query<{ ok: number }>(
    `SELECT TOP 1 1 AS ok
     FROM lease_tenants lt
     JOIN leases l ON l.id = lt.lease_id AND l.deleted_at IS NULL
     WHERE lt.lease_id = $1
       AND lt.user_id = $2
       AND UPPER(l.status) = 'ACTIVE'
       AND (lt.access_end_at IS NULL OR lt.access_end_at > SYSDATETIMEOFFSET())`,
    [leaseId, tenantUserId]
  );
  return r.rows.length > 0;
}

export async function findActiveLeaseForProperty(db: Queryable, propertyId: string): Promise<string | null> {
  const r = await db.query<{ id: string }>(
    `SELECT TOP 1 id
     FROM leases
     WHERE property_id = $1
       AND deleted_at IS NULL
       AND UPPER(status) = 'ACTIVE'
     ORDER BY start_date DESC, created_at DESC`,
    [propertyId]
  );
  return r.rows[0]?.id ?? null;
}

export async function listTenantEligibleLeases(db: Queryable, tenantUserId: string): Promise<Array<{
  lease_id: string;
  property_id: string;
  landlord_id: string;
  property_label: string;
  lease_label: string;
  readonly_access: boolean;
  grace_expires_at: string | null;
}>> {
  const r = await db.query<{
    lease_id: string;
    property_id: string;
    landlord_id: string;
    property_label: string;
    lease_label: string;
    readonly_access: boolean;
    grace_expires_at: string | null;
  }>(
    `SELECT lt.lease_id, l.property_id, p.created_by AS landlord_id,
            CONCAT(p.street, ', ', p.city, ', ', p.state, ' ', p.zip) AS property_label,
            CONCAT(CONVERT(NVARCHAR(10), l.start_date, 23), ' - ', COALESCE(CONVERT(NVARCHAR(10), l.end_date, 23), 'Month-to-month')) AS lease_label,
            CASE WHEN UPPER(l.status) = 'ACTIVE' THEN CAST(0 AS BIT) ELSE CAST(1 AS BIT) END AS readonly_access,
            CASE WHEN l.end_date IS NULL THEN NULL ELSE CONVERT(NVARCHAR(30), DATEADD(day, 90, CAST(l.end_date AS DATETIME2)), 126) END AS grace_expires_at
     FROM lease_tenants lt
     JOIN leases l ON l.id = lt.lease_id AND l.deleted_at IS NULL
     JOIN properties p ON p.id = l.property_id AND p.deleted_at IS NULL
     JOIN users landlord ON landlord.id = p.created_by
     JOIN subscription_tiers st ON st.id = landlord.tier_id AND st.document_center_enabled = 1
     WHERE lt.user_id = $1
       AND (
         UPPER(l.status) = 'ACTIVE'
         OR (l.end_date IS NOT NULL AND DATEADD(day, 90, CAST(l.end_date AS DATETIME2)) >= SYSDATETIMEOFFSET())
         OR EXISTS (
           SELECT 1 FROM document_access_holds dah
           WHERE dah.lease_id = l.id
             AND dah.revoked_at IS NULL
             AND dah.extended_until >= SYSDATETIMEOFFSET()
         )
       )
       AND landlord.document_center_suspended_at IS NULL
     ORDER BY p.street ASC, l.start_date DESC`,
    [tenantUserId]
  );
  return r.rows;
}

export async function createUploadIntent(db: Queryable, params: {
  landlordId: string;
  propertyId: string;
  leaseId: string | null;
  subjectTenantUserId: string | null;
  scopeType: DocumentScopeType;
  actorUserId: string;
  actorRole: string;
  storagePath: string;
  filename: string;
  contentType: string;
  fileSizeBytes: number;
  documentType: string;
  title: string | null;
  note: string | null;
  shareWithTenants: boolean;
  expiresAt: Date;
}): Promise<UploadIntentRow> {
  const r = await db.query<UploadIntentRow>(
    `INSERT INTO document_upload_intents (
       id, landlord_id, property_id, lease_id, subject_tenant_user_id, scope_type,
       uploaded_by_user_id, uploaded_by_role, storage_path, original_filename,
       content_type, file_size_bytes, document_type, title, note, share_with_tenants,
       consent_acknowledged, expires_at
     )
     OUTPUT INSERTED.id, INSERTED.storage_path, INSERTED.expires_at
     VALUES (NEWID(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 1, $16)`,
    [
      params.landlordId,
      params.propertyId,
      params.leaseId,
      params.subjectTenantUserId,
      params.scopeType,
      params.actorUserId,
      params.actorRole,
      params.storagePath,
      params.filename,
      params.contentType,
      params.fileSizeBytes,
      params.documentType,
      params.title,
      params.note,
      params.shareWithTenants ? 1 : 0,
      params.expiresAt,
    ]
  );
  return r.rows[0]!;
}

export async function getUploadIntent(db: Queryable, intentId: string): Promise<{
  id: string;
  landlord_id: string;
  property_id: string;
  lease_id: string | null;
  subject_tenant_user_id: string | null;
  scope_type: DocumentScopeType;
  uploaded_by_user_id: string;
  uploaded_by_role: string;
  storage_path: string;
  original_filename: string;
  content_type: string;
  file_size_bytes: number;
  document_type: string;
  title: string | null;
  note: string | null;
  share_with_tenants: boolean;
  status: string;
  expires_at: Date;
  finalized_document_id: string | null;
} | null> {
  const r = await db.query<{
    id: string;
    landlord_id: string;
    property_id: string;
    lease_id: string | null;
    subject_tenant_user_id: string | null;
    scope_type: DocumentScopeType;
    uploaded_by_user_id: string;
    uploaded_by_role: string;
    storage_path: string;
    original_filename: string;
    content_type: string;
    file_size_bytes: number;
    document_type: string;
    title: string | null;
    note: string | null;
    share_with_tenants: boolean;
    status: string;
    expires_at: Date;
    finalized_document_id: string | null;
  }>(
    `SELECT TOP 1 id, landlord_id, property_id, lease_id, subject_tenant_user_id,
            scope_type, uploaded_by_user_id, uploaded_by_role, storage_path,
            original_filename, content_type, file_size_bytes, document_type, title,
            note, share_with_tenants, status, expires_at, finalized_document_id
     FROM document_upload_intents
     WHERE id = $1`,
    [intentId]
  );
  return r.rows[0] ?? null;
}

export async function insertDocumentFromIntent(db: Queryable, intentId: string, scanStatus: DocumentScanStatus): Promise<DocumentRow> {
  const previewCase = `CASE
    WHEN $2 = 'CLEAN' AND (LOWER(i.content_type) = 'application/pdf' OR LOWER(i.content_type) LIKE 'image/%') THEN 'AVAILABLE'
    WHEN $2 = 'CLEAN' THEN 'DOWNLOAD_ONLY'
    ELSE 'UNAVAILABLE'
  END`;
  const r = await db.query<{ id: string }>(
    `INSERT INTO documents (
       id, landlord_id, property_id, lease_id, subject_tenant_user_id, scope_type,
       uploaded_by_user_id, uploaded_by_role, title, original_filename, document_type,
       note, content_type, file_size_bytes, storage_path, visibility, scan_status, preview_status
     )
     OUTPUT INSERTED.id
     SELECT NEWID(), landlord_id, property_id, lease_id, subject_tenant_user_id, scope_type,
            uploaded_by_user_id, uploaded_by_role, title, original_filename, document_type,
            note, content_type, file_size_bytes, storage_path,
            CASE WHEN share_with_tenants = 1 THEN 'SHARED_WITH_TENANTS' ELSE 'LANDLORD_PRIVATE' END,
            $2, ${previewCase}
     FROM document_upload_intents i
     WHERE i.id = $1 AND i.status = 'PENDING' AND i.expires_at >= SYSDATETIMEOFFSET()`,
    [intentId, scanStatus]
  );
  const id = r.rows[0]?.id;
  if (!id) {
    const existing = await getUploadIntent(db, intentId);
    if (existing?.finalized_document_id) {
      const doc = await getDocumentById(db, existing.finalized_document_id);
      if (doc) return doc;
    }
    throw new Error('document_insert_failed');
  }
  await db.query(
    `UPDATE document_upload_intents
     SET status = 'FINALIZED', finalized_document_id = $2, finalized_at = SYSDATETIMEOFFSET()
     WHERE id = $1`,
    [intentId, id]
  );
  const doc = await getDocumentById(db, id);
  if (!doc) throw new Error('document_load_failed');
  return doc;
}

async function reactivateOrInsertLeaseHouseholdGrant(
  db: Queryable,
  documentId: string,
  leaseId: string,
  actorUserId: string
): Promise<void> {
  const upd = await db.query(
    `UPDATE document_visibility_grants
     SET revoked_at = NULL, revoked_by = NULL, created_by = $3, created_at = SYSDATETIMEOFFSET()
     WHERE document_id = $1 AND lease_id = $2 AND grant_type = 'LEASE_HOUSEHOLD' AND tenant_user_id IS NULL`,
    [documentId, leaseId, actorUserId]
  );
  if ((upd.rowCount ?? 0) > 0) return;
  await db.query(
    `INSERT INTO document_visibility_grants (id, document_id, lease_id, tenant_user_id, grant_type, created_by)
     VALUES (NEWID(), $1, $2, NULL, 'LEASE_HOUSEHOLD', $3)`,
    [documentId, leaseId, actorUserId]
  );
}

async function reactivateOrInsertTenantGrant(
  db: Queryable,
  documentId: string,
  leaseId: string,
  tenantUserId: string,
  actorUserId: string
): Promise<void> {
  const upd = await db.query(
    `UPDATE document_visibility_grants
     SET revoked_at = NULL, revoked_by = NULL, created_by = $4, created_at = SYSDATETIMEOFFSET()
     WHERE document_id = $1 AND lease_id = $2 AND tenant_user_id = $3 AND grant_type = 'TENANT'`,
    [documentId, leaseId, tenantUserId, actorUserId]
  );
  if ((upd.rowCount ?? 0) > 0) return;
  await db.query(
    `INSERT INTO document_visibility_grants (id, document_id, lease_id, tenant_user_id, grant_type, created_by)
     VALUES (NEWID(), $1, $2, $3, 'TENANT', $4)`,
    [documentId, leaseId, tenantUserId, actorUserId]
  );
}

/** Ensures visibility grants exist (reactivates revoked rows or inserts). Document must already have SHARED visibility. */
export async function ensureDefaultVisibilityGrants(db: Queryable, document: DocumentRow, actorUserId: string): Promise<void> {
  if (document.visibility !== 'SHARED_WITH_TENANTS') return;
  if (document.scope_type === 'PROPERTY') {
    const leaseId = await findActiveLeaseForProperty(db, document.property_id);
    if (!leaseId) return;
    await reactivateOrInsertLeaseHouseholdGrant(db, document.id, leaseId, actorUserId);
    return;
  }
  if (document.scope_type === 'TENANT_ON_LEASE' && document.lease_id && document.subject_tenant_user_id) {
    await reactivateOrInsertTenantGrant(db, document.id, document.lease_id, document.subject_tenant_user_id, actorUserId);
    return;
  }
  if (document.lease_id) {
    await reactivateOrInsertLeaseHouseholdGrant(db, document.id, document.lease_id, actorUserId);
  }
}

export async function addDefaultVisibilityGrant(db: Queryable, document: DocumentRow, actorUserId: string): Promise<void> {
  await ensureDefaultVisibilityGrants(db, document, actorUserId);
}

export async function revokeDocumentVisibilityGrants(db: Queryable, documentId: string, actorUserId: string): Promise<void> {
  await db.query(
    `UPDATE document_visibility_grants
     SET revoked_at = SYSDATETIMEOFFSET(), revoked_by = $2
     WHERE document_id = $1 AND revoked_at IS NULL`,
    [documentId, actorUserId]
  );
}

export async function setDocumentTenantSharing(
  db: Queryable,
  documentId: string,
  shareWithTenants: boolean,
  actorUserId: string
): Promise<DocumentRow | null> {
  const visibility = shareWithTenants ? 'SHARED_WITH_TENANTS' : 'LANDLORD_PRIVATE';
  await db.query(
    `UPDATE documents
     SET visibility = $2, updated_at = SYSDATETIMEOFFSET()
     WHERE id = $1 AND deleted_at IS NULL AND purged_at IS NULL`,
    [documentId, visibility]
  );
  const doc = await getDocumentById(db, documentId);
  if (!doc) return null;
  if (!shareWithTenants) {
    await revokeDocumentVisibilityGrants(db, documentId, actorUserId);
    return getDocumentById(db, documentId);
  }
  await ensureDefaultVisibilityGrants(db, doc, actorUserId);
  return getDocumentById(db, documentId);
}

export async function getDocumentById(db: Queryable, documentId: string): Promise<DocumentRow | null> {
  const r = await db.query<DocumentRow>(
    `${DOCUMENT_SELECT}
     WHERE d.id = $1`,
    [documentId]
  );
  return r.rows[0] ?? null;
}

export type ListDocumentsForManagementFilters = {
  /** `active` — non-deleted only; `deleted` — soft-deleted only */
  deletedScope: 'active' | 'deleted';
  search: string | null;
  propertyId?: string | null;
  leaseId?: string | null;
  tenantUserId?: string | null;
  /** Exact `documents.document_type` when set */
  documentType?: string | null;
};

export async function listDocumentsForManagement(
  db: Queryable,
  actorRole: string,
  actorUserId: string,
  filters: ListDocumentsForManagementFilters,
): Promise<DocumentRow[]> {
  const role = actorRole.trim().toUpperCase();
  const searchLike = filters.search ? `%${filters.search}%` : null;
  const deletedOnly = filters.deletedScope === 'deleted' ? 1 : 0;
  const propertyId = filters.propertyId ?? null;
  const leaseId = filters.leaseId ?? null;
  const tenantUserId = filters.tenantUserId ?? null;
  const documentType = filters.documentType ?? null;
  const r = await db.query<DocumentRow>(
    `${DOCUMENT_SELECT}
     WHERE d.purged_at IS NULL
       AND ($1 = '${Role.ADMIN}' OR d.landlord_id = $2)
       AND (($3 = 0 AND d.deleted_at IS NULL) OR ($3 = 1 AND d.deleted_at IS NOT NULL))
       AND (
         $4 IS NULL
         OR d.original_filename LIKE $4
         OR d.title LIKE $4
         OR d.note LIKE $4
         OR d.document_type LIKE $4
         OR p.street LIKE $4
         OR u.email LIKE $4
       )
       AND ($5 IS NULL OR d.property_id = $5)
       AND ($6 IS NULL OR EXISTS (
         SELECT 1 FROM leases l_scope
         INNER JOIN properties p_scope ON p_scope.id = l_scope.property_id AND p_scope.deleted_at IS NULL
         WHERE l_scope.id = $6 AND l_scope.deleted_at IS NULL
           AND ($1 = '${Role.ADMIN}' OR p_scope.created_by = $2)
       ))
       AND ($6 IS NULL OR d.lease_id = $6
         OR (d.lease_id IS NULL AND d.scope_type = 'PROPERTY' AND d.property_id = (
           SELECT TOP 1 l_prop.property_id FROM leases l_prop
           WHERE l_prop.id = $6 AND l_prop.deleted_at IS NULL
         ))
       )
       AND ($7 IS NULL OR d.subject_tenant_user_id = $7
         OR (d.uploaded_by_user_id = $7 AND d.uploaded_by_role = '${Role.TENANT}')
       )
       AND ($7 IS NULL OR $1 = '${Role.ADMIN}' OR EXISTS (
         SELECT 1 FROM lease_tenants lt_t
         INNER JOIN leases l_t ON l_t.id = lt_t.lease_id AND l_t.deleted_at IS NULL
         INNER JOIN properties p_t ON p_t.id = l_t.property_id AND p_t.deleted_at IS NULL
         WHERE lt_t.user_id = $7 AND p_t.created_by = $2
       ))
       AND ($8 IS NULL OR d.document_type = $8)
     ORDER BY d.created_at DESC`,
    [role, actorUserId, deletedOnly, searchLike, propertyId, leaseId, tenantUserId, documentType]
  );
  return r.rows;
}

export type ListDocumentsForTenantFilters = {
  tenantUserId: string;
  search: string | null;
  propertyId?: string | null;
  leaseId?: string | null;
  documentType?: string | null;
};

export async function listDocumentsForTenant(db: Queryable, filters: ListDocumentsForTenantFilters): Promise<DocumentRow[]> {
  const { tenantUserId, search } = filters;
  const searchLike = search ? `%${search}%` : null;
  const propertyId = filters.propertyId ?? null;
  const leaseId = filters.leaseId ?? null;
  const documentType = filters.documentType ?? null;
  const r = await db.query<DocumentRow>(
    `${DOCUMENT_SELECT}
     WHERE d.purged_at IS NULL
       AND d.deleted_at IS NULL
       AND (
         (d.uploaded_by_user_id = $1 AND d.uploaded_by_role = '${Role.TENANT}')
         OR EXISTS (
           SELECT 1
           FROM document_visibility_grants g
           JOIN lease_tenants lt ON lt.lease_id = g.lease_id AND lt.user_id = $1
           JOIN leases gl ON gl.id = g.lease_id AND gl.deleted_at IS NULL
           WHERE g.document_id = d.id
             AND g.revoked_at IS NULL
             AND (
               g.grant_type = 'LEASE_HOUSEHOLD'
               OR (g.grant_type = 'TENANT' AND g.tenant_user_id = $1)
             )
             AND (
               UPPER(gl.status) = 'ACTIVE'
               OR (gl.end_date IS NOT NULL AND DATEADD(day, 90, CAST(gl.end_date AS DATETIME2)) >= SYSDATETIMEOFFSET())
               OR EXISTS (
                 SELECT 1 FROM document_access_holds dah
                 WHERE dah.lease_id = gl.id
                   AND dah.revoked_at IS NULL
                   AND dah.extended_until >= SYSDATETIMEOFFSET()
               )
             )
         )
       )
       AND (
         $2 IS NULL
         OR d.original_filename LIKE $2
         OR d.title LIKE $2
         OR d.note LIKE $2
         OR d.document_type LIKE $2
         OR p.street LIKE $2
       )
       AND ($3 IS NULL OR EXISTS (
         SELECT 1 FROM lease_tenants lt_p
         INNER JOIN leases l_p ON l_p.id = lt_p.lease_id AND l_p.deleted_at IS NULL
         WHERE lt_p.user_id = $1 AND l_p.property_id = $3
           AND (lt_p.access_end_at IS NULL OR lt_p.access_end_at > SYSDATETIMEOFFSET())
       ))
       AND ($4 IS NULL OR EXISTS (
         SELECT 1 FROM lease_tenants lt_l
         INNER JOIN leases l_l ON l_l.id = lt_l.lease_id AND l_l.deleted_at IS NULL
         WHERE lt_l.lease_id = $4 AND lt_l.user_id = $1
           AND (lt_l.access_end_at IS NULL OR lt_l.access_end_at > SYSDATETIMEOFFSET())
       ))
       AND ($4 IS NULL OR d.lease_id = $4
         OR (d.lease_id IS NULL AND d.scope_type = 'PROPERTY' AND d.property_id = (
           SELECT TOP 1 l_x.property_id FROM leases l_x
           WHERE l_x.id = $4 AND l_x.deleted_at IS NULL
         ))
       )
       AND ($5 IS NULL OR d.document_type = $5)
     ORDER BY d.created_at DESC`,
    [tenantUserId, searchLike, propertyId, leaseId, documentType]
  );
  return r.rows;
}

export async function tenantCanAccessDocument(db: Queryable, documentId: string, tenantUserId: string): Promise<boolean> {
  const docs = await listDocumentsForTenant(db, { tenantUserId, search: null });
  return docs.some((doc) => doc.id === documentId);
}

export async function writeDocumentAudit(db: Queryable, params: {
  documentId: string | null;
  actorUserId: string | null;
  actorRole: string | null;
  eventType: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await db.query(
    `INSERT INTO document_audit_events (
       id, document_id, actor_user_id, actor_role, event_type, before_json, after_json, ip_address, user_agent
     )
     VALUES (NEWID(), $1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      params.documentId,
      params.actorUserId,
      params.actorRole,
      params.eventType,
      params.before === undefined ? null : JSON.stringify(params.before),
      params.after === undefined ? null : JSON.stringify(params.after),
      params.ipAddress ?? null,
      params.userAgent ?? null,
    ]
  );
}

export async function writeDocumentConsent(db: Queryable, params: {
  documentId?: string | null;
  uploadIntentId?: string | null;
  shareLinkId?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  consentType: string;
  noticeVersion: string;
  consentText: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await db.query(
    `INSERT INTO document_consent_records (
       id, document_id, upload_intent_id, share_link_id, actor_user_id, actor_role,
       consent_type, notice_version, consent_text, ip_address, user_agent
     )
     VALUES (NEWID(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      params.documentId ?? null,
      params.uploadIntentId ?? null,
      params.shareLinkId ?? null,
      params.actorUserId ?? null,
      params.actorRole ?? null,
      params.consentType,
      params.noticeVersion,
      params.consentText,
      params.ipAddress ?? null,
      params.userAgent ?? null,
    ]
  );
}

export async function softDeleteDocument(db: Queryable, documentId: string, actorUserId: string): Promise<DocumentRow | null> {
  await db.query(
    `UPDATE documents
     SET deleted_at = SYSDATETIMEOFFSET(), deleted_by = $2, updated_at = SYSDATETIMEOFFSET()
     WHERE id = $1 AND deleted_at IS NULL AND legal_hold_at IS NULL`,
    [documentId, actorUserId]
  );
  return getDocumentById(db, documentId);
}

export async function restoreDocument(db: Queryable, documentId: string, actorUserId: string): Promise<DocumentRow | null> {
  await db.query(
    `UPDATE documents
     SET deleted_at = NULL, deleted_by = NULL, restored_at = SYSDATETIMEOFFSET(),
         restored_by = $2, updated_at = SYSDATETIMEOFFSET()
     WHERE id = $1
       AND deleted_at IS NOT NULL
       AND blob_deleted_at IS NULL
       AND purged_at IS NULL`,
    [documentId, actorUserId]
  );
  return getDocumentById(db, documentId);
}

/** Irreversible: soft-deleted document only; revokes share links then marks purged (blob removed by API). */
export async function purgeSoftDeletedDocument(db: Queryable, documentId: string, actorUserId: string): Promise<boolean> {
  await db.query(
    `UPDATE document_share_links
     SET revoked_at = SYSDATETIMEOFFSET(), revoked_by = $2
     WHERE document_id = $1 AND revoked_at IS NULL`,
    [documentId, actorUserId]
  );
  const r = await db.query(
    `UPDATE documents
     SET blob_deleted_at = SYSDATETIMEOFFSET(),
         purged_at = SYSDATETIMEOFFSET(),
         purged_by = $2,
         updated_at = SYSDATETIMEOFFSET()
     WHERE id = $1
       AND deleted_at IS NOT NULL
       AND purged_at IS NULL
       AND legal_hold_at IS NULL`,
    [documentId, actorUserId]
  );
  return (r.rowCount ?? 0) > 0;
}

export async function updateDocumentMetadata(db: Queryable, documentId: string, title: string | null, note: string | null, documentType: string): Promise<DocumentRow | null> {
  await db.query(
    `UPDATE documents
     SET title = $2, note = $3, document_type = $4, updated_at = SYSDATETIMEOFFSET()
     WHERE id = $1 AND deleted_at IS NULL AND purged_at IS NULL`,
    [documentId, title, note, documentType]
  );
  return getDocumentById(db, documentId);
}

export async function insertShareLink(db: Queryable, params: {
  documentId: string;
  tokenHash: string;
  passcodeHash: string | null;
  expiresAt: Date;
  landlordId: string;
}): Promise<{ id: string; expires_at: Date }> {
  const r = await db.query<{ id: string; expires_at: Date }>(
    `INSERT INTO document_share_links (
       id, document_id, token_hash, passcode_hash, expires_at, created_by_landlord_id
     )
     OUTPUT INSERTED.id, INSERTED.expires_at
     VALUES (NEWID(), $1, $2, $3, $4, $5)`,
    [params.documentId, params.tokenHash, params.passcodeHash, params.expiresAt, params.landlordId]
  );
  return r.rows[0]!;
}

export async function listShareLinksForDocument(db: Queryable, documentId: string): Promise<Array<{
  id: string;
  document_id: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
  created_by_landlord_id: string;
  last_accessed_at: Date | null;
  access_count: number;
  failed_passcode_count: number;
  passcode_required: boolean;
}>> {
  const r = await db.query<{
    id: string;
    document_id: string;
    expires_at: Date;
    revoked_at: Date | null;
    created_at: Date;
    created_by_landlord_id: string;
    last_accessed_at: Date | null;
    access_count: number;
    failed_passcode_count: number;
    passcode_required: boolean;
  }>(
    `SELECT id, document_id, expires_at, revoked_at, created_at, created_by_landlord_id,
            last_accessed_at, access_count, failed_passcode_count,
            CASE WHEN passcode_hash IS NULL THEN CAST(0 AS bit) ELSE CAST(1 AS bit) END AS passcode_required
     FROM document_share_links
     WHERE document_id = $1
       AND (
         (revoked_at IS NULL AND expires_at >= SYSDATETIMEOFFSET())
         OR COALESCE(revoked_at, expires_at) >= DATEADD(hour, -24, SYSDATETIMEOFFSET())
       )
     ORDER BY created_at DESC`,
    [documentId]
  );
  return r.rows;
}

export async function getShareLinkById(db: Queryable, linkId: string): Promise<{
  id: string;
  document_id: string;
  landlord_id: string;
  revoked_at: Date | null;
} | null> {
  const r = await db.query<{
    id: string;
    document_id: string;
    landlord_id: string;
    revoked_at: Date | null;
  }>(
    `SELECT TOP 1 l.id, l.document_id, d.landlord_id, l.revoked_at
     FROM document_share_links l
     INNER JOIN documents d ON d.id = l.document_id
     WHERE l.id = $1`,
    [linkId]
  );
  return r.rows[0] ?? null;
}

export async function revokeShareLink(db: Queryable, linkId: string, actorUserId: string): Promise<void> {
  await db.query(
    `UPDATE document_share_links
     SET revoked_at = SYSDATETIMEOFFSET(), revoked_by = $2
     WHERE id = $1 AND revoked_at IS NULL`,
    [linkId, actorUserId]
  );
}

export async function getShareLinkByToken(db: Queryable, token: string): Promise<{
  id: string;
  document_id: string;
  passcode_hash: string | null;
  expires_at: Date;
  revoked_at: Date | null;
} | null> {
  const r = await db.query<{
    id: string;
    document_id: string;
    passcode_hash: string | null;
    expires_at: Date;
    revoked_at: Date | null;
  }>(
    `SELECT TOP 1 id, document_id, passcode_hash, expires_at, revoked_at
     FROM document_share_links
     WHERE token_hash = $1`,
    [sha256Base64Url(token)]
  );
  return r.rows[0] ?? null;
}

export async function recordShareLinkAccess(db: Queryable, linkId: string, failedPasscode: boolean): Promise<void> {
  await db.query(
    `UPDATE document_share_links
     SET last_accessed_at = SYSDATETIMEOFFSET(),
         access_count = access_count + CASE WHEN $2 = 1 THEN 0 ELSE 1 END,
         failed_passcode_count = failed_passcode_count + CASE WHEN $2 = 1 THEN 1 ELSE 0 END
     WHERE id = $1`,
    [linkId, failedPasscode ? 1 : 0]
  );
}
