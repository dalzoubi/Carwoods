/**
 * Typed configuration for the LLM resilience module.
 *
 * All tunables have safe production defaults. Override via environment variables
 * (see loadLlmConfigFromEnv) or pass an explicit LlmConfig at construction time.
 */

export type LlmConfig = {
  /** Primary model name, e.g. 'gemini-2.5-flash' */
  primaryModel: string;
  /**
   * Fallback model used after primary retries are exhausted.
   * Set to null to skip fallback and go straight to degraded mode.
   */
  fallbackModel: string | null;

  /** HTTP timeout per individual attempt in ms */
  timeoutMs: number;

  /** Maximum attempts on the primary model before switching to fallback */
  maxPrimaryAttempts: number;
  /** Maximum attempts on the fallback model */
  maxFallbackAttempts: number;

  /** Base delay for exponential backoff in ms */
  retryBaseDelayMs: number;
  /** Maximum cap for backoff delay in ms */
  retryMaxDelayMs: number;
  /** Jitter fraction applied on top of computed delay (0 = no jitter, 1 = full random) */
  retryJitterFactor: number;

  /** Circuit breaker: consecutive failures needed to open the circuit */
  circuitBreakerFailureThreshold: number;
  /** Circuit breaker: time the circuit stays open before moving to half-open (ms) */
  circuitBreakerOpenDurationMs: number;
  /** Circuit breaker: successes needed in half-open to close the circuit again */
  circuitBreakerHalfOpenProbes: number;
};

const DEFAULTS: LlmConfig = {
  primaryModel: 'gemini-2.5-flash',
  fallbackModel: 'gemini-2.5-flash-lite',
  timeoutMs: 15_000,
  maxPrimaryAttempts: 3,
  maxFallbackAttempts: 2,
  retryBaseDelayMs: 500,
  retryMaxDelayMs: 10_000,
  retryJitterFactor: 0.3,
  circuitBreakerFailureThreshold: 5,
  circuitBreakerOpenDurationMs: 60_000,
  circuitBreakerHalfOpenProbes: 2,
};

function parseIntOr(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseFloatOr(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Build an LlmConfig from environment variables, merging over defaults.
 *
 * Variables (all optional – defaults apply when absent):
 *
 *   GEMINI_MODEL           – primary model name
 *   GEMINI_FALLBACK_MODEL  – fallback model name ('none' to disable)
 *   LLM_TIMEOUT_MS
 *   LLM_MAX_PRIMARY_ATTEMPTS
 *   LLM_MAX_FALLBACK_ATTEMPTS
 *   LLM_RETRY_BASE_DELAY_MS
 *   LLM_RETRY_MAX_DELAY_MS
 *   LLM_RETRY_JITTER_FACTOR
 *   LLM_CB_FAILURE_THRESHOLD
 *   LLM_CB_OPEN_DURATION_MS
 *   LLM_CB_HALF_OPEN_PROBES
 */
export function loadLlmConfigFromEnv(env: NodeJS.ProcessEnv = process.env): LlmConfig {
  const primaryModel = env.GEMINI_MODEL?.trim() || DEFAULTS.primaryModel;
  const fallbackRaw = env.GEMINI_FALLBACK_MODEL?.trim();
  const fallbackModel =
    fallbackRaw === undefined ? DEFAULTS.fallbackModel : fallbackRaw === 'none' ? null : fallbackRaw;

  return {
    primaryModel,
    fallbackModel,
    timeoutMs: parseIntOr(env.LLM_TIMEOUT_MS, DEFAULTS.timeoutMs),
    maxPrimaryAttempts: parseIntOr(env.LLM_MAX_PRIMARY_ATTEMPTS, DEFAULTS.maxPrimaryAttempts),
    maxFallbackAttempts: parseIntOr(env.LLM_MAX_FALLBACK_ATTEMPTS, DEFAULTS.maxFallbackAttempts),
    retryBaseDelayMs: parseIntOr(env.LLM_RETRY_BASE_DELAY_MS, DEFAULTS.retryBaseDelayMs),
    retryMaxDelayMs: parseIntOr(env.LLM_RETRY_MAX_DELAY_MS, DEFAULTS.retryMaxDelayMs),
    retryJitterFactor: parseFloatOr(env.LLM_RETRY_JITTER_FACTOR, DEFAULTS.retryJitterFactor),
    circuitBreakerFailureThreshold: parseIntOr(
      env.LLM_CB_FAILURE_THRESHOLD,
      DEFAULTS.circuitBreakerFailureThreshold
    ),
    circuitBreakerOpenDurationMs: parseIntOr(
      env.LLM_CB_OPEN_DURATION_MS,
      DEFAULTS.circuitBreakerOpenDurationMs
    ),
    circuitBreakerHalfOpenProbes: parseIntOr(
      env.LLM_CB_HALF_OPEN_PROBES,
      DEFAULTS.circuitBreakerHalfOpenProbes
    ),
  };
}

export { DEFAULTS as LLM_CONFIG_DEFAULTS };
