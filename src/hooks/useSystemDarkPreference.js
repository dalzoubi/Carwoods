import { useEffect, useState } from 'react';
import { FEATURE_DARK_THEME } from '../featureFlags';

function getSystemPrefersDark() {
    if (typeof window === 'undefined') return false;
    if (typeof window.matchMedia !== 'function') return false;
    try {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
        return false;
    }
}

/**
 * Tracks the OS-level dark-mode preference via matchMedia.
 * Returns false immediately (and does nothing) when FEATURE_DARK_THEME is off.
 *
 * @returns {boolean} isDark
 */
export function useSystemDarkPreference() {
    const [isDark, setIsDark] = useState(() => (FEATURE_DARK_THEME ? getSystemPrefersDark() : false));

    useEffect(() => {
        if (!FEATURE_DARK_THEME) return undefined;
        if (typeof window.matchMedia !== 'function') return undefined;
        let mq;
        try {
            mq = window.matchMedia('(prefers-color-scheme: dark)');
        } catch {
            return undefined;
        }
        const handler = () => setIsDark(mq.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    return isDark;
}
