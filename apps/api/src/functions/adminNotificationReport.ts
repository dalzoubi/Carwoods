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
    clauses.push(`d.channel = $${values.length}`);
  }
  if (params.status) {
    values.push(params.status);
    clauses.push(`d.status = $${values.length}`);
  }
  if (params.eventCode) {
    values.push(params.eventCode);
    clauses.push(`d.event_type_code = $${values.length}`);
  }
  if (params.recipientUserId) {
    values.push(params.recipientUserId);
    clauses.push(`d.recipient_user_id = $${values.length}`);
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

  const url = new URL(request.url);
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const from = parseDate(url.searchParams.get('from'), defaultFrom);
  const to = parseDate(url.searchParams.get('to'), now);
  const channelRaw = String(url.searchParams.get('channel') ?? '').trim().toUpperCase();
  const channel = channelRaw && ALLOWED_CHANNELS.has(channelRaw) ? channelRaw : null;
  const statusRaw = String(url.searchParams.get('status') ?? '').trim().toUpperCase();
  const status = statusRaw && ALLOWED_STATUSES.has(statusRaw) ? statusRaw : null;
  const eventCode = String(url.searchParams.get('event_type_code') ?? '').trim().toUpperCase() || null;
  const recipientUserId = String(url.searchParams.get('recipient_user_id') ?? '').trim() || null;
  const groupByRaw = String(url.searchParams.get('group_by') ?? 'day').trim().toLowerCase();
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
         COUNT(DISTINCT d.recipient_user_id) AS unique_recipients
       FROM notification_deliveries d
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
         FROM notification_deliveries d
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
        `SELECT COALESCE(d.channel, 'UNKNOWN') AS label, COUNT(*) AS total
         FROM notification_deliveries d
         WHERE ${filters.sql}
         GROUP BY COALESCE(d.channel, 'UNKNOWN')
         ORDER BY total DESC`,
        filters.values
      );
      aggregates = r.rows.map((row) => ({ label: row.label ?? 'UNKNOWN', total: Number(row.total) }));
    } else if (groupBy === 'event') {
      const r = await pool.query<{ label: string | null; total: number }>(
        `SELECT COALESCE(d.event_type_code, 'UNKNOWN') AS label, COUNT(*) AS total
         FROM notification_deliveries d
         WHERE ${filters.sql}
         GROUP BY COALESCE(d.event_type_code, 'UNKNOWN')
         ORDER BY total DESC`,
        filters.values
      );
      aggregates = r.rows.map((row) => ({ label: row.label ?? 'UNKNOWN', total: Number(row.total) }));
    } else if (groupBy === 'role') {
      const r = await pool.query<{ label: string | null; total: number }>(
        `SELECT COALESCE(u.role, 'UNKNOWN') AS label, COUNT(*) AS total
         FROM notification_deliveries d
         LEFT JOIN users u ON u.id = d.recipient_user_id
         WHERE ${filters.sql}
         GROUP BY COALESCE(u.role, 'UNKNOWN')
         ORDER BY total DESC`,
        filters.values
      );
      aggregates = r.rows.map((row) => ({ label: row.label ?? 'UNKNOWN', total: Number(row.total) }));
    } else if (groupBy === 'status') {
      const r = await pool.query<{ label: string; total: number }>(
        `SELECT d.status AS label, COUNT(*) AS total
         FROM notification_deliveries d
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
              d.recipient_user_id AS user_id,
              u.email,
              u.first_name,
              u.last_name,
              COUNT(*) AS total
         FROM notification_deliveries d
         LEFT JOIN users u ON u.id = d.recipient_user_id
         WHERE ${filters.sql}
           AND d.recipient_user_id IS NOT NULL
         GROUP BY d.recipient_user_id, u.email, u.first_name, u.last_name
         ORDER BY total DESC`,
      filters.values
    );

    // Top failing flows — drives admin attention
    const failureFilters = buildFiltersClause({
      from, to, channel, status: 'FAILED', eventCode, recipientUserId,
    });
    const topFailures = await pool.query<{ event_type_code: string | null; total: number }>(
      `SELECT TOP 10 COALESCE(d.event_type_code, 'UNKNOWN') AS event_type_code, COUNT(*) AS total
         FROM notification_deliveries d
         WHERE ${failureFilters.sql}
         GROUP BY COALESCE(d.event_type_code, 'UNKNOWN')
         ORDER BY total DESC`,
      failureFilters.values
    );

    // Delivery latency (sent_at - created_at) — only for SENT rows that have sent_at populated
    const latencyRes = await pool.query<LatencyRow>(
      `SELECT
         AVG(CAST(DATEDIFF(SECOND, d.created_at, d.sent_at) AS BIGINT)) AS avg_seconds,
         MAX(CASE WHEN q.percentile = 0.50 THEN q.value END) AS p50_seconds,
         MAX(CASE WHEN q.percentile = 0.95 THEN q.value END) AS p95_seconds
       FROM notification_deliveries d
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
