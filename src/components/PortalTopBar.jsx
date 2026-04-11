import React, { useMemo, useState } from 'react';
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import NotificationsNone from '@mui/icons-material/NotificationsNone';
import SettingsBrightness from '@mui/icons-material/SettingsBrightness';
import LightMode from '@mui/icons-material/LightMode';
import DarkMode from '@mui/icons-material/DarkMode';
import RestartAlt from '@mui/icons-material/RestartAlt';
import LanguageIcon from '@mui/icons-material/Language';
import Person from '@mui/icons-material/Person';
import Logout from '@mui/icons-material/Logout';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { isDarkPreviewRoute, stripDarkPreviewPrefix, withDarkPath } from '../routePaths';
import { useThemeMode } from '../ThemeModeContext';
import { useLanguage } from '../LanguageContext';
import { FEATURE_DARK_THEME, NOTIFICATIONS_POLL_INTERVAL_MS } from '../featureFlags';
import { isGuestRole, normalizeRole, resolveDisplayName, resolveRole } from '../portalUtils';
import { Role } from '../domain/constants.js';
import PortalSignOutConfirmDialog from './PortalSignOutConfirmDialog';
import { fetchNotifications, markNotificationRead } from '../lib/portalApiClient';

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function usePageTitle(t) {
  const { pathname } = useLocation();
  const normalized = stripDarkPreviewPrefix(pathname);

  const titles = {
    '/portal': t('portalLayout.sidebar.dashboard'),
    '/portal/requests': t('portalLayout.sidebar.requests'),
    '/portal/profile': t('portalLayout.sidebar.profile'),
    '/portal/admin': t('portalLayout.sidebar.adminLandlords'),
    '/portal/admin/landlords': t('portalLayout.sidebar.adminLandlords'),
    '/portal/admin/ai': t('portalLayout.sidebar.adminConfigurations'),
    '/portal/admin/config': t('portalLayout.sidebar.adminConfigurations'),
    '/portal/notifications': t('portalLayout.sidebar.notificationPolicies'),
    '/portal/properties': t('portalLayout.sidebar.properties'),
    '/portal/status': t('portalLayout.sidebar.status'),
  };
  return titles[normalized] || t('portalLayout.sidebar.dashboard');
}

function userInitials(meData) {
  const first = (meData?.user?.first_name ?? '').trim();
  const last = (meData?.user?.last_name ?? '').trim();
  const f = first.charAt(0).toUpperCase();
  const l = last.charAt(0).toUpperCase();
  if (f && l) return `${f}${l}`;
  if (f) return f;
  return '?';
}

function portalRoleLabel(role, t) {
  const n = normalizeRole(role);
  if (n === Role.ADMIN) return t('portalHeader.roles.admin');
  if (n === Role.LANDLORD) return t('portalHeader.roles.landlord');
  if (n === Role.TENANT) return t('portalHeader.roles.tenant');
  return t('portalHeader.roles.unknown');
}

