import React from 'react';
import { usePortalAuth } from '../PortalAuthContext';
import PortalLoginLanding from './PortalLoginLanding';

const PortalAuthGate = ({ children }) => {
  const { isAuthenticated } = usePortalAuth();

  if (!isAuthenticated) {
    return <PortalLoginLanding />;
  }

  return children;
};

export default PortalAuthGate;
