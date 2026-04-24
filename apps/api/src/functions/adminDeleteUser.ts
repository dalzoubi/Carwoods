import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { getPool } from '../lib/db.js';
import { requireAdmin, jsonResponse, mapDomainError } from '../lib/managementRequest.js';
import { findUserById } from '../lib/usersRepo.js';
import { hardDeleteUserAndOwnedData } from '../lib/deleteUserCascade.js';
import { withRateLimit } from '../lib/rateLimiter.js';
import { logInfo, logWarn } from '../lib/serverLogger.js';

const MIN_REASON_LENGTH = 10;
const MAX_REASON_LENGTH = 500;

type DeletePayload = {
  reason?: unknown;
};

async function adminDeleteUserHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (request.method === 'OPTIONS') {
    return { status: 204, headers: ctx.headers };
  }
  if (request.method !== 'DELETE') {
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }

  const userId = (request.params?.id ?? '').trim();
  if (!userId) {
    return jsonResponse(400, ctx.headers, { error: 'user_id_required' });
  }

  let payload: DeletePayload = {};
  try {
    const body = await request.json();
    if (body && typeof body === 'object') payload = body as DeletePayload;
  } catch {
    payload = {};
  }

  const reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';
  if (reason.length < MIN_REASON_LENGTH) {
    return jsonResponse(400, ctx.headers, {
      error: 'reason_required',
      min_length: MIN_REASON_LENGTH,
    });
  }
  if (reason.length > MAX_REASON_LENGTH) {
    return jsonResponse(400, ctx.headers, {
      error: 'reason_too_long',
      max_length: MAX_REASON_LENGTH,
    });
  }

  if (userId === ctx.user.id) {
    return jsonResponse(400, ctx.headers, { error: 'cannot_delete_self' });
  }

  const pool = getPool();
  const target = await findUserById(pool, userId);
  if (!target) {
    return jsonResponse(404, ctx.headers, { error: 'user_not_found' });
  }

  // Admins can only be removed via a database-level intervention — refusing
  // here prevents an admin from accidentally wiping a peer (or themselves
  // via a different id) from the portal UI.
  if (String(target.role ?? '').toUpperCase() === 'ADMIN') {
    return jsonResponse(403, ctx.headers, { error: 'cannot_delete_admin' });
  }

  try {
    const summary = await hardDeleteUserAndOwnedData(pool, {
      actorUserId: ctx.user.id,
      targetUser: target,
      reason,
    });
    logInfo(context, 'admin.users.hard_delete.ok', {
      actorUserId: ctx.user.id,
      deletedUserId: target.id,
      deletedRole: target.role,
      reasonLength: reason.length,
      ...summary,
    });
    return jsonResponse(200, ctx.headers, { ok: true, summary });
  } catch (error) {
    const mapped = mapDomainError(error, ctx.headers);
    if (mapped) return mapped;
    const message = error instanceof Error ? error.message : String(error);
    logWarn(context, 'admin.users.hard_delete.failed', {
      actorUserId: ctx.user.id,
      targetUserId: target.id,
      message,
    });
    // FK-constraint errors bubble up here when the cascade missed a table
    // we don't know about (feature tables added later, custom reports, etc.).
    // The admin sees a clear 409 so they can remove the blocker manually.
    return jsonResponse(409, ctx.headers, {
      error: 'deletion_blocked',
      detail: message,
    });
  }
}

app.http('adminDeleteUser', {
  methods: ['DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/admin/users/{id}',
  handler: withRateLimit(adminDeleteUserHandler),
});
