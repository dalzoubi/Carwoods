import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  Link as MuiLink,
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
import { Trans, useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { withDarkPath } from '../routePaths';
import { PERSIST_CHECKBOX_DEFAULT, TERMS_ACCEPTED_KEY } from '../sessionConfig';
import carwoodsLogo from '../assets/carwoods-logo.png';
import StatusAlertSlot from './StatusAlertSlot';

function readStoredTermsAccepted() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage?.getItem(TERMS_ACCEPTED_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeStoredTermsAccepted(accepted) {
  if (typeof window === 'undefined') return;
  try {
    if (accepted) {
      window.localStorage?.setItem(TERMS_ACCEPTED_KEY, 'true');
    } else {
      window.localStorage?.removeItem(TERMS_ACCEPTED_KEY);
    }
  } catch {
    // Ignore storage errors.
  }
}

const featureItems = [
  { key: 'requests', icon: <Build sx={{ fontSize: 28 }} /> },
  { key: 'messaging', icon: <Chat sx={{ fontSize: 28 }} /> },
  { key: 'profile', icon: <ManageAccounts sx={{ fontSize: 28 }} /> },
];

const PortalLoginLanding = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { authStatus, isAuthenticated, meStatus, signIn, lockoutReason } = usePortalAuth();
  const [keepSignedIn, setKeepSignedIn] = useState(PERSIST_CHECKBOX_DEFAULT);
  const [termsAccepted, setTermsAccepted] = useState(() => readStoredTermsAccepted());

  useEffect(() => {
    writeStoredTermsAccepted(termsAccepted);
  }, [termsAccepted]);
  const isUnconfigured = authStatus === 'unconfigured';
  // Show spinner during Firebase auth init/sign-in and while /me is in-flight.
  const isLoading =
    authStatus === 'initializing' ||
    authStatus === 'authenticating' ||
    (isAuthenticated && meStatus === 'loading');
  const isAccountDisabled = lockoutReason === 'account_disabled';
  const isNoPortalAccess = lockoutReason === 'no_portal_access';
  const isIdleTimeout = lockoutReason === 'idle_timeout';
  const isAbsoluteTimeout = lockoutReason === 'absolute_timeout';
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
              filter: (theme) => theme.palette.mode === 'light' ? 'invert(1)' : 'none',
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

          <StatusAlertSlot
            message={isAccountDisabled ? { severity: 'error', text: t('portalLogin.accountDisabled') } : null}
          />

          <StatusAlertSlot
            message={isNoPortalAccess ? { severity: 'warning', text: t('portalLogin.noPortalAccess') } : null}
          />

          <StatusAlertSlot
            message={isIdleTimeout ? { severity: 'info', text: t('portalLogin.sessionEnded.idle') } : null}
          />

          <StatusAlertSlot
            message={isAbsoluteTimeout ? { severity: 'info', text: t('portalLogin.sessionEnded.absolute') } : null}
          />

          <StatusAlertSlot
            message={isUnconfigured ? { severity: 'warning', text: t('portalLogin.configWarning') } : null}
          />

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
            <Stack spacing={1} sx={{ width: '100%' }}>
              <FormControlLabel
                control={(
                  <Checkbox
                    size="small"
                    checked={termsAccepted}
                    onChange={(event) => setTermsAccepted(event.target.checked)}
                    inputProps={{ 'aria-label': t('portalLogin.acceptTermsAriaLabel') }}
                  />
                )}
                label={(
                  <Typography variant="body2" color="text.secondary">
                    <Trans
                      i18nKey="portalLogin.acceptTerms"
                      components={{
                        termsLink: (
                          <MuiLink
                            component={RouterLink}
                            to={withDarkPath(pathname, '/terms-of-service')}
                            target="_blank"
                            rel="noopener"
                            underline="hover"
                          />
                        ),
                        privacyLink: (
                          <MuiLink
                            component={RouterLink}
                            to={withDarkPath(pathname, '/privacy')}
                            target="_blank"
                            rel="noopener"
                            underline="hover"
                          />
                        ),
                      }}
                    />
                  </Typography>
                )}
                sx={{ alignItems: 'center', mt: 0, mx: 0 }}
              />
              <FormControlLabel
                control={(
                  <Checkbox
                    size="small"
                    checked={keepSignedIn}
                    onChange={(event) => setKeepSignedIn(event.target.checked)}
                    inputProps={{ 'aria-label': t('portalLogin.keepSignedIn') }}
                  />
                )}
                label={(
                  <Typography variant="body2" color="text.secondary">
                    {t('portalLogin.keepSignedIn')}
                  </Typography>
                )}
                sx={{ mt: 0, mx: 0 }}
              />
              <Typography variant="caption" color="text.secondary">
                {t('portalLogin.keepSignedInHelp')}
              </Typography>
              <Button
                type="button"
                variant="contained"
                fullWidth
                size="large"
                startIcon={<Login />}
                onClick={() => signIn({ keepSignedIn })}
                disabled={!termsAccepted}
                sx={{ textTransform: 'none', py: 1.3, fontWeight: 600, mt: 1 }}
              >
                {t('portalHeader.actions.signIn')}
              </Button>
            </Stack>
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
