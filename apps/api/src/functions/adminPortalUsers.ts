import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { getPool } from '../lib/db.js';
import { requireAdmin, jsonResponse, mapDomainError } from '../lib/managementRequest.js';
import { listUsersForAdminNotificationRecipients } from '../lib/usersRepo.js';
import { logInfo, logWarn } from '../lib/serverLogger.js';

async function adminPortalUsersHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (request.method === 'OPTIONS') {
    return { status: 204, headers: ctx.headers };
  }
  if (request.method !== 'GET') {
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }

  const includeInactive = request.query.get('include_inactive') === 'true';

  try {
    const users = await listUsersForAdminNotificationRecipients(getPool(), { includeInactive });
    logInfo(context, 'admin.portal_users.list', {
      actorUserId: ctx.user.id,
      includeInactive,
      count: users.length,
    });
    return jsonResponse(200, ctx.headers, { users });
  } catch (e) {
    const mapped = mapDomainError(e, ctx.headers);
    if (mapped) return mapped;
    logWarn(context, 'admin.portal_users.error', {
      actorUserId: ctx.user.id,
      message: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

app.http('adminPortalUsers', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/admin/users',
  handler: adminPortalUsersHandler,
});
