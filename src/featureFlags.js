/**
 * Build-time flags via Vite (`import.meta.env`).
 * Dark theme is on by default. Disable with `VITE_FEATURE_DARK_THEME=false`.
 */
export const FEATURE_DARK_THEME = import.meta.env.VITE_FEATURE_DARK_THEME !== 'false';

/**
 * Base URL for portal API (no trailing slash).
 * Strips a mistaken trailing `/api` so paths like `/api/portal/me` do not become `/api/api/...`.
 */
export function normalizePortalApiBaseUrl(raw) {
  let s = String(raw ?? '').trim().replace(/\/$/, '');
  if (/\/api$/i.test(s)) {
    s = s.slice(0, -4).replace(/\/$/, '');
  }
  return s;
}

function resolvePortalApiBaseUrl(raw) {
  const configured = normalizePortalApiBaseUrl(raw);
  if (configured) return configured;

  if (
    import.meta.env.DEV
    && typeof window !== 'undefined'
    && window.location
    && typeof window.location.origin === 'string'
  ) {
    return normalizePortalApiBaseUrl(window.location.origin);
  }

  return '';
}

export const VITE_API_BASE_URL_RESOLVED = resolvePortalApiBaseUrl(import.meta.env.VITE_API_BASE_URL ?? '');

/**
 * Whether the SPA should perform portal API calls.
 * - Non-empty `VITE_API_BASE_URL`: call that host.
 * - Empty in **dev**: call the current origin (Vite proxies `/api` to `http://127.0.0.1:7071`).
 * - Empty in **production**: API unavailable (static hosting has no proxy).
 *
 * @param {string} [baseUrl] Context value: usually `VITE_API_BASE_URL_RESOLVED || ''`
 */
export function isPortalApiReachable(baseUrl) {
  if (String(baseUrl ?? '').trim() !== '') return true;
  return Boolean(import.meta.env.DEV);
}

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

/**
 * Request thread message polling while a request is selected (portal).
 * Defaults to 15s and is clamped to [10s, 5m].
 */
function parseMessagesPollMs(raw) {
  const fallbackMs = 15 * 1000;
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackMs;
  return Math.max(10 * 1000, Math.min(parsed, 5 * 60 * 1000));
}

export const MESSAGES_POLL_INTERVAL_MS = parseMessagesPollMs(
  import.meta.env.VITE_MESSAGES_POLL_MS
);

/** Upper bound for notification poll interval (ms) while the tray/menu is open. */
const NOTIFICATIONS_TRAY_OPEN_POLL_CEILING_MS = 8 * 1000;

/**
 * @param {boolean} trayOpen
 * @returns {number} Base interval when closed; when open, the shorter of 8s and the base interval.
 */
export function notificationsPollIntervalMs(trayOpen) {
  if (!trayOpen) return NOTIFICATIONS_POLL_INTERVAL_MS;
  return Math.min(NOTIFICATIONS_POLL_INTERVAL_MS, NOTIFICATIONS_TRAY_OPEN_POLL_CEILING_MS);
}
