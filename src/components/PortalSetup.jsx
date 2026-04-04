import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { VITE_API_BASE_URL_RESOLVED } from '../featureFlags';

function endpoint(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

function statusColor(status) {
  if (status === 'ok') return 'success';
  if (status === 'error') return 'error';
  if (status === 'loading') return 'warning';
  return 'default';
}

const PortalSetup = () => {
  const { t } = useTranslation();
  const [health, setHealth] = useState({ state: 'idle', detail: '' });
  const [me, setMe] = useState({ state: 'idle', detail: '' });
  const [bearerToken, setBearerToken] = useState('');

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

  const fetchMe = async () => {
    if (!baseUrl) return;
    if (!bearerToken.trim()) {
      setMe({ state: 'error', detail: t('portalSetup.errors.tokenRequired') });
      return;
    }
    setMe({ state: 'loading', detail: '' });
    try {
      const res = await fetch(meUrl, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${bearerToken.trim()}`,
        },
        credentials: 'omit',
      });
      if (!res.ok) {
        setMe({
          state: 'error',
          detail: t('portalSetup.errors.httpStatus', { status: res.status }),
        });
        return;
      }
      const payload = await res.json();
      const subject = payload?.subject ? String(payload.subject) : t('portalSetup.labels.ok');
      setMe({ state: 'ok', detail: subject });
    } catch (error) {
      setMe({
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
            <TextField
              label={t('portalSetup.tokenLabel')}
              value={bearerToken}
              onChange={(event) => setBearerToken(event.target.value)}
              fullWidth
              multiline
              minRows={3}
            />
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip
                size="small"
                color={statusColor(me.state)}
                label={t(`portalSetup.status.${me.state}`)}
              />
              {me.detail && <Typography>{me.detail}</Typography>}
            </Stack>
            <Button type="button" variant="contained" onClick={fetchMe} disabled={!baseUrl || me.state === 'loading'}>
              {t('portalSetup.actions.checkMe')}
            </Button>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
};

export default PortalSetup;
