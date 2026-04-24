import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { getPool } from '../lib/db.js';
import { requireAdmin, jsonResponse } from '../lib/managementRequest.js';
import { withRateLimit } from '../lib/rateLimiter.js';
import { logError, logInfo } from '../lib/serverLogger.js';
import {
  listContactReplyTemplates,
  insertContactReplyTemplate,
  updateContactReplyTemplate,
  deleteContactReplyTemplate,
  getContactReplyTemplateById,
} from '../lib/contactReplyTemplatesRepo.js';

const MAX_TITLE = 200;
const MAX_BODY = 10_000;

const VALID_SUBJECTS = new Set([
  'GENERAL',
  'RENTER',
  'PROPERTY_OWNER',
  'PORTAL_SAAS',
  'PAID_SUBSCRIPTION',
]);

function readTemplateBody(
  raw: unknown
): { title: string; body: string; subjectScope: string | null } | { error: string } {
  const b = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
  const title = typeof b.title === 'string' ? b.title.trim() : '';
  const body = typeof b.body === 'string' ? b.body.trim() : '';
  const rawScope = typeof b.subject_scope === 'string' ? b.subject_scope.trim().toUpperCase() : '';
  if (!title) return { error: 'title_required' };
  if (title.length > MAX_TITLE) return { error: 'title_too_long' };
  if (!body) return { error: 'body_required' };
  if (body.length > MAX_BODY) return { error: 'body_too_long' };
  const subjectScope = rawScope ? (VALID_SUBJECTS.has(rawScope) ? rawScope : null) : null;
  if (rawScope && !VALID_SUBJECTS.has(rawScope)) return { error: 'invalid_subject_scope' };
  return { title, body, subjectScope };
}

// ---------------------------------------------------------------------------
// GET/POST /portal/admin/contact-reply-templates
// ---------------------------------------------------------------------------
async function collectionHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  const pool = getPool();

  if (request.method === 'GET') {
    const scope = request.query.get('subject_scope') ?? undefined;
    const normalized = scope ? scope.toUpperCase() : null;
    try {
      const rows = await listContactReplyTemplates(pool, {
        subjectScope: normalized && VALID_SUBJECTS.has(normalized) ? normalized : null,
      });
      return jsonResponse(200, ctx.headers, { templates: rows });
    } catch (err) {
      logError(context, 'admin.contact_reply_templates.list.error', {
        message: err instanceof Error ? err.message : 'unknown',
      });
      throw err;
    }
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
  }
  const parsed = readTemplateBody(raw);
  if ('error' in parsed) {
    return jsonResponse(400, ctx.headers, { error: parsed.error });
  }

  try {
    const row = await insertContactReplyTemplate(pool, {
      title: parsed.title,
      body: parsed.body,
      subjectScope: parsed.subjectScope,
      createdBy: ctx.user.id,
    });
    logInfo(context, 'admin.contact_reply_templates.create.success', {
      actorUserId: ctx.user.id,
      templateId: row.id,
    });
    return jsonResponse(201, ctx.headers, { template: row });
  } catch (err) {
    logError(context, 'admin.contact_reply_templates.create.error', {
      message: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// PUT/DELETE /portal/admin/contact-reply-templates/{id}
// ---------------------------------------------------------------------------
async function itemHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  const id = request.params.id;
  if (!id) return jsonResponse(400, ctx.headers, { error: 'missing_id' });

  const pool = getPool();

  if (request.method === 'DELETE') {
    try {
      const existing = await getContactReplyTemplateById(pool, id);
      if (!existing) return jsonResponse(404, ctx.headers, { error: 'not_found' });
      const ok = await deleteContactReplyTemplate(pool, id);
      if (!ok) return jsonResponse(404, ctx.headers, { error: 'not_found' });
      logInfo(context, 'admin.contact_reply_templates.delete.success', {
        actorUserId: ctx.user.id,
        templateId: id,
      });
      return jsonResponse(204, ctx.headers, null);
    } catch (err) {
      logError(context, 'admin.contact_reply_templates.delete.error', {
        message: err instanceof Error ? err.message : 'unknown',
      });
      throw err;
    }
  }

  if (request.method !== 'PUT') {
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
  }
  const parsed = readTemplateBody(raw);
  if ('error' in parsed) {
    return jsonResponse(400, ctx.headers, { error: parsed.error });
  }

  try {
    const existing = await getContactReplyTemplateById(pool, id);
    if (!existing) return jsonResponse(404, ctx.headers, { error: 'not_found' });
    const row = await updateContactReplyTemplate(pool, id, {
      title: parsed.title,
      body: parsed.body,
      subjectScope: parsed.subjectScope,
    });
    if (!row) return jsonResponse(404, ctx.headers, { error: 'not_found' });
    logInfo(context, 'admin.contact_reply_templates.update.success', {
      actorUserId: ctx.user.id,
      templateId: id,
    });
    return jsonResponse(200, ctx.headers, { template: row });
  } catch (err) {
    logError(context, 'admin.contact_reply_templates.update.error', {
      message: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }
}

app.http('adminContactReplyTemplatesCollection', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/admin/contact-reply-templates',
  handler: withRateLimit(collectionHandler),
});

app.http('adminContactReplyTemplatesItem', {
  methods: ['PUT', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/admin/contact-reply-templates/{id}',
  handler: withRateLimit(itemHandler),
});
