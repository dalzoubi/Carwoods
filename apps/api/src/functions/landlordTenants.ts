import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { requireLandlordOrAdmin, jsonResponse, mapDomainError } from '../lib/managementRequest.js';
import { readJsonBody } from '../lib/readBody.js';
import { getPool } from '../lib/db.js';
import { logError, logInfo, logWarn } from '../lib/serverLogger.js';
import { Role } from '../domain/constants.js';

import { listTenants } from '../useCases/tenants/listTenants.js';
import { getTenant } from '../useCases/tenants/getTenant.js';
import { onboardTenant } from '../useCases/tenants/onboardTenant.js';
import { setTenantActive } from '../useCases/tenants/setTenantActive.js';
import { addTenantLease } from '../useCases/tenants/addTenantLease.js';

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
}

function strNullable(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function bool(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined;
}

// ---------------------------------------------------------------------------
// GET/POST /api/landlord/tenants
// ---------------------------------------------------------------------------

async function landlordTenantsCollection(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  logInfo(context, 'tenants.collection.start', { method: request.method });
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  // ------- GET: list tenants -------
  if (request.method === 'GET') {
    try {
      // Admin may pass ?landlord_id= to filter by a specific landlord
      const landlordId =
        ctx.role === Role.ADMIN ? (request.query.get('landlord_id')?.trim() ?? null) : null;

      const result = await listTenants(getPool(), {
        actorUserId: ctx.user.id,
        actorRole: ctx.role,
        landlordId,
      });
      logInfo(context, 'tenants.collection.list.success', {
        actorUserId: ctx.user.id,
        count: result.tenants.length,
        landlordId,
      });
      return jsonResponse(200, ctx.headers, { tenants: result.tenants });
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) return mapped;
      logError(context, 'tenants.collection.list.error', {
        actorUserId: ctx.user.id,
        message: e instanceof Error ? e.message : 'unknown_error',
      });
      throw e;
    }
  }

  // ------- POST: onboard tenant -------
  if (request.method === 'POST') {
    let body: unknown;
    try {
      body = await readJsonBody(request);
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) return mapped;
      throw e;
    }
    if (body === null) {
      logWarn(context, 'tenants.collection.create.invalid_json', { actorUserId: ctx.user.id });
      return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
    }
    const b = asRecord(body);
    const leaseObj = asRecord(b.lease);

    try {
      const result = await onboardTenant(getPool(), {
        actorUserId: ctx.user.id,
        actorRole: ctx.role,
        email: str(b.email),
        firstName: strNullable(b.first_name),
        lastName: strNullable(b.last_name),
        phone: strNullable(b.phone),
        propertyId: str(b.property_id),
        startDate: str(leaseObj.start_date),
        endDate: strNullable(leaseObj.end_date),
        monthToMonth: bool(leaseObj.month_to_month),
        notes: strNullable(leaseObj.notes),
      });
      logInfo(context, 'tenants.collection.create.success', {
        actorUserId: ctx.user.id,
        tenantId: result.tenant.id,
        leaseId: result.lease.id,
        created: result.tenant_created,
      });
      return jsonResponse(201, ctx.headers, {
        tenant: result.tenant,
        tenant_created: result.tenant_created,
        lease: result.lease,
      });
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) {
        logWarn(context, 'tenants.collection.create.failed', {
          actorUserId: ctx.user.id,
          reason: e instanceof Error ? e.message : 'unknown',
        });
        return mapped;
      }
      logError(context, 'tenants.collection.create.error', {
        actorUserId: ctx.user.id,
        message: e instanceof Error ? e.message : 'unknown_error',
      });
      throw e;
    }
  }

  logWarn(context, 'tenants.collection.method_not_allowed', {
    actorUserId: ctx.user.id,
    method: request.method,
  });
  return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
}

// ---------------------------------------------------------------------------
// GET/PATCH /api/landlord/tenants/{id}
// ---------------------------------------------------------------------------

