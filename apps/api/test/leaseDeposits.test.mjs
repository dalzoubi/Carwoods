import test from 'node:test';
import assert from 'node:assert/strict';

import { listLeaseDeposits } from '../dist/src/useCases/tenants/listLeaseDeposits.js';
import { createLeaseDeposit } from '../dist/src/useCases/tenants/createLeaseDeposit.js';
import { updateLeaseDeposit } from '../dist/src/useCases/tenants/updateLeaseDeposit.js';
import { deleteLeaseDeposit } from '../dist/src/useCases/tenants/deleteLeaseDeposit.js';
import { upsertDepositDisposition } from '../dist/src/useCases/tenants/upsertDepositDisposition.js';
import { DomainError } from '../dist/src/domain/errors.js';

const LEASE_ID = '11111111-1111-1111-1111-111111111111';
const PROP_ID = '22222222-2222-2222-2222-222222222222';
const LANDLORD_ID = '33333333-3333-3333-3333-333333333333';
const OTHER_LANDLORD = '44444444-4444-4444-4444-444444444444';
const DEPOSIT_ID = '55555555-5555-5555-5555-555555555555';
const TENANT_ID = '66666666-6666-6666-6666-666666666666';

function makeDb(routes = []) {
  return {
    async query(sql, _params) {
      for (const [match, rows] of routes) {
        if (match.test(sql)) return { rows, rowCount: rows.length };
      }
      throw new Error(`Unexpected query: ${sql.slice(0, 160)}`);
    },
    async connect() {
      throw new Error('connect() should not be called in these tests');
    },
  };
}

function leaseRow() {
  return { id: LEASE_ID, property_id: PROP_ID, status: 'ACTIVE', deleted_at: null };
}

function propRow() {
  return { id: PROP_ID, created_by: LANDLORD_ID, deleted_at: null };
}

