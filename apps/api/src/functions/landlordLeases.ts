import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { requireLandlordOrAdmin, jsonResponse, mapDomainError } from '../lib/managementRequest.js';
import { getPool } from '../lib/db.js';
import { logError, logInfo, logWarn } from '../lib/serverLogger.js';

import { listLeases } from '../useCases/leases/listLeases.js';
import { getLease } from '../useCases/leases/getLease.js';
import { createLease } from '../useCases/leases/createLease.js';
import { updateLease } from '../useCases/leases/updateLease.js';
import { deleteLease } from '../useCases/leases/deleteLease.js';

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function bool(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function landlordLeasesCollection(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  logInfo(context, 'leases.collection.start', { method: request.method });
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (request.method === 'GET') {
    try {
      const propertyId = request.query.get('property_id')?.trim();
      const result = await listLeases(getPool(), {
        actorUserId: ctx.user.id,
        actorRole: ctx.role,
        propertyId,
      });
      logInfo(context, 'leases.collection.list.success', {
        userId: ctx.user.id,
        propertyId: propertyId ?? null,
        count: result.leases.length,
      });
      return jsonResponse(200, ctx.headers, { leases: result.leases });
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) return mapped;
      throw e;
    }
  }

  if (request.method === 'POST') {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      logWarn(context, 'leases.collection.create.invalid_json', { userId: ctx.user.id });
      return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
    }
    const b = asRecord(body);

    try {
      const result = await createLease(getPool(), {
        actorUserId: ctx.user.id,
        actorRole: ctx.role,
        property_id: str(b.property_id),
        start_date: str(b.start_date),
        end_date: str(b.end_date) ?? null,
        month_to_month: bool(b.month_to_month),
        status: str(b.status),
        notes: str(b.notes) ?? null,
      });
      logInfo(context, 'leases.collection.create.success', {
        userId: ctx.user.id,
        leaseId: result.lease.id,
      });
      return jsonResponse(201, ctx.headers, { lease: result.lease });
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) {
        if ((e as { message?: string }).message === 'property_not_found') {
          logWarn(context, 'leases.collection.create.property_not_found', {
            userId: ctx.user.id,
            propertyId: str(asRecord(body ?? {}).property_id),
          });
        } else {
          logWarn(context, 'leases.collection.create.validation_failed', { userId: ctx.user.id });
        }
        return mapped;
      }
      logError(context, 'leases.collection.create.error', {
        userId: ctx.user.id,
        message: e instanceof Error ? e.message : 'unknown_error',
      });
      throw e;
    }
  }

  logWarn(context, 'leases.collection.method_not_allowed', { method: request.method });
  return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
}

async function landlordLeasesItem(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  logInfo(context, 'leases.item.start', { method: request.method, leaseId: request.params.id });
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;
  const id = request.params.id;

  if (request.method === 'GET') {
    try {
      const result = await getLease(getPool(), {
        leaseId: id,
        actorUserId: ctx.user.id,
        actorRole: ctx.role,
      });
      logInfo(context, 'leases.item.get.success', { userId: ctx.user.id, leaseId: id });
      return jsonResponse(200, ctx.headers, { lease: result.lease });
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) {
        logWarn(context, 'leases.item.get.not_found', { userId: ctx.user.id, leaseId: id });
        return mapped;
      }
      throw e;
    }
  }

  if (request.method === 'PATCH') {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      logWarn(context, 'leases.item.patch.invalid_json', { userId: ctx.user.id, leaseId: id });
      return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
    }
    const b = asRecord(body);

    try {
      const result = await updateLease(getPool(), {
        leaseId: id,
        actorUserId: ctx.user.id,
        actorRole: ctx.role,
        start_date: str(b.start_date),
        end_date: b.end_date !== undefined ? (str(b.end_date) ?? null) : undefined,
        end_date_present: b.end_date !== undefined,
        month_to_month: bool(b.month_to_month),
        status: str(b.status),
        notes: b.notes !== undefined ? (str(b.notes) ?? null) : undefined,
        notes_present: b.notes !== undefined,
      });
      logInfo(context, 'leases.item.patch.success', { userId: ctx.user.id, leaseId: id });
      return jsonResponse(200, ctx.headers, { lease: result.lease });
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) {
        logWarn(context, 'leases.item.patch.not_found', { userId: ctx.user.id, leaseId: id, status: str(asRecord(body ?? {}).status) });
        return mapped;
      }
      logError(context, 'leases.item.patch.error', {
        userId: ctx.user.id,
        leaseId: id,
        message: e instanceof Error ? e.message : 'unknown_error',
      });
      throw e;
    }
  }

  if (request.method === 'DELETE') {
    try {
      await deleteLease(getPool(), {
        leaseId: id,
        actorUserId: ctx.user.id,
        actorRole: ctx.role,
      });
      logInfo(context, 'leases.item.delete.success', { userId: ctx.user.id, leaseId: id });
      return jsonResponse(204, ctx.headers, null);
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) {
        logWarn(context, 'leases.item.delete.not_found', { userId: ctx.user.id, leaseId: id });
        return mapped;
      }
      logError(context, 'leases.item.delete.error', {
        userId: ctx.user.id,
        leaseId: id,
        message: e instanceof Error ? e.message : 'unknown_error',
      });
      throw e;
    }
  }

  logWarn(context, 'leases.item.method_not_allowed', {
    method: request.method,
    userId: ctx.user.id,
    leaseId: id,
  });
  return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
}

// ---------------------------------------------------------------------------
// Azure Function registrations
// ---------------------------------------------------------------------------

app.http('landlordLeasesCollection', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/leases',
  handler: landlordLeasesCollection,
});

app.http('landlordLeasesItem', {
  methods: ['GET', 'PATCH', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/leases/{id}',
  handler: landlordLeasesItem,
});