const PortalTopBar = ({ onMenuClick, isMobile }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const {
    isAuthenticated,
    account,
    meData,
    meStatus,
    signOut,
    getAccessToken,
    baseUrl,
    handleApiForbidden,
  } = usePortalAuth();
  const initials = userInitials(meData);
  const meLoading = isAuthenticated && meStatus === 'loading';
  const pageTitle = usePageTitle(t);

  const role = resolveRole(meData, account);
  const normalized = normalizeRole(role);
  const isGuest = isGuestRole(normalized);
  const displayName = resolveDisplayName(meData, account, t('portalHeader.notSignedIn'));
  const roleLabel = portalRoleLabel(role, t);

  const {
    storedOverride,
    isDarkPreviewPath,
    setOverrideLight,
    setOverrideDark,
    resetOverride,
  } = useThemeMode();
  const {
    supportedLanguages,
    storedLanguageOverride,
    changeLanguage,
    resetLanguagePreference,
  } = useLanguage();

  const showAppearanceMenu = FEATURE_DARK_THEME || isDarkPreviewRoute(pathname);

  const [appearanceAnchor, setAppearanceAnchor] = useState(null);
  const [languageAnchor, setLanguageAnchor] = useState(null);
  const [notificationsAnchor, setNotificationsAnchor] = useState(null);
  const [accountAnchor, setAccountAnchor] = useState(null);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const sortedNotifications = useMemo(
    () =>
      [...notifications].sort((a, b) => {
        const aMs = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const bMs = b?.created_at ? new Date(b.created_at).getTime() : 0;
        const byCreated = (Number.isFinite(bMs) ? bMs : 0) - (Number.isFinite(aMs) ? aMs : 0);
        if (byCreated !== 0) return byCreated;
        return collator.compare(String(a?.id ?? ''), String(b?.id ?? ''));
      }),
    [notifications]
  );

  const loadNotifications = React.useCallback(async () => {
    if (!isAuthenticated || !baseUrl) return;
    setNotificationsLoading(true);
    try {
      const token = await getAccessToken();
      const payload = await fetchNotifications(baseUrl, token, {
        emailHint: account?.username || undefined,
        limit: 20,
      });
      setNotifications(Array.isArray(payload?.notifications) ? payload.notifications : []);
      setUnreadCount(Number(payload?.unread_count ?? 0));
    } catch (error) {
      handleApiForbidden?.(error);
    } finally {
      setNotificationsLoading(false);
    }
  }, [account?.username, baseUrl, getAccessToken, handleApiForbidden, isAuthenticated]);

  const handleAppearanceOpen = (e) => {
    setLanguageAnchor(null);
    setAccountAnchor(null);
    setAppearanceAnchor(e.currentTarget);
  };
  const handleAppearanceClose = () => setAppearanceAnchor(null);

  const handleLanguageOpen = (e) => {
    setAppearanceAnchor(null);
    setNotificationsAnchor(null);
    setAccountAnchor(null);
    setLanguageAnchor(e.currentTarget);
  };
  const handleLanguageClose = () => setLanguageAnchor(null);

  const handleNotificationsOpen = (e) => {
    setAppearanceAnchor(null);
    setLanguageAnchor(null);
    setAccountAnchor(null);
    setNotificationsAnchor(e.currentTarget);
    void loadNotifications();
  };
  const handleNotificationsClose = () => setNotificationsAnchor(null);

  const handleAccountOpen = (e) => {
    setAppearanceAnchor(null);
    setLanguageAnchor(null);
    setNotificationsAnchor(null);
    setAccountAnchor(e.currentTarget);
  };
  const handleAccountClose = () => setAccountAnchor(null);

  const handleSignOutConfirm = async () => {
    setSignOutOpen(false);
    await signOut();
  };

  const handleNotificationClick = async (notification) => {
    if (!baseUrl) return;
    try {
      const token = await getAccessToken();
      const response = await markNotificationRead(baseUrl, token, notification.id, {
        emailHint: account?.username || undefined,
      });
      if (typeof response?.unread_count === 'number') {
        setUnreadCount(response.unread_count);
      } else {
        setUnreadCount((value) => Math.max(0, value - 1));
      }
      setNotifications((items) => items.map((item) => (
        item.id === notification.id ? { ...item, read_at: item.read_at || new Date().toISOString() } : item
      )));
      if (notification.deep_link) {
        navigate(withDarkPath(pathname, notification.deep_link));
      }
    } catch (error) {
      handleApiForbidden?.(error);
    } finally {
      handleNotificationsClose();
    }
  };

  React.useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    void loadNotifications();
  }, [isAuthenticated, loadNotifications]);

  React.useEffect(() => {
    if (!isAuthenticated) return undefined;
    const timerId = window.setInterval(() => {
      void loadNotifications();
    }, NOTIFICATIONS_POLL_INTERVAL_MS);
    return () => window.clearInterval(timerId);
  }, [isAuthenticated, loadNotifications]);

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        backgroundColor: 'background.paper',
        borderBottom: '1px solid',
        borderInlineStart: isMobile ? 'none' : '1px solid',
        borderColor: 'divider',
        color: 'text.primary',
        backgroundImage: 'none',
      }}
    >
      <Toolbar variant="dense" sx={{ minHeight: 56, px: { xs: 1.5, sm: 2 } }}>
        {isMobile && (
          <IconButton
            type="button"
            edge="start"
            aria-label={t('portalLayout.topBar.openMenu')}
            onClick={onMenuClick}
            sx={{ marginInlineEnd: 1 }}
          >
            <MenuIcon />
          </IconButton>
        )}
        <Typography variant="h6" noWrap component="h1" sx={{ flexGrow: 1, fontSize: '1.125rem', fontWeight: 600 }}>
          {pageTitle}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {showAppearanceMenu && (
            <Tooltip title={t('nav.appearance')} arrow>
              <IconButton
                type="button"
                size="small"
                id="portal-appearance-button"
                onClick={handleAppearanceOpen}
                aria-haspopup="true"
                aria-expanded={Boolean(appearanceAnchor)}
                aria-controls={appearanceAnchor ? 'portal-appearance-menu' : undefined}
                aria-label={t('nav.appearance')}
              >
                <SettingsBrightness fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title={t('nav.language')} arrow>
            <IconButton
              type="button"
              size="small"
              id="portal-language-button"
              onClick={handleLanguageOpen}
              aria-haspopup="true"
              aria-expanded={Boolean(languageAnchor)}
              aria-controls={languageAnchor ? 'portal-language-menu' : undefined}
              aria-label={t('nav.selectLanguage')}
            >
              <LanguageIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {isAuthenticated && (
            <Tooltip title={t('portalHeader.notifications.title')} arrow>
              <IconButton
                type="button"
                size="small"
                id="portal-notifications-button"
                onClick={handleNotificationsOpen}
                aria-haspopup="true"
                aria-expanded={Boolean(notificationsAnchor)}
                aria-controls={notificationsAnchor ? 'portal-notifications-menu' : undefined}
                aria-label={t('portalHeader.notifications.title')}
              >
                <Badge
                  color="error"
                  badgeContent={unreadCount > 99 ? '99+' : unreadCount}
                  invisible={unreadCount <= 0}
                >
                  <NotificationsNone fontSize="small" />
                </Badge>
              </IconButton>
            </Tooltip>
          )}

          {isAuthenticated && (
            meLoading ? (
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginInlineStart: 0.5,
                }}
              >
                <CircularProgress size={20} />
              </Box>
            ) : (
              <Tooltip title={t('portalLayout.topBar.accountMenu')} arrow>
                <IconButton
                  type="button"
                  size="small"
                  id="portal-topbar-account-button"
                  onClick={handleAccountOpen}
                  aria-haspopup="true"
                  aria-expanded={Boolean(accountAnchor)}
                  aria-controls={accountAnchor ? 'portal-topbar-account-menu' : undefined}
                  aria-label={t('portalLayout.topBar.accountMenu')}
                  sx={{ marginInlineStart: 0.5 }}
                >
                  <Avatar
                    sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: '0.875rem' }}
                  >
                    {initials}
                  </Avatar>
                </IconButton>
              </Tooltip>
            )
          )}
        </Box>
      </Toolbar>

      {/* Appearance menu */}
      {showAppearanceMenu && (
        <Menu
          id="portal-appearance-menu"
          anchorEl={appearanceAnchor}
          open={Boolean(appearanceAnchor)}
          onClose={handleAppearanceClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{ paper: { sx: { backgroundImage: 'none' } } }}
          MenuListProps={{ 'aria-labelledby': 'portal-appearance-button' }}
        >
          {isDarkPreviewPath && !FEATURE_DARK_THEME ? (
            <>
              <Typography variant="caption" sx={{ px: 2, pt: 1, pb: 0.5, display: 'block', color: 'text.secondary' }}>
                {t('appearance.darkPreview')}
              </Typography>
              <Typography variant="body2" sx={{ px: 2, pb: 1, maxWidth: 280, color: 'text.secondary' }}>
                {t('appearance.darkPreviewDescription')}
              </Typography>
              <MenuItem
                onClick={() => {
                  navigate(stripDarkPreviewPrefix(pathname));
                  handleAppearanceClose();
                }}
              >
                <LightMode fontSize="small" sx={{ marginInlineEnd: 1 }} />
                {t('appearance.exitPreview')}
              </MenuItem>
            </>
          ) : (
            <>
              <Typography variant="caption" sx={{ px: 2, pt: 1, pb: 0.5, display: 'block', color: 'text.secondary' }}>
                {t('appearance.colorTheme')}
              </Typography>
              <MenuItem
                onClick={() => { setOverrideLight(); handleAppearanceClose(); }}
                selected={storedOverride === 'light'}
              >
                <LightMode fontSize="small" sx={{ marginInlineEnd: 1 }} />
                {t('appearance.light')}
              </MenuItem>
              <MenuItem
                onClick={() => { setOverrideDark(); handleAppearanceClose(); }}
                selected={storedOverride === 'dark'}
              >
                <DarkMode fontSize="small" sx={{ marginInlineEnd: 1 }} />
                {t('appearance.dark')}
              </MenuItem>
              <Divider />
              <MenuItem
                onClick={() => { resetOverride(); handleAppearanceClose(); }}
                disabled={storedOverride === null}
              >
                <RestartAlt fontSize="small" sx={{ marginInlineEnd: 1 }} />
                {t('appearance.useDeviceSetting')}
              </MenuItem>
              <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', color: 'text.secondary', maxWidth: 260 }}>
                {t('appearance.deviceSettingHint')}
              </Typography>
            </>
          )}
        </Menu>
      )}

      {/* Language menu */}
      <Menu
        id="portal-language-menu"
        anchorEl={languageAnchor}
        open={Boolean(languageAnchor)}
        onClose={handleLanguageClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { backgroundImage: 'none' } } }}
        MenuListProps={{ 'aria-labelledby': 'portal-language-button' }}
      >
        {supportedLanguages.map((lang) => (
          <MenuItem
            key={lang}
            lang={lang}
            onClick={() => { changeLanguage(lang); handleLanguageClose(); }}
          >
            {t(`languageNames.${lang}`)}
          </MenuItem>
        ))}
        <Divider />
        <MenuItem
          onClick={() => { void resetLanguagePreference(); handleLanguageClose(); }}
          disabled={storedLanguageOverride === null}
        >
          <RestartAlt fontSize="small" sx={{ marginInlineEnd: 1 }} />
          {t('languagePreference.useBrowserLanguage')}
        </MenuItem>
        <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', color: 'text.secondary', maxWidth: 260 }}>
          {t('languagePreference.browserLanguageHint')}
        </Typography>
      </Menu>

      {/* Notifications menu */}
      <Menu
        id="portal-notifications-menu"
        anchorEl={notificationsAnchor}
        open={Boolean(notificationsAnchor)}
        onClose={handleNotificationsClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { backgroundImage: 'none', minWidth: 320, maxWidth: 420 } } }}
        MenuListProps={{ 'aria-labelledby': 'portal-notifications-button' }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2">{t('portalHeader.notifications.title')}</Typography>
          <Typography variant="caption" color="text.secondary">
            {t('portalHeader.notifications.unreadCount', { count: unreadCount })}
          </Typography>
        </Box>
        <Divider />
        {notificationsLoading ? (
          <Box sx={{ px: 2, py: 2, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={18} />
          </Box>
        ) : sortedNotifications.length === 0 ? (
          <Box sx={{ px: 2, py: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {t('portalHeader.notifications.empty')}
            </Typography>
          </Box>
        ) : sortedNotifications.map((notification) => (
          <MenuItem
            key={notification.id}
            onClick={() => { void handleNotificationClick(notification); }}
            sx={{
              alignItems: 'flex-start',
              backgroundColor: notification.read_at ? 'transparent' : 'action.hover',
              whiteSpace: 'normal',
            }}
          >
            <ListItemText
              primary={notification.title}
              secondary={notification.body}
              primaryTypographyProps={{ variant: 'body2', fontWeight: notification.read_at ? 500 : 700 }}
              secondaryTypographyProps={{ variant: 'caption' }}
            />
          </MenuItem>
        ))}
      </Menu>

      {/* Account menu */}
      <Menu
        id="portal-topbar-account-menu"
        anchorEl={accountAnchor}
        open={Boolean(accountAnchor)}
        onClose={handleAccountClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { backgroundImage: 'none', minWidth: 230 } } }}
        MenuListProps={{ 'aria-labelledby': 'portal-topbar-account-button' }}
      >
        <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {displayName}
          </Typography>
          <Chip
            label={roleLabel}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ height: 20, fontSize: '0.7rem', mt: 0.5 }}
          />
        </Box>
        <Divider />
        <MenuItem
          onClick={() => {
            if (!isGuest) {
              navigate(withDarkPath(pathname, '/portal/profile'));
            }
            handleAccountClose();
          }}
          disabled={isGuest}
        >
          <ListItemIcon>
            <Person fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t('portalHeader.nav.profile')} />
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            handleAccountClose();
            setSignOutOpen(true);
          }}
        >
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t('portalHeader.actions.signOut')} />
        </MenuItem>
      </Menu>

      <PortalSignOutConfirmDialog
        open={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        onConfirm={handleSignOutConfirm}
      />
    </AppBar>
  );
};

export default PortalTopBar;
