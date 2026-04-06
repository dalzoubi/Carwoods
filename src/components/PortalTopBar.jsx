import React, { useState } from 'react';
import {
  AppBar,
  Avatar,
  Box,
  CircularProgress,
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
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { isDarkPreviewRoute, stripDarkPreviewPrefix, withDarkPath } from '../routePaths';
import { useThemeMode } from '../ThemeModeContext';
import { useLanguage } from '../LanguageContext';
import { FEATURE_DARK_THEME } from '../featureFlags';

function usePageTitle(t) {
  const { pathname } = useLocation();
  const normalized = stripDarkPreviewPrefix(pathname);

  const titles = {
    '/portal': t('portalLayout.sidebar.dashboard'),
    '/portal/requests': t('portalLayout.sidebar.requests'),
    '/portal/profile': t('portalLayout.sidebar.profile'),
    '/portal/admin': t('portalLayout.sidebar.adminLandlords'),
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

const PortalTopBar = ({ onMenuClick, isMobile }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isAuthenticated, meData, meStatus } = usePortalAuth();
  const initials = userInitials(meData);
  const meLoading = isAuthenticated && meStatus === 'loading';
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

  const handleAppearanceOpen = (e) => {
    setLanguageAnchor(null);
    setAppearanceAnchor(e.currentTarget);
  };
  const handleAppearanceClose = () => setAppearanceAnchor(null);

  const handleLanguageOpen = (e) => {
    setAppearanceAnchor(null);
    setLanguageAnchor(e.currentTarget);
  };
  const handleLanguageClose = () => setLanguageAnchor(null);

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
              <Tooltip title={t('portalLayout.sidebar.profile')} arrow>
                <IconButton
                  component={RouterLink}
                  to={withDarkPath(pathname, '/portal/profile')}
                  type="button"
                  size="small"
                  aria-label={t('portalLayout.sidebar.profile')}
                  sx={{ marginInlineStart: 0.5 }}
                >
                  <Avatar
                    sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.8rem' }}
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
    </AppBar>
  );
};

export default PortalTopBar;
