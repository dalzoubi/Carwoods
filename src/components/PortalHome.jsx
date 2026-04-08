import React from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { usePortalAuth } from '../PortalAuthContext';
import { isGuestRole, normalizeRole, resolveRole } from '../portalUtils';
import { Role } from '../domain/constants.js';
import { withDarkPath } from '../routePaths';

const PortalHome = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const {
    account,
    isAuthenticated,
    meStatus,
    meData,
    signIn,
  } = usePortalAuth();
  const effectiveRole = resolveRole(meData, account);
  const normalizedRole = normalizeRole(effectiveRole);
  const roleResolved = isAuthenticated && meStatus !== 'loading';
  const isGuestAccount = roleResolved && isGuestRole(normalizedRole);
  const showPortalActions = isAuthenticated && meStatus === 'ok' && !isGuestAccount;
  const portalActions = [
    { to: '/portal/requests', label: t('portalHeader.nav.requests') },
    { to: '/portal/profile', label: t('portalHeader.nav.profile') },
    ...(normalizedRole === Role.ADMIN
      ? [{ to: '/portal/admin/landlords', label: t('portalHeader.nav.adminLandlords') }]
      : []),
  ];

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
              {t('portalSetup.portalActionsHeading')}
            </Typography>
            <Typography color="text.secondary">{t('portalSetup.portalActionsIntro')}</Typography>
            {!isAuthenticated && (
              <Stack spacing={1.25}>
                <Alert severity="info">{t('portalSetup.portalActionsUnavailable')}</Alert>
                <Box>
                  <Button
                    type="button"
                    variant="contained"
                    onClick={async () => {
                      const didSignIn = await signIn();
                      if (didSignIn) {
                        navigate(withDarkPath(pathname, '/portal'));
                      }
                    }}
                  >
                    {t('portalSetup.actions.signIn')}
                  </Button>
                </Box>
              </Stack>
            )}
            {isGuestAccount && (
              <Alert severity="warning">{t('portalSetup.guestBlocked')}</Alert>
            )}
            {showPortalActions && (
              <Stack spacing={1.25}>
                {portalActions.map(({ to, label }) => (
                  <Box
                    key={to}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1.5,
                      p: 1.5,
                      backgroundColor: 'background.default',
                    }}
                  >
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1.25}
                      sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
                    >
                      <Typography sx={{ fontWeight: 600 }}>{label}</Typography>
                      <Button
                        component={RouterLink}
                        to={withDarkPath(pathname, to)}
                        type="button"
                        variant="outlined"
                        size="small"
                      >
                        {t('portalSetup.actions.open')}
                      </Button>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
};

export default PortalHome;
