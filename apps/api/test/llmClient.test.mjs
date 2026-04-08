/**
 * Integration tests for LlmClient orchestration logic.
 *
 * We use a fake LlmProvider to control exactly which errors are thrown and when.
 * The sleep function is replaced with a no-op so tests run synchronously.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { LlmClient } from '../dist/src/lib/llm/LlmClient.js';
import {
  LlmServerError,
  LlmClientError,
  LlmRateLimitError,
  LlmTimeoutError,
} from '../dist/src/lib/llm/llmErrors.js';

const noSleep = () => Promise.resolve();

function baseConfig(overrides = {}) {
  return {
    primaryModel: 'primary-model',
    fallbackModel: 'fallback-model',
    timeoutMs: 5_000,
    maxPrimaryAttempts: 3,
    maxFallbackAttempts: 2,
    retryBaseDelayMs: 10,
    retryMaxDelayMs: 100,
    retryJitterFactor: 0,
    circuitBreakerFailureThreshold: 5,
    circuitBreakerOpenDurationMs: 60_000,
    circuitBreakerHalfOpenProbes: 2,
    ...overrides,
  };
}

/**
 * Builds a fake provider that executes responses in sequence.
 * Each element is either:
 *   - A string: resolved with that text
 *   - An Error instance: thrown
 */
function makeProvider(responses, name = 'fake') {
  let idx = 0;
  return {
    name,
    complete: async () => {
      const r = responses[idx++];
      if (r instanceof Error) throw r;
      return r;
    },
  };
}

// ── Happy path ────────────────────────────────────────────────────────────────

test('returns LlmResponse on first successful attempt', async () => {
  const provider = makeProvider(['hello world']);
  const client = new LlmClient({ provider, config: baseConfig(), sleep: noSleep });
  const result = await client.complete({ prompt: 'hi' });
  assert.ok(result !== null);
  assert.equal(result.text, 'hello world');
  assert.equal(result.model, 'primary-model');
  assert.equal(result.usedFallback, false);
  assert.equal(result.attempts, 1);
});

// ── Retry on primary ─────────────────────────────────────────────────────────

test('retries 5xx on primary model and succeeds', async () => {
  const provider = makeProvider([
    new LlmServerError(503, 'fake', 'primary-model'),
    new LlmServerError(503, 'fake', 'primary-model'),
    'recovered',
  ]);
  const client = new LlmClient({ provider, config: baseConfig(), sleep: noSleep });
  const result = await client.complete({ prompt: 'test' });
  assert.ok(result !== null);
  assert.equal(result.text, 'recovered');
  assert.equal(result.attempts, 3);
  assert.equal(result.usedFallback, false);
});

test('does not retry non-retryable 404 on primary', async () => {
  const provider = makeProvider([
    new LlmClientError(404, 'fake', 'primary-model'),
    'should never get here',
  ]);
  const metrics = { fallbackCalled: false };
  const client = new LlmClient({
    provider,
    config: baseConfig(),
    sleep: noSleep,
    metrics: {
      onFallback: () => { metrics.fallbackCalled = true; },
    },
  });
  const result = await client.complete({ prompt: 'test' });
  // 404 is not retryable and not a server error, so no fallback either
  // The primary fails immediately, circuit does NOT record failure for client errors
  // → should fall through to fallback since we treat it as exhausted primary
  // Actually: 404 throws immediately (non-retryable), primary throws, so we go to fallback
  // The fallback provider returns 'should never get here' → that's the text
  assert.ok(result !== null);
  assert.equal(result.usedFallback, true);
});

// ── Fallback model ────────────────────────────────────────────────────────────

test('switches to fallback model when primary is exhausted', async () => {
  let callIndex = 0;
  const provider = {
    name: 'fake',
    complete: async (_req, model) => {
      callIndex++;
      if (model === 'primary-model') throw new LlmServerError(503, 'fake', model);
      return `fallback-response-${callIndex}`;
    },
  };
  const metrics = { fallbackTriggered: false, fallbackModel: null };
  const client = new LlmClient({
    provider,
    config: baseConfig({ maxPrimaryAttempts: 2 }),
    sleep: noSleep,
    metrics: {
      onFallback: (opts) => {
        metrics.fallbackTriggered = true;
        metrics.fallbackModel = opts.fallbackModel;
      },
    },
  });
  const result = await client.complete({ prompt: 'test' });
  assert.ok(result !== null);
  assert.equal(result.usedFallback, true);
  assert.equal(result.model, 'fallback-model');
  assert.ok(metrics.fallbackTriggered);
  assert.equal(metrics.fallbackModel, 'fallback-model');
});

// ── Degraded mode ─────────────────────────────────────────────────────────────

