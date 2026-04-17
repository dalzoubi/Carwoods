import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import crypto from 'node:crypto';
import { getPool } from '../lib/db.js';
import { corsHeadersForRequest } from '../lib/corsHeaders.js';
import { jsonResponse, mapDomainError, requirePortalUser } from '../lib/managementRequest.js';
import { readJsonBody } from '../lib/readBody.js';
import { withRateLimit } from '../lib/rateLimiter.js';
import { logError, logInfo, logWarn } from '../lib/serverLogger.js';
import { Role, hasLandlordAccess } from '../domain/constants.js';
import { forbidden, notFound, unprocessable, validationError } from '../domain/errors.js';
import { isValidUuid } from '../domain/validation.js';
import { assertDocumentCenterEnabledForProperty } from '../lib/subscriptionTierCapabilities.js';
import { buildDocumentReadUrl, buildDocumentUploadUrl, ensureDocumentContainer } from '../lib/documentStorage.js';
import {
  DOCUMENT_TYPES,
  addDefaultVisibilityGrant,
  canPreviewContentType,
  createUploadIntent,
  getDocumentById,
  getLeaseScope,
  getPropertyLandlordId,
  getShareLinkById,
  getShareLinkByToken,
  getUploadIntent,
  insertDocumentFromIntent,
  insertShareLink,
  listDocumentsForManagement,
  listShareLinksForDocument,
  listDocumentsForTenant,
  listTenantEligibleLeases,
  randomPasscode,
  randomToken,
  recordShareLinkAccess,
  restoreDocument,
  revokeShareLink,
  sha256Base64Url,
  softDeleteDocument,
  tenantCanAccessDocument,
  tenantCanUploadForLease,
  tenantOnLease,
  setDocumentTenantSharing,
  updateDocumentMetadata,
  writeDocumentAudit,
  writeDocumentConsent,
  type DocumentRow,
  type DocumentScopeType,
} from '../lib/documentCenterRepo.js';

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const UPLOAD_INTENT_SECONDS = 10 * 60;
const READ_URL_SECONDS = 5 * 60;
const SHARE_LINK_MAX_SECONDS = 30 * 24 * 60 * 60;
const NOTICE_VERSION = 'document-center-v1';
const UPLOAD_CONSENT_TEXT =
  'Documents may contain sensitive information. Upload only files needed for your tenancy or property matter. Tenant uploads are visible to property management.';
const VIEW_NOTICE_TEXT =
  'Documents may contain sensitive information. Access may be logged and shared links may expire or be revoked.';

const ALLOWED_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp', 'gif']);
const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v.trim() : undefined;
}

function bool(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined;
}

function int(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function clientIp(request: HttpRequest): string | null {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-client-ip')?.trim()
    || null;
}

function userAgent(request: HttpRequest): string | null {
  return request.headers.get('user-agent')?.slice(0, 500) || null;
}

function documentCenterGloballyEnabled(): boolean {
  return process.env.DOCUMENT_CENTER_ENABLED !== 'false';
}

function scanStatusForNewUpload(): 'PENDING' | 'CLEAN' {
  const bypass = process.env.DOCUMENT_CENTER_SCAN_BYPASS === 'true'
    || (process.env.NODE_ENV !== 'production' && process.env.DOCUMENT_CENTER_SCAN_BYPASS !== 'false');
  return bypass ? 'CLEAN' : 'PENDING';
}

function extensionFromFilename(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot < 0) return '';
  return filename.slice(dot + 1).trim().toLowerCase();
}

function validateFileFields(filename: string | undefined, contentType: string | undefined, fileSizeBytes: number): void {
  if (!filename || !contentType || !Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
    throw validationError('missing_or_invalid_file_fields');
  }
  if (fileSizeBytes > MAX_FILE_BYTES) {
    throw Object.assign(validationError('file_too_large'), { max_bytes: MAX_FILE_BYTES });
  }
  const ct = contentType.toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.has(ct)) throw validationError('unsupported_mime_type');
  const ext = extensionFromFilename(filename);
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) throw validationError('unsupported_file_extension');
  if (ext === 'docm') throw validationError('unsupported_file_extension');
}

