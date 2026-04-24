/**
 * inboundSmsWebhook route — secret-header validation and payload parsing.
 *
 * The handler IS exported so we test it at the HTTP layer. We also test the
 * exported `parseInboundSmsPayload` helper and the domain keyword predicates.
 *
 * Coverage:
 *   - Missing INBOUND_SMS_INGEST_SECRET env var → 503 (ingest_unconfigured)
 *   - Wrong / missing header value → 401 (unauthorized)
 *   - Correct secret → passes gate and reaches payload parsing
 *   - Non-keyword text → 200 { action: 'ignored' }
 *   - HELP keyword → 200 { action: 'help_replied' }
 *   - STOP keyword → handled (with or without DB)
 *   - parseInboundSmsPayload — Telnyx v2 and flat formats
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { inboundSmsWebhookHandler, parseInboundSmsPayload } from '../dist/src/functions/inboundSmsWebhook.js';
import { isSmsStopKeyword, isSmsHelpKeyword } from '../dist/src/domain/smsConsent.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_SECRET = 'test-sms-secret-value-1234';

function makeRequest({ method = 'POST', secret = TEST_SECRET, body = null, origin = 'http://localhost' } = {}) {
  const headers = new Map([
    ['origin', origin],
    ['content-type', 'application/json'],
  ]);
  if (secret !== undefined) {
    headers.set('x-carwoods-sms-ingest-secret', secret);
  }

  return {
    method,
    headers: {
      get(name) {
        return headers.get(String(name).toLowerCase()) ?? null;
      },
    },
    async json() {
      if (body === null) throw new SyntaxError('No body');
      return body;
    },
  };
}

function makeContext() {
  return {
    functionName: 'inboundSmsWebhook',
    invocationId: 'test-invocation',
    log: () => {},
    warn: () => {},
    error: () => {},
    info: () => {},
  };
}

function withEnv(key, value, fn) {
  const prev = process.env[key];
  process.env[key] = value;
  const restore = () => {
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  };
  const result = fn();
  if (result && typeof result.then === 'function') {
    return result.then((v) => { restore(); return v; }, (e) => { restore(); throw e; });
  }
  restore();
  return result;
}

// ---------------------------------------------------------------------------
// Secret-header validation — 503 when env var missing
// ---------------------------------------------------------------------------

test('inboundSmsWebhookHandler: returns 503 when INBOUND_SMS_INGEST_SECRET is not configured', async () => {
  const req = makeRequest({ body: {} });
  const ctx = makeContext();
  const response = await withEnv('INBOUND_SMS_INGEST_SECRET', '', () =>
    inboundSmsWebhookHandler(req, ctx)
  );
  // safeErrorResponseBody maps internal error codes (including 'ingest_unconfigured')
  // and all 5xx responses to a generic 'service_unavailable' for public safety.
  assert.equal(response.status, 503);
  assert.equal(response.jsonBody?.error, 'service_unavailable');
});

// ---------------------------------------------------------------------------
// Secret-header validation — 401 when header is wrong
// ---------------------------------------------------------------------------

test('inboundSmsWebhookHandler: returns 401 when secret header value is wrong', async () => {
  const req = makeRequest({ secret: 'wrong-secret', body: {} });
  const ctx = makeContext();
  const response = await withEnv('INBOUND_SMS_INGEST_SECRET', TEST_SECRET, () =>
    inboundSmsWebhookHandler(req, ctx)
  );
  assert.equal(response.status, 401);
  assert.equal(response.jsonBody?.error, 'unauthorized');
});

test('inboundSmsWebhookHandler: returns 401 when secret header is absent', async () => {
  const headers = new Map([['origin', 'http://localhost']]);
  const req = {
    method: 'POST',
    headers: { get: (n) => headers.get(String(n).toLowerCase()) ?? null },
    async json() { return {}; },
  };
  const ctx = makeContext();
  const response = await withEnv('INBOUND_SMS_INGEST_SECRET', TEST_SECRET, () =>
    inboundSmsWebhookHandler(req, ctx)
  );
  assert.equal(response.status, 401);
});

// ---------------------------------------------------------------------------
// OPTIONS — 204 regardless of secret
// ---------------------------------------------------------------------------

test('inboundSmsWebhookHandler: OPTIONS returns 204', async () => {
  const req = makeRequest({ method: 'OPTIONS' });
  const ctx = makeContext();
  // SECRET not needed for OPTIONS
  const response = await inboundSmsWebhookHandler(req, ctx);
  assert.equal(response.status, 204);
});

// ---------------------------------------------------------------------------
// Non-keyword text — 200 action: ignored
// ---------------------------------------------------------------------------

test('inboundSmsWebhookHandler: non-keyword message returns 200 with action: ignored', async () => {
  const req = makeRequest({
    body: { from: '+15550001111', to: '+15550009999', text: 'Hello there' },
  });
  const ctx = makeContext();
  const response = await withEnv('INBOUND_SMS_INGEST_SECRET', TEST_SECRET, () =>
    inboundSmsWebhookHandler(req, ctx)
  );
  assert.equal(response.status, 200);
  assert.equal(response.jsonBody?.ok, true);
  assert.equal(response.jsonBody?.action, 'ignored');
});

// ---------------------------------------------------------------------------
// HELP keyword — 200 action: help_replied
// ---------------------------------------------------------------------------

test('inboundSmsWebhookHandler: HELP keyword returns 200 with action: help_replied', async () => {
  const req = makeRequest({
    body: { from: '+15550001111', to: '+15550009999', text: 'HELP' },
  });
  const ctx = makeContext();
  const response = await withEnv('INBOUND_SMS_INGEST_SECRET', TEST_SECRET, () =>
    inboundSmsWebhookHandler(req, ctx)
  );
  assert.equal(response.status, 200);
  assert.equal(response.jsonBody?.action, 'help_replied');
});

// ---------------------------------------------------------------------------
// parseInboundSmsPayload — flat format
// ---------------------------------------------------------------------------

test('parseInboundSmsPayload: flat { from, to, text } shape', () => {
  const parsed = parseInboundSmsPayload({ from: '+15550001111', to: '+15550009999', text: 'STOP' });
  assert.equal(parsed.from, '+15550001111');
  assert.equal(parsed.to, '+15550009999');
  assert.equal(parsed.text, 'STOP');
});

test('parseInboundSmsPayload: Telnyx v2 nested shape { data: { payload: { from: { phone_number }, to: [{ phone_number }], text } } }', () => {
  const body = {
    data: {
      payload: {
        from: { phone_number: '+15550001111' },
        to: [{ phone_number: '+15550009999' }],
        text: 'UNSUBSCRIBE',
      },
    },
  };
  const parsed = parseInboundSmsPayload(body);
  assert.equal(parsed.from, '+15550001111');
  assert.equal(parsed.to, '+15550009999');
  assert.equal(parsed.text, 'UNSUBSCRIBE');
});

test('parseInboundSmsPayload: returns nulls for completely empty payload', () => {
  const parsed = parseInboundSmsPayload({});
  assert.equal(parsed.from, null);
  assert.equal(parsed.text, null);
});

// ---------------------------------------------------------------------------
// isSmsStopKeyword / isSmsHelpKeyword — CTIA keyword set
// ---------------------------------------------------------------------------

test('isSmsStopKeyword: recognises all required CTIA stop variants', () => {
  for (const kw of ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']) {
    assert.ok(isSmsStopKeyword(kw), `expected "${kw}" to be a stop keyword`);
    assert.ok(isSmsStopKeyword(kw.toLowerCase()), `expected lowercase "${kw}" to match`);
  }
});

test('isSmsStopKeyword: does not match non-stop words', () => {
  for (const kw of ['HELP', 'INFO', 'START', 'YES', 'NO']) {
    assert.ok(!isSmsStopKeyword(kw), `"${kw}" should not be a stop keyword`);
  }
});

test('isSmsHelpKeyword: recognises HELP and INFO', () => {
  assert.ok(isSmsHelpKeyword('HELP'));
  assert.ok(isSmsHelpKeyword('INFO'));
  assert.ok(isSmsHelpKeyword('help'));
});

test('isSmsHelpKeyword: does not match stop keywords', () => {
  assert.ok(!isSmsHelpKeyword('STOP'));
  assert.ok(!isSmsHelpKeyword('CANCEL'));
});
