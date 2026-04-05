import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { getPool } from '../lib/db.js';
import { jsonResponse, requireLandlordOrAdmin } from '../lib/managementRequest.js';
import {
  findStatusIdByCode,
  getRequestById,
  insertRequestStatusHistory,
  listRequestsForManagement,
  updateRequestManagementFields,
} from '../lib/requestsRepo.js';
import { enqueueNotification } from '../lib/notificationRepo.js';
import { writeAudit } from '../lib/auditRepo.js';
import { logError, logWarn } from '../lib/serverLogger.js';

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v.trim() : undefined;
}

function csvEscape(v: unknown): string {
  const raw = v === null || v === undefined ? '' : String(v);
  return `"${raw.replace(/"/g, '""')}"`;
}

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
  const pool = getPool();
  const rows = await listRequestsForManagement(pool);
  return jsonResponse(200, ctx.headers, { requests: rows });
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
  const pool = getPool();

  if (request.method === 'GET') {
    const row = await getRequestById(pool, requestId);
    if (!row) return jsonResponse(404, ctx.headers, { error: 'not_found' });
    return jsonResponse(200, ctx.headers, { request: row });
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

  const current = await getRequestById(pool, requestId);
  if (!current) return jsonResponse(404, ctx.headers, { error: 'not_found' });

  let newStatusId: string | undefined;
  if (statusCode) {
    const statusId = await findStatusIdByCode(pool, statusCode);
    if (!statusId) return jsonResponse(400, ctx.headers, { error: 'invalid_status_code' });
    newStatusId = statusId;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await updateRequestManagementFields(client, requestId, {
      currentStatusId: newStatusId,
      assignedVendorId:
        b.assigned_vendor_id !== undefined ? assignedVendorId ?? null : undefined,
      internalNotes: b.internal_notes !== undefined ? internalNotes ?? null : undefined,
    });
    if (!updated) {
      await client.query('ROLLBACK');
      return jsonResponse(404, ctx.headers, { error: 'not_found' });
    }

    if (newStatusId && newStatusId !== current.current_status_id) {
      await insertRequestStatusHistory(client, {
        requestId,
        fromStatusId: current.current_status_id,
        toStatusId: newStatusId,
        changedByUserId: ctx.user.id,
        note: null,
      });
    }
    await writeAudit(client, {
      actorUserId: ctx.user.id,
      entityType: 'MAINTENANCE_REQUEST',
      entityId: requestId,
      action: 'UPDATE',
      before: current,
      after: updated,
    });
    await enqueueNotification(client, {
      eventTypeCode: 'REQUEST_UPDATED',
      payload: {
        request_id: requestId,
        status_changed: Boolean(newStatusId && newStatusId !== current.current_status_id),
        assigned_vendor_id: updated.assigned_vendor_id,
      },
      idempotencyKey: `request-updated:${requestId}:${updated.updated_at.toISOString()}`,
    });
    await client.query('COMMIT');
    return jsonResponse(200, ctx.headers, { request: updated });
  } catch (error) {
    await client.query('ROLLBACK');
    logError(context, 'landlord.requests.patch.error', {
      requestId,
      userId: ctx.user.id,
      message: error instanceof Error ? error.message : 'unknown_error',
    });
    throw error;
  } finally {
    client.release();
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
  const pool = getPool();
  const req = await getRequestById(pool, requestId);
  if (!req) return jsonResponse(404, ctx.headers, { error: 'not_found' });

  const start = Date.now();
  const suggestion = `Thanks for reporting this. We have logged your request "${req.title}" and will follow up with scheduling details shortly.`;
  const latencyMs = Date.now() - start;
  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-backend-adapter';
  const promptTemplateVersion = 'v1-maintenance-reply';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO ai_suggestion_log (
         id, request_id, actor_user_id, model, prompt_template_version, latency_ms,
         input_token_count, output_token_count
       )
       VALUES (NEWID(), $1, $2, $3, $4, $5, $6, $7)`,
      [requestId, ctx.user.id, model, promptTemplateVersion, latencyMs, null, null]
    );
    await writeAudit(client, {
      actorUserId: ctx.user.id,
      entityType: 'AI_SUGGESTION',
      entityId: requestId,
      action: 'GENERATE',
      before: null,
      after: { model, promptTemplateVersion, latencyMs },
    });
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return jsonResponse(200, ctx.headers, {
    suggestion,
    metadata: {
      request_id: requestId,
      model,
      prompt_template_version: promptTemplateVersion,
      latency_ms: latencyMs,
    },
  });
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
  const pool = getPool();
  const rows = await listRequestsForManagement(pool);
  const header = [
    'id',
    'property_id',
    'lease_id',
    'submitted_by_user_id',
    'assigned_vendor_id',
    'title',
    'current_status_id',
    'created_at',
    'updated_at',
  ];
  const lines = [header.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.id,
        row.property_id,
        row.lease_id,
        row.submitted_by_user_id,
        row.assigned_vendor_id ?? '',
        row.title,
        row.current_status_id,
        row.created_at.toISOString(),
        row.updated_at.toISOString(),
      ]
        .map(csvEscape)
        .join(',')
    );
  }

  const auditClient = await pool.connect();
  try {
    await auditClient.query('BEGIN');
    await writeAudit(auditClient, {
      actorUserId: ctx.user.id,
      entityType: 'REQUEST_EXPORT',
      entityId: '00000000-0000-0000-0000-000000000000',
      action: 'CSV_EXPORT',
      before: null,
      after: { count: rows.length },
    });
    await auditClient.query('COMMIT');
  } catch {
    await auditClient.query('ROLLBACK');
    logWarn(context, 'landlord.requests.export.audit_failed');
  } finally {
    auditClient.release();
  }

  return {
    status: 200,
    headers: {
      ...ctx.headers,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="maintenance-requests.csv"',
    },
    body: lines.join('\n'),
  };
}

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

