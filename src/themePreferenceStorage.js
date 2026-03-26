const STORAGE_KEY = 'carwoods-color-scheme';

/** @typedef {'light' | 'dark'} ColorScheme */

/**
 * @returns {ColorScheme | null} Stored override, or null to follow system.
 */
export function readStoredColorScheme() {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw === 'light' || raw === 'dark') return raw;
    } catch {
        /* ignore */
    }
    return null;
}

/** @param {ColorScheme} mode */
export function writeStoredColorScheme(mode) {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
        /* ignore */
    }
}

export function clearStoredColorScheme() {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.removeItem(STORAGE_KEY);
    } catch {
        /* ignore */
    }
}

export { STORAGE_KEY };
