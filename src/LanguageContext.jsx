import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, getDirection, resolveBrowserLanguage } from './i18n';
import {
    clearStoredLanguage,
    readValidStoredLanguage,
    writeStoredLanguage,
} from './languagePreferenceStorage';

const LanguageContext = createContext(null);
export { LanguageContext };

export function LanguageProvider({ children }) {
    const { i18n } = useTranslation();

    const [storedOverride, setStoredOverride] = useState(() =>
        readValidStoredLanguage(SUPPORTED_LANGUAGES)
    );

    const [currentLanguage, setCurrentLanguage] = useState(() => {
        const override = readValidStoredLanguage(SUPPORTED_LANGUAGES);
        if (override) return override;
        const raw = String(i18n.language || 'en').toLowerCase().replace(/_/g, '-');
        const base = raw.split('-')[0];
        if (SUPPORTED_LANGUAGES.includes(raw)) return raw;
        if (SUPPORTED_LANGUAGES.includes(base)) return base;
        return resolveBrowserLanguage();
    });

    const direction = useMemo(() => getDirection(currentLanguage), [currentLanguage]);

    // Keep the HTML dir attribute in sync with the language direction.
    useEffect(() => {
        document.documentElement.setAttribute('dir', direction);
        document.documentElement.setAttribute('lang', currentLanguage);
    }, [direction, currentLanguage]);

    useEffect(() => {
        let cancelled = false;
        const onBrowserLanguageChange = () => {
            if (readValidStoredLanguage(SUPPORTED_LANGUAGES) !== null) return;
            const next = resolveBrowserLanguage();
            void (async () => {
                if (cancelled || i18n.language === next) return;
                await i18n.changeLanguage(next);
                if (!cancelled) setCurrentLanguage(next);
            })();
        };
        window.addEventListener('languagechange', onBrowserLanguageChange);
        return () => {
            cancelled = true;
            window.removeEventListener('languagechange', onBrowserLanguageChange);
        };
    }, [i18n]);

    const changeLanguage = useCallback(
        async (lang) => {
            if (!SUPPORTED_LANGUAGES.includes(lang)) return;
            writeStoredLanguage(lang);
            setStoredOverride(lang);
            await i18n.changeLanguage(lang);
            setCurrentLanguage(lang);
        },
        [i18n]
    );

    const resetLanguagePreference = useCallback(async () => {
        clearStoredLanguage();
        setStoredOverride(null);
        const next = resolveBrowserLanguage();
        await i18n.changeLanguage(next);
        setCurrentLanguage(next);
    }, [i18n]);

    const value = useMemo(
        () => ({
            currentLanguage,
            direction,
            isRTL: direction === 'rtl',
            supportedLanguages: SUPPORTED_LANGUAGES,
            storedLanguageOverride: storedOverride,
            changeLanguage,
            resetLanguagePreference,
        }),
        [currentLanguage, direction, storedOverride, changeLanguage, resetLanguagePreference]
    );

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const ctx = useContext(LanguageContext);
    if (!ctx) {
        throw new Error('useLanguage must be used within LanguageProvider');
    }
    return ctx;
}
