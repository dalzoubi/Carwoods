import React from 'react';
import { usePortalAuth } from '../PortalAuthContext';
import PortalLoginLanding from './PortalLoginLanding';
import PortalLoadingScreen from './PortalLoadingScreen';
import PortalRoleSelectionGate from './PortalRoleSelectionGate';

const PortalAuthGate = ({ children }) => {
  const { authStatus, isAuthenticated, meStatus, meData, needsRoleSelection } = usePortalAuth();

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

  // Authenticated but no backing user row: show the explicit chooser instead
  // of silently creating a landlord profile (the prior bug).
  if (needsRoleSelection) {
    return <PortalRoleSelectionGate />;
  }

  return children;
};

export default PortalAuthGate;
