import React from 'react';
import {
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { usePortalAuth } from '../PortalAuthContext';
import { normalizeRole, resolveRole } from '../portalUtils';
import { Role } from '../domain/constants.js';
import { withDarkPath } from '../routePaths';
import PortalAdminContactRequests from './PortalAdminContactRequests';

/**
 * Redirect legacy /portal/notifications → /portal/inbox/notifications (preserves /dark prefix).
 */
export function RedirectPortalNotificationsToInbox() {
  const { pathname } = useLocation();
  return (
    <Navigate to={withDarkPath(pathname, '/portal/inbox/notifications')} replace />
  );
}

/**
 * Redirect legacy /portal/admin/contact-requests → /portal/inbox/contact (preserves hash + /dark).
 */
export function RedirectLegacyContactRequestsToInbox() {
  const { pathname, hash } = useLocation();
  const target = `${withDarkPath(pathname, '/portal/inbox/contact')}${hash || ''}`;
  return <Navigate to={target} replace />;
}

/**
 * Admin-only tab body; non-admins are sent to the notifications tab.
 */
export function PortalInboxContactGate() {
  const { pathname } = useLocation();
  const { account, meData, meStatus } = usePortalAuth();

  // useMeProfile starts as `idle` then moves to `loading` on the next tick. Until /me returns,
  // resolveRole(null) is '' — without waiting on `idle`, a full page refresh wrongly redirects here.
  if (meStatus === 'loading' || meStatus === 'idle') {
    return (
      <Box display="flex" justifyContent="center" py={6} aria-busy="true">
        <CircularProgress />
      </Box>
    );
  }

  const role = normalizeRole(resolveRole(meData, account));
  if (role !== Role.ADMIN) {
    return (
      <Navigate to={withDarkPath(pathname, '/portal/inbox/notifications')} replace />
    );
  }

  return <PortalAdminContactRequests />;
}

/**
 * Inbox shell: nested routes render as standalone pages, reached from sidebar.
 */
export default function PortalInbox() {
  return (
    <Box>
      <Outlet />
    </Box>
  );
}
