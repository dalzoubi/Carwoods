import React from 'react';
import { Helmet } from 'react-helmet';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import Build from '@mui/icons-material/Build';
import Chat from '@mui/icons-material/Chat';
import ManageAccounts from '@mui/icons-material/ManageAccounts';
import Login from '@mui/icons-material/Login';
import ArrowBack from '@mui/icons-material/ArrowBack';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { withDarkPath } from '../routePaths';
import carwoodsLogo from '../assets/carwoods-logo.png';

const featureItems = [
  { key: 'requests', icon: <Build sx={{ fontSize: 28 }} /> },
  { key: 'messaging', icon: <Chat sx={{ fontSize: 28 }} /> },
  { key: 'profile', icon: <ManageAccounts sx={{ fontSize: 28 }} /> },
];

const PortalLoginLanding = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { authStatus, isAuthenticated, meStatus, signIn, lockoutReason } = usePortalAuth();
  const isUnconfigured = authStatus === 'unconfigured';
  // Show spinner during MSAL init/auth AND while /me is in-flight after sign-in.
  const isLoading =
    authStatus === 'initializing' ||
    authStatus === 'authenticating' ||
    (isAuthenticated && meStatus === 'loading');
  const isAccountDisabled = lockoutReason === 'account_disabled';
  const isNoPortalAccess = lockoutReason === 'no_portal_access';
  const isLockedOut = isAccountDisabled || isNoPortalAccess;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
        p: { xs: 2, sm: 4 },
      }}
    >
      <Helmet>
        <title>{t('portalLogin.title')}</title>
        <meta name="description" content={t('portalLogin.metaDescription')} />
      </Helmet>

      <Paper
        elevation={0}
        sx={{
          maxWidth: 480,
          width: '100%',
          p: { xs: 3, sm: 5 },
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          textAlign: 'center',
        }}
      >
        <Stack spacing={3} alignItems="center">
          <Box
            component="img"
            src={carwoodsLogo}
            alt={t('common.carwoodsAlt')}
            sx={{
              height: 40,
              filter: (theme) => theme.palette.mode === 'dark' ? 'brightness(1.8)' : 'none',
            }}
          />

          <Box>
            <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
              {t('portalLogin.heading')}
            </Typography>
            <Typography color="text.secondary" variant="body1">
              {t('portalLogin.subtitle')}
            </Typography>
          </Box>

          <Stack spacing={1.5} sx={{ width: '100%', textAlign: 'start' }}>
            {featureItems.map(({ key, icon }) => (
              <Stack key={key} direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ color: 'primary.main', flexShrink: 0 }}>
                  {icon}
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {t(`portalLogin.features.${key}`)}
                </Typography>
              </Stack>
            ))}
          </Stack>

          <Divider flexItem />

          {isAccountDisabled && (
            <Alert severity="error" sx={{ width: '100%' }}>
              {t('portalLogin.accountDisabled')}
            </Alert>
          )}

          {isNoPortalAccess && (
            <Alert severity="warning" sx={{ width: '100%' }}>
              {t('portalLogin.noPortalAccess')}
            </Alert>
          )}

          {isUnconfigured && (
            <Alert severity="warning" sx={{ width: '100%' }}>
              {t('portalLogin.configWarning')}
            </Alert>
          )}

          {isLoading && (
            <Stack spacing={1.5} alignItems="center" sx={{ py: 1 }}>
              <CircularProgress size={28} />
              <Typography variant="body2" color="text.secondary">
                {authStatus === 'authenticating'
                  ? t('portalSetup.authStatus.authenticating')
                  : t('portalSetup.authStatus.initializing')}
              </Typography>
            </Stack>
          )}

          {!isUnconfigured && !isLockedOut && !isLoading && (
            <Button
              type="button"
              variant="contained"
              fullWidth
              size="large"
              startIcon={<Login />}
              onClick={signIn}
              sx={{ textTransform: 'none', py: 1.3, fontWeight: 600 }}
            >
              {t('portalHeader.actions.signIn')}
            </Button>
          )}

          <Button
            component={RouterLink}
            to={withDarkPath(pathname, '/')}
            type="button"
            variant="text"
            size="small"
            startIcon={<ArrowBack />}
            sx={{ textTransform: 'none', color: 'text.secondary' }}
          >
            {t('portalLogin.backToSite')}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
};

export default PortalLoginLanding;
