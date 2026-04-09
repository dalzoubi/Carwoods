import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { getPool } from '../lib/db.js';
import { jsonResponse, mapDomainError, requireLandlordOrAdmin } from '../lib/managementRequest.js';
import { logError, logWarn } from '../lib/serverLogger.js';

import { listRequests } from '../useCases/requests/listRequests.js';
import { getRequest } from '../useCases/requests/getRequest.js';
import { updateRequestStatus } from '../useCases/requests/updateRequestStatus.js';
import { exportRequestsCsv } from '../useCases/requests/exportRequestsCsv.js';
import { listRequestAudit } from '../useCases/requests/listRequestAudit.js';
import { processElsaAutoResponse } from '../useCases/requests/processElsaAutoResponse.js';
import { reviewElsaDecision } from '../useCases/requests/reviewElsaDecision.js';
import {
  getAiAgentRouting,
  getElsaSettings,
  getElsaRequestAutoRespond,
  listAiAgents,
  listCategoryPolicies,
  listElsaDecisionsForRequest,
  listPriorityPolicies,
  listPropertyPolicies,
  setAiAgentRouting,
  setElsaRequestAutoRespond,
  upsertCategoryPolicy,
  upsertElsaSettings,
  upsertPriorityPolicy,
  upsertPropertyPolicy,
} from '../lib/elsaRepo.js';

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v.trim() : undefined;
}

function bool(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined;
}

function listStrings(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const items = v.map((item) => String(item ?? '').trim()).filter(Boolean);
  return items;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function landlordRequestsCollection(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (request.method !== 'GET') {
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }

  try {
    const result = await listRequests(getPool(), {
      actorUserId: ctx.user.id,
      actorRole: ctx.role,
    });
    return jsonResponse(200, ctx.headers, { requests: result.requests });
  } catch (e) {
    const mapped = mapDomainError(e, ctx.headers);
    if (mapped) return mapped;
    throw e;
  }
}

async function landlordRequestItem(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;
  const requestId = request.params.id;
  if (!requestId) return jsonResponse(400, ctx.headers, { error: 'missing_id' });

  if (request.method === 'GET') {
    try {
      const result = await getRequest(getPool(), {
        requestId,
        actorUserId: ctx.user.id,
        actorRole: ctx.role,
      });
      return jsonResponse(200, ctx.headers, { request: result.request });
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) return mapped;
      throw e;
    }
  }

  if (request.method !== 'PATCH') {
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
  }
  const b = asRecord(body);
  const statusCode = str(b.status_code);
  const priorityCode = str(b.priority_code);
  const assignedVendorId = b.assigned_vendor_id === null ? null : str(b.assigned_vendor_id);
  const scheduledFor = b.scheduled_for === null ? null : str(b.scheduled_for);
  const scheduledFrom = b.scheduled_from === null ? null : str(b.scheduled_from);
  const scheduledTo = b.scheduled_to === null ? null : str(b.scheduled_to);
  const vendorContactName = b.vendor_contact_name === null ? null : str(b.vendor_contact_name);
  const vendorContactPhone = b.vendor_contact_phone === null ? null : str(b.vendor_contact_phone);
  const internalNotes = b.internal_notes === null ? null : str(b.internal_notes);

  try {
    const result = await updateRequestStatus(getPool(), {
      requestId,
      actorUserId: ctx.user.id,
      actorRole: ctx.role,
      statusCode,
      priorityCode,
      assignedVendorId: b.assigned_vendor_id !== undefined ? (assignedVendorId ?? null) : undefined,
      scheduledFor: b.scheduled_for !== undefined ? (scheduledFor ?? null) : undefined,
      scheduledFrom: b.scheduled_from !== undefined ? (scheduledFrom ?? null) : undefined,
      scheduledTo: b.scheduled_to !== undefined ? (scheduledTo ?? null) : undefined,
      vendorContactName: b.vendor_contact_name !== undefined ? (vendorContactName ?? null) : undefined,
      vendorContactPhone: b.vendor_contact_phone !== undefined ? (vendorContactPhone ?? null) : undefined,
      internalNotes: b.internal_notes !== undefined ? (internalNotes ?? null) : undefined,
    });
    return jsonResponse(200, ctx.headers, { request: result.request });
  } catch (e) {
    const mapped = mapDomainError(e, ctx.headers);
    if (mapped) return mapped;
    logError(context, 'landlord.requests.patch.error', {
      requestId,
      userId: ctx.user.id,
      message: e instanceof Error ? e.message : 'unknown_error',
    });
    throw e;
  }
}

async function landlordRequestAudit(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;
  const requestId = request.params.id;
  if (!requestId) return jsonResponse(400, ctx.headers, { error: 'missing_id' });
  if (request.method !== 'GET') return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });

  try {
    const result = await listRequestAudit(getPool(), {
      requestId,
      actorRole: ctx.role,
    });
    return jsonResponse(200, ctx.headers, { audits: result.audits });
  } catch (e) {
    const mapped = mapDomainError(e, ctx.headers);
    if (mapped) return mapped;
    logError(context, 'landlord.requests.audit.error', {
      requestId,
      userId: ctx.user.id,
      message: e instanceof Error ? e.message : 'unknown_error',
    });
    throw e;
  }
}

