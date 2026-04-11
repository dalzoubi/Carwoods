import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { getPool } from '../lib/db.js';
import { jsonResponse, mapDomainError, requirePortalUser } from '../lib/managementRequest.js';
import { readJsonBody } from '../lib/readBody.js';
import { withRateLimit } from '../lib/rateLimiter.js';
import { logError, logInfo, logWarn } from '../lib/serverLogger.js';
import type { PortalRole } from '../lib/requestAccessPolicy.js';

import { listRequests } from '../useCases/requests/listRequests.js';
import { getRequest } from '../useCases/requests/getRequest.js';
import { createRequest } from '../useCases/requests/createRequest.js';
import { cancelRequest } from '../useCases/requests/cancelRequest.js';
import { listRequestLookups } from '../useCases/requests/listRequestLookups.js';
import { listRequestMessages } from '../useCases/requests/listRequestMessages.js';
import { postRequestMessage } from '../useCases/requests/postRequestMessage.js';
import { deleteRequestMessage } from '../useCases/requests/deleteRequestMessage.js';
import { requestUploadIntent } from '../useCases/requests/requestUploadIntent.js';
import { finalizeRequestAttachment } from '../useCases/requests/finalizeRequestAttachment.js';
import { listRequestAttachments } from '../useCases/requests/listRequestAttachments.js';
import { deleteRequestAttachment } from '../useCases/requests/deleteRequestAttachment.js';
import { createRequestAttachmentShareLink } from '../useCases/requests/createRequestAttachmentShareLink.js';

const MESSAGE_BODY_MAX_BYTES = 512 * 1024;

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

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
    try {
      const result = await listRequests(pool, { actorUserId: user.id, actorRole: role });
      return jsonResponse(200, headers, { requests: result.requests });
    } catch (e) {
      const mapped = mapDomainError(e, headers);
      if (mapped) return mapped;
      throw e;
    }
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, headers, { error: 'method_not_allowed' });
  }

  let body: unknown;
  try {
    body = await readJsonBody(request, MESSAGE_BODY_MAX_BYTES);
  } catch (e) {
    const mapped = mapDomainError(e, headers);
    if (mapped) return mapped;
    throw e;
  }
  if (body === null) {
    return jsonResponse(400, headers, { error: 'invalid_json' });
  }
  const b = asRecord(body);

  try {
    const result = await createRequest(pool, {
      actorUserId: user.id,
      actorRole: role,
      leaseId: str(b.lease_id),
      propertyId: str(b.property_id),
      categoryCode: str(b.category_code),
      priorityCode: str(b.priority_code),
      title: str(b.title),
      description: str(b.description),
      emergencyAcknowledged: bool(b.emergency_disclaimer_acknowledged) ?? false,
    });
    return jsonResponse(201, headers, { request: result.request });
  } catch (e) {
    const mapped = mapDomainError(e, headers);
    if (mapped) return mapped;
    logError(context, 'portal.requests.create.error', {
      userId: user.id,
      message: e instanceof Error ? e.message : 'unknown_error',
    });
    throw e;
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

  try {
    const result = await listRequestLookups(getPool(), { actorUserId: user.id, actorRole: role });
    return jsonResponse(200, headers, result);
  } catch (e) {
    const mapped = mapDomainError(e, headers);
    if (mapped) {
      const err = e as { status?: number; code?: string };
      logWarn(context, 'portal.requests.upload_intent.failed', {
        requestId: request.params.id,
        userId: user.id,
        status: typeof err?.status === 'number' ? err.status : undefined,
        code: typeof err?.code === 'string' ? err.code : undefined,
        message: e instanceof Error ? e.message : 'unknown_error',
      });
      return mapped;
    }
    logError(context, 'portal.requests.upload_intent.error', {
      requestId: request.params.id,
      userId: user.id,
      message: e instanceof Error ? e.message : 'unknown_error',
    });
    throw e;
  }
}

async function portalRequestItem(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;
  const role = String(user.role ?? '').toUpperCase() as PortalRole;

  if (request.method === 'GET') {
    try {
      const result = await getRequest(getPool(), {
        requestId: request.params.id,
        actorUserId: user.id,
        actorRole: role,
      });
      return jsonResponse(200, headers, { request: result.request });
    } catch (e) {
      const mapped = mapDomainError(e, headers);
      if (mapped) return mapped;
      throw e;
    }
  }

  if (request.method === 'PATCH') {
    let body: unknown;
    try {
      body = await readJsonBody(request, MESSAGE_BODY_MAX_BYTES);
    } catch (e) {
      const mapped = mapDomainError(e, headers);
      if (mapped) return mapped;
      throw e;
    }
    if (body === null) {
      return jsonResponse(400, headers, { error: 'invalid_json' });
    }
    const b = asRecord(body);
    const action = str(b.action);

    if (action === 'cancel') {
      try {
        const result = await cancelRequest(getPool(), {
          requestId: request.params.id,
          actorUserId: user.id,
          actorRole: role,
        });
        logInfo(context, 'portal.requests.cancel.success', {
          userId: user.id,
          requestId: request.params.id,
        });
        return jsonResponse(200, headers, { request: result.request });
      } catch (e) {
        const mapped = mapDomainError(e, headers);
        if (mapped) return mapped;
        logError(context, 'portal.requests.cancel.error', {
          userId: user.id,
          requestId: request.params.id,
          message: e instanceof Error ? e.message : 'unknown_error',
        });
        throw e;
      }
    }

    return jsonResponse(400, headers, { error: 'unknown_action' });
  }

  return jsonResponse(405, headers, { error: 'method_not_allowed' });
}

