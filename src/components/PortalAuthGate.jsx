import React from 'react';
import { usePortalAuth } from '../PortalAuthContext';
import PortalLoginLanding from './PortalLoginLanding';

const PortalAuthGate = ({ children }) => {
  const { isAuthenticated, meStatus } = usePortalAuth();

  // Hold the gate while /me is still in-flight after sign-in so the portal
  // content never flashes before access is confirmed.
  const awaitingMeCheck = isAuthenticated && meStatus === 'loading';

  if (!isAuthenticated || awaitingMeCheck) {
    return <PortalLoginLanding />;
  }

  return children;
};

export default PortalAuthGate;
