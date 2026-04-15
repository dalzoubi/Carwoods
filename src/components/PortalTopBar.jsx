import React, { useRef, useState } from 'react';
import {
  AppBar,
  Box,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import SettingsBrightness from '@mui/icons-material/SettingsBrightness';
import LightMode from '@mui/icons-material/LightMode';
import DarkMode from '@mui/icons-material/DarkMode';
import RestartAlt from '@mui/icons-material/RestartAlt';
import LanguageIcon from '@mui/icons-material/Language';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { isDarkPreviewRoute, stripDarkPreviewPrefix } from '../routePaths';
import { useThemeMode } from '../ThemeModeContext';
import { useLanguage } from '../LanguageContext';
import { FEATURE_DARK_THEME } from '../featureFlags';
import PortalNotificationsTray from './PortalNotificationsTray';
import { PortalAccountMenu, PortalAccountMenuAvatarTrigger } from './PortalAccountMenu';

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
    '/portal/inbox': t('portalLayout.sidebar.inbox'),
    '/portal/inbox/notifications': t('portalNotificationsInbox.heading'),
    '/portal/inbox/contact': t('portalLayout.sidebar.adminContactUsMessages'),
    '/portal/properties': t('portalLayout.sidebar.properties'),
    '/portal/status': t('portalLayout.sidebar.status'),
    '/portal/admin/health/notification-test': t('portalLayout.sidebar.notificationTest'),
  };
  return titles[normalized] || t('portalLayout.sidebar.dashboard');
}

const PortalTopBar = ({ onMenuClick, isMobile }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isAuthenticated } = usePortalAuth();
  const notificationsTrayRef = useRef(null);
  const pageTitle = usePageTitle(t);

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
  const [accountAnchor, setAccountAnchor] = useState(null);

  const handleAppearanceOpen = (e) => {
    setLanguageAnchor(null);
    setAccountAnchor(null);
    notificationsTrayRef.current?.close();
    setAppearanceAnchor(e.currentTarget);
  };
  const handleAppearanceClose = () => setAppearanceAnchor(null);

  const handleLanguageOpen = (e) => {
    setAppearanceAnchor(null);
    notificationsTrayRef.current?.close();
    setAccountAnchor(null);
    setLanguageAnchor(e.currentTarget);
  };
  const handleLanguageClose = () => setLanguageAnchor(null);

  const handleAccountOpen = (e) => {
    setAppearanceAnchor(null);
    setLanguageAnchor(null);
    notificationsTrayRef.current?.close();
    setAccountAnchor(e.currentTarget);
  };
  const handleAccountClose = () => setAccountAnchor(null);

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

          {isAuthenticated ? (
            <PortalNotificationsTray
              ref={notificationsTrayRef}
              buttonId="portal-notifications-button"
              menuId="portal-notifications-menu"
              onMenuWillOpen={() => {
                setAppearanceAnchor(null);
                setLanguageAnchor(null);
                setAccountAnchor(null);
              }}
            />
          ) : null}

          {isAuthenticated && (
            <PortalAccountMenuAvatarTrigger
              onOpen={handleAccountOpen}
              menuOpen={Boolean(accountAnchor)}
            />
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
            selected={storedLanguageOverride === lang}
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

      <PortalAccountMenu
        anchorEl={accountAnchor}
        open={Boolean(accountAnchor)}
        onClose={handleAccountClose}
      />
    </AppBar>
  );
};

export default PortalTopBar;
