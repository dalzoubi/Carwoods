import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNotificationContent } from '../dist/src/lib/notificationDispatch.js';

const BASE_PAYLOAD = {
  notice_id: 'notice-1',
  lease_id: 'lease-1',
  planned_move_out_date: '2026-06-01',
  property_street: '123 Main St',
  property_city: 'Austin',
  property_state: 'TX',
  property_zip: '78701',
};

test('LEASE_NOTICE_GIVEN builds landlord-facing content with address + planned date', () => {
  const c = buildNotificationContent('LEASE_NOTICE_GIVEN', BASE_PAYLOAD, null);
  assert.equal(c.title, 'Move-out notice received');
  assert.ok(c.body.includes('123 Main St, Austin, TX, 78701'));
  assert.ok(c.body.includes('2026-06-01'));
  assert.equal(c.deepLink, '/portal/notices');
  assert.equal(c.requestId, null);
  assert.equal(c.metadata.kind, 'lease_notice_given');
  assert.equal(c.metadata.notice_id, 'notice-1');
});

test('LEASE_NOTICE_CO_SIGNED notes all co-tenants signed', () => {
  const c = buildNotificationContent('LEASE_NOTICE_CO_SIGNED', BASE_PAYLOAD, null);
  assert.equal(c.title, 'Move-out notice fully signed');
  assert.ok(c.body.includes('All co-tenants'));
  assert.equal(c.deepLink, '/portal/notices');
  assert.equal(c.metadata.kind, 'lease_notice_co_signed');
});

test('LEASE_NOTICE_RESPONDED accept path', () => {
  const c = buildNotificationContent(
    'LEASE_NOTICE_RESPONDED',
    { ...BASE_PAYLOAD, decision: 'accept' },
    null
  );
  assert.ok(c.body.includes('accepted'));
  assert.equal(c.deepLink, '/portal/my-lease');
  assert.equal(c.metadata.decision, 'accept');
});

test('LEASE_NOTICE_RESPONDED reject path', () => {
  const c = buildNotificationContent(
    'LEASE_NOTICE_RESPONDED',
    { ...BASE_PAYLOAD, decision: 'reject' },
    null
  );
  assert.ok(c.body.includes('rejected'));
  assert.equal(c.metadata.decision, 'reject');
});

test('LEASE_NOTICE_RESPONDED counter path includes counter_date', () => {
  const c = buildNotificationContent(
    'LEASE_NOTICE_RESPONDED',
    { ...BASE_PAYLOAD, decision: 'counter', counter_date: '2026-07-01' },
    null
  );
  assert.ok(c.body.includes('proposed'));
  assert.ok(c.body.includes('2026-07-01'));
  assert.equal(c.metadata.decision, 'counter');
});

test('LEASE_NOTICE_WITHDRAWN body identifies tenant withdrawal', () => {
  const c = buildNotificationContent('LEASE_NOTICE_WITHDRAWN', BASE_PAYLOAD, null);
  assert.equal(c.title, 'Move-out notice withdrawn');
  assert.ok(c.body.includes('withdrawn'));
  assert.equal(c.deepLink, '/portal/notices');
  assert.equal(c.metadata.kind, 'lease_notice_withdrawn');
});

test('falls back to "your lease" when address parts are absent', () => {
  const c = buildNotificationContent(
    'LEASE_NOTICE_GIVEN',
    { notice_id: 'n', lease_id: 'l', planned_move_out_date: '2026-06-01' },
    null
  );
  assert.ok(c.body.includes('your lease'));
});
