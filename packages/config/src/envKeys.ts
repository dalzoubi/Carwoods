/**
 * Canonical environment variable names — see docs/portal/ENV_CONTRACT.md for semantics.
 */
export const EnvKeys = {
  AZURE_RESOURCE_GROUP: 'AZURE_RESOURCE_GROUP',
  DATABASE_URL: 'DATABASE_URL',
  BLOB_CONNECTION_STRING: 'BLOB_CONNECTION_STRING',
  BLOB_ACCOUNT_URL: 'BLOB_ACCOUNT_URL',
  RESEND_API_KEY: 'RESEND_API_KEY',
  RESEND_EMAIL_FROM: 'RESEND_EMAIL_FROM',
  TELNYX_API_KEY: 'TELNYX_API_KEY',
  TELNYX_SMS_FROM: 'TELNYX_SMS_FROM',
  TELNYX_MESSAGING_PROFILE_ID: 'TELNYX_MESSAGING_PROFILE_ID',
  NOTIFICATION_CHANNELS: 'NOTIFICATION_CHANNELS',
  // ── Gemini / LLM ──────────────────────────────────────────────────────────
  GEMINI_API_KEY: 'GEMINI_API_KEY',
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
  // ── Firebase / auth ──────────────────────────────────────────────────────
  FIREBASE_PROJECT_ID: 'FIREBASE_PROJECT_ID',
  FIREBASE_OPENID_METADATA_URL: 'FIREBASE_OPENID_METADATA_URL',
  CORS_ALLOWED_ORIGINS: 'CORS_ALLOWED_ORIGINS',
  FEATURE_HAR_IDX_SYNC: 'FEATURE_HAR_IDX_SYNC',
  FEATURE_VENDOR_PORTAL: 'FEATURE_VENDOR_PORTAL',
  FEATURE_APPLY_API_DEFAULT: 'FEATURE_APPLY_API_DEFAULT',
} as const;

export type EnvKey = (typeof EnvKeys)[keyof typeof EnvKeys];

/** Required resource group name for this project. */
export const REQUIRED_RESOURCE_GROUP = 'carwoods.com';
