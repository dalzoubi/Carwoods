/**
 * useProfilePreferenceSync
 *
 * Bridges the gap between per-browser localStorage preferences (language,
 * color-scheme) and the server-side profile so a user's choices follow them
 * across devices when they are authenticated in the portal.
 *
 * Lifecycle:
 * 1. When the user first becomes authenticated and /me returns their profile,
 *    apply any server-stored ui_language / ui_color_scheme to the local
 *    state (overwriting the current browser-only value) — but only on the
 *    first successful load after sign-in.
 * 2. Whenever the user changes their language or color-scheme override while
 *    authenticated, persist the new value to the server (fire-and-forget,
 *    best-effort — local state is always the source of truth for the UI).
 *
 * This hook must be called inside both LanguageProvider and ThemeModeProvider
 * (e.g. inside PortalAuthGate), and also inside PortalAuthProvider.
 */

import { useCallback, useEffect, useRef } from 'react';
import { usePortalAuth } from '../PortalAuthContext';
import { useLanguage } from '../LanguageContext';
import { useThemeMode } from '../ThemeModeContext';
import { FEATURE_DARK_THEME } from '../featureFlags';
import { patchUiPreferences } from '../lib/portalApiClient';
import { emailFromAccount } from '../portalUtils';

/**
 * @param {string | null} value
 * @param {readonly string[]} allowed
 * @returns {string | null}
 */
function validOrNull(value, allowed) {
    if (typeof value === 'string' && allowed.includes(value)) return value;
    return null;
}

const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'ar'];
const SUPPORTED_SCHEMES = ['light', 'dark'];

export function useProfilePreferenceSync() {
    const { isAuthenticated, meData, meStatus, baseUrl, getAccessToken, account } =
        usePortalAuth();
    const { currentLanguage, changeLanguage } = useLanguage();
    const { storedOverride, setOverrideDark, setOverrideLight } = useThemeMode();

    // Track the last user ID whose prefs we applied to avoid re-applying on
    // background /me refreshes.
    const appliedForUserIdRef = useRef(null);

    // Apply server prefs after a fresh sign-in (first time we see this user's data).
    useEffect(() => {
        if (!isAuthenticated || meStatus !== 'ok' || !meData?.user) return;

        const userId = meData.user.id;
        if (!userId || appliedForUserIdRef.current === userId) return;

        appliedForUserIdRef.current = userId;

        const serverLang = validOrNull(meData.user.ui_language, SUPPORTED_LANGUAGES);
        const serverScheme = validOrNull(meData.user.ui_color_scheme, SUPPORTED_SCHEMES);

        if (serverLang && serverLang !== currentLanguage) {
            changeLanguage(serverLang);
        }

        if (FEATURE_DARK_THEME && serverScheme) {
            if (serverScheme === 'dark' && storedOverride !== 'dark') {
                setOverrideDark();
            } else if (serverScheme === 'light' && storedOverride !== 'light') {
                setOverrideLight();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, meStatus, meData]);

    // Reset tracking when the user signs out so the next login re-applies.
    useEffect(() => {
        if (!isAuthenticated) {
            appliedForUserIdRef.current = null;
        }
    }, [isAuthenticated]);

    // Sync language change back to server.
    const syncToServer = useCallback(
        async (patch) => {
            if (!isAuthenticated || !baseUrl) return;
            try {
                const token = await getAccessToken();
                const emailHint = emailFromAccount(account);
                await patchUiPreferences(baseUrl, token, { emailHint, ...patch });
            } catch {
                // Best-effort: local state is canonical; server sync is additive.
            }
        },
        [isAuthenticated, baseUrl, getAccessToken, account]
    );

    // Watch language and push to server (skip the initial render value).
    const prevLanguageRef = useRef(null);
    useEffect(() => {
        if (!isAuthenticated) {
            prevLanguageRef.current = null;
            return;
        }
        if (prevLanguageRef.current === null) {
            // Initialise ref without syncing — the server value was just applied.
            prevLanguageRef.current = currentLanguage;
            return;
        }
        if (prevLanguageRef.current === currentLanguage) return;
        prevLanguageRef.current = currentLanguage;
        syncToServer({ ui_language: currentLanguage });
    }, [isAuthenticated, currentLanguage, syncToServer]);

    // Watch color-scheme override and push to server.
    const prevSchemeRef = useRef(undefined);
    useEffect(() => {
        if (!isAuthenticated) {
            prevSchemeRef.current = undefined;
            return;
        }
        if (prevSchemeRef.current === undefined) {
            prevSchemeRef.current = storedOverride;
            return;
        }
        if (prevSchemeRef.current === storedOverride) return;
        prevSchemeRef.current = storedOverride;
        // storedOverride is null when "follow system" is chosen — persist null.
        syncToServer({ ui_color_scheme: storedOverride ?? null });
    }, [isAuthenticated, storedOverride, syncToServer]);
}
