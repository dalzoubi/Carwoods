import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureManagementUser, UserRole } from '../dist/src/lib/usersRepo.js';

test('ensureManagementUser normalizes claim email to lowercase', async () => {
  let capturedValues = null;
  const client = {
    async query(_sql, values) {
      capturedValues = values;
      return {
        rows: [{
          id: 'user-id',
          external_auth_oid: 'sub-1',
          email: 'agent.user@carwoods.com',
          first_name: 'Agent',
          last_name: 'User',
          phone: null,
          role: 'ADMIN',
          status: 'ACTIVE',
        }],
        rowCount: 1,
      };
    },
  };

  await ensureManagementUser(
    client,
    {
      sub: 'sub-1',
      email: 'Agent.User@Carwoods.COM',
      given_name: 'Agent',
      family_name: 'User',
    },
    UserRole.ADMIN
  );

  assert.ok(Array.isArray(capturedValues));
  assert.equal(capturedValues[1], 'agent.user@carwoods.com');
});
