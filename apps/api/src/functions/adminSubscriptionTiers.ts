import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { getPool } from '../lib/db.js';
import { requireAdmin, jsonResponse } from '../lib/managementRequest.js';
import { logError, logInfo } from '../lib/serverLogger.js';
import { listTiers, getTierById, updateTier, type TierLimits } from '../lib/subscriptionTiersRepo.js';

// ---------------------------------------------------------------------------
// GET /portal/admin/tiers
// ---------------------------------------------------------------------------
async function adminTiersCollectionHandler(
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
    const tiers = await listTiers(getPool());
    logInfo(context, 'admin.tiers.list.success', { actorUserId: ctx.user.id, count: tiers.length });
    return jsonResponse(200, ctx.headers, { tiers });
  } catch (err) {
    logError(context, 'admin.tiers.list.error', {
      message: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// PATCH /portal/admin/tiers/{id}
// ---------------------------------------------------------------------------
async function adminTiersItemHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  const id = request.params.id;
  if (!id) return jsonResponse(400, ctx.headers, { error: 'missing_id' });

  if (request.method !== 'PATCH') {
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
  }

  const b = (body && typeof body === 'object' && !Array.isArray(body))
    ? (body as Record<string, unknown>)
    : {};

  try {
    const pool = getPool();
    const existing = await getTierById(pool, id);
    if (!existing) return jsonResponse(404, ctx.headers, { error: 'tier_not_found' });

    const patch: { display_name?: string; description?: string | null; limits?: Partial<TierLimits> } = {};
    if (typeof b.display_name === 'string') patch.display_name = b.display_name.trim();
    if ('description' in b) patch.description = typeof b.description === 'string' ? b.description.trim() : null;
    if (b.limits && typeof b.limits === 'object' && !Array.isArray(b.limits)) {
      patch.limits = b.limits as Partial<TierLimits>;
    }

    const updated = await updateTier(pool, id, patch);
    logInfo(context, 'admin.tiers.item.update.success', { actorUserId: ctx.user.id, id });
    return jsonResponse(200, ctx.headers, { tier: updated });
  } catch (err) {
    logError(context, 'admin.tiers.item.update.error', {
      message: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }
}

app.http('adminTiersCollection', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/admin/tiers',
  handler: adminTiersCollectionHandler,
});

app.http('adminTiersItem', {
  methods: ['PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/admin/tiers/{id}',
  handler: adminTiersItemHandler,
});
