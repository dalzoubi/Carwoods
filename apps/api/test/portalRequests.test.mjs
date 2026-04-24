/**
 * portalRequests route — ownership check tests.
 *
 * The HTTP handlers are not exported so we test the use-case layer:
 *
 *   - getRequest   — tenant can only GET their own request (ownership check)
 *   - cancelRequest — only TENANT role; must own the request
 *
 * Critical ownership invariant:
 *   Tenant A must NOT be able to retrieve Tenant B's request even with a
 *   valid auth token. The `getRequest` use case uses `tenantCanAccessRequest`
 *   which checks the lease linkage — if that returns false → notFound().
 *
 * Note on IDs: validateRequestId uses isValidUuid — all IDs must be proper
 * UUID format (8-4-4-4-12 hex chars) or the validation returns NOT_FOUND
 * before any role check can run.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { getRequest } from '../dist/src/useCases/requests/getRequest.js';
import { cancelRequest } from '../dist/src/useCases/requests/cancelRequest.js';
import { DomainError } from '../dist/src/domain/errors.js';

// ---------------------------------------------------------------------------
// Fixtures — all IDs must be valid UUID format
// ---------------------------------------------------------------------------

const REQUEST_ID = 'aaaaaaaa-aaaa-4000-8aaa-000000000001';
const TENANT_A   = 'aaaaaaaa-aaaa-4000-8aaa-000000000002';
const TENANT_B   = 'bbbbbbbb-bbbb-4000-8bbb-000000000003';
const LANDLORD   = 'cccccccc-cccc-4000-8ccc-000000000004';

function makeRequestRow(overrides = {}) {
  return {
    id: REQUEST_ID,
    property_id: 'dddddddd-dddd-4000-8ddd-000000000005',
    lease_id: 'eeeeeeee-eeee-4000-8eee-000000000006',
    category_code: 'PLUMBING',
    priority_code: 'NORMAL',
    title: 'Leaky faucet',
    description: 'The kitchen faucet drips.',
    internal_notes: 'Note for management only',
    current_status_id: 'ffffffff-ffff-4000-8fff-000000000007',
    status_code: 'NOT_STARTED',
    submitted_by_user_id: TENANT_A,
    emergency_disclaimer_acknowledged: false,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    ...overrides,
  };
}

/**
 * Build a fake DB stub.
 * `tenantAccess`: true returns a row for the tenantCanAccessRequest JOIN query;
 *                false returns empty rows.
 * `requestRow`: row returned by getRequestById (after the access check).
 *
 * Note: SQL strings from the compiled dist may contain newlines, so we use
 * the `s` (dotAll) flag on regexes that match across line boundaries.
 */
function makeDb({ tenantAccess = false, requestRow = null, landlordAccess = false } = {}) {
  return {
    async query(sql) {
      const upper = sql.trim().toUpperCase();
      if (upper === 'BEGIN' || upper === 'COMMIT' || upper === 'ROLLBACK') {
        return { rows: [], rowCount: 0 };
      }

      // tenantCanAccessRequest: JOIN between maintenance_requests and lease_tenants
      // Use /s flag because SQL contains \n between FROM and JOIN clauses
      if (/FROM maintenance_requests[\s\S]*JOIN lease_tenants/i.test(sql)) {
        return tenantAccess
          ? { rows: [{ ok: 1 }], rowCount: 1 }
          : { rows: [], rowCount: 0 };
      }

      // landlordOwnsRequestProperty: maintenance_requests INNER JOIN properties
      if (/FROM maintenance_requests[\s\S]*INNER JOIN properties/i.test(sql)) {
        return landlordAccess
          ? { rows: [{ ok: 1 }], rowCount: 1 }
          : { rows: [], rowCount: 0 };
      }

      // getRequestById: SELECT from maintenance_requests with joins to lookup tables
      // Must come AFTER the more specific patterns above
      if (/FROM maintenance_requests/i.test(sql)) {
        return requestRow
          ? { rows: [requestRow], rowCount: 1 }
          : { rows: [], rowCount: 0 };
      }

      return { rows: [], rowCount: 0 };
    },
    async connect() {
      const self = this;
      return { async query(s, p) { return self.query(s, p); }, release() {} };
    },
  };
}

