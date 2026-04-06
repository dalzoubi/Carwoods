import React from 'react';
import { Alert, Box, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { hasLandlordAccess } from '../domain/roleUtils.js';
import { Role } from '../domain/constants.js';
import { resolveRole } from '../portalUtils';
import StatusAlertSlot from './StatusAlertSlot';

function roleKeyForUser(role) {
  if (role === 'admin') return 'admin';
  if (role === 'landlord') return 'landlord';
  return 'tenant';
}

function normalizeRoleForWorkspace(role) {
  const normalized = String(role ?? '').trim().toUpperCase();
  if (normalized === Role.ADMIN) return 'admin';
  if (normalized === Role.LANDLORD) return 'landlord';
  return 'tenant';
}

function visibleWidgetKeys(role) {
  const keys = ['tenant'];
  const normalized = String(role ?? '').trim().toUpperCase();
  if (hasLandlordAccess(normalized)) keys.push('landlord');
  if (normalized === Role.ADMIN) keys.push('admin');
  return keys;
}

const PortalWorkspace = () => {
  const { t } = useTranslation();
  const { authStatus, isAuthenticated, account, meStatus, meData, meError } = usePortalAuth();
  const userRole = resolveRole(meData, account);
  const normalizedRole = normalizeRoleForWorkspace(userRole);
  const key = roleKeyForUser(normalizedRole);
  const widgetKeys = visibleWidgetKeys(userRole);
  const meStatusMessage = isAuthenticated
    ? meStatus === 'loading'
      ? { severity: 'info', text: t('portalWorkspace.authLoading') }
      : meStatus === 'error'
        ? {
            severity: 'error',
            text: `${t('portalWorkspace.authError')}${meError ? ` (${meError})` : ''}`,
          }
        : null
    : null;

  return (
    <Box sx={{ py: 4 }}>
      <Stack spacing={2.5}>
        {authStatus === 'unconfigured' && (
          <Alert severity="warning">{t('portalWorkspace.authUnconfigured')}</Alert>
        )}
        {authStatus !== 'unconfigured' && !isAuthenticated && (
          <Alert severity="warning">{t('portalWorkspace.authRequired')}</Alert>
        )}
        <StatusAlertSlot message={meStatusMessage} />

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
          </Stack>
        </Box>

        {isAuthenticated && meStatus === 'ok' && (
          <Stack spacing={2}>
            {widgetKeys.map((widgetKey) => (
              <Box
                key={widgetKey}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  p: 2.5,
                  backgroundColor: 'background.paper',
                }}
              >
                <Stack spacing={1.25}>
                  <Typography variant="h2" sx={{ fontSize: '1.3rem' }}>
                    {t(`portalWorkspace.${widgetKey}.heading`)}
                  </Typography>
                  <Typography color="text.secondary">{t(`portalWorkspace.${widgetKey}.intro`)}</Typography>
                  <Typography sx={{ fontWeight: 600 }}>{t('portalWorkspace.nextHeading')}</Typography>
                  <ul style={{ margin: 0 }}>
                    <li>{t(`portalWorkspace.${widgetKey}.next1`)}</li>
                    <li>{t(`portalWorkspace.${widgetKey}.next2`)}</li>
                    <li>{t(`portalWorkspace.${widgetKey}.next3`)}</li>
                  </ul>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
};

export default PortalWorkspace;
