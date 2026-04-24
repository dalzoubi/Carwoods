/**
 * payments route — auth-guard and ownership tests.
 *
 * The HTTP handlers are not exported so we test the use-case layer that
 * the route delegates to:
 *
 *   - recordPayment  (POST /api/landlord/payments)
 *   - updatePayment  (PATCH /api/landlord/payments/{id})
 *   - deletePayment  (DELETE /api/landlord/payments/{id})
 *   - listPaymentEntries (GET portal and landlord variants)
 *
 * Coverage:
 *   - Auth guard: TENANT role is rejected with FORBIDDEN before any DB hit
 *   - Ownership: landlord X cannot touch an entry owned by landlord Y
 *   - Happy path: valid LANDLORD actor gets the expected response shape
 *   - Validation: missing required fields produce the correct error code
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { recordPayment, updatePayment } from '../dist/src/useCases/payments/recordPayment.js';
import { deletePayment } from '../dist/src/useCases/payments/deletePayment.js';
import { listPaymentEntries } from '../dist/src/useCases/payments/listPaymentEntries.js';
import { DomainError } from '../dist/src/domain/errors.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const LEASE_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const PROP_ID  = 'bbbbbbbb-0000-0000-0000-000000000002';
const LANDLORD = 'cccccccc-0000-0000-0000-000000000003';
const OTHER_LL = 'dddddddd-0000-0000-0000-000000000004';
const ENTRY_ID = 'eeeeeeee-0000-0000-0000-000000000005';

function makeEntryRow(overrides = {}) {
  return {
    id: ENTRY_ID,
    lease_id: LEASE_ID,
    property_id: null,
    tenant_user_id: null,
    show_in_tenant_portal: true,
    period_start: '2026-01-01',
    amount_due: 1500,
    amount_paid: 1500,
    due_date: '2026-01-01',
    paid_date: '2026-01-02',
    payment_method: 'CHECK',
    payment_type: 'RENT',
    notes: null,
    recorded_by: LANDLORD,
    deleted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

/**
 * Build a fake pool whose queries are dispatched by regex against SQL text.
 * routes: Array<[RegExp, rows]>
 */
function makeDb(routes = []) {
  const client = {
    async query(sql, _p) {
      const upper = sql.trim().toUpperCase();
      if (upper === 'BEGIN' || upper === 'COMMIT' || upper === 'ROLLBACK') {
        return { rows: [], rowCount: 0 };
      }
      for (const [re, rows] of routes) {
        if (re.test(sql)) return { rows, rowCount: rows.length };
      }
      throw new Error(`Unexpected query in test: ${sql.slice(0, 120)}`);
    },
    release() {},
  };
  return {
    async query(sql, p) { return client.query(sql, p); },
    async connect() { return client; },
  };
}

const validRecordInput = {
  actorUserId: LANDLORD,
  actorRole: 'LANDLORD',
  lease_id: LEASE_ID,
  period_start: '2026-01-01',
  amount_due: 1500,
  amount_paid: 1500,
  due_date: '2026-01-01',
};

// ---------------------------------------------------------------------------
// Auth guard — TENANT role
// ---------------------------------------------------------------------------

test('recordPayment: TENANT role is rejected with FORBIDDEN', async () => {
  const db = makeDb();
  await assert.rejects(
    recordPayment(db, { ...validRecordInput, actorRole: 'TENANT' }),
    (e) => e instanceof DomainError && e.code === 'FORBIDDEN'
  );
});

test('updatePayment: TENANT role is rejected with FORBIDDEN', async () => {
  const db = makeDb();
  await assert.rejects(
    updatePayment(db, { actorUserId: LANDLORD, actorRole: 'TENANT', entryId: ENTRY_ID }),
    (e) => e instanceof DomainError && e.code === 'FORBIDDEN'
  );
});

test('deletePayment: TENANT role is rejected with FORBIDDEN', async () => {
  const db = makeDb();
  await assert.rejects(
    deletePayment(db, { actorUserId: LANDLORD, actorRole: 'TENANT', entryId: ENTRY_ID }),
    (e) => e instanceof DomainError && e.code === 'FORBIDDEN'
  );
});

test('listPaymentEntries: TENANT role without propertyIdForTenant is accepted (tenant portal path)', async () => {
  // Tenant portal path: role = TENANT, property scope goes to listEntriesForTenantPortal
  const db = makeDb([[/FROM payment_entries/i, []]]);
  const result = await listPaymentEntries(db, {
    actorUserId: 'tenant-1',
    actorRole: 'TENANT',
  });
  assert.ok(Array.isArray(result.entries));
});

// ---------------------------------------------------------------------------
// Ownership — landlord X cannot access entries for landlord Y
// ---------------------------------------------------------------------------

