import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { withDarkPath } from '../routePaths';
import { hasLandlordAccess, usePortalAuth } from '../PortalAuthContext';
import SocialSignInButtons from './SocialSignInButtons';
import { resolveDisplayName, resolveRole } from '../portalUtils';

function roleKey(role) {
  if (role === 'admin') return 'admin';
  if (role === 'landlord') return 'landlord';
  return 'tenant';
}

const PortalWorkspace = ({ role = 'tenant' }) => {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const { authStatus, isAuthenticated, account, meStatus, meData, meError, refreshMe, signOut } = usePortalAuth();
  const key = roleKey(role);
  const displayName = resolveDisplayName(meData, account, '-');
  const userRole = resolveRole(meData, account);
  const isAdminAllowed = userRole === 'ADMIN';
  const isLandlordAllowed = hasLandlordAccess(userRole);
  const showRoleGuard = meStatus === 'ok'
    && ((key === 'admin' && !isAdminAllowed) || (key === 'landlord' && !isLandlordAllowed));

  return (
    <Box sx={{ py: 4 }}>
      <Stack spacing={2.5}>
        <Stack direction="row" spacing={1.25} sx={{ flexWrap: 'wrap' }}>
          <Button component={Link} to={withDarkPath(pathname, '/')} type="button" variant="text">
            {t('portalWorkspace.actions.backToSite')}
          </Button>
          <Button component={Link} to={withDarkPath(pathname, '/portal')} type="button" variant="outlined">
            {t('portalWorkspace.actions.backToSetup')}
          </Button>
          <Button component={Link} to={withDarkPath(pathname, '/portal/tenant')} type="button" variant={key === 'tenant' ? 'contained' : 'outlined'}>
            {t('portalWorkspace.actions.tenant')}
          </Button>
          <Button component={Link} to={withDarkPath(pathname, '/portal/landlord')} type="button" variant={key === 'landlord' ? 'contained' : 'outlined'}>
            {t('portalWorkspace.actions.landlord')}
          </Button>
          <Button component={Link} to={withDarkPath(pathname, '/portal/admin')} type="button" variant={key === 'admin' ? 'contained' : 'outlined'}>
            {t('portalWorkspace.actions.admin')}
          </Button>
        </Stack>

        {authStatus === 'unconfigured' && (
          <Alert severity="warning">{t('portalWorkspace.authUnconfigured')}</Alert>
        )}
        {authStatus !== 'unconfigured' && !isAuthenticated && (
          <Alert severity="warning">{t('portalWorkspace.authRequired')}</Alert>
        )}
        {isAuthenticated && meStatus === 'loading' && (
          <Alert severity="info">{t('portalWorkspace.authLoading')}</Alert>
        )}
        {isAuthenticated && meStatus === 'error' && (
          <Stack spacing={1}>
            <Alert severity="error">
              {t('portalWorkspace.authError')} {meError ? `(${meError})` : ''}
            </Alert>
            <Stack direction="row" spacing={1.25}>
              <Button type="button" variant="outlined" onClick={refreshMe}>
                {t('portalWorkspace.actions.retryAuth')}
              </Button>
              <Button type="button" variant="outlined" onClick={signOut}>
                {t('portalWorkspace.actions.signOut')}
              </Button>
            </Stack>
          </Stack>
        )}
        {showRoleGuard && (
          <Alert severity="error">{t('portalWorkspace.authForbidden')}</Alert>
        )}
        {!isAuthenticated && authStatus !== 'unconfigured' && (
          <SocialSignInButtons />
        )}
        {isAuthenticated && meStatus === 'ok' && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip size="small" color="success" label={t('portalWorkspace.authenticated')} />
            <Typography color="text.secondary">
              {t('portalWorkspace.accountSummary', {
                subject: displayName,
                role: userRole || '-',
              })}
            </Typography>
          </Stack>
        )}

        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            p: 2.5,
            backgroundColor: 'background.paper',
          }}
        >
          <Stack spacing={1.25}>
            <Typography variant="h1" sx={{ fontSize: '2rem' }}>
              {t(`portalWorkspace.${key}.heading`)}
            </Typography>
            <Typography color="text.secondary">{t(`portalWorkspace.${key}.intro`)}</Typography>
            <Typography sx={{ fontWeight: 600 }}>{t('portalWorkspace.nextHeading')}</Typography>
            <ul style={{ margin: 0 }}>
              <li>{t(`portalWorkspace.${key}.next1`)}</li>
              <li>{t(`portalWorkspace.${key}.next2`)}</li>
              <li>{t(`portalWorkspace.${key}.next3`)}</li>
            </ul>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
};

export default PortalWorkspace;
