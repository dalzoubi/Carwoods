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
  let queryCount = 0;
  const db = {
    async query(sql) {
      queryCount += 1;
      if (queryCount === 1 && /FROM users\s+WHERE LOWER\(email\) = \$1/i.test(sql)) {
        return { rows: [], rowCount: 0 };
      }
      if (queryCount === 2 && /UPDATE users/i.test(sql)) {
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
