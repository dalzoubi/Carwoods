/**
 * Canonical environment variable names — see docs/portal/ENV_CONTRACT.md for semantics.
 */
export const EnvKeys = {
  AZURE_RESOURCE_GROUP: 'AZURE_RESOURCE_GROUP',
  DATABASE_URL: 'DATABASE_URL',
  BLOB_CONNECTION_STRING: 'BLOB_CONNECTION_STRING',
  BLOB_ACCOUNT_URL: 'BLOB_ACCOUNT_URL',
  ACS_CONNECTION_STRING: 'ACS_CONNECTION_STRING',
  // ── Gemini / LLM ──────────────────────────────────────────────────────────
  GEMINI_API_KEY: 'GEMINI_API_KEY',
  /** Primary model name. Default: gemini-2.5-flash */
  GEMINI_MODEL: 'GEMINI_MODEL',
  /** Fallback model name. Set to 'none' to disable. Default: gemini-1.5-flash */
  GEMINI_FALLBACK_MODEL: 'GEMINI_FALLBACK_MODEL',
  /** Per-attempt HTTP timeout in ms. Default: 15000 */
  LLM_TIMEOUT_MS: 'LLM_TIMEOUT_MS',
  /** Max retries on primary model. Default: 3 */
  LLM_MAX_PRIMARY_ATTEMPTS: 'LLM_MAX_PRIMARY_ATTEMPTS',
  /** Max retries on fallback model. Default: 2 */
  LLM_MAX_FALLBACK_ATTEMPTS: 'LLM_MAX_FALLBACK_ATTEMPTS',
  /** Retry base delay in ms. Default: 500 */
  LLM_RETRY_BASE_DELAY_MS: 'LLM_RETRY_BASE_DELAY_MS',
  /** Retry max delay cap in ms. Default: 10000 */
  LLM_RETRY_MAX_DELAY_MS: 'LLM_RETRY_MAX_DELAY_MS',
  /** Jitter factor 0–1. Default: 0.3 */
  LLM_RETRY_JITTER_FACTOR: 'LLM_RETRY_JITTER_FACTOR',
  /** Circuit breaker: failure threshold. Default: 5 */
  LLM_CB_FAILURE_THRESHOLD: 'LLM_CB_FAILURE_THRESHOLD',
  /** Circuit breaker: open duration in ms. Default: 60000 */
  LLM_CB_OPEN_DURATION_MS: 'LLM_CB_OPEN_DURATION_MS',
  /** Circuit breaker: half-open probe count. Default: 2 */
  LLM_CB_HALF_OPEN_PROBES: 'LLM_CB_HALF_OPEN_PROBES',
  // ── Entra / auth ─────────────────────────────────────────────────────────
  ENTRA_TENANT_ID: 'ENTRA_TENANT_ID',
  ENTRA_API_AUDIENCE: 'ENTRA_API_AUDIENCE',
  ENTRA_ISSUER: 'ENTRA_ISSUER',
  ENTRA_ADMIN_OBJECT_IDS: 'ENTRA_ADMIN_OBJECT_IDS',
  ENTRA_LANDLORD_OBJECT_IDS: 'ENTRA_LANDLORD_OBJECT_IDS',
  CORS_ALLOWED_ORIGINS: 'CORS_ALLOWED_ORIGINS',
  FEATURE_HAR_IDX_SYNC: 'FEATURE_HAR_IDX_SYNC',
  FEATURE_VENDOR_PORTAL: 'FEATURE_VENDOR_PORTAL',
  FEATURE_APPLY_API_DEFAULT: 'FEATURE_APPLY_API_DEFAULT',
} as const;

export type EnvKey = (typeof EnvKeys)[keyof typeof EnvKeys];

/** Required resource group name for this project. */
export const REQUIRED_RESOURCE_GROUP = 'carwoods.com';
