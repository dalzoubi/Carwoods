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

async function handleListByLease(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const leaseId = request.params.leaseId ?? '';
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

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

async function handleCreateForLease(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const leaseId = request.params.leaseId ?? '';
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

async function handleUpdateDeposit(
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

async function handleDeleteDeposit(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const depositId = request.params.depositId ?? '';
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

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

app.http('landlordLeaseDepositsList', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/leases/{leaseId}/deposits',
  handler: handleListByLease,
});

app.http('landlordLeaseDepositsCreate', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/leases/{leaseId}/deposits',
  handler: handleCreateForLease,
});

app.http('landlordDepositUpdate', {
  methods: ['PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/deposits/{depositId}',
  handler: handleUpdateDeposit,
});

app.http('landlordDepositDelete', {
  methods: ['DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/deposits/{depositId}',
  handler: handleDeleteDeposit,
});

app.http('landlordDepositDisposition', {
  methods: ['PUT', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/deposits/{depositId}/disposition',
  handler: handleUpsertDisposition,
});
