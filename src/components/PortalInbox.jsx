import React from 'react';
import {
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { usePortalAuth } from '../PortalAuthContext';
import { normalizeRole, resolveRole } from '../portalUtils';
import { Role } from '../domain/constants.js';
import { stripDarkPreviewPrefix, withDarkPath } from '../routePaths';
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

  if (meStatus === 'loading') {
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
 * Inbox shell: tabs (notifications + Contact Us for admins) and nested routes.
 */
export default function PortalInbox() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { account, meData, meStatus } = usePortalAuth();

  const normalizedPath = stripDarkPreviewPrefix(pathname);
  const tabValue =
    normalizedPath.endsWith('/contact') ? 'contact' : 'notifications';

  const showContactTab =
    meStatus !== 'loading' && normalizeRole(resolveRole(meData, account)) === Role.ADMIN;

  const handleTabChange = (_e, value) => {
    if (value === 'contact') {
      navigate(withDarkPath(pathname, '/portal/inbox/contact'));
    } else {
      navigate(withDarkPath(pathname, '/portal/inbox/notifications'));
    }
  };

  return (
    <Box>
      {showContactTab ? (
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            marginBlockEnd: 2,
          }}
          aria-label={t('portalInbox.tabsLabel')}
        >
          <Tab value="notifications" label={t('portalLayout.sidebar.notifications')} />
          <Tab value="contact" label={t('portalLayout.sidebar.adminContactUsMessages')} />
        </Tabs>
      ) : null}
      <Outlet />
    </Box>
  );
}
