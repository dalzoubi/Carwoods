import React, { useState } from 'react';
import {
  AppBar,
  Avatar,
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
import { FEATURE_DARK_THEME } from '../featureFlags';
import { isGuestRole, normalizeRole, resolveDisplayName, resolveRole } from '../portalUtils';
import { Role } from '../domain/constants.js';
import PortalSignOutConfirmDialog from './PortalSignOutConfirmDialog';

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
  const { isAuthenticated, account, meData, meStatus, signOut } = usePortalAuth();
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
  const [accountAnchor, setAccountAnchor] = useState(null);
  const [signOutOpen, setSignOutOpen] = useState(false);

  const handleAppearanceOpen = (e) => {
    setLanguageAnchor(null);
    setAccountAnchor(null);
    setAppearanceAnchor(e.currentTarget);
  };
  const handleAppearanceClose = () => setAppearanceAnchor(null);

  const handleLanguageOpen = (e) => {
    setAppearanceAnchor(null);
    setAccountAnchor(null);
    setLanguageAnchor(e.currentTarget);
  };
  const handleLanguageClose = () => setLanguageAnchor(null);

  const handleAccountOpen = (e) => {
    setAppearanceAnchor(null);
    setLanguageAnchor(null);
    setAccountAnchor(e.currentTarget);
  };
  const handleAccountClose = () => setAccountAnchor(null);

  const handleSignOutConfirm = async () => {
    setSignOutOpen(false);
    await signOut();
  };

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
                    sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.8rem', border: '1px solid rgba(255,255,255,0.85)', color: 'var(--avatar-on-primary)' }}
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
