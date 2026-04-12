import React from 'react';
import { usePortalAuth } from '../PortalAuthContext';
import PortalLoginLanding from './PortalLoginLanding';
import PortalLoadingScreen from './PortalLoadingScreen';

const PortalAuthGate = ({ children }) => {
  const { authStatus, isAuthenticated, meStatus, meData } = usePortalAuth();

  // While Firebase Auth is initializing or sign-in is in progress,
  // show a neutral loading screen — NOT the login page.
  if (authStatus === 'initializing' || authStatus === 'authenticating') {
    return <PortalLoadingScreen />;
  }

  // After sign-in, wait for the first /me response before showing portal content.
  // Background refreshes should not blank the app once user data already exists.
  if (isAuthenticated && meStatus === 'loading' && !meData) {
    return <PortalLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <PortalLoginLanding />;
  }

  return children;
};

export default PortalAuthGate;
