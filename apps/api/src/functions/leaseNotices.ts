/**
 * Lease-notice endpoints:
 *   POST   /api/portal/leases/{leaseId}/notice         (tenant gives notice)
 *   GET    /api/portal/leases/{leaseId}/notices        (tenant or landlord: history)
 *   POST   /api/portal/notices/{noticeId}/co-sign      (co-tenant signs)
 *   POST   /api/portal/notices/{noticeId}/withdraw     (author withdraws)
 *   POST   /api/landlord/notices/{noticeId}/respond    (landlord accept/counter/reject)
 */

import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import {
  jsonResponse,
  mapDomainError,
  requireLandlordOrAdmin,
  requirePortalUser,
} from '../lib/managementRequest.js';
import { readJsonBody } from '../lib/readBody.js';
import { getPool } from '../lib/db.js';
import { logError, logInfo, logWarn } from '../lib/serverLogger.js';

import { giveNotice } from '../useCases/tenants/giveNotice.js';
import { coSignNotice } from '../useCases/tenants/coSignNotice.js';
import { withdrawNotice } from '../useCases/tenants/withdrawNotice.js';
import { respondToNotice } from '../useCases/tenants/respondToNotice.js';
import { getLeaseNotices } from '../useCases/tenants/getLeaseNotices.js';
import { listMyLeases } from '../useCases/tenants/listMyLeases.js';

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

