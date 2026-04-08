/**
 * LlmClient – orchestration layer for resilient LLM calls.
 *
 * Responsibilities (in order):
 * 1. Check circuit breaker; reject immediately if OPEN.
 * 2. Attempt primary model with configurable retry + backoff.
 * 3. On retry exhaustion: switch to fallback model (if configured) and retry again.
 * 4. On total exhaustion: enter degraded mode (return null; caller decides safe reply).
 * 5. Report all outcomes through the optional LlmMetricsHook.
 *
 * This class does NOT know about:
 * - Gemini or any other provider's HTTP API shape.
 * - Elsa, prompt structure, or JSON parsing of business objects.
 * - HTTP request handling or Azure Functions.
 */

import type { LlmConfig } from './llmConfig.js';
import type { LlmMetricsHook, LlmProvider, LlmRequest, LlmResponse } from './llmTypes.js';
import { LlmCircuitBreaker } from './llmCircuitBreaker.js';
import { withRetry } from './llmRetry.js';
import { LlmCircuitOpenError, LlmExhaustedError, isRetryableLlmError } from './llmErrors.js';

export type LlmClientDeps = {
  provider: LlmProvider;
  config: LlmConfig;
  metrics?: LlmMetricsHook;
  /** Injectable for testing */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable for testing */
  now?: () => number;
};

export class LlmClient {
  private readonly circuit: LlmCircuitBreaker;
  private readonly provider: LlmProvider;
  private readonly config: LlmConfig;
  private readonly metrics: LlmMetricsHook;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(deps: LlmClientDeps) {
    this.provider = deps.provider;
    this.config = deps.config;
    this.metrics = deps.metrics ?? {};
    this.sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.circuit = new LlmCircuitBreaker(
      {
        failureThreshold: deps.config.circuitBreakerFailureThreshold,
        openDurationMs: deps.config.circuitBreakerOpenDurationMs,
        halfOpenProbes: deps.config.circuitBreakerHalfOpenProbes,
      },
      deps.now
    );
  }

  /**
   * Send a request and return a structured LlmResponse, or null if fully degraded.
   *
   * Returning null (rather than throwing) is intentional: the caller (Elsa service)
   * is responsible for constructing a safe tenant-facing fallback. We never expose
   * raw provider errors to the caller; they are captured in LlmExhaustedError.cause.
   */
  async complete(request: LlmRequest): Promise<LlmResponse | null> {
    if (!this.circuit.isAllowed()) {
      this.metrics.onCircuitOpen?.({ provider: this.provider.name });
      return null;
    }

    const start = Date.now();
    const { primaryModel, fallbackModel } = this.config;

    // --- Primary model attempt ---
    try {
      const result = await this.attemptWithRetry(
        request,
        primaryModel,
        this.config.maxPrimaryAttempts,
        false,
        start
      );
      this.circuit.recordSuccess();
      return result;
    } catch (primaryErr) {
      // Record circuit failure only for errors that indicate provider instability.
      // Non-retryable client errors (4xx) mean the request was bad, not the provider.
      if (isRetryableLlmError(primaryErr)) {
        this.circuit.recordFailure();
      }

      if (fallbackModel === null) {
        this.metrics.onDegraded?.({
          provider: this.provider.name,
          reason: primaryErr instanceof Error ? primaryErr.message : String(primaryErr),
        });
        return null;
      }

      this.metrics.onFallback?.({
        provider: this.provider.name,
        primaryModel,
        fallbackModel,
        reason: primaryErr instanceof Error ? primaryErr.message : String(primaryErr),
      });
    }

    // --- Fallback model attempt ---
    try {
      const result = await this.attemptWithRetry(
        request,
        fallbackModel!, // narrowed: we checked above
        this.config.maxFallbackAttempts,
        true,
        start
      );
      this.circuit.recordSuccess();
      return result;
    } catch (fallbackErr) {
      if (isRetryableLlmError(fallbackErr)) {
        this.circuit.recordFailure();
      }
      this.metrics.onDegraded?.({
        provider: this.provider.name,
        reason:
          `Primary + fallback exhausted. Last: ` +
          (fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)),
      });
      return null;
    }
  }

  /**
   * Lower-level call that applies retry logic and AbortController timeout.
   * Exposed for testing; not part of the public contract.
   */
  private async attemptWithRetry(
    request: LlmRequest,
    model: string,
    maxAttempts: number,
    usedFallback: boolean,
    overallStart: number
  ): Promise<LlmResponse> {
    const { timeoutMs, retryBaseDelayMs, retryMaxDelayMs, retryJitterFactor } = this.config;
    const provider = this.provider;
    const metrics = this.metrics;

    return withRetry(
      async (attempt) => {
        metrics.onAttempt?.({ attempt, provider: provider.name, model, usedFallback });

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const text = await provider.complete(request, model, controller.signal);
          const latencyMs = Date.now() - overallStart;
          metrics.onSuccess?.({
            provider: provider.name,
            model,
            usedFallback,
            attempts: attempt,
            latencyMs,
          });
          return {
            text,
            provider: provider.name,
            model,
            usedFallback,
            attempts: attempt,
            latencyMs,
          } satisfies LlmResponse;
        } finally {
          clearTimeout(timer);
        }
      },
      { maxAttempts, baseDelayMs: retryBaseDelayMs, maxDelayMs: retryMaxDelayMs, jitterFactor: retryJitterFactor },
      (ctx) => {
        metrics.onRetry?.({
          attempt: ctx.attempt,
          provider: provider.name,
          model,
          errorCode: (ctx.error as { code?: string })?.code ?? 'UNKNOWN',
          delayMs: ctx.delayMs,
        });
      },
      this.sleep
    );
  }

  /** Expose circuit breaker state for health-check endpoints. */
  getCircuitState() {
    return this.circuit.getState();
  }

  /** Expose snapshot for diagnostics / admin tooling. */
  getCircuitSnapshot() {
    return this.circuit.snapshot();
  }

  /** Force-reset the circuit (admin tooling only). */
  resetCircuit() {
    this.circuit.reset();
  }
}

/**
 * Build a ready-to-use LlmClient from a provider and config.
 * This is the normal factory used outside tests.
 */
export function createLlmClient(deps: LlmClientDeps): LlmClient {
  return new LlmClient(deps);
}

// Re-export for convenience so callers only need to import from this file.
export { LlmCircuitOpenError, LlmExhaustedError };
