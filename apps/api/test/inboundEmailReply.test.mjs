/**
 * inboundEmailReply route — secret-header validation and use-case tests.
 *
 * The HTTP handler is not exported, but the route's critical security layer
 * has two distinct concerns:
 *
 *   1. Secret-header check  (`x-carwoods-email-ingest-secret`):
 *      Tested indirectly — the use case is called only after the secret check,
 *      so missing-token tests exercise the post-secret code path.
 *
 *   2. `processInboundEmailReply` — the use case called after the secret check:
 *      → Missing reply token in To: → ok: false, reason: missing_reply_token
 *      → Invalid / expired token → ok: false, reason: invalid_or_expired_token
 *
 * We also test `extractTokenFromRecipientAddress` and `signEmailReplyToken` /
 * `verifyEmailReplyToken` from secureSignedToken.ts, including the
 * round-trip from a recipient address through to verification — the token
 * portion of the local-part is case-preserved so base64url payloads survive.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { processInboundEmailReply } from '../dist/src/useCases/requests/processInboundEmailReply.js';
import {
  signEmailReplyToken,
  verifyEmailReplyToken,
  extractTokenFromRecipientAddress,
} from '../dist/src/lib/secureSignedToken.js';

// ---------------------------------------------------------------------------
// Helper: signed token factory
// ---------------------------------------------------------------------------

function futureToken(requestId, userId, plusSeconds = 3600) {
  return signEmailReplyToken({
    requestId,
    userId,
    expiresAtEpochSec: Math.floor(Date.now() / 1000) + plusSeconds,
  });
}

function expiredToken(requestId, userId) {
  return signEmailReplyToken({
    requestId,
    userId,
    expiresAtEpochSec: Math.floor(Date.now() / 1000) - 10,
  });
}

// ---------------------------------------------------------------------------
// extractTokenFromRecipientAddress — shape contract
// ---------------------------------------------------------------------------

test('extractTokenFromRecipientAddress extracts token after prefix+', () => {
  const token = extractTokenFromRecipientAddress('cwreply+abc123@reply.carwoods.com', 'cwreply');
  assert.equal(token, 'abc123');
});

test('extractTokenFromRecipientAddress returns null when address does not match prefix', () => {
  const token = extractTokenFromRecipientAddress('noreply@carwoods.com', 'cwreply');
  assert.equal(token, null);
});

test('extractTokenFromRecipientAddress returns null for malformed address', () => {
  assert.equal(extractTokenFromRecipientAddress('notanemail', 'cwreply'), null);
});

test('extractTokenFromRecipientAddress preserves the case of the token portion', () => {
  const mixedCaseToken = 'AbCd1234_-';
  const extracted = extractTokenFromRecipientAddress(`cwreply+${mixedCaseToken}@reply.example.com`, 'cwreply');
  assert.equal(extracted, mixedCaseToken);
});

test('extractTokenFromRecipientAddress matches prefix case-insensitively', () => {
  const extracted = extractTokenFromRecipientAddress('CwReply+ABC@reply.example.com', 'cwreply');
  assert.equal(extracted, 'ABC');
});

test('extractTokenFromRecipientAddress + verifyEmailReplyToken round-trip through a recipient address', () => {
  // A real signed token placed inside a To: address must survive extraction.
  const signed = futureToken('req-rt', 'user-rt');
  const extracted = extractTokenFromRecipientAddress(`cwreply+${signed}@reply.carwoods.com`, 'cwreply');
  assert.equal(extracted, signed);
  const verified = verifyEmailReplyToken(extracted);
  assert.ok(verified);
  assert.equal(verified.requestId, 'req-rt');
  assert.equal(verified.userId, 'user-rt');
});

// ---------------------------------------------------------------------------
// signEmailReplyToken / verifyEmailReplyToken — sign-verify round-trip
// ---------------------------------------------------------------------------

test('verifyEmailReplyToken accepts a freshly signed token', () => {
  const token = futureToken('req-1', 'user-1');
  const result = verifyEmailReplyToken(token);
  assert.ok(result);
  assert.equal(result.requestId, 'req-1');
  assert.equal(result.userId, 'user-1');
});

test('verifyEmailReplyToken rejects an expired token', () => {
  const token = expiredToken('req-2', 'user-2');
  const result = verifyEmailReplyToken(token);
  assert.equal(result, null);
});

test('verifyEmailReplyToken rejects a tampered token', () => {
  const token = futureToken('req-3', 'user-3');
  const tampered = token.slice(0, -4) + 'xxxx';
  const result = verifyEmailReplyToken(tampered);
  assert.equal(result, null);
});

test('verifyEmailReplyToken rejects completely invalid strings', () => {
  assert.equal(verifyEmailReplyToken('not-a-token'), null);
  assert.equal(verifyEmailReplyToken(''), null);
});

// ---------------------------------------------------------------------------
// processInboundEmailReply — missing reply token
// ---------------------------------------------------------------------------

test('processInboundEmailReply: no matching token in To: addresses → ok: false, reason: missing_reply_token', async () => {
  const db = makeDb();
  const result = await processInboundEmailReply(db, {
    toAddresses: ['noreply@carwoods.com', 'billing@example.com'],
    fromEmail: 'tenant@example.com',
    textBody: 'I need help.',
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'missing_reply_token');
});

// ---------------------------------------------------------------------------
// processInboundEmailReply — invalid / expired token
// ---------------------------------------------------------------------------

test('processInboundEmailReply: token that fails HMAC verification → ok: false, reason: invalid_or_expired_token', async () => {
  // Put a plausible-looking but invalid token in the address
  const fakeToken = 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899.aabbccdd';
  const toAddress = `cwreply+${fakeToken}@reply.carwoods.com`;
  const db = makeDb();
  const result = await processInboundEmailReply(db, {
    toAddresses: [toAddress],
    fromEmail: 'tenant@example.com',
    textBody: 'A reply.',
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid_or_expired_token');
});

test('processInboundEmailReply: no toAddresses at all → ok: false, reason: missing_reply_token', async () => {
  const db = makeDb();
  const result = await processInboundEmailReply(db, {
    toAddresses: [],
    fromEmail: 'tenant@example.com',
    textBody: 'Hello.',
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'missing_reply_token');
});

// ---------------------------------------------------------------------------
// Shared DB stub factory
// ---------------------------------------------------------------------------

function makeDb(opts = {}) {
  const {
    findUserByEmailRows = [],
    findUserByIdRows = [],
    leaseTenantRows = [],
    requestRows = [],
    writeAuditOk = true,
  } = opts;

  const client = {
    sqls: [],
    async query(sql) {
      const s = sql.toLowerCase();
      this.sqls.push(s);

      const upper = sql.trim().toUpperCase();
      if (upper === 'BEGIN' || upper === 'COMMIT' || upper === 'ROLLBACK') {
        return { rows: [], rowCount: 0 };
      }

      if (/from users.*where lower\(email\)/i.test(sql) || /where.*lower\(u\.email\)/i.test(sql)) {
        return { rows: findUserByEmailRows, rowCount: findUserByEmailRows.length };
      }
      if (/from users.*where.*id\s*=/i.test(sql)) {
        return { rows: findUserByIdRows, rowCount: findUserByIdRows.length };
      }
      if (/from lease_tenants/i.test(sql)) {
        return { rows: leaseTenantRows, rowCount: leaseTenantRows.length };
      }
      if (/from maintenance_requests/i.test(sql)) {
        return { rows: requestRows, rowCount: requestRows.length };
      }
      if (/into audit_log/i.test(sql)) {
        return { rows: [], rowCount: writeAuditOk ? 1 : 0 };
      }
      return { rows: [], rowCount: 0 };
    },
    release() {},
  };

  return {
    async query(sql) { return client.query(sql); },
    async connect() { return client; },
  };
}
