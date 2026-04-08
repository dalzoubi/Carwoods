import test from 'node:test';
import assert from 'node:assert/strict';
import { LlmCircuitBreaker } from '../dist/src/lib/llm/llmCircuitBreaker.js';

// Controllable clock
function makeClock(initial = 0) {
  let t = initial;
  return {
    now: () => t,
    advance: (ms) => { t += ms; },
  };
}

test('circuit starts CLOSED and allows requests', () => {
  const cb = new LlmCircuitBreaker({ failureThreshold: 3, openDurationMs: 5000, halfOpenProbes: 2 });
  assert.equal(cb.getState(), 'CLOSED');
  assert.equal(cb.isAllowed(), true);
});

test('circuit opens after reaching failure threshold', () => {
  const cb = new LlmCircuitBreaker({ failureThreshold: 3, openDurationMs: 5000, halfOpenProbes: 2 });
  cb.recordFailure();
  assert.equal(cb.getState(), 'CLOSED');
  cb.recordFailure();
  assert.equal(cb.getState(), 'CLOSED');
  cb.recordFailure();
  assert.equal(cb.getState(), 'OPEN');
  assert.equal(cb.isAllowed(), false);
});

test('circuit does not open when failures are below threshold', () => {
  const cb = new LlmCircuitBreaker({ failureThreshold: 5, openDurationMs: 5000, halfOpenProbes: 2 });
  for (let i = 0; i < 4; i++) cb.recordFailure();
  assert.equal(cb.getState(), 'CLOSED');
});

test('success resets consecutive failure count in CLOSED state', () => {
  const cb = new LlmCircuitBreaker({ failureThreshold: 3, openDurationMs: 5000, halfOpenProbes: 2 });
  cb.recordFailure();
  cb.recordFailure();
  cb.recordSuccess();
  cb.recordFailure(); // only 1 failure after reset
  assert.equal(cb.getState(), 'CLOSED');
});

test('OPEN circuit denies requests until openDurationMs elapses', () => {
  const clock = makeClock(0);
  const cb = new LlmCircuitBreaker(
    { failureThreshold: 2, openDurationMs: 10_000, halfOpenProbes: 1 },
    clock.now
  );
  cb.recordFailure();
  cb.recordFailure();
  assert.equal(cb.isAllowed(), false);

  clock.advance(9_999);
  assert.equal(cb.isAllowed(), false);

  clock.advance(1); // exactly at 10_000ms
  assert.equal(cb.isAllowed(), true); // transitions to HALF_OPEN
  assert.equal(cb.getState(), 'HALF_OPEN');
});

test('HALF_OPEN: enough consecutive successes close the circuit', () => {
  const clock = makeClock(0);
  const cb = new LlmCircuitBreaker(
    { failureThreshold: 2, openDurationMs: 1_000, halfOpenProbes: 2 },
    clock.now
  );
  cb.recordFailure(); cb.recordFailure();
  clock.advance(2_000);
  cb.isAllowed(); // trigger transition to HALF_OPEN
  assert.equal(cb.getState(), 'HALF_OPEN');
  cb.recordSuccess();
  assert.equal(cb.getState(), 'HALF_OPEN');
  cb.recordSuccess();
  assert.equal(cb.getState(), 'CLOSED');
});

test('HALF_OPEN: any failure re-opens the circuit', () => {
  const clock = makeClock(0);
  const cb = new LlmCircuitBreaker(
    { failureThreshold: 2, openDurationMs: 1_000, halfOpenProbes: 3 },
    clock.now
  );
  cb.recordFailure(); cb.recordFailure();
  clock.advance(2_000);
  cb.isAllowed();
  assert.equal(cb.getState(), 'HALF_OPEN');
  cb.recordSuccess(); // 1st probe ok
  cb.recordFailure(); // re-opens immediately
  assert.equal(cb.getState(), 'OPEN');
  assert.equal(cb.isAllowed(), false);
});

test('reset() returns circuit to CLOSED with clean state', () => {
  const cb = new LlmCircuitBreaker({ failureThreshold: 2, openDurationMs: 5000, halfOpenProbes: 2 });
  cb.recordFailure(); cb.recordFailure();
  assert.equal(cb.getState(), 'OPEN');
  cb.reset();
  assert.equal(cb.getState(), 'CLOSED');
  assert.equal(cb.isAllowed(), true);
  const snap = cb.snapshot();
  assert.equal(snap.consecutiveFailures, 0);
  assert.equal(snap.lastOpenedAt, null);
});

test('snapshot returns accurate state', () => {
  const clock = makeClock(100);
  const cb = new LlmCircuitBreaker(
    { failureThreshold: 2, openDurationMs: 5000, halfOpenProbes: 2 },
    clock.now
  );
  cb.recordFailure(); cb.recordFailure();
  const snap = cb.snapshot();
  assert.equal(snap.state, 'OPEN');
  assert.equal(snap.consecutiveFailures, 2);
  assert.equal(snap.lastOpenedAt, 100);
});
