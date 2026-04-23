/**
 * Core interfaces for the LLM abstraction layer.
 *
 * Nothing in this file is provider-specific. Providers implement LlmProvider;
 * callers work against LlmClient (in llmClient.ts).
 */

/** A single structured prompt sent to any provider. */
export type LlmRequest = {
  /** Free-form text prompt */
  prompt: string;
  /**
   * Hint to the provider that the response should be parseable JSON.
   * Providers that support native JSON mode (e.g. Gemini's responseMimeType)
   * should enable it when this is true.
   */
  expectJsonResponse?: boolean;
  /** Sampling temperature (0–1). Defaults to provider/config default. */
  temperature?: number;
};

/** Raw result returned by a provider's complete() call. */
export type LlmProviderResult = {
  text: string;
  /** Total tokens consumed (prompt + completion), if the provider reports it. */
  tokensUsed?: number;
};

/** Successful structured response returned from a provider. */
export type LlmResponse = {
  /** Raw text content from the model */
  text: string;
  /** Which provider actually served this response */
  provider: string;
  /** Exact model name used (may be primary or fallback) */
  model: string;
  /** True when a fallback model was used */
  usedFallback: boolean;
  /** Number of retry attempts consumed (0 = first attempt succeeded) */
  attempts: number;
  /** Latency of the successful call in milliseconds */
  latencyMs: number;
  /** Total tokens consumed (prompt + completion), if reported by provider. */
  tokensUsed?: number;
};

/**
 * Metrics hook – implemented by callers that want observability.
 * All methods are optional; the client calls whichever are provided.
 */
export type LlmMetricsHook = {
  onAttempt?: (opts: {
    attempt: number;
    provider: string;
    model: string;
    usedFallback: boolean;
  }) => void;
  onSuccess?: (opts: {
    provider: string;
    model: string;
    usedFallback: boolean;
    attempts: number;
    latencyMs: number;
  }) => void;
  onRetry?: (opts: {
    attempt: number;
    provider: string;
    model: string;
    errorCode: string;
    delayMs: number;
  }) => void;
  onFallback?: (opts: { provider: string; primaryModel: string; fallbackModel: string; reason: string }) => void;
  onCircuitOpen?: (opts: { provider: string }) => void;
  onDegraded?: (opts: { provider: string; reason: string }) => void;
};

/**
 * The provider abstraction. Each concrete provider (Gemini, OpenAI …) implements this.
 * It is intentionally thin: it only knows how to make one call with an AbortSignal.
 */
export interface LlmProvider {
  readonly name: string;
  /**
   * Execute one completion call. Must reject with a typed LlmError subclass
   * (LlmRateLimitError, LlmServerError, LlmClientError, LlmTimeoutError, LlmParseError).
   * Must NOT swallow errors or apply retry logic internally.
   */
  complete(request: LlmRequest, model: string, signal: AbortSignal): Promise<LlmProviderResult>;
}
