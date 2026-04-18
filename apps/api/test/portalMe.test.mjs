import test from 'node:test';
import assert from 'node:assert/strict';
import { portalMeHandler } from '../dist/src/functions/portalMe.js';

function makeRequest({ method = 'GET', authorization = 'Bearer token', origin = 'http://localhost:3000' } = {}) {
  const map = new Map();
  map.set('authorization', authorization);
  map.set('origin', origin);
  return {
    method,
    headers: {
      get(name) {
        if (!name) return null;
        return map.get(String(name).toLowerCase()) ?? null;
      },
    },
  };
}

function makeContext() {
  return {
    functionName: 'portalMe',
    invocationId: 'test-invocation',
    log: () => {},
    warn: () => {},
    error: () => {},
    info: () => {},
  };
}

test('portalMe returns 503 when user lookup throws', async () => {
  const request = makeRequest();
  const context = makeContext();

  const response = await portalMeHandler(request, context, {
    hasDatabaseUrl: () => true,
    getPool: () => ({}),
    verifyAccessToken: async () => ({ sub: 'sub-1', oid: 'oid-1' }),
    authConfigured: () => true,
    ensureUserNotificationPreference: async () => null,
    findUserByClaims: async () => {
      throw new Error('db temporarily unavailable');
    },
  });

  assert.equal(response.status, 503);
  assert.equal(response.jsonBody?.error, 'service_unavailable');
});

test('portalMe returns 403 no_portal_access when user is not found', async () => {
  const request = makeRequest();
  const context = makeContext();

  const response = await portalMeHandler(request, context, {
    hasDatabaseUrl: () => true,
    getPool: () => ({}),
    verifyAccessToken: async () => ({ sub: 'sub-2', oid: 'oid-2' }),
    authConfigured: () => true,
    ensureUserNotificationPreference: async () => null,
    findUserByClaims: async () => null,
  });

  assert.equal(response.status, 403);
  assert.equal(response.jsonBody?.error, 'no_portal_access');
});

test('portalMe allows AI_AGENT role', async () => {
  const request = makeRequest();
  const context = makeContext();

  const response = await portalMeHandler(request, context, {
    hasDatabaseUrl: () => true,
    getPool: () => ({}),
    verifyAccessToken: async () => ({ sub: 'sub-3', oid: 'oid-3', email: 'ai@example.com' }),
    authConfigured: () => true,
    ensureUserNotificationPreference: async () => ({
      user_id: '00000000-0000-0000-0000-000000000000',
      email_enabled: true,
      in_app_enabled: true,
      sms_enabled: false,
      sms_opt_in: false,
      created_at: new Date(),
      updated_at: new Date(),
    }),
    getGlobalAttachmentUploadConfigCached: async () => ({
      max_image_bytes: 10 * 1024 * 1024,
    }),
    findUserByClaims: async () => ({
      id: '00000000-0000-0000-0000-000000000000',
      external_auth_oid: 'system:elsa:auto-responder',
      email: 'elsa-system@carwoods.local',
      first_name: 'Elsa',
      last_name: 'System',
      phone: null,
      profile_photo_storage_path: null,
      role: 'AI_AGENT',
      status: 'ACTIVE',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(response.jsonBody?.role, 'AI_AGENT');
  assert.deepEqual(response.jsonBody?.attachment_upload_limits, {
    max_image_bytes: 10 * 1024 * 1024,
  });
});
