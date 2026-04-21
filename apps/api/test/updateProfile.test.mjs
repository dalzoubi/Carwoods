import test from 'node:test';
import assert from 'node:assert/strict';

import { updateProfile } from '../dist/src/useCases/users/updateProfile.js';
import { DomainError } from '../dist/src/domain/errors.js';

function makeUserRow(overrides = {}) {
  return {
    id: 'user-1',
    external_auth_oid: 'oid-1',
    email: 'existing@example.com',
    first_name: null,
    last_name: null,
    phone: null,
    profile_photo_storage_path: null,
    role: 'TENANT',
    status: 'ACTIVE',
    ui_language: null,
    ui_color_scheme: null,
    portal_tour_completed: false,
    tier_id: null,
    ...overrides,
  };
}

test('updateProfile rejects when target email belongs to another user', async () => {
  const db = {
    async query(sql) {
      if (/FROM users\s+WHERE LOWER\(email\) = \$1/i.test(sql)) {
        return { rows: [makeUserRow({ id: 'other-user' })], rowCount: 1 };
      }
      throw new Error('update should not execute when email is already used');
    },
  };

  await assert.rejects(
    updateProfile(db, {
      actorUserId: 'actor-user',
      actorRole: 'TENANT',
      email: 'duplicate@example.com',
      firstName: 'Test',
      lastName: 'User',
      phone: '555-010-0000',
    }),
    (error) => {
      assert.ok(error instanceof DomainError);
      assert.equal(error.code, 'CONFLICT');
      assert.equal(error.message, 'email_already_in_use');
      return true;
    }
  );
});

