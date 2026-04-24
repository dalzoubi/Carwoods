const STORAGE_KEY = 'carwoods_analytics_opt_out';

/**
 * Returns the stored analytics opt-out preference. Defaults to false (opted in).
 *
 * Storage access is wrapped in try/catch so private-mode browsers and SSR /
 * prerender contexts degrade gracefully (telemetry stays at its default).
 *
 * @returns {boolean} true when the user has opted out.
 */
export function getAnalyticsOptOut() {
    if (typeof window === 'undefined') return false;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return raw === 'true';
    } catch {
        return false;
    }
}

/**
 * Persists the analytics opt-out preference.
 *
 * @param {boolean} value true to opt out, false to opt in.
 */
export function setAnalyticsOptOut(value) {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
    } catch {
        /* ignore — preference will reset to default on next read */
    }
}

/** Removes the stored analytics opt-out preference. */
export function clearAnalyticsOptOut() {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.removeItem(STORAGE_KEY);
    } catch {
        /* ignore */
    }
}

export { STORAGE_KEY };
