import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import { VITE_API_BASE_URL_RESOLVED } from '../featureFlags';
import { withDarkPath } from '../routePaths';
import { usePortalAuth } from '../PortalAuthContext';
import SocialSignInButtons from './SocialSignInButtons';

function endpoint(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

function statusColor(status) {
  if (status === 'ok') return 'success';
  if (status === 'error') return 'error';
  if (status === 'loading') return 'warning';
  return 'default';
}

function authStatusColor(status) {
  if (status === 'authenticated') return 'success';
  if (status === 'unauthenticated' || status === 'unconfigured') return 'default';
  if (status === 'error') return 'error';
  return 'warning';
}

const PortalSetup = () => {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const [health, setHealth] = useState({ state: 'idle', detail: '' });
  const {
    authStatus,
    authError,
    account,
    isAuthenticated,
    meStatus,
    meData,
    meError,
    signOut,
    refreshMe,
  } = usePortalAuth();
  const entraClientId = (import.meta.env.VITE_ENTRA_CLIENT_ID ?? '').trim();
  const entraAuthority = (import.meta.env.VITE_ENTRA_AUTHORITY ?? '').trim();
  const entraScope = (import.meta.env.VITE_ENTRA_API_SCOPE ?? '').trim();

  const baseUrl = useMemo(() => VITE_API_BASE_URL_RESOLVED || '', []);
  const healthUrl = baseUrl ? endpoint(baseUrl, '/api/health') : '';
  const meUrl = baseUrl ? endpoint(baseUrl, '/api/portal/me') : '';

  const fetchHealth = async () => {
    if (!baseUrl) return;
    setHealth({ state: 'loading', detail: '' });
    try {
      const res = await fetch(healthUrl, {
        headers: { Accept: 'application/json' },
        credentials: 'omit',
      });
      if (!res.ok) {
        setHealth({
          state: 'error',
          detail: t('portalSetup.errors.httpStatus', { status: res.status }),
        });
        return;
      }
      const payload = await res.json();
      setHealth({
        state: 'ok',
        detail: payload?.status ? String(payload.status) : t('portalSetup.labels.ok'),
      });
    } catch (error) {
      setHealth({
        state: 'error',
        detail: error instanceof Error ? error.message : t('portalSetup.errors.unknown'),
      });
    }
  };

  return (
    <Box sx={{ py: 4 }}>
      <Helmet>
        <title>{t('portalSetup.title')}</title>
        <meta name="description" content={t('portalSetup.metaDescription')} />
      </Helmet>

      <Stack spacing={2}>
        <Typography variant="h1" sx={{ fontSize: '2rem' }}>
          {t('portalSetup.heading')}
        </Typography>
        <Typography color="text.secondary">{t('portalSetup.intro')}</Typography>

        <Stack direction="row" spacing={1.25} sx={{ flexWrap: 'wrap' }}>
          <Button component={Link} to={withDarkPath(pathname, '/')} type="button" variant="text">
            {t('portalWorkspace.actions.backToSite')}
          </Button>
          <Button component={Link} to={withDarkPath(pathname, '/portal/tenant')} type="button" variant="outlined">
            {t('portalSetup.actions.openTenant')}
          </Button>
          <Button component={Link} to={withDarkPath(pathname, '/portal/landlord')} type="button" variant="outlined">
            {t('portalSetup.actions.openLandlord')}
          </Button>
          <Button component={Link} to={withDarkPath(pathname, '/portal/admin')} type="button" variant="outlined">
            {t('portalSetup.actions.openAdmin')}
          </Button>
        </Stack>

        {!baseUrl && (
          <Alert severity="warning">{t('portalSetup.apiBaseMissing')}</Alert>
        )}

        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            p: 2,
            backgroundColor: 'background.paper',
          }}
        >
          <Stack spacing={1.5}>
            <Typography variant="h2" sx={{ fontSize: '1.25rem' }}>
              {t('portalSetup.apiBaseHeading')}
            </Typography>
            <Typography>
              {baseUrl || t('portalSetup.notConfigured')}
            </Typography>
          </Stack>
        </Box>

        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            p: 2,
            backgroundColor: 'background.paper',
          }}
        >
          <Stack spacing={1.5}>
            <Typography variant="h2" sx={{ fontSize: '1.25rem' }}>
              {t('portalSetup.entraHeading')}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip size="small" color={entraClientId ? 'success' : 'default'} label={t('portalSetup.entraClientId')} />
              <Typography color="text.secondary">{entraClientId || t('portalSetup.notConfigured')}</Typography>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip size="small" color={entraAuthority ? 'success' : 'default'} label={t('portalSetup.entraAuthority')} />
              <Typography color="text.secondary">{entraAuthority || t('portalSetup.notConfigured')}</Typography>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip size="small" color={entraScope ? 'success' : 'default'} label={t('portalSetup.entraScope')} />
              <Typography color="text.secondary">{entraScope || t('portalSetup.notConfigured')}</Typography>
            </Stack>
          </Stack>
        </Box>

        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            p: 2,
            backgroundColor: 'background.paper',
          }}
        >
          <Stack spacing={1.5}>
            <Typography variant="h2" sx={{ fontSize: '1.25rem' }}>
              {t('portalSetup.sessionHeading')}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip
                size="small"
                color={authStatusColor(authStatus)}
                label={t(`portalSetup.authStatus.${authStatus}`)}
              />
              <Typography color="text.secondary">
                {authStatus === 'authenticated'
                  ? t('portalSetup.sessionSubject', {
                      subject: account?.username ?? meData?.subject ?? t('portalSetup.notConfigured'),
                    })
                  : authStatus === 'error'
                    ? authError || t('portalSetup.errors.unknown')
                    : t('portalSetup.sessionNotSaved')}
              </Typography>
            </Stack>
            {!isAuthenticated ? (
              <SocialSignInButtons compact />
            ) : (
              <Stack direction="row" spacing={1.25} sx={{ flexWrap: 'wrap' }}>
                <Button type="button" variant="outlined" onClick={signOut}>
                  {t('portalSetup.actions.signOut')}
                </Button>
                <Button type="button" variant="outlined" onClick={refreshMe}>
                  {t('portalSetup.actions.refreshSession')}
                </Button>
              </Stack>
            )}
          </Stack>
        </Box>

        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            p: 2,
            backgroundColor: 'background.paper',
          }}
        >
          <Stack spacing={1.5}>
            <Typography variant="h2" sx={{ fontSize: '1.25rem' }}>
              {t('portalSetup.healthHeading')}
            </Typography>
            <Typography color="text.secondary">{healthUrl || t('portalSetup.notConfigured')}</Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip
                size="small"
                color={statusColor(health.state)}
                label={t(`portalSetup.status.${health.state}`)}
              />
              {health.detail && <Typography>{health.detail}</Typography>}
            </Stack>
            <Button type="button" variant="outlined" onClick={fetchHealth} disabled={!baseUrl || health.state === 'loading'}>
              {t('portalSetup.actions.checkHealth')}
            </Button>
          </Stack>
        </Box>

        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            p: 2,
            backgroundColor: 'background.paper',
          }}
        >
          <Stack spacing={1.5}>
            <Typography variant="h2" sx={{ fontSize: '1.25rem' }}>
              {t('portalSetup.meHeading')}
            </Typography>
            <Typography color="text.secondary">{meUrl || t('portalSetup.notConfigured')}</Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip
                size="small"
                color={statusColor(meStatus)}
                label={t(`portalSetup.status.${meStatus}`)}
              />
              {meStatus === 'ok' && (
                <Typography>
                  {t('portalSetup.sessionSubject', {
                    subject: meData?.subject ?? t('portalSetup.notConfigured'),
                  })}
                </Typography>
              )}
              {meStatus === 'error' && <Typography>{meError || t('portalSetup.errors.unknown')}</Typography>}
            </Stack>
            <Button type="button" variant="contained" onClick={refreshMe} disabled={!isAuthenticated || meStatus === 'loading'}>
              {t('portalSetup.actions.checkMe')}
            </Button>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
};

export default PortalSetup;
