import test from 'node:test';
import assert from 'node:assert/strict';

import { moveOutLease } from '../dist/src/useCases/tenants/moveOutLease.js';
import { terminateLease } from '../dist/src/useCases/tenants/terminateLease.js';
import { deleteLeaseAsMistake } from '../dist/src/useCases/tenants/deleteLeaseAsMistake.js';
import { overrideRerentBlock } from '../dist/src/useCases/tenants/overrideRerentBlock.js';
import { listPastTenants } from '../dist/src/useCases/tenants/listPastTenants.js';
import { DomainError } from '../dist/src/domain/errors.js';

function makeDb(routes = []) {
  return {
    async query(sql, _params) {
      for (const [match, rows] of routes) {
        if (match.test(sql)) return { rows, rowCount: rows.length };
      }
      throw new Error(`Unexpected query: ${sql.slice(0, 120)}`);
    },
    async connect() {
      throw new Error('connect() should not be called in these tests');
    },
  };
}

const LEASE_ID = '00000000-0000-0000-0000-0000000000aa';
const PROP_ID = '00000000-0000-0000-0000-0000000000bb';
const LANDLORD_ID = '00000000-0000-0000-0000-0000000000cc';

function leaseRow(overrides = {}) {
  return {
    id: LEASE_ID,
    property_id: PROP_ID,
    status: 'ACTIVE',
    start_date: '2025-01-01',
    end_date: null,
    month_to_month: 1,
    deleted_at: null,
    ended_on: null,
    ended_reason: null,
    ended_by: null,
    ended_notes: null,
    updated_at: new Date(),
    created_at: new Date(),
    ...overrides,
  };
}

