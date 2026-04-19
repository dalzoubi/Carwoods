import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { getPool } from '../lib/db.js';
import { jsonResponse, requireAdmin } from '../lib/managementRequest.js';
import { logError } from '../lib/serverLogger.js';

type FlowOverrideRow = {
  user_id: string;
  user_email: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  global_email_enabled: boolean;
  global_in_app_enabled: boolean;
  global_sms_enabled: boolean;
  global_sms_opt_in: boolean;
  flow_overrides_count: number;
};

type FlowOverrideDetailRow = {
  event_type_code: string;
  email_enabled: boolean | null;
  in_app_enabled: boolean | null;
  sms_enabled: boolean | null;
  updated_at: Date;
};

async function adminOverridesCollectionHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (request.method !== 'GET') {
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }

  const url = new URL(request.url);
  const search = String(url.searchParams.get('q') ?? '').trim().toLowerCase();
  const role = String(url.searchParams.get('role') ?? '').trim().toUpperCase();
  const onlyCustomized = String(url.searchParams.get('only_customized') ?? '').trim() === '1';
  const eventCode = String(url.searchParams.get('event_type_code') ?? '').trim().toUpperCase();
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') ?? 200), 500));

  try {
    const pool = getPool();
    const r = await pool.query<FlowOverrideRow>(
      `SELECT TOP (${limit})
              u.id AS user_id,
              u.email AS user_email,
              u.first_name,
              u.last_name,
              u.role,
              COALESCE(p.email_enabled, CAST(1 AS BIT)) AS global_email_enabled,
              COALESCE(p.in_app_enabled, CAST(1 AS BIT)) AS global_in_app_enabled,
              COALESCE(p.sms_enabled, CAST(0 AS BIT)) AS global_sms_enabled,
              COALESCE(p.sms_opt_in, CAST(0 AS BIT)) AS global_sms_opt_in,
              COALESCE(fc.cnt, 0) AS flow_overrides_count
         FROM users u
         LEFT JOIN user_notification_preferences p ON p.user_id = u.id
         LEFT JOIN (
            SELECT user_id, COUNT(*) AS cnt
              FROM user_notification_flow_preferences
              WHERE ($1 = '' OR event_type_code = $1)
              GROUP BY user_id
         ) fc ON fc.user_id = u.id
         WHERE u.status = 'ACTIVE'
           AND ($2 = '' OR LOWER(u.email) LIKE '%' + $2 + '%'
                OR LOWER(u.first_name) LIKE '%' + $2 + '%'
                OR LOWER(u.last_name) LIKE '%' + $2 + '%')
           AND ($3 = '' OR u.role = $3)
           AND ($4 = 0 OR COALESCE(fc.cnt, 0) > 0)
         ORDER BY u.last_name, u.first_name, u.email`,
      [eventCode, search, role, onlyCustomized ? 1 : 0]
    );
    return jsonResponse(200, ctx.headers, {
      users: r.rows.map((row) => ({
        user_id: row.user_id,
        email: row.user_email,
        first_name: row.first_name,
        last_name: row.last_name,
        role: row.role,
        global: {
          email_enabled: Boolean(row.global_email_enabled),
          in_app_enabled: Boolean(row.global_in_app_enabled),
          sms_enabled: Boolean(row.global_sms_enabled),
          sms_opt_in: Boolean(row.global_sms_opt_in),
        },
        flow_overrides_count: Number(row.flow_overrides_count ?? 0),
      })),
    });
  } catch (err) {
    logError(context, 'admin.notification_overrides.list.error', {
      message: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }
}

async function adminOverridesUserHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (request.method !== 'GET') {
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }

  const userId = request.params.userId;
  if (!userId) return jsonResponse(400, ctx.headers, { error: 'missing_user_id' });

  try {
    const pool = getPool();
    const r = await pool.query<FlowOverrideDetailRow>(
      `SELECT event_type_code, email_enabled, in_app_enabled, sms_enabled, updated_at
         FROM user_notification_flow_preferences
        WHERE user_id = $1
        ORDER BY event_type_code`,
      [userId]
    );
    return jsonResponse(200, ctx.headers, {
      flow_preferences: r.rows.map((row) => ({
        event_type_code: row.event_type_code,
        email_enabled: row.email_enabled,
        in_app_enabled: row.in_app_enabled,
        sms_enabled: row.sms_enabled,
        updated_at: row.updated_at,
      })),
    });
  } catch (err) {
    logError(context, 'admin.notification_overrides.user.error', {
      message: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }
}

app.http('adminNotificationOverridesCollection', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/admin/notifications/user-overrides',
  handler: adminOverridesCollectionHandler,
});

app.http('adminNotificationOverridesUser', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/admin/notifications/user-overrides/{userId}',
  handler: adminOverridesUserHandler,
});
