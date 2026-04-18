import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { requireLandlordOrAdmin, jsonResponse, mapDomainError } from '../lib/managementRequest.js';
import { getPool } from '../lib/db.js';
import { logError, logInfo, logWarn } from '../lib/serverLogger.js';

import { linkLeaseTenant } from '../useCases/leases/linkLeaseTenant.js';
import { unlinkLeaseTenant } from '../useCases/leases/unlinkLeaseTenant.js';

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

async function landlordLeaseTenantsPost(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  logInfo(context, 'lease_tenants.link.start', {
    method: request.method,
    leaseId: request.params.leaseId,
  });
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (request.method !== 'POST') {
    logWarn(context, 'lease_tenants.link.method_not_allowed', {
      userId: ctx.user.id,
      method: request.method,
      leaseId: request.params.leaseId,
    });
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    logWarn(context, 'lease_tenants.link.invalid_json', {
      userId: ctx.user.id,
      leaseId: request.params.leaseId,
    });
    return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
  }
  const b = asRecord(body);
  const tenantUserId = typeof b.userId === 'string' ? b.userId : undefined;

  try {
    const result = await linkLeaseTenant(getPool(), {
      leaseId: request.params.leaseId,
      tenantUserId,
      actorUserId: ctx.user.id,
      actorRole: ctx.role,
    });
    logInfo(context, 'lease_tenants.link.success', {
      actorUserId: ctx.user.id,
      leaseId: request.params.leaseId,
      tenantUserId,
      linkId: result.lease_tenant.id,
    });
    return jsonResponse(200, ctx.headers, { lease_tenant: result.lease_tenant });
  } catch (e) {
    const mapped = mapDomainError(e, ctx.headers);
    if (mapped) {
      logWarn(context, 'lease_tenants.link.not_found_or_invalid', {
        userId: ctx.user.id,
        leaseId: request.params.leaseId,
        tenantUserId,
        reason: e instanceof Error ? e.message : 'unknown',
      });
      return mapped;
    }
    logError(context, 'lease_tenants.link.error', {
      actorUserId: ctx.user.id,
      leaseId: request.params.leaseId,
      tenantUserId,
      message: e instanceof Error ? e.message : 'unknown_error',
    });
    throw e;
  }
}

async function landlordLeaseTenantDelete(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  logInfo(context, 'lease_tenants.unlink.start', {
    method: request.method,
    leaseId: request.params.leaseId,
    tenantUserId: request.params.tenantUserId,
  });
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (request.method !== 'DELETE') {
    logWarn(context, 'lease_tenants.unlink.method_not_allowed', {
      userId: ctx.user.id,
      method: request.method,
      leaseId: request.params.leaseId,
    });
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }

  const leaseId = request.params.leaseId?.trim();
  const tenantUserId = request.params.tenantUserId?.trim();
  if (!leaseId || !tenantUserId) {
    return jsonResponse(400, ctx.headers, { error: 'missing_params' });
  }

  try {
    const result = await unlinkLeaseTenant(getPool(), {
      leaseId,
      tenantUserId,
      actorUserId: ctx.user.id,
      actorRole: ctx.role,
    });
    logInfo(context, 'lease_tenants.unlink.success', {
      actorUserId: ctx.user.id,
      leaseId,
      tenantUserId,
      linkId: result.removed.id,
    });
    return jsonResponse(200, ctx.headers, { removed: result.removed });
  } catch (e) {
    const mapped = mapDomainError(e, ctx.headers);
    if (mapped) {
      logWarn(context, 'lease_tenants.unlink.domain_error', {
        userId: ctx.user.id,
        leaseId,
        tenantUserId,
        reason: e instanceof Error ? e.message : 'unknown',
      });
      return mapped;
    }
    logError(context, 'lease_tenants.unlink.error', {
      actorUserId: ctx.user.id,
      leaseId,
      tenantUserId,
      message: e instanceof Error ? e.message : 'unknown_error',
    });
    throw e;
  }
}

app.http('landlordLeaseTenantsPost', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/leases/{leaseId}/tenants',
  handler: landlordLeaseTenantsPost,
});

app.http('landlordLeaseTenantDelete', {
  methods: ['DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/leases/{leaseId}/tenants/{tenantUserId}',
  handler: landlordLeaseTenantDelete,
});