// ---------------------------------------------------------------------------
// getRequest — tenant can only access their own request
// ---------------------------------------------------------------------------

test('getRequest: tenant B cannot access tenant A\'s request (ownership check → NOT_FOUND)', async () => {
  // tenantCanAccessRequest returns false (TENANT_B has no lease linkage)
  const db = makeDb({ tenantAccess: false, requestRow: makeRequestRow() });

  await assert.rejects(
    getRequest(db, { requestId: REQUEST_ID, actorUserId: TENANT_B, actorRole: 'TENANT' }),
    (e) => e instanceof DomainError && e.code === 'NOT_FOUND'
  );
});

test('getRequest: tenant A CAN access their own request and gets internal_notes stripped', async () => {
  const row = makeRequestRow({ internal_notes: 'Sensitive note' });
  // tenantCanAccessRequest returns true, then getRequestById returns the row
  const db = makeDb({ tenantAccess: true, requestRow: row });

  const result = await getRequest(db, { requestId: REQUEST_ID, actorUserId: TENANT_A, actorRole: 'TENANT' });
  assert.ok(result.request);
  assert.equal(result.request.id, REQUEST_ID);
  // Tenant must NOT receive internal_notes
  assert.equal(result.request.internal_notes, null);
});

test('getRequest: LANDLORD cannot access another landlord\'s request property → NOT_FOUND', async () => {
  // landlordOwnsRequestProperty returns false
  const db = makeDb({ landlordAccess: false, requestRow: makeRequestRow() });

  await assert.rejects(
    getRequest(db, { requestId: REQUEST_ID, actorUserId: LANDLORD, actorRole: 'LANDLORD' }),
    (e) => e instanceof DomainError && e.code === 'NOT_FOUND'
  );
});

test('getRequest: ADMIN receives internal_notes in the response', async () => {
  const row = makeRequestRow({ internal_notes: 'Admin-only note' });
  const db = makeDb({ requestRow: row });

  const result = await getRequest(db, {
    requestId: REQUEST_ID,
    actorUserId: 'aaaaaaaa-0000-4000-8000-000000000099',
    actorRole: 'ADMIN',
  });
  assert.equal(result.request.internal_notes, 'Admin-only note');
});

test('getRequest: AI_AGENT role is rejected with FORBIDDEN', async () => {
  const db = makeDb({ requestRow: makeRequestRow() });
  await assert.rejects(
    getRequest(db, {
      requestId: REQUEST_ID,
      actorUserId: 'aaaaaaaa-0000-4000-8000-000000000098',
      actorRole: 'AI_AGENT',
    }),
    (e) => e instanceof DomainError && e.code === 'FORBIDDEN'
  );
});

// ---------------------------------------------------------------------------
// getRequest — validation
// ---------------------------------------------------------------------------

test('getRequest: missing requestId produces VALIDATION error', async () => {
  const db = makeDb();
  await assert.rejects(
    getRequest(db, { requestId: undefined, actorUserId: TENANT_A, actorRole: 'TENANT' }),
    (e) => e instanceof DomainError && e.code === 'VALIDATION'
  );
});

// ---------------------------------------------------------------------------
// cancelRequest — only TENANT can cancel; must own the request
// ---------------------------------------------------------------------------

test('cancelRequest: LANDLORD role is rejected with FORBIDDEN', async () => {
  const db = makeDb();
  await assert.rejects(
    cancelRequest(db, { requestId: REQUEST_ID, actorUserId: LANDLORD, actorRole: 'LANDLORD' }),
    // cancelRequest uses forbidden('only_tenants_can_cancel_requests') which sets
    // message='forbidden' (always) and detail='only_tenants_can_cancel_requests'
    (e) => e instanceof DomainError && e.code === 'FORBIDDEN'
  );
});

test('cancelRequest: tenant B cannot cancel tenant A\'s request → NOT_FOUND', async () => {
  // tenantCanAccessRequest returns false for TENANT_B
  const db = makeDb({ tenantAccess: false, requestRow: makeRequestRow() });

  await assert.rejects(
    cancelRequest(db, { requestId: REQUEST_ID, actorUserId: TENANT_B, actorRole: 'TENANT' }),
    (e) => e instanceof DomainError && e.code === 'NOT_FOUND'
  );
});
