import test from 'node:test';
import assert from 'node:assert/strict';

import { listPublicApplyProperties } from '../dist/src/lib/propertiesRepo.js';

test('public apply query excludes deactivated landlord-owned properties', async () => {
  const capture = {};
  const db = {
    async query(sql, values) {
      capture.sql = sql;
      capture.values = values;
      return { rows: [], rowCount: 0 };
    },
  };

  const result = await listPublicApplyProperties(db);

  assert.deepEqual(result, []);
  assert.match(capture.sql, /LEFT JOIN users landlord/);
  assert.match(capture.sql, /landlord\.role = 'LANDLORD'/);
  assert.match(capture.sql, /\(landlord\.id IS NULL OR landlord\.status = 'ACTIVE'\)/);
  assert.equal(capture.values, undefined);
});
