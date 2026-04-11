import React, { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import Build from '@mui/icons-material/Build';
import Person from '@mui/icons-material/Person';
import Assignment from '@mui/icons-material/Assignment';
import SupervisorAccount from '@mui/icons-material/SupervisorAccount';
import HomeWork from '@mui/icons-material/HomeWork';
import ArrowForward from '@mui/icons-material/ArrowForward';
import Refresh from '@mui/icons-material/Refresh';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { alpha } from '@mui/material/styles';
import { usePortalAuth } from '../PortalAuthContext';
import { hasLandlordAccess } from '../domain/roleUtils.js';
import { isGuestRole, normalizeRole, resolveRole, emailFromAccount } from '../portalUtils';
import { RequestStatus, Role } from '../domain/constants.js';
import { withDarkPath } from '../routePaths';
import { fetchRequests } from '../lib/portalApiClient';

export function statusColor(statusCode) {
  const s = String(statusCode ?? '').toUpperCase();
  if ([RequestStatus.NOT_STARTED, RequestStatus.ACKNOWLEDGED].includes(s)) {
    return 'warning';
  }
  if (
    [RequestStatus.SCHEDULED, RequestStatus.WAITING_ON_TENANT, RequestStatus.WAITING_ON_VENDOR].includes(s)
  ) {
    return 'info';
  }
  if ([RequestStatus.COMPLETE, RequestStatus.CANCELLED].includes(s)) {
    return 'success';
  }
  return 'default';
}

export function countByStatus(requests) {
  let open = 0;
  let inProgress = 0;
  let resolved = 0;
  for (const r of requests) {
    const s = String(r.status_code ?? '').toUpperCase();
    if ([RequestStatus.COMPLETE, RequestStatus.CANCELLED].includes(s)) resolved++;
    else if ([RequestStatus.SCHEDULED, RequestStatus.WAITING_ON_TENANT, RequestStatus.WAITING_ON_VENDOR].includes(s)) inProgress++;
    else if ([RequestStatus.NOT_STARTED, RequestStatus.ACKNOWLEDGED].includes(s)) open++;
  }
  return { open, inProgress, resolved };
}

function roleLabel(roleValue, t) {
  const role = normalizeRole(roleValue);
  if (role === Role.ADMIN) return t('portalHeader.roles.admin');
  if (role === Role.LANDLORD) return t('portalHeader.roles.landlord');
  if (role === Role.TENANT) return t('portalHeader.roles.tenant');
  return t('portalHeader.roles.unknown');
}

function toPriorityCode(priorityCode, priorityName) {
  const fromCode = String(priorityCode ?? '').trim().toUpperCase();
  if (fromCode) return fromCode;
  const fromName = String(priorityName ?? '').trim().toUpperCase().replace(/\s+/g, '_');
  return fromName;
}

function priorityLabel(req) {
  return req.priority_name || req.priority_code || '-';
}

function requesterName(req, t) {
  const candidates = [
    req.submitted_by_display_name,
    req.requester_name,
    req.reported_by_name,
    req.tenant_name,
    req.created_by_name,
  ];
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim();
    if (value) return value;
  }
  return t('portalRequests.messages.senderUnknown');
}

function updatedAtMs(req) {
  const raw = req?.updated_at || req?.updatedAt || req?.modified_at || req?.modifiedAt;
  const ms = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
}

function formatUpdatedAt(req) {
  const raw = req?.updated_at || req?.updatedAt || req?.modified_at || req?.modifiedAt;
  if (!raw) return '-';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return String(raw);
  return date.toLocaleString();
}

