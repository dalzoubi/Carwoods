import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Box, Button, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { withDarkPath } from '../routePaths';

function roleKey(role) {
  return role === 'admin' ? 'admin' : 'tenant';
}

const PortalWorkspace = ({ role = 'tenant' }) => {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const key = roleKey(role);

  return (
    <Box sx={{ py: 4 }}>
      <Stack spacing={2.5}>
        <Stack direction="row" spacing={1.25} sx={{ flexWrap: 'wrap' }}>
          <Button component={Link} to={withDarkPath(pathname, '/portal')} type="button" variant="outlined">
            {t('portalWorkspace.actions.backToSetup')}
          </Button>
          <Button component={Link} to={withDarkPath(pathname, '/portal/tenant')} type="button" variant={key === 'tenant' ? 'contained' : 'outlined'}>
            {t('portalWorkspace.actions.tenant')}
          </Button>
          <Button component={Link} to={withDarkPath(pathname, '/portal/admin')} type="button" variant={key === 'admin' ? 'contained' : 'outlined'}>
            {t('portalWorkspace.actions.admin')}
          </Button>
        </Stack>

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
            <Typography sx={{ fontWeight: 600 }}>{t('portalWorkspace.nextHeading')}</Typography>
            <ul style={{ margin: 0 }}>
              <li>{t(`portalWorkspace.${key}.next1`)}</li>
              <li>{t(`portalWorkspace.${key}.next2`)}</li>
              <li>{t(`portalWorkspace.${key}.next3`)}</li>
            </ul>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
};

export default PortalWorkspace;
