import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeModeProvider } from './ThemeModeContext';
import { LanguageProvider } from './LanguageContext';
import { PortalAuthProvider } from './PortalAuthContext';
import './i18n';

/** Wraps UI with the same router + language + theme + portal-auth providers as production. */
export function WithAppTheme({ children }) {
    return (
        <BrowserRouter>
            <LanguageProvider>
                <ThemeModeProvider>
                    <PortalAuthProvider>{children}</PortalAuthProvider>
                </ThemeModeProvider>
            </LanguageProvider>
        </BrowserRouter>
    );
}
