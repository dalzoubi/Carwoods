/**
 * Three-state circuit breaker (CLOSED → OPEN → HALF_OPEN → CLOSED).
 *
 * - CLOSED: normal operation; failures accumulate in a sliding counter.
 * - OPEN: threshold crossed; requests are rejected immediately until openDurationMs elapses.
 * - HALF_OPEN: a probe window; a limited number of calls are allowed through.
 *   Consecutive successes close the circuit; any failure re-opens it.
 *
 * This class is intentionally stateful and synchronous. It does NOT make network
 * calls; it only tracks success/failure outcomes reported by its owner (LlmClient).
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export type CircuitBreakerConfig = {
  /** Consecutive failures required to open the circuit */
  failureThreshold: number;
  /** Duration the circuit stays OPEN before transitioning to HALF_OPEN (ms) */
  openDurationMs: number;
  /** Number of consecutive successes in HALF_OPEN required to close the circuit */
  halfOpenProbes: number;
};

export type CircuitBreakerSnapshot = {
  state: CircuitState;
  consecutiveFailures: number;
  consecutiveHalfOpenSuccesses: number;
  lastOpenedAt: number | null;
};

export class LlmCircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private consecutiveHalfOpenSuccesses = 0;
  private lastOpenedAt: number | null = null;

  constructor(
    private readonly config: CircuitBreakerConfig,
    /** Injected clock for testability – defaults to Date.now */
    private readonly now: () => number = Date.now
  ) {}

  /**
   * Returns true when a request is permitted to proceed.
   * - CLOSED: always allowed.
   * - OPEN: allowed only once openDurationMs has elapsed (transitions to HALF_OPEN).
   * - HALF_OPEN: allowed until halfOpenProbes successful calls close the circuit.
   */
  isAllowed(): boolean {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN') {
      if (this.lastOpenedAt !== null && this.now() - this.lastOpenedAt >= this.config.openDurationMs) {
        this.state = 'HALF_OPEN';
        this.consecutiveHalfOpenSuccesses = 0;
        return true;
      }
      return false;
    }
    // HALF_OPEN: allow probes through
    return true;
  }

  /** Record a successful call outcome. */
  recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.consecutiveHalfOpenSuccesses++;
      if (this.consecutiveHalfOpenSuccesses >= this.config.halfOpenProbes) {
        this.state = 'CLOSED';
        this.consecutiveFailures = 0;
        this.consecutiveHalfOpenSuccesses = 0;
        this.lastOpenedAt = null;
      }
    } else {
      this.consecutiveFailures = 0;
    }
  }

  /** Record a failed call outcome. */
  recordFailure(): void {
    if (this.state === 'HALF_OPEN') {
      // Any failure in half-open immediately re-opens.
      this.open();
      return;
    }
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.config.failureThreshold) {
      this.open();
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  snapshot(): CircuitBreakerSnapshot {
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveHalfOpenSuccesses: this.consecutiveHalfOpenSuccesses,
      lastOpenedAt: this.lastOpenedAt,
    };
  }

  /** Force-reset to CLOSED (useful in tests or admin tooling). */
  reset(): void {
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.consecutiveHalfOpenSuccesses = 0;
    this.lastOpenedAt = null;
  }

  private open(): void {
    this.state = 'OPEN';
    this.lastOpenedAt = this.now();
    this.consecutiveHalfOpenSuccesses = 0;
  }
}
