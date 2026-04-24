import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { getPool } from '../lib/db.js';
import { jsonResponse, requireAdmin } from '../lib/managementRequest.js';
import { withRateLimit } from '../lib/rateLimiter.js';
import { logInfo, logWarn } from '../lib/serverLogger.js';
import { isValidDateString, yesterdayUtc } from '../lib/costRollupService.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultFrom(daysBack: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

function parseDateRange(request: HttpRequest): { from: string; to: string } | null {
  const from = request.query.get('from')?.trim() ?? defaultFrom(30);
  const to = request.query.get('to')?.trim() ?? yesterdayUtc();
  if (!isValidDateString(from) || !isValidDateString(to) || from > to) return null;
  return { from, to };
}

// ---------------------------------------------------------------------------
// GET /api/portal/admin/costs/rollup
// Returns per-landlord cost summary for the requested date range.
// ---------------------------------------------------------------------------

async function adminCostRollupHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (request.method === 'OPTIONS') return { status: 204, headers: ctx.headers };
  if (request.method !== 'GET') return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });

  const range = parseDateRange(request);
  if (!range) return jsonResponse(400, ctx.headers, { error: 'invalid_date_range', hint: 'Use YYYY-MM-DD; from must be <= to' });

  const { from, to } = range;
  const pool = getPool();

  try {
    // Per-landlord cost breakdown by service
    const rollupResult = await pool.query<{
      landlord_id: string;
      first_name: string | null;
      last_name: string | null;
      email: string;
      tier_name: string | null;
      per_property_rate: number | null;
      flat_monthly_rate: number | null;
      total_cost_usd: number;
      email_cost_usd: number;
      sms_cost_usd: number;
      ai_cost_usd: number;
      azure_cost_usd: number;
    }>(
      `SELECT
         cdr.landlord_id,
         u.first_name,
         u.last_name,
         u.email,
         lb.tier_name,
         lb.per_property_rate,
         lb.flat_monthly_rate,
         SUM(cdr.total_cost_usd)                                                           AS total_cost_usd,
         SUM(CASE WHEN cdr.service = 'RESEND_EMAIL'         THEN cdr.total_cost_usd ELSE 0 END) AS email_cost_usd,
         SUM(CASE WHEN cdr.service = 'TELNYX_SMS'           THEN cdr.total_cost_usd ELSE 0 END) AS sms_cost_usd,
         SUM(CASE WHEN cdr.service = 'GEMINI_AI'            THEN cdr.total_cost_usd ELSE 0 END) AS ai_cost_usd,
         SUM(CASE WHEN cdr.service = 'AZURE_INFRASTRUCTURE' THEN cdr.total_cost_usd ELSE 0 END) AS azure_cost_usd
       FROM cost_daily_rollup cdr
       JOIN users u ON u.id = cdr.landlord_id
       LEFT JOIN landlord_billing lb ON lb.landlord_id = cdr.landlord_id
       WHERE cdr.rollup_date BETWEEN $1 AND $2
         AND cdr.landlord_id IS NOT NULL
       GROUP BY cdr.landlord_id, u.first_name, u.last_name, u.email,
                lb.tier_name, lb.per_property_rate, lb.flat_monthly_rate
       ORDER BY total_cost_usd DESC`,
      [from, to]
    );

    // Active property counts per landlord (for revenue calc)
    const landlordIds = rollupResult.rows.map((r) => r.landlord_id);
    const propCountMap = new Map<string, number>();
    if (landlordIds.length > 0) {
      const placeholders = landlordIds.map((_, i) => `$${i + 1}`).join(', ');
      const propResult = await pool.query<{ landlord_id: string; property_count: number }>(
        `SELECT created_by AS landlord_id, COUNT(*) AS property_count
         FROM properties
         WHERE created_by IN (${placeholders})
           AND deleted_at IS NULL
         GROUP BY created_by`,
        landlordIds
      );
      for (const row of propResult.rows) {
        propCountMap.set(row.landlord_id, Number(row.property_count));
      }
    }

    const days = Math.max(
      1,
      Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1
    );
    const months = days / 30;

    const landlords = rollupResult.rows.map((r) => {
      const propertyCount = propCountMap.get(r.landlord_id) ?? 0;
      let estimatedRevenueUsd: number | null = null;
      if (r.tier_name === 'PAY_AS_YOU_GROW' && r.per_property_rate != null) {
        estimatedRevenueUsd = Number(r.per_property_rate) * propertyCount * months;
      } else if (r.tier_name === 'PRO' && r.flat_monthly_rate != null) {
        estimatedRevenueUsd = Number(r.flat_monthly_rate) * months;
      }
      const totalCost = Number(r.total_cost_usd);
      const marginUsd = estimatedRevenueUsd != null ? estimatedRevenueUsd - totalCost : null;
      return {
        landlord_id: r.landlord_id,
        landlord_name: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email,
        landlord_email: r.email,
        tier_name: r.tier_name ?? null,
        per_property_rate: r.per_property_rate != null ? Number(r.per_property_rate) : null,
        flat_monthly_rate: r.flat_monthly_rate != null ? Number(r.flat_monthly_rate) : null,
        property_count: propertyCount,
        total_cost_usd: totalCost,
        email_cost_usd: Number(r.email_cost_usd),
        sms_cost_usd: Number(r.sms_cost_usd),
        ai_cost_usd: Number(r.ai_cost_usd),
        azure_cost_usd: Number(r.azure_cost_usd),
        estimated_revenue_usd: estimatedRevenueUsd,
        margin_usd: marginUsd,
        at_risk: marginUsd != null && marginUsd < 0,
      };
    });

    logInfo(context, 'admin.costs.rollup', { actorUserId: ctx.user.id, from, to, count: landlords.length });
    return jsonResponse(200, ctx.headers, { from, to, days, landlords });
  } catch (err) {
    logWarn(context, 'admin.costs.rollup.error', { actorUserId: ctx.user.id, message: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// GET /api/portal/admin/costs/landlord/{landlordId}
// Drill-down: cost by service and property for one landlord.
// ---------------------------------------------------------------------------

async function adminCostLandlordHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (request.method === 'OPTIONS') return { status: 204, headers: ctx.headers };
  if (request.method !== 'GET') return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });

  const landlordId = request.params.landlordId;
  if (!landlordId) return jsonResponse(400, ctx.headers, { error: 'missing_landlord_id' });

  const range = parseDateRange(request);
  if (!range) return jsonResponse(400, ctx.headers, { error: 'invalid_date_range', hint: 'Use YYYY-MM-DD; from must be <= to' });

  const { from, to } = range;
  const pool = getPool();

  try {
    const byServiceResult = await pool.query<{
      service: string;
      total_cost_usd: number;
      event_count: number;
      total_units: number;
    }>(
      `SELECT
         service,
         SUM(total_cost_usd)  AS total_cost_usd,
         SUM(event_count)     AS event_count,
         SUM(total_units)     AS total_units
       FROM cost_daily_rollup
       WHERE landlord_id = $1
         AND rollup_date BETWEEN $2 AND $3
       GROUP BY service
       ORDER BY total_cost_usd DESC`,
      [landlordId, from, to]
    );

    const byPropertyResult = await pool.query<{
      property_id: string | null;
      property_label: string | null;
      total_cost_usd: number;
      event_count: number;
    }>(
      `SELECT
         cdr.property_id,
         CASE
           WHEN p.name IS NOT NULL AND LEN(LTRIM(RTRIM(p.name))) > 0
           THEN p.name
           ELSE p.street + ', ' + p.city
         END AS property_label,
         SUM(cdr.total_cost_usd) AS total_cost_usd,
         SUM(cdr.event_count)    AS event_count
       FROM cost_daily_rollup cdr
       LEFT JOIN properties p ON p.id = cdr.property_id
       WHERE cdr.landlord_id = $1
         AND cdr.rollup_date BETWEEN $2 AND $3
         AND cdr.property_id IS NOT NULL
       GROUP BY cdr.property_id, p.name, p.street, p.city
       ORDER BY total_cost_usd DESC`,
      [landlordId, from, to]
    );

    const daily = await pool.query<{ rollup_date: string; total_cost_usd: number }>(
      `SELECT rollup_date, SUM(total_cost_usd) AS total_cost_usd
       FROM cost_daily_rollup
       WHERE landlord_id = $1
         AND rollup_date BETWEEN $2 AND $3
       GROUP BY rollup_date
       ORDER BY rollup_date`,
      [landlordId, from, to]
    );

    logInfo(context, 'admin.costs.landlord', { actorUserId: ctx.user.id, landlordId, from, to });
    return jsonResponse(200, ctx.headers, {
      from,
      to,
      by_service: byServiceResult.rows.map((r) => ({
        ...r,
        total_cost_usd: Number(r.total_cost_usd),
        event_count: Number(r.event_count),
        total_units: Number(r.total_units),
      })),
      by_property: byPropertyResult.rows.map((r) => ({
        ...r,
        total_cost_usd: Number(r.total_cost_usd),
        event_count: Number(r.event_count),
      })),
      daily: daily.rows.map((r) => ({
        date: r.rollup_date,
        total_cost_usd: Number(r.total_cost_usd),
      })),
    });
  } catch (err) {
    logWarn(context, 'admin.costs.landlord.error', { actorUserId: ctx.user.id, landlordId, message: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// GET  /api/portal/admin/costs/pricing  — list pricing config
// PATCH /api/portal/admin/costs/pricing/{id} — update rate_usd
// ---------------------------------------------------------------------------

async function adminCostsPricingListHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (request.method === 'OPTIONS') return { status: 204, headers: ctx.headers };
  if (request.method !== 'GET') return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });

  try {
    const result = await getPool().query<{
      id: string;
      service: string;
      unit_type: string;
      rate_usd: number;
      description: string | null;
      updated_at: string;
    }>(`SELECT id, service, unit_type, rate_usd, description, updated_at
        FROM pricing_config
        ORDER BY service`);

    return jsonResponse(200, ctx.headers, {
      pricing: result.rows.map((r) => ({ ...r, rate_usd: Number(r.rate_usd) })),
    });
  } catch (err) {
    logWarn(context, 'admin.costs.pricing.list.error', { actorUserId: ctx.user.id, message: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

async function adminCostsPricingPatchHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (request.method === 'OPTIONS') return { status: 204, headers: ctx.headers };
  if (request.method !== 'PATCH') return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });

  const id = request.params.id;
  if (!id) return jsonResponse(400, ctx.headers, { error: 'missing_id' });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
  }

  const payload = body as Record<string, unknown>;
  const rateRaw = payload.rate_usd;
  if (typeof rateRaw !== 'number' || !Number.isFinite(rateRaw) || rateRaw < 0) {
    return jsonResponse(400, ctx.headers, { error: 'invalid_rate_usd', hint: 'Must be a non-negative number' });
  }

  try {
    const result = await getPool().query<{ id: string; service: string; rate_usd: number; updated_at: string }>(
      `UPDATE pricing_config
       SET rate_usd = $1, updated_by = $2, updated_at = SYSDATETIMEOFFSET()
       OUTPUT INSERTED.id, INSERTED.service, INSERTED.rate_usd, INSERTED.updated_at
       WHERE id = $3`,
      [rateRaw, ctx.user.id, id]
    );

    if (result.rows.length === 0) {
      return jsonResponse(404, ctx.headers, { error: 'not_found' });
    }

    const updated = result.rows[0];
    logInfo(context, 'admin.costs.pricing.updated', {
      actorUserId: ctx.user.id,
      pricingConfigId: id,
      service: updated.service,
      rate_usd: rateRaw,
    });
    return jsonResponse(200, ctx.headers, { ...updated, rate_usd: Number(updated.rate_usd) });
  } catch (err) {
    logWarn(context, 'admin.costs.pricing.patch.error', { actorUserId: ctx.user.id, id, message: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

app.http('adminCostRollup', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/admin/costs/rollup',
  handler: withRateLimit(adminCostRollupHandler),
});

app.http('adminCostLandlord', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/admin/costs/landlord/{landlordId}',
  handler: withRateLimit(adminCostLandlordHandler),
});

app.http('adminCostsPricingList', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/admin/costs/pricing',
  handler: withRateLimit(adminCostsPricingListHandler),
});

app.http('adminCostsPricingPatch', {
  methods: ['PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/admin/costs/pricing/{id}',
  handler: withRateLimit(adminCostsPricingPatchHandler),
});