test('updateProfile maps DB unique-email race condition to conflict', async () => {
  const db = {
    async query(sql) {
      if (/FROM users\s+WHERE LOWER\(email\) = \$1/i.test(sql)) {
        return { rows: [], rowCount: 0 };
      }
      if (/MERGE user_notification_preferences/i.test(sql)) {
        return {
          rows: [
            {
              user_id: 'actor-user',
              email_enabled: true,
              in_app_enabled: true,
              sms_enabled: false,
              sms_opt_in: false,
              quiet_hours_timezone: null,
              quiet_hours_start_minute: null,
              quiet_hours_end_minute: null,
              sms_opt_in_at: null,
              sms_opt_in_source: null,
              sms_opt_in_version: null,
              sms_opt_in_ip: null,
              sms_opt_in_user_agent: null,
              sms_opt_in_phone: null,
              sms_opt_out_at: null,
              sms_opt_out_source: null,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
          rowCount: 1,
        };
      }
      if (/UPDATE users/i.test(sql)) {
        throw new Error("Violation of UNIQUE KEY constraint 'uq_users_email'.");
      }
      throw new Error(`Unexpected query execution: ${sql}`);
    },
  };

  await assert.rejects(
    updateProfile(db, {
      actorUserId: 'actor-user',
      actorRole: 'TENANT',
      email: 'taken@example.com',
      firstName: 'Test',
      lastName: 'User',
      phone: '555-010-0000',
    }),
    (error) => {
      assert.ok(error instanceof DomainError);
      assert.equal(error.code, 'CONFLICT');
      assert.equal(error.message, 'email_already_in_use');
      return true;
    }
  );
});

test('updateProfile persists portalTourCompleted alongside core profile fields', async () => {
  let sawPortalTourUpdate = false;
  const selfRow = makeUserRow({
    id: 'actor-user',
    email: 'self@example.com',
    portal_tour_completed: false,
  });
  const afterTourRow = { ...selfRow, portal_tour_completed: true };
  const db = {
    async query(sql) {
      if (/FROM users\s+WHERE LOWER\(email\) = \$1/i.test(sql)) {
        return { rows: [selfRow], rowCount: 1 };
      }
      if (/UPDATE users/i.test(sql) && /SET email = \$2/i.test(sql)) {
        return { rows: [selfRow], rowCount: 1 };
      }
      if (/UPDATE users/i.test(sql) && /portal_tour_completed =/i.test(sql)) {
        sawPortalTourUpdate = true;
        return { rows: [afterTourRow], rowCount: 1 };
      }
      if (/MERGE user_notification_preferences/i.test(sql)) {
        return {
          rows: [
            {
              user_id: 'actor-user',
              email_enabled: true,
              in_app_enabled: true,
              sms_enabled: false,
              sms_opt_in: false,
              quiet_hours_timezone: null,
              quiet_hours_start_minute: null,
              quiet_hours_end_minute: null,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
          rowCount: 1,
        };
      }
      if (/FROM user_notification_flow_preferences/i.test(sql)) {
        return { rows: [], rowCount: 0 };
      }
      throw new Error(`Unexpected query: ${String(sql).slice(0, 160)}`);
    },
  };

  const out = await updateProfile(db, {
    actorUserId: 'actor-user',
    actorRole: 'TENANT',
    email: 'self@example.com',
    firstName: 'Test',
    lastName: 'User',
    phone: '555-010-0000',
    portalTourCompleted: true,
  });

  assert.equal(sawPortalTourUpdate, true);
  assert.equal(out.user.portal_tour_completed, true);
});

test('updateProfile requires phone when SMS notifications are enabled', async () => {
  const db = {
    async query(sql) {
      if (/FROM users\s+WHERE LOWER\(email\) = \$1/i.test(sql)) {
        return { rows: [makeUserRow({ id: 'actor-user', email: 'self@example.com' })], rowCount: 1 };
      }
      throw new Error(`Unexpected query execution: ${sql}`);
    },
  };

  await assert.rejects(
    updateProfile(db, {
      actorUserId: 'actor-user',
      actorRole: 'TENANT',
      email: 'self@example.com',
      firstName: 'Test',
      lastName: 'User',
      phone: null,
      notificationPreferences: {
        smsEnabled: true,
        smsOptIn: true,
      },
    }),
    (error) => {
      assert.ok(error instanceof DomainError);
      assert.equal(error.code, 'VALIDATION');
      assert.equal(error.message, 'sms_phone_required');
      return true;
    }
  );
});

function makeNotificationPrefRow(overrides = {}) {
  return {
    user_id: 'actor-user',
    email_enabled: true,
    in_app_enabled: true,
    sms_enabled: false,
    sms_opt_in: false,
    quiet_hours_timezone: null,
    quiet_hours_start_minute: null,
    quiet_hours_end_minute: null,
    sms_opt_in_at: null,
    sms_opt_in_source: null,
    sms_opt_in_version: null,
    sms_opt_in_ip: null,
    sms_opt_in_user_agent: null,
    sms_opt_in_phone: null,
    sms_opt_out_at: null,
    sms_opt_out_source: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeConsentMockDb({ priorUser, priorPref }) {
  const calls = {
    smsConsentUpdates: [],
    auditInserts: [],
  };
  const db = {
    async query(sql, values) {
      if (/FROM users\s+WHERE LOWER\(email\) = \$1/i.test(sql)) {
        return { rows: priorUser ? [priorUser] : [], rowCount: priorUser ? 1 : 0 };
      }
      if (/MERGE user_notification_preferences/i.test(sql)) {
        return { rows: [priorPref], rowCount: 1 };
      }
      if (/UPDATE users/i.test(sql)) {
        return { rows: [priorUser ?? makeUserRow({ id: 'actor-user', email: 'self@example.com' })], rowCount: 1 };
      }
      if (/UPDATE user_notification_preferences/i.test(sql) && /sms_opt_in_at/i.test(sql)) {
        calls.smsConsentUpdates.push({ sql, values });
        return { rows: [], rowCount: 1 };
      }
      if (/UPDATE user_notification_preferences/i.test(sql) && /sms_opt_out_at/i.test(sql)) {
        calls.smsConsentUpdates.push({ sql, values, optOut: true });
        return { rows: [], rowCount: 1 };
      }
      if (/UPDATE user_notification_preferences/i.test(sql)) {
        return { rows: [], rowCount: 1 };
      }
      if (/SELECT[\s\S]+FROM user_notification_preferences[\s\S]+WHERE user_id/i.test(sql)) {
        return { rows: [priorPref], rowCount: 1 };
      }
      if (/FROM user_notification_flow_preferences/i.test(sql)) {
        return { rows: [], rowCount: 0 };
      }
      if (/INSERT INTO audit_log/i.test(sql)) {
        calls.auditInserts.push({ values });
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  };
  return { db, calls };
}

test('updateProfile records consent capture + audit when opting in explicitly', async () => {
  const priorUser = makeUserRow({ id: 'actor-user', email: 'self@example.com', phone: '555-010-0000' });
  const priorPref = makeNotificationPrefRow({ sms_opt_in: false, sms_enabled: false });
  const { db, calls } = makeConsentMockDb({ priorUser, priorPref });

  const out = await updateProfile(db, {
    actorUserId: 'actor-user',
    actorRole: 'TENANT',
    email: 'self@example.com',
    firstName: 'Test',
    lastName: 'User',
    phone: '555-010-0000',
    notificationPreferences: { smsEnabled: true, smsOptIn: true },
    smsOptInConsent: {
      source: 'WEB_PORTAL_PROFILE',
      version: '2026-04-21.v1',
      ip: '203.0.113.9',
      userAgent: 'Mozilla/5.0 test',
    },
  });

  assert.equal(out.phoneChangeInvalidatedSmsConsent, false);
  const optInUpdate = calls.smsConsentUpdates.find((c) => !c.optOut);
  assert.ok(optInUpdate, 'expected an sms_opt_in UPDATE');
  assert.deepEqual(
    optInUpdate.values.slice(2),
    ['WEB_PORTAL_PROFILE', '2026-04-21.v1', '555-010-0000', '203.0.113.9', 'Mozilla/5.0 test']
  );
  assert.ok(
    calls.auditInserts.some((c) => c.values[3] === 'SMS_OPT_IN_ENABLED'),
    'expected audit row for SMS_OPT_IN_ENABLED'
  );
});

test('updateProfile refuses to re-enable SMS without fresh consent when phone changes', async () => {
  const priorUser = makeUserRow({ id: 'actor-user', email: 'self@example.com', phone: '555-010-0000' });
  const priorPref = makeNotificationPrefRow({ sms_opt_in: true, sms_enabled: true });
  const { db, calls } = makeConsentMockDb({ priorUser, priorPref });

  const out = await updateProfile(db, {
    actorUserId: 'actor-user',
    actorRole: 'TENANT',
    email: 'self@example.com',
    firstName: 'Test',
    lastName: 'User',
    phone: '555-010-9999',
    notificationPreferences: { smsEnabled: true, smsOptIn: true },
    // No smsOptInConsent block — phone changed so consent is invalidated.
  });

  assert.equal(out.phoneChangeInvalidatedSmsConsent, true);
  // No opt-in UPDATE should have happened (consent not re-captured).
  assert.ok(
    !calls.smsConsentUpdates.some((c) => !c.optOut),
    'expected no sms_opt_in UPDATE since consent was not re-captured'
  );
  // Should have written opt-out (the true → false transition).
  assert.ok(
    calls.smsConsentUpdates.some((c) => c.optOut),
    'expected opt-out UPDATE when phone change invalidates consent'
  );
  // Phone-change audit row recorded.
  assert.ok(
    calls.auditInserts.some((c) => c.values[3] === 'SMS_OPT_IN_PHONE_CHANGE_RESET'),
    'expected SMS_OPT_IN_PHONE_CHANGE_RESET audit row'
  );
});

test('updateProfile disabling SMS writes opt-out audit and capture', async () => {
  const priorUser = makeUserRow({ id: 'actor-user', email: 'self@example.com', phone: '555-010-0000' });
  const priorPref = makeNotificationPrefRow({ sms_opt_in: true, sms_enabled: true });
  const { db, calls } = makeConsentMockDb({ priorUser, priorPref });

  await updateProfile(db, {
    actorUserId: 'actor-user',
    actorRole: 'TENANT',
    email: 'self@example.com',
    firstName: 'Test',
    lastName: 'User',
    phone: '555-010-0000',
    notificationPreferences: { smsEnabled: false, smsOptIn: false },
  });

  assert.ok(
    calls.smsConsentUpdates.some((c) => c.optOut),
    'expected an sms_opt_out UPDATE'
  );
  assert.ok(
    calls.auditInserts.some((c) => c.values[3] === 'SMS_OPT_IN_DISABLED'),
    'expected SMS_OPT_IN_DISABLED audit row'
  );
});