async function landlordTenantsItem(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const tenantId = request.params.id;
  logInfo(context, 'tenants.item.start', { method: request.method, tenantId });
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (!tenantId) {
    logWarn(context, 'tenants.item.missing_id', { actorUserId: ctx.user.id });
    return jsonResponse(400, ctx.headers, { error: 'missing_id' });
  }

  // ------- GET: get tenant with leases -------
  if (request.method === 'GET') {
    try {
      const result = await getTenant(getPool(), {
        actorUserId: ctx.user.id,
        actorRole: ctx.role,
        tenantId,
      });
      logInfo(context, 'tenants.item.get.success', { actorUserId: ctx.user.id, tenantId });
      return jsonResponse(200, ctx.headers, { tenant: result.tenant, leases: result.leases });
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) {
        logWarn(context, 'tenants.item.get.not_found', { actorUserId: ctx.user.id, tenantId });
        return mapped;
      }
      logError(context, 'tenants.item.get.error', {
        actorUserId: ctx.user.id,
        tenantId,
        message: e instanceof Error ? e.message : 'unknown_error',
      });
      throw e;
    }
  }

  // ------- PATCH: enable/disable tenant access -------
  if (request.method === 'PATCH') {
    let body: unknown;
    try {
      body = await readJsonBody(request);
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) return mapped;
      throw e;
    }
    if (body === null) {
      return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
    }
    const b = asRecord(body);
    if (typeof b.active !== 'boolean') {
      logWarn(context, 'tenants.item.patch.missing_active', { actorUserId: ctx.user.id, tenantId });
      return jsonResponse(400, ctx.headers, { error: 'missing_active' });
    }
    try {
      const result = await setTenantActive(getPool(), {
        actorUserId: ctx.user.id,
        actorRole: ctx.role,
        tenantId,
        active: b.active,
      });
      logInfo(context, 'tenants.item.patch.success', {
        actorUserId: ctx.user.id,
        tenantId,
        active: b.active,
      });
      return jsonResponse(200, ctx.headers, { tenant: result.tenant });
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) {
        logWarn(context, 'tenants.item.patch.not_found', { actorUserId: ctx.user.id, tenantId });
        return mapped;
      }
      logError(context, 'tenants.item.patch.error', {
        actorUserId: ctx.user.id,
        tenantId,
        message: e instanceof Error ? e.message : 'unknown_error',
      });
      throw e;
    }
  }

  logWarn(context, 'tenants.item.method_not_allowed', {
    actorUserId: ctx.user.id,
    method: request.method,
    tenantId,
  });
  return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
}

// ---------------------------------------------------------------------------
// POST /api/landlord/tenants/{id}/leases
// ---------------------------------------------------------------------------

async function landlordTenantLeases(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const tenantId = request.params.id;
  logInfo(context, 'tenants.leases.start', { method: request.method, tenantId });
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (!tenantId) {
    return jsonResponse(400, ctx.headers, { error: 'missing_id' });
  }

  if (request.method !== 'POST') {
    logWarn(context, 'tenants.leases.method_not_allowed', {
      actorUserId: ctx.user.id,
      method: request.method,
      tenantId,
    });
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (e) {
    const mapped = mapDomainError(e, ctx.headers);
    if (mapped) return mapped;
    throw e;
  }
  if (body === null) {
    return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
  }
  const b = asRecord(body);

  try {
    const result = await addTenantLease(getPool(), {
      actorUserId: ctx.user.id,
      actorRole: ctx.role,
      tenantId,
      propertyId: str(b.property_id),
      startDate: str(b.start_date),
      endDate: strNullable(b.end_date),
      monthToMonth: bool(b.month_to_month),
      notes: strNullable(b.notes),
    });
    logInfo(context, 'tenants.leases.create.success', {
      actorUserId: ctx.user.id,
      tenantId,
      leaseId: result.lease.id,
    });
    return jsonResponse(201, ctx.headers, { lease: result.lease });
  } catch (e) {
    const mapped = mapDomainError(e, ctx.headers);
    if (mapped) {
      logWarn(context, 'tenants.leases.create.failed', {
        actorUserId: ctx.user.id,
        tenantId,
        reason: e instanceof Error ? e.message : 'unknown',
      });
      return mapped;
    }
    logError(context, 'tenants.leases.create.error', {
      actorUserId: ctx.user.id,
      tenantId,
      message: e instanceof Error ? e.message : 'unknown_error',
    });
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Azure Function registrations
// ---------------------------------------------------------------------------

app.http('landlordTenantsCollection', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/tenants',
  handler: landlordTenantsCollection,
});

app.http('landlordTenantsItem', {
  methods: ['GET', 'PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/tenants/{id}',
  handler: landlordTenantsItem,
});

app.http('landlordTenantLeasesCollection', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/tenants/{id}/leases',
  handler: landlordTenantLeases,
});
