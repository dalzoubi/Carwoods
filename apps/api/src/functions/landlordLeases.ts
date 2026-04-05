import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { writeAudit } from '../lib/auditRepo.js';
import { requireLandlordOrAdmin, jsonResponse } from '../lib/managementRequest.js';
import { getPool } from '../lib/db.js';
import { logError, logInfo, logWarn } from '../lib/serverLogger.js';
import {
  getLeaseById,
  insertLease,
  listLeasesLandlord,
  listLeasesForProperty,
  softDeleteLease,
  updateLease,
} from '../lib/leasesRepo.js';
import { getPropertyById } from '../lib/propertiesRepo.js';

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function bool(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined;
}

const LEASE_STATUSES = new Set(['ACTIVE', 'ENDED', 'UPCOMING', 'TERMINATED']);

async function landlordLeasesCollection(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  logInfo(context, 'leases.collection.start', { method: request.method });
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;
  const pool = getPool();

  if (request.method === 'GET') {
    const propertyId = request.query.get('property_id')?.trim();
    const rows = propertyId
      ? await listLeasesForProperty(pool, propertyId)
      : await listLeasesLandlord(pool);
    logInfo(context, 'leases.collection.list.success', {
      userId: ctx.user.id,
      propertyId: propertyId ?? null,
      count: rows.length,
    });
    return jsonResponse(200, ctx.headers, { leases: rows });
  }

  if (request.method === 'POST') {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      logWarn(context, 'leases.collection.create.invalid_json', { userId: ctx.user.id });
      return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
    }
    const b = asRecord(body);
    const property_id = str(b.property_id);
    const start_date = str(b.start_date);
    const status = str(b.status);
    if (!property_id || !start_date || !status || !LEASE_STATUSES.has(status)) {
      logWarn(context, 'leases.collection.create.validation_failed', { userId: ctx.user.id });
      return jsonResponse(400, ctx.headers, { error: 'missing_or_invalid_fields' });
    }

    const prop = await getPropertyById(pool, property_id);
    if (!prop) {
      logWarn(context, 'leases.collection.create.property_not_found', {
        userId: ctx.user.id,
        propertyId: property_id,
      });
      return jsonResponse(400, ctx.headers, { error: 'property_not_found' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const row = await insertLease(client, {
        property_id,
        start_date,
        end_date: str(b.end_date) ?? null,
        month_to_month: bool(b.month_to_month) ?? false,
        status,
        notes: str(b.notes) ?? null,
        created_by: ctx.user.id,
      });
      await writeAudit(client, {
        actorUserId: ctx.user.id,
        entityType: 'LEASE',
        entityId: row.id,
        action: 'CREATE',
        before: null,
        after: row,
      });
      await client.query('COMMIT');
      logInfo(context, 'leases.collection.create.success', { userId: ctx.user.id, leaseId: row.id });
      return jsonResponse(201, ctx.headers, { lease: row });
    } catch (e) {
      await client.query('ROLLBACK');
      logError(context, 'leases.collection.create.error', {
        userId: ctx.user.id,
        message: e instanceof Error ? e.message : 'unknown_error',
      });
      throw e;
    } finally {
      client.release();
    }
  }

  logWarn(context, 'leases.collection.method_not_allowed', { method: request.method });
  return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
}

async function landlordLeasesItem(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  logInfo(context, 'leases.item.start', { method: request.method, leaseId: request.params.id });
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;
  const id = request.params.id;
  if (!id) {
    logWarn(context, 'leases.item.missing_id', { userId: ctx.user.id });
    return jsonResponse(400, ctx.headers, { error: 'missing_id' });
  }
  const pool = getPool();

  if (request.method === 'GET') {
    const row = await getLeaseById(pool, id);
    if (!row) {
      logWarn(context, 'leases.item.get.not_found', { userId: ctx.user.id, leaseId: id });
      return jsonResponse(404, ctx.headers, { error: 'not_found' });
    }
    logInfo(context, 'leases.item.get.success', { userId: ctx.user.id, leaseId: id });
    return jsonResponse(200, ctx.headers, { lease: row });
  }

  if (request.method === 'PATCH') {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      logWarn(context, 'leases.item.patch.invalid_json', { userId: ctx.user.id, leaseId: id });
      return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
    }
    const b = asRecord(body);
    const status = str(b.status);
    if (status && !LEASE_STATUSES.has(status)) {
      logWarn(context, 'leases.item.patch.invalid_status', {
        userId: ctx.user.id,
        leaseId: id,
        status,
      });
      return jsonResponse(400, ctx.headers, { error: 'invalid_status' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const before = await getLeaseById(client, id);
      const row = await updateLease(
        client,
        id,
        {
          start_date: str(b.start_date),
          end_date: b.end_date !== undefined ? str(b.end_date) ?? null : undefined,
          month_to_month: bool(b.month_to_month),
          status,
          notes: b.notes !== undefined ? str(b.notes) ?? null : undefined,
        },
        ctx.user.id
      );
      if (!row) {
        await client.query('ROLLBACK');
        logWarn(context, 'leases.item.patch.not_found', { userId: ctx.user.id, leaseId: id });
        return jsonResponse(404, ctx.headers, { error: 'not_found' });
      }
      await writeAudit(client, {
        actorUserId: ctx.user.id,
        entityType: 'LEASE',
        entityId: row.id,
        action: 'UPDATE',
        before: before ?? null,
        after: row,
      });
      await client.query('COMMIT');
      logInfo(context, 'leases.item.patch.success', { userId: ctx.user.id, leaseId: id });
      return jsonResponse(200, ctx.headers, { lease: row });
    } catch (e) {
      await client.query('ROLLBACK');
      logError(context, 'leases.item.patch.error', {
        userId: ctx.user.id,
        leaseId: id,
        message: e instanceof Error ? e.message : 'unknown_error',
      });
      throw e;
    } finally {
      client.release();
    }
  }

  if (request.method === 'DELETE') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const before = await getLeaseById(client, id);
      if (!before) {
        await client.query('ROLLBACK');
        logWarn(context, 'leases.item.delete.not_found', { userId: ctx.user.id, leaseId: id });
        return jsonResponse(404, ctx.headers, { error: 'not_found' });
      }
      const ok = await softDeleteLease(client, id, ctx.user.id);
      if (!ok) {
        await client.query('ROLLBACK');
        logWarn(context, 'leases.item.delete.not_found_after_soft_delete', {
          userId: ctx.user.id,
          leaseId: id,
        });
        return jsonResponse(404, ctx.headers, { error: 'not_found' });
      }
      await writeAudit(client, {
        actorUserId: ctx.user.id,
        entityType: 'LEASE',
        entityId: id,
        action: 'DELETE',
        before,
        after: { deleted: true },
      });
      await client.query('COMMIT');
      logInfo(context, 'leases.item.delete.success', { userId: ctx.user.id, leaseId: id });
      return jsonResponse(204, ctx.headers, null);
    } catch (e) {
      await client.query('ROLLBACK');
      logError(context, 'leases.item.delete.error', {
        userId: ctx.user.id,
        leaseId: id,
        message: e instanceof Error ? e.message : 'unknown_error',
      });
      throw e;
    } finally {
      client.release();
    }
  }

  logWarn(context, 'leases.item.method_not_allowed', {
    method: request.method,
    userId: ctx.user.id,
    leaseId: id,
  });
  return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
}

app.http('landlordLeasesCollection', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/leases',
  handler: landlordLeasesCollection,
});

app.http('landlordLeasesItem', {
  methods: ['GET', 'PATCH', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/leases/{id}',
  handler: landlordLeasesItem,
});

