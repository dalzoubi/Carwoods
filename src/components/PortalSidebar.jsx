import React, { useState } from 'react';
import { Role } from '../domain/constants.js';
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import Dashboard from '@mui/icons-material/Dashboard';
import Build from '@mui/icons-material/Build';
import Person from '@mui/icons-material/Person';
import SupervisorAccount from '@mui/icons-material/SupervisorAccount';
import MonitorHeart from '@mui/icons-material/MonitorHeart';
import HomeWork from '@mui/icons-material/HomeWork';
import Logout from '@mui/icons-material/Logout';
import ArrowBack from '@mui/icons-material/ArrowBack';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { isGuestRole, normalizeRole, resolveDisplayName, resolveRole } from '../portalUtils';
import { stripDarkPreviewPrefix, withDarkPath } from '../routePaths';
import PortalSignOutConfirmDialog from './PortalSignOutConfirmDialog';
import carwoodsLogo from '../assets/carwoods-logo.png';

export const SIDEBAR_WIDTH = 260;
export const SIDEBAR_COLLAPSED_WIDTH = 84;

function portalRoleLabel(role, t) {
  const n = normalizeRole(role);
  if (n === Role.ADMIN) return t('portalHeader.roles.admin');
  if (n === Role.LANDLORD) return t('portalHeader.roles.landlord');
  if (n === Role.TENANT) return t('portalHeader.roles.tenant');
  return t('portalHeader.roles.unknown');
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

const PortalSidebar = ({ open, onClose, isMobile, collapsed = false }) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const muiTheme = useTheme();
  const { isAuthenticated, account, meData, meStatus, signOut } = usePortalAuth();
  const [signOutOpen, setSignOutOpen] = useState(false);

  const role = resolveRole(meData, account);
  const normalized = normalizeRole(role);
  const isGuest = isGuestRole(normalized);
  const displayName = resolveDisplayName(meData, account, t('portalHeader.notSignedIn'));
  const roleLabel = portalRoleLabel(role, t);
  const initials = userInitials(meData);
  const roleResolved = isAuthenticated && meStatus !== 'loading';

  const normalizedPath = stripDarkPreviewPrefix(pathname);

  const navItems = [
    { key: 'dashboard', to: '/portal', label: t('portalLayout.sidebar.dashboard'), icon: <Dashboard />, exact: true },
    ...(roleResolved && !isGuest
      ? [
          { key: 'requests', to: '/portal/requests', label: t('portalLayout.sidebar.requests'), icon: <Build /> },
          { key: 'profile', to: '/portal/profile', label: t('portalLayout.sidebar.profile'), icon: <Person /> },
        ]
      : []),
    ...(roleResolved && (normalized === Role.LANDLORD || normalized === Role.ADMIN)
      ? [
          { key: 'properties', to: '/portal/properties', label: t('portalLayout.sidebar.properties'), icon: <HomeWork /> },
        ]
      : []),
    ...(normalized === Role.ADMIN
      ? [
          { key: 'admin', to: '/portal/admin', label: t('portalLayout.sidebar.adminLandlords'), icon: <SupervisorAccount /> },
          { key: 'status', to: '/portal/status', label: t('portalLayout.sidebar.status'), icon: <MonitorHeart /> },
        ]
      : []),
  ];

  const handleNavClick = () => {
    if (isMobile) onClose();
  };

  const handleSignOutConfirm = async () => {
    setSignOutOpen(false);
    await signOut();
  };

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Box
        sx={{
          p: collapsed && !isMobile ? 1.5 : 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
          gap: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Box
            component="img"
            src={carwoodsLogo}
            alt={t('common.carwoodsAlt')}
            sx={{ height: 28, filter: (theme) => theme.palette.mode === 'dark' ? 'brightness(1.8)' : 'none' }}
          />
          {(!collapsed || isMobile) && (
            <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700 }}>
              {t('portalHeader.title')}
            </Typography>
          )}
        </Box>
      </Box>
      <Divider />

      <List component="nav" sx={{ flex: 1, px: 1, py: 1.5, overflow: 'auto' }}>
        {navItems.map((item) => {
          const isActive = item.exact
            ? normalizedPath === item.to
            : normalizedPath.startsWith(item.to);
          return (
            <ListItemButton
              key={item.key}
              component={RouterLink}
              to={withDarkPath(pathname, item.to)}
              selected={isActive}
              onClick={handleNavClick}
              sx={{
                borderRadius: 1.5,
                mb: 0.5,
                justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
                '&.Mui-selected': {
                  backgroundColor: 'action.selected',
                  '&:hover': { backgroundColor: 'action.selected' },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: collapsed && !isMobile ? 0 : 40,
                  color: isActive ? 'primary.main' : 'text.secondary',
                  marginInlineEnd: collapsed && !isMobile ? 0 : undefined,
                }}
              >
                {item.icon}
              </ListItemIcon>
              {(!collapsed || isMobile) && (
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'primary.main' : 'text.primary',
                  }}
                />
              )}
            </ListItemButton>
          );
        })}
      </List>

      <Divider />

      {isAuthenticated && (
        <Box sx={{ p: collapsed && !isMobile ? 1.5 : 2 }}>
          {meStatus === 'loading' ? (
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5, justifyContent: collapsed && !isMobile ? 'center' : 'flex-start' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, flexShrink: 0 }}>
                <CircularProgress size={24} />
              </Box>
              {(!collapsed || isMobile) && (
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Skeleton variant="text" width="70%" height={20} />
                  <Skeleton variant="rounded" width={60} height={20} sx={{ mt: 0.5 }} />
                </Box>
              )}
            </Stack>
          ) : (
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5, justifyContent: collapsed && !isMobile ? 'center' : 'flex-start' }}>
              <Tooltip title={t('portalLayout.sidebar.profile')} arrow>
                <IconButton
                  component={RouterLink}
                  to={withDarkPath(pathname, '/portal/profile')}
                  type="button"
                  size="small"
                  aria-label={t('portalLayout.sidebar.profile')}
                >
                  <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: '0.875rem' }}>
                    {initials}
                  </Avatar>
                </IconButton>
              </Tooltip>
              {(!collapsed || isMobile) && (
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap fontWeight={600}>
                    {displayName}
                  </Typography>
                  <Chip
                    label={roleLabel}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.7rem' }}
                  />
                </Box>
              )}
            </Stack>
          )}
          
          {collapsed && !isMobile ? (
            <Tooltip title={t('portalLayout.sidebar.signOut')} arrow>
              <IconButton
                type="button"
                onClick={() => setSignOutOpen(true)}
                aria-label={t('portalLayout.sidebar.signOut')}
                sx={{ width: '100%' }}
              >
                <Logout />
              </IconButton>
            </Tooltip>
          ) : (
            <Button
              type="button"
              fullWidth
              size="small"
              startIcon={<Logout />}
              onClick={() => setSignOutOpen(true)}
              sx={{ justifyContent: 'flex-start', textTransform: 'none', color: 'text.secondary' }}
            >
              {t('portalLayout.sidebar.signOut')}
            </Button>
          )}
        </Box>
      )}

      <Box sx={{ px: collapsed && !isMobile ? 1 : 2, pb: 2 }}>
        {collapsed && !isMobile ? (
          <Tooltip title={t('portalLayout.sidebar.backToSite')} arrow>
            <IconButton
              component={RouterLink}
              to={withDarkPath(pathname, '/')}
              type="button"
              aria-label={t('portalLayout.sidebar.backToSite')}
              sx={{ width: '100%' }}
            >
              <ArrowBack />
            </IconButton>
          </Tooltip>
        ) : (
          <Button
            component={RouterLink}
            to={withDarkPath(pathname, '/')}
            type="button"
            fullWidth
            size="small"
            variant="text"
            startIcon={<ArrowBack />}
            sx={{ justifyContent: 'flex-start', textTransform: 'none', color: 'text.secondary' }}
          >
            {t('portalLayout.sidebar.backToSite')}
          </Button>
        )}
      </Box>

      <PortalSignOutConfirmDialog
        open={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        onConfirm={handleSignOutConfirm}
      />
    </Box>
  );

  const widthTransition = muiTheme.transitions.create('width', {
    easing: muiTheme.transitions.easing.sharp,
    duration: muiTheme.transitions.duration.enteringScreen,
  });

  const drawerPaperSx = {
    width: isMobile ? SIDEBAR_WIDTH : (collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH),
    boxSizing: 'border-box',
    borderInlineEnd: '1px solid',
    borderColor: 'divider',
    backgroundImage: 'none',
    transition: widthTransition,
    overflowX: 'hidden',
  };

  if (isMobile) {
    return (
      <Drawer
        variant="temporary"
        open={open}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        PaperProps={{ sx: drawerPaperSx }}
      >
        {drawerContent}
      </Drawer>
    );
  }

  return (
    <Drawer
      variant="permanent"
      open
      sx={{
        width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
        flexShrink: 0,
        transition: widthTransition,
        overflow: 'hidden',
      }}
      PaperProps={{ sx: drawerPaperSx }}
    >
      {drawerContent}
    </Drawer>
  );
};

export default PortalSidebar;
