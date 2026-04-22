import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNotificationContent } from '../dist/src/lib/notificationDispatch.js';

test('SUPPORT_TICKET_REPLY renders support-team reply content', () => {
  const c = buildNotificationContent(
    'SUPPORT_TICKET_REPLY',
    {
      support_ticket_id: 'ticket-1',
      recipient_user_id: 'user-1',
      message_id: 'msg-1',
      title: 'Login broken after update',
      preview: 'We identified the cause and pushed a fix. Please try again.',
    },
    null
  );
  assert.equal(c.title, 'Support team replied to your ticket');
  assert.ok(c.body.includes('Login broken after update'));
  assert.ok(c.body.includes('We identified the cause'));
  assert.equal(c.deepLink, '/portal/support?id=ticket-1');
  assert.equal(c.requestId, null);
  assert.equal(c.metadata.kind, 'support_ticket_reply');
  assert.equal(c.metadata.support_ticket_id, 'ticket-1');
  assert.equal(c.metadata.message_id, 'msg-1');
});

test('SUPPORT_TICKET_REPLY falls back gracefully when preview is missing', () => {
  const c = buildNotificationContent(
    'SUPPORT_TICKET_REPLY',
    { support_ticket_id: 'ticket-2', title: 'Question about billing' },
    null
  );
  assert.ok(c.body.includes('(No preview available.)'));
  assert.equal(c.deepLink, '/portal/support?id=ticket-2');
});

test('SUPPORT_TICKET_STATUS_CHANGED renders friendly status label in title + body', () => {
  const c = buildNotificationContent(
    'SUPPORT_TICKET_STATUS_CHANGED',
    {
      support_ticket_id: 'ticket-3',
      recipient_user_id: 'user-1',
      title: 'Dashboard chart empty',
      status: 'RESOLVED',
    },
    null
  );
  assert.equal(c.title, 'Support ticket resolved: Dashboard chart empty');
  assert.ok(c.body.includes('Dashboard chart empty'));
  assert.ok(c.body.includes('Resolved'));
  assert.equal(c.deepLink, '/portal/support?id=ticket-3');
  assert.equal(c.metadata.kind, 'support_ticket_status_changed');
  assert.equal(c.metadata.status, 'RESOLVED');
});

test('SUPPORT_TICKET_STATUS_CHANGED formats IN_PROGRESS with a space', () => {
  const c = buildNotificationContent(
    'SUPPORT_TICKET_STATUS_CHANGED',
    { support_ticket_id: 't', title: 'Any', status: 'IN_PROGRESS' },
    null
  );
  assert.ok(c.title.includes('in progress'));
  assert.ok(c.body.includes('In progress'));
});

test('SUPPORT_TICKET_ADMIN_NEW (new ticket) includes category, area, preview and deep-links to admin inbox', () => {
  const c = buildNotificationContent(
    'SUPPORT_TICKET_ADMIN_NEW',
    {
      support_ticket_id: 'ticket-4',
      submitter_user_id: 'user-5',
      title: 'Lease export fails',
      category: 'BUG',
      area: 'LEASES',
      description: 'Clicking export returns 500 after 10 seconds.',
    },
    null
  );
  assert.equal(c.title, 'New support ticket [BUG]: Lease export fails');
  assert.ok(c.body.includes('Category: BUG'));
  assert.ok(c.body.includes('Area: LEASES'));
  assert.ok(c.body.includes('Clicking export returns 500'));
  assert.equal(c.deepLink, '/portal/admin/support?id=ticket-4');
  assert.equal(c.metadata.kind, 'support_ticket_admin_new');
  assert.equal(c.metadata.event, 'new_ticket');
});

test('SUPPORT_TICKET_ADMIN_NEW (user reply) titles differently', () => {
  const c = buildNotificationContent(
    'SUPPORT_TICKET_ADMIN_NEW',
    {
      support_ticket_id: 'ticket-5',
      submitter_user_id: 'user-6',
      title: 'Password reset not arriving',
      event: 'user_reply',
      message_id: 'msg-99',
      preview: 'I tried again, still nothing.',
    },
    null
  );
  assert.equal(c.title, 'New user reply on support ticket: Password reset not arriving');
  assert.ok(c.body.includes('I tried again'));
  assert.equal(c.metadata.event, 'user_reply');
  assert.equal(c.metadata.message_id, 'msg-99');
});

test('SUPPORT_TICKET_ADMIN_NEW deep-links to admin inbox even without a ticket id', () => {
  const c = buildNotificationContent(
    'SUPPORT_TICKET_ADMIN_NEW',
    { title: 'Untitled' },
    null
  );
  assert.equal(c.deepLink, '/portal/admin/support');
});
