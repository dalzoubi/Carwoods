import React from 'react';
import { usePortalAuth } from '../PortalAuthContext';
import PortalLoginLanding from './PortalLoginLanding';
import PortalLoadingScreen from './PortalLoadingScreen';

const PortalAuthGate = ({ children }) => {
  const { authStatus, isAuthenticated, meStatus } = usePortalAuth();

  // While MSAL is initializing or silently re-authenticating on refresh,
  // show a neutral loading screen — NOT the login page.
  if (authStatus === 'initializing' || authStatus === 'authenticating') {
    return <PortalLoadingScreen />;
  }

  // After sign-in, wait for /me to complete before showing portal content.
  if (isAuthenticated && meStatus === 'loading') {
    return <PortalLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <PortalLoginLanding />;
  }

  return children;
};

export default PortalAuthGate;