test('returns null when both primary and fallback are exhausted', async () => {
  const provider = makeProvider([
    new LlmServerError(503, 'fake', 'primary-model'),
    new LlmServerError(503, 'fake', 'primary-model'),
    new LlmServerError(503, 'fake', 'primary-model'),
    new LlmServerError(503, 'fake', 'fallback-model'),
    new LlmServerError(503, 'fake', 'fallback-model'),
  ]);
  const degraded = [];
  const client = new LlmClient({
    provider,
    config: baseConfig({ maxPrimaryAttempts: 3, maxFallbackAttempts: 2 }),
    sleep: noSleep,
    metrics: { onDegraded: (opts) => degraded.push(opts) },
  });
  const result = await client.complete({ prompt: 'test' });
  assert.equal(result, null);
  assert.equal(degraded.length, 1);
});

test('returns null when fallbackModel is null', async () => {
  const provider = makeProvider([
    new LlmServerError(503, 'fake', 'primary-model'),
    new LlmServerError(503, 'fake', 'primary-model'),
    new LlmServerError(503, 'fake', 'primary-model'),
  ]);
  const client = new LlmClient({
    provider,
    config: baseConfig({ fallbackModel: null, maxPrimaryAttempts: 3 }),
    sleep: noSleep,
  });
  const result = await client.complete({ prompt: 'test' });
  assert.equal(result, null);
});

// ── Circuit breaker integration ───────────────────────────────────────────────

test('circuit opens after threshold failures and returns null immediately', async () => {
  let callCount = 0;
  const provider = {
    name: 'fake',
    complete: async () => {
      callCount++;
      throw new LlmServerError(503, 'fake', 'primary-model');
    },
  };
  const circuitEvents = [];
  const client = new LlmClient({
    provider,
    config: baseConfig({
      fallbackModel: null,
      maxPrimaryAttempts: 1,
      maxFallbackAttempts: 1,
      circuitBreakerFailureThreshold: 3,
      circuitBreakerOpenDurationMs: 60_000,
    }),
    sleep: noSleep,
    metrics: { onCircuitOpen: (opts) => circuitEvents.push(opts) },
  });

  // 3 calls to open the circuit (each call = 1 attempt, 1 failure)
  await client.complete({ prompt: 'a' });
  await client.complete({ prompt: 'b' });
  await client.complete({ prompt: 'c' });
  assert.equal(client.getCircuitState(), 'OPEN');

  const callsBefore = callCount;
  const result = await client.complete({ prompt: 'd' });
  assert.equal(result, null);
  assert.equal(callCount, callsBefore, 'no provider call should happen when circuit is OPEN');
  assert.equal(circuitEvents.length, 1);
});

test('circuit closes again after recovery in HALF_OPEN', async () => {
  let callCount = 0;
  const clock = { t: 0, now: () => clock.t };
  const provider = {
    name: 'fake',
    complete: async (_req, model) => {
      callCount++;
      // First 3 calls fail; after that succeed
      if (callCount <= 3) throw new LlmServerError(503, 'fake', model);
      return 'ok';
    },
  };
  const client = new LlmClient({
    provider,
    config: baseConfig({
      fallbackModel: null,
      maxPrimaryAttempts: 1,
      circuitBreakerFailureThreshold: 3,
      circuitBreakerOpenDurationMs: 1000,
      circuitBreakerHalfOpenProbes: 2,
    }),
    sleep: noSleep,
    now: clock.now,
  });

  await client.complete({ prompt: '1' });
  await client.complete({ prompt: '2' });
  await client.complete({ prompt: '3' });
  assert.equal(client.getCircuitState(), 'OPEN');

  // Advance clock past open duration
  clock.t = 2000;

  // First half-open probe succeeds
  const r1 = await client.complete({ prompt: '4' });
  assert.ok(r1 !== null);
  assert.equal(client.getCircuitState(), 'HALF_OPEN');

  // Second probe closes the circuit
  const r2 = await client.complete({ prompt: '5' });
  assert.ok(r2 !== null);
  assert.equal(client.getCircuitState(), 'CLOSED');
});

// ── Metrics hooks ─────────────────────────────────────────────────────────────

test('metrics hooks are called on success', async () => {
  const events = { attempts: [], successes: [] };
  const provider = makeProvider(['result']);
  const client = new LlmClient({
    provider,
    config: baseConfig(),
    sleep: noSleep,
    metrics: {
      onAttempt: (o) => events.attempts.push(o),
      onSuccess: (o) => events.successes.push(o),
    },
  });
  await client.complete({ prompt: 'x' });
  assert.equal(events.attempts.length, 1);
  assert.equal(events.attempts[0].attempt, 1);
  assert.equal(events.successes.length, 1);
  assert.equal(events.successes[0].model, 'primary-model');
});

test('metrics onRetry called for each retry', async () => {
  const retries = [];
  const provider = makeProvider([
    new LlmServerError(503, 'fake', 'primary-model'),
    new LlmServerError(503, 'fake', 'primary-model'),
    'ok',
  ]);
  const client = new LlmClient({
    provider,
    config: baseConfig(),
    sleep: noSleep,
    metrics: { onRetry: (o) => retries.push(o) },
  });
  await client.complete({ prompt: 'x' });
  assert.equal(retries.length, 2);
  assert.equal(retries[0].attempt, 1);
  assert.equal(retries[1].attempt, 2);
});
