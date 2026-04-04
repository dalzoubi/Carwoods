import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Button,
  Chip,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { withDarkPath } from '../routePaths';
import { usePortalAuth } from '../PortalAuthContext';
import { normalizeRole, resolveDisplayName, resolveRole } from '../portalUtils';

function roleLabel(role, t) {
  const normalized = normalizeRole(role);
  if (normalized === 'ADMIN') return t('portalHeader.roles.admin');
  if (normalized === 'LANDLORD') return t('portalHeader.roles.landlord');
  if (normalized === 'TENANT') return t('portalHeader.roles.tenant');
  if (normalized) return normalized;
  return t('portalHeader.roles.unknown');
}

const PortalHeader = () => {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const { isAuthenticated, account, meData, signIn, signOut } = usePortalAuth();
  const accountName = resolveDisplayName(meData, account, t('portalHeader.notSignedIn'));
  const role = resolveRole(meData, account);

  return (
    <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
      <Toolbar sx={{ gap: 1.5, justifyContent: 'space-between', py: 1, alignItems: 'center' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 700 }}>
            {t('portalHeader.title')}
          </Typography>
          <Button component={Link} to={withDarkPath(pathname, '/portal')} variant="text" type="button">
            {t('portalHeader.nav.setup')}
          </Button>
          <Button component={Link} to={withDarkPath(pathname, '/portal/tenant')} variant="text" type="button">
            {t('portalHeader.nav.tenant')}
          </Button>
          <Button component={Link} to={withDarkPath(pathname, '/portal/landlord')} variant="text" type="button">
            {t('portalHeader.nav.landlord')}
          </Button>
          <Button component={Link} to={withDarkPath(pathname, '/portal/admin')} variant="text" type="button">
            {t('portalHeader.nav.admin')}
          </Button>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Chip size="small" color={isAuthenticated ? 'success' : 'default'} label={isAuthenticated ? t('portalHeader.status.signedIn') : t('portalHeader.status.signedOut')} />
          <Chip size="small" variant="outlined" label={roleLabel(role, t)} />
          <Box sx={{ maxWidth: 320 }}>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={accountName}
            >
              {accountName}
            </Typography>
          </Box>
          {!isAuthenticated && (
            <Button type="button" variant="contained" onClick={signIn}>
              {t('portalHeader.actions.signIn')}
            </Button>
          )}
          {isAuthenticated && (
            <Button type="button" variant="outlined" onClick={signOut}>
              {t('portalHeader.actions.signOut')}
            </Button>
          )}
        </Stack>
      </Toolbar>
    </AppBar>
  );
};

export default PortalHeader;