function forwardingFromBody(b: Record<string, unknown>) {
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

function noticeReasonFromBody(v: unknown) {
  const allowed = ['relocating', 'job', 'purchase', 'early_termination', 'other'] as const;
  const s = str(v);
  return (allowed as readonly string[]).includes(s ?? '')
    ? (s as (typeof allowed)[number])
    : null;
}

function noticeScopeFromBody(v: unknown): 'all_tenants' | 'self_only' | null {
  const s = str(v);
  return s === 'all_tenants' || s === 'self_only' ? s : null;
}

// ---------------------------------------------------------------------------
// POST /api/portal/leases/{leaseId}/notice
// ---------------------------------------------------------------------------

async function handleGiveNotice(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const leaseId = request.params.leaseId ?? '';
  const gate = await requirePortalUser(request, context);
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

  const scope = noticeScopeFromBody(b.scope);
  if (!scope) return jsonResponse(400, ctx.headers, { error: 'invalid_scope' });

  try {
    const result = await giveNotice(getPool(), {
      actorUserId: ctx.user.id,
      leaseId,
      givenOn: strNullable(b.given_on),
      plannedMoveOutDate: str(b.planned_move_out_date) ?? '',
      reason: noticeReasonFromBody(b.reason),
      reasonNotes: strNullable(b.reason_notes),
      scope,
      earlyTermination: Boolean(b.early_termination),
      forwarding: forwardingFromBody(b),
    });
    logInfo(context, 'notice.give.success', { actorUserId: ctx.user.id, leaseId });
    return jsonResponse(200, ctx.headers, result);
  } catch (e) {
    const mapped = mapDomainError(e, ctx.headers);
    if (mapped) {
      logWarn(context, 'notice.give.failed', { actorUserId: ctx.user.id, leaseId });
      return mapped;
    }
    logError(context, 'notice.give.error', { actorUserId: ctx.user.id, leaseId });
    throw e;
  }
}

// ---------------------------------------------------------------------------
// GET /api/portal/leases/{leaseId}/notices
// ---------------------------------------------------------------------------

async function handleListNotices(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const leaseId = request.params.leaseId ?? '';
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (!leaseId) return jsonResponse(400, ctx.headers, { error: 'missing_lease_id' });

  try {
    const result = await getLeaseNotices(getPool(), {
      actorUserId: ctx.user.id,
      actorRole: String(ctx.user.role ?? ''),
      leaseId,
    });
    return jsonResponse(200, ctx.headers, result);
  } catch (e) {
    const mapped = mapDomainError(e, ctx.headers);
    if (mapped) return mapped;
    logError(context, 'notice.list.error', { actorUserId: ctx.user.id, leaseId });
    throw e;
  }
}

// ---------------------------------------------------------------------------
// POST /api/portal/notices/{noticeId}/co-sign
// ---------------------------------------------------------------------------

async function handleCoSign(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const noticeId = request.params.noticeId ?? '';
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (!noticeId) return jsonResponse(400, ctx.headers, { error: 'missing_notice_id' });

  try {
    const result = await coSignNotice(getPool(), {
      actorUserId: ctx.user.id,
      noticeId,
    });
    logInfo(context, 'notice.co_sign.success', { actorUserId: ctx.user.id, noticeId });
    return jsonResponse(200, ctx.headers, result);
  } catch (e) {
    const mapped = mapDomainError(e, ctx.headers);
    if (mapped) return mapped;
    logError(context, 'notice.co_sign.error', { actorUserId: ctx.user.id, noticeId });
    throw e;
  }
}

// ---------------------------------------------------------------------------
// POST /api/portal/notices/{noticeId}/withdraw
// ---------------------------------------------------------------------------

async function handleWithdraw(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const noticeId = request.params.noticeId ?? '';
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (!noticeId) return jsonResponse(400, ctx.headers, { error: 'missing_notice_id' });

  try {
    const result = await withdrawNotice(getPool(), {
      actorUserId: ctx.user.id,
      noticeId,
    });
    logInfo(context, 'notice.withdraw.success', { actorUserId: ctx.user.id, noticeId });
    return jsonResponse(200, ctx.headers, result);
  } catch (e) {
    const mapped = mapDomainError(e, ctx.headers);
    if (mapped) return mapped;
    logError(context, 'notice.withdraw.error', { actorUserId: ctx.user.id, noticeId });
    throw e;
  }
}

// ---------------------------------------------------------------------------
// POST /api/landlord/notices/{noticeId}/respond
// ---------------------------------------------------------------------------

async function handleRespond(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const noticeId = request.params.noticeId ?? '';
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (!noticeId) return jsonResponse(400, ctx.headers, { error: 'missing_notice_id' });

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

  const decision = str(b.decision);
  if (decision !== 'accept' && decision !== 'counter' && decision !== 'reject') {
    return jsonResponse(400, ctx.headers, { error: 'invalid_decision' });
  }

  try {
    const result = await respondToNotice(getPool(), {
      actorUserId: ctx.user.id,
      actorRole: ctx.role,
      noticeId,
      decision,
      counterDate: strNullable(b.counter_date),
      counterNotes: strNullable(b.counter_notes),
    });
    logInfo(context, 'notice.respond.success', {
      actorUserId: ctx.user.id,
      noticeId,
      decision,
    });
    return jsonResponse(200, ctx.headers, result);
  } catch (e) {
    const mapped = mapDomainError(e, ctx.headers);
    if (mapped) return mapped;
    logError(context, 'notice.respond.error', { actorUserId: ctx.user.id, noticeId });
    throw e;
  }
}

// ---------------------------------------------------------------------------
// GET /api/portal/my/leases
// ---------------------------------------------------------------------------

async function handleListMyLeases(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  try {
    const result = await listMyLeases(getPool(), {
      actorUserId: ctx.user.id,
      actorRole: String(ctx.user.role ?? ''),
    });
    return jsonResponse(200, ctx.headers, result);
  } catch (e) {
    const mapped = mapDomainError(e, ctx.headers);
    if (mapped) return mapped;
    logError(context, 'my_leases.list.error', { actorUserId: ctx.user.id });
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Registrations
// ---------------------------------------------------------------------------

app.http('portalListMyLeases', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/my/leases',
  handler: handleListMyLeases,
});

app.http('portalGiveNotice', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/leases/{leaseId}/notice',
  handler: handleGiveNotice,
});

app.http('portalListLeaseNotices', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/leases/{leaseId}/notices',
  handler: handleListNotices,
});

app.http('portalCoSignNotice', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/notices/{noticeId}/co-sign',
  handler: handleCoSign,
});

app.http('portalWithdrawNotice', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/notices/{noticeId}/withdraw',
  handler: handleWithdraw,
});

app.http('landlordRespondToNotice', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/notices/{noticeId}/respond',
  handler: handleRespond,
});
