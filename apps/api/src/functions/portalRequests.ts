import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { getPool } from '../lib/db.js';
import { jsonResponse, requirePortalUser } from '../lib/managementRequest.js';
import {
  countRequestAttachmentMedia,
  findStatusIdByCode,
  findTenantLandlordContact,
  findTenantRequestDefaults,
  getRequestById,
  insertMaintenanceRequest,
  insertRequestAttachment,
  insertRequestMessage,
  listActiveRequestPriorities,
  listActiveServiceCategories,
  listRequestAttachments,
  listRequestMessages,
  listRequestsForTenant,
  tenantCanAccessRequest,
  tenantCanSubmitForLease,
} from '../lib/requestsRepo.js';
import {
  detectMediaType,
  MAX_REQUEST_PHOTOS,
  MAX_REQUEST_VIDEOS,
  maxBytesForMediaType,
  validateCreateRequest,
  validateMessageBody,
  validateRequestId,
  validateUploadFile,
  validateFinalizeUpload,
} from '../domain/requestValidation.js';
import {
  canCreateMaintenanceRequest,
  canPostInternalMessages,
  canViewInternalMessages,
  type PortalRole,
} from '../lib/requestAccessPolicy.js';
import { enqueueNotification } from '../lib/notificationRepo.js';
import { writeAudit } from '../lib/auditRepo.js';
import { logError, logInfo, logWarn } from '../lib/serverLogger.js';
import { Role, RequestStatus } from '../domain/constants.js';

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


async function resolveLookupIdByCode(
  sql: ReturnType<typeof getPool>,
  tableName: 'service_categories' | 'request_priorities',
  code: string
): Promise<string | null> {
  const r = await sql.query<{ id: string }>(
    `SELECT id FROM ${tableName} WHERE UPPER(code) = UPPER($1) AND active = 1`,
    [code]
  );
  return r.rows[0]?.id ?? null;
}

