import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { getPool } from '../lib/db.js';
import {
  jsonResponse,
  mapDomainError,
  requirePortalUser,
  requireLandlordOrAdmin,
} from '../lib/managementRequest.js';
import { readJsonBody } from '../lib/readBody.js';
import { logError, logInfo, logWarn } from '../lib/serverLogger.js';

import { listRentLedger } from '../useCases/rentLedger/listRentLedger.js';
import { recordPayment, updatePayment } from '../useCases/rentLedger/recordPayment.js';

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
// GET /api/portal/rent-ledger  — tenant views their own ledger
// ---------------------------------------------------------------------------

async function portalRentLedgerCollection(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  logInfo(context, 'portal.rentLedger.collection.start', { method: request.method });
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (request.method === 'GET') {
    try {
      const result = await listRentLedger(getPool(), {
        actorUserId: ctx.user.id,
        actorRole: ctx.role,
      });
      logInfo(context, 'portal.rentLedger.collection.list.success', {
        userId: ctx.user.id,
        count: result.entries.length,
      });
      return jsonResponse(200, ctx.headers, { entries: result.entries });
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) return mapped;
      logError(context, 'portal.rentLedger.collection.list.error', {
        userId: ctx.user.id,
        message: e instanceof Error ? e.message : 'unknown_error',
      });
      throw e;
    }
  }

  return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
}

// ---------------------------------------------------------------------------
// GET /api/landlord/rent-ledger?lease_id=X  — landlord views a lease ledger
// POST /api/landlord/rent-ledger             — landlord records an entry
// ---------------------------------------------------------------------------

async function landlordRentLedgerCollection(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  logInfo(context, 'landlord.rentLedger.collection.start', { method: request.method });
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (request.method === 'GET') {
    const leaseId = request.query.get('lease_id')?.trim();
    try {
      const result = await listRentLedger(getPool(), {
        actorUserId: ctx.user.id,
        actorRole: ctx.role,
        leaseId,
      });
      logInfo(context, 'landlord.rentLedger.collection.list.success', {
        userId: ctx.user.id,
        leaseId: leaseId ?? null,
        count: result.entries.length,
      });
      return jsonResponse(200, ctx.headers, { entries: result.entries });
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) {
        logWarn(context, 'landlord.rentLedger.collection.list.validation', {
          userId: ctx.user.id,
          leaseId: leaseId ?? null,
        });
        return mapped;
      }
      logError(context, 'landlord.rentLedger.collection.list.error', {
        userId: ctx.user.id,
        message: e instanceof Error ? e.message : 'unknown_error',
      });
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
        notes: str(b.notes) ?? null,
      });
      logInfo(context, 'landlord.rentLedger.collection.create.success', {
        userId: ctx.user.id,
        entryId: result.entry.id,
      });
      return jsonResponse(201, ctx.headers, { entry: result.entry });
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) {
        logWarn(context, 'landlord.rentLedger.collection.create.validation', { userId: ctx.user.id });
        return mapped;
      }
      logError(context, 'landlord.rentLedger.collection.create.error', {
        userId: ctx.user.id,
        message: e instanceof Error ? e.message : 'unknown_error',
      });
      throw e;
    }
  }

  return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
}

// ---------------------------------------------------------------------------
// PATCH /api/landlord/rent-ledger/{id}  — landlord edits an entry
// ---------------------------------------------------------------------------

async function landlordRentLedgerItem(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const entryId = request.params.id;
  logInfo(context, 'landlord.rentLedger.item.start', { method: request.method, entryId });
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
      logInfo(context, 'landlord.rentLedger.item.patch.success', { userId: ctx.user.id, entryId });
      return jsonResponse(200, ctx.headers, { entry: result.entry });
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) {
        logWarn(context, 'landlord.rentLedger.item.patch.validation', { userId: ctx.user.id, entryId });
        return mapped;
      }
      logError(context, 'landlord.rentLedger.item.patch.error', {
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

app.http('portalRentLedgerCollection', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/rent-ledger',
  handler: portalRentLedgerCollection,
});

app.http('landlordRentLedgerCollection', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/rent-ledger',
  handler: landlordRentLedgerCollection,
});

app.http('landlordRentLedgerItem', {
  methods: ['PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/rent-ledger/{id}',
  handler: landlordRentLedgerItem,
});
