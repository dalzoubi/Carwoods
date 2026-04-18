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
    try {
      const result = await listPaymentEntries(getPool(), {
        actorUserId: ctx.user.id,
        actorRole,
      });
      logInfo(context, 'portal.payments.collection.list.success', {
        userId: ctx.user.id,
        actorRole,
        count: result.entries.length,
        listScope: 'tenant',
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
    const leaseId = request.query.get('lease_id')?.trim();
    if (!leaseId) {
      logWarn(context, 'landlord.payments.collection.list.missingLeaseId', {
        userId: ctx.user.id,
      });
      return jsonResponse(400, ctx.headers, { error: 'lease_id_required' });
    }
    logInfo(context, 'landlord.payments.collection.list.begin', {
      userId: ctx.user.id,
      leaseId,
      actorRole: ctx.role,
    });
    try {
      const result = await listPaymentEntries(getPool(), {
        actorUserId: ctx.user.id,
        actorRole: ctx.role,
        leaseId,
      });
      logInfo(context, 'landlord.payments.collection.list.success', {
        userId: ctx.user.id,
        leaseId,
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

    try {
      const result = await recordPayment(getPool(), {
        actorUserId: ctx.user.id,
        actorRole: ctx.role,
        lease_id: str(b.lease_id),
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
  methods: ['PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/payments/{id}',
  handler: landlordPaymentsItem,
});