async function portalRequestMessages(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;
  const role = String(user.role ?? '').toUpperCase() as PortalRole;

  if (request.method === 'GET') {
    try {
      const result = await listRequestMessages(getPool(), {
        requestId: request.params.id,
        actorUserId: user.id,
        actorRole: role,
      });
      return jsonResponse(200, headers, { messages: result.messages });
    } catch (e) {
      const mapped = mapDomainError(e, headers);
      if (mapped) return mapped;
      throw e;
    }
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, headers, { error: 'method_not_allowed' });
  }

  let body: unknown;
  try {
    body = await readJsonBody(request, MESSAGE_BODY_MAX_BYTES);
  } catch (e) {
    const mapped = mapDomainError(e, headers);
    if (mapped) return mapped;
    throw e;
  }
  if (body === null) {
    return jsonResponse(400, headers, { error: 'invalid_json' });
  }
  const b = asRecord(body);

  try {
    const result = await postRequestMessage(getPool(), {
      requestId: request.params.id,
      actorUserId: user.id,
      actorRole: role,
      body: str(b.body),
      isInternalRequested: bool(b.is_internal) ?? false,
    });
    return jsonResponse(201, headers, { message: result.message });
  } catch (e) {
    const mapped = mapDomainError(e, headers);
    if (mapped) return mapped;
    logError(context, 'portal.requests.messages.create.error', {
      requestId: request.params.id,
      userId: user.id,
      message: e instanceof Error ? e.message : 'unknown_error',
    });
    throw e;
  }
}

async function portalRequestMessageItem(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;
  const role = String(user.role ?? '').toUpperCase() as PortalRole;

  if (request.method !== 'DELETE') {
    return jsonResponse(405, headers, { error: 'method_not_allowed' });
  }

  try {
    const result = await deleteRequestMessage(getPool(), {
      requestId: request.params.id,
      messageId: request.params.messageId,
      actorUserId: user.id,
      actorRole: role,
    });
    return jsonResponse(200, headers, result);
  } catch (e) {
    const mapped = mapDomainError(e, headers);
    if (mapped) return mapped;
    logError(context, 'portal.requests.messages.delete.error', {
      requestId: request.params.id,
      messageId: request.params.messageId,
      userId: user.id,
      message: e instanceof Error ? e.message : 'unknown_error',
    });
    throw e;
  }
}

async function portalRequestUploadIntent(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;
  const role = String(user.role ?? '').toUpperCase() as PortalRole;

  if (request.method !== 'POST') return jsonResponse(405, headers, { error: 'method_not_allowed' });

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (e) {
    const mapped = mapDomainError(e, headers);
    if (mapped) return mapped;
    throw e;
  }
  if (body === null) {
    return jsonResponse(400, headers, { error: 'invalid_json' });
  }
  const b = asRecord(body);

  try {
    const result = await requestUploadIntent(getPool(), {
      requestId: request.params.id,
      actorUserId: user.id,
      actorRole: role,
      filename: str(b.filename),
      contentType: str(b.content_type),
      fileSizeBytes: Number(b.file_size_bytes ?? 0),
      fileDurationSeconds: Number.isFinite(Number(b.file_duration_seconds))
        ? Number(b.file_duration_seconds)
        : undefined,
    });
    logInfo(context, 'portal.requests.upload_intent.created', {
      requestId: request.params.id,
      userId: user.id,
      mediaType: result.media_type,
      bytes: Number(b.file_size_bytes ?? 0),
    });
    return jsonResponse(200, headers, { upload: result });
  } catch (e) {
    const mapped = mapDomainError(e, headers);
    if (mapped) return mapped;
    throw e;
  }
}

