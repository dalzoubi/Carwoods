import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { getPool } from '../lib/db.js';
import { writeAudit } from '../lib/auditRepo.js';
import { requireAdmin, jsonResponse } from '../lib/managementRequest.js';
import {
  listLandlords,
  setLandlordActiveStatus,
  upsertLandlordUserByEmail,
} from '../lib/usersRepo.js';
import { logError, logInfo, logWarn } from '../lib/serverLogger.js';
import { validateLandlordInvite } from '../domain/userValidation.js';

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function asOptionalString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function adminLandlordsCollectionHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;
  const pool = getPool();
  logInfo(context, 'admin.landlords.collection.start', {
    actorUserId: ctx.user.id,
    method: request.method,
  });

  if (request.method === 'GET') {
    const includeInactive = request.query.get('include_inactive') === 'true';
    const landlords = await listLandlords(pool, { includeInactive });
    logInfo(context, 'admin.landlords.collection.list.success', {
      actorUserId: ctx.user.id,
      includeInactive,
      count: landlords.length,
    });
    return jsonResponse(200, ctx.headers, {
      landlords,
    });
  }

  if (request.method !== 'POST') {
    logWarn(context, 'admin.landlords.collection.method_not_allowed', {
      actorUserId: ctx.user.id,
      method: request.method,
    });
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    logWarn(context, 'admin.landlords.invalid_json', { actorUserId: ctx.user.id });
    return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
  }

  const b = asRecord(body);
  const email = asOptionalString(b.email)?.toLowerCase() ?? '';
  const firstName = asOptionalString(b.first_name);
  const lastName = asOptionalString(b.last_name);
  const inviteValidation = validateLandlordInvite({ email, firstName, lastName });
  if (!inviteValidation.valid) {
    logWarn(context, 'admin.landlords.create.validation_failed', {
      actorUserId: ctx.user.id,
      reason: inviteValidation.message,
    });
    return jsonResponse(400, ctx.headers, { error: inviteValidation.message });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const landlord = await upsertLandlordUserByEmail(client, {
      email,
      firstName,
      lastName,
    });

    await writeAudit(client, {
      actorUserId: ctx.user.id,
      entityType: 'LANDLORD',
      entityId: landlord.user.id,
      action: landlord.created ? 'CREATE' : 'UPDATE',
      before: null,
      after: landlord.user,
    });
    await client.query('COMMIT');

    logInfo(context, 'admin.landlords.upsert.success', {
      actorUserId: ctx.user.id,
      landlordUserId: landlord.user.id,
      created: landlord.created,
    });
    return jsonResponse(201, ctx.headers, {
      landlord: landlord.user,
      landlord_created: landlord.created,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    const message = error instanceof Error ? error.message : 'unknown_error';
    if (message === 'email_belongs_to_admin') {
      logWarn(context, 'admin.landlords.upsert.conflict', {
        actorUserId: ctx.user.id,
        reason: 'email_belongs_to_admin',
      });
      return jsonResponse(409, ctx.headers, { error: 'email_belongs_to_admin' });
    }
    if (message === 'email_already_used_by_non_landlord') {
      logWarn(context, 'admin.landlords.upsert.conflict', {
        actorUserId: ctx.user.id,
        reason: 'email_already_used_by_non_landlord',
      });
      return jsonResponse(409, ctx.headers, { error: 'email_already_used' });
    }
    logError(context, 'admin.landlords.upsert.error', {
      actorUserId: ctx.user.id,
      message,
    });
    throw error;
  } finally {
    client.release();
  }
}

async function adminLandlordsItemHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;
  const landlordId = request.params.id;
  logInfo(context, 'admin.landlords.item.start', {
    actorUserId: ctx.user.id,
    method: request.method,
    landlordId,
  });
  if (!landlordId) {
    logWarn(context, 'admin.landlords.item.missing_id', { actorUserId: ctx.user.id });
    return jsonResponse(400, ctx.headers, { error: 'missing_id' });
  }
  if (request.method !== 'PATCH') {
    logWarn(context, 'admin.landlords.item.method_not_allowed', {
      actorUserId: ctx.user.id,
      method: request.method,
      landlordId,
    });
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    logWarn(context, 'admin.landlords.item.invalid_json', { actorUserId: ctx.user.id, landlordId });
    return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
  }

  const b = asRecord(body);
  if (typeof b.active !== 'boolean') {
    logWarn(context, 'admin.landlords.item.validation_failed', {
      actorUserId: ctx.user.id,
      landlordId,
      reason: 'missing_active',
    });
    return jsonResponse(400, ctx.headers, { error: 'missing_active' });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await setLandlordActiveStatus(client, landlordId, b.active);
    if (!updated) {
      await client.query('ROLLBACK');
      logWarn(context, 'admin.landlords.item.not_found', {
        actorUserId: ctx.user.id,
        landlordId,
      });
      return jsonResponse(404, ctx.headers, { error: 'not_found' });
    }
    await writeAudit(client, {
      actorUserId: ctx.user.id,
      entityType: 'LANDLORD',
      entityId: landlordId,
      action: b.active ? 'REACTIVATE' : 'DEACTIVATE',
      before: null,
      after: updated,
    });
    await client.query('COMMIT');
    logInfo(context, 'admin.landlords.item.success', {
      actorUserId: ctx.user.id,
      landlordId,
      active: b.active,
    });
    return jsonResponse(200, ctx.headers, { landlord: updated });
  } catch (error) {
    await client.query('ROLLBACK');
    logError(context, 'admin.landlords.item.error', {
      actorUserId: ctx.user.id,
      landlordId,
      message: error instanceof Error ? error.message : 'unknown_error',
    });
    throw error;
  } finally {
    client.release();
  }
}

app.http('adminLandlordsCollection', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/admin/landlords',
  handler: adminLandlordsCollectionHandler,
});

app.http('adminLandlordsItem', {
  methods: ['PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/admin/landlords/{id}',
  handler: adminLandlordsItemHandler,
});
