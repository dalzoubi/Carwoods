import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeModeProvider } from './ThemeModeContext';

/** Wraps UI with the same router + theme providers as production. */
export function WithAppTheme({ children }) {
    return (
        <BrowserRouter>
            <ThemeModeProvider>{children}</ThemeModeProvider>
        </BrowserRouter>
    );
}
