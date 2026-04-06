import React from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import PortalLoginLanding from './PortalLoginLanding';

const PortalAuthGate = ({ children }) => {
  const { authStatus, isAuthenticated } = usePortalAuth();
  const { t } = useTranslation();

  if (authStatus === 'initializing') {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: 'background.default',
        }}
      >
        <Stack spacing={2} alignItems="center">
          <CircularProgress />
          <Typography color="text.secondary">
            {t('portalSetup.authStatus.initializing')}
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <PortalLoginLanding />;
  }

  return children;
};

export default PortalAuthGate;
