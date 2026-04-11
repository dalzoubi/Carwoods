/**
 * Build-time flags via Vite (`import.meta.env`).
 * Dark theme is on by default. Disable with `VITE_FEATURE_DARK_THEME=false`.
 */
export const FEATURE_DARK_THEME = import.meta.env.VITE_FEATURE_DARK_THEME !== 'false';

/** Base URL for portal API (no trailing slash required). */
export const VITE_API_BASE_URL_RESOLVED = (import.meta.env.VITE_API_BASE_URL ?? '').trim();

/**
 * Notification polling cadence for signed-in portal users.
 * Defaults to 60s and is clamped to [10s, 5m].
 */
function parseNotificationsPollMs(raw) {
  const fallbackMs = 60 * 1000;
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackMs;
  return Math.max(10 * 1000, Math.min(parsed, 5 * 60 * 1000));
}

export const NOTIFICATIONS_POLL_INTERVAL_MS = parseNotificationsPollMs(
  import.meta.env.VITE_NOTIFICATIONS_POLL_MS
);
