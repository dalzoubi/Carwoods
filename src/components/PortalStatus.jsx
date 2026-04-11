import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  CircularProgress,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import Refresh from '@mui/icons-material/Refresh';
import HealthAndSafety from '@mui/icons-material/HealthAndSafety';
import ManageSearch from '@mui/icons-material/ManageSearch';
import { VITE_API_BASE_URL_RESOLVED } from '../featureFlags';
import { usePortalAuth } from '../PortalAuthContext';
import { emailFromAccount, firstNonEmpty, resolveRole } from '../portalUtils';
import PortalSignOutConfirmDialog from './PortalSignOutConfirmDialog';
import { fetchHealth as apiFetchHealth } from '../lib/portalApiClient';
import StatusAlertSlot from './StatusAlertSlot';

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

const PortalStatus = () => {
  const { t } = useTranslation();
  const [health, setHealth] = useState({ state: 'idle', detail: '' });
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
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
  const firebaseApiKey = (import.meta.env.VITE_FIREBASE_API_KEY ?? '').trim();
  const firebaseAuthDomain = (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '').trim();
  const firebaseProjectId = (import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '').trim();
  const userFirstName = meData?.user?.first_name ?? '';
  const userLastName = meData?.user?.last_name ?? '';
  const profileName = `${userFirstName} ${userLastName}`.trim();
  const tokenEmail = emailFromAccount(account);
  const displayName = firstNonEmpty([
    profileName,
    account?.name,
    meData?.email,
    tokenEmail,
    meData?.subject,
    t('portalSetup.notConfigured'),
  ]);
  const effectiveRole = resolveRole(meData, account);
  const tokenDetailsJson = useMemo(() => {
    if (!account) return '';
    const tokenDetails = {
      account: {
        uid: account.uid ?? null,
        username: account.username ?? null,
        name: account.name ?? null,
      },
    };
    return JSON.stringify(tokenDetails, null, 2);
  }, [account]);

  const baseUrl = useMemo(() => VITE_API_BASE_URL_RESOLVED || '', []);
  const healthUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/api/health` : '';
  const meUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/api/portal/me` : '';

  const fetchHealth = async () => {
    if (!baseUrl) return;
    setHealth({ state: 'loading', detail: '' });
    try {
      const payload = await apiFetchHealth(baseUrl);
      setHealth({
        state: 'ok',
        detail: payload?.status ? String(payload.status) : t('portalSetup.labels.ok'),
      });
    } catch (error) {
      const detail =
        error && typeof error === 'object' && typeof error.status === 'number'
          ? t('portalSetup.errors.httpStatus', { status: error.status })
          : error instanceof Error
            ? error.message
            : t('portalSetup.errors.unknown');
      setHealth({ state: 'error', detail });
    }
  };

  return (
    <Box sx={{ py: 4 }}>
      <Helmet>
        <title>{t('portalStatus.title')}</title>
        <meta name="description" content={t('portalStatus.metaDescription')} />
      </Helmet>

      <Stack spacing={2}>
        <Typography variant="h1" sx={{ fontSize: '2rem' }}>
          {t('portalStatus.heading')}
        </Typography>
        <Typography color="text.secondary">{t('portalStatus.intro')}</Typography>

        <StatusAlertSlot
          message={!baseUrl ? { severity: 'warning', text: t('portalSetup.apiBaseMissing') } : null}
        />

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
              {t('portalSetup.authHeading')}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip size="small" color={firebaseApiKey ? 'success' : 'default'} label={t('portalSetup.firebaseApiKey')} />
              <Typography color="text.secondary">{firebaseApiKey || t('portalSetup.notConfigured')}</Typography>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip size="small" color={firebaseAuthDomain ? 'success' : 'default'} label={t('portalSetup.firebaseAuthDomain')} />
              <Typography color="text.secondary">{firebaseAuthDomain || t('portalSetup.notConfigured')}</Typography>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip size="small" color={firebaseProjectId ? 'success' : 'default'} label={t('portalSetup.firebaseProjectId')} />
              <Typography color="text.secondary">{firebaseProjectId || t('portalSetup.notConfigured')}</Typography>
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
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="h2" sx={{ fontSize: '1.25rem' }}>
                {t('portalSetup.sessionHeading')}
              </Typography>
              <Button
                type="button"
                size="small"
                variant="outlined"
                onClick={refreshMe}
                disabled={!isAuthenticated || meStatus === 'loading'}
                startIcon={
                  meStatus === 'loading'
                    ? <CircularProgress size={16} />
                    : <Refresh fontSize="small" />
                }
                sx={{ textTransform: 'none' }}
              >
                {t('portalSetup.actions.refreshSession')}
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip
                size="small"
                color={authStatusColor(authStatus)}
                label={t(`portalSetup.authStatus.${authStatus}`)}
              />
              <Typography color="text.secondary">
                {authStatus === 'authenticated'
                  ? t('portalSetup.sessionSubject', {
                    subject: displayName,
                  })
                  : authStatus === 'error'
                    ? authError || t('portalSetup.errors.unknown')
                    : t('portalSetup.sessionNotSaved')}
              </Typography>
            </Stack>
            {!isAuthenticated ? null : (
              <Stack direction="row" spacing={1.25} sx={{ flexWrap: 'wrap' }}>
                <Button type="button" variant="outlined" onClick={() => setSignOutConfirmOpen(true)}>
                  {t('portalSetup.actions.signOut')}
                </Button>
              </Stack>
            )}
            {isAuthenticated && tokenEmail && (
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <Chip size="small" color="info" label={t('portalSetup.tokenEmailLabel')} />
                <Typography color="text.secondary">{tokenEmail}</Typography>
              </Stack>
            )}
            <Box
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1.5,
                p: 1.5,
                backgroundColor: 'background.default',
              }}
            >
              <Stack spacing={1}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {t('portalSetup.tokenDetailsHeading')}
                </Typography>
                {tokenDetailsJson ? (
                  <Box
                    component="pre"
                    sx={{
                      m: 0,
                      p: 1.25,
                      borderRadius: 1,
                      backgroundColor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider',
                      overflowX: 'auto',
                      maxHeight: 320,
                      fontSize: '0.75rem',
                      lineHeight: 1.4,
                      fontFamily: 'monospace',
                    }}
                  >
                    {tokenDetailsJson}
                  </Box>
                ) : (
                  <Typography color="text.secondary">{t('portalSetup.tokenDetailsUnavailable')}</Typography>
                )}
              </Stack>
            </Box>
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
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="h2" sx={{ fontSize: '1.25rem' }}>
                {t('portalSetup.healthHeading')}
              </Typography>
              <Tooltip title={t('portalSetup.actions.checkHealth')}>
                <span>
                  <IconButton
                    type="button"
                    size="small"
                    aria-label={t('portalSetup.actions.checkHealth')}
                    onClick={fetchHealth}
                    disabled={!baseUrl || health.state === 'loading'}
                  >
                    <HealthAndSafety fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
            <Typography color="text.secondary">{healthUrl || t('portalSetup.notConfigured')}</Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip
                size="small"
                color={statusColor(health.state)}
                label={t(`portalSetup.status.${health.state}`)}
              />
              {health.detail && <Typography>{health.detail}</Typography>}
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
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="h2" sx={{ fontSize: '1.25rem' }}>
                {t('portalSetup.meHeading')}
              </Typography>
              <Tooltip title={t('portalSetup.actions.checkMe')}>
                <span>
                  <IconButton
                    type="button"
                    size="small"
                    aria-label={t('portalSetup.actions.checkMe')}
                    onClick={refreshMe}
                    disabled={!isAuthenticated || meStatus === 'loading'}
                  >
                    <ManageSearch fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
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
                    subject: displayName,
                  })}
                </Typography>
              )}
              {meStatus === 'ok' && Boolean(effectiveRole) && (
                <Typography color="text.secondary">
                  {effectiveRole}
                </Typography>
              )}
              {meStatus === 'error' && <Typography>{meError || t('portalSetup.errors.unknown')}</Typography>}
            </Stack>
          </Stack>
        </Box>
      </Stack>

      <PortalSignOutConfirmDialog
        open={signOutConfirmOpen}
        onClose={() => setSignOutConfirmOpen(false)}
        onConfirm={() => {
          setSignOutConfirmOpen(false);
          signOut();
        }}
      />
    </Box>
  );
};

export default PortalStatus;
