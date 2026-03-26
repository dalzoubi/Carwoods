/**
 * Build-time flags via Vite (`import.meta.env`).
 * Enable dark theme locally or in CI: `VITE_FEATURE_DARK_THEME=true npm run dev`
 */
export const FEATURE_DARK_THEME = import.meta.env.VITE_FEATURE_DARK_THEME === 'true';
