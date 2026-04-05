import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { writeAudit } from '../lib/auditRepo.js';
import { requireLandlordOrAdmin, jsonResponse } from '../lib/managementRequest.js';
import { getPool } from '../lib/db.js';
import { getLeaseById, linkLeaseTenant } from '../lib/leasesRepo.js';
import { logError, logInfo, logWarn } from '../lib/serverLogger.js';

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

async function landlordLeaseTenantsPost(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  logInfo(context, 'lease_tenants.link.start', {
    method: request.method,
    leaseId: request.params.leaseId,
  });
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  const leaseId = request.params.leaseId;
  if (!leaseId) {
    logWarn(context, 'lease_tenants.link.missing_lease_id', { userId: ctx.user.id });
    return jsonResponse(400, ctx.headers, { error: 'missing_lease_id' });
  }

  if (request.method !== 'POST') {
    logWarn(context, 'lease_tenants.link.method_not_allowed', {
      userId: ctx.user.id,
      method: request.method,
      leaseId,
    });
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    logWarn(context, 'lease_tenants.link.invalid_json', { userId: ctx.user.id, leaseId });
    return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
  }
  const b = asRecord(body);
  const userId = typeof b.userId === 'string' ? b.userId : undefined;
  if (!userId) {
    logWarn(context, 'lease_tenants.link.missing_user_id', { userId: ctx.user.id, leaseId });
    return jsonResponse(400, ctx.headers, { error: 'missing_user_id' });
  }

  const pool = getPool();
  const lease = await getLeaseById(pool, leaseId);
  if (!lease) {
    logWarn(context, 'lease_tenants.link.lease_not_found', { userId: ctx.user.id, leaseId });
    return jsonResponse(404, ctx.headers, { error: 'lease_not_found' });
  }

  const userCheck = await pool.query(`SELECT id FROM users WHERE id = $1::uuid`, [userId]);
  if (userCheck.rows.length === 0) {
    logWarn(context, 'lease_tenants.link.user_not_found', {
      actorUserId: ctx.user.id,
      leaseId,
      tenantUserId: userId,
    });
    return jsonResponse(400, ctx.headers, { error: 'user_not_found' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const link = await linkLeaseTenant(client, leaseId, userId);
    await writeAudit(client, {
      actorUserId: ctx.user.id,
      entityType: 'LEASE_TENANT',
      entityId: link.id,
      action: 'LINK',
      before: null,
      after: { lease_id: leaseId, user_id: userId, link_id: link.id },
    });
    await client.query('COMMIT');
    logInfo(context, 'lease_tenants.link.success', {
      actorUserId: ctx.user.id,
      leaseId,
      tenantUserId: userId,
      linkId: link.id,
    });
    return jsonResponse(200, ctx.headers, { lease_tenant: link });
  } catch (e) {
    await client.query('ROLLBACK');
    logError(context, 'lease_tenants.link.error', {
      actorUserId: ctx.user.id,
      leaseId,
      tenantUserId: userId,
      message: e instanceof Error ? e.message : 'unknown_error',
    });
    throw e;
  } finally {
    client.release();
  }
}

app.http('landlordLeaseTenantsPost', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/leases/{leaseId}/tenants',
  handler: landlordLeaseTenantsPost,
});

