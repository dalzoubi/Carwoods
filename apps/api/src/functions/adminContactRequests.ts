import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { getPool } from '../lib/db.js';
import { requireAdmin, jsonResponse } from '../lib/managementRequest.js';
import { logError, logInfo, logWarn } from '../lib/serverLogger.js';
import {
  listContactRequests,
  getContactRequestById,
  setContactRequestStatus,
  countUnreadContactRequests,
} from '../lib/contactRequestsRepo.js';

// ---------------------------------------------------------------------------
// GET /portal/admin/contact-requests
// ---------------------------------------------------------------------------
async function adminContactRequestsCollectionHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (request.method !== 'GET') {
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }

  const status = request.query.get('status') ?? undefined;
  const limit = Math.min(Number(request.query.get('limit') ?? 50), 200);
  const offset = Math.max(Number(request.query.get('offset') ?? 0), 0);

  try {
    const pool = getPool();
    const [{ rows, total }, unreadCount] = await Promise.all([
      listContactRequests(pool, { status, limit, offset }),
      countUnreadContactRequests(pool),
    ]);
    logInfo(context, 'admin.contact_requests.list.success', {
      actorUserId: ctx.user.id,
      count: rows.length,
    });
    return jsonResponse(200, ctx.headers, {
      contact_requests: rows,
      total,
      unread_count: unreadCount,
    });
  } catch (err) {
    logError(context, 'admin.contact_requests.list.error', {
      message: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// GET /portal/admin/contact-requests/unread-count
// ---------------------------------------------------------------------------
async function adminContactRequestsUnreadCountHandler(
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
    const unread_count = await countUnreadContactRequests(pool);
    return jsonResponse(200, ctx.headers, { unread_count });
  } catch (err) {
    logError(context, 'admin.contact_requests.unread_count.error', {
      message: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// PATCH /portal/admin/contact-requests/{id}
// ---------------------------------------------------------------------------
async function adminContactRequestsItemHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  const id = request.params.id;
  if (!id) {
    return jsonResponse(400, ctx.headers, { error: 'missing_id' });
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

  const b = (body && typeof body === 'object' && !Array.isArray(body))
    ? (body as Record<string, unknown>)
    : {};

  const status = typeof b.status === 'string' ? b.status.toUpperCase() : null;
  if (!status || !['UNREAD', 'READ', 'HANDLED'].includes(status)) {
    return jsonResponse(400, ctx.headers, { error: 'invalid_status' });
  }

  try {
    const pool = getPool();
    const existing = await getContactRequestById(pool, id);
    if (!existing) {
      return jsonResponse(404, ctx.headers, { error: 'not_found' });
    }
    const updated = await setContactRequestStatus(
      pool,
      id,
      status as 'UNREAD' | 'READ' | 'HANDLED'
    );
    logInfo(context, 'admin.contact_requests.item.update.success', {
      actorUserId: ctx.user.id,
      id,
      status,
    });
    return jsonResponse(200, ctx.headers, { contact_request: updated });
  } catch (err) {
    logError(context, 'admin.contact_requests.item.update.error', {
      message: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }
}

app.http('adminContactRequestsCollection', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/admin/contact-requests',
  handler: adminContactRequestsCollectionHandler,
});

app.http('adminContactRequestsUnreadCount', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/admin/contact-requests/unread-count',
  handler: adminContactRequestsUnreadCountHandler,
});

app.http('adminContactRequestsItem', {
  methods: ['PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/admin/contact-requests/{id}',
  handler: adminContactRequestsItemHandler,
});
