import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { getPool } from '../lib/db.js';
import { requireAdmin, jsonResponse, mapDomainError } from '../lib/managementRequest.js';
import { jsonResponseWithEtag } from '../lib/httpEtag.js';
import { logError, logInfo, logWarn } from '../lib/serverLogger.js';

import { listLandlords } from '../useCases/users/listLandlords.js';
import { inviteLandlord } from '../useCases/users/inviteLandlord.js';
import { setLandlordActive } from '../useCases/users/setLandlordActive.js';
import { assignLandlordTier } from '../useCases/users/assignLandlordTier.js';

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function asOptionalString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function adminLandlordsCollectionHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;
  logInfo(context, 'admin.landlords.collection.start', {
    actorUserId: ctx.user.id,
    method: request.method,
  });

  if (request.method === 'GET') {
    try {
      const includeInactive = request.query.get('include_inactive') === 'true';
      const result = await listLandlords(getPool(), {
        actorUserId: ctx.user.id,
        actorRole: ctx.role,
        includeInactive,
      });
      logInfo(context, 'admin.landlords.collection.list.success', {
        actorUserId: ctx.user.id,
        includeInactive,
        count: result.landlords.length,
      });
      return jsonResponseWithEtag(request, ctx.headers, { landlords: result.landlords });
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) return mapped;
      throw e;
    }
  }

  if (request.method !== 'POST') {
    logWarn(context, 'admin.landlords.collection.method_not_allowed', {
      actorUserId: ctx.user.id,
      method: request.method,
    });
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    logWarn(context, 'admin.landlords.invalid_json', { actorUserId: ctx.user.id });
    return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
  }
  const b = asRecord(body);
  const email = asOptionalString(b.email)?.toLowerCase() ?? '';
  const firstName = asOptionalString(b.first_name);
  const lastName = asOptionalString(b.last_name);

  try {
    const result = await inviteLandlord(getPool(), {
      actorUserId: ctx.user.id,
      actorRole: ctx.role,
      email,
      firstName,
      lastName,
    });
    logInfo(context, 'admin.landlords.upsert.success', {
      actorUserId: ctx.user.id,
      landlordUserId: result.landlord.id,
      created: result.landlord_created,
    });
    return jsonResponse(201, ctx.headers, result);
  } catch (e) {
    const mapped = mapDomainError(e, ctx.headers);
    if (mapped) {
      logWarn(context, 'admin.landlords.upsert.conflict_or_validation', {
        actorUserId: ctx.user.id,
        reason: e instanceof Error ? e.message : 'unknown',
      });
      return mapped;
    }
    logError(context, 'admin.landlords.upsert.error', {
      actorUserId: ctx.user.id,
      message: e instanceof Error ? e.message : 'unknown_error',
    });
    throw e;
  }
}

async function adminLandlordsItemHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;
  const landlordId = request.params.id;
  logInfo(context, 'admin.landlords.item.start', {
    actorUserId: ctx.user.id,
    method: request.method,
    landlordId,
  });
  if (!landlordId) {
    logWarn(context, 'admin.landlords.item.missing_id', { actorUserId: ctx.user.id });
    return jsonResponse(400, ctx.headers, { error: 'missing_id' });
  }
  if (request.method !== 'PATCH') {
    logWarn(context, 'admin.landlords.item.method_not_allowed', {
      actorUserId: ctx.user.id,
      method: request.method,
      landlordId,
    });
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    logWarn(context, 'admin.landlords.item.invalid_json', { actorUserId: ctx.user.id, landlordId });
    return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
  }
  const b = asRecord(body);
  if (typeof b.active !== 'boolean') {
    logWarn(context, 'admin.landlords.item.validation_failed', {
      actorUserId: ctx.user.id,
      landlordId,
      reason: 'missing_active',
    });
    return jsonResponse(400, ctx.headers, { error: 'missing_active' });
  }

  try {
    const result = await setLandlordActive(getPool(), {
      actorUserId: ctx.user.id,
      actorRole: ctx.role,
      landlordId,
      active: b.active,
    });
    logInfo(context, 'admin.landlords.item.success', {
      actorUserId: ctx.user.id,
      landlordId,
      active: b.active,
    });
    return jsonResponse(200, ctx.headers, { landlord: result.landlord });
  } catch (e) {
    const mapped = mapDomainError(e, ctx.headers);
    if (mapped) {
      logWarn(context, 'admin.landlords.item.not_found', { actorUserId: ctx.user.id, landlordId });
      return mapped;
    }
    logError(context, 'admin.landlords.item.error', {
      actorUserId: ctx.user.id,
      landlordId,
      message: e instanceof Error ? e.message : 'unknown_error',
    });
    throw e;
  }
}

app.http('adminLandlordsCollection', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/admin/landlords',
  handler: adminLandlordsCollectionHandler,
});

app.http('adminLandlordsItem', {
  methods: ['PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/admin/landlords/{id}',
  handler: adminLandlordsItemHandler,
});

async function adminLandlordsItemTierHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;
  const landlordId = request.params.id;

  if (!landlordId) return jsonResponse(400, ctx.headers, { error: 'missing_id' });
  if (request.method !== 'PATCH') return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });

  let body: unknown;
  try { body = await request.json(); } catch {
    return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
  }
  const b = asRecord(body);
  const tierId = asOptionalString(b.tier_id);
  if (!tierId) return jsonResponse(400, ctx.headers, { error: 'missing_tier_id' });

  try {
    const result = await assignLandlordTier(getPool(), {
      actorUserId: ctx.user.id,
      actorRole: ctx.role,
      landlordId,
      tierId,
    });
    logInfo(context, 'admin.landlords.tier.update.success', {
      actorUserId: ctx.user.id,
      landlordId,
      tierId,
    });
    return jsonResponse(200, ctx.headers, { landlord: result.landlord });
  } catch (e) {
    const mapped = mapDomainError(e, ctx.headers);
    if (mapped) return mapped;
    logError(context, 'admin.landlords.tier.update.error', {
      actorUserId: ctx.user.id,
      message: e instanceof Error ? e.message : 'unknown_error',
    });
    throw e;
  }
}

app.http('adminLandlordsItemTier', {
  methods: ['PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/admin/landlords/{id}/tier',
  handler: adminLandlordsItemTierHandler,
});
