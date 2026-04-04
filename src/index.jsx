import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react';
import CssBaseline from '@mui/material/CssBaseline';
import './i18n';
import './index.css';
import App from './App';
import { ThemeModeProvider } from './ThemeModeContext';
import { LanguageProvider } from './LanguageContext';
import { PortalAuthProvider } from './PortalAuthContext';
import { msalInstance } from './entraAuth';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
const appTree = (
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
);

root.render(
  <React.StrictMode>
    {msalInstance ? <MsalProvider instance={msalInstance}>{appTree}</MsalProvider> : appTree}
  </React.StrictMode>
);

reportWebVitals();
