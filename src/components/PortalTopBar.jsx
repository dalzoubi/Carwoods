import React, { useMemo, useState } from 'react';
import {
  AppBar,
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
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
import Build from '@mui/icons-material/Build';
import Chat from '@mui/icons-material/Chat';
import Update from '@mui/icons-material/Update';
import Notes from '@mui/icons-material/Notes';
import PersonAdd from '@mui/icons-material/PersonAdd';
import Email from '@mui/icons-material/Email';
import Warning from '@mui/icons-material/Warning';
import Close from '@mui/icons-material/Close';
import DoneAll from '@mui/icons-material/DoneAll';
import Science from '@mui/icons-material/Science';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { isDarkPreviewRoute, stripDarkPreviewPrefix, withDarkPath } from '../routePaths';
import { useThemeMode } from '../ThemeModeContext';
import { useLanguage } from '../LanguageContext';
import { FEATURE_DARK_THEME, notificationsPollIntervalMs } from '../featureFlags';
import { isGuestRole, normalizeRole, resolveDisplayName, resolveRole } from '../portalUtils';
import { Role } from '../domain/constants.js';
import PortalSignOutConfirmDialog from './PortalSignOutConfirmDialog';
import PortalUserAvatar from './PortalUserAvatar';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from '../lib/portalApiClient';
import { relativeTime } from '../lib/notificationUtils';
import {
  addTrayHiddenId,
  loadTrayHiddenIds,
  selectNotificationsForTray,
} from '../lib/notificationTrayPrefs';

function notificationEventIcon(eventTypeCode) {
  const code = String(eventTypeCode ?? '').toUpperCase();
  if (code === 'REQUEST_CREATED') return <Build sx={{ fontSize: 16 }} />;
  if (code === 'REQUEST_UPDATED') return <Update sx={{ fontSize: 16 }} />;
  if (code === 'REQUEST_MESSAGE_CREATED' || code === 'LANDLORD_MESSAGE_POSTED') return <Chat sx={{ fontSize: 16 }} />;
  if (code === 'REQUEST_INTERNAL_NOTE') return <Notes sx={{ fontSize: 16 }} />;
  if (code === 'ACCOUNT_ONBOARDED_WELCOME') return <PersonAdd sx={{ fontSize: 16 }} />;
  if (code === 'ACCOUNT_EMAIL_VERIFICATION') return <Email sx={{ fontSize: 16 }} />;
  if (code === 'SECURITY_NOTIFICATION_DELIVERY_FAILURE') return <Warning sx={{ fontSize: 16 }} color="warning" />;
  if (code === 'ADMIN_NOTIFICATION_TEST') return <Science sx={{ fontSize: 16 }} />;
  return <NotificationsNone sx={{ fontSize: 16 }} />;
}

function resolvedBody(notification) {
  const meta = notification.metadata_json;
  if (meta && typeof meta === 'object' && typeof meta.ai_summary === 'string' && meta.ai_summary.trim()) {
    return meta.ai_summary.trim();
  }
  return notification.body;
}

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
    '/portal/notifications': t('portalNotificationsInbox.heading'),
    '/portal/properties': t('portalLayout.sidebar.properties'),
    '/portal/status': t('portalLayout.sidebar.status'),
    '/portal/admin/health/notification-test': t('portalLayout.sidebar.notificationTest'),
  };
  return titles[normalized] || t('portalLayout.sidebar.dashboard');
}

function portalRoleLabel(role, t) {
  const n = normalizeRole(role);
  if (n === Role.ADMIN) return t('portalHeader.roles.admin');
  if (n === Role.LANDLORD) return t('portalHeader.roles.landlord');
  if (n === Role.TENANT) return t('portalHeader.roles.tenant');
  return t('portalHeader.roles.unknown');
}

