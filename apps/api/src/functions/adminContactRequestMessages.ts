import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { getPool } from '../lib/db.js';
import {
  requireAdmin,
  jsonResponse,
  mapDomainError,
} from '../lib/managementRequest.js';
import { withRateLimit } from '../lib/rateLimiter.js';
import { logError, logInfo } from '../lib/serverLogger.js';
import { getContactRequestById } from '../lib/contactRequestsRepo.js';
import { listContactRequestMessages } from '../lib/contactRequestMessagesRepo.js';
import { sendContactReply } from '../useCases/contactRequests/sendContactReply.js';
import { suggestContactReply } from '../useCases/contactRequests/suggestContactReply.js';

// ---------------------------------------------------------------------------
// GET/POST /portal/admin/contact-requests/{id}/messages
// ---------------------------------------------------------------------------
async function adminContactRequestMessagesHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  const id = request.params.id;
  if (!id) return jsonResponse(400, ctx.headers, { error: 'missing_id' });

  const pool = getPool();

  if (request.method === 'GET') {
    try {
      const [existing, messages] = await Promise.all([
        getContactRequestById(pool, id),
        listContactRequestMessages(pool, id),
      ]);
      if (!existing) return jsonResponse(404, ctx.headers, { error: 'not_found' });
      return jsonResponse(200, ctx.headers, {
        contact_request: existing,
        messages,
      });
    } catch (err) {
      logError(context, 'admin.contact_requests.messages.list.error', {
        message: err instanceof Error ? err.message : 'unknown',
      });
      throw err;
    }
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
  }
  const b = body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};

  const text = typeof b.body === 'string' ? b.body : '';
  const isInternalNote = b.is_internal_note === true;
  const aiSuggested = b.ai_suggested === true;
  const aiModel = typeof b.ai_model === 'string' ? b.ai_model : null;
  const markHandled = b.mark_handled === false ? false : true;

  try {
    const result = await sendContactReply(
      pool,
      {
        contactRequestId: id,
        actorUserId: ctx.user.id,
        actorEmail: ctx.user.email ?? null,
        body: text,
        isInternalNote,
        aiSuggested,
        aiModel,
        markHandled,
      },
      context
    );
    logInfo(context, 'admin.contact_requests.messages.create.success', {
      actorUserId: ctx.user.id,
      contactRequestId: id,
      messageId: result.message.id,
      emailDelivered: result.emailDelivered,
      isInternal: isInternalNote,
    });
    return jsonResponse(201, ctx.headers, {
      message: result.message,
      contact_request: result.contactRequest,
      email_delivered: result.emailDelivered,
      email_error: result.emailError,
    });
  } catch (err) {
    const mapped = mapDomainError(err, ctx.headers);
    if (mapped) return mapped;
    logError(context, 'admin.contact_requests.messages.create.error', {
      message: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// POST /portal/admin/contact-requests/{id}/suggest-reply
// ---------------------------------------------------------------------------
async function adminContactRequestSuggestReplyHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  const id = request.params.id;
  if (!id) return jsonResponse(400, ctx.headers, { error: 'missing_id' });

  if (request.method !== 'POST') {
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // allow empty body
    body = {};
  }
  const b = body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
  const tone = typeof b.tone === 'string' ? b.tone : undefined;
  const length = typeof b.length === 'string' ? b.length : undefined;
  const extraContext = typeof b.extra_context === 'string' ? b.extra_context : null;

  try {
    const pool = getPool();
    const result = await suggestContactReply(
      pool,
      { contactRequestId: id, tone, length, extraContext },
      context
    );
    return jsonResponse(200, ctx.headers, result);
  } catch (err) {
    const mapped = mapDomainError(err, ctx.headers);
    if (mapped) return mapped;
    logError(context, 'admin.contact_requests.suggest_reply.error', {
      message: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }
}

app.http('adminContactRequestMessages', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/admin/contact-requests/{id}/messages',
  handler: withRateLimit(adminContactRequestMessagesHandler),
});

app.http('adminContactRequestSuggestReply', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/admin/contact-requests/{id}/suggest-reply',
  handler: withRateLimit(adminContactRequestSuggestReplyHandler),
});
