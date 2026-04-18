import test from 'node:test';
import assert from 'node:assert/strict';

import { giveNotice } from '../dist/src/useCases/tenants/giveNotice.js';
import { coSignNotice } from '../dist/src/useCases/tenants/coSignNotice.js';
import { withdrawNotice } from '../dist/src/useCases/tenants/withdrawNotice.js';
import { respondToNotice } from '../dist/src/useCases/tenants/respondToNotice.js';
import { getLeaseNotices } from '../dist/src/useCases/tenants/getLeaseNotices.js';
import { DomainError } from '../dist/src/domain/errors.js';

const LEASE_ID = '00000000-0000-0000-0000-0000000000aa';
const PROP_ID = '00000000-0000-0000-0000-0000000000bb';
const LANDLORD_ID = '00000000-0000-0000-0000-0000000000cc';
const TENANT_ID = '00000000-0000-0000-0000-0000000000dd';
const OTHER_TENANT_ID = '00000000-0000-0000-0000-0000000000ee';
const NOTICE_ID = '00000000-0000-0000-0000-0000000000ff';

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

function leaseRow(overrides = {}) {
  return {
    id: LEASE_ID,
    property_id: PROP_ID,
    status: 'ACTIVE',
    deleted_at: null,
    ...overrides,
  };
}

function noticeRow(overrides = {}) {
  return {
    id: NOTICE_ID,
    lease_id: LEASE_ID,
    given_by_user_id: TENANT_ID,
    status: 'pending_co_signers',
    scope: 'all_tenants',
    early_termination: false,
    ...overrides,
  };
}

function propRow(overrides = {}) {
  return { id: PROP_ID, created_by: LANDLORD_ID, deleted_at: null, ...overrides };
}

// ---------------------------------------------------------------------------
// giveNotice
// ---------------------------------------------------------------------------

test('giveNotice: rejects missing lease id', async () => {
  await assert.rejects(
    giveNotice(makeDb(), {
      actorUserId: TENANT_ID,
      leaseId: ' ',
      plannedMoveOutDate: '2026-05-01',
      scope: 'all_tenants',
    }),
    (e) => e instanceof DomainError && e.message === 'missing_lease_id'
  );
});

test('giveNotice: rejects bad planned_move_out_date', async () => {
  await assert.rejects(
    giveNotice(makeDb(), {
      actorUserId: TENANT_ID,
      leaseId: LEASE_ID,
      plannedMoveOutDate: 'tomorrow',
      scope: 'all_tenants',
    }),
    (e) => e instanceof DomainError && e.message === 'invalid_planned_move_out_date'
  );
});

test('giveNotice: rejects invalid scope', async () => {
  await assert.rejects(
    giveNotice(makeDb(), {
      actorUserId: TENANT_ID,
      leaseId: LEASE_ID,
      plannedMoveOutDate: '2026-05-01',
      scope: 'bogus',
    }),
    (e) => e instanceof DomainError && e.message === 'invalid_scope'
  );
});

test('giveNotice: 404 if lease missing', async () => {
  const db = makeDb([[/FROM leases WHERE id = \$1/, []]]);
  await assert.rejects(
    giveNotice(db, {
      actorUserId: TENANT_ID,
      leaseId: LEASE_ID,
      plannedMoveOutDate: '2026-05-01',
      scope: 'self_only',
    }),
    (e) => e instanceof DomainError && e.detail === 'lease_not_found'
  );
});

test('giveNotice: rejects if lease already ended', async () => {
  const db = makeDb([[/FROM leases WHERE id = \$1/, [leaseRow({ status: 'ENDED' })]]]);
  await assert.rejects(
    giveNotice(db, {
      actorUserId: TENANT_ID,
      leaseId: LEASE_ID,
      plannedMoveOutDate: '2026-05-01',
      scope: 'self_only',
    }),
    (e) => e instanceof DomainError && e.message === 'lease_already_ended'
  );
});

test('giveNotice: 403 if actor not on lease', async () => {
  const db = makeDb([
    [/FROM leases WHERE id = \$1/, [leaseRow()]],
    [/FROM lease_tenants WHERE lease_id/, [{ user_id: OTHER_TENANT_ID }]],
  ]);
  await assert.rejects(
    giveNotice(db, {
      actorUserId: TENANT_ID,
      leaseId: LEASE_ID,
      plannedMoveOutDate: '2026-05-01',
      scope: 'self_only',
    }),
    (e) => e instanceof DomainError && e.code === 'FORBIDDEN'
  );
});

test('giveNotice: 409 if live notice already exists', async () => {
  const db = makeDb([
    [/FROM leases WHERE id = \$1/, [leaseRow()]],
    [/FROM lease_tenants WHERE lease_id/, [{ user_id: TENANT_ID }]],
    [/FROM lease_notices\s+WHERE lease_id = \$1\s+AND status NOT IN/, [noticeRow()]],
  ]);
  await assert.rejects(
    giveNotice(db, {
      actorUserId: TENANT_ID,
      leaseId: LEASE_ID,
      plannedMoveOutDate: '2026-05-01',
      scope: 'self_only',
    }),
    (e) => e instanceof DomainError && e.code === 'CONFLICT'
  );
});

// ---------------------------------------------------------------------------
// coSignNotice
// ---------------------------------------------------------------------------

test('coSignNotice: rejects missing notice id', async () => {
  await assert.rejects(
    coSignNotice(makeDb(), { actorUserId: OTHER_TENANT_ID, noticeId: '' }),
    (e) => e instanceof DomainError && e.message === 'missing_notice_id'
  );
});

