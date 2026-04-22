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
  requireAdmin,
} from '../lib/managementRequest.js';
import { logError, logInfo } from '../lib/serverLogger.js';
import {
  countOpenTicketsForAdmin,
  getSupportTicketById,
  listSupportTicketMessages,
  listSupportTicketsForAdmin,
  listSupportTicketAttachments,
  type SupportTicketCategory,
  type SupportTicketPriority,
  type SupportTicketStatus,
} from '../lib/supportTicketsRepo.js';
import { postSupportTicketMessage } from '../useCases/supportTickets/postSupportTicketMessage.js';
import { updateSupportTicketAdmin } from '../useCases/supportTickets/updateSupportTicketAdmin.js';
import {
  isValidCategory,
  isValidPriority,
  isValidStatus,
} from '../domain/supportTicketValidation.js';

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function asBool(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined;
}

// ---------------------------------------------------------------------------
// GET /portal/admin/support-tickets
// ---------------------------------------------------------------------------
async function adminSupportTicketsCollectionHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (request.method !== 'GET') {
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }

  try {
    const q = request.query;
    const status = q.get('status');
    const category = q.get('category');
    const priority = q.get('priority');
    const area = q.get('area');
    const assignee = q.get('assignee_user_id');
    const limit = Number(q.get('limit') ?? 50);
    const offset = Number(q.get('offset') ?? 0);

    const pool = getPool();
    const [{ rows, total }, openCount] = await Promise.all([
      listSupportTicketsForAdmin(pool, {
        status: status && isValidStatus(status) ? (status.toUpperCase() as SupportTicketStatus) : undefined,
        category: category && isValidCategory(category) ? (category.toUpperCase() as SupportTicketCategory) : undefined,
        priority: priority && isValidPriority(priority) ? (priority.toUpperCase() as SupportTicketPriority) : undefined,
        area: area ? area.toUpperCase() : undefined,
        assigneeUserId: assignee ?? undefined,
        limit: Number.isFinite(limit) ? limit : undefined,
        offset: Number.isFinite(offset) ? offset : undefined,
      }),
      countOpenTicketsForAdmin(pool),
    ]);
    logInfo(context, 'admin.support_tickets.list.success', {
      actorUserId: ctx.user.id,
      count: rows.length,
    });
    return jsonResponse(200, ctx.headers, {
      tickets: rows,
      total,
      open_count: openCount,
    });
  } catch (err) {
    logError(context, 'admin.support_tickets.list.error', {
      message: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// GET /portal/admin/support-tickets/open-count
// ---------------------------------------------------------------------------
async function adminSupportTicketsOpenCountHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;
  if (request.method !== 'GET') {
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }
  try {
    const pool = getPool();
    const open_count = await countOpenTicketsForAdmin(pool);
    return jsonResponse(200, ctx.headers, { open_count });
  } catch (err) {
    logError(context, 'admin.support_tickets.open_count.error', {
      message: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// GET/PATCH /portal/admin/support-tickets/{id}
// ---------------------------------------------------------------------------
async function adminSupportTicketItemHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;
  const id = request.params.id;
  if (!id) return jsonResponse(400, ctx.headers, { error: 'missing_id' });

  if (request.method === 'GET') {
    try {
      const pool = getPool();
      const ticket = await getSupportTicketById(pool, id);
      if (!ticket) return jsonResponse(404, ctx.headers, { error: 'not_found' });
      const [messages, attachments] = await Promise.all([
        listSupportTicketMessages(pool, id, { includeInternal: true }),
        listSupportTicketAttachments(pool, id),
      ]);
      return jsonResponse(200, ctx.headers, { ticket, messages, attachments });
    } catch (err) {
      logError(context, 'admin.support_tickets.get.error', {
        ticketId: id,
        message: err instanceof Error ? err.message : 'unknown',
      });
      throw err;
    }
  }

  if (request.method !== 'PATCH') {
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
  }
  const b = asRecord(body);

  try {
    const pool = getPool();
    const ticket = await updateSupportTicketAdmin(
      pool,
      {
        ticketId: id,
        actorUserId: ctx.user.id,
        status: b.status,
        priority: b.priority,
        assigneeUserId: b.assignee_user_id,
        area: b.area,
        category: b.category,
      },
      context
    );
    logInfo(context, 'admin.support_tickets.update.success', {
      actorUserId: ctx.user.id,
      ticketId: id,
      fields: Object.keys(b),
    });
    return jsonResponse(200, ctx.headers, { ticket });
  } catch (err) {
    const mapped = mapDomainError(err, ctx.headers);
    if (mapped) return mapped;
    logError(context, 'admin.support_tickets.update.error', {
      ticketId: id,
      message: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// POST /portal/admin/support-tickets/{id}/messages
// ---------------------------------------------------------------------------
async function adminSupportTicketMessagesHandler(
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
  }
  const b = asRecord(body);

  try {
    const pool = getPool();
    const message = await postSupportTicketMessage(
      pool,
      {
        ticketId: id,
        authorUserId: ctx.user.id,
        authorRole: 'ADMIN',
        bodyMarkdown: asString(b.body_markdown),
        isInternalNote: asBool(b.is_internal_note) ?? false,
      },
      context
    );
    return jsonResponse(201, ctx.headers, { message });
  } catch (err) {
    const mapped = mapDomainError(err, ctx.headers);
    if (mapped) return mapped;
    logError(context, 'admin.support_tickets.message.error', {
      ticketId: id,
      message: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------
app.http('adminSupportTicketsCollection', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/admin/support-tickets',
  handler: adminSupportTicketsCollectionHandler,
});

app.http('adminSupportTicketsOpenCount', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/admin/support-tickets/open-count',
  handler: adminSupportTicketsOpenCountHandler,
});

app.http('adminSupportTicketItem', {
  methods: ['GET', 'PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/admin/support-tickets/{id}',
  handler: adminSupportTicketItemHandler,
});

app.http('adminSupportTicketMessages', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/admin/support-tickets/{id}/messages',
  handler: adminSupportTicketMessagesHandler,
});
