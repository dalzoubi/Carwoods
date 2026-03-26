/**
 * Build-time flags via Vite (`import.meta.env`).
 * Dark theme is on by default. Disable with `VITE_FEATURE_DARK_THEME=false`.
 */
export const FEATURE_DARK_THEME = import.meta.env.VITE_FEATURE_DARK_THEME !== 'false';