function serializeDocument(doc: DocumentRow) {
  return {
    ...doc,
    share_with_tenants: doc.visibility === 'SHARED_WITH_TENANTS',
    can_preview: doc.scan_status === 'CLEAN' && canPreviewContentType(doc.content_type),
    can_download: doc.scan_status === 'CLEAN' && !doc.deleted_at && !doc.purged_at,
  };
}

async function assertDocumentReadable(doc: DocumentRow, actorRole: string, actorUserId: string): Promise<void> {
  const role = actorRole.trim().toUpperCase();
  if (doc.deleted_at || doc.purged_at) throw notFound();
  if (doc.scan_status !== 'CLEAN') throw validationError('document_not_available_until_scan_clean');
  if (role === Role.ADMIN) return;
  if (role === Role.LANDLORD && doc.landlord_id === actorUserId) return;
  if (role === Role.TENANT && await tenantCanAccessDocument(getPool(), doc.id, actorUserId)) return;
  throw notFound();
}

async function resolveUploadScope(body: Record<string, unknown>, actorRole: string, actorUserId: string) {
  const rawScope = (str(body.scope_type) ?? '').toUpperCase() as DocumentScopeType;
  const scopeType = rawScope || 'LEASE';
  if (!['LEASE', 'PROPERTY', 'TENANT_ON_LEASE'].includes(scopeType)) {
    throw validationError('invalid_scope_type');
  }
  const role = actorRole.trim().toUpperCase();
  const leaseId = str(body.lease_id) ?? null;
  const propertyIdInput = str(body.property_id) ?? null;
  const subjectTenantUserIdInput = str(body.subject_tenant_user_id) ?? null;

  if (role === Role.TENANT) {
    if (!leaseId) throw validationError('missing_lease_id');
    if (!await tenantCanUploadForLease(getPool(), leaseId, actorUserId)) throw notFound();
    const lease = await getLeaseScope(getPool(), leaseId);
    if (!lease) throw notFound();
    return {
      scopeType: 'TENANT_ON_LEASE' as DocumentScopeType,
      leaseId,
      propertyId: lease.property_id,
      landlordId: lease.landlord_id,
      subjectTenantUserId: actorUserId,
      shareWithTenants: false,
    };
  }

  if (!hasLandlordAccess(role)) throw forbidden();

  if (scopeType === 'PROPERTY') {
    if (!propertyIdInput) throw validationError('missing_property_id');
    const landlordId = await getPropertyLandlordId(getPool(), propertyIdInput);
    if (!landlordId) throw notFound();
    if (role === Role.LANDLORD && landlordId !== actorUserId) throw notFound();
    return {
      scopeType,
      leaseId: null,
      propertyId: propertyIdInput,
      landlordId,
      subjectTenantUserId: null,
      shareWithTenants: bool(body.share_with_tenants) ?? false,
    };
  }

  if (!leaseId) throw validationError('missing_lease_id');
  const lease = await getLeaseScope(getPool(), leaseId);
  if (!lease) throw notFound();
  if (role === Role.LANDLORD && lease.landlord_id !== actorUserId) throw notFound();

  if (scopeType === 'TENANT_ON_LEASE') {
    if (!subjectTenantUserIdInput) throw validationError('missing_subject_tenant_user_id');
    if (!await tenantOnLease(getPool(), leaseId, subjectTenantUserIdInput)) {
      throw validationError('tenant_not_on_lease');
    }
  }

  return {
    scopeType,
    leaseId,
    propertyId: lease.property_id,
    landlordId: lease.landlord_id,
    subjectTenantUserId: scopeType === 'TENANT_ON_LEASE' ? subjectTenantUserIdInput : null,
    shareWithTenants: bool(body.share_with_tenants) ?? false,
  };
}