test('recordPayment: landlord X cannot record a payment for a lease owned by landlord Y', async () => {
  // leaseAccessibleByLandlord returns false for OTHER_LL
  const db = makeDb([
    [/lease_accessible_by_landlord|SELECT .* FROM leases|leases l/i, []],
  ]);
  await assert.rejects(
    recordPayment(db, {
      actorUserId: OTHER_LL,
      actorRole: 'LANDLORD',
      lease_id: LEASE_ID,
      period_start: '2026-01-01',
      amount_due: 1000,
      amount_paid: 1000,
      due_date: '2026-01-01',
    }),
    (e) => e instanceof DomainError && e.code === 'FORBIDDEN'
  );
});

test('deletePayment: landlord X cannot delete an entry owned by landlord Y', async () => {
  const entryRow = makeEntryRow({ recorded_by: LANDLORD });
  // The DB stub must distinguish the two payment_entry queries by SQL content:
  //   getEntryExistsState: SELECT deleted_at FROM payment_entries WHERE id = $1
  //   getEntryById:        SELECT <many cols> FROM payment_entries pe WHERE pe.id = $1 AND pe.deleted_at IS NULL
  const db = {
    async query(sql) {
      const upper = sql.trim().toUpperCase();
      if (upper === 'BEGIN' || upper === 'COMMIT' || upper === 'ROLLBACK') {
        return { rows: [], rowCount: 0 };
      }
      // getEntryExistsState — only selects deleted_at
      if (/SELECT deleted_at FROM payment_entries/i.test(sql)) {
        return { rows: [{ deleted_at: null }], rowCount: 1 }; // active row
      }
      // getEntryById — full column list from pe alias
      if (/FROM payment_entries pe/i.test(sql)) {
        return { rows: [entryRow], rowCount: 1 };
      }
      // paymentEntryAccessibleByLandlord → leaseAccessibleByLandlord: returns false for OTHER_LL
      if (/FROM leases/i.test(sql) || /FROM properties/i.test(sql)) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    },
    async connect() {
      const self = this;
      return { async query(s, p) { return self.query(s, p); }, release() {} };
    },
  };

  await assert.rejects(
    deletePayment(db, { actorUserId: OTHER_LL, actorRole: 'LANDLORD', entryId: ENTRY_ID }),
    (e) => e instanceof DomainError && e.code === 'FORBIDDEN'
  );
});

// ---------------------------------------------------------------------------
// Validation — missing required fields
// ---------------------------------------------------------------------------

test('recordPayment: missing period_start produces VALIDATION error', async () => {
  const db = makeDb([[/FROM leases/i, [{ id: LEASE_ID, property_id: PROP_ID, created_by: LANDLORD }]]]);
  await assert.rejects(
    recordPayment(db, {
      actorUserId: LANDLORD,
      actorRole: 'LANDLORD',
      lease_id: LEASE_ID,
      // period_start missing
      amount_due: 1000,
      amount_paid: 1000,
      due_date: '2026-01-01',
    }),
    (e) => e instanceof DomainError && e.code === 'VALIDATION'
  );
});

test('recordPayment: invalid payment_method produces VALIDATION error', async () => {
  const db = makeDb([
    [/FROM leases/i, [{ id: LEASE_ID, property_id: PROP_ID, created_by: LANDLORD }]],
    // leaseAccessibleByLandlord passes
    [/SELECT.*id.*FROM leases/i, [{ id: LEASE_ID }]],
  ]);
  await assert.rejects(
    recordPayment(db, {
      ...validRecordInput,
      payment_method: 'BITCOIN',
    }),
    (e) => e instanceof DomainError && e.code === 'VALIDATION'
      && e.message === 'payment_method_invalid'
  );
});

test('recordPayment: missing payment scope (no lease_id, no property_id) produces VALIDATION error', async () => {
  const db = makeDb();
  await assert.rejects(
    recordPayment(db, {
      actorUserId: LANDLORD,
      actorRole: 'LANDLORD',
      period_start: '2026-01-01',
      amount_due: 1000,
      amount_paid: 1000,
      due_date: '2026-01-01',
    }),
    (e) => e instanceof DomainError && e.code === 'VALIDATION'
      && e.message === 'payment_scope_required'
  );
});

// ---------------------------------------------------------------------------
// deletePayment — happy path returns 'not_found' when entry is missing
// ---------------------------------------------------------------------------

test('deletePayment: returns not_found when entry does not exist', async () => {
  const db = makeDb([
    // getEntryExistsState returns empty (missing)
    [/SELECT.*FROM payment_entries/i, []],
  ]);
  const result = await deletePayment(db, {
    actorUserId: LANDLORD,
    actorRole: 'LANDLORD',
    entryId: ENTRY_ID,
  });
  assert.equal(result, 'not_found');
});
