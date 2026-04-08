/**
 * Retry policy with exponential backoff and additive jitter.
 *
 * Design decisions:
 * - Only retries errors where LlmError.retryable === true (4xx non-429 are NOT retried).
 * - Respects Retry-After from LlmRateLimitError when available.
 * - Jitter is additive (not multiplicative) to avoid thundering herd while keeping
 *   total delay bounded.
 * - The sleep function is injected for full testability.
 */

import { LlmRateLimitError, isRetryableLlmError } from './llmErrors.js';

export type RetryConfig = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  /** Fraction of computed delay added as random jitter (0 = none, 1 = full delay again) */
  jitterFactor: number;
};

export type RetryContext = {
  attempt: number;
  error: unknown;
  delayMs: number;
};

export type SleepFn = (ms: number) => Promise<void>;

const defaultSleep: SleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Compute the delay (ms) for attempt number `attempt` (1-based: first retry = attempt 1).
 * Uses exponential backoff capped at maxDelayMs, plus jitter.
 */
export function computeDelay(attempt: number, config: RetryConfig, randomFn: () => number = Math.random): number {
  const exponential = Math.min(config.baseDelayMs * Math.pow(2, attempt - 1), config.maxDelayMs);
  const jitter = exponential * config.jitterFactor * randomFn();
  return Math.round(exponential + jitter);
}

/**
 * Execute `fn` with retry. Returns the result of the first successful call.
 *
 * @param fn           The async operation to attempt. Receives the 1-based attempt number.
 * @param config       Retry parameters.
 * @param onRetry      Optional hook called before each retry sleep (after first failure).
 * @param sleep        Injectable sleep function (defaults to real setTimeout).
 * @param randomFn     Injectable RNG for jitter (defaults to Math.random).
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  config: RetryConfig,
  onRetry?: (ctx: RetryContext) => void,
  sleep: SleepFn = defaultSleep,
  randomFn: () => number = Math.random
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;

      const isLastAttempt = attempt === config.maxAttempts;
      if (isLastAttempt || !isRetryableLlmError(err)) {
        throw err;
      }

      // Honor Retry-After when the provider tells us to wait longer.
      let delayMs = computeDelay(attempt, config, randomFn);
      if (err instanceof LlmRateLimitError && err.retryAfterMs !== null) {
        delayMs = Math.max(delayMs, err.retryAfterMs);
      }

      onRetry?.({ attempt, error: err, delayMs });
      await sleep(delayMs);
    }
  }

  throw lastError;
}
