/**
 * Landlord-facing lease lifecycle endpoints: move-out, terminate (eviction / early termination),
 * delete-as-mistake, admin re-rent block override, past-tenants listing.
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
import { logError, logInfo, logWarn } from '../lib/serverLogger.js';
import { Role } from '../domain/constants.js';

import { moveOutLease } from '../useCases/tenants/moveOutLease.js';
import { terminateLease } from '../useCases/tenants/terminateLease.js';
import { overrideRerentBlock } from '../useCases/tenants/overrideRerentBlock.js';
import { listPastTenants } from '../useCases/tenants/listPastTenants.js';

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

function numNullable(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function forwardingFromBody(b: Record<string, unknown>): {
  street: string | null;
  street2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
} | null {
  const src = asRecord(b.forwarding ?? b.forwarding_address);
  if (Object.keys(src).length === 0) return null;
  return {
    street: strNullable(src.street),
    street2: strNullable(src.street2),
    city: strNullable(src.city),
    state: strNullable(src.state),
    zip: strNullable(src.zip),
    country: strNullable(src.country),
  };
}

// ---------------------------------------------------------------------------
// POST /api/landlord/leases/{leaseId}/move-out
// ---------------------------------------------------------------------------

async function handleMoveOut(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const leaseId = request.params.leaseId ?? '';
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (!leaseId) return jsonResponse(400, ctx.headers, { error: 'missing_lease_id' });

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
    const reason = str(b.ended_reason);
    const validReasons = ['end_of_term', 'mutual', 'other'] as const;
    const endedReason = (validReasons as readonly string[]).includes(reason ?? '')
      ? (reason as (typeof validReasons)[number])
      : undefined;

    const result = await moveOutLease(getPool(), {
      actorUserId: ctx.user.id,
      actorRole: ctx.role,
      leaseId,
      endedOn: str(b.ended_on) ?? '',
      endedReason,
      endedNotes: strNullable(b.ended_notes),
      forwarding: forwardingFromBody(b),
      finalBalanceAmount: numNullable(b.final_balance_amount),
      inspectionNotes: strNullable(b.inspection_notes),
      internalNotes: strNullable(b.internal_notes),
    });
    logInfo(context, 'lease.move_out.success', { actorUserId: ctx.user.id, leaseId });
    return jsonResponse(200, ctx.headers, result);
  } catch (e) {
    const mapped = mapDomainError(e, ctx.headers);
    if (mapped) {
      logWarn(context, 'lease.move_out.failed', {
        actorUserId: ctx.user.id,
        leaseId,
        reason: e instanceof Error ? e.message : 'unknown',
      });
      return mapped;
    }
    logError(context, 'lease.move_out.error', { actorUserId: ctx.user.id, leaseId });
    throw e;
  }
}

// ---------------------------------------------------------------------------
// POST /api/landlord/leases/{leaseId}/terminate
// ---------------------------------------------------------------------------

async function handleTerminate(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const leaseId = request.params.leaseId ?? '';
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (!leaseId) return jsonResponse(400, ctx.headers, { error: 'missing_lease_id' });

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

  const kindRaw = str(b.kind);
  if (kindRaw !== 'eviction' && kindRaw !== 'early_termination') {
    return jsonResponse(400, ctx.headers, { error: 'invalid_kind' });
  }

  try {
    const result = await terminateLease(getPool(), {
      actorUserId: ctx.user.id,
      actorRole: ctx.role,
      leaseId,
      kind: kindRaw,
      endedOn: str(b.ended_on) ?? '',
      endedNotes: strNullable(b.ended_notes),
      forwarding: forwardingFromBody(b),
      finalBalanceAmount: numNullable(b.final_balance_amount),
      earlyTerminationFeeAmount: numNullable(b.early_termination_fee_amount),
      caseNumber: strNullable(b.case_number),
      noticeServedOn: strNullable(b.notice_served_on),
      judgmentDate: strNullable(b.judgment_date),
      judgmentAmount: numNullable(b.judgment_amount),
      collectionsForwarded: typeof b.collections_forwarded === 'boolean' ? b.collections_forwarded : false,
      evictionDetails: strNullable(b.eviction_details),
    });
    logInfo(context, 'lease.terminate.success', { actorUserId: ctx.user.id, leaseId, kind: kindRaw });
    return jsonResponse(200, ctx.headers, result);
  } catch (e) {
    const mapped = mapDomainError(e, ctx.headers);
    if (mapped) {
      logWarn(context, 'lease.terminate.failed', { actorUserId: ctx.user.id, leaseId });
      return mapped;
    }
    logError(context, 'lease.terminate.error', { actorUserId: ctx.user.id, leaseId });
    throw e;
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/rerent-blocks/{blockId}/override
// ---------------------------------------------------------------------------

async function handleOverrideBlock(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const blockId = request.params.blockId ?? '';
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (ctx.role !== Role.ADMIN) return jsonResponse(403, ctx.headers, { error: 'forbidden' });

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch {
    body = null;
  }
  const b = asRecord(body);

  try {
    const result = await overrideRerentBlock(getPool(), {
      actorUserId: ctx.user.id,
      actorRole: ctx.role,
      blockId,
      overrideNotes: strNullable(b.override_notes),
    });
    return jsonResponse(200, ctx.headers, result);
  } catch (e) {
    const mapped = mapDomainError(e, ctx.headers);
    if (mapped) return mapped;
    throw e;
  }
}

// ---------------------------------------------------------------------------
// GET /api/landlord/tenants/past
// ---------------------------------------------------------------------------

async function handleListPastTenants(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  try {
    const landlordId =
      ctx.role === Role.ADMIN ? (request.query.get('landlord_id')?.trim() ?? null) : null;
    const result = await listPastTenants(getPool(), {
      actorUserId: ctx.user.id,
      actorRole: ctx.role,
      landlordId,
    });
    return jsonResponse(200, ctx.headers, result);
  } catch (e) {
    const mapped = mapDomainError(e, ctx.headers);
    if (mapped) return mapped;
    logError(context, 'tenants.past.error', { actorUserId: ctx.user.id });
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Registrations
// ---------------------------------------------------------------------------

app.http('landlordLeaseMoveOut', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/leases/{leaseId}/move-out',
  handler: handleMoveOut,
});

app.http('landlordLeaseTerminate', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/leases/{leaseId}/terminate',
  handler: handleTerminate,
});

app.http('adminRerentBlockOverride', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'admin/rerent-blocks/{blockId}/override',
  handler: handleOverrideBlock,
});

app.http('landlordPastTenants', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/past-tenants',
  handler: handleListPastTenants,
});