async function portalRequestAttachmentFinalize(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;
  const role = String(user.role ?? '').toUpperCase() as PortalRole;

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

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (e) {
    const mapped = mapDomainError(e, headers);
    if (mapped) return mapped;
    throw e;
  }
  if (body === null) {
    return jsonResponse(400, headers, { error: 'invalid_json' });
  }
  const b = asRecord(body);

  try {
    const result = await finalizeRequestAttachment(getPool(), {
      requestId: request.params.id,
      actorUserId: user.id,
      actorRole: role,
      storagePath: str(b.storage_path),
      filename: str(b.filename),
      contentType: str(b.content_type),
      fileSizeBytes: Number(b.file_size_bytes ?? 0),
      fileDurationSeconds: Number.isFinite(Number(b.file_duration_seconds))
        ? Number(b.file_duration_seconds)
        : undefined,
    });
    logInfo(context, 'portal.requests.attachments.finalize.success', {
      userId: user.id,
      requestId: request.params.id,
      attachmentId: result.attachment.id,
      mediaType: result.attachment.media_type,
      fileSizeBytes: result.attachment.file_size_bytes,
    });
    return jsonResponse(201, headers, { attachment: result.attachment });
  } catch (e) {
    const mapped = mapDomainError(e, headers);
    if (mapped) {
      logWarn(context, 'portal.requests.attachments.finalize.validation_failed', {
        userId: user.id,
        requestId: request.params.id,
        reason: e instanceof Error ? e.message : 'unknown',
      });
      return mapped;
    }
    logError(context, 'portal.requests.attachments.create.error', {
      requestId: request.params.id,
      userId: user.id,
      message: e instanceof Error ? e.message : 'unknown_error',
    });
    throw e;
  }
}

async function portalRequestAttachmentsList(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;
  const role = String(user.role ?? '').toUpperCase() as PortalRole;

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

  try {
    const result = await listRequestAttachments(getPool(), {
      requestId: request.params.id,
      actorUserId: user.id,
      actorRole: role,
    });
    logInfo(context, 'portal.requests.attachments.list.success', {
      userId: user.id,
      requestId: request.params.id,
      count: result.attachments.length,
    });
    return jsonResponse(200, headers, { attachments: result.attachments });
  } catch (e) {
    const mapped = mapDomainError(e, headers);
    if (mapped) return mapped;
    throw e;
  }
}

async function portalRequestAttachmentItem(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;
  const role = String(user.role ?? '').toUpperCase() as PortalRole;

  if (request.method !== 'DELETE') {
    return jsonResponse(405, headers, { error: 'method_not_allowed' });
  }

  try {
    const result = await deleteRequestAttachment(getPool(), {
      requestId: request.params.id,
      attachmentId: request.params.attachmentId,
      actorUserId: user.id,
      actorRole: role,
    });
    return jsonResponse(200, headers, { attachment: result.attachment });
  } catch (e) {
    const mapped = mapDomainError(e, headers);
    if (mapped) return mapped;
    throw e;
  }
}

async function portalRequestAttachmentShare(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;
  const role = String(user.role ?? '').toUpperCase() as PortalRole;

  if (request.method !== 'POST') {
    return jsonResponse(405, headers, { error: 'method_not_allowed' });
  }

  try {
    const result = await createRequestAttachmentShareLink(getPool(), {
      requestId: request.params.id,
      attachmentId: request.params.attachmentId,
      actorUserId: user.id,
      actorRole: role,
    });
    return jsonResponse(200, headers, { share: result });
  } catch (e) {
    const mapped = mapDomainError(e, headers);
    if (mapped) return mapped;
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Azure Function registrations
// ---------------------------------------------------------------------------

app.http('portalRequestsCollection', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/requests',
  handler: withRateLimit(portalRequestsCollection),
});

app.http('portalRequestItem', {
  methods: ['GET', 'PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/requests/{id}',
  handler: withRateLimit(portalRequestItem),
});

app.http('portalRequestLookups', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/request-lookups',
  handler: withRateLimit(portalRequestLookups),
});

app.http('portalRequestMessages', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/requests/{id}/messages',
  handler: withRateLimit(portalRequestMessages),
});

app.http('portalRequestMessageItem', {
  methods: ['DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/requests/{id}/messages/{messageId}',
  handler: withRateLimit(portalRequestMessageItem),
});

app.http('portalRequestUploadIntent', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/requests/{id}/uploads/intent',
  handler: withRateLimit(portalRequestUploadIntent),
});

app.http('portalRequestAttachmentFinalize', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/requests/{id}/attachments/finalize',
  handler: withRateLimit(portalRequestAttachmentFinalize),
});

app.http('portalRequestAttachmentsList', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/requests/{id}/attachments',
  handler: withRateLimit(portalRequestAttachmentsList),
});

app.http('portalRequestAttachmentItem', {
  methods: ['DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/requests/{id}/attachments/{attachmentId}',
  handler: withRateLimit(portalRequestAttachmentItem),
});

app.http('portalRequestAttachmentShare', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/requests/{id}/attachments/{attachmentId}/share',
  handler: withRateLimit(portalRequestAttachmentShare),
});
