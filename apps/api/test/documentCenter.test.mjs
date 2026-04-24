/**
 * documentCenter route — share-link token and passcode tests.
 *
 * The `publicSharedDocument` handler is not exported, so we test:
 *
 *   1. `sha256Base64Url` — deterministic hashing used for token lookup
 *   2. `randomToken` / `randomPasscode` — shape/format contracts
 *   3. `getShareLinkByToken` — hashes the token before querying (verifies
 *      the correct token_hash is sent to the DB, not the raw token)
 *   4. `canPreviewContentType` — content-type allow-list
 *
 * The passcode-validation logic in `publicSharedDocument` compares
 *   sha256Base64Url(providedPasscode) === link.passcode_hash
 * We test that contract here directly without invoking the HTTP handler.
 *
 * Privacy regression: the raw token must never reach the DB — only its hash.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sha256Base64Url,
  randomToken,
  randomPasscode,
  canPreviewContentType,
  getShareLinkByToken,
} from '../dist/src/lib/documentCenterRepo.js';

// ---------------------------------------------------------------------------
// sha256Base64Url — deterministic hash
// ---------------------------------------------------------------------------

test('sha256Base64Url produces the same hash for the same input', () => {
  const h1 = sha256Base64Url('my-secret-token');
  const h2 = sha256Base64Url('my-secret-token');
  assert.equal(h1, h2);
});

test('sha256Base64Url produces different hashes for different inputs', () => {
  const h1 = sha256Base64Url('token-a');
  const h2 = sha256Base64Url('token-b');
  assert.notEqual(h1, h2);
});

test('sha256Base64Url output is URL-safe base64 (no +, /, or = padding)', () => {
  const h = sha256Base64Url('arbitrary-value');
  assert.match(h, /^[A-Za-z0-9_-]+$/);
});

// ---------------------------------------------------------------------------
// randomToken — shape contract
// ---------------------------------------------------------------------------

test('randomToken returns a non-empty URL-safe base64 string by default', () => {
  const t = randomToken();
  assert.ok(typeof t === 'string' && t.length > 0);
  assert.match(t, /^[A-Za-z0-9_-]+$/);
});

test('randomToken produces unique values on each call', () => {
  const tokens = new Set(Array.from({ length: 20 }, () => randomToken()));
  assert.equal(tokens.size, 20);
});

// ---------------------------------------------------------------------------
// randomPasscode — shape contract
// ---------------------------------------------------------------------------

test('randomPasscode returns a 6-digit zero-padded string', () => {
  for (let i = 0; i < 10; i++) {
    const p = randomPasscode();
    assert.match(p, /^\d{6}$/, `passcode "${p}" should be 6 digits`);
  }
});

test('randomPasscode is within the valid 000000–999999 range', () => {
  for (let i = 0; i < 10; i++) {
    const n = Number(randomPasscode());
    assert.ok(n >= 0 && n <= 999999);
  }
});

// ---------------------------------------------------------------------------
// Passcode-validation contract: sha256Base64Url round-trip
// ---------------------------------------------------------------------------

test('passcode hashes correctly for comparison in publicSharedDocument', () => {
  const passcode = '123456';
  const storedHash = sha256Base64Url(passcode);
  // Simulate the handler: compare sha256Base64Url(provided) === link.passcode_hash
  const provided = '123456';
  assert.equal(sha256Base64Url(provided), storedHash);
});

test('wrong passcode does not match stored hash', () => {
  const correctHash = sha256Base64Url('123456');
  assert.notEqual(sha256Base64Url('000000'), correctHash);
});

// ---------------------------------------------------------------------------
// getShareLinkByToken — sends the hash to the DB, not the raw token
// ---------------------------------------------------------------------------

test('getShareLinkByToken queries by token_hash, not by the raw token', async () => {
  const rawToken = 'the-raw-token-value';
  const expectedHash = sha256Base64Url(rawToken);

  let capturedParam = null;
  const db = {
    async query(sql, params) {
      capturedParam = params?.[0] ?? null;
      // Simulate not finding the link
      return { rows: [], rowCount: 0 };
    },
  };

  await getShareLinkByToken(db, rawToken);

  // The first query parameter must be the hash — never the plaintext token
  assert.equal(capturedParam, expectedHash,
    'raw token must not be sent to the DB — only its hash');
  assert.notEqual(capturedParam, rawToken,
    'raw token must not appear as a query parameter');
});

test('getShareLinkByToken returns null when no link is found', async () => {
  const db = { async query() { return { rows: [], rowCount: 0 }; } };
  const result = await getShareLinkByToken(db, 'nonexistent');
  assert.equal(result, null);
});

test('getShareLinkByToken returns the link row when found', async () => {
  const linkRow = {
    id: 'link-id-1',
    document_id: 'doc-id-1',
    passcode_hash: null,
    expires_at: new Date(Date.now() + 86400_000),
    revoked_at: null,
  };
  const db = { async query() { return { rows: [linkRow], rowCount: 1 }; } };
  const result = await getShareLinkByToken(db, 'any-token');
  assert.deepEqual(result, linkRow);
});

// ---------------------------------------------------------------------------
// canPreviewContentType
// ---------------------------------------------------------------------------

test('canPreviewContentType returns true for PDF and image types', () => {
  assert.equal(canPreviewContentType('application/pdf'), true);
  assert.equal(canPreviewContentType('image/jpeg'), true);
  assert.equal(canPreviewContentType('image/png'), true);
  assert.equal(canPreviewContentType('IMAGE/JPEG'), true); // case-insensitive
});

test('canPreviewContentType returns false for word docs and other binary types', () => {
  assert.equal(canPreviewContentType('application/msword'), false);
  assert.equal(canPreviewContentType('application/vnd.openxmlformats-officedocument.wordprocessingml.document'), false);
  assert.equal(canPreviewContentType('application/zip'), false);
});
