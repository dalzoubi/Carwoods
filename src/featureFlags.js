/**
 * Build-time flags via Vite (`import.meta.env`).
 * Dark theme is on by default. Disable with `VITE_FEATURE_DARK_THEME=false`.
 */
export const FEATURE_DARK_THEME = import.meta.env.VITE_FEATURE_DARK_THEME !== 'false';

/** Base URL for portal API (no trailing slash required). */
export const VITE_API_BASE_URL_RESOLVED = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