export function priorityTone(req) {
  const code = toPriorityCode(req?.priority_code, req?.priority_name);
  if (code === 'EMERGENCY') {
    return {
      chipColor: 'error',
      borderColor: 'error.main',
      bgColor: (theme) => alpha(theme.palette.error.main, 0.08),
    };
  }
  if (code === 'URGENT') {
    return {
      chipColor: 'warning',
      borderColor: 'warning.main',
      bgColor: (theme) => alpha(theme.palette.warning.main, 0.08),
    };
  }
  if (code === 'ROUTINE') {
    return {
      chipColor: 'info',
      borderColor: 'info.main',
      bgColor: (theme) => alpha(theme.palette.info.main, 0.06),
    };
  }
  return {
    chipColor: 'default',
    borderColor: 'divider',
    bgColor: 'transparent',
  };
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
  const { pathname, state: locationState } = useLocation();
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

  const [accessDeniedOpen, setAccessDeniedOpen] = useState(
    () => !!(locationState?.portalAccessDenied)
  );

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
  const recentRequests = [...requests]
    .sort((a, b) => updatedAtMs(b) - updatedAtMs(a))
    .slice(0, 5);
  const showDashboard = isAuthenticated && meStatus === 'ok' && !isGuest;

  return (
    <Box>
      <Helmet>
        <title>{t('portalDashboard.title')}</title>
        <meta name="description" content={t('portalDashboard.metaDescription')} />
      </Helmet>

      <Snackbar
        open={accessDeniedOpen}
        autoHideDuration={5000}
        onClose={() => setAccessDeniedOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity="warning"
          onClose={() => setAccessDeniedOpen(false)}
          sx={{ width: '100%' }}
        >
          {t('portalDashboard.accessDenied')}
        </Alert>
      </Snackbar>

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
                    to={withDarkPath(pathname, '/portal/requests?create=1')}
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
                    to={withDarkPath(pathname, '/portal/admin/landlords')}
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
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button
                    type="button"
                    size="small"
                    variant="outlined"
                    onClick={() => void loadRequests()}
                    disabled={reqStatus === 'loading'}
                    startIcon={reqStatus === 'loading' ? <CircularProgress size={14} /> : <Refresh />}
                    sx={{ textTransform: 'none' }}
                  >
                    {t('portalDashboard.actions.refresh')}
                  </Button>
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
                  {recentRequests.map((req) => {
                    const tone = priorityTone(req);
                    const submitterRoleLabel = roleLabel(req.submitted_by_role, t);
                    return (
                      <Card
                        key={req.id}
                        variant="outlined"
                        sx={{
                          cursor: 'pointer',
                          borderInlineStartWidth: 4,
                          borderInlineStartStyle: 'solid',
                          borderInlineStartColor: tone.borderColor,
                          bgcolor: tone.bgColor,
                          '&:hover': { borderColor: 'primary.main' },
                          transition: 'border-color 0.2s, background-color 0.2s',
                        }}
                        component={RouterLink}
                        to={withDarkPath(
                          pathname,
                          `/portal/requests?id=${encodeURIComponent(req.id)}`
                        )}
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
                            <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
                              <Chip
                                label={`${t('portalRequests.labels.priority')}: ${priorityLabel(req)}`}
                                size="small"
                                color={tone.chipColor}
                                variant={tone.chipColor === 'default' ? 'outlined' : 'filled'}
                              />
                              <Chip
                                label={req.status_name || req.status_code || 'Open'}
                                size="small"
                                color={statusColor(req.status_code)}
                                variant="outlined"
                              />
                            </Stack>
                          </Stack>
                          {isManagement && (
                            <Stack
                              direction="row"
                              alignItems="center"
                              spacing={0.75}
                              sx={{ mt: 0.75, flexWrap: 'wrap' }}
                            >
                              <Typography variant="caption" color="text.secondary">
                                {t('portalRequests.labels.reportedBy')}: {requesterName(req, t)}
                              </Typography>
                              <Chip
                                label={submitterRoleLabel}
                                size="small"
                                color="primary"
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                              />
                            </Stack>
                          )}
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                            {t('portalRequests.labels.updatedAt')}: {formatUpdatedAt(req)}
                          </Typography>
                        </CardContent>
                      </Card>
                    );
                  })}
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
