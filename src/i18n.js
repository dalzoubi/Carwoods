import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslation from './locales/en/translation.json';
import esTranslation from './locales/es/translation.json';
import frTranslation from './locales/fr/translation.json';
import arTranslation from './locales/ar/translation.json';
import { readStoredLanguage } from './languagePreferenceStorage';

export const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'ar'];
export const RTL_LANGUAGES = new Set(['ar']);

/** Returns 'rtl' for RTL languages, 'ltr' otherwise. */
export function getDirection(lang) {
    return RTL_LANGUAGES.has(lang) ? 'rtl' : 'ltr';
}

const storedLang = readStoredLanguage();
const initialLanguage = SUPPORTED_LANGUAGES.includes(storedLang) ? storedLang : 'en';

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
