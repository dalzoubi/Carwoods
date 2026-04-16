import test from 'node:test';
import assert from 'node:assert/strict';

import { listProperties } from '../dist/src/useCases/properties/listProperties.js';
import { getProperty } from '../dist/src/useCases/properties/getProperty.js';
import { updateProperty } from '../dist/src/useCases/properties/updateProperty.js';
import { createProperty } from '../dist/src/useCases/properties/createProperty.js';
import { createLease } from '../dist/src/useCases/leases/createLease.js';
import { DomainError } from '../dist/src/domain/errors.js';

function makeQueryable(rows, capture) {
  return {
    async query(sql, values) {
      capture.sql = sql;
      capture.values = values;
      return { rows, rowCount: rows.length };
    },
  };
}

test('landlord property list query is scoped to creator', async () => {
  const capture = {};
  const db = makeQueryable([], capture);

  await listProperties(db, {
    actorUserId: 'landlord-user-id',
    actorRole: 'LANDLORD',
  });

  assert.match(capture.sql, /\(\$1 = 'ADMIN' OR p\.created_by = \$2\)/);
  assert.deepEqual(capture.values, ['LANDLORD', 'landlord-user-id']);
});

test('admin property list query keeps unrestricted branch', async () => {
  const capture = {};
  const db = makeQueryable([], capture);

  await listProperties(db, {
    actorUserId: 'admin-user-id',
    actorRole: 'ADMIN',
  });

  assert.match(capture.sql, /\(\$1 = 'ADMIN' OR p\.created_by = \$2\)/);
  assert.deepEqual(capture.values, ['ADMIN', 'admin-user-id']);
});

test('non-owned property lookup resolves as not_found for landlord', async () => {
  const capture = {};
  const db = makeQueryable([], capture);

  await assert.rejects(
    getProperty(db, {
      propertyId: 'property-id',
      actorUserId: 'landlord-user-id',
      actorRole: 'LANDLORD',
    }),
    (error) => {
      assert.ok(error instanceof DomainError);
      assert.equal(error.code, 'NOT_FOUND');
      return true;
    }
  );

  assert.match(capture.sql, /\(\$2 = 'ADMIN' OR created_by = \$3\)/);
  assert.deepEqual(capture.values, ['property-id', 'LANDLORD', 'landlord-user-id']);
});

test('lease creation checks property visibility for landlord', async () => {
  const capture = {};
  const db = {
    async query(sql, values) {
      capture.sql = sql;
      capture.values = values;
      return { rows: [], rowCount: 0 };
    },
    async connect() {
      throw new Error('connect should not be called when property is not visible');
    },
  };

  await assert.rejects(
    createLease(db, {
      actorUserId: 'landlord-user-id',
      actorRole: 'LANDLORD',
      property_id: 'property-id',
      start_date: '2026-04-06',
      status: 'ACTIVE',
      end_date: null,
      month_to_month: false,
      notes: null,
    }),
    (error) => {
      assert.ok(error instanceof DomainError);
      assert.equal(error.code, 'NOT_FOUND');
      assert.equal(error.detail, 'property_not_found');
      return true;
    }
  );

  assert.match(capture.sql, /\(\$2 = 'ADMIN' OR created_by = \$3\)/);
  assert.deepEqual(capture.values, ['property-id', 'LANDLORD', 'landlord-user-id']);
});

test('createProperty rejects apply_visible when tier disallows Apply page visibility', async () => {
  const db = {
    async query(sql, values) {
      if (/FROM users WHERE id = \$1/i.test(sql)) {
        return {
          rows: [
            {
              id: values[0],
              external_auth_oid: 'oid',
              email: 'l@example.com',
              first_name: 'L',
              last_name: 'L',
              phone: null,
              profile_photo_storage_path: null,
              role: 'LANDLORD',
              status: 'ACTIVE',
              ui_language: null,
              ui_color_scheme: null,
              portal_tour_completed: false,
              tier_id: 'tier-free',
            },
          ],
          rowCount: 1,
        };
      }
      if (/FROM subscription_tiers WHERE id = \$1/i.test(sql)) {
        return {
          rows: [
            {
              id: 'tier-free',
              name: 'FREE',
              display_name: 'Free',
              description: null,
              is_active: true,
              created_at: new Date(),
              max_properties: 10,
              max_tenants: 10,
              ai_routing_enabled: false,
              csv_export_enabled: false,
              custom_notifications_enabled: false,
              notification_email_enabled: false,
              notification_sms_enabled: false,
              maintenance_request_history_days: 90,
              request_photo_video_attachments_enabled: false,
              property_apply_visibility_editable: false,
              property_elsa_auto_send_editable: false,
            },
          ],
          rowCount: 1,
        };
      }
      if (/COUNT\(\*\)\s+AS c/i.test(sql) && /FROM properties/i.test(sql)) {
        return { rows: [{ c: 0 }], rowCount: 1 };
      }
      throw new Error(`unexpected sql in createProperty test: ${sql}`);
    },
    async connect() {
      throw new Error('connect should not run when apply_visible is rejected');
    },
  };

  await assert.rejects(
    createProperty(db, {
      actorUserId: 'landlord-1',
      actorRole: 'LANDLORD',
      street: '1 Main St',
      city: 'Houston',
      state: 'TX',
      zip: '77001',
      apply_visible: true,
    }),
    (error) => {
      assert.ok(error instanceof DomainError);
      assert.equal(error.code, 'VALIDATION');
      assert.equal(error.message, 'subscription_feature_not_available');
      return true;
    }
  );
});

test('landlord cannot reassign property landlord on update', async () => {
  const db = {
    async query(sql, values) {
      // current property lookup for actor visibility
      if (/FROM properties/.test(sql)) {
        return {
          rows: [{
            id: 'property-id',
            name: null,
            street: '123 Main St',
            city: 'Houston',
            state: 'TX',
            zip: '77001',
            har_listing_id: null,
            listing_source: 'MANUAL',
            apply_visible: true,
            metadata: {},
            har_sync_status: null,
            har_sync_error: null,
            har_last_synced_at: null,
            created_at: new Date('2026-01-01T00:00:00Z'),
            updated_at: new Date('2026-01-01T00:00:00Z'),
            deleted_at: null,
            created_by: 'landlord-user-id',
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0, sql, values };
    },
    async connect() {
      throw new Error('connect should not be called when forbidden');
    },
  };

  await assert.rejects(
    updateProperty(db, {
      propertyId: 'property-id',
      actorUserId: 'landlord-user-id',
      actorRole: 'LANDLORD',
      landlord_user_id: 'other-landlord-id',
      landlord_user_id_present: true,
    }),
    (error) => {
      assert.ok(error instanceof DomainError);
      assert.equal(error.code, 'FORBIDDEN');
      return true;
    }
  );
});
