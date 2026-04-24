import { useCallback, useEffect, useState } from 'react';
import {
    getAnalyticsOptOut,
    setAnalyticsOptOut as persistAnalyticsOptOut,
} from '../analyticsOptOutStorage';

/**
 * Detects whether the browser is signalling Do Not Track. We tolerate the three
 * historical surfaces because different vendors exposed different ones:
 *   - `window.doNotTrack` — older Safari / IE11 path
 *   - `navigator.doNotTrack` — Firefox / Chrome (until removal) / current spec
 *   - `navigator.msDoNotTrack` — legacy Edge / IE
 *
 * Any of those reading `'1'` (or boolean `true` for navigator on some old
 * vendors) flips the signal on. We re-check on every render rather than once
 * at module load so toggling DNT in browser settings takes effect immediately
 * on the next render without a full reload.
 */
function detectDntActive() {
    if (typeof window === 'undefined') return false;
    try {
        const winDnt = window.doNotTrack;
        if (winDnt === '1' || winDnt === 'yes' || winDnt === true) return true;
        const nav = window.navigator;
        if (nav) {
            if (nav.doNotTrack === '1' || nav.doNotTrack === 'yes' || nav.doNotTrack === true) {
                return true;
            }
            if (nav.msDoNotTrack === '1' || nav.msDoNotTrack === true) return true;
        }
    } catch {
        /* ignore — assume DNT off if we can't inspect the globals */
    }
    return false;
}

/**
 * Effective analytics-consent hook.
 *
 * Returns `{ enabled, optOut, setOptOut, dntActive }` where:
 *
 *   - `dntActive` reflects the browser's Do Not Track signal (any of the three
 *     historical surfaces, see `detectDntActive`).
 *   - `optOut` is the persisted user preference from localStorage.
 *   - `enabled = !dntActive && !optOut`. DNT always wins — if a user enables
 *     DNT in browser settings without clearing storage, analytics turns off
 *     immediately on the next render.
 *   - `setOptOut(next)` writes through to storage and updates state. The user
 *     can still flip the preference while DNT is active (it's a stored
 *     preference for the day DNT is turned off again); `enabled` simply stays
 *     false until DNT is cleared.
 *
 * @returns {{ enabled: boolean, optOut: boolean, setOptOut: (value: boolean) => void, dntActive: boolean }}
 */
export function useAnalyticsEnabled() {
    const [optOut, setOptOutState] = useState(() => getAnalyticsOptOut());
    const [dntActive, setDntActive] = useState(() => detectDntActive());

    // Re-check DNT whenever the document regains focus or visibility — a user
    // toggling the browser setting in another tab should propagate without
    // a full page reload.
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const recheck = () => setDntActive(detectDntActive());
        window.addEventListener('focus', recheck);
        document.addEventListener('visibilitychange', recheck);
        return () => {
            window.removeEventListener('focus', recheck);
            document.removeEventListener('visibilitychange', recheck);
        };
    }, []);

    const setOptOut = useCallback((next) => {
        const value = Boolean(next);
        persistAnalyticsOptOut(value);
        setOptOutState(value);
    }, []);

    const enabled = !dntActive && !optOut;

    return { enabled, optOut, setOptOut, dntActive };
}
