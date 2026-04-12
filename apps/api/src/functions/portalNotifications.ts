import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { getPool } from '../lib/db.js';
import { jsonResponse, requirePortalUser } from '../lib/managementRequest.js';
import {
  countUnreadPortalNotifications,
  listPortalNotificationsForUser,
  markPortalNotificationRead,
  markAllPortalNotificationsRead,
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

  return jsonResponse(200, headers, {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, headers, { error: 'invalid_json' });
  }
  const payload = asRecord(body);
  if (payload.read !== true) {
    return jsonResponse(400, headers, { error: 'invalid_payload' });
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const updated = await markPortalNotificationRead(client, {
      notificationId: request.params.id,
      userId: user.id,
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

async function portalNotificationsMarkAllRead(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { user, headers } = gate.ctx;

  if (request.method !== 'PATCH') {
    return jsonResponse(405, headers, { error: 'method_not_allowed' });
  }

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

app.http('portalNotificationsMarkAllRead', {
  methods: ['PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/notifications/mark-all-read',
  handler: portalNotificationsMarkAllRead,
});

app.http('portalNotificationItem', {
  methods: ['PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/notifications/{id}',
  handler: portalNotificationItem,
});

