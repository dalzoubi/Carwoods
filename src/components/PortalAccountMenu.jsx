import React, { useState } from 'react';
import {
  Box,
  ButtonBase,
  Chip,
  CircularProgress,
  Collapse,
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
import Logout from '@mui/icons-material/Logout';
import Dashboard from '@mui/icons-material/Dashboard';
import Settings from '@mui/icons-material/Settings';
import SettingsBrightness from '@mui/icons-material/SettingsBrightness';
import LightMode from '@mui/icons-material/LightMode';
import DarkMode from '@mui/icons-material/DarkMode';
import RestartAlt from '@mui/icons-material/RestartAlt';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { stripDarkPreviewPrefix, withDarkPath } from '../routePaths';
import { useThemeMode } from '../ThemeModeContext';
import { FEATURE_DARK_THEME } from '../featureFlags';
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

/** User-facing subscription label from `/api/portal/me` (`user.tier`). */
function portalTierPillLabel(meData) {
  const tier = meData?.user?.tier;
  if (!tier || typeof tier !== 'object') return '';
  const display = String(tier.display_name ?? '').trim();
  if (display) return display;
  return String(tier.name ?? '').trim();
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

  // Always keep the same IconButton in the DOM as the menu anchor. Swapping it for a
  // plain Box during /me loading unmounts the anchor node while Menu/Popper still
  // holds a reference — positioning falls back to the top-left of the viewport.
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
        aria-busy={meLoading}
        sx={{
          marginInlineStart: 0.5,
          ...iconButtonSx,
          ...(meLoading ? loadingPlaceholderSx : {}),
        }}
      >
        {meLoading ? (
          <CircularProgress size={20} sx={circularProgressSx} />
        ) : (
          <PortalUserAvatar
            meData={meData}
            firstName={meData?.user?.first_name}
            lastName={meData?.user?.last_name}
            fallbackPhotoUrl={account?.photoURL}
            onProfilePhotoLoadError={refreshMe}
            size={36}
          />
        )}
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
  const {
    storedOverride,
    isDarkPreviewPath,
    setOverrideLight,
    setOverrideDark,
    resetOverride,
  } = useThemeMode();
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [appearanceExpanded, setAppearanceExpanded] = useState(false);

  const role = resolveRole(meData, account);
  const normalized = normalizeRole(role);
  const roleResolved = isAuthenticated && meStatus !== 'loading';
  const profileDisabled = roleResolved && isGuestRole(normalized);
  const displayName = resolveDisplayName(meData, account, t('portalHeader.notSignedIn'));
  const roleLabel = portalRoleLabel(role, t);
  const tierLabel = portalTierPillLabel(meData);
  const showTierPill = Boolean(tierLabel) && normalized !== Role.TENANT;
  const showConfigurationsNav =
    roleResolved && (normalized === Role.LANDLORD || normalized === Role.ADMIN);
  const showAppearanceMenu = FEATURE_DARK_THEME || isDarkPreviewPath;

  const normalizedPath = stripDarkPreviewPrefix(pathname);
  const isInPortal = normalizedPath.startsWith('/portal');

  const handleSignOutConfirm = async () => {
    setSignOutOpen(false);
    await signOut();
  };

  const handleClose = () => {
    setAppearanceExpanded(false);
    onClose();
  };

  return (
    <>
      <Menu
        {...menuProps}
        id={PORTAL_ACCOUNT_MENU_ID}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: { sx: { backgroundImage: 'none', minWidth: 230 } },
        }}
        MenuListProps={{ 'aria-labelledby': PORTAL_ACCOUNT_MENU_BUTTON_ID }}
      >
        <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
          <ButtonBase
            type="button"
            disabled={profileDisabled}
            onClick={() => {
              navigate(withDarkPath(pathname, '/portal/profile'));
              handleClose();
            }}
            aria-label={t('portalHeader.nav.profile')}
            sx={{
              width: '100%',
              display: 'block',
              textAlign: 'start',
              borderRadius: 1,
              px: 0,
              py: 0,
              mx: 0,
              my: 0,
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <PortalUserAvatar
                meData={meData}
                firstName={meData?.user?.first_name}
                lastName={meData?.user?.last_name}
                fallbackPhotoUrl={account?.photoURL}
                onProfilePhotoLoadError={refreshMe}
                size={36}
                sx={{ flexShrink: 0 }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {displayName}
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                  <Chip
                    label={roleLabel}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.7rem' }}
                  />
                  {showTierPill ? (
                    <Chip
                      label={tierLabel}
                      size="small"
                      color="secondary"
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  ) : null}
                </Stack>
              </Box>
            </Stack>
          </ButtonBase>
        </Box>
        <Divider />
        {!isInPortal && (
          <MenuItem
            onClick={() => {
              navigate(withDarkPath(pathname, '/portal'));
              handleClose();
            }}
          >
            <ListItemIcon>
              <Dashboard fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={t('portalHeader.nav.goToPortal')} />
          </MenuItem>
        )}
        {showConfigurationsNav ? (
          <MenuItem
            onClick={() => {
              navigate(withDarkPath(pathname, '/portal/admin/config'));
              handleClose();
            }}
          >
            <ListItemIcon>
              <Settings fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={t('portalLayout.sidebar.adminConfigurations')} />
          </MenuItem>
        ) : null}
        {showAppearanceMenu ? (
          <MenuItem onClick={() => setAppearanceExpanded((prev) => !prev)}>
            <ListItemIcon>
              <SettingsBrightness fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={t('nav.appearance')} />
            {appearanceExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
          </MenuItem>
        ) : null}
        <Collapse in={appearanceExpanded && showAppearanceMenu} unmountOnExit>
          <Box sx={{ pl: 1, pb: 0.5 }}>
            {isDarkPreviewPath && !FEATURE_DARK_THEME ? (
              <MenuItem
                dense
                onClick={() => {
                  navigate(stripDarkPreviewPrefix(pathname));
                  handleClose();
                }}
              >
                <ListItemIcon>
                  <LightMode fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={t('appearance.exitPreview')} />
              </MenuItem>
            ) : (
              <>
                <MenuItem dense selected={storedOverride === 'light'} onClick={setOverrideLight}>
                  <ListItemIcon>
                    <LightMode fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={t('appearance.light')} />
                </MenuItem>
                <MenuItem dense selected={storedOverride === 'dark'} onClick={setOverrideDark}>
                  <ListItemIcon>
                    <DarkMode fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={t('appearance.dark')} />
                </MenuItem>
                <MenuItem dense disabled={storedOverride === null} onClick={resetOverride}>
                  <ListItemIcon>
                    <RestartAlt fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={t('appearance.useDeviceSetting')} />
                </MenuItem>
              </>
            )}
          </Box>
        </Collapse>
        <Divider />
        <MenuItem
          onClick={() => {
            handleClose();
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
