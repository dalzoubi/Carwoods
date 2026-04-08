import test from 'node:test';
import assert from 'node:assert/strict';
import { withRetry, computeDelay } from '../dist/src/lib/llm/llmRetry.js';
import {
  LlmServerError,
  LlmClientError,
  LlmRateLimitError,
  LlmTimeoutError,
} from '../dist/src/lib/llm/llmErrors.js';

// A no-op sleep for tests
const noSleep = () => Promise.resolve();
// Deterministic RNG
const fixedRandom = () => 0.5;

// ── computeDelay ─────────────────────────────────────────────────────────────

test('computeDelay: first retry uses base delay + jitter', () => {
  const config = { maxAttempts: 3, baseDelayMs: 500, maxDelayMs: 10_000, jitterFactor: 0.3 };
  // attempt=1 → exponential = 500 * 2^0 = 500; jitter = 500 * 0.3 * 0.5 = 75 → 575
  const delay = computeDelay(1, config, fixedRandom);
  assert.equal(delay, 575);
});

test('computeDelay: delay grows exponentially', () => {
  const config = { maxAttempts: 5, baseDelayMs: 500, maxDelayMs: 10_000, jitterFactor: 0 };
  assert.equal(computeDelay(1, config, fixedRandom), 500);  // 500 * 2^0
  assert.equal(computeDelay(2, config, fixedRandom), 1000); // 500 * 2^1
  assert.equal(computeDelay(3, config, fixedRandom), 2000); // 500 * 2^2
  assert.equal(computeDelay(4, config, fixedRandom), 4000); // 500 * 2^3
});

test('computeDelay: delay is capped at maxDelayMs', () => {
  const config = { maxAttempts: 5, baseDelayMs: 500, maxDelayMs: 1000, jitterFactor: 0 };
  assert.equal(computeDelay(5, config, fixedRandom), 1000); // would be 8000 without cap
});

// ── withRetry ─────────────────────────────────────────────────────────────────

test('withRetry: succeeds on first attempt without retrying', async () => {
  let calls = 0;
  const result = await withRetry(
    async () => { calls++; return 'ok'; },
    { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 1000, jitterFactor: 0 },
    undefined,
    noSleep
  );
  assert.equal(result, 'ok');
  assert.equal(calls, 1);
});

test('withRetry: retries retryable errors and succeeds on later attempt', async () => {
  let calls = 0;
  const result = await withRetry(
    async (attempt) => {
      calls++;
      if (attempt < 3) throw new LlmServerError(503, 'gemini', 'flash');
      return 'recovered';
    },
    { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 1000, jitterFactor: 0 },
    undefined,
    noSleep
  );
  assert.equal(result, 'recovered');
  assert.equal(calls, 3);
});

test('withRetry: does not retry non-retryable 4xx errors', async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(
      async () => {
        calls++;
        throw new LlmClientError(404, 'gemini', 'flash');
      },
      { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 1000, jitterFactor: 0 },
      undefined,
      noSleep
    ),
    (err) => err instanceof LlmClientError
  );
  assert.equal(calls, 1, 'should not retry 404');
});

test('withRetry: throws after maxAttempts', async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(
      async () => {
        calls++;
        throw new LlmServerError(503, 'gemini', 'flash');
      },
      { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 1000, jitterFactor: 0 },
      undefined,
      noSleep
    ),
    (err) => err instanceof LlmServerError
  );
  assert.equal(calls, 3);
});

test('withRetry: honors Retry-After from LlmRateLimitError when longer than backoff', async () => {
  const delays = [];
  let attempt = 0;
  await assert.rejects(
    withRetry(
      async () => {
        attempt++;
        throw new LlmRateLimitError(5000, 'gemini', 'flash'); // 5s Retry-After
      },
      { maxAttempts: 2, baseDelayMs: 100, maxDelayMs: 1000, jitterFactor: 0 },
      (ctx) => delays.push(ctx.delayMs),
      noSleep
    ),
    () => true
  );
  assert.equal(delays.length, 1);
  assert.ok(delays[0] >= 5000, `Expected delay >= 5000ms, got ${delays[0]}`);
});

test('withRetry: calls onRetry hook with correct attempt info', async () => {
  const retryEvents = [];
  await assert.rejects(
    withRetry(
      async () => { throw new LlmTimeoutError('gemini', 'flash', 8000); },
      { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 1000, jitterFactor: 0 },
      (ctx) => retryEvents.push(ctx.attempt),
      noSleep
    ),
    () => true
  );
  assert.deepEqual(retryEvents, [1, 2]);
});

test('withRetry: passes attempt number to fn', async () => {
  const attempts = [];
  const result = await withRetry(
    async (attempt) => {
      attempts.push(attempt);
      if (attempt < 3) throw new LlmServerError(500, 'gemini', 'flash');
      return attempt;
    },
    { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 1000, jitterFactor: 0 },
    undefined,
    noSleep
  );
  assert.deepEqual(attempts, [1, 2, 3]);
  assert.equal(result, 3);
});
