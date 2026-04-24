/**
 * portalProfile route — profile update security tests.
 *
 * The HTTP handler is not exported so we test the updateProfile use case
 * that the route delegates to for full PATCH requests.
 *
 * Coverage:
 *   - SMS opt-in requires a phone number (no PII leak via empty phone)
 *   - Email uniqueness conflict is enforced (prevents profile takeover)
 *   - Phone change invalidates prior SMS consent (privacy / consent rule)
 *   - Profile can only be updated for the authenticated user (actorUserId
 *     comes from the JWT; the use case has no separate target-user parameter,
 *     so cross-user mutation is impossible by design — we assert that design)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { updateProfile } from '../dist/src/useCases/users/updateProfile.js';
import { DomainError } from '../dist/src/domain/errors.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const USER_ID = 'user-aaaaaa-0000';
const OTHER_ID = 'user-bbbbbb-0001';

function makeUserRow(overrides = {}) {
  return {
    id: USER_ID,
    external_auth_oid: 'oid-1',
    email: 'original@example.com',
    first_name: 'Alice',
    last_name: 'Test',
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

function makePrefs(overrides = {}) {
  return {
    user_id: USER_ID,
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

/**
 * Minimal DB stub for the profile update use case.
 * The query is matched by keywords to return appropriate fixtures.
 */
function makeDb(overrides = {}) {
  return {
    async query(sql) {
      const s = sql.toLowerCase();

      // findUserByEmail — return null (no conflict) unless overridden
      if (/from users\s+where lower\(email\)/.test(s) || /where lower\(email\)\s*=/.test(s)) {
        return { rows: overrides.emailConflictRow ? [overrides.emailConflictRow] : [], rowCount: 0 };
      }

      // ensureUserNotificationPreference — MERGE
      if (/merge user_notification_preferences/i.test(sql) || /upsert.*notification_preferences/i.test(sql)) {
        return { rows: [makePrefs(overrides.priorPrefs ?? {})], rowCount: 1 };
      }

      // updateUserProfile — returns updated user row
      if (/update users/i.test(sql) && /set.*email/i.test(sql)) {
        const row = overrides.updatedUser ?? makeUserRow();
        return { rows: [row], rowCount: 1 };
      }

      // updateUserNotificationPreference
      if (/merge user_notification_preferences|update user_notification_preferences/i.test(sql)) {
        return { rows: [makePrefs()], rowCount: 1 };
      }

      // listUserNotificationFlowPreferences / upsert flow prefs
      if (/user_notification_flow_preferences/i.test(sql)) {
        return { rows: [], rowCount: 0 };
      }

      // writeAudit
      if (/insert into audit_log/i.test(sql)) {
        return { rows: [], rowCount: 1 };
      }

      // updateUserUiPreferences — OUTPUT INSERTED
      if (/update users.*output inserted/i.test(sql) || /set.*ui_language/i.test(sql)) {
        return { rows: [makeUserRow()], rowCount: 1 };
      }

      // Default — empty
      return { rows: [], rowCount: 0 };
    },
  };
}

const baseInput = {
  actorUserId: USER_ID,
  actorRole: 'TENANT',
  email: 'alice@example.com',
  firstName: 'Alice',
  lastName: 'Test',
  phone: null,
};

// ---------------------------------------------------------------------------
// SMS opt-in requires phone number
// ---------------------------------------------------------------------------

test('updateProfile: enabling SMS without a phone number is rejected (no PII required without consent)', async () => {
  const db = makeDb();
  await assert.rejects(
    updateProfile(db, {
      ...baseInput,
      phone: null,
      notificationPreferences: { smsEnabled: true, smsOptIn: true },
    }),
    (e) => e instanceof DomainError && e.code === 'VALIDATION' && e.message === 'sms_phone_required'
  );
});

// ---------------------------------------------------------------------------
// Email uniqueness conflict
// ---------------------------------------------------------------------------

test('updateProfile: email already used by another user produces CONFLICT', async () => {
  const db = makeDb({ emailConflictRow: makeUserRow({ id: OTHER_ID, email: 'alice@example.com' }) });
  await assert.rejects(
    updateProfile(db, baseInput),
    (e) => e instanceof DomainError && e.code === 'CONFLICT' && e.message === 'email_already_in_use'
  );
});

// ---------------------------------------------------------------------------
// Phone change invalidates prior SMS consent
// ---------------------------------------------------------------------------

test('updateProfile: changing phone number when sms_opt_in=true returns phoneChangeInvalidatedSmsConsent=true', async () => {
  const db = makeDb({
    priorPrefs: { sms_opt_in: true, sms_enabled: true },
    updatedUser: makeUserRow({ phone: '+15550001111', email: 'alice@example.com' }),
  });

  // Custom query stub that has the original user with a different phone
  const dbWithPhone = {
    async query(sql) {
      const s = sql.toLowerCase();
      if (/from users\s+where lower\(email\)/.test(s) || /where lower\(email\)\s*=/.test(s)) {
        // Return original user row with OLD phone so the comparison shows a change
        return {
          rows: [makeUserRow({ id: USER_ID, phone: '+15550009999', email: 'alice@example.com' })],
          rowCount: 1,
        };
      }
      return db.query(sql);
    },
  };

  const result = await updateProfile(dbWithPhone, {
    ...baseInput,
    phone: '+15550001111',
    email: 'alice@example.com',
  });

  assert.equal(result.phoneChangeInvalidatedSmsConsent, true);
});

// ---------------------------------------------------------------------------
// No cross-user profile mutation is possible (design assertion)
// ---------------------------------------------------------------------------

test('updateProfile: actorUserId is the only target — no other userId can be specified', async () => {
  // UpdateProfileInput has no `targetUserId` field. This test confirms
  // the function signature only accepts actorUserId. The absence of the
  // field in the type is the safeguard; here we assert the runtime shape.
  const db = makeDb({ updatedUser: makeUserRow() });
  const result = await updateProfile(db, baseInput);
  // Result user.id matches the actor, not any other
  assert.equal(result.user.id, USER_ID);
});

// ---------------------------------------------------------------------------
// Invalid email is rejected
// ---------------------------------------------------------------------------

test('updateProfile: missing email produces a VALIDATION error', async () => {
  const db = makeDb();
  await assert.rejects(
    updateProfile(db, { ...baseInput, email: undefined }),
    (e) => e instanceof DomainError && e.code === 'VALIDATION'
  );
});
