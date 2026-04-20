import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { getPool } from '../lib/db.js';
import { jsonResponse, requireAdmin } from '../lib/managementRequest.js';
import { logError } from '../lib/serverLogger.js';

const ALLOWED_GROUP_BY = new Set(['day', 'hour', 'channel', 'event', 'role', 'status']);
const ALLOWED_CHANNELS = new Set(['EMAIL', 'SMS', 'IN_APP']);
const ALLOWED_STATUSES = new Set(['QUEUED', 'SENT', 'FAILED']);

/** Deliveries joined to outbox so we can resolve event_type_code when denormalized d.event_type_code is NULL. */
const DELIVERIES_FROM_WITH_OUTBOX = `notification_deliveries d
         LEFT JOIN notification_outbox o ON o.id = d.outbox_id`;

/** Effective notification flow code for reporting (denormalized column preferred, else parent outbox). */
const EFFECTIVE_EVENT_TYPE_SQL = `COALESCE(d.event_type_code, o.event_type_code)`;

/** Stored channel normalized — blank / whitespace treated as unknown (derived from template_id instead). */
const NORMALIZED_STORED_CHANNEL_SQL = `NULLIF(LTRIM(RTRIM(UPPER(ISNULL(CAST(d.channel AS NVARCHAR(50)), N'')))), N'')`;

/**
 * Canonical channel for aggregates (notificationRepo deriveChannelFromTemplateId).
 * In T-SQL LIKE, `_` matches one character unless escaped — use `IN[_]APP` for literal `IN_APP`.
 */
const EFFECTIVE_CHANNEL_SQL = `COALESCE(
       ${NORMALIZED_STORED_CHANNEL_SQL},
       CASE
         WHEN UPPER(ISNULL(d.template_id, N'')) LIKE N'EMAIL:%' THEN N'EMAIL'
         WHEN UPPER(ISNULL(d.template_id, N'')) LIKE N'SMS:%' THEN N'SMS'
         WHEN UPPER(ISNULL(d.template_id, N'')) LIKE N'IN[_]APP:%'
           OR UPPER(ISNULL(d.template_id, N'')) LIKE N'INAPP:%' THEN N'IN_APP'
         ELSE NULL
       END)`;

/** Filter rows by canonical channel (`$idx` repeats the same bound parameter). */
function channelFilterPredicate(paramIndex: number): string {
  const s = NORMALIZED_STORED_CHANNEL_SQL;
  const t = `UPPER(ISNULL(d.template_id, N''))`;
  return `(
      ${s} = $${paramIndex}
      OR (
        ${s} IS NULL
        AND (
          ($${paramIndex} = N'EMAIL' AND ${t} LIKE N'EMAIL:%')
          OR ($${paramIndex} = N'SMS' AND ${t} LIKE N'SMS:%')
          OR (
            $${paramIndex} = N'IN_APP'
            AND (${t} LIKE N'IN[_]APP:%' OR ${t} LIKE N'INAPP:%')
          )
        )
      )
    )`;
}

function queryStringParam(request: HttpRequest, key: string): string | null {
  const raw = request.query?.get?.(key);
  if (raw !== undefined && raw !== null && raw !== '') return raw;
  try {
    const u = new URL(request.url);
    return u.searchParams.get(key);
  } catch {
    return null;
  }
}

/**
 * Deliveries + outbox + portal user matched by email when recipient_user_id was never stored.
 * `users.email` alignment is required for ue join (duplicate emails must not exist).
 */
const DELIVERIES_REPORT_FROM = `${DELIVERIES_FROM_WITH_OUTBOX}
         LEFT JOIN users ue ON d.recipient_user_id IS NULL
           AND LOWER(LTRIM(ISNULL(ue.email, N''))) = LOWER(LTRIM(ISNULL(d.recipient_email, N'')))`;

/** Stable bucket per recipient for DISTINCT / GROUP BY (user id preferred, else normalized address). */
const RECIPIENT_BUCKET_SQL = `CASE
         WHEN COALESCE(d.recipient_user_id, ue.id) IS NOT NULL
           THEN N'id:' + CAST(COALESCE(d.recipient_user_id, ue.id) AS NVARCHAR(36))
         ELSE N'addr:' + LOWER(LTRIM(ISNULL(d.recipient_email, N'')))
       END`;

