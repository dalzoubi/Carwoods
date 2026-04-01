import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeModeProvider } from './ThemeModeContext';
import { LanguageProvider } from './LanguageContext';
import './i18n';

/** Wraps UI with the same router + language + theme providers as production. */
export function WithAppTheme({ children }) {
    return (
        <BrowserRouter>
            <LanguageProvider>
                <ThemeModeProvider>{children}</ThemeModeProvider>
            </LanguageProvider>
        </BrowserRouter>
    );
}
