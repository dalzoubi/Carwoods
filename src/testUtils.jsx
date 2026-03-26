import React from 'react';
import { ThemeModeProvider } from './ThemeModeContext';

/** Wraps UI with the same theme + color-scheme providers as production. */
export function WithAppTheme({ children }) {
    return <ThemeModeProvider>{children}</ThemeModeProvider>;
}
