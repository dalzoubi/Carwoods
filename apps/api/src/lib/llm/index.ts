/**
 * Public API for the LLM resilience module.
 *
 * External code should import from here, not from individual files,
 * so that internal refactors do not break callers.
 */

export type { LlmConfig } from './llmConfig.js';
export { loadLlmConfigFromEnv, LLM_CONFIG_DEFAULTS } from './llmConfig.js';

export type { LlmRequest, LlmResponse, LlmMetricsHook, LlmProvider } from './llmTypes.js';

export {
  LlmError,
  LlmProviderError,
  LlmRateLimitError,
  LlmServerError,
  LlmClientError,
  LlmTimeoutError,
  LlmParseError,
  LlmCircuitOpenError,
  LlmExhaustedError,
  isLlmError,
  isRetryableLlmError,
} from './llmErrors.js';
export type { LlmErrorCode } from './llmErrors.js';

export { LlmCircuitBreaker } from './llmCircuitBreaker.js';
export type { CircuitState, CircuitBreakerConfig, CircuitBreakerSnapshot } from './llmCircuitBreaker.js';

export { LlmClient, createLlmClient } from './LlmClient.js';
export type { LlmClientDeps } from './LlmClient.js';

export { GeminiProvider } from './GeminiProvider.js';
