import test from 'node:test';
import assert from 'node:assert/strict';

import { listProperties } from '../dist/src/useCases/properties/listProperties.js';
import { getProperty } from '../dist/src/useCases/properties/getProperty.js';
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

  assert.match(capture.sql, /\(\$1 = 'ADMIN' OR created_by = \$2\)/);
  assert.deepEqual(capture.values, ['LANDLORD', 'landlord-user-id']);
});

test('admin property list query keeps unrestricted branch', async () => {
  const capture = {};
  const db = makeQueryable([], capture);

  await listProperties(db, {
    actorUserId: 'admin-user-id',
    actorRole: 'ADMIN',
  });

  assert.match(capture.sql, /\(\$1 = 'ADMIN' OR created_by = \$2\)/);
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
