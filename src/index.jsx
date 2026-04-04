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

/*
 * MSAL v5 popup auth uses BroadcastChannel, not URL polling.
 *
 * When the popup redirects back to /portal#code=…&state=…, the popup must
 * parse the hash and post it to a BroadcastChannel named after the state.id
 * so the opener's loginPopup() promise resolves.  MSAL ships a dedicated
 * "redirect bridge" entry point that does exactly this.
 *
 * Detect the callback hash early and call the bridge instead of rendering
 * the full React tree.
 */
const isAuthCallback = (() => {
  if (typeof window === 'undefined') return false;
  const h = window.location.hash;
  return (h.includes('code=') || h.includes('error=')) && h.includes('state=');
})();

if (isAuthCallback) {
  import('@azure/msal-browser/redirect-bridge').then(({ broadcastResponseToMainFrame }) => {
    broadcastResponseToMainFrame().catch(() => {
      // If broadcasting fails, try to close so the opener's timeout fires.
      try { window.close(); } catch { /* browser may block */ }
    });
  });
} else {
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
}
