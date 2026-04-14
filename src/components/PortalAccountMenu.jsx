import React, { useState } from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import Person from '@mui/icons-material/Person';
import Logout from '@mui/icons-material/Logout';
import Dashboard from '@mui/icons-material/Dashboard';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { withDarkPath } from '../routePaths';
import { isGuestRole, normalizeRole, resolveDisplayName, resolveRole } from '../portalUtils';
import { Role } from '../domain/constants.js';
import PortalSignOutConfirmDialog from './PortalSignOutConfirmDialog';
import PortalUserAvatar from './PortalUserAvatar';

export const PORTAL_ACCOUNT_MENU_BUTTON_ID = 'portal-topbar-account-button';
export const PORTAL_ACCOUNT_MENU_ID = 'portal-topbar-account-menu';

function portalRoleLabel(role, t) {
  const n = normalizeRole(role);
  if (n === Role.ADMIN) return t('portalHeader.roles.admin');
  if (n === Role.LANDLORD) return t('portalHeader.roles.landlord');
  if (n === Role.TENANT) return t('portalHeader.roles.tenant');
  return t('portalHeader.roles.unknown');
}

/**
 * Avatar / loading placeholder that opens the shared portal account menu (same as PortalTopBar).
 */
export function PortalAccountMenuAvatarTrigger({
  onOpen,
  menuOpen,
  iconButtonSx,
  loadingPlaceholderSx,
  circularProgressSx,
}) {
  const { t } = useTranslation();
  const { isAuthenticated, account, meData, meStatus, refreshMe } = usePortalAuth();
  const meLoading = isAuthenticated && meStatus === 'loading';

  if (!isAuthenticated) {
    return null;
  }

  if (meLoading) {
    return (
      <Box
        sx={{
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginInlineStart: 0.5,
          ...loadingPlaceholderSx,
        }}
      >
        <CircularProgress size={20} sx={circularProgressSx} />
      </Box>
    );
  }

  return (
    <Tooltip title={t('portalLayout.topBar.accountMenu')} arrow>
      <IconButton
        type="button"
        size="small"
        id={PORTAL_ACCOUNT_MENU_BUTTON_ID}
        onClick={onOpen}
        aria-haspopup="true"
        aria-expanded={Boolean(menuOpen)}
        aria-controls={menuOpen ? PORTAL_ACCOUNT_MENU_ID : undefined}
        aria-label={t('portalLayout.topBar.accountMenu')}
        sx={{ marginInlineStart: 0.5, ...iconButtonSx }}
      >
        <PortalUserAvatar
          meData={meData}
          firstName={meData?.user?.first_name}
          lastName={meData?.user?.last_name}
          fallbackPhotoUrl={account?.photoURL}
          onProfilePhotoLoadError={refreshMe}
          size={36}
        />
      </IconButton>
    </Tooltip>
  );
}

/**
 * Account dropdown + sign-out confirmation (shared by marketing navbar and portal top bar).
 */
export function PortalAccountMenu({ anchorEl, open, onClose, menuProps }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const {
    isAuthenticated,
    account,
    meData,
    meStatus,
    signOut,
    refreshMe,
  } = usePortalAuth();
  const [signOutOpen, setSignOutOpen] = useState(false);

  const role = resolveRole(meData, account);
  const normalized = normalizeRole(role);
  const roleResolved = isAuthenticated && meStatus !== 'loading';
  const profileDisabled = roleResolved && isGuestRole(normalized);
  const displayName = resolveDisplayName(meData, account, t('portalHeader.notSignedIn'));
  const roleLabel = portalRoleLabel(role, t);

  const handleSignOutConfirm = async () => {
    setSignOutOpen(false);
    await signOut();
  };

  return (
    <>
      <Menu
        {...menuProps}
        id={PORTAL_ACCOUNT_MENU_ID}
        anchorEl={anchorEl}
        open={open}
        onClose={onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: { sx: { backgroundImage: 'none', minWidth: 230 } },
        }}
        MenuListProps={{ 'aria-labelledby': PORTAL_ACCOUNT_MENU_BUTTON_ID }}
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
              fallbackPhotoUrl={account?.photoURL}
              onProfilePhotoLoadError={refreshMe}
              size={36}
            />
          </Stack>
        </Box>
        <Divider />
        <MenuItem
          onClick={() => {
            navigate(withDarkPath(pathname, '/portal'));
            onClose();
          }}
        >
          <ListItemIcon>
            <Dashboard fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t('portalHeader.nav.goToPortal', 'Go to Portal')} />
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (!profileDisabled) {
              navigate(withDarkPath(pathname, '/portal/profile'));
            }
            onClose();
          }}
          disabled={profileDisabled}
        >
          <ListItemIcon>
            <Person fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t('portalHeader.nav.profile')} />
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            onClose();
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
    </>
  );
}
