import test from 'node:test';
import assert from 'node:assert/strict';

import { safeErrorResponseBody } from '../dist/src/lib/safeErrorResponse.js';

test('safeErrorResponseBody hides operational error codes and message details', () => {
  assert.deepEqual(
    safeErrorResponseBody(503, {
      error: 'database_unconfigured',
      message: 'DATABASE_URL is missing',
      stack: 'not for clients',
    }),
    { error: 'service_unavailable' }
  );
});

test('safeErrorResponseBody preserves deliberate client-action metadata only', () => {
  assert.deepEqual(
    safeErrorResponseBody(403, {
      error: 'invalid_passcode',
      passcode_required: true,
      message: 'wrong passcode',
      lookup_sql: 'SELECT ...',
    }),
    { error: 'invalid_passcode', passcode_required: true }
  );
});

test('safeErrorResponseBody keeps controlled validation codes for UI handling', () => {
  assert.deepEqual(
    safeErrorResponseBody(409, {
      error: 'email_already_in_use',
      message: 'duplicate key uq_users_email',
    }),
    { error: 'email_already_in_use' }
  );
});

test('safeErrorResponseBody maps all 5xx codes to a generic public failure', () => {
  assert.deepEqual(
    safeErrorResponseBody(500, {
      error: 'unexpected_database_driver_error',
    }),
    { error: 'service_unavailable' }
  );
});