async function landlordElsaSettings(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;
  if (request.method === 'GET') {
    const settings = await getElsaSettings(getPool());
    const [categories, priorities, properties, agents, routing] = await Promise.all([
      listCategoryPolicies(getPool()),
      listPriorityPolicies(getPool()),
      listPropertyPolicies(getPool()),
      listAiAgents(getPool()),
      getAiAgentRouting(getPool()),
    ]);
    const requestId = str(request.query.get('request_id'));
    const requestPolicy = requestId
      ? { auto_respond_enabled: await getElsaRequestAutoRespond(getPool(), requestId) }
      : null;
    return jsonResponse(200, ctx.headers, {
      settings,
      categories,
      priorities,
      properties,
      request: requestPolicy,
      agents,
      routing,
    });
  }
  if (request.method !== 'PATCH') {
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
  }
  const b = asRecord(body);
  const updates = {
    elsa_enabled: bool(b.elsa_enabled),
    elsa_auto_send_enabled: bool(b.elsa_auto_send_enabled),
    elsa_auto_send_confidence_threshold:
      b.elsa_auto_send_confidence_threshold !== undefined
        ? Number(b.elsa_auto_send_confidence_threshold)
        : undefined,
    elsa_allowed_categories: listStrings(b.elsa_allowed_categories),
    elsa_allowed_priorities: listStrings(b.elsa_allowed_priorities),
    elsa_blocked_keywords: listStrings(b.elsa_blocked_keywords),
    elsa_emergency_keywords: listStrings(b.elsa_emergency_keywords),
    elsa_max_questions: b.elsa_max_questions !== undefined ? Number(b.elsa_max_questions) : undefined,
    elsa_max_steps: b.elsa_max_steps !== undefined ? Number(b.elsa_max_steps) : undefined,
    elsa_admin_alert_recipients: listStrings(b.elsa_admin_alert_recipients),
    elsa_emergency_template_enabled: bool(b.elsa_emergency_template_enabled),
  };
  const primaryAgentId = str(b.primary_agent_id);
  const fallbackAgentId = b.fallback_agent_id === null ? null : str(b.fallback_agent_id);

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await upsertElsaSettings(client, ctx.user.id, updates);
    if (primaryAgentId) {
      await setAiAgentRouting(client, {
        primaryAgentId,
        fallbackAgentId: fallbackAgentId ?? null,
        actorUserId: ctx.user.id,
      });
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return jsonResponse(200, ctx.headers, { ok: true });
}

async function landlordElsaCategoryPolicy(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;
  if (request.method !== 'PATCH') return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  const categoryCode = str(request.params.categoryCode);
  if (!categoryCode) return jsonResponse(400, ctx.headers, { error: 'missing_category_code' });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
  }
  const b = asRecord(body);
  const enabled = bool(b.auto_send_enabled);
  if (enabled === undefined) return jsonResponse(400, ctx.headers, { error: 'missing_auto_send_enabled' });

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await upsertCategoryPolicy(client, categoryCode, enabled, ctx.user.id);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return jsonResponse(200, ctx.headers, { ok: true });
}

async function landlordElsaPriorityPolicy(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;
  if (request.method !== 'PATCH') return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  const priorityCode = str(request.params.priorityCode);
  if (!priorityCode) return jsonResponse(400, ctx.headers, { error: 'missing_priority_code' });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
  }
  const b = asRecord(body);
  const autoSendEnabled = bool(b.auto_send_enabled);
  const requireAdminReview = bool(b.require_admin_review);
  if (autoSendEnabled === undefined || requireAdminReview === undefined) {
    return jsonResponse(400, ctx.headers, { error: 'missing_policy_fields' });
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await upsertPriorityPolicy(client, priorityCode, autoSendEnabled, requireAdminReview, ctx.user.id);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return jsonResponse(200, ctx.headers, { ok: true });
}

async function landlordElsaPropertyPolicy(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;
  if (request.method !== 'PATCH') return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  const propertyId = str(request.params.propertyId);
  if (!propertyId) return jsonResponse(400, ctx.headers, { error: 'missing_property_id' });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
  }
  const b = asRecord(body);
  const requireReviewAll = bool(b.require_review_all);
  const autoOverride = b.auto_send_enabled_override === null ? null : bool(b.auto_send_enabled_override);
  if (requireReviewAll === undefined || autoOverride === undefined) {
    return jsonResponse(400, ctx.headers, { error: 'missing_policy_fields' });
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await upsertPropertyPolicy(client, propertyId, autoOverride, requireReviewAll, ctx.user.id);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return jsonResponse(200, ctx.headers, { ok: true });
}