async function portalDocumentsCollection(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;
  const role = String(user.role ?? '').toUpperCase();

  if (!documentCenterGloballyEnabled()) {
    return jsonResponse(503, headers, { error: 'document_center_unavailable' });
  }

  if (request.method === 'GET') {
    try {
      const search = request.query.get('q')?.trim() || null;
      const listParam = (request.query.get('list') ?? 'active').trim().toLowerCase();
      const deletedScope = listParam === 'deleted' ? 'deleted' : 'active';
      const propertyIdRaw = request.query.get('property_id')?.trim() || null;
      const leaseIdRaw = request.query.get('lease_id')?.trim() || null;
      const tenantUserIdRaw = request.query.get('tenant_user_id')?.trim() || null;
      const documentTypeRaw = request.query.get('document_type')?.trim().toUpperCase() || null;
      const propertyId = propertyIdRaw && isValidUuid(propertyIdRaw) ? propertyIdRaw : null;
      const leaseId = leaseIdRaw && isValidUuid(leaseIdRaw) ? leaseIdRaw : null;
      const tenantUserId = tenantUserIdRaw && isValidUuid(tenantUserIdRaw) ? tenantUserIdRaw : null;
      const documentType = documentTypeRaw && DOCUMENT_TYPES.has(documentTypeRaw) ? documentTypeRaw : null;

      const documents = role === Role.TENANT
        ? await listDocumentsForTenant(getPool(), {
          tenantUserId: user.id,
          search,
          propertyId,
          leaseId,
          documentType,
        })
        : await listDocumentsForManagement(getPool(), role, user.id, {
          deletedScope,
          search,
          propertyId,
          leaseId,
          tenantUserId,
          documentType,
        });
      const eligible_leases = role === Role.TENANT
        ? await listTenantEligibleLeases(getPool(), user.id)
        : [];
      return jsonResponse(200, headers, {
        documents: documents.map(serializeDocument),
        eligible_leases,
        document_types: Array.from(DOCUMENT_TYPES),
      });
    } catch (e) {
      const mapped = mapDomainError(e, headers);
      if (mapped) return mapped;
      throw e;
    }
  }

  return jsonResponse(405, headers, { error: 'method_not_allowed' });
}