test('coSignNotice: 404 if notice missing', async () => {
  const db = makeDb([[/FROM lease_notices WHERE id = \$1/, []]]);
  await assert.rejects(
    coSignNotice(db, { actorUserId: OTHER_TENANT_ID, noticeId: NOTICE_ID }),
    (e) => e instanceof DomainError && e.detail === 'notice_not_found'
  );
});

test('coSignNotice: 409 if notice not awaiting co-signers', async () => {
  const db = makeDb([
    [/FROM lease_notices WHERE id = \$1/, [noticeRow({ status: 'accepted' })]],
  ]);
  await assert.rejects(
    coSignNotice(db, { actorUserId: OTHER_TENANT_ID, noticeId: NOTICE_ID }),
    (e) => e instanceof DomainError && e.code === 'CONFLICT'
  );
});

// ---------------------------------------------------------------------------
// withdrawNotice
// ---------------------------------------------------------------------------

test('withdrawNotice: 403 if actor is not the notice author', async () => {
  const db = makeDb([
    [/FROM lease_notices WHERE id = \$1/, [noticeRow({ given_by_user_id: TENANT_ID })]],
  ]);
  await assert.rejects(
    withdrawNotice(db, { actorUserId: OTHER_TENANT_ID, noticeId: NOTICE_ID }),
    (e) => e instanceof DomainError && e.code === 'FORBIDDEN'
  );
});

test('withdrawNotice: 409 if notice not live', async () => {
  const db = makeDb([
    [
      /FROM lease_notices WHERE id = \$1/,
      [noticeRow({ given_by_user_id: TENANT_ID, status: 'accepted' })],
    ],
  ]);
  await assert.rejects(
    withdrawNotice(db, { actorUserId: TENANT_ID, noticeId: NOTICE_ID }),
    (e) => e instanceof DomainError && e.code === 'CONFLICT'
  );
});

// ---------------------------------------------------------------------------
// respondToNotice
// ---------------------------------------------------------------------------

test('respondToNotice: forbids non-landlord', async () => {
  await assert.rejects(
    respondToNotice(makeDb(), {
      actorUserId: TENANT_ID,
      actorRole: 'TENANT',
      noticeId: NOTICE_ID,
      decision: 'accept',
    }),
    (e) => e instanceof DomainError && e.code === 'FORBIDDEN'
  );
});

test('respondToNotice: rejects invalid decision', async () => {
  await assert.rejects(
    respondToNotice(makeDb(), {
      actorUserId: LANDLORD_ID,
      actorRole: 'LANDLORD',
      noticeId: NOTICE_ID,
      decision: 'maybe',
    }),
    (e) => e instanceof DomainError && e.message === 'invalid_decision'
  );
});

test('respondToNotice: 409 if notice not awaiting landlord', async () => {
  const db = makeDb([
    [
      /FROM lease_notices WHERE id = \$1/,
      [noticeRow({ status: 'pending_co_signers' })],
    ],
  ]);
  await assert.rejects(
    respondToNotice(db, {
      actorUserId: LANDLORD_ID,
      actorRole: 'LANDLORD',
      noticeId: NOTICE_ID,
      decision: 'accept',
    }),
    (e) => e instanceof DomainError && e.code === 'CONFLICT'
  );
});

test('respondToNotice: counter requires a valid counter_date', async () => {
  const db = makeDb([
    [
      /FROM lease_notices WHERE id = \$1/,
      [noticeRow({ status: 'pending_landlord' })],
    ],
    [/FROM leases WHERE id = \$1/, [leaseRow()]],
    [/FROM properties/, [propRow()]],
  ]);
  await assert.rejects(
    respondToNotice(db, {
      actorUserId: LANDLORD_ID,
      actorRole: 'LANDLORD',
      noticeId: NOTICE_ID,
      decision: 'counter',
      counterDate: 'not-a-date',
    }),
    (e) => e instanceof DomainError && e.message === 'invalid_counter_date'
  );
});

// ---------------------------------------------------------------------------
// getLeaseNotices
// ---------------------------------------------------------------------------

test('getLeaseNotices: rejects missing lease id', async () => {
  await assert.rejects(
    getLeaseNotices(makeDb(), {
      actorUserId: TENANT_ID,
      actorRole: 'TENANT',
      leaseId: '',
    }),
    (e) => e instanceof DomainError && e.message === 'missing_lease_id'
  );
});

test('getLeaseNotices: tenant not on lease is forbidden', async () => {
  const db = makeDb([
    [/FROM leases WHERE id = \$1/, [leaseRow()]],
    [/FROM lease_tenants WHERE lease_id/, [{ user_id: OTHER_TENANT_ID }]],
  ]);
  await assert.rejects(
    getLeaseNotices(db, {
      actorUserId: TENANT_ID,
      actorRole: 'TENANT',
      leaseId: LEASE_ID,
    }),
    (e) => e instanceof DomainError && e.code === 'FORBIDDEN'
  );
});

test('getLeaseNotices: tenant on lease receives history', async () => {
  const db = makeDb([
    [/FROM leases WHERE id = \$1/, [leaseRow()]],
    [/FROM lease_tenants WHERE lease_id/, [{ user_id: TENANT_ID }]],
    [/FROM lease_notices\s+WHERE lease_id = \$1\s+AND status NOT IN/, []],
    [/FROM lease_notices WHERE lease_id = \$1 ORDER BY created_at DESC/, [noticeRow()]],
  ]);
  const result = await getLeaseNotices(db, {
    actorUserId: TENANT_ID,
    actorRole: 'TENANT',
    leaseId: LEASE_ID,
  });
  assert.equal(result.live_notice, null);
  assert.equal(result.history.length, 1);
  assert.deepEqual(result.live_co_signs, []);
});