type SeriesRow = {
  bucket: string;
  total: number;
  sent: number;
  failed: number;
  queued: number;
};

type AggregateRow = { label: string; total: number };
type LatencyRow = { p50_seconds: number | null; p95_seconds: number | null; avg_seconds: number | null };

function parseDate(input: string | null, fallback: Date): Date {
  if (!input) return fallback;
  const parsed = new Date(input);
  return Number.isFinite(parsed.getTime()) ? parsed : fallback;
}

function buildFiltersClause(params: {
  from: Date;
  to: Date;
  channel: string | null;
  status: string | null;
  eventCode: string | null;
  recipientUserId: string | null;
}): { sql: string; values: unknown[] } {
  const clauses: string[] = ['d.created_at >= $1', 'd.created_at < $2'];
  const values: unknown[] = [params.from, params.to];
  if (params.channel) {
    values.push(params.channel);
    clauses.push(channelFilterPredicate(values.length));
  }
  if (params.status) {
    values.push(params.status);
    clauses.push(`d.status = $${values.length}`);
  }
  if (params.eventCode) {
    values.push(params.eventCode);
    clauses.push(`${EFFECTIVE_EVENT_TYPE_SQL} = $${values.length}`);
  }
  if (params.recipientUserId) {
    values.push(params.recipientUserId);
    const r = values.length;
    clauses.push(`(
      d.recipient_user_id = $${r}
      OR (
        d.recipient_user_id IS NULL
        AND EXISTS (
          SELECT 1 FROM users uf
          WHERE uf.id = $${r}
            AND LOWER(LTRIM(ISNULL(uf.email, N''))) = LOWER(LTRIM(ISNULL(d.recipient_email, N'')))
        )
      )
    )`);
  }
  return { sql: clauses.join(' AND '), values };
}

