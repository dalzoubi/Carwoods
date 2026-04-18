/**
 * GET /api/portal/sidebar-badges
 *
 * Returns per-nav-item counts for the sidebar. Tailored to the caller's role.
 * { requests, notifications, notices, contact }.
 *
 * Counts are best-effort: any sub-query that throws is logged and treated as 0
 * so a single broken metric never blank-outs the sidebar.
 */

import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { getPool } from '../lib/db.js';
import { jsonResponse, requirePortalUser } from '../lib/managementRequest.js';
import { countUnreadPortalNotifications } from '../lib/notificationCenterRepo.js';
import { countActionableNoticesForActor } from '../lib/tenantLifecycleRepo.js';
import { countOpenRequestsForActor } from '../lib/requestsRepo.js';
import { countUnreadContactRequests } from '../lib/contactRequestsRepo.js';
import { Role } from '../domain/constants.js';

async function safe<T>(fn: () => Promise<T>, fallback: T, context: InvocationContext, label: string): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    context.log(`sidebar_badges.${label}.error`, { error: e instanceof Error ? e.message : String(e) });
    return fallback;
  }
}

async function handleGet(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;
  const role = String(user.role ?? '').trim().toUpperCase();

  const pool = getPool();
  const [requests, notifications, notices, contact] = await Promise.all([
    safe(() => countOpenRequestsForActor(pool, role, user.id), 0, context, 'requests'),
    safe(() => countUnreadPortalNotifications(pool, user.id), 0, context, 'notifications'),
    safe(() => countActionableNoticesForActor(pool, role, user.id), 0, context, 'notices'),
    role === Role.ADMIN
      ? safe(() => countUnreadContactRequests(pool), 0, context, 'contact')
      : Promise.resolve(0),
  ]);

  return jsonResponse(200, headers, {
    requests,
    notifications,
    notices,
    contact,
  });
}

app.http('portalSidebarBadges', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/sidebar-badges',
  handler: handleGet,
});
