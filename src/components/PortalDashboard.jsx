import React, { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import Build from '@mui/icons-material/Build';
import Person from '@mui/icons-material/Person';
import Assignment from '@mui/icons-material/Assignment';
import SupervisorAccount from '@mui/icons-material/SupervisorAccount';
import HomeWork from '@mui/icons-material/HomeWork';
import ArrowForward from '@mui/icons-material/ArrowForward';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { usePortalAuth } from '../PortalAuthContext';
import { hasLandlordAccess } from '../domain/roleUtils.js';
import { isGuestRole, normalizeRole, resolveRole, emailFromAccount } from '../portalUtils';
import { Role } from '../domain/constants.js';
import { withDarkPath } from '../routePaths';
import { fetchRequests } from '../lib/portalApiClient';

function statusColor(statusId) {
  const s = String(statusId ?? '').toUpperCase();
  if (s === 'OPEN' || s === 'NEW') return 'warning';
  if (s === 'IN_PROGRESS') return 'info';
  if (s === 'CLOSED' || s === 'RESOLVED') return 'success';
  return 'default';
}

function countByStatus(requests) {
  let open = 0;
  let inProgress = 0;
  let resolved = 0;
  for (const r of requests) {
    const s = String(r.current_status_id ?? '').toUpperCase();
    if (s === 'CLOSED' || s === 'RESOLVED') resolved++;
    else if (s === 'IN_PROGRESS') inProgress++;
    else open++;
  }
  return { open, inProgress, resolved };
}

const StatCard = ({ label, value, loading }) => (
  <Paper
    variant="outlined"
    sx={{
      flex: '1 1 0',
      minWidth: 120,
      p: 2.5,
      textAlign: 'center',
      borderRadius: 2,
    }}
  >
    {loading ? (
      <Skeleton variant="text" width={40} height={36} sx={{ mx: 'auto' }} />
    ) : (
      <Typography variant="h4" fontWeight={700} color="primary.main">
        {value}
      </Typography>
    )}
    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
      {label}
    </Typography>
  </Paper>
);

const PortalDashboard = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const {
    baseUrl,
    isAuthenticated,
    account,
    meData,
    meStatus,
    getAccessToken,
  } = usePortalAuth();

  const role = resolveRole(meData, account);
  const normalized = normalizeRole(role);
  const isGuest = isGuestRole(normalized);
  const isManagement = hasLandlordAccess(normalized);
  const firstName = (meData?.user?.first_name ?? '').trim();

  const [requests, setRequests] = useState([]);
  const [reqStatus, setReqStatus] = useState('idle');

  const loadRequests = useCallback(async () => {
    if (!baseUrl || !isAuthenticated || isGuest) return;
    setReqStatus('loading');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      const path = isManagement ? '/api/landlord/requests' : '/api/portal/requests';
      const data = await fetchRequests(baseUrl, token, { path, emailHint });
      setRequests(Array.isArray(data) ? data : data?.requests ?? []);
      setReqStatus('ok');
    } catch {
      setReqStatus('error');
    }
  }, [baseUrl, isAuthenticated, isGuest, isManagement, getAccessToken, account]);

  useEffect(() => {
    if (isAuthenticated && meStatus === 'ok' && !isGuest) {
      loadRequests();
    }
  }, [isAuthenticated, meStatus, isGuest, loadRequests]);

  const stats = countByStatus(requests);
  const recentRequests = requests.slice(0, 5);
  const showDashboard = isAuthenticated && meStatus === 'ok' && !isGuest;

  return (
    <Box>
      <Helmet>
        <title>{t('portalDashboard.title')}</title>
        <meta name="description" content={t('portalDashboard.metaDescription')} />
      </Helmet>

      <Stack spacing={3}>
        {/* Welcome */}
        <Box>
          <Typography variant="h4" component="h1" fontWeight={700} gutterBottom>
            {firstName
              ? t('portalDashboard.welcomeBack', { name: firstName })
              : t('portalDashboard.welcomeGeneric')}
          </Typography>
        </Box>

        {showDashboard && (
          <>
            {/* Stats */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <StatCard
                label={t('portalDashboard.stats.open')}
                value={stats.open}
                loading={reqStatus === 'loading'}
              />
              <StatCard
                label={t('portalDashboard.stats.inProgress')}
                value={stats.inProgress}
                loading={reqStatus === 'loading'}
              />
              <StatCard
                label={t('portalDashboard.stats.resolved')}
                value={stats.resolved}
                loading={reqStatus === 'loading'}
              />
            </Stack>

            {/* Quick Actions */}
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                {t('portalDashboard.quickActions.heading')}
              </Typography>
              <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1.5 }}>
                {!isManagement && (
                  <Button
                    component={RouterLink}
                    to={withDarkPath(pathname, '/portal/requests')}
                    type="button"
                    variant="contained"
                    startIcon={<Build />}
                    sx={{ textTransform: 'none' }}
                  >
                    {t('portalDashboard.quickActions.newRequest')}
                  </Button>
                )}
                <Button
                  component={RouterLink}
                  to={withDarkPath(pathname, '/portal/requests')}
                  type="button"
                  variant="outlined"
                  startIcon={<Assignment />}
                  sx={{ textTransform: 'none' }}
                >
                  {t('portalDashboard.quickActions.viewRequests')}
                </Button>
                <Button
                  component={RouterLink}
                  to={withDarkPath(pathname, '/portal/profile')}
                  type="button"
                  variant="outlined"
                  startIcon={<Person />}
                  sx={{ textTransform: 'none' }}
                >
                  {t('portalDashboard.quickActions.viewProfile')}
                </Button>
                {(normalized === Role.LANDLORD || normalized === Role.ADMIN) && (
                  <Button
                    component={RouterLink}
                    to={withDarkPath(pathname, '/portal/properties')}
                    type="button"
                    variant="outlined"
                    startIcon={<HomeWork />}
                    sx={{ textTransform: 'none' }}
                  >
                    {t('portalDashboard.quickActions.manageProperties')}
                  </Button>
                )}
                {normalized === Role.ADMIN && (
                  <Button
                    component={RouterLink}
                    to={withDarkPath(pathname, '/portal/admin')}
                    type="button"
                    variant="outlined"
                    startIcon={<SupervisorAccount />}
                    sx={{ textTransform: 'none' }}
                  >
                    {t('portalDashboard.quickActions.manageLandlords')}
                  </Button>
                )}
              </Stack>
            </Paper>

            {/* Recent Requests */}
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>
                  {t('portalDashboard.recentRequests.heading')}
                </Typography>
                {requests.length > 0 && (
                  <Button
                    component={RouterLink}
                    to={withDarkPath(pathname, '/portal/requests')}
                    type="button"
                    size="small"
                    endIcon={<ArrowForward />}
                    sx={{ textTransform: 'none' }}
                  >
                    {t('portalDashboard.recentRequests.viewAll')}
                  </Button>
                )}
              </Stack>

              {reqStatus === 'loading' && (
                <Stack spacing={1.5}>
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} variant="rounded" height={56} />
                  ))}
                </Stack>
              )}

              {reqStatus !== 'loading' && recentRequests.length === 0 && (
                <Typography color="text.secondary" variant="body2">
                  {isManagement
                    ? t('portalDashboard.recentRequests.emptyManagement')
                    : t('portalDashboard.recentRequests.empty')}
                </Typography>
              )}

              {reqStatus !== 'loading' && recentRequests.length > 0 && (
                <Stack spacing={1}>
                  {recentRequests.map((req) => (
                    <Card
                      key={req.id}
                      variant="outlined"
                      sx={{
                        cursor: 'pointer',
                        '&:hover': { borderColor: 'primary.main' },
                        transition: 'border-color 0.2s',
                      }}
                      component={RouterLink}
                      to={withDarkPath(pathname, '/portal/requests')}
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          sx={{ flexWrap: 'wrap', gap: 1 }}
                        >
                          <Typography variant="body2" fontWeight={600} noWrap sx={{ flex: 1, minWidth: 0 }}>
                            {req.title || t('portalDashboard.recentRequests.noTitle')}
                          </Typography>
                          <Chip
                            label={req.current_status_id || 'OPEN'}
                            size="small"
                            color={statusColor(req.current_status_id)}
                            variant="outlined"
                          />
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )}
            </Paper>
          </>
        )}
      </Stack>
    </Box>
  );
};

export default PortalDashboard;
