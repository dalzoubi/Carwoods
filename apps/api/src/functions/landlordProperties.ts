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
  getPropertyById,
  insertProperty,
  listPropertiesLandlord,
  softDeleteProperty,
  updateProperty,
} from '../lib/propertiesRepo.js';
import { harColumnsForCreate, harColumnsForPatch } from '../lib/propertyHarSync.js';
import { validateCreateProperty } from '../domain/propertyValidation.js';

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

async function landlordPropertiesCollection(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  logInfo(context, 'properties.collection.start', { method: request.method });
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;
  const pool = getPool();

  if (request.method === 'GET') {
    const rows = await listPropertiesLandlord(pool);
    logInfo(context, 'properties.collection.list.success', {
      userId: ctx.user.id,
      count: rows.length,
    });
    return jsonResponse(200, ctx.headers, { properties: rows });
  }

  if (request.method === 'POST') {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      logWarn(context, 'properties.collection.create.invalid_json', { userId: ctx.user.id });
      return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
    }
    const b = asRecord(body);
    const street = str(b.street);
    const city = str(b.city);
    const state = str(b.state);
    const zip = str(b.zip);
    const propertyValidation = validateCreateProperty({ street, city, state, zip });
    if (!propertyValidation.valid) {
      logWarn(context, 'properties.collection.create.validation_failed', { userId: ctx.user.id });
      return jsonResponse(400, ctx.headers, { error: propertyValidation.message });
    }

    const client = await pool.connect();
    try {
      let har;
      try {
        har = await harColumnsForCreate({
          har_listing_id: b.har_listing_id as string | null | undefined,
          metadata: b.metadata,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'har_sync_failed';
        logWarn(context, 'properties.collection.create.har_sync_failed', {
          userId: ctx.user.id,
          message,
        });
        return jsonResponse(422, ctx.headers, { error: 'har_sync_failed', message });
      }

      await client.query('BEGIN');
      const row = await insertProperty(client, {
        name: str(b.name) ?? null,
        street: street!,
        city: city!,
        state: state!,
        zip: zip!,
        har_listing_id: har.har_listing_id,
        listing_source: har.listing_source,
        apply_visible: bool(b.apply_visible) ?? false,
        metadata: har.metadata,
        har_sync_status: har.har_sync_status,
        har_sync_error: har.har_sync_error,
        har_last_synced_at: har.har_last_synced_at,
        created_by: ctx.user.id,
      });
      await writeAudit(client, {
        actorUserId: ctx.user.id,
        entityType: 'PROPERTY',
        entityId: row.id,
        action: 'CREATE',
        before: null,
        after: row,
      });
      await client.query('COMMIT');
      logInfo(context, 'properties.collection.create.success', {
        userId: ctx.user.id,
        propertyId: row.id,
      });
      return jsonResponse(201, ctx.headers, { property: row });
    } catch (e) {
      await client.query('ROLLBACK');
      logError(context, 'properties.collection.create.error', {
        userId: ctx.user.id,
        message: e instanceof Error ? e.message : 'unknown_error',
      });
      throw e;
    } finally {
      client.release();
    }
  }

  logWarn(context, 'properties.collection.method_not_allowed', { method: request.method });
  return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
}

async function landlordPropertiesItem(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  logInfo(context, 'properties.item.start', { method: request.method, propertyId: request.params.id });
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;
  const id = request.params.id;
  if (!id) {
    logWarn(context, 'properties.item.missing_id', { userId: ctx.user.id });
    return jsonResponse(400, ctx.headers, { error: 'missing_id' });
  }
  const pool = getPool();

  if (request.method === 'GET') {
    const row = await getPropertyById(pool, id);
    if (!row) {
      logWarn(context, 'properties.item.get.not_found', { userId: ctx.user.id, propertyId: id });
      return jsonResponse(404, ctx.headers, { error: 'not_found' });
    }
    logInfo(context, 'properties.item.get.success', { userId: ctx.user.id, propertyId: id });
    return jsonResponse(200, ctx.headers, { property: row });
  }

  if (request.method === 'PATCH') {
    const current = await getPropertyById(pool, id);
    if (!current) {
      logWarn(context, 'properties.item.patch.not_found', { userId: ctx.user.id, propertyId: id });
      return jsonResponse(404, ctx.headers, { error: 'not_found' });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      logWarn(context, 'properties.item.patch.invalid_json', { userId: ctx.user.id, propertyId: id });
      return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
    }
    const b = asRecord(body);

    let har;
    try {
      har = await harColumnsForPatch(
        {
          har_listing_id: current.har_listing_id,
          listing_source: current.listing_source,
          metadata: current.metadata,
          har_sync_status: current.har_sync_status,
          har_sync_error: current.har_sync_error,
          har_last_synced_at: current.har_last_synced_at,
        },
        {
          har_listing_id: b.har_listing_id as string | null | undefined,
          metadata: b.metadata,
        }
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : 'har_sync_failed';
      logWarn(context, 'properties.item.patch.har_sync_failed', {
        userId: ctx.user.id,
        propertyId: id,
        message,
      });
      return jsonResponse(422, ctx.headers, { error: 'har_sync_failed', message });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const before = await getPropertyById(client, id);
      const row = await updateProperty(
        client,
        id,
        {
          name: b.name !== undefined ? (str(b.name) ?? null) : undefined,
          street: str(b.street),
          city: str(b.city),
          state: str(b.state),
          zip: str(b.zip),
          har_listing_id: har.har_listing_id,
          listing_source: har.listing_source,
          apply_visible: bool(b.apply_visible),
          metadata: har.metadata,
          har_sync_status: har.har_sync_status,
          har_sync_error: har.har_sync_error,
          har_last_synced_at: har.har_last_synced_at,
        },
        ctx.user.id
      );
      if (!row) {
        await client.query('ROLLBACK');
        logWarn(context, 'properties.item.patch.not_found_after_begin', {
          userId: ctx.user.id,
          propertyId: id,
        });
        return jsonResponse(404, ctx.headers, { error: 'not_found' });
      }
      await writeAudit(client, {
        actorUserId: ctx.user.id,
        entityType: 'PROPERTY',
        entityId: row.id,
        action: 'UPDATE',
        before: before ?? null,
        after: row,
      });
      await client.query('COMMIT');
      logInfo(context, 'properties.item.patch.success', { userId: ctx.user.id, propertyId: id });
      return jsonResponse(200, ctx.headers, { property: row });
    } catch (e) {
      await client.query('ROLLBACK');
      logError(context, 'properties.item.patch.error', {
        userId: ctx.user.id,
        propertyId: id,
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
      const before = await getPropertyById(client, id);
      if (!before) {
        await client.query('ROLLBACK');
        logWarn(context, 'properties.item.delete.not_found', { userId: ctx.user.id, propertyId: id });
        return jsonResponse(404, ctx.headers, { error: 'not_found' });
      }
      const ok = await softDeleteProperty(client, id, ctx.user.id);
      if (!ok) {
        await client.query('ROLLBACK');
        logWarn(context, 'properties.item.delete.not_found_after_soft_delete', {
          userId: ctx.user.id,
          propertyId: id,
        });
        return jsonResponse(404, ctx.headers, { error: 'not_found' });
      }
      await writeAudit(client, {
        actorUserId: ctx.user.id,
        entityType: 'PROPERTY',
        entityId: id,
        action: 'DELETE',
        before,
        after: { deleted: true },
      });
      await client.query('COMMIT');
      logInfo(context, 'properties.item.delete.success', { userId: ctx.user.id, propertyId: id });
      return jsonResponse(204, ctx.headers, null);
    } catch (e) {
      await client.query('ROLLBACK');
      logError(context, 'properties.item.delete.error', {
        userId: ctx.user.id,
        propertyId: id,
        message: e instanceof Error ? e.message : 'unknown_error',
      });
      throw e;
    } finally {
      client.release();
    }
  }

  logWarn(context, 'properties.item.method_not_allowed', {
    method: request.method,
    userId: ctx.user.id,
    propertyId: id,
  });
  return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
}

app.http('landlordPropertiesCollection', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/properties',
  handler: landlordPropertiesCollection,
});

app.http('landlordPropertiesItem', {
  methods: ['GET', 'PATCH', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/properties/{id}',
  handler: landlordPropertiesItem,
});

