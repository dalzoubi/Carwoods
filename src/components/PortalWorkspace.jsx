import React from 'react';
import { Alert, Box, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { hasLandlordAccess, usePortalAuth } from '../PortalAuthContext';
import { resolveRole } from '../portalUtils';

function roleKey(role) {
  if (role === 'admin') return 'admin';
  if (role === 'landlord') return 'landlord';
  return 'tenant';
}

const PortalWorkspace = ({ role = 'tenant' }) => {
  const { t } = useTranslation();
  const { authStatus, isAuthenticated, account, meStatus, meData, meError } = usePortalAuth();
  const key = roleKey(role);
  const userRole = resolveRole(meData, account);
  const isAdminAllowed = userRole === 'ADMIN';
  const isLandlordAllowed = hasLandlordAccess(userRole);
  const showRoleGuard = meStatus === 'ok'
    && ((key === 'admin' && !isAdminAllowed) || (key === 'landlord' && !isLandlordAllowed));

  return (
    <Box sx={{ py: 4 }}>
      <Stack spacing={2.5}>
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
          <Alert severity="error">
            {t('portalWorkspace.authError')} {meError ? `(${meError})` : ''}
          </Alert>
        )}
        {showRoleGuard && (
          <Alert severity="error">{t('portalWorkspace.authForbidden')}</Alert>
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
