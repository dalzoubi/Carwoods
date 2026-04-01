import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslation from './locales/en/translation.json';
import esTranslation from './locales/es/translation.json';
import frTranslation from './locales/fr/translation.json';
import arTranslation from './locales/ar/translation.json';
import { readValidStoredLanguage } from './languagePreferenceStorage';

export const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'ar'];
export const RTL_LANGUAGES = new Set(['ar']);

/** Returns 'rtl' for RTL languages, 'ltr' otherwise. */
export function getDirection(lang) {
    return RTL_LANGUAGES.has(lang) ? 'rtl' : 'ltr';
}

/**
 * Picks the first supported language from the browser's preference list.
 * Falls back to English when none match.
 */
export function resolveBrowserLanguage() {
    if (typeof navigator === 'undefined') return 'en';
    /** @type {string[]} */
    const candidates = [];
    if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
        candidates.push(...navigator.languages);
    } else if (navigator.language) {
        candidates.push(navigator.language);
    }
    for (const tag of candidates) {
        const norm = String(tag).toLowerCase().replace(/_/g, '-');
        const base = norm.split('-')[0];
        if (SUPPORTED_LANGUAGES.includes(norm)) return norm;
        if (SUPPORTED_LANGUAGES.includes(base)) return base;
    }
    return 'en';
}

const storedOverride = readValidStoredLanguage(SUPPORTED_LANGUAGES);
const initialLanguage = storedOverride ?? resolveBrowserLanguage();

i18n
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: enTranslation },
            es: { translation: esTranslation },
            fr: { translation: frTranslation },
            ar: { translation: arTranslation },
        },
        lng: initialLanguage,
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false,
        },
    });

export default i18n;
