import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { getPool } from '../lib/db.js';
import { jsonResponse, requireAdmin } from '../lib/managementRequest.js';
import { logError, logInfo } from '../lib/serverLogger.js';
import {
  deleteNotificationFlowDefaultOverride,
  listEffectiveFlowDefaults,
  upsertNotificationFlowDefaultOverride,
} from '../lib/notificationFlowDefaultsRepo.js';

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

async function adminFlowDefaultsCollectionHandler(
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
    const flows = await listEffectiveFlowDefaults(getPool());
    const body = flows.map((f) => ({
      event_type_code: f.eventTypeCode,
      label_key: f.labelKey,
      info_key: f.infoKey,
      category: f.category,
      role: f.role,
      email_enabled: f.email,
      in_app_enabled: f.inApp,
      sms_enabled: f.sms,
      user_overridable: f.userOverridable,
      quiet_hours_bypass: f.quietHoursBypass,
      source: f.source,
      updated_by_user_id: f.updatedByUserId,
      updated_at: f.updatedAt,
    }));
    return jsonResponse(200, ctx.headers, { flows: body });
  } catch (err) {
    logError(context, 'admin.notification_flow_defaults.list.error', {
      message: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }
}

async function adminFlowDefaultsItemHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  const code = request.params.code;
  if (!code) return jsonResponse(400, ctx.headers, { error: 'missing_code' });

  if (request.method === 'DELETE') {
    try {
      const pool = getPool();
      const conn = await pool.connect();
      try {
        await deleteNotificationFlowDefaultOverride(conn, code);
        logInfo(context, 'admin.notification_flow_defaults.delete.success', {
          actorUserId: ctx.user.id,
          eventTypeCode: code,
        });
        return jsonResponse(200, ctx.headers, { ok: true });
      } finally {
        conn.release();
      }
    } catch (err) {
      logError(context, 'admin.notification_flow_defaults.delete.error', {
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
  const payload = asRecord(body);

  try {
    const pool = getPool();
    const conn = await pool.connect();
    try {
      const updated = await upsertNotificationFlowDefaultOverride(conn, {
        eventTypeCode: code,
        emailEnabled: bool(payload.email_enabled, true),
        inAppEnabled: bool(payload.in_app_enabled, true),
        smsEnabled: bool(payload.sms_enabled, false),
        quietHoursBypass:
          payload.quiet_hours_bypass === null
            ? null
            : typeof payload.quiet_hours_bypass === 'boolean'
              ? payload.quiet_hours_bypass
              : null,
        updatedByUserId: ctx.user.id,
      });
      logInfo(context, 'admin.notification_flow_defaults.upsert.success', {
        actorUserId: ctx.user.id,
        eventTypeCode: code,
      });
      return jsonResponse(200, ctx.headers, { flow: updated });
    } finally {
      conn.release();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    if (message === 'unknown_event_type_code') {
      return jsonResponse(404, ctx.headers, { error: 'unknown_event_type_code' });
    }
    logError(context, 'admin.notification_flow_defaults.upsert.error', { message });
    throw err;
  }
}

app.http('adminNotificationFlowDefaultsCollection', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/admin/notifications/flow-defaults',
  handler: adminFlowDefaultsCollectionHandler,
});

app.http('adminNotificationFlowDefaultsItem', {
  methods: ['PATCH', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/admin/notifications/flow-defaults/{code}',
  handler: adminFlowDefaultsItemHandler,
});
