import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ThemeModeProvider } from './ThemeModeContext';
import { LanguageProvider } from './LanguageContext';
import { PortalAuthProvider } from './PortalAuthContext';
import './i18n';

/** Wraps UI with the same router + language + theme + portal-auth providers as production. */
export function WithAppTheme({ children }) {
    return (
        <HelmetProvider>
            <BrowserRouter>
                <LanguageProvider>
                    <ThemeModeProvider>
                        <PortalAuthProvider>{children}</PortalAuthProvider>
                    </ThemeModeProvider>
                </LanguageProvider>
            </BrowserRouter>
        </HelmetProvider>
    );
}
