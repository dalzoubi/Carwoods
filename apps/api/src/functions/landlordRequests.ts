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
import { suggestRequestReply } from '../useCases/requests/suggestRequestReply.js';
import { exportRequestsCsv } from '../useCases/requests/exportRequestsCsv.js';

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
  const assignedVendorId = b.assigned_vendor_id === null ? null : str(b.assigned_vendor_id);
  const internalNotes = b.internal_notes === null ? null : str(b.internal_notes);

  try {
    const result = await updateRequestStatus(getPool(), {
      requestId,
      actorUserId: ctx.user.id,
      actorRole: ctx.role,
      statusCode,
      assignedVendorId: b.assigned_vendor_id !== undefined ? (assignedVendorId ?? null) : undefined,
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

async function landlordSuggestReply(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (request.method !== 'POST') {
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }

  const requestId = request.params.id;
  if (!requestId) return jsonResponse(400, ctx.headers, { error: 'missing_id' });

  try {
    const result = await suggestRequestReply(getPool(), {
      requestId,
      actorUserId: ctx.user.id,
      actorRole: ctx.role,
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

app.http('landlordRequestsSuggestReply', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/requests/{id}/suggest-reply',
  handler: landlordSuggestReply,
});

app.http('landlordRequestsCsvExport', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/exports/requests.csv',
  handler: landlordExportRequestsCsv,
});
