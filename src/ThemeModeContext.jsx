import React, { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import rtlPlugin from 'stylis-plugin-rtl';
import { FEATURE_DARK_THEME } from './featureFlags';
import { buildTheme, applyThemeCssVariables } from './theme';
import { clearStoredColorScheme, readStoredColorScheme, writeStoredColorScheme } from './themePreferenceStorage';
import { isDarkPreviewRoute } from './routePaths';
import { useLanguage } from './LanguageContext';
import { useSystemDarkPreference } from './hooks/useSystemDarkPreference';

const ThemeModeContext = createContext(null);

const ltrCache = createCache({ key: 'css' });
const rtlCache = createCache({ key: 'cssrtl', stylisPlugins: [rtlPlugin] });

/**
 * @param {string | null} storedOverride
 * @param {boolean} isDarkPreviewPath
 * @param {boolean} systemDark
 * @returns {'light' | 'dark'}
 */
function resolveEffectiveMode(storedOverride, isDarkPreviewPath, systemDark) {
    if (isDarkPreviewPath) return 'dark';
    if (!FEATURE_DARK_THEME) return 'light';
    if (storedOverride === 'light' || storedOverride === 'dark') return storedOverride;
    return systemDark ? 'dark' : 'light';
}

export function ThemeModeProvider({ children }) {
    const { pathname } = useLocation();
    const isDarkPreviewPath = isDarkPreviewRoute(pathname);
    const { isRTL } = useLanguage();

    const [storedOverride, setStoredOverride] = useState(() =>
        FEATURE_DARK_THEME ? readStoredColorScheme() : null
    );
    const systemDark = useSystemDarkPreference();

    const effectiveMode = useMemo(
        () => resolveEffectiveMode(storedOverride, isDarkPreviewPath, systemDark),
        [storedOverride, isDarkPreviewPath, systemDark]
    );

    const muiTheme = useMemo(() => buildTheme(effectiveMode, isRTL), [effectiveMode, isRTL]);

    useLayoutEffect(() => {
        applyThemeCssVariables(muiTheme);
    }, [muiTheme]);

    const setOverrideLight = useCallback(() => {
        if (!FEATURE_DARK_THEME) return;
        writeStoredColorScheme('light');
        setStoredOverride('light');
    }, []);

    const setOverrideDark = useCallback(() => {
        if (!FEATURE_DARK_THEME) return;
        writeStoredColorScheme('dark');
        setStoredOverride('dark');
    }, []);

    const resetOverride = useCallback(() => {
        if (!FEATURE_DARK_THEME) return;
        clearStoredColorScheme();
        setStoredOverride(null);
    }, []);

    const value = useMemo(
        () => ({
            effectiveMode,
            storedOverride: FEATURE_DARK_THEME ? storedOverride : null,
            darkThemeFeatureEnabled: FEATURE_DARK_THEME,
            isDarkPreviewPath,
            setOverrideLight,
            setOverrideDark,
            resetOverride,
            muiTheme,
        }),
        [
            effectiveMode,
            storedOverride,
            isDarkPreviewPath,
            setOverrideLight,
            setOverrideDark,
            resetOverride,
            muiTheme,
        ]
    );

    const emotionCache = isRTL ? rtlCache : ltrCache;

    return (
        <ThemeModeContext.Provider value={value}>
            <CacheProvider value={emotionCache}>
                <MuiThemeProvider theme={muiTheme}>{children}</MuiThemeProvider>
            </CacheProvider>
        </ThemeModeContext.Provider>
    );
}

export function useThemeMode() {
    const ctx = useContext(ThemeModeContext);
    if (!ctx) {
        throw new Error('useThemeMode must be used within ThemeModeProvider');
    }
    return ctx;
}
