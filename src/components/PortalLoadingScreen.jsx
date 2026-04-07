import React from 'react';
import { Box, CircularProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';
import carwoodsLogo from '../assets/carwoods-logo.png';

const PortalLoadingScreen = () => {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        backgroundColor: 'background.default',
      }}
    >
      <Box
        component="img"
        src={carwoodsLogo}
        alt={t('common.carwoodsAlt')}
        sx={{
          height: 40,
          filter: (theme) =>
            theme.palette.mode === 'light' ? 'invert(1)' : 'none',
        }}
      />
      <CircularProgress size={32} aria-label={t('portalLoading.ariaLabel')} />
    </Box>
  );
};

export default PortalLoadingScreen;
