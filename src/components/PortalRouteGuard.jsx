import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePortalAuth } from '../PortalAuthContext';
import { resolveRole, normalizeRole } from '../portalUtils';

/**
 * Wraps a portal route so that users who lack access are redirected to
 * the portal home page (/portal) instead of seeing the page.
 *
 * Props:
 *   allowedRoles  – array of Role constants; if provided, user's normalized
 *                  role must be in the list.
 *   allow         – optional function (role: string) => boolean; custom
 *                  predicate for more flexible checks.
 *
 * While /me is still loading we render nothing (the PortalAuthGate spinner
 * already covers this case; we just avoid a flash-redirect).
 */
const PortalRouteGuard = ({ children, allowedRoles, allow }) => {
  const { isAuthenticated, account, meData, meStatus } = usePortalAuth();

  // Still resolving the user profile — wait before deciding.
  if (isAuthenticated && meStatus === 'loading') {
    return null;
  }

  const role = normalizeRole(resolveRole(meData, account));

  const permitted = allow
    ? allow(role)
    : Array.isArray(allowedRoles) && allowedRoles.includes(role);

  if (!permitted) {
    return <Navigate to="/portal" replace />;
  }

  return children;
};

export default PortalRouteGuard;
