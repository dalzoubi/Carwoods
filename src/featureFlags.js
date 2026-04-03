/**
 * Build-time flags via Vite (`import.meta.env`).
 * Dark theme is on by default. Disable with `VITE_FEATURE_DARK_THEME=false`.
 */
export const FEATURE_DARK_THEME = import.meta.env.VITE_FEATURE_DARK_THEME !== 'false';

const applyApiBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim();

/**
 * Step 3: Prefer `GET /api/public/apply-properties` when a base URL is set.
 * Opt out with `VITE_FEATURE_APPLY_API=false` (e.g. while API is not deployed).
 */
export const FEATURE_APPLY_FROM_API =
  Boolean(applyApiBase) && import.meta.env.VITE_FEATURE_APPLY_API !== 'false';

/**
 * Step 2: In dev, when using the API, log differences vs generated tiles unless disabled.
 * Set `VITE_FEATURE_APPLY_DUAL_SOURCE=false` to silence compare logs.
 */
export const FEATURE_APPLY_DUAL_SOURCE_COMPARE_DEV =
  import.meta.env.DEV &&
  FEATURE_APPLY_FROM_API &&
  import.meta.env.VITE_FEATURE_APPLY_DUAL_SOURCE !== 'false';

/** Base URL for portal API (no trailing slash required). */
export const VITE_API_BASE_URL_RESOLVED = applyApiBase;
