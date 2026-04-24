import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { getPool } from '../lib/db.js';
import { isDomainError } from '../domain/errors.js';
import {
  jsonResponse,
  mapDomainError,
  requirePortalUser,
  requireLandlordOrAdmin,
} from '../lib/managementRequest.js';
import { readJsonBody } from '../lib/readBody.js';
import { logError, logInfo, logWarn } from '../lib/serverLogger.js';

import { paymentEntriesToApiJson, paymentEntryToApiJson } from '../lib/paymentEntriesApiJson.js';
import { listPaymentEntries } from '../useCases/payments/listPaymentEntries.js';
import { recordPayment, updatePayment } from '../useCases/payments/recordPayment.js';
import { deletePayment } from '../useCases/payments/deletePayment.js';

/** HTTP status from Azure Functions response shape (for logs). */
function responseStatus(r: HttpResponseInit): number | undefined {
  return typeof r.status === 'number' ? r.status : undefined;
}

/** Fields safe to log for support (message + truncated stack + domain error metadata). */
function paymentsErrorFields(error: unknown): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    errType: error instanceof Error ? error.name : typeof error,
    errMessage: error instanceof Error ? error.message : String(error),
  };
  if (error instanceof Error && error.stack) {
    fields.errStack = error.stack.slice(0, 6000);
  }
  if (isDomainError(error)) {
    fields.domainCode = error.code;
    fields.domainMessage = error.message;
    if (error.detail) fields.domainDetail = error.detail;
  }
  return fields;
}

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function num(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// GET /api/portal/payments  — tenant views their lease payment entries
// ---------------------------------------------------------------------------

async function portalPaymentsCollection(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  logInfo(context, 'portal.payments.collection.start', { method: request.method });
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) {
    logWarn(context, 'portal.payments.collection.authFailed', {
      httpStatus: responseStatus(gate.response),
    });
    return gate.response;
  }
  const { ctx } = gate;

  if (request.method === 'GET') {
    const actorRole = String(ctx.user.role ?? '');
    logInfo(context, 'portal.payments.collection.list.begin', {
      userId: ctx.user.id,
      actorRole,
      listScope: 'tenant',
    });
    const propertyId = request.query.get('property_id')?.trim() || null;
    try {
      const result = await listPaymentEntries(getPool(), {
        actorUserId: ctx.user.id,
        actorRole,
        propertyIdForTenant: propertyId,
      });
      logInfo(context, 'portal.payments.collection.list.success', {
        userId: ctx.user.id,
        actorRole,
        count: result.entries.length,
        listScope: 'tenant',
        propertyId: propertyId ?? null,
      });
      return jsonResponse(200, ctx.headers, {
        entries: paymentEntriesToApiJson(result.entries),
      });
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      const fields = {
        userId: ctx.user.id,
        actorRole,
        listScope: 'tenant',
        ...paymentsErrorFields(e),
        mappedToHttp: Boolean(mapped),
        httpStatus: mapped ? responseStatus(mapped) : undefined,
      };
      if (mapped) {
        logWarn(context, 'portal.payments.collection.list.failed', fields);
        return mapped;
      }
      logError(context, 'portal.payments.collection.list.unhandled', fields);
      throw e;
    }
  }

  return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
}

// ---------------------------------------------------------------------------
// GET /api/landlord/payments?lease_id=X
// POST /api/landlord/payments
// ---------------------------------------------------------------------------

