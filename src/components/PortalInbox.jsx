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
import { isGuestRole, normalizeRole, resolveRole } from '../portalUtils';
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
 * Inbox shell: tabs (requests + notifications + Contact Us for admins) and nested routes.
 */
export default function PortalInbox() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { account, meData, meStatus } = usePortalAuth();

  const normalizedPath = stripDarkPreviewPrefix(pathname);
  const tabValue = normalizedPath.endsWith('/contact')
    ? 'contact'
    : normalizedPath.endsWith('/notifications')
      ? 'notifications'
      : 'requests';

  const roleResolved = meStatus !== 'loading';
  const role = roleResolved ? normalizeRole(resolveRole(meData, account)) : '';
  const showInboxTabs = roleResolved && !isGuestRole(role);
  const showContactTab = role === Role.ADMIN;

  const handleTabChange = (_e, value) => {
    if (value === 'contact') {
      navigate(withDarkPath(pathname, '/portal/inbox/contact'));
    } else if (value === 'notifications') {
      navigate(withDarkPath(pathname, '/portal/inbox/notifications'));
    } else {
      navigate(withDarkPath(pathname, '/portal/inbox/requests'));
    }
  };

  return (
    <Box>
      {showInboxTabs ? (
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
          <Tab value="requests" label={t('portalLayout.sidebar.requests')} />
          <Tab value="notifications" label={t('portalLayout.sidebar.notifications')} />
          {showContactTab ? (
            <Tab value="contact" label={t('portalLayout.sidebar.adminContactUsMessages')} />
          ) : null}
        </Tabs>
      ) : null}
      <Outlet />
    </Box>
  );
}