async function portalRequestsCollection(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;
  const role = String(user.role ?? '').toUpperCase() as PortalRole;
  const pool = getPool();

  if (request.method === 'GET') {
    if (!canCreateMaintenanceRequest(role)) {
      return jsonResponse(403, headers, { error: 'forbidden' });
    }
    const rows = await listRequestsForTenant(pool, user.id);
    return jsonResponse(200, headers, { requests: rows });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, headers, { error: 'method_not_allowed' });
  }
  if (!canCreateMaintenanceRequest(role)) {
    return jsonResponse(403, headers, { error: 'forbidden' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, headers, { error: 'invalid_json' });
  }
  const b = asRecord(body);
  const leaseId = str(b.lease_id);
  const propertyId = str(b.property_id);
  const categoryCode = str(b.category_code);
  const priorityCode = str(b.priority_code);
  const title = str(b.title);
  const description = str(b.description);
  const emergencyAcknowledged = bool(b.emergency_disclaimer_acknowledged) ?? false;

  const createValidation = validateCreateRequest({ leaseId, propertyId, categoryCode, priorityCode, title, description });
  if (!createValidation.valid) {
    return jsonResponse(400, headers, { error: createValidation.message });
  }

  const canSubmit = await tenantCanSubmitForLease(pool, leaseId!, user.id);
  if (!canSubmit) {
    return jsonResponse(403, headers, { error: 'forbidden_lease_access' });
  }

  const categoryId = await resolveLookupIdByCode(pool, 'service_categories', categoryCode!);
  const priorityId = await resolveLookupIdByCode(pool, 'request_priorities', priorityCode!);
  const openStatusId = await findStatusIdByCode(pool, RequestStatus.OPEN);
  if (!categoryId || !priorityId || !openStatusId) {
    return jsonResponse(400, headers, { error: 'invalid_lookup_codes' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const created = await insertMaintenanceRequest(client, {
      propertyId: propertyId!,
      leaseId: leaseId!,
      submittedByUserId: user.id,
      categoryId,
      priorityId,
      currentStatusId: openStatusId,
      title: title!,
      description: description!,
      emergencyAcknowledged,
    });
    await writeAudit(client, {
      actorUserId: user.id,
      entityType: 'MAINTENANCE_REQUEST',
      entityId: created.id,
      action: 'CREATE',
      before: null,
      after: created,
    });
    await enqueueNotification(client, {
      eventTypeCode: 'REQUEST_CREATED',
      payload: {
        request_id: created.id,
        property_id: created.property_id,
        lease_id: created.lease_id,
        title: created.title,
      },
      idempotencyKey: `request-created:${created.id}`,
    });
    await client.query('COMMIT');
    return jsonResponse(201, headers, { request: created });
  } catch (error) {
    await client.query('ROLLBACK');
    logError(context, 'portal.requests.create.error', {
      userId: user.id,
      message: error instanceof Error ? error.message : 'unknown_error',
    });
    throw error;
  } finally {
    client.release();
  }
}

async function portalRequestLookups(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;
  const role = String(user.role ?? '').toUpperCase() as PortalRole;
  if (request.method !== 'GET') {
    return jsonResponse(405, headers, { error: 'method_not_allowed' });
  }
  if (!canCreateMaintenanceRequest(role)) {
    return jsonResponse(403, headers, { error: 'forbidden' });
  }

  const pool = getPool();
  const [categories, priorities] = await Promise.all([
    listActiveServiceCategories(pool),
    listActiveRequestPriorities(pool),
  ]);
  let tenantDefaults: Awaited<ReturnType<typeof findTenantRequestDefaults>> = null;
  let landlordContact: Awaited<ReturnType<typeof findTenantLandlordContact>> = null;
  if (role === Role.TENANT) {
    [tenantDefaults, landlordContact] = await Promise.all([
      findTenantRequestDefaults(pool, user.id),
      findTenantLandlordContact(pool, user.id),
    ]);
  }
  return jsonResponse(200, headers, {
    categories,
    priorities,
    tenant_defaults: tenantDefaults,
    landlord_contact: landlordContact,
  });
}

async function portalRequestItem(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;
  const requestId = request.params.id;
  const idValidation = validateRequestId(requestId);
  if (!idValidation.valid) {
    return jsonResponse(idValidation.message === 'missing_id' ? 400 : 404, headers, { error: idValidation.message });
  }

  const pool = getPool();
  const role = String(user.role ?? '').toUpperCase() as PortalRole;
  if (!canViewInternalMessages(role)) {
    const allowed = await tenantCanAccessRequest(pool, requestId!, user.id);
    if (!allowed) return jsonResponse(404, headers, { error: 'not_found' });
  }

  if (request.method !== 'GET') {
    return jsonResponse(405, headers, { error: 'method_not_allowed' });
  }
  const row = await getRequestById(pool, requestId);
  if (!row) return jsonResponse(404, headers, { error: 'not_found' });
  if (!canViewInternalMessages(role)) {
    return jsonResponse(200, headers, {
      request: { ...row, internal_notes: null },
    });
  }
  return jsonResponse(200, headers, { request: row });
}

async function portalRequestMessages(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;
  const role = String(user.role ?? '').toUpperCase() as PortalRole;
  const requestId = request.params.id;
  const msgIdValidation = validateRequestId(requestId);
  if (!msgIdValidation.valid) {
    return jsonResponse(msgIdValidation.message === 'missing_id' ? 400 : 404, headers, { error: msgIdValidation.message });
  }

  const pool = getPool();
  if (!canViewInternalMessages(role)) {
    const allowed = await tenantCanAccessRequest(pool, requestId!, user.id);
    if (!allowed) return jsonResponse(404, headers, { error: 'not_found' });
  }

  if (request.method === 'GET') {
    const messages = await listRequestMessages(pool, requestId!, canViewInternalMessages(role));
    return jsonResponse(200, headers, { messages });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, headers, { error: 'method_not_allowed' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, headers, { error: 'invalid_json' });
  }
  const b = asRecord(body);
  const messageBody = str(b.body);
  const isInternalRequested = bool(b.is_internal) ?? false;
  const isInternal = canPostInternalMessages(role) ? isInternalRequested : false;
  const msgBodyValidation = validateMessageBody(messageBody);
  if (!msgBodyValidation.valid) {
    return jsonResponse(400, headers, { error: msgBodyValidation.message });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const created = await insertRequestMessage(client, {
      requestId: requestId!,
      senderUserId: user.id,
      body: messageBody!,
      isInternal,
      source: 'PORTAL',
    });
    await writeAudit(client, {
      actorUserId: user.id,
      entityType: 'REQUEST_MESSAGE',
      entityId: created.id,
      action: 'CREATE',
      before: null,
      after: created,
    });
    await enqueueNotification(client, {
      eventTypeCode: isInternal ? 'REQUEST_INTERNAL_NOTE' : 'REQUEST_MESSAGE_CREATED',
      payload: {
        request_id: requestId,
        message_id: created.id,
        sender_user_id: user.id,
      },
      idempotencyKey: `request-message:${created.id}`,
    });
    await client.query('COMMIT');
    return jsonResponse(201, headers, { message: created });
  } catch (error) {
    await client.query('ROLLBACK');
    logError(context, 'portal.requests.messages.create.error', {
      requestId,
      userId: user.id,
      message: error instanceof Error ? error.message : 'unknown_error',
    });
    throw error;
  } finally {
    client.release();
  }
}

async function portalRequestUploadIntent(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;
  if (request.method !== 'POST') return jsonResponse(405, headers, { error: 'method_not_allowed' });

  const requestId = request.params.id;
  const intentIdValidation = validateRequestId(requestId);
  if (!intentIdValidation.valid) {
    return jsonResponse(intentIdValidation.message === 'missing_id' ? 400 : 404, headers, { error: intentIdValidation.message });
  }

  const pool = getPool();
  const role = String(user.role ?? '').toUpperCase() as PortalRole;
  if (!canViewInternalMessages(role)) {
    const allowed = await tenantCanAccessRequest(pool, requestId!, user.id);
    if (!allowed) return jsonResponse(404, headers, { error: 'not_found' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, headers, { error: 'invalid_json' });
  }
  const b = asRecord(body);
  const filename = str(b.filename);
  const contentType = str(b.content_type);
  const fileSizeBytes = Number(b.file_size_bytes ?? 0);
  const uploadValidation = validateUploadFile({ filename, contentType, fileSizeBytes });
  if (!uploadValidation.valid) {
    if (uploadValidation.message === 'file_too_large') {
      const maxBytes = maxBytesForMediaType(detectMediaType(contentType!)!);
      return jsonResponse(400, headers, { error: 'file_too_large', max_bytes: maxBytes });
    }
    return jsonResponse(400, headers, { error: uploadValidation.message });
  }

  const mediaType = detectMediaType(contentType!)!;
  const counts = await countRequestAttachmentMedia(pool, requestId!);
  if (mediaType === 'PHOTO' && counts.photos >= MAX_REQUEST_PHOTOS) {
    return jsonResponse(400, headers, { error: 'photo_limit_exceeded', max: MAX_REQUEST_PHOTOS });
  }
  if (mediaType === 'VIDEO' && counts.videos >= MAX_REQUEST_VIDEOS) {
    return jsonResponse(400, headers, { error: 'video_limit_exceeded', max: MAX_REQUEST_VIDEOS });
  }

  const safeFileName = filename!.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uploadKey = `${requestId!}/${Date.now()}-${safeFileName}`;
  const uploadUrl = `https://example.invalid/uploads/${encodeURIComponent(uploadKey)}`;
  logInfo(context, 'portal.requests.upload_intent.created', {
    requestId: requestId!,
    userId: user.id,
    mediaType,
    bytes: fileSizeBytes,
  });
  return jsonResponse(200, headers, {
    upload: {
      upload_url: uploadUrl,
      storage_path: uploadKey,
      media_type: mediaType,
      expires_in_seconds: 300,
    },
  });
}

async function portalRequestAttachmentFinalize(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;
  logInfo(context, 'portal.requests.attachments.finalize.start', {
    userId: user.id,
    method: request.method,
  });
  if (request.method !== 'POST') {
    logWarn(context, 'portal.requests.attachments.finalize.method_not_allowed', {
      userId: user.id,
      method: request.method,
    });
    return jsonResponse(405, headers, { error: 'method_not_allowed' });
  }

  const requestId = request.params.id;
  const finalizeIdValidation = validateRequestId(requestId);
  if (!finalizeIdValidation.valid) {
    if (finalizeIdValidation.message === 'missing_id') {
      logWarn(context, 'portal.requests.attachments.finalize.missing_id', { userId: user.id });
    }
    return jsonResponse(finalizeIdValidation.message === 'missing_id' ? 400 : 404, headers, { error: finalizeIdValidation.message });
  }
  const pool = getPool();
  const role = String(user.role ?? '').toUpperCase() as PortalRole;
  if (!canViewInternalMessages(role)) {
    const allowed = await tenantCanAccessRequest(pool, requestId!, user.id);
    if (!allowed) {
      logWarn(context, 'portal.requests.attachments.finalize.not_found', {
        userId: user.id,
        requestId: requestId!,
      });
      return jsonResponse(404, headers, { error: 'not_found' });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, headers, { error: 'invalid_json' });
  }
  const b = asRecord(body);
  const storagePath = str(b.storage_path);
  const filename = str(b.filename);
  const contentType = str(b.content_type);
  const fileSizeBytes = Number(b.file_size_bytes ?? 0);
  const finalizeValidation = validateFinalizeUpload({ storagePath, filename, contentType, fileSizeBytes });
  if (!finalizeValidation.valid) {
    const mediaType = contentType ? detectMediaType(contentType) : null;
    if (finalizeValidation.message === 'file_too_large' && mediaType) {
      const maxBytes = maxBytesForMediaType(mediaType);
      logWarn(context, 'portal.requests.attachments.finalize.validation_failed', {
        userId: user.id,
        requestId: requestId!,
        reason: 'file_too_large',
        fileSizeBytes,
        maxBytes,
        mediaType,
      });
      return jsonResponse(400, headers, { error: 'file_too_large', max_bytes: maxBytes });
    }
    logWarn(context, 'portal.requests.attachments.finalize.validation_failed', {
      userId: user.id,
      requestId: requestId!,
      reason: finalizeValidation.message,
    });
    return jsonResponse(400, headers, { error: finalizeValidation.message });
  }
  const mediaType = detectMediaType(contentType!)!;
  const counts = await countRequestAttachmentMedia(pool, requestId!);
  if (mediaType === 'PHOTO' && counts.photos >= MAX_REQUEST_PHOTOS) {
    logWarn(context, 'portal.requests.attachments.finalize.validation_failed', {
      userId: user.id,
      requestId: requestId!,
      reason: 'photo_limit_exceeded',
      max: MAX_REQUEST_PHOTOS,
    });
    return jsonResponse(400, headers, { error: 'photo_limit_exceeded', max: MAX_REQUEST_PHOTOS });
  }
  if (mediaType === 'VIDEO' && counts.videos >= MAX_REQUEST_VIDEOS) {
    logWarn(context, 'portal.requests.attachments.finalize.validation_failed', {
      userId: user.id,
      requestId: requestId!,
      reason: 'video_limit_exceeded',
      max: MAX_REQUEST_VIDEOS,
    });
    return jsonResponse(400, headers, { error: 'video_limit_exceeded', max: MAX_REQUEST_VIDEOS });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const created = await insertRequestAttachment(client, {
      requestId: requestId!,
      uploadedByUserId: user.id,
      storagePath: storagePath!,
      originalFilename: filename!,
      contentType: contentType!,
      fileSizeBytes,
      mediaType,
    });
    await writeAudit(client, {
      actorUserId: user.id,
      entityType: 'REQUEST_ATTACHMENT',
      entityId: created.id,
      action: 'CREATE',
      before: null,
      after: created,
    });
    await enqueueNotification(client, {
      eventTypeCode: 'REQUEST_ATTACHMENT_ADDED',
      payload: {
        request_id: requestId,
        attachment_id: created.id,
      },
      idempotencyKey: `request-attachment:${created.id}`,
    });
    await client.query('COMMIT');
    logInfo(context, 'portal.requests.attachments.finalize.success', {
      userId: user.id,
      requestId,
      attachmentId: created.id,
      mediaType,
      fileSizeBytes,
    });
    return jsonResponse(201, headers, { attachment: created });
  } catch (error) {
    await client.query('ROLLBACK');
    logError(context, 'portal.requests.attachments.create.error', {
      requestId,
      userId: user.id,
      message: error instanceof Error ? error.message : 'unknown_error',
    });
    throw error;
  } finally {
    client.release();
  }
}

async function portalRequestAttachmentsList(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;
  logInfo(context, 'portal.requests.attachments.list.start', {
    userId: user.id,
    method: request.method,
  });
  if (request.method !== 'GET') {
    logWarn(context, 'portal.requests.attachments.list.method_not_allowed', {
      userId: user.id,
      method: request.method,
    });
    return jsonResponse(405, headers, { error: 'method_not_allowed' });
  }

  const requestId = request.params.id;
  const listIdValidation = validateRequestId(requestId);
  if (!listIdValidation.valid) {
    if (listIdValidation.message === 'missing_id') {
      logWarn(context, 'portal.requests.attachments.list.missing_id', { userId: user.id });
    }
    return jsonResponse(listIdValidation.message === 'missing_id' ? 400 : 404, headers, { error: listIdValidation.message });
  }
  const pool = getPool();
  const role = String(user.role ?? '').toUpperCase() as PortalRole;
  if (!canViewInternalMessages(role)) {
    const allowed = await tenantCanAccessRequest(pool, requestId!, user.id);
    if (!allowed) {
      logWarn(context, 'portal.requests.attachments.list.not_found', {
        userId: user.id,
        requestId: requestId!,
      });
      return jsonResponse(404, headers, { error: 'not_found' });
    }
  }
  const attachments = await listRequestAttachments(pool, requestId!);
  logInfo(context, 'portal.requests.attachments.list.success', {
    userId: user.id,
    requestId: requestId!,
    count: attachments.length,
  });
  return jsonResponse(200, headers, { attachments });
}

app.http('portalRequestsCollection', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/requests',
  handler: portalRequestsCollection,
});

app.http('portalRequestItem', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/requests/{id}',
  handler: portalRequestItem,
});

app.http('portalRequestLookups', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/request-lookups',
  handler: portalRequestLookups,
});

app.http('portalRequestMessages', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/requests/{id}/messages',
  handler: portalRequestMessages,
});

app.http('portalRequestUploadIntent', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/requests/{id}/uploads/intent',
  handler: portalRequestUploadIntent,
});

app.http('portalRequestAttachmentFinalize', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/requests/{id}/attachments/finalize',
  handler: portalRequestAttachmentFinalize,
});

app.http('portalRequestAttachmentsList', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/requests/{id}/attachments',
  handler: portalRequestAttachmentsList,
});

