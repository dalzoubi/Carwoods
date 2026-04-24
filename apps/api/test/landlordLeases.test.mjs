/**
 * landlordLeases route — auth-guard and ownership tests.
 *
 * The HTTP handlers are not exported so we test the use-case layer:
 *
 *   - getLease    — TENANT role rejected; missing ID rejected
 *   - createLease — TENANT role rejected; property not found → NOT_FOUND
 *   - updateLease — TENANT role rejected; missing lease ID rejected
 *
 * The `deleteLeaseAsMistake` is covered in the existing leaseLifecycle.test.mjs.
 *
 * Coverage:
 *   - Auth guard: TENANT role → 403 FORBIDDEN
 *   - Validation: missing required fields → VALIDATION
 *   - Ownership: landlord with no access to the property → NOT_FOUND
 *   - Happy path shape: successful get returns { lease }
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { getLease } from '../dist/src/useCases/leases/getLease.js';
import { createLease } from '../dist/src/useCases/leases/createLease.js';
import { updateLease } from '../dist/src/useCases/leases/updateLease.js';
import { DomainError } from '../dist/src/domain/errors.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const LEASE_ID = 'ffffffff-0000-0000-0000-000000000001';
const PROP_ID  = 'ffffffff-0000-0000-0000-000000000002';
const LANDLORD = 'ffffffff-0000-0000-0000-000000000003';
const OTHER_LL = 'ffffffff-0000-0000-0000-000000000004';

function makeLeaseRow(overrides = {}) {
  return {
    id: LEASE_ID,
    property_id: PROP_ID,
    start_date: '2026-01-01',
    end_date: null,
    month_to_month: true,
    status: 'ACTIVE',
    notes: null,
    rent_amount: 1200,
    ended_on: null,
    ended_reason: null,
    ended_by: null,
    ended_notes: null,
    notice_period_days: 30,
    notice_given_on: null,
    notice_move_out_date: null,
    early_termination_fee_amount: null,
    early_termination_notes: null,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    ...overrides,
  };
}

function makePropertyRow(overrides = {}) {
  return {
    id: PROP_ID,
    created_by: LANDLORD,
    street: '100 Main St',
    city: 'Houston',
    state: 'TX',
    zip: '77001',
    deleted_at: null,
    ...overrides,
  };
}

function makeDb(routes = []) {
  return {
    async query(sql) {
      for (const [re, rows] of routes) {
        if (re.test(sql)) return { rows, rowCount: rows.length };
      }
      return { rows: [], rowCount: 0 };
    },
    async connect() {
      const self = this;
      return {
        async query(sql, p) { return self.query(sql, p); },
        async release() {},
      };
    },
  };
}

// ---------------------------------------------------------------------------
// getLease — auth guard
// ---------------------------------------------------------------------------

test('getLease: TENANT role is rejected with FORBIDDEN', async () => {
  const db = makeDb([[/FROM leases/i, [makeLeaseRow()]]]);
  await assert.rejects(
    getLease(db, { leaseId: LEASE_ID, actorUserId: 'tenant-1', actorRole: 'TENANT' }),
    (e) => e instanceof DomainError && e.code === 'FORBIDDEN'
  );
});

test('getLease: missing leaseId is rejected with VALIDATION error', async () => {
  const db = makeDb();
  await assert.rejects(
    getLease(db, { leaseId: undefined, actorUserId: LANDLORD, actorRole: 'LANDLORD' }),
    (e) => e instanceof DomainError && e.code === 'VALIDATION' && e.message === 'missing_id'
  );
});

test('getLease: unknown lease id returns NOT_FOUND', async () => {
  // getLeaseById returns null (no rows)
  const db = makeDb([[/FROM leases/i, []]]);
  await assert.rejects(
    getLease(db, { leaseId: 'no-such-id', actorUserId: LANDLORD, actorRole: 'LANDLORD' }),
    (e) => e instanceof DomainError && e.code === 'NOT_FOUND'
  );
});

test('getLease: ADMIN role can fetch any lease', async () => {
  const db = makeDb([[/FROM leases/i, [makeLeaseRow()]]]);
  const result = await getLease(db, { leaseId: LEASE_ID, actorUserId: 'admin-1', actorRole: 'ADMIN' });
  assert.ok(result.lease);
  assert.equal(result.lease.id, LEASE_ID);
});

// ---------------------------------------------------------------------------
// createLease — auth guard
// ---------------------------------------------------------------------------

test('createLease: TENANT role is rejected with FORBIDDEN', async () => {
  const db = makeDb();
  await assert.rejects(
    createLease(db, {
      actorUserId: 'tenant-1',
      actorRole: 'TENANT',
      property_id: PROP_ID,
      start_date: '2026-01-01',
      status: 'ACTIVE',
    }),
    (e) => e instanceof DomainError && e.code === 'FORBIDDEN'
  );
});

test('createLease: missing property_id produces VALIDATION error', async () => {
  const db = makeDb();
  await assert.rejects(
    createLease(db, {
      actorUserId: LANDLORD,
      actorRole: 'LANDLORD',
      property_id: undefined,
      start_date: '2026-01-01',
      status: 'ACTIVE',
    }),
    (e) => e instanceof DomainError && e.code === 'VALIDATION'
  );
});

test('createLease: property not found (not accessible to landlord) produces NOT_FOUND', async () => {
  // getPropertyByIdForActor returns null (property doesn't belong to this landlord)
  const db = makeDb([[/FROM properties/i, []]]);
  await assert.rejects(
    createLease(db, {
      actorUserId: OTHER_LL,
      actorRole: 'LANDLORD',
      property_id: PROP_ID,
      start_date: '2026-01-01',
      status: 'ACTIVE',
    }),
    (e) => e instanceof DomainError && e.code === 'NOT_FOUND'
  );
});

test('createLease: invalid status produces VALIDATION error', async () => {
  const db = makeDb([[/FROM properties/i, [makePropertyRow()]]]);
  await assert.rejects(
    createLease(db, {
      actorUserId: LANDLORD,
      actorRole: 'LANDLORD',
      property_id: PROP_ID,
      start_date: '2026-01-01',
      status: 'INVALID_STATUS',
    }),
    (e) => e instanceof DomainError && e.code === 'VALIDATION'
  );
});

// ---------------------------------------------------------------------------
// updateLease — auth guard
// ---------------------------------------------------------------------------

test('updateLease: TENANT role is rejected with FORBIDDEN', async () => {
  const db = makeDb();
  await assert.rejects(
    updateLease(db, {
      leaseId: LEASE_ID,
      actorUserId: 'tenant-1',
      actorRole: 'TENANT',
    }),
    (e) => e instanceof DomainError && e.code === 'FORBIDDEN'
  );
});

test('updateLease: missing leaseId is rejected with VALIDATION error', async () => {
  const db = makeDb();
  await assert.rejects(
    updateLease(db, {
      leaseId: undefined,
      actorUserId: LANDLORD,
      actorRole: 'LANDLORD',
    }),
    (e) => e instanceof DomainError && e.code === 'VALIDATION' && e.message === 'missing_id'
  );
});