async function portalDocumentUploadIntent(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;
  const role = String(user.role ?? '').toUpperCase();

  if (request.method !== 'POST') return jsonResponse(405, headers, { error: 'method_not_allowed' });
  if (!documentCenterGloballyEnabled()) return jsonResponse(503, headers, { error: 'document_center_unavailable' });

  const body = await readJsonBody(request);
  if (body === null) return jsonResponse(400, headers, { error: 'invalid_json' });
  const b = asRecord(body);

  try {
    const filename = str(b.filename);
    const contentType = str(b.content_type);
    const fileSizeBytes = int(b.file_size_bytes);
    validateFileFields(filename, contentType, fileSizeBytes);
    const documentType = (str(b.document_type) ?? 'OTHER').toUpperCase();
    if (!DOCUMENT_TYPES.has(documentType)) throw validationError('invalid_document_type');
    if (bool(b.sensitive_acknowledged) !== true) throw validationError('sensitive_acknowledgement_required');

    const scope = await resolveUploadScope(b, role, user.id);
    await assertDocumentCenterEnabledForProperty(getPool(), scope.propertyId);

    const ext = extensionFromFilename(filename!);
    const storagePath = `${scope.landlordId}/${scope.propertyId}/${crypto.randomUUID()}.${ext}`;
    const containerReady = await ensureDocumentContainer();
    if (!containerReady) throw unprocessable('storage_not_configured');
    const uploadUrl = buildDocumentUploadUrl(storagePath, contentType!, UPLOAD_INTENT_SECONDS);
    if (!uploadUrl) throw unprocessable('storage_not_configured');

    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const intent = await createUploadIntent(client, {
        landlordId: scope.landlordId,
        propertyId: scope.propertyId,
        leaseId: scope.leaseId,
        subjectTenantUserId: scope.subjectTenantUserId,
        scopeType: scope.scopeType,
        actorUserId: user.id,
        actorRole: role,
        storagePath,
        filename: filename!,
        contentType: contentType!,
        fileSizeBytes,
        documentType,
        title: str(b.title) ?? null,
        note: str(b.note) ?? null,
        shareWithTenants: scope.shareWithTenants,
        expiresAt: new Date(Date.now() + UPLOAD_INTENT_SECONDS * 1000),
      });
      await writeDocumentConsent(client, {
        uploadIntentId: intent.id,
        actorUserId: user.id,
        actorRole: role,
        consentType: 'UPLOAD_SENSITIVE_DOCUMENT_ACK',
        noticeVersion: NOTICE_VERSION,
        consentText: UPLOAD_CONSENT_TEXT,
        ipAddress: clientIp(request),
        userAgent: userAgent(request),
      });
      await writeDocumentAudit(client, {
        documentId: null,
        actorUserId: user.id,
        actorRole: role,
        eventType: 'UPLOAD_INTENT_CREATED',
        after: { upload_intent_id: intent.id, storage_path: storagePath, file_size_bytes: fileSizeBytes },
        ipAddress: clientIp(request),
        userAgent: userAgent(request),
      });
      await client.query('COMMIT');
      return jsonResponse(200, headers, {
        upload: {
          upload_intent_id: intent.id,
          upload_url: uploadUrl,
          storage_path: storagePath,
          expires_in_seconds: UPLOAD_INTENT_SECONDS,
        },
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    const mapped = mapDomainError(e, headers);
    if (mapped) return mapped;
    logError(context, 'document_center.upload_intent.error', { userId: user.id, message: e instanceof Error ? e.message : 'unknown' });
    throw e;
  }
}

async function portalDocumentFinalize(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;
  const role = String(user.role ?? '').toUpperCase();

  if (request.method !== 'POST') return jsonResponse(405, headers, { error: 'method_not_allowed' });
  const body = await readJsonBody(request);
  if (body === null) return jsonResponse(400, headers, { error: 'invalid_json' });
  const intentId = str(asRecord(body).upload_intent_id);
  if (!intentId || !isValidUuid(intentId)) return jsonResponse(400, headers, { error: 'invalid_upload_intent_id' });

  try {
    const intent = await getUploadIntent(getPool(), intentId);
    if (!intent) throw notFound();
    if (intent.uploaded_by_user_id !== user.id && role !== Role.ADMIN) throw notFound();
    if (intent.status === 'FINALIZED' && intent.finalized_document_id) {
      const existing = await getDocumentById(getPool(), intent.finalized_document_id);
      if (existing) return jsonResponse(200, headers, { document: serializeDocument(existing) });
    }
    if (intent.status !== 'PENDING') throw validationError('upload_intent_not_pending');
    if (new Date(intent.expires_at).getTime() < Date.now()) throw validationError('upload_intent_expired');

    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const doc = await insertDocumentFromIntent(client, intentId, scanStatusForNewUpload());
      await addDefaultVisibilityGrant(client, doc, user.id);
      await writeDocumentConsent(client, {
        documentId: doc.id,
        uploadIntentId: intentId,
        actorUserId: user.id,
        actorRole: role,
        consentType: 'UPLOAD_FINALIZED',
        noticeVersion: NOTICE_VERSION,
        consentText: UPLOAD_CONSENT_TEXT,
        ipAddress: clientIp(request),
        userAgent: userAgent(request),
      });
      await writeDocumentAudit(client, {
        documentId: doc.id,
        actorUserId: user.id,
        actorRole: role,
        eventType: 'DOCUMENT_CREATED',
        after: doc,
        ipAddress: clientIp(request),
        userAgent: userAgent(request),
      });
      await client.query('COMMIT');
      return jsonResponse(201, headers, { document: serializeDocument(doc) });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    const mapped = mapDomainError(e, headers);
    if (mapped) return mapped;
    logError(context, 'document_center.finalize.error', { userId: user.id, message: e instanceof Error ? e.message : 'unknown' });
    throw e;
  }
}

async function portalDocumentItem(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;
  const role = String(user.role ?? '').toUpperCase();
  const documentId = request.params.documentId;
  if (!documentId || !isValidUuid(documentId)) return jsonResponse(400, headers, { error: 'invalid_document_id' });

  try {
    const doc = await getDocumentById(getPool(), documentId);
    if (!doc) throw notFound();
    if (request.method === 'GET') {
      if (role === Role.TENANT && !await tenantCanAccessDocument(getPool(), doc.id, user.id)) throw notFound();
      if (role === Role.LANDLORD && doc.landlord_id !== user.id) throw notFound();
      return jsonResponse(200, headers, { document: serializeDocument(doc) });
    }

    if (request.method === 'PATCH') {
      const canPatch = role === Role.ADMIN || (role === Role.LANDLORD && doc.landlord_id === user.id);
      if (!canPatch) throw forbidden();
      const body = await readJsonBody(request);
      if (body === null) return jsonResponse(400, headers, { error: 'invalid_json' });
      const b = asRecord(body);
      const hasMeta = 'title' in b || 'note' in b || 'document_type' in b;
      const hasShare = typeof b.share_with_tenants === 'boolean';
      if (!hasMeta && !hasShare) throw validationError('no_document_updates');

      let documentType = doc.document_type;
      if ('document_type' in b) {
        documentType = (str(b.document_type) ?? doc.document_type).toUpperCase();
        if (!DOCUMENT_TYPES.has(documentType)) throw validationError('invalid_document_type');
      }
      let title = doc.title ?? null;
      if ('title' in b) title = str(b.title) ?? null;
      let note = doc.note ?? null;
      if ('note' in b) note = str(b.note) ?? null;

      const client = await getPool().connect();
      try {
        await client.query('BEGIN');
        if (hasMeta) {
          await updateDocumentMetadata(client, doc.id, title, note, documentType);
        }
        if (hasShare) {
          const shareWith = Boolean(b.share_with_tenants);
          if (shareWith) {
            await assertDocumentCenterEnabledForProperty(client, doc.property_id);
          }
          await setDocumentTenantSharing(client, doc.id, shareWith, user.id);
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }

      const updated = await getDocumentById(getPool(), doc.id);
      const eventType = hasShare && hasMeta ? 'DOCUMENT_UPDATED'
        : hasShare ? 'TENANT_SHARING_UPDATED'
          : 'METADATA_UPDATED';
      await writeDocumentAudit(getPool(), {
        documentId: doc.id,
        actorUserId: user.id,
        actorRole: role,
        eventType,
        before: doc,
        after: updated,
        ipAddress: clientIp(request),
        userAgent: userAgent(request),
      });
      return jsonResponse(200, headers, { document: updated ? serializeDocument(updated) : null });
    }

    if (request.method === 'DELETE') {
      if (role !== Role.ADMIN && !(role === Role.LANDLORD && doc.landlord_id === user.id)) throw forbidden();
      const deleted = await softDeleteDocument(getPool(), doc.id, user.id);
      await writeDocumentAudit(getPool(), {
        documentId: doc.id,
        actorUserId: user.id,
        actorRole: role,
        eventType: 'DOCUMENT_SOFT_DELETED',
        before: doc,
        after: deleted,
        ipAddress: clientIp(request),
        userAgent: userAgent(request),
      });
      return jsonResponse(200, headers, { document: deleted ? serializeDocument(deleted) : null });
    }
    return jsonResponse(405, headers, { error: 'method_not_allowed' });
  } catch (e) {
    const mapped = mapDomainError(e, headers);
    if (mapped) return mapped;
    throw e;
  }
}

async function portalDocumentRestore(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;
  const role = String(user.role ?? '').toUpperCase();
  const documentId = request.params.documentId;
  if (!documentId || !isValidUuid(documentId)) return jsonResponse(400, headers, { error: 'invalid_document_id' });
  if (request.method !== 'POST') return jsonResponse(405, headers, { error: 'method_not_allowed' });
  try {
    const doc = await getDocumentById(getPool(), documentId);
    if (!doc) throw notFound();
    if (role !== Role.ADMIN && !(role === Role.LANDLORD && doc.landlord_id === user.id)) throw forbidden();
    const restored = await restoreDocument(getPool(), doc.id, user.id);
    await writeDocumentAudit(getPool(), {
      documentId: doc.id,
      actorUserId: user.id,
      actorRole: role,
      eventType: 'DOCUMENT_RESTORED',
      before: doc,
      after: restored,
      ipAddress: clientIp(request),
      userAgent: userAgent(request),
    });
    return jsonResponse(200, headers, { document: restored ? serializeDocument(restored) : null });
  } catch (e) {
    const mapped = mapDomainError(e, headers);
    if (mapped) return mapped;
    throw e;
  }
}

async function portalDocumentFileUrl(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;
  const role = String(user.role ?? '').toUpperCase();
  const documentId = request.params.documentId;
  if (!documentId || !isValidUuid(documentId)) return jsonResponse(400, headers, { error: 'invalid_document_id' });
  if (request.method !== 'GET') return jsonResponse(405, headers, { error: 'method_not_allowed' });
  try {
    const doc = await getDocumentById(getPool(), documentId);
    if (!doc) throw notFound();
    await assertDocumentReadable(doc, role, user.id);
    const url = buildDocumentReadUrl(doc.storage_path, READ_URL_SECONDS);
    if (!url) throw unprocessable('storage_not_configured');
    await writeDocumentConsent(getPool(), {
      documentId: doc.id,
      actorUserId: user.id,
      actorRole: role,
      consentType: 'FIRST_USE_OR_ACCESS_NOTICE',
      noticeVersion: NOTICE_VERSION,
      consentText: VIEW_NOTICE_TEXT,
      ipAddress: clientIp(request),
      userAgent: userAgent(request),
    });
    await writeDocumentAudit(getPool(), {
      documentId: doc.id,
      actorUserId: user.id,
      actorRole: role,
      eventType: request.query.get('disposition') === 'download' ? 'DOCUMENT_DOWNLOAD_URL_ISSUED' : 'DOCUMENT_PREVIEW_URL_ISSUED',
      after: { expires_in_seconds: READ_URL_SECONDS },
      ipAddress: clientIp(request),
      userAgent: userAgent(request),
    });
    return jsonResponse(200, headers, {
      url,
      expires_in_seconds: READ_URL_SECONDS,
      content_type: doc.content_type,
      filename: doc.original_filename,
      preview: canPreviewContentType(doc.content_type),
    });
  } catch (e) {
    const mapped = mapDomainError(e, headers);
    if (mapped) return mapped;
    throw e;
  }
}

async function portalDocumentShare(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;
  const role = String(user.role ?? '').toUpperCase();
  const documentId = request.params.documentId;
  if (!documentId || !isValidUuid(documentId)) return jsonResponse(400, headers, { error: 'invalid_document_id' });
  if (request.method !== 'GET' && request.method !== 'POST') return jsonResponse(405, headers, { error: 'method_not_allowed' });
  try {
    if (role !== Role.LANDLORD && role !== Role.ADMIN) throw forbidden('only_management_can_manage_document_share_links');
    const doc = await getDocumentById(getPool(), documentId);
    if (!doc || (role === Role.LANDLORD && doc.landlord_id !== user.id)) throw notFound();
    if (request.method === 'GET') {
      const links = await listShareLinksForDocument(getPool(), doc.id);
      return jsonResponse(200, headers, {
        links: links.map((link) => ({
          id: link.id,
          document_id: link.document_id,
          expires_at: new Date(link.expires_at).toISOString(),
          revoked_at: link.revoked_at ? new Date(link.revoked_at).toISOString() : null,
          created_at: new Date(link.created_at).toISOString(),
          last_accessed_at: link.last_accessed_at ? new Date(link.last_accessed_at).toISOString() : null,
          access_count: link.access_count,
          failed_passcode_count: link.failed_passcode_count,
          passcode_required: Boolean(link.passcode_required),
          active: !link.revoked_at && new Date(link.expires_at).getTime() >= Date.now(),
        })),
      });
    }
    if (role !== Role.LANDLORD) throw forbidden('only_landlords_can_create_document_share_links');
    if (doc.deleted_at || doc.scan_status !== 'CLEAN') throw validationError('document_not_available_for_sharing');
    const body = await readJsonBody(request);
    const b = asRecord(body);
    const days = Math.min(30, Math.max(1, int(b.expires_in_days) || 7));
    const expiresAt = new Date(Date.now() + Math.min(SHARE_LINK_MAX_SECONDS, days * 86400) * 1000);
    const token = randomToken();
    const requirePasscode = bool(b.require_passcode) === true;
    const passcode = requirePasscode ? randomPasscode() : null;
    const link = await insertShareLink(getPool(), {
      documentId: doc.id,
      tokenHash: sha256Base64Url(token),
      passcodeHash: passcode ? sha256Base64Url(passcode) : null,
      expiresAt,
      landlordId: user.id,
    });
    await writeDocumentAudit(getPool(), {
      documentId: doc.id,
      actorUserId: user.id,
      actorRole: role,
      eventType: 'SHARE_LINK_CREATED',
      after: { share_link_id: link.id, expires_at: expiresAt.toISOString(), passcode_required: requirePasscode },
      ipAddress: clientIp(request),
      userAgent: userAgent(request),
    });
    return jsonResponse(201, headers, {
      share: {
        id: link.id,
        token,
        passcode,
        path: `/d/${token}`,
        expires_at: new Date(link.expires_at).toISOString(),
        passcode_required: requirePasscode,
      },
    });
  } catch (e) {
    const mapped = mapDomainError(e, headers);
    if (mapped) return mapped;
    throw e;
  }
}

async function portalDocumentShareItem(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;
  const role = String(user.role ?? '').toUpperCase();
  const linkId = request.params.linkId;
  if (!linkId || !isValidUuid(linkId)) return jsonResponse(400, headers, { error: 'invalid_share_link_id' });
  if (request.method !== 'DELETE') return jsonResponse(405, headers, { error: 'method_not_allowed' });
  if (role !== Role.LANDLORD && role !== Role.ADMIN) return jsonResponse(403, headers, { error: 'forbidden' });
  const link = await getShareLinkById(getPool(), linkId);
  if (!link || (role === Role.LANDLORD && link.landlord_id !== user.id)) return jsonResponse(404, headers, { error: 'not_found' });
  await revokeShareLink(getPool(), linkId, user.id);
  await writeDocumentAudit(getPool(), {
    documentId: link.document_id,
    actorUserId: user.id,
    actorRole: role,
    eventType: 'SHARE_LINK_REVOKED',
    after: { share_link_id: link.id },
    ipAddress: clientIp(request),
    userAgent: userAgent(request),
  });
  return jsonResponse(200, headers, { ok: true });
}

async function publicSharedDocument(request: HttpRequest): Promise<HttpResponseInit> {
  const headers = corsHeadersForRequest(request);
  if (request.method === 'OPTIONS') return { status: 204, headers };
  if (request.method !== 'POST') return jsonResponse(405, headers, { error: 'method_not_allowed' });
  const token = request.params.token;
  if (!token) return jsonResponse(404, headers, { error: 'not_found' });
  const body = await readJsonBody(request);
  const b = asRecord(body);
  try {
    const link = await getShareLinkByToken(getPool(), token);
    if (!link || link.revoked_at || new Date(link.expires_at).getTime() < Date.now()) throw notFound();
    if (link.passcode_hash) {
      const passcode = str(b.passcode);
      if (!passcode || sha256Base64Url(passcode) !== link.passcode_hash) {
        await recordShareLinkAccess(getPool(), link.id, true);
        return jsonResponse(403, headers, { error: 'invalid_passcode', passcode_required: true });
      }
    }
    if (bool(b.notice_accepted) !== true) return jsonResponse(400, headers, { error: 'share_notice_required' });
    const doc = await getDocumentById(getPool(), link.document_id);
    if (!doc || doc.deleted_at || doc.scan_status !== 'CLEAN') throw notFound();
    const url = buildDocumentReadUrl(doc.storage_path, READ_URL_SECONDS);
    if (!url) throw unprocessable('storage_not_configured');
    await recordShareLinkAccess(getPool(), link.id, false);
    await writeDocumentConsent(getPool(), {
      documentId: doc.id,
      shareLinkId: link.id,
      actorUserId: null,
      actorRole: 'SHARE_RECIPIENT',
      consentType: 'SHARE_RECIPIENT_NOTICE',
      noticeVersion: NOTICE_VERSION,
      consentText: VIEW_NOTICE_TEXT,
      ipAddress: clientIp(request),
      userAgent: userAgent(request),
    });
    await writeDocumentAudit(getPool(), {
      documentId: doc.id,
      actorUserId: null,
      actorRole: 'SHARE_RECIPIENT',
      eventType: 'SHARE_LINK_ACCESSED',
      after: { share_link_id: link.id, expires_in_seconds: READ_URL_SECONDS },
      ipAddress: clientIp(request),
      userAgent: userAgent(request),
    });
    return jsonResponse(200, headers, {
      document: {
        title: doc.title,
        original_filename: doc.original_filename,
        content_type: doc.content_type,
        file_size_bytes: doc.file_size_bytes,
        can_preview: canPreviewContentType(doc.content_type),
      },
      url,
      expires_in_seconds: READ_URL_SECONDS,
    });
  } catch (e) {
    const mapped = mapDomainError(e, headers);
    if (mapped) return mapped;
    return jsonResponse(500, headers, { error: 'internal_error' });
  }
}

app.http('portalDocumentsCollection', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/documents',
  handler: withRateLimit(portalDocumentsCollection),
});

app.http('portalDocumentUploadIntent', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/documents/uploads/intent',
  handler: withRateLimit(portalDocumentUploadIntent),
});

app.http('portalDocumentFinalize', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/documents/finalize',
  handler: withRateLimit(portalDocumentFinalize),
});

app.http('portalDocumentItem', {
  methods: ['GET', 'PATCH', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/documents/{documentId}',
  handler: withRateLimit(portalDocumentItem),
});

app.http('portalDocumentRestore', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/documents/{documentId}/restore',
  handler: withRateLimit(portalDocumentRestore),
});

app.http('portalDocumentFileUrl', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/documents/{documentId}/file-url',
  handler: withRateLimit(portalDocumentFileUrl),
});

app.http('portalDocumentShare', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/documents/{documentId}/share-links',
  handler: withRateLimit(portalDocumentShare),
});

app.http('portalDocumentShareItem', {
  methods: ['DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/document-share-links/{linkId}',
  handler: withRateLimit(portalDocumentShareItem),
});

app.http('publicSharedDocument', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'public/document-shares/{token}',
  handler: withRateLimit(publicSharedDocument),
});