function propRow(overrides = {}) {
  return {
    id: PROP_ID,
    created_by: LANDLORD_ID,
    street: '1 Main',
    city: 'A',
    state: 'TX',
    zip: '00000',
    deleted_at: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// moveOutLease
// ---------------------------------------------------------------------------

test('moveOutLease: forbids non-landlord actor', async () => {
  await assert.rejects(
    moveOutLease(makeDb(), {
      actorUserId: 'u1',
      actorRole: 'TENANT',
      leaseId: LEASE_ID,
      endedOn: '2026-04-01',
    }),
    (e) => e instanceof DomainError && e.code === 'FORBIDDEN'
  );
});

test('moveOutLease: rejects missing lease id', async () => {
  await assert.rejects(
    moveOutLease(makeDb(), {
      actorUserId: 'u1',
      actorRole: 'LANDLORD',
      leaseId: '  ',
      endedOn: '2026-04-01',
    }),
    (e) => e instanceof DomainError && e.message === 'missing_lease_id'
  );
});

test('moveOutLease: rejects bad endedOn format', async () => {
  await assert.rejects(
    moveOutLease(makeDb(), {
      actorUserId: 'u1',
      actorRole: 'LANDLORD',
      leaseId: LEASE_ID,
      endedOn: '04/01/2026',
    }),
    (e) => e instanceof DomainError && e.message === 'invalid_ended_on'
  );
});

test('moveOutLease: 404 when lease missing', async () => {
  const db = makeDb([[/FROM leases WHERE id = \$1/, []]]);
  await assert.rejects(
    moveOutLease(db, {
      actorUserId: 'u1',
      actorRole: 'LANDLORD',
      leaseId: LEASE_ID,
      endedOn: '2026-04-01',
    }),
    (e) => e instanceof DomainError && e.code === 'NOT_FOUND' && e.detail === 'lease_not_found'
  );
});

test('moveOutLease: 403 when property not accessible by actor', async () => {
  const db = makeDb([
    [/FROM leases WHERE id = \$1/, [leaseRow()]],
    [/FROM properties/, []],
  ]);
  await assert.rejects(
    moveOutLease(db, {
      actorUserId: 'other',
      actorRole: 'LANDLORD',
      leaseId: LEASE_ID,
      endedOn: '2026-04-01',
    }),
    (e) => e instanceof DomainError && e.code === 'FORBIDDEN'
  );
});

test('moveOutLease: rejects already-ended lease', async () => {
  const db = makeDb([
    [/FROM leases WHERE id = \$1/, [leaseRow({ status: 'ENDED' })]],
    [/FROM properties/, [propRow()]],
  ]);
  await assert.rejects(
    moveOutLease(db, {
      actorUserId: LANDLORD_ID,
      actorRole: 'LANDLORD',
      leaseId: LEASE_ID,
      endedOn: '2026-04-01',
    }),
    (e) => e instanceof DomainError && e.message === 'lease_already_ended'
  );
});

test('moveOutLease: 404 when property has no owner', async () => {
  const db = makeDb([
    [/FROM leases WHERE id = \$1/, [leaseRow()]],
    [/FROM properties/, [propRow({ created_by: null })]],
  ]);
  await assert.rejects(
    moveOutLease(db, {
      actorUserId: 'admin',
      actorRole: 'ADMIN',
      leaseId: LEASE_ID,
      endedOn: '2026-04-01',
    }),
    (e) => e instanceof DomainError && e.detail === 'property_missing_owner'
  );
});

// ---------------------------------------------------------------------------
// terminateLease
// ---------------------------------------------------------------------------

test('terminateLease: forbids non-landlord actor', async () => {
  await assert.rejects(
    terminateLease(makeDb(), {
      actorUserId: 'u1',
      actorRole: 'TENANT',
      leaseId: LEASE_ID,
      kind: 'eviction',
      endedOn: '2026-04-01',
    }),
    (e) => e instanceof DomainError && e.code === 'FORBIDDEN'
  );
});

test('terminateLease: rejects invalid kind', async () => {
  await assert.rejects(
    terminateLease(makeDb(), {
      actorUserId: 'u1',
      actorRole: 'LANDLORD',
      leaseId: LEASE_ID,
      kind: 'bogus',
      endedOn: '2026-04-01',
    }),
    (e) => e instanceof DomainError && e.message === 'invalid_kind'
  );
});

test('terminateLease: rejects bad endedOn format', async () => {
  await assert.rejects(
    terminateLease(makeDb(), {
      actorUserId: 'u1',
      actorRole: 'LANDLORD',
      leaseId: LEASE_ID,
      kind: 'early_termination',
      endedOn: 'yesterday',
    }),
    (e) => e instanceof DomainError && e.message === 'invalid_ended_on'
  );
});

test('terminateLease: rejects already-ended lease', async () => {
  const db = makeDb([
    [/FROM leases WHERE id = \$1/, [leaseRow({ status: 'TERMINATED' })]],
    [/FROM properties/, [propRow()]],
  ]);
  await assert.rejects(
    terminateLease(db, {
      actorUserId: LANDLORD_ID,
      actorRole: 'LANDLORD',
      leaseId: LEASE_ID,
      kind: 'eviction',
      endedOn: '2026-04-01',
    }),
    (e) => e instanceof DomainError && e.message === 'lease_already_ended'
  );
});

// ---------------------------------------------------------------------------
// deleteLeaseAsMistake
// ---------------------------------------------------------------------------

test('deleteLeaseAsMistake: forbids non-landlord', async () => {
  await assert.rejects(
    deleteLeaseAsMistake(makeDb(), {
      actorUserId: 'u1',
      actorRole: 'TENANT',
      leaseId: LEASE_ID,
    }),
    (e) => e instanceof DomainError && e.code === 'FORBIDDEN'
  );
});

test('deleteLeaseAsMistake: rejects lease with payments', async () => {
  const db = makeDb([
    [/FROM leases WHERE id = \$1/, [leaseRow()]],
    [/FROM properties/, [propRow()]],
    [/FROM lease_payment_entries/, [{ n: 3 }]],
  ]);
  await assert.rejects(
    deleteLeaseAsMistake(db, {
      actorUserId: LANDLORD_ID,
      actorRole: 'LANDLORD',
      leaseId: LEASE_ID,
    }),
    (e) => e instanceof DomainError && e.message === 'lease_has_payments'
  );
});

test('deleteLeaseAsMistake: rejects lease already ENDED', async () => {
  const db = makeDb([
    [/FROM leases WHERE id = \$1/, [leaseRow({ status: 'ENDED' })]],
    [/FROM properties/, [propRow()]],
  ]);
  await assert.rejects(
    deleteLeaseAsMistake(db, {
      actorUserId: LANDLORD_ID,
      actorRole: 'LANDLORD',
      leaseId: LEASE_ID,
    }),
    (e) => e instanceof DomainError && e.message === 'lease_has_history'
  );
});

test('deleteLeaseAsMistake: landlord cannot force', async () => {
  // force is ignored unless admin; landlord hits history checks
  const db = makeDb([
    [/FROM leases WHERE id = \$1/, [leaseRow()]],
    [/FROM properties/, [propRow()]],
    [/FROM lease_payment_entries/, [{ n: 1 }]],
  ]);
  await assert.rejects(
    deleteLeaseAsMistake(db, {
      actorUserId: LANDLORD_ID,
      actorRole: 'LANDLORD',
      leaseId: LEASE_ID,
      force: true,
    }),
    (e) => e instanceof DomainError && e.message === 'lease_has_payments'
  );
});

// ---------------------------------------------------------------------------
// overrideRerentBlock
// ---------------------------------------------------------------------------

test('overrideRerentBlock: forbids non-admin (including LANDLORD)', async () => {
  await assert.rejects(
    overrideRerentBlock(makeDb(), {
      actorUserId: 'u1',
      actorRole: 'LANDLORD',
      blockId: 'b1',
    }),
    (e) => e instanceof DomainError && e.code === 'FORBIDDEN'
  );
});

test('overrideRerentBlock: rejects missing block id', async () => {
  await assert.rejects(
    overrideRerentBlock(makeDb(), {
      actorUserId: 'admin',
      actorRole: 'ADMIN',
      blockId: '   ',
    }),
    (e) => e instanceof DomainError && e.message === 'missing_block_id'
  );
});

// ---------------------------------------------------------------------------
// listPastTenants
// ---------------------------------------------------------------------------

test('listPastTenants: forbids non-landlord actor', async () => {
  await assert.rejects(
    listPastTenants(makeDb(), { actorUserId: 'u1', actorRole: 'TENANT' }),
    (e) => e instanceof DomainError && e.code === 'FORBIDDEN'
  );
});

test('listPastTenants: returns rows from db', async () => {
  const row = {
    tenant_user_id: 't1',
    email: 't@example.com',
    first_name: 'T',
    last_name: 'One',
    phone: null,
    landlord_user_id: LANDLORD_ID,
    last_lease_id: LEASE_ID,
    last_property_id: PROP_ID,
    last_property_street: '1 Main',
    last_property_city: 'A',
    last_property_state: 'TX',
    last_property_zip: '00000',
    ended_on: '2026-03-01',
    ended_reason: 'end_of_term',
    final_balance_amount: 0,
  };
  const db = makeDb([[/WITH scoped AS/, [row]]]);
  const result = await listPastTenants(db, { actorUserId: LANDLORD_ID, actorRole: 'LANDLORD' });
  assert.equal(result.past_tenants.length, 1);
  assert.equal(result.past_tenants[0].tenant_user_id, 't1');
});
