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
import HelpOutline from '@mui/icons-material/HelpOutline';
import RestartAlt from '@mui/icons-material/RestartAlt';
import LanguageIcon from '@mui/icons-material/Language';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { stripDarkPreviewPrefix } from '../routePaths';
import { useLanguage } from '../LanguageContext';
import PortalNotificationsTray from './PortalNotificationsTray';
import { PortalAccountMenu, PortalAccountMenuAvatarTrigger } from './PortalAccountMenu';
import { usePortalTour } from '../PortalTourContext';

function usePageTitle(t) {
  const { pathname } = useLocation();
  const normalized = stripDarkPreviewPrefix(pathname);

  const titles = {
    '/portal': t('portalLayout.sidebar.dashboard'),
    '/portal/requests': t('portalLayout.sidebar.requests'),
    '/portal/documents': t('portalLayout.sidebar.documents'),
    '/portal/profile': t('portalLayout.sidebar.profile'),
    '/portal/admin': t('portalLayout.sidebar.adminLandlords'),
    '/portal/admin/landlords': t('portalLayout.sidebar.adminLandlords'),
    '/portal/admin/ai': t('portalLayout.sidebar.adminConfigurations'),
    '/portal/admin/config': t('portalLayout.sidebar.adminConfigurations'),
    '/portal/inbox': t('portalLayout.sidebar.inbox'),
    '/portal/inbox/requests': t('portalLayout.sidebar.requests'),
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
  const { isAuthenticated } = usePortalAuth();
  const { openTour } = usePortalTour();
  const notificationsTrayRef = useRef(null);
  const pageTitle = usePageTitle(t);

  const {
    supportedLanguages,
    storedLanguageOverride,
    changeLanguage,
    resetLanguagePreference,
  } = useLanguage();

  const [languageAnchor, setLanguageAnchor] = useState(null);
  const [accountAnchor, setAccountAnchor] = useState(null);

  const handleLanguageOpen = (e) => {
    notificationsTrayRef.current?.close();
    setAccountAnchor(null);
    setLanguageAnchor(e.currentTarget);
  };
  const handleLanguageClose = () => setLanguageAnchor(null);

  const handleAccountOpen = (e) => {
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
            id="portal-tour-mobile-menu"
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
          <Tooltip title={t('portalTour.helpTooltip')} arrow>
            <IconButton
              type="button"
              size="small"
              id="portal-tour-help"
              onClick={() => {
                setLanguageAnchor(null);
                setAccountAnchor(null);
                notificationsTrayRef.current?.close();
                openTour();
              }}
              aria-label={t('portalTour.helpAria')}
            >
              <HelpOutline fontSize="small" />
            </IconButton>
          </Tooltip>

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
