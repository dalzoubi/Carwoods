import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { getPool } from '../lib/db.js';
import { jsonResponse, requirePortalUser } from '../lib/managementRequest.js';
import { jsonResponseWithEtag } from '../lib/httpEtag.js';
import {
  countUnreadPortalNotifications,
  listPortalNotificationsForUser,
  markAllPortalNotificationsRead,
  patchPortalNotificationForUser,
} from '../lib/notificationCenterRepo.js';

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

async function portalNotificationsCollection(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;

  if (request.method !== 'GET') {
    return jsonResponse(405, headers, { error: 'method_not_allowed' });
  }

  const requestedLimit = Number(request.query.get('limit') ?? 20);
  const limit = Number.isFinite(requestedLimit) ? requestedLimit : 20;
  const [notifications, unreadCount] = await Promise.all([
    listPortalNotificationsForUser(getPool(), user.id, limit),
    countUnreadPortalNotifications(getPool(), user.id),
  ]);

  return jsonResponseWithEtag(request, headers, {
    notifications,
    unread_count: unreadCount,
  });
}

async function portalNotificationItem(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;

  if (request.method !== 'PATCH') {
    return jsonResponse(405, headers, { error: 'method_not_allowed' });
  }

  // Bulk action routed through the same {id} pattern to avoid Azure Functions
  // static-vs-parameterised route conflicts.
  if (request.params.id === 'mark-all-read') {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const dismissed = await markAllPortalNotificationsRead(client, user.id);
      await client.query('COMMIT');
      return jsonResponse(200, headers, { ok: true, dismissed });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, headers, { error: 'invalid_json' });
  }
  const payload = asRecord(body);
  const markRead = payload.read === true;
  const dismissFromTray = payload.dismiss_from_tray === true;
  if (!markRead && !dismissFromTray) {
    return jsonResponse(400, headers, { error: 'invalid_payload' });
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const updated = await patchPortalNotificationForUser(client, {
      notificationId: request.params.id,
      userId: user.id,
      markRead,
      dismissFromTray,
    });
    await client.query('COMMIT');
    if (!updated) {
      return jsonResponse(404, headers, { error: 'not_found' });
    }
    const unreadCount = await countUnreadPortalNotifications(getPool(), user.id);
    return jsonResponse(200, headers, { ok: true, unread_count: unreadCount });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

app.http('portalNotificationsCollection', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/notifications',
  handler: portalNotificationsCollection,
});

app.http('portalNotificationItem', {
  methods: ['PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/notifications/{id}',
  handler: portalNotificationItem,
});

