import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePortalAuth } from '../PortalAuthContext';
import { resolveRole, normalizeRole } from '../portalUtils';

/**
 * Wraps a portal route so that users who lack access are redirected to
 * the portal home page (/portal) instead of seeing the page.
 *
 * Props:
 *   allowedRoles  – array of Role constants; if provided, the user's
 *                  normalized role must be in the list.
 *   allow         – optional function (role: string) => boolean; custom
 *                  predicate for more flexible checks.
 *
 * The guard only acts once the /me profile has fully resolved
 * (meStatus === 'ok'). While the profile is still loading or the API is
 * not configured (meStatus 'idle'/'loading'), children are rendered as-is
 * so that a page refresh does not wrongly redirect the user before their
 * role is known.
 */
const PortalRouteGuard = ({ children, allowedRoles, allow }) => {
  const { account, meData, meStatus } = usePortalAuth();

  // Wait until the role is definitively known before making an access decision.
  // 'idle'  – no API configured or not yet started (e.g. right after refresh).
  // 'loading' – in-flight; don't redirect prematurely.
  // 'error'   – keep the user where they are; the page component can show its
  //             own error or the auth gate will handle a 403 sign-out.
  if (meStatus !== 'ok') {
    return children;
  }

  const role = normalizeRole(resolveRole(meData, account));

  const permitted = allow
    ? allow(role)
    : Array.isArray(allowedRoles) && allowedRoles.includes(role);

  if (!permitted) {
    return <Navigate to="/portal" replace state={{ portalAccessDenied: true }} />;
  }

  return children;
};

export default PortalRouteGuard;
