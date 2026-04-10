import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import CssBaseline from '@mui/material/CssBaseline';
import './i18n';
import './index.css';
import App from './App';
import { ThemeModeProvider } from './ThemeModeContext';
import { LanguageProvider } from './LanguageContext';
import { PortalAuthProvider } from './PortalAuthContext';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <ThemeModeProvider>
          <PortalAuthProvider>
            <CssBaseline />
            <App />
          </PortalAuthProvider>
        </ThemeModeProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
);

reportWebVitals();