async function adminReportSummaryHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (request.method !== 'GET') {
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }

  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const from = parseDate(queryStringParam(request, 'from'), defaultFrom);
  const to = parseDate(queryStringParam(request, 'to'), now);
  const channelRaw = String(queryStringParam(request, 'channel') ?? '').trim().toUpperCase();
  const channel = channelRaw && ALLOWED_CHANNELS.has(channelRaw) ? channelRaw : null;
  const statusRaw = String(queryStringParam(request, 'status') ?? '').trim().toUpperCase();
  const status = statusRaw && ALLOWED_STATUSES.has(statusRaw) ? statusRaw : null;
  const eventCode = String(queryStringParam(request, 'event_type_code') ?? '').trim().toUpperCase() || null;
  const recipientUserId = String(queryStringParam(request, 'recipient_user_id') ?? '').trim() || null;
  const groupByRaw = String(queryStringParam(request, 'group_by') ?? 'day').trim().toLowerCase();
  const groupBy = ALLOWED_GROUP_BY.has(groupByRaw) ? groupByRaw : 'day';

  const filters = buildFiltersClause({ from, to, channel, status, eventCode, recipientUserId });

  try {
    const pool = getPool();

    // Headline counters
    const headlineRes = await pool.query<{
      total_count: number;
      sent_count: number;
      failed_count: number;
      queued_count: number;
      unique_recipients: number;
    }>(
      `SELECT
         COUNT(*) AS total_count,
         SUM(CASE WHEN d.status = 'SENT' THEN 1 ELSE 0 END) AS sent_count,
         SUM(CASE WHEN d.status = 'FAILED' THEN 1 ELSE 0 END) AS failed_count,
         SUM(CASE WHEN d.status = 'QUEUED' THEN 1 ELSE 0 END) AS queued_count,
         COUNT(DISTINCT ${RECIPIENT_BUCKET_SQL}) AS unique_recipients
       FROM ${DELIVERIES_REPORT_FROM}
       WHERE ${filters.sql}`,
      filters.values
    );
    const head = headlineRes.rows[0] ?? {
      total_count: 0, sent_count: 0, failed_count: 0, queued_count: 0, unique_recipients: 0,
    };

    // Time series — bucketing depends on group_by
    let series: SeriesRow[] = [];
    if (groupBy === 'day' || groupBy === 'hour') {
      const truncSql = groupBy === 'hour'
        ? `DATEADD(hour, DATEDIFF(hour, 0, d.created_at), 0)`
        : `CAST(d.created_at AS DATE)`;
      const seriesRes = await pool.query<SeriesRow>(
        `SELECT CAST(${truncSql} AS NVARCHAR(50)) AS bucket,
                COUNT(*) AS total,
                SUM(CASE WHEN d.status = 'SENT' THEN 1 ELSE 0 END) AS sent,
                SUM(CASE WHEN d.status = 'FAILED' THEN 1 ELSE 0 END) AS failed,
                SUM(CASE WHEN d.status = 'QUEUED' THEN 1 ELSE 0 END) AS queued
         FROM ${DELIVERIES_REPORT_FROM}
         WHERE ${filters.sql}
         GROUP BY ${truncSql}
         ORDER BY ${truncSql} ASC`,
        filters.values
      );
      series = seriesRes.rows;
    }

    // Aggregates by chosen dimension
    let aggregates: AggregateRow[] = [];
    if (groupBy === 'channel') {
      const r = await pool.query<{ label: string | null; total: number }>(
        `SELECT COALESCE(${EFFECTIVE_CHANNEL_SQL}, 'UNKNOWN') AS label, COUNT(*) AS total
         FROM ${DELIVERIES_REPORT_FROM}
         WHERE ${filters.sql}
         GROUP BY COALESCE(${EFFECTIVE_CHANNEL_SQL}, 'UNKNOWN')
         ORDER BY total DESC`,
        filters.values
      );
      aggregates = r.rows.map((row) => ({ label: row.label ?? 'UNKNOWN', total: Number(row.total) }));
    } else if (groupBy === 'event') {
      const r = await pool.query<{ label: string | null; total: number }>(
        `SELECT COALESCE(${EFFECTIVE_EVENT_TYPE_SQL}, 'UNKNOWN') AS label, COUNT(*) AS total
         FROM ${DELIVERIES_REPORT_FROM}
         WHERE ${filters.sql}
         GROUP BY COALESCE(${EFFECTIVE_EVENT_TYPE_SQL}, 'UNKNOWN')
         ORDER BY total DESC`,
        filters.values
      );
      aggregates = r.rows.map((row) => ({ label: row.label ?? 'UNKNOWN', total: Number(row.total) }));
    } else if (groupBy === 'role') {
      const r = await pool.query<{ label: string | null; total: number }>(
        `SELECT COALESCE(u.role, 'UNKNOWN') AS label, COUNT(*) AS total
         FROM ${DELIVERIES_REPORT_FROM}
         LEFT JOIN users u ON u.id = COALESCE(d.recipient_user_id, ue.id)
         WHERE ${filters.sql}
         GROUP BY COALESCE(u.role, 'UNKNOWN')
         ORDER BY total DESC`,
        filters.values
      );
      aggregates = r.rows.map((row) => ({ label: row.label ?? 'UNKNOWN', total: Number(row.total) }));
    } else if (groupBy === 'status') {
      const r = await pool.query<{ label: string; total: number }>(
        `SELECT d.status AS label, COUNT(*) AS total
         FROM ${DELIVERIES_REPORT_FROM}
         WHERE ${filters.sql}
         GROUP BY d.status
         ORDER BY total DESC`,
        filters.values
      );
      aggregates = r.rows.map((row) => ({ label: row.label, total: Number(row.total) }));
    }

    // Top recipients (always returned — useful for noise complaints)
    const topRecipients = await pool.query<{
      user_id: string | null;
      email: string | null;
      first_name: string | null;
      last_name: string | null;
      total: number;
    }>(
      `SELECT TOP 10
              MAX(COALESCE(d.recipient_user_id, ue.id)) AS user_id,
              MAX(COALESCE(u.email, ue.email, LTRIM(RTRIM(ISNULL(d.recipient_email, N''))))) AS email,
              MAX(COALESCE(u.first_name, ue.first_name)) AS first_name,
              MAX(COALESCE(u.last_name, ue.last_name)) AS last_name,
              COUNT(*) AS total
         FROM ${DELIVERIES_REPORT_FROM}
         LEFT JOIN users u ON u.id = d.recipient_user_id
         WHERE ${filters.sql}
           AND (
             d.recipient_user_id IS NOT NULL
             OR ue.id IS NOT NULL
             OR NULLIF(LTRIM(RTRIM(ISNULL(d.recipient_email, N''))), N'') IS NOT NULL
           )
         GROUP BY ${RECIPIENT_BUCKET_SQL}
         ORDER BY total DESC`,
      filters.values
    );

    // Top failing flows — drives admin attention
    const failureFilters = buildFiltersClause({
      from, to, channel, status: 'FAILED', eventCode, recipientUserId,
    });
    const topFailures = await pool.query<{ event_type_code: string | null; total: number }>(
      `SELECT TOP 10 COALESCE(${EFFECTIVE_EVENT_TYPE_SQL}, 'UNKNOWN') AS event_type_code, COUNT(*) AS total
         FROM ${DELIVERIES_REPORT_FROM}
         WHERE ${failureFilters.sql}
         GROUP BY COALESCE(${EFFECTIVE_EVENT_TYPE_SQL}, 'UNKNOWN')
         ORDER BY total DESC`,
      failureFilters.values
    );

    // Delivery latency (sent_at - created_at) — only for SENT rows that have sent_at populated
    const latencyRes = await pool.query<LatencyRow>(
      `SELECT
         AVG(CAST(DATEDIFF(SECOND, d.created_at, d.sent_at) AS BIGINT)) AS avg_seconds,
         MAX(CASE WHEN q.percentile = 0.50 THEN q.value END) AS p50_seconds,
         MAX(CASE WHEN q.percentile = 0.95 THEN q.value END) AS p95_seconds
       FROM ${DELIVERIES_REPORT_FROM}
       OUTER APPLY (
         SELECT 0.50 AS percentile,
                PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY DATEDIFF(SECOND, d.created_at, d.sent_at)) OVER () AS value
         UNION ALL
         SELECT 0.95,
                PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY DATEDIFF(SECOND, d.created_at, d.sent_at)) OVER ()
       ) q
       WHERE ${filters.sql}
         AND d.status = 'SENT'
         AND d.sent_at IS NOT NULL`,
      filters.values
    );
    const latency = latencyRes.rows[0] ?? { p50_seconds: null, p95_seconds: null, avg_seconds: null };

    return jsonResponse(200, ctx.headers, {
      window: { from: from.toISOString(), to: to.toISOString() },
      filters: { channel, status, event_type_code: eventCode, recipient_user_id: recipientUserId, group_by: groupBy },
      summary: {
        total: Number(head.total_count ?? 0),
        sent: Number(head.sent_count ?? 0),
        failed: Number(head.failed_count ?? 0),
        queued: Number(head.queued_count ?? 0),
        unique_recipients: Number(head.unique_recipients ?? 0),
        delivery_rate: Number(head.total_count ?? 0) > 0
          ? Number(head.sent_count ?? 0) / Number(head.total_count) : null,
      },
      latency_seconds: {
        avg: latency.avg_seconds === null ? null : Number(latency.avg_seconds),
        p50: latency.p50_seconds === null ? null : Number(latency.p50_seconds),
        p95: latency.p95_seconds === null ? null : Number(latency.p95_seconds),
      },
      series,
      aggregates,
      top_recipients: topRecipients.rows.map((row) => ({
        user_id: row.user_id,
        email: row.email,
        first_name: row.first_name,
        last_name: row.last_name,
        total: Number(row.total),
      })),
      top_failing_flows: topFailures.rows.map((row) => ({
        event_type_code: row.event_type_code,
        total: Number(row.total),
      })),
    });
  } catch (err) {
    logError(context, 'admin.notification_report.summary.error', {
      message: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }
}

app.http('adminNotificationReportSummary', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/admin/notifications/report',
  handler: adminReportSummaryHandler,
});
