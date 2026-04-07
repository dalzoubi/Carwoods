import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { requireLandlordOrAdmin, jsonResponse, mapDomainError } from '../lib/managementRequest.js';
import { getPool } from '../lib/db.js';
import { withRateLimit } from '../lib/rateLimiter.js';
import { logError, logInfo, logWarn } from '../lib/serverLogger.js';

import { listProperties } from '../useCases/properties/listProperties.js';
import { getProperty } from '../useCases/properties/getProperty.js';
import { createProperty } from '../useCases/properties/createProperty.js';
import { updateProperty } from '../useCases/properties/updateProperty.js';
import { deleteProperty } from '../useCases/properties/deleteProperty.js';

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function landlordPropertiesCollection(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  logInfo(context, 'properties.collection.start', { method: request.method });
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (request.method === 'GET') {
    try {
      const result = await listProperties(getPool(), {
        actorUserId: ctx.user.id,
        actorRole: ctx.role,
      });
      logInfo(context, 'properties.collection.list.success', {
        userId: ctx.user.id,
        count: result.properties.length,
      });
      return jsonResponse(200, ctx.headers, { properties: result.properties });
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) return mapped;
      throw e;
    }
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

    try {
      const result = await createProperty(getPool(), {
        actorUserId: ctx.user.id,
        actorRole: ctx.role,
        name: b.name !== undefined ? (str(b.name) ?? null) : null,
        street: str(b.street),
        city: str(b.city),
        state: str(b.state),
        zip: str(b.zip),
        apply_visible: bool(b.apply_visible),
        har_listing_id: b.har_listing_id as string | null | undefined,
        landlord_user_id: str(b.landlord_user_id) ?? undefined,
        metadata: b.metadata,
      });
      logInfo(context, 'properties.collection.create.success', {
        userId: ctx.user.id,
        propertyId: result.property.id,
      });
      return jsonResponse(201, ctx.headers, { property: result.property });
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) {
        if ((e as { code?: string }).code === 'UNPROCESSABLE') {
          logWarn(context, 'properties.collection.create.har_sync_failed', {
            userId: ctx.user.id,
            message: e instanceof Error ? e.message : 'har_sync_failed',
          });
        } else {
          logWarn(context, 'properties.collection.create.validation_failed', { userId: ctx.user.id });
        }
        return mapped;
      }
      logError(context, 'properties.collection.create.error', {
        userId: ctx.user.id,
        message: e instanceof Error ? e.message : 'unknown_error',
      });
      throw e;
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

  if (request.method === 'GET') {
    try {
      const result = await getProperty(getPool(), {
        propertyId: id,
        actorUserId: ctx.user.id,
        actorRole: ctx.role,
      });
      logInfo(context, 'properties.item.get.success', { userId: ctx.user.id, propertyId: id });
      return jsonResponse(200, ctx.headers, { property: result.property });
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) {
        logWarn(context, 'properties.item.get.not_found', { userId: ctx.user.id, propertyId: id });
        return mapped;
      }
      throw e;
    }
  }

  if (request.method === 'PATCH') {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      logWarn(context, 'properties.item.patch.invalid_json', { userId: ctx.user.id, propertyId: id });
      return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
    }
    const b = asRecord(body);

    try {
      const result = await updateProperty(getPool(), {
        propertyId: id,
        actorUserId: ctx.user.id,
        actorRole: ctx.role,
        name: str(b.name),
        name_present: b.name !== undefined,
        street: str(b.street),
        city: str(b.city),
        state: str(b.state),
        zip: str(b.zip),
        apply_visible: bool(b.apply_visible),
        har_listing_id: b.har_listing_id as string | null | undefined,
        har_listing_id_present: b.har_listing_id !== undefined,
        landlord_user_id: str(b.landlord_user_id),
        landlord_user_id_present: b.landlord_user_id !== undefined,
        metadata: b.metadata,
        metadata_present: b.metadata !== undefined,
      });
      logInfo(context, 'properties.item.patch.success', { userId: ctx.user.id, propertyId: id });
      return jsonResponse(200, ctx.headers, { property: result.property });
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) {
        if ((e as { code?: string }).code === 'UNPROCESSABLE') {
          logWarn(context, 'properties.item.patch.har_sync_failed', {
            userId: ctx.user.id,
            propertyId: id,
            message: e instanceof Error ? e.message : 'har_sync_failed',
          });
        } else {
          logWarn(context, 'properties.item.patch.not_found', { userId: ctx.user.id, propertyId: id });
        }
        return mapped;
      }
      logError(context, 'properties.item.patch.error', {
        userId: ctx.user.id,
        propertyId: id,
        message: e instanceof Error ? e.message : 'unknown_error',
      });
      throw e;
    }
  }

  if (request.method === 'DELETE') {
    try {
      await deleteProperty(getPool(), {
        propertyId: id,
        actorUserId: ctx.user.id,
        actorRole: ctx.role,
      });
      logInfo(context, 'properties.item.delete.success', { userId: ctx.user.id, propertyId: id });
      return jsonResponse(204, ctx.headers, null);
    } catch (e) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) {
        logWarn(context, 'properties.item.delete.not_found', { userId: ctx.user.id, propertyId: id });
        return mapped;
      }
      logError(context, 'properties.item.delete.error', {
        userId: ctx.user.id,
        propertyId: id,
        message: e instanceof Error ? e.message : 'unknown_error',
      });
      throw e;
    }
  }

  logWarn(context, 'properties.item.method_not_allowed', {
    method: request.method,
    userId: ctx.user.id,
    propertyId: id,
  });
  return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
}

// ---------------------------------------------------------------------------
// Azure Function registrations
// ---------------------------------------------------------------------------

app.http('landlordPropertiesCollection', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/properties',
  handler: withRateLimit(landlordPropertiesCollection),
});

app.http('landlordPropertiesItem', {
  methods: ['GET', 'PATCH', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/properties/{id}',
  handler: withRateLimit(landlordPropertiesItem),
});
