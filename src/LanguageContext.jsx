import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, getDirection } from './i18n';
import { readStoredLanguage, writeStoredLanguage } from './languagePreferenceStorage';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
    const { i18n } = useTranslation();

    const [currentLanguage, setCurrentLanguage] = useState(
        () => readStoredLanguage() || i18n.language || 'en'
    );

    const direction = useMemo(() => getDirection(currentLanguage), [currentLanguage]);

    // Keep the HTML dir attribute in sync with the language direction.
    useEffect(() => {
        document.documentElement.setAttribute('dir', direction);
        document.documentElement.setAttribute('lang', currentLanguage);
    }, [direction, currentLanguage]);

    const changeLanguage = useCallback(
        async (lang) => {
            if (!SUPPORTED_LANGUAGES.includes(lang)) return;
            await i18n.changeLanguage(lang);
            writeStoredLanguage(lang);
            setCurrentLanguage(lang);
        },
        [i18n]
    );

    const value = useMemo(
        () => ({
            currentLanguage,
            direction,
            isRTL: direction === 'rtl',
            supportedLanguages: SUPPORTED_LANGUAGES,
            changeLanguage,
        }),
        [currentLanguage, direction, changeLanguage]
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
