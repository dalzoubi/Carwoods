import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { getPool } from '../lib/db.js';
import {
  jsonResponse,
  mapDomainError,
  requirePortalUser,
} from '../lib/managementRequest.js';
import { logError, logInfo } from '../lib/serverLogger.js';
import {
  getSupportTicketById,
  listSupportTicketMessages,
  listSupportTicketsForUser,
  listSupportTicketAttachments,
  markAllAdminRepliesReadForUser,
  type SupportTicketStatus,
} from '../lib/supportTicketsRepo.js';
import { submitSupportTicket } from '../useCases/supportTickets/submitSupportTicket.js';
import { postSupportTicketMessage } from '../useCases/supportTickets/postSupportTicketMessage.js';
import { reopenSupportTicket } from '../useCases/supportTickets/reopenSupportTicket.js';
import {
  buildSupportTicketAttachmentDownloadUrl,
  createSupportTicketAttachmentIntent,
  finalizeSupportTicketAttachmentUpload,
} from '../useCases/supportTickets/supportTicketAttachments.js';
import { isValidStatus } from '../domain/supportTicketValidation.js';

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

// ---------------------------------------------------------------------------
// GET/POST /portal/support-tickets
// ---------------------------------------------------------------------------
async function portalSupportTicketsCollectionHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;
  const pool = getPool();

  if (request.method === 'GET') {
    try {
      const statusRaw = request.query.get('status') ?? undefined;
      const status = statusRaw && isValidStatus(statusRaw)
        ? (statusRaw.toUpperCase() as SupportTicketStatus)
        : undefined;
      const limitRaw = Number(request.query.get('limit') ?? 50);
      const offsetRaw = Number(request.query.get('offset') ?? 0);
      const { rows, total } = await listSupportTicketsForUser(pool, user.id, {
        status,
        limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
        offset: Number.isFinite(offsetRaw) ? offsetRaw : undefined,
      });
      return jsonResponse(200, headers, { tickets: rows, total });
    } catch (err) {
      logError(context, 'portal.support_tickets.list.error', {
        userId: user.id,
        message: err instanceof Error ? err.message : 'unknown',
      });
      throw err;
    }
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

  try {
    const ticket = await submitSupportTicket(
      pool,
      {
        userId: user.id,
        title: asString(b.title),
        descriptionMarkdown: asString(b.description_markdown),
        category: asString(b.category),
        area: asString(b.area) ?? null,
        diagnostics: (b.diagnostics && typeof b.diagnostics === 'object'
          ? (b.diagnostics as Record<string, unknown>)
          : null),
        recaptchaToken: asString(b.recaptcha_token) ?? null,
      },
      context
    );
    logInfo(context, 'portal.support_tickets.create.success', {
      userId: user.id,
      ticketId: ticket.id,
      category: ticket.category,
    });
    return jsonResponse(201, headers, { ticket });
  } catch (err) {
    const mapped = mapDomainError(err, headers);
    if (mapped) return mapped;
    logError(context, 'portal.support_tickets.create.error', {
      userId: user.id,
      message: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// GET /portal/support-tickets/{id}
// ---------------------------------------------------------------------------
async function portalSupportTicketItemHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;
  const id = request.params.id;
  if (!id) return jsonResponse(400, headers, { error: 'missing_id' });

  if (request.method !== 'GET') {
    return jsonResponse(405, headers, { error: 'method_not_allowed' });
  }

  try {
    const pool = getPool();
    const ticket = await getSupportTicketById(pool, id);
    if (!ticket) return jsonResponse(404, headers, { error: 'not_found' });
    if (ticket.user_id !== user.id) {
      return jsonResponse(403, headers, { error: 'forbidden' });
    }
    const [messages, attachments] = await Promise.all([
      listSupportTicketMessages(pool, id, { includeInternal: false }),
      listSupportTicketAttachments(pool, id),
    ]);
    // Mark admin replies read by the user
    await markAllAdminRepliesReadForUser(pool, id, user.id).catch(() => {});
    return jsonResponse(200, headers, { ticket, messages, attachments });
  } catch (err) {
    const mapped = mapDomainError(err, headers);
    if (mapped) return mapped;
    logError(context, 'portal.support_tickets.get.error', {
      userId: user.id,
      ticketId: id,
      message: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// POST /portal/support-tickets/{id}/messages
// ---------------------------------------------------------------------------
async function portalSupportTicketMessagesHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;
  const id = request.params.id;
  if (!id) return jsonResponse(400, headers, { error: 'missing_id' });
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

  try {
    const pool = getPool();
    const role = String(user.role ?? '').toUpperCase();
    const message = await postSupportTicketMessage(
      pool,
      {
        ticketId: id,
        authorUserId: user.id,
        authorRole: role as 'ADMIN' | 'LANDLORD' | 'TENANT' | 'AI_AGENT',
        bodyMarkdown: asString(b.body_markdown),
        isInternalNote: false, // portal users cannot post internal notes
      },
      context
    );
    return jsonResponse(201, headers, { message });
  } catch (err) {
    const mapped = mapDomainError(err, headers);
    if (mapped) return mapped;
    logError(context, 'portal.support_tickets.message.error', {
      userId: user.id,
      ticketId: id,
      message: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// POST /portal/support-tickets/{id}/reopen
// ---------------------------------------------------------------------------
async function portalSupportTicketReopenHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;
  const id = request.params.id;
  if (!id) return jsonResponse(400, headers, { error: 'missing_id' });
  if (request.method !== 'POST') {
    return jsonResponse(405, headers, { error: 'method_not_allowed' });
  }
  try {
    const pool = getPool();
    const ticket = await reopenSupportTicket(pool, {
      ticketId: id,
      actorUserId: user.id,
    });
    return jsonResponse(200, headers, { ticket });
  } catch (err) {
    const mapped = mapDomainError(err, headers);
    if (mapped) return mapped;
    logError(context, 'portal.support_tickets.reopen.error', {
      userId: user.id,
      ticketId: id,
      message: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// POST /portal/support-tickets/{id}/attachments/upload-intent
// POST /portal/support-tickets/{id}/attachments/{attId}/finalize
// GET  /portal/support-tickets/{id}/attachments/{attId}/download-url
// ---------------------------------------------------------------------------
async function portalSupportTicketUploadIntentHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;
  const id = request.params.id;
  if (!id) return jsonResponse(400, headers, { error: 'missing_id' });
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

  try {
    const pool = getPool();
    const role = String(user.role ?? '').toUpperCase();
    const { attachment, uploadUrl } = await createSupportTicketAttachmentIntent(pool, {
      ticketId: id,
      actorUserId: user.id,
      actorRole: role,
      messageId: asString(b.message_id) ?? null,
      filename: asString(b.filename) ?? '',
      contentType: asString(b.content_type) ?? '',
      sizeBytes: asNumber(b.size_bytes) ?? 0,
    });
    if (!uploadUrl) {
      return jsonResponse(503, headers, { error: 'storage_unconfigured' });
    }
    return jsonResponse(201, headers, { attachment, upload_url: uploadUrl });
  } catch (err) {
    const mapped = mapDomainError(err, headers);
    if (mapped) return mapped;
    logError(context, 'portal.support_tickets.upload_intent.error', {
      userId: user.id,
      ticketId: id,
      message: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }
}

async function portalSupportTicketFinalizeAttachmentHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;
  const attId = request.params.attId;
  if (!attId) return jsonResponse(400, headers, { error: 'missing_attachment_id' });
  if (request.method !== 'POST') {
    return jsonResponse(405, headers, { error: 'method_not_allowed' });
  }
  try {
    const pool = getPool();
    const role = String(user.role ?? '').toUpperCase();
    const attachment = await finalizeSupportTicketAttachmentUpload(pool, {
      attachmentId: attId,
      actorUserId: user.id,
      actorRole: role,
    });
    return jsonResponse(200, headers, { attachment });
  } catch (err) {
    const mapped = mapDomainError(err, headers);
    if (mapped) return mapped;
    logError(context, 'portal.support_tickets.finalize_attachment.error', {
      userId: user.id,
      attachmentId: attId,
      message: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }
}

async function portalSupportTicketDownloadUrlHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;
  const attId = request.params.attId;
  if (!attId) return jsonResponse(400, headers, { error: 'missing_attachment_id' });
  if (request.method !== 'GET') {
    return jsonResponse(405, headers, { error: 'method_not_allowed' });
  }
  try {
    const pool = getPool();
    const role = String(user.role ?? '').toUpperCase();
    const { url, attachment } = await buildSupportTicketAttachmentDownloadUrl(pool, {
      attachmentId: attId,
      actorUserId: user.id,
      actorRole: role,
    });
    return jsonResponse(200, headers, {
      url,
      expires_in_seconds: 600,
      attachment,
    });
  } catch (err) {
    const mapped = mapDomainError(err, headers);
    if (mapped) return mapped;
    logError(context, 'portal.support_tickets.download_url.error', {
      userId: user.id,
      attachmentId: attId,
      message: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------
app.http('portalSupportTicketsCollection', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/support-tickets',
  handler: portalSupportTicketsCollectionHandler,
});

app.http('portalSupportTicketItem', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/support-tickets/{id}',
  handler: portalSupportTicketItemHandler,
});

app.http('portalSupportTicketMessages', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/support-tickets/{id}/messages',
  handler: portalSupportTicketMessagesHandler,
});

app.http('portalSupportTicketReopen', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/support-tickets/{id}/reopen',
  handler: portalSupportTicketReopenHandler,
});

app.http('portalSupportTicketUploadIntent', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/support-tickets/{id}/attachments/upload-intent',
  handler: portalSupportTicketUploadIntentHandler,
});

app.http('portalSupportTicketFinalizeAttachment', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/support-tickets/{id}/attachments/{attId}/finalize',
  handler: portalSupportTicketFinalizeAttachmentHandler,
});

app.http('portalSupportTicketDownloadUrl', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/support-tickets/{id}/attachments/{attId}/download-url',
  handler: portalSupportTicketDownloadUrlHandler,
});
