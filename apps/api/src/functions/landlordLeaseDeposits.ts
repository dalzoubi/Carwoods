/**
 * Landlord-facing deposits endpoints: list per lease, create, patch, soft-delete,
 * and upsert a disposition (refund + withhold split) for a single deposit.
 */

import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { requireLandlordOrAdmin, jsonResponse, mapDomainError } from '../lib/managementRequest.js';
import { readJsonBody } from '../lib/readBody.js';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/serverLogger.js';

import { listLeaseDeposits } from '../useCases/tenants/listLeaseDeposits.js';
import { createLeaseDeposit } from '../useCases/tenants/createLeaseDeposit.js';
import { updateLeaseDeposit } from '../useCases/tenants/updateLeaseDeposit.js';
import { deleteLeaseDeposit } from '../useCases/tenants/deleteLeaseDeposit.js';
import { upsertDepositDisposition } from '../useCases/tenants/upsertDepositDisposition.js';
import type { DepositKind } from '../lib/leaseDepositsRepo.js';

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

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** One registration per route template (Azure requires unique templates; method alone is not enough). */
async function landlordLeaseDepositsCollection(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const leaseId = request.params.leaseId ?? '';
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (request.method === 'GET') {
    try {
      const result = await listLeaseDeposits(getPool(), {
        actorUserId: ctx.user.id,
        actorRole: ctx.role,
        leaseId,
      });
      return jsonResponse(200, ctx.headers, result);
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) return mapped;
      logError(context, 'lease.deposits.list.error', { actorUserId: ctx.user.id, leaseId });
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
      const result = await createLeaseDeposit(getPool(), {
        actorUserId: ctx.user.id,
        actorRole: ctx.role,
        leaseId,
        kind: (str(b.kind) ?? undefined) as DepositKind | undefined,
        amount: num(b.amount) ?? NaN,
        heldSince: str(b.held_since) ?? '',
        notes: strNullable(b.notes),
      });
      return jsonResponse(201, ctx.headers, result);
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) return mapped;
      logError(context, 'lease.deposits.create.error', { actorUserId: ctx.user.id, leaseId });
      throw e;
    }
  }

  return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
}

async function landlordDepositItem(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const depositId = request.params.depositId ?? '';
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
      const result = await updateLeaseDeposit(getPool(), {
        actorUserId: ctx.user.id,
        actorRole: ctx.role,
        depositId,
        kind: (str(b.kind) ?? undefined) as DepositKind | undefined,
        amount: num(b.amount),
        heldSince: str(b.held_since),
        notes: 'notes' in b ? strNullable(b.notes) : undefined,
      });
      return jsonResponse(200, ctx.headers, result);
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) return mapped;
      logError(context, 'lease.deposits.update.error', { actorUserId: ctx.user.id, depositId });
      throw e;
    }
  }

  if (request.method === 'DELETE') {
    try {
      const result = await deleteLeaseDeposit(getPool(), {
        actorUserId: ctx.user.id,
        actorRole: ctx.role,
        depositId,
      });
      return jsonResponse(200, ctx.headers, result);
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) return mapped;
      logError(context, 'lease.deposits.delete.error', { actorUserId: ctx.user.id, depositId });
      throw e;
    }
  }

  return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
}

async function handleUpsertDisposition(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const depositId = request.params.depositId ?? '';
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

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
    const result = await upsertDepositDisposition(getPool(), {
      actorUserId: ctx.user.id,
      actorRole: ctx.role,
      depositId,
      refundedAmount: num(b.refunded_amount) ?? NaN,
      withheldAmount: num(b.withheld_amount) ?? NaN,
      withholdingReason: strNullable(b.withholding_reason),
      processedOn: strNullable(b.processed_on),
    });
    return jsonResponse(200, ctx.headers, result);
  } catch (e) {
    const mapped = mapDomainError(e, ctx.headers);
    if (mapped) return mapped;
    logError(context, 'lease.deposits.disposition.error', { actorUserId: ctx.user.id, depositId });
    throw e;
  }
}

app.http('landlordLeaseDepositsCollection', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/leases/{leaseId}/deposits',
  handler: landlordLeaseDepositsCollection,
});

app.http('landlordDepositItem', {
  methods: ['PATCH', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/deposits/{depositId}',
  handler: landlordDepositItem,
});

app.http('landlordDepositDisposition', {
  methods: ['PUT', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/deposits/{depositId}/disposition',
  handler: handleUpsertDisposition,
});
