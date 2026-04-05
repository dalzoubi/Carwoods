import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AppBar,
  Button,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { stripDarkPreviewPrefix, withDarkPath } from '../routePaths';

const PortalHeader = () => {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const strippedPath = stripDarkPreviewPrefix(pathname);
  const isSetup = strippedPath === '/portal';
  const isTenant = strippedPath === '/portal/tenant';
  const isLandlord = strippedPath === '/portal/landlord';
  const isAdmin = strippedPath === '/portal/admin';

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{
        borderBottom: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        backgroundImage: 'none',
      }}
    >
      <Toolbar
        sx={{
          width: '100%',
          maxWidth: 1200,
          mx: 'auto',
          px: { xs: 1.5, sm: 2.5 },
          gap: 1.5,
          justifyContent: 'flex-start',
          py: 1,
          alignItems: 'center',
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 700 }}>
            {t('portalHeader.title')}
          </Typography>
          <Button component={Link} to={withDarkPath(pathname, '/')} variant="text" type="button">
            {t('nav.home')}
          </Button>
          <Button component={Link} to={withDarkPath(pathname, '/portal')} variant={isSetup ? 'contained' : 'text'} type="button">
            {t('portalHeader.nav.setup')}
          </Button>
          <Button component={Link} to={withDarkPath(pathname, '/portal/tenant')} variant={isTenant ? 'contained' : 'text'} type="button">
            {t('portalHeader.nav.tenant')}
          </Button>
          <Button component={Link} to={withDarkPath(pathname, '/portal/landlord')} variant={isLandlord ? 'contained' : 'text'} type="button">
            {t('portalHeader.nav.landlord')}
          </Button>
          <Button component={Link} to={withDarkPath(pathname, '/portal/admin')} variant={isAdmin ? 'contained' : 'text'} type="button">
            {t('portalHeader.nav.admin')}
          </Button>
        </Stack>
      </Toolbar>
    </AppBar>
  );
};

export default PortalHeader;
