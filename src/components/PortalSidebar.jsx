import React, { useState } from 'react';
import { Role } from '../domain/constants.js';
import {
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import Dashboard from '@mui/icons-material/Dashboard';
import Person from '@mui/icons-material/Person';
import SupervisorAccount from '@mui/icons-material/SupervisorAccount';
import ManageAccounts from '@mui/icons-material/ManageAccounts';
import HomeWork from '@mui/icons-material/HomeWork';
import People from '@mui/icons-material/People';
import Logout from '@mui/icons-material/Logout';
import ArrowBack from '@mui/icons-material/ArrowBack';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import Assignment from '@mui/icons-material/Assignment';
import Assessment from '@mui/icons-material/Assessment';
import Notifications from '@mui/icons-material/Notifications';
import ContactMail from '@mui/icons-material/ContactMail';
import Description from '@mui/icons-material/Description';
import Payments from '@mui/icons-material/Payments';
import VpnKey from '@mui/icons-material/VpnKey';
import Gavel from '@mui/icons-material/Gavel';
import HealthAndSafety from '@mui/icons-material/HealthAndSafety';
import Send from '@mui/icons-material/Send';
import HelpOutline from '@mui/icons-material/HelpOutline';
import SupportAgent from '@mui/icons-material/SupportAgent';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { useSidebarBadges } from '../hooks/useSidebarBadges';
import { allowsDocumentCenter, landlordTierLimits } from '../portalTierUtils';
import { isGuestRole, normalizeRole, resolveRole } from '../portalUtils';
import { stripDarkPreviewPrefix, withDarkPath } from '../routePaths';
import PortalSignOutConfirmDialog from './PortalSignOutConfirmDialog';
import carwoodsLogo from '../assets/carwoods-logo.png';

export const SIDEBAR_WIDTH = 260;
export const SIDEBAR_COLLAPSED_WIDTH = 84;

const PortalSidebar = ({ open, onClose, isMobile, collapsed = false, onSidebarToggle }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { pathname } = useLocation();
  const { isAuthenticated, account, meData, meStatus, signOut } = usePortalAuth();
  const badges = useSidebarBadges();
  const [signOutOpen, setSignOutOpen] = useState(false);

  const role = resolveRole(meData, account);
  const normalized = normalizeRole(role);
  const isGuest = isGuestRole(normalized);
  const roleResolved = isAuthenticated && meStatus !== 'loading';

  const normalizedPath = stripDarkPreviewPrefix(pathname);

  const handleNavClick = () => {
    if (isMobile) onClose();
  };

  const handleSignOutConfirm = async () => {
    setSignOutOpen(false);
    await signOut();
  };

  const navItemSx = {
    borderRadius: 1.5,
    mb: 0.5,
    justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
    '&.Mui-selected': {
      backgroundColor: 'action.selected',
      '&:hover': { backgroundColor: 'action.selected' },
    },
  };

  const subheaderSx = {
    typography: 'caption',
    fontWeight: 700,
    color: 'text.secondary',
    lineHeight: 2,
    px: 2,
    mt: 1,
    ...(collapsed && !isMobile ? { display: 'none' } : {}),
  };

  const renderNavItem = (item) => {
    const isActive = item.exact
      ? normalizedPath === item.to
      : normalizedPath.startsWith(item.to);

    const btn = (
      <ListItemButton
        id={`portal-tour-nav-${item.key}`}
        component={RouterLink}
        to={withDarkPath(pathname, item.to)}
        selected={isActive}
        onClick={handleNavClick}
        sx={navItemSx}
      >
        <ListItemIcon
          sx={{
            minWidth: collapsed && !isMobile ? 0 : 40,
            color: isActive ? 'primary.main' : 'text.secondary',
            marginInlineEnd: collapsed && !isMobile ? 0 : undefined,
          }}
        >
          {item.badgeCount > 0 ? (
            <Badge
              badgeContent={item.badgeCount}
              color="error"
              max={99}
              overlap="circular"
            >
              {item.icon}
            </Badge>
          ) : (
            item.icon
          )}
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

    if (collapsed && !isMobile) {
      return (
        <Tooltip key={item.key} title={item.label} placement="right" arrow>
          {btn}
        </Tooltip>
      );
    }
    return <React.Fragment key={item.key}>{btn}</React.Fragment>;
  };

  const renderNavGroup = (items, groupLabel) => {
    if (!items.length) return null;
    return (
      <>
        {groupLabel && (
          <ListSubheader component="div" disableSticky sx={subheaderSx}>
            {groupLabel}
          </ListSubheader>
        )}
        {items.map(renderNavItem)}
      </>
    );
  };

  const coreItems = [
    { key: 'dashboard', to: '/portal', label: t('portalLayout.sidebar.dashboard'), icon: <Dashboard />, exact: true },
  ];

  const manageItems = roleResolved && (normalized === Role.LANDLORD || normalized === Role.ADMIN)
    ? [
        { key: 'properties', to: '/portal/properties', label: t('portalLayout.sidebar.properties'), icon: <HomeWork /> },
        { key: 'tenants', to: '/portal/tenants', label: t('portalLayout.sidebar.tenants'), icon: <People /> },
      ]
    : [];

  /** Tenants: hide Document Center nav when the primary landlord's plan does not include it (e.g. FREE). Landlords still see the link (upgrade / locked UI on the page). */
  const showDocumentsNav =
    normalized !== Role.TENANT || allowsDocumentCenter(landlordTierLimits(meData));

  const toolItems = roleResolved && !isGuest
    ? [
        ...(normalized === Role.TENANT
          ? [{ key: 'my-lease', to: '/portal/my-lease', label: t('portalLayout.sidebar.myLease'), icon: <VpnKey />, badgeCount: badges.notices }]
          : []),
        ...(normalized === Role.LANDLORD || normalized === Role.ADMIN
          ? [{ key: 'notices', to: '/portal/notices', label: t('portalLayout.sidebar.notices'), icon: <Gavel />, badgeCount: badges.notices }]
          : []),
        { key: 'payments', to: '/portal/payments', label: t('portalLayout.sidebar.payments'), icon: <Payments /> },
        ...(showDocumentsNav
          ? [{ key: 'documents', to: '/portal/documents', label: t('portalLayout.sidebar.documents'), icon: <Description /> }]
          : []),
      ]
    : [];

  const messagesItems = roleResolved && !isGuest
    ? [
        { key: 'inbox', to: '/portal/inbox/requests', label: t('portalLayout.sidebar.requests'), icon: <Assignment />, badgeCount: badges.requests },
        { key: 'notifications', to: '/portal/inbox/notifications', label: t('portalLayout.sidebar.notifications'), icon: <Notifications />, badgeCount: badges.notifications },
        { key: 'support', to: '/portal/support', label: t('portalLayout.sidebar.support'), icon: <HelpOutline />, badgeCount: badges.supportTickets },
        ...(normalized === Role.ADMIN
          ? [{ key: 'contact', to: '/portal/inbox/contact', label: t('portalLayout.sidebar.adminContactUsMessages'), icon: <ContactMail />, badgeCount: badges.contact }]
          : []),
      ]
    : [];

  const adminItems = roleResolved && normalized === Role.ADMIN
    ? [
        { key: 'admin', to: '/portal/admin/landlords', label: t('portalLayout.sidebar.adminLandlords'), icon: <SupervisorAccount /> },
        { key: 'admin-users', to: '/portal/admin/users', label: t('portalLayout.sidebar.adminUsers'), icon: <ManageAccounts /> },
        { key: 'admin-support', to: '/portal/admin/support', label: t('portalLayout.sidebar.adminSupport'), icon: <SupportAgent />, badgeCount: badges.supportTicketsAdmin },
      ]
    : [];

  const reportsItems = roleResolved && normalized === Role.ADMIN
    ? [
        {
          key: 'reports-notifications',
          to: '/portal/admin/reports/notifications',
          label: t('portalLayout.sidebar.notificationReport'),
          icon: <Assessment />,
        },
      ]
    : [];

  const healthItems = roleResolved && normalized === Role.ADMIN
    ? [
        { key: 'health-status', to: '/portal/status', label: t('portalLayout.sidebar.status'), icon: <HealthAndSafety />, exact: true },
        { key: 'health-notification-test', to: '/portal/admin/health/notification-test', label: t('portalLayout.sidebar.notificationTest'), icon: <Send />, exact: true },
      ]
    : [];

  const profileItem = roleResolved && !isGuest
    ? { key: 'profile', to: '/portal/profile', label: t('portalLayout.sidebar.profile'), icon: <Person /> }
    : null;

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Box
        sx={{
          minHeight: 56,
          boxSizing: 'border-box',
          position: 'relative',
          px: collapsed && !isMobile ? 1.5 : 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed && !isMobile ? 'center' : 'space-between',
          gap: collapsed && !isMobile ? 0 : 1.5,
        }}
      >
        <Box
          component={RouterLink}
          to={withDarkPath(pathname, '/portal')}
          onClick={handleNavClick}
          aria-label={t('portalLayout.sidebar.dashboard')}
          sx={{
            textDecoration: 'none',
            color: 'inherit',
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            flexShrink: 1,
          }}
        >
          <Box
            component="img"
            src={carwoodsLogo}
            alt={t('common.carwoodsAlt')}
            sx={{ height: 28, filter: (theme) => theme.palette.mode === 'light' ? 'invert(1)' : 'none' }}
          />
          {(!collapsed || isMobile) && (
            <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700 }}>
              {t('portalHeader.title')}
            </Typography>
          )}
        </Box>
        {!isMobile && (
          <Tooltip title={collapsed ? t('portalLayout.sidebar.expand') : t('portalLayout.sidebar.collapse')} arrow>
            <IconButton
              type="button"
              aria-label={collapsed ? t('portalLayout.sidebar.expand') : t('portalLayout.sidebar.collapse')}
              onClick={onSidebarToggle}
              size="small"
              sx={{
                flexShrink: 0,
                ...(collapsed && !isMobile ? { position: 'absolute', insetInlineEnd: -6 } : {}),
              }}
            >
              {collapsed
                ? (theme.direction === 'rtl' ? <ChevronLeft /> : <ChevronRight />)
                : (theme.direction === 'rtl' ? <ChevronRight /> : <ChevronLeft />)}
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <Divider />

      <List component="nav" sx={{ flex: 1, px: 1, py: 1.5, overflow: 'auto' }}>
        {renderNavGroup(coreItems)}
        {renderNavGroup(manageItems, manageItems.length > 0 ? t('portalLayout.sidebar.manageGroup') : undefined)}
        {renderNavGroup(toolItems)}
        {renderNavGroup(messagesItems, messagesItems.length > 0 ? t('portalLayout.sidebar.messagesGroup') : undefined)}
        {renderNavGroup(adminItems, adminItems.length > 0 ? t('portalLayout.sidebar.adminGroup') : undefined)}
        {renderNavGroup(reportsItems, reportsItems.length > 0 ? t('portalLayout.sidebar.reportsGroup') : undefined)}
        {renderNavGroup(healthItems, healthItems.length > 0 ? t('portalLayout.sidebar.healthGroup') : undefined)}
      </List>

      <Divider />

      <Box sx={{ p: collapsed && !isMobile ? 1.5 : 2 }}>
        {profileItem && (
          collapsed && !isMobile ? (
            <Tooltip title={profileItem.label} arrow>
              <IconButton
                component={RouterLink}
                to={withDarkPath(pathname, profileItem.to)}
                type="button"
                id="portal-tour-nav-profile"
                aria-label={profileItem.label}
                onClick={handleNavClick}
                sx={{ width: '100%', mb: 0.5 }}
              >
                <Person />
              </IconButton>
            </Tooltip>
          ) : (
            <Button
              component={RouterLink}
              to={withDarkPath(pathname, profileItem.to)}
              type="button"
              id="portal-tour-nav-profile"
              fullWidth
              size="small"
              startIcon={<Person />}
              onClick={handleNavClick}
              sx={{ justifyContent: 'flex-start', textTransform: 'none', color: 'text.secondary', mb: 0.5 }}
            >
              {profileItem.label}
            </Button>
          )
        )}
        {isAuthenticated && (
          collapsed && !isMobile ? (
            <Tooltip title={t('portalLayout.sidebar.signOut')} arrow>
              <IconButton
                type="button"
                id="portal-tour-sidebar-sign-out"
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
              id="portal-tour-sidebar-sign-out"
              fullWidth
              size="small"
              startIcon={<Logout />}
              onClick={() => setSignOutOpen(true)}
              sx={{ justifyContent: 'flex-start', textTransform: 'none', color: 'text.secondary' }}
            >
              {t('portalLayout.sidebar.signOut')}
            </Button>
          )
        )}
      </Box>

      <Box sx={{ px: collapsed && !isMobile ? 1 : 2, pb: 2 }}>
        {collapsed && !isMobile ? (
          <Tooltip title={t('portalLayout.sidebar.backToSite')} arrow>
            <IconButton
              component={RouterLink}
              to={withDarkPath(pathname, '/')}
              type="button"
              id="portal-tour-sidebar-back-to-site"
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
            id="portal-tour-sidebar-back-to-site"
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

  const widthTransition = theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
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