const PortalTopBar = ({ onMenuClick, isMobile }) => {
  const { t, i18n } = useTranslation();
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
  const [dismissingIds, setDismissingIds] = useState(new Set());
  const [markingAll, setMarkingAll] = useState(false);
  const [trayHiddenIds, setTrayHiddenIds] = useState(() => new Set());

  const trayUserKey = account?.uid || account?.username || '';

  React.useEffect(() => {
    if (!trayUserKey) {
      setTrayHiddenIds(new Set());
      return;
    }
    setTrayHiddenIds(loadTrayHiddenIds(trayUserKey));
  }, [trayUserKey]);

  const trayNotifications = useMemo(
    () => selectNotificationsForTray(notifications, trayHiddenIds),
    [notifications, trayHiddenIds]
  );

  const loadNotifications = React.useCallback(async (options = {}) => {
    const silent = Boolean(options.silent);
    if (!isAuthenticated || !baseUrl) return;
    if (!silent) setNotificationsLoading(true);
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
      if (!silent) setNotificationsLoading(false);
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

  const handleDismissNotification = async (e, notification) => {
    e.stopPropagation();
    if (!trayUserKey || dismissingIds.has(notification.id)) return;
    setDismissingIds((prev) => new Set(prev).add(notification.id));
    try {
      if (!notification.read_at && baseUrl) {
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
      }
      setTrayHiddenIds((prev) => addTrayHiddenId(trayUserKey, notification.id, prev));
    } catch (error) {
      handleApiForbidden?.(error);
    } finally {
      setDismissingIds((prev) => { const next = new Set(prev); next.delete(notification.id); return next; });
    }
  };

  const handleMarkAllRead = async () => {
    if (!baseUrl || markingAll) return;
    setMarkingAll(true);
    try {
      const token = await getAccessToken();
      await markAllNotificationsRead(baseUrl, token, { emailHint: account?.username || undefined });
      setNotifications((items) => items.map((item) => ({
        ...item,
        read_at: item.read_at || new Date().toISOString(),
      })));
      setUnreadCount(0);
    } catch (error) {
      handleApiForbidden?.(error);
    } finally {
      setMarkingAll(false);
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
    const trayOpen = Boolean(notificationsAnchor);
    const intervalMs = notificationsPollIntervalMs(trayOpen);
    const timerId = window.setInterval(() => {
      void loadNotifications({ silent: true });
    }, intervalMs);
    return () => window.clearInterval(timerId);
  }, [isAuthenticated, loadNotifications, notificationsAnchor]);

  React.useEffect(() => {
    if (!isAuthenticated) return undefined;
    const refresh = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void loadNotifications({ silent: true });
    };
    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refresh();
      }
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
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
                  <PortalUserAvatar
                    meData={meData}
                    firstName={meData?.user?.first_name}
                    lastName={meData?.user?.last_name}
                    size={36}
                  />
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
        slotProps={{ paper: { sx: { backgroundImage: 'none', minWidth: 340, maxWidth: 440 } } }}
        MenuListProps={{ 'aria-labelledby': 'portal-notifications-button', disablePadding: true }}
      >
        {/* Header */}
        <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Box>
            <Typography variant="subtitle2">{t('portalHeader.notifications.title')}</Typography>
            {unreadCount > 0 && (
              <Typography variant="caption" color="text.secondary">
                {t('portalHeader.notifications.unreadCount', { count: unreadCount })}
              </Typography>
            )}
          </Box>
          {unreadCount > 0 && (
            <Tooltip title={t('portalHeader.notifications.markAllRead')} arrow>
              <span>
                <IconButton
                  size="small"
                  onClick={handleMarkAllRead}
                  disabled={markingAll}
                  aria-label={t('portalHeader.notifications.markAllRead')}
                >
                  {markingAll ? <CircularProgress size={14} /> : <DoneAll fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Box>
        <Divider />

        {/* Items */}
        {notificationsLoading ? (
          <Box sx={{ px: 2, py: 3, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={18} />
          </Box>
        ) : notifications.length === 0 ? (
          <Box sx={{ px: 2, py: 2.5 }}>
            <Typography variant="body2" color="text.secondary">
              {t('portalHeader.notifications.empty')}
            </Typography>
          </Box>
        ) : trayNotifications.length === 0 ? (
          <Box sx={{ px: 2, py: 2.5 }}>
            <Typography variant="body2" color="text.secondary">
              {t('portalHeader.notifications.emptyTrayFiltered')}
            </Typography>
          </Box>
        ) : trayNotifications.map((notification) => {
          const isUnread = !notification.read_at;
          const isDismissing = dismissingIds.has(notification.id);
          return (
            <Box
              key={notification.id}
              onClick={() => { void handleNotificationClick(notification); }}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                px: 2,
                py: 1.25,
                cursor: 'pointer',
                backgroundColor: isUnread ? 'action.hover' : 'transparent',
                '&:hover': { backgroundColor: 'action.focus' },
                transition: 'background-color 0.15s',
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box sx={{ mt: 0.2, color: isUnread ? 'primary.main' : 'text.disabled', flexShrink: 0 }}>
                {notificationEventIcon(notification.event_type_code)}
              </Box>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={isUnread ? 700 : 500} noWrap>
                  {notification.title}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {resolvedBody(notification)}
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.25 }}>
                  {notification.created_at ? relativeTime(notification.created_at, i18n.language) : ''}
                </Typography>
              </Box>

              <Tooltip title={t('portalHeader.notifications.dismiss')} arrow>
                <span>
                  <IconButton
                    size="small"
                    onClick={(e) => { void handleDismissNotification(e, notification); }}
                    disabled={isDismissing}
                    aria-label={t('portalHeader.notifications.dismiss')}
                    sx={{ mt: -0.5, flexShrink: 0 }}
                  >
                    {isDismissing ? <CircularProgress size={12} /> : <Close sx={{ fontSize: 14 }} />}
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          );
        })}

        {/* Footer */}
        <Divider />
        <Box sx={{ px: 1, py: 0.5 }}>
          <Button
            component="a"
            href={withDarkPath(pathname, '/portal/notifications')}
            onClick={(e) => {
              e.preventDefault();
              handleNotificationsClose();
              navigate(withDarkPath(pathname, '/portal/notifications'));
            }}
            size="small"
            sx={{ textTransform: 'none', width: '100%', justifyContent: 'center' }}
          >
            {t('portalHeader.notifications.viewAll')}
          </Button>
        </Box>
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
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <Box sx={{ flex: 1, minWidth: 0 }}>
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
            <PortalUserAvatar
              meData={meData}
              firstName={meData?.user?.first_name}
              lastName={meData?.user?.last_name}
              size={36}
            />
          </Stack>
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
