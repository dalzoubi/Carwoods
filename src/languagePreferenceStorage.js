const STORAGE_KEY = 'carwoods-language';

/** Returns the stored language code, or null if not set. */
export function readStoredLanguage() {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}

/** Persists a language code to localStorage. */
export function writeStoredLanguage(lang) {
    try {
        localStorage.setItem(STORAGE_KEY, lang);
    } catch {
        // ignore
    }
}

/** Removes the stored language preference. */
export function clearStoredLanguage() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // ignore
    }
}