async function landlordRequestElsaAutoRespond(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;
  const requestId = request.params.id;
  if (!requestId) return jsonResponse(400, ctx.headers, { error: 'missing_id' });
  if (request.method !== 'PATCH') return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
  }
  const b = asRecord(body);
  const enabled = bool(b.auto_respond_enabled);
  if (enabled === undefined) return jsonResponse(400, ctx.headers, { error: 'missing_auto_respond_enabled' });

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await setElsaRequestAutoRespond(client, requestId, enabled, ctx.user.id);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return jsonResponse(200, ctx.headers, { ok: true, auto_respond_enabled: enabled });
}

async function landlordProcessElsa(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;
  if (request.method !== 'POST') return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  const requestId = request.params.id;
  if (!requestId) return jsonResponse(400, ctx.headers, { error: 'missing_id' });
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const b = asRecord(body);
  const weatherSeverity = str(b.weather_severity) as 'NORMAL' | 'DANGEROUS_HEAT' | 'DANGEROUS_COLD' | undefined;
  const result = await processElsaAutoResponse(getPool(), {
    requestId,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    triggeringEvent: 'MANUAL_REVIEW_ACTION',
    weatherSeverity,
    logger: context,
  });
  return jsonResponse(200, ctx.headers, result);
}

async function landlordRequestElsaDecisions(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;
  if (request.method !== 'GET') return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  const requestId = request.params.id;
  if (!requestId) return jsonResponse(400, ctx.headers, { error: 'missing_id' });
  const result = await listElsaDecisionsForRequest(getPool(), requestId, 25);
  return jsonResponse(200, ctx.headers, { decisions: result });
}

async function landlordRequestElsaDecisionReview(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;
  if (request.method !== 'PATCH') return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  const requestId = request.params.id;
  const decisionId = request.params.decisionId;
  if (!requestId) return jsonResponse(400, ctx.headers, { error: 'missing_id' });
  if (!decisionId) return jsonResponse(400, ctx.headers, { error: 'missing_decision_id' });

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const b = asRecord(body);
  const actionRaw = str(b.action);
  const action = actionRaw ? actionRaw.toUpperCase() : undefined;
  if (!action || !['MARK_RESOLVED', 'SEND_AND_RESOLVE', 'DISMISS'].includes(action)) {
    return jsonResponse(400, ctx.headers, { error: 'invalid_action' });
  }

  try {
    const result = await reviewElsaDecision(getPool(), {
      requestId,
      decisionId,
      actorUserId: ctx.user.id,
      actorRole: ctx.role,
      action: action as 'MARK_RESOLVED' | 'SEND_AND_RESOLVE' | 'DISMISS',
    });
    return jsonResponse(200, ctx.headers, result);
  } catch (e) {
    const mapped = mapDomainError(e, ctx.headers);
    if (mapped) return mapped;
    throw e;
  }
}

async function landlordExportRequestsCsv(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (request.method !== 'GET') {
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }

  try {
    const result = await exportRequestsCsv(getPool(), {
      actorUserId: ctx.user.id,
      actorRole: ctx.role,
    });
    return {
      status: 200,
      headers: {
        ...ctx.headers,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="maintenance-requests.csv"',
      },
      body: result.csvContent,
    };
  } catch (e) {
    const mapped = mapDomainError(e, ctx.headers);
    if (mapped) return mapped;
    logWarn(context, 'landlord.requests.export.audit_failed');
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Azure Function registrations
// ---------------------------------------------------------------------------

app.http('landlordRequestsCollection', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/requests',
  handler: landlordRequestsCollection,
});

app.http('landlordRequestsItem', {
  methods: ['GET', 'PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/requests/{id}',
  handler: landlordRequestItem,
});

app.http('landlordRequestAudit', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/requests/{id}/audit',
  handler: landlordRequestAudit,
});

app.http('landlordElsaSettings', {
  methods: ['GET', 'PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/elsa/settings',
  handler: landlordElsaSettings,
});

app.http('landlordElsaCategoryPolicy', {
  methods: ['PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/elsa/settings/categories/{categoryCode}',
  handler: landlordElsaCategoryPolicy,
});

app.http('landlordElsaPriorityPolicy', {
  methods: ['PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/elsa/settings/priorities/{priorityCode}',
  handler: landlordElsaPriorityPolicy,
});

app.http('landlordElsaPropertyPolicy', {
  methods: ['PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/elsa/settings/properties/{propertyId}',
  handler: landlordElsaPropertyPolicy,
});

app.http('landlordRequestElsaAutoRespond', {
  methods: ['PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/requests/{id}/elsa/auto-respond',
  handler: landlordRequestElsaAutoRespond,
});

app.http('landlordRequestElsaProcess', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/requests/{id}/elsa/process',
  handler: landlordProcessElsa,
});

app.http('landlordRequestElsaDecisions', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/requests/{id}/elsa/decisions',
  handler: landlordRequestElsaDecisions,
});

app.http('landlordRequestElsaDecisionReview', {
  methods: ['PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/requests/{id}/elsa/decisions/{decisionId}',
  handler: landlordRequestElsaDecisionReview,
});

app.http('landlordRequestsCsvExport', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/exports/requests.csv',
  handler: landlordExportRequestsCsv,
});
