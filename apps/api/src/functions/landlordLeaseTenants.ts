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

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

async function landlordLeaseTenantsPost(
  request: HttpRequest,
  _context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireLandlordOrAdmin(request);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  const leaseId = request.params.leaseId;
  if (!leaseId) {
    return jsonResponse(400, ctx.headers, { error: 'missing_lease_id' });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
  }
  const b = asRecord(body);
  const userId = typeof b.userId === 'string' ? b.userId : undefined;
  if (!userId) {
    return jsonResponse(400, ctx.headers, { error: 'missing_user_id' });
  }

  const pool = getPool();
  const lease = await getLeaseById(pool, leaseId);
  if (!lease) {
    return jsonResponse(404, ctx.headers, { error: 'lease_not_found' });
  }

  const userCheck = await pool.query(`SELECT id FROM users WHERE id = $1::uuid`, [userId]);
  if (userCheck.rows.length === 0) {
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
    return jsonResponse(200, ctx.headers, { lease_tenant: link });
  } catch (e) {
    await client.query('ROLLBACK');
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