async function landlordPaymentsCollection(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  logInfo(context, 'landlord.payments.collection.start', { method: request.method });
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (request.method === 'GET') {
    const leaseId = request.query.get('lease_id')?.trim() || null;
    const propertyId = request.query.get('property_id')?.trim() || null;
    const filterLeaseId = request.query.get('filter_lease_id')?.trim() || null;
    const filterTenantUserId = request.query.get('filter_tenant_user_id')?.trim() || null;
    if (!leaseId && !propertyId) {
      // Log name kept for existing monitors; modern clients must send at least
      // `property_id` (property-wide list) and may also send `lease_id` (legacy).
      logWarn(context, 'landlord.payments.collection.list.missingLeaseId', {
        userId: ctx.user.id,
        hasLeaseIdQuery: request.query.has('lease_id'),
        hasPropertyIdQuery: request.query.has('property_id'),
        rawLeaseId: request.query.get('lease_id'),
        rawPropertyId: request.query.get('property_id'),
      });
      return jsonResponse(400, ctx.headers, { error: 'property_id_or_lease_id_required' });
    }
    logInfo(context, 'landlord.payments.collection.list.begin', {
      userId: ctx.user.id,
      leaseId,
      propertyId,
      actorRole: ctx.role,
    });
    try {
      const result = await listPaymentEntries(getPool(), {
        actorUserId: ctx.user.id,
        actorRole: ctx.role,
        leaseId: leaseId || undefined,
        propertyId: propertyId || undefined,
        filterLeaseId: filterLeaseId || undefined,
        filterTenantUserId: filterTenantUserId || undefined,
      });
      logInfo(context, 'landlord.payments.collection.list.success', {
        userId: ctx.user.id,
        leaseId,
        propertyId,
        count: result.entries.length,
      });
      return jsonResponse(200, ctx.headers, {
        entries: paymentEntriesToApiJson(result.entries),
      });
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      const fields = {
        userId: ctx.user.id,
        leaseId,
        propertyId,
        actorRole: ctx.role,
        ...paymentsErrorFields(e),
        mappedToHttp: Boolean(mapped),
        httpStatus: mapped ? responseStatus(mapped) : undefined,
      };
      if (mapped) {
        logWarn(context, 'landlord.payments.collection.list.failed', fields);
        return mapped;
      }
      logError(context, 'landlord.payments.collection.list.unhandled', fields);
      throw e;
    }
  }

  if (request.method === 'POST') {
    let body: unknown;
    try {
      body = await readJsonBody(request);
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) return mapped;
      throw e;
    }
    if (body === null) return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
    const b = asRecord(body);

    const bool = (v: unknown): boolean | null | undefined => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      if (typeof v === 'boolean') return v;
      if (v === 0 || v === 1) return v === 1;
      if (v === 'true' || v === '1') return true;
      if (v === 'false' || v === '0') return false;
      return undefined;
    };
    try {
      const result = await recordPayment(getPool(), {
        actorUserId: ctx.user.id,
        actorRole: ctx.role,
        lease_id: str(b.lease_id) ?? null,
        property_id: str(b.property_id) ?? null,
        tenant_user_id: str(b.tenant_user_id) ?? null,
        show_in_tenant_portal: bool(b.show_in_tenant_portal),
        period_start: str(b.period_start),
        amount_due: num(b.amount_due),
        amount_paid: num(b.amount_paid) ?? 0,
        due_date: str(b.due_date),
        paid_date: str(b.paid_date) ?? null,
        payment_method: str(b.payment_method) ?? null,
        payment_type: str(b.payment_type) ?? null,
        notes: str(b.notes) ?? null,
      });
      logInfo(context, 'landlord.payments.collection.create.success', {
        userId: ctx.user.id,
        entryId: result.entry.id,
      });
      return jsonResponse(201, ctx.headers, { entry: paymentEntryToApiJson(result.entry) });
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) {
        logWarn(context, 'landlord.payments.collection.create.validation', { userId: ctx.user.id });
        return mapped;
      }
      logError(context, 'landlord.payments.collection.create.error', {
        userId: ctx.user.id,
        message: e instanceof Error ? e.message : 'unknown_error',
      });
      throw e;
    }
  }

  return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
}

// ---------------------------------------------------------------------------
// PATCH /api/landlord/payments/{id}
// ---------------------------------------------------------------------------

async function landlordPaymentsItem(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const entryId = request.params.id;
  logInfo(context, 'landlord.payments.item.start', { method: request.method, entryId });
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (request.method === 'DELETE') {
    try {
      const r = await deletePayment(getPool(), {
        actorUserId: ctx.user.id,
        actorRole: ctx.role,
        entryId: entryId!,
      });
      if (r === 'not_found') {
        return jsonResponse(404, ctx.headers, { error: 'not_found' });
      }
      // r === 'ok' | 'already_deleted' — both 204
      return { status: 204, headers: ctx.headers };
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) {
        logWarn(context, 'landlord.payments.item.delete.validation', { userId: ctx.user.id, entryId });
        return mapped;
      }
      logError(context, 'landlord.payments.item.delete.error', {
        userId: ctx.user.id,
        entryId,
        message: e instanceof Error ? e.message : 'unknown_error',
      });
      throw e;
    }
  }

  if (request.method === 'PATCH') {
    let body: unknown;
    try {
      body = await readJsonBody(request);
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) return mapped;
      throw e;
    }
    if (body === null) return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
    const b = asRecord(body);

    const boolPatch = (v: unknown): boolean | undefined => {
      if (v === undefined || v === null) return undefined;
      if (typeof v === 'boolean') return v;
      if (v === 0 || v === 1) return v === 1;
      if (v === 'true' || v === '1') return true;
      if (v === 'false' || v === '0') return false;
      return undefined;
    };
    try {
      const result = await updatePayment(getPool(), {
        actorUserId: ctx.user.id,
        actorRole: ctx.role,
        entryId,
        amount_due: num(b.amount_due),
        amount_paid: num(b.amount_paid),
        due_date: str(b.due_date),
        paid_date: b.paid_date !== undefined ? (str(b.paid_date) ?? null) : undefined,
        payment_method: b.payment_method !== undefined ? (str(b.payment_method) ?? null) : undefined,
        notes: b.notes !== undefined ? (str(b.notes) ?? null) : undefined,
        show_in_tenant_portal: boolPatch(b.show_in_tenant_portal),
      });
      logInfo(context, 'landlord.payments.item.patch.success', { userId: ctx.user.id, entryId });
      return jsonResponse(200, ctx.headers, { entry: paymentEntryToApiJson(result.entry) });
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) {
        logWarn(context, 'landlord.payments.item.patch.validation', { userId: ctx.user.id, entryId });
        return mapped;
      }
      logError(context, 'landlord.payments.item.patch.error', {
        userId: ctx.user.id,
        entryId,
        message: e instanceof Error ? e.message : 'unknown_error',
      });
      throw e;
    }
  }

  return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
}

// ---------------------------------------------------------------------------
// Azure Function registrations
// ---------------------------------------------------------------------------

app.http('portalPaymentsCollection', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/payments',
  handler: portalPaymentsCollection,
});

app.http('landlordPaymentsCollection', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/payments',
  handler: landlordPaymentsCollection,
});

app.http('landlordPaymentsItem', {
  methods: ['DELETE', 'PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/payments/{id}',
  handler: landlordPaymentsItem,
});
