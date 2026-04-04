import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { writeAudit } from '../lib/auditRepo.js';
import { requireLandlordOrAdmin, jsonResponse } from '../lib/managementRequest.js';
import { getPool } from '../lib/db.js';
import {
  getPropertyById,
  insertProperty,
  listPropertiesLandlord,
  softDeleteProperty,
  updateProperty,
} from '../lib/propertiesRepo.js';
import { harColumnsForCreate, harColumnsForPatch } from '../lib/propertyHarSync.js';

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
  _context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireLandlordOrAdmin(request);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;
  const pool = getPool();

  if (request.method === 'GET') {
    const rows = await listPropertiesLandlord(pool);
    return jsonResponse(200, ctx.headers, { properties: rows });
  }

  if (request.method === 'POST') {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
    }
    const b = asRecord(body);
    const street = str(b.street);
    const city = str(b.city);
    const state = str(b.state);
    const zip = str(b.zip);
    if (!street || !city || !state || !zip) {
      return jsonResponse(400, ctx.headers, { error: 'missing_required_fields' });
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
        return jsonResponse(422, ctx.headers, { error: 'har_sync_failed', message });
      }

      await client.query('BEGIN');
      const row = await insertProperty(client, {
        name: str(b.name) ?? null,
        street,
        city,
        state,
        zip,
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
      return jsonResponse(201, ctx.headers, { property: row });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
}

async function landlordPropertiesItem(
  request: HttpRequest,
  _context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireLandlordOrAdmin(request);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;
  const id = request.params.id;
  if (!id) {
    return jsonResponse(400, ctx.headers, { error: 'missing_id' });
  }
  const pool = getPool();

  if (request.method === 'GET') {
    const row = await getPropertyById(pool, id);
    if (!row) return jsonResponse(404, ctx.headers, { error: 'not_found' });
    return jsonResponse(200, ctx.headers, { property: row });
  }

  if (request.method === 'PATCH') {
    const current = await getPropertyById(pool, id);
    if (!current) return jsonResponse(404, ctx.headers, { error: 'not_found' });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
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
      return jsonResponse(200, ctx.headers, { property: row });
    } catch (e) {
      await client.query('ROLLBACK');
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
        return jsonResponse(404, ctx.headers, { error: 'not_found' });
      }
      const ok = await softDeleteProperty(client, id, ctx.user.id);
      if (!ok) {
        await client.query('ROLLBACK');
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
      return jsonResponse(204, ctx.headers, null);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

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

