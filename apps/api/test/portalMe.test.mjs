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
    entraAuthConfigured: () => true,
    findUserByClaims: async () => {
      throw new Error('db temporarily unavailable');
    },
  });

  assert.equal(response.status, 503);
  assert.equal(response.jsonBody?.error, 'user_lookup_unavailable');
});

test('portalMe returns 403 no_portal_access when user is not found', async () => {
  const request = makeRequest();
  const context = makeContext();

  const response = await portalMeHandler(request, context, {
    hasDatabaseUrl: () => true,
    getPool: () => ({}),
    verifyAccessToken: async () => ({ sub: 'sub-2', oid: 'oid-2' }),
    entraAuthConfigured: () => true,
    findUserByClaims: async () => null,
  });

  assert.equal(response.status, 403);
  assert.equal(response.jsonBody?.error, 'no_portal_access');
});
