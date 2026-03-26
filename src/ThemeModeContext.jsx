import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { FEATURE_DARK_THEME } from './featureFlags';
import { buildTheme, applyThemeCssVariables } from './theme';
import { clearStoredColorScheme, readStoredColorScheme, writeStoredColorScheme } from './themePreferenceStorage';

const ThemeModeContext = createContext(null);

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
 * @returns {'light' | 'dark'}
 */
function resolveEffectiveMode(storedOverride) {
    if (!FEATURE_DARK_THEME) return 'light';
    if (storedOverride === 'light' || storedOverride === 'dark') return storedOverride;
    return getSystemPrefersDark() ? 'dark' : 'light';
}

export function ThemeModeProvider({ children }) {
    const [storedOverride, setStoredOverride] = useState(() =>
        FEATURE_DARK_THEME ? readStoredColorScheme() : null
    );
    const [systemDark, setSystemDark] = useState(() => (FEATURE_DARK_THEME ? getSystemPrefersDark() : false));

    useEffect(() => {
        if (!FEATURE_DARK_THEME) return undefined;
        if (typeof window.matchMedia !== 'function') return undefined;
        let mq;
        try {
            mq = window.matchMedia('(prefers-color-scheme: dark)');
        } catch {
            return undefined;
        }
        const handler = () => setSystemDark(mq.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    const effectiveMode = useMemo(
        () => resolveEffectiveMode(storedOverride),
        [storedOverride, systemDark]
    );

    const muiTheme = useMemo(() => buildTheme(effectiveMode), [effectiveMode]);

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
            setOverrideLight,
            setOverrideDark,
            resetOverride,
            muiTheme,
        }),
        [
            effectiveMode,
            storedOverride,
            setOverrideLight,
            setOverrideDark,
            resetOverride,
            muiTheme,
        ]
    );

    return (
        <ThemeModeContext.Provider value={value}>
            <MuiThemeProvider theme={muiTheme}>{children}</MuiThemeProvider>
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
