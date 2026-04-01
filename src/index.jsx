import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import CssBaseline from '@mui/material/CssBaseline';
import './i18n';
import './index.css';
import App from './App';
import { ThemeModeProvider } from './ThemeModeContext';
import { LanguageProvider, useLanguage } from './LanguageContext';
import reportWebVitals from './reportWebVitals';

/**
 * Reads direction from LanguageContext and passes isRTL into ThemeModeProvider
 * so MUI theme direction and Emotion cache stay in sync with language selection.
 */
function ThemedApp() {
    const { isRTL } = useLanguage();
    return (
        <ThemeModeProvider isRTL={isRTL}>
            <CssBaseline />
            <App />
        </ThemeModeProvider>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <ThemedApp />
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
);

reportWebVitals();