function depositRow(overrides = {}) {
  return {
    id: DEPOSIT_ID,
    lease_id: LEASE_ID,
    kind: 'SECURITY',
    amount: 1500,
    held_since: '2025-01-01',
    notes: null,
    deleted_at: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// listLeaseDeposits
// ---------------------------------------------------------------------------

test('listLeaseDeposits: forbids tenants', async () => {
  await assert.rejects(
    () =>
      listLeaseDeposits(makeDb(), {
        actorUserId: TENANT_ID,
        actorRole: 'TENANT',
        leaseId: LEASE_ID,
      }),
    (err) => err instanceof DomainError && err.code === 'FORBIDDEN'
  );
});

test('listLeaseDeposits: rejects missing lease id', async () => {
  await assert.rejects(
    () =>
      listLeaseDeposits(makeDb(), {
        actorUserId: LANDLORD_ID,
        actorRole: 'LANDLORD',
        leaseId: '',
      }),
    (err) => err instanceof DomainError && err.code === 'VALIDATION'
  );
});

test('listLeaseDeposits: 404 when lease missing', async () => {
  const db = makeDb([[/FROM leases/, []]]);
  await assert.rejects(
    () =>
      listLeaseDeposits(db, {
        actorUserId: LANDLORD_ID,
        actorRole: 'LANDLORD',
        leaseId: LEASE_ID,
      }),
    (err) => err instanceof DomainError && err.code === 'NOT_FOUND'
  );
});

test('listLeaseDeposits: 403 when landlord does not own property', async () => {
  const db = makeDb([
    [/FROM leases/, [leaseRow()]],
    [/FROM properties/, []],
  ]);
  await assert.rejects(
    () =>
      listLeaseDeposits(db, {
        actorUserId: OTHER_LANDLORD,
        actorRole: 'LANDLORD',
        leaseId: LEASE_ID,
      }),
    (err) => err instanceof DomainError && err.code === 'FORBIDDEN'
  );
});

test('listLeaseDeposits: returns deposits + dispositions for owning landlord', async () => {
  const db = makeDb([
    [/FROM leases/, [leaseRow()]],
    [/FROM properties/, [propRow()]],
    [/FROM lease_deposits\s/, [depositRow()]],
    [/FROM lease_deposit_dispositions/, []],
  ]);
  const out = await listLeaseDeposits(db, {
    actorUserId: LANDLORD_ID,
    actorRole: 'LANDLORD',
    leaseId: LEASE_ID,
  });
  assert.equal(out.deposits.length, 1);
  assert.equal(out.deposits[0].id, DEPOSIT_ID);
  assert.deepEqual(out.dispositions, []);
});

// ---------------------------------------------------------------------------
// createLeaseDeposit (validation only — skip DB write path)
// ---------------------------------------------------------------------------

test('createLeaseDeposit: rejects invalid held_since', async () => {
  await assert.rejects(
    () =>
      createLeaseDeposit(makeDb(), {
        actorUserId: LANDLORD_ID,
        actorRole: 'LANDLORD',
        leaseId: LEASE_ID,
        amount: 100,
        heldSince: '01-01-2025',
      }),
    (err) => err instanceof DomainError && err.code === 'VALIDATION'
  );
});

test('createLeaseDeposit: rejects negative amount', async () => {
  await assert.rejects(
    () =>
      createLeaseDeposit(makeDb(), {
        actorUserId: LANDLORD_ID,
        actorRole: 'LANDLORD',
        leaseId: LEASE_ID,
        amount: -1,
        heldSince: '2025-01-01',
      }),
    (err) => err instanceof DomainError && err.code === 'VALIDATION'
  );
});

test('createLeaseDeposit: rejects invalid kind', async () => {
  await assert.rejects(
    () =>
      createLeaseDeposit(makeDb(), {
        actorUserId: LANDLORD_ID,
        actorRole: 'LANDLORD',
        leaseId: LEASE_ID,
        amount: 100,
        heldSince: '2025-01-01',
        kind: 'WEIRD',
      }),
    (err) => err instanceof DomainError && err.code === 'VALIDATION'
  );
});

test('createLeaseDeposit: forbids tenants', async () => {
  await assert.rejects(
    () =>
      createLeaseDeposit(makeDb(), {
        actorUserId: TENANT_ID,
        actorRole: 'TENANT',
        leaseId: LEASE_ID,
        amount: 100,
        heldSince: '2025-01-01',
      }),
    (err) => err instanceof DomainError && err.code === 'FORBIDDEN'
  );
});

// ---------------------------------------------------------------------------
// updateLeaseDeposit
// ---------------------------------------------------------------------------

test('updateLeaseDeposit: rejects missing deposit id', async () => {
  await assert.rejects(
    () =>
      updateLeaseDeposit(makeDb(), {
        actorUserId: LANDLORD_ID,
        actorRole: 'LANDLORD',
        depositId: '',
      }),
    (err) => err instanceof DomainError && err.code === 'VALIDATION'
  );
});

test('updateLeaseDeposit: 404 when deposit missing', async () => {
  const db = makeDb([[/FROM lease_deposits/, []]]);
  await assert.rejects(
    () =>
      updateLeaseDeposit(db, {
        actorUserId: LANDLORD_ID,
        actorRole: 'LANDLORD',
        depositId: DEPOSIT_ID,
      }),
    (err) => err instanceof DomainError && err.code === 'NOT_FOUND'
  );
});

test('updateLeaseDeposit: 403 when landlord does not own property', async () => {
  const db = makeDb([
    [/FROM lease_deposits/, [depositRow()]],
    [/FROM leases/, [leaseRow()]],
    [/FROM properties/, []],
  ]);
  await assert.rejects(
    () =>
      updateLeaseDeposit(db, {
        actorUserId: OTHER_LANDLORD,
        actorRole: 'LANDLORD',
        depositId: DEPOSIT_ID,
        amount: 200,
      }),
    (err) => err instanceof DomainError && err.code === 'FORBIDDEN'
  );
});

// ---------------------------------------------------------------------------
// deleteLeaseDeposit
// ---------------------------------------------------------------------------

test('deleteLeaseDeposit: forbids tenants', async () => {
  await assert.rejects(
    () =>
      deleteLeaseDeposit(makeDb(), {
        actorUserId: TENANT_ID,
        actorRole: 'TENANT',
        depositId: DEPOSIT_ID,
      }),
    (err) => err instanceof DomainError && err.code === 'FORBIDDEN'
  );
});

test('deleteLeaseDeposit: 404 when deposit missing', async () => {
  const db = makeDb([[/FROM lease_deposits/, []]]);
  await assert.rejects(
    () =>
      deleteLeaseDeposit(db, {
        actorUserId: LANDLORD_ID,
        actorRole: 'LANDLORD',
        depositId: DEPOSIT_ID,
      }),
    (err) => err instanceof DomainError && err.code === 'NOT_FOUND'
  );
});

// ---------------------------------------------------------------------------
// upsertDepositDisposition
// ---------------------------------------------------------------------------

test('upsertDepositDisposition: rejects negative refund', async () => {
  await assert.rejects(
    () =>
      upsertDepositDisposition(makeDb(), {
        actorUserId: LANDLORD_ID,
        actorRole: 'LANDLORD',
        depositId: DEPOSIT_ID,
        refundedAmount: -1,
        withheldAmount: 0,
      }),
    (err) => err instanceof DomainError && err.code === 'VALIDATION'
  );
});

test('upsertDepositDisposition: rejects split exceeding deposit amount', async () => {
  const db = makeDb([[/FROM lease_deposits/, [depositRow({ amount: 1000 })]]]);
  await assert.rejects(
    () =>
      upsertDepositDisposition(db, {
        actorUserId: LANDLORD_ID,
        actorRole: 'LANDLORD',
        depositId: DEPOSIT_ID,
        refundedAmount: 600,
        withheldAmount: 500,
      }),
    (err) => err instanceof DomainError && err.code === 'VALIDATION'
  );
});

test('upsertDepositDisposition: requires withholding reason when withheld > 0', async () => {
  const db = makeDb([[/FROM lease_deposits/, [depositRow({ amount: 1000 })]]]);
  await assert.rejects(
    () =>
      upsertDepositDisposition(db, {
        actorUserId: LANDLORD_ID,
        actorRole: 'LANDLORD',
        depositId: DEPOSIT_ID,
        refundedAmount: 500,
        withheldAmount: 500,
        withholdingReason: '   ',
      }),
    (err) => err instanceof DomainError && err.code === 'VALIDATION'
  );
});

test('upsertDepositDisposition: 403 when landlord does not own property', async () => {
  const db = makeDb([
    [/FROM lease_deposits/, [depositRow({ amount: 1000 })]],
    [/FROM leases/, [leaseRow()]],
    [/FROM properties/, []],
  ]);
  await assert.rejects(
    () =>
      upsertDepositDisposition(db, {
        actorUserId: OTHER_LANDLORD,
        actorRole: 'LANDLORD',
        depositId: DEPOSIT_ID,
        refundedAmount: 500,
        withheldAmount: 500,
        withholdingReason: 'damage',
      }),
    (err) => err instanceof DomainError && err.code === 'FORBIDDEN'
  );
});
