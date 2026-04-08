/**
 * Exception taxonomy for the LLM module.
 *
 * These types give callers (use-case layer, metrics hooks) structured information
 * without leaking raw provider errors. Hierarchy follows clean architecture:
 *   LlmError (base)
 *     LlmProviderError     – provider HTTP-level problem (status, model, provider)
 *       LlmRateLimitError  – 429, retryable
 *       LlmServerError     – 5xx, retryable
 *       LlmClientError     – 4xx non-429, NOT retryable (e.g. 400 bad payload, 404 deprecated model)
 *     LlmTimeoutError      – fetch timeout, retryable
 *     LlmParseError        – response body unparseable or fails schema, NOT retryable
 *     LlmCircuitOpenError  – circuit breaker open; request never sent
 *     LlmExhaustedError    – all retries + fallback exhausted
 */

export type LlmErrorCode =
  | 'LLM_RATE_LIMIT'
  | 'LLM_SERVER_ERROR'
  | 'LLM_CLIENT_ERROR'
  | 'LLM_TIMEOUT'
  | 'LLM_PARSE_ERROR'
  | 'LLM_CIRCUIT_OPEN'
  | 'LLM_EXHAUSTED';

export class LlmError extends Error {
  constructor(
    public readonly code: LlmErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

export class LlmProviderError extends LlmError {
  constructor(
    code: LlmErrorCode,
    message: string,
    retryable: boolean,
    public readonly httpStatus: number,
    public readonly provider: string,
    public readonly model: string,
    cause?: unknown
  ) {
    super(code, message, retryable, cause);
    this.name = 'LlmProviderError';
  }
}

export class LlmRateLimitError extends LlmProviderError {
  constructor(
    public readonly retryAfterMs: number | null,
    provider: string,
    model: string,
    cause?: unknown
  ) {
    super('LLM_RATE_LIMIT', `Provider ${provider} rate-limited (429)`, true, 429, provider, model, cause);
    this.name = 'LlmRateLimitError';
  }
}

export class LlmServerError extends LlmProviderError {
  constructor(httpStatus: number, provider: string, model: string, cause?: unknown) {
    super(
      'LLM_SERVER_ERROR',
      `Provider ${provider} returned ${httpStatus}`,
      true,
      httpStatus,
      provider,
      model,
      cause
    );
    this.name = 'LlmServerError';
  }
}

export class LlmClientError extends LlmProviderError {
  constructor(httpStatus: number, provider: string, model: string, cause?: unknown) {
    super(
      'LLM_CLIENT_ERROR',
      `Provider ${provider} rejected request with ${httpStatus} (not retryable)`,
      false,
      httpStatus,
      provider,
      model,
      cause
    );
    this.name = 'LlmClientError';
  }
}

export class LlmTimeoutError extends LlmError {
  constructor(provider: string, model: string, timeoutMs: number) {
    super('LLM_TIMEOUT', `Provider ${provider} timed out after ${timeoutMs}ms (model: ${model})`, true);
    this.name = 'LlmTimeoutError';
  }
}

export class LlmParseError extends LlmError {
  constructor(message: string, cause?: unknown) {
    super('LLM_PARSE_ERROR', message, false, cause);
    this.name = 'LlmParseError';
  }
}

export class LlmCircuitOpenError extends LlmError {
  constructor(provider: string) {
    super('LLM_CIRCUIT_OPEN', `Circuit breaker OPEN for provider ${provider}`, false);
    this.name = 'LlmCircuitOpenError';
  }
}

export class LlmExhaustedError extends LlmError {
  constructor(message: string, cause?: unknown) {
    super('LLM_EXHAUSTED', message, false, cause);
    this.name = 'LlmExhaustedError';
  }
}

export function isLlmError(e: unknown): e is LlmError {
  return e instanceof LlmError;
}

export function isRetryableLlmError(e: unknown): e is LlmError {
  return e instanceof LlmError && e.retryable;
}
