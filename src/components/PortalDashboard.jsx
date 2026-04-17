import React, { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
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
import People from '@mui/icons-material/People';
import ArrowForward from '@mui/icons-material/ArrowForward';
import Close from '@mui/icons-material/Close';
import CheckCircle from '@mui/icons-material/CheckCircle';
import RadioButtonUnchecked from '@mui/icons-material/RadioButtonUnchecked';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { alpha } from '@mui/material/styles';
import { usePortalAuth } from '../PortalAuthContext';
import { hasLandlordAccess } from '../domain/roleUtils.js';
import { isGuestRole, normalizeRole, resolveRole, emailFromAccount } from '../portalUtils';
import { RequestStatus, Role } from '../domain/constants.js';
import { withDarkPath } from '../routePaths';
import { fetchRequests, fetchLandlordProperties, fetchTenants } from '../lib/portalApiClient';
import PortalRefreshButton from './PortalRefreshButton';
import PortalUserAvatar from './PortalUserAvatar';
import { ONBOARDING_SETTINGS_VISITED_KEY } from './PortalAdminAiSettings';
import { usePortalRequestDetailModal } from './PortalRequestDetailModalContext';

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

const StatCard = ({ label, value, loading, to }) => (
  <Paper
    variant="outlined"
    component={to ? RouterLink : 'div'}
    {...(to ? { to } : {})}
    sx={{
      flex: '1 1 0',
      minWidth: 120,
      p: 2.5,
      textAlign: 'center',
      borderRadius: 2,
      textDecoration: 'none',
      color: 'inherit',
      transition: 'border-color 0.2s, box-shadow 0.2s',
      ...(to
        ? {
            cursor: 'pointer',
            '&:hover': {
              borderColor: 'primary.main',
              boxShadow: 1,
            },
          }
        : {}),
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

const ONBOARDING_DISMISSED_KEY = 'carwoods-onboarding-dismissed';

const OnboardingChecklist = ({ pathname, baseUrl, getAccessToken }) => {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(ONBOARDING_DISMISSED_KEY) === 'true'
  );
  const [hasProperties, setHasProperties] = useState(false);
  const [hasTenants, setHasTenants] = useState(false);
  const [basicsFetched, setBasicsFetched] = useState(false);
  const [hasSettings, setHasSettings] = useState(
    () => localStorage.getItem(ONBOARDING_SETTINGS_VISITED_KEY) === 'true'
  );

  /** Landlord must finish property + tenant setup before dismiss applies. */
  const basicsIncomplete = !hasProperties || !hasTenants;

  useEffect(() => {
    if (!baseUrl || !getAccessToken) {
      setBasicsFetched(true);
      return;
    }
    // Avoid re-fetch loops: do not depend on hasProperties/hasTenants. Skip only when the user
    // dismissed after completing basics (both lists non-empty from the last fetch).
    if (dismissed && hasProperties && hasTenants) {
      setBasicsFetched(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        const [propsData, tenantsData] = await Promise.all([
          fetchLandlordProperties(baseUrl, token, {}),
          fetchTenants(baseUrl, token, {}),
        ]);
        if (cancelled) return;
        const props = Array.isArray(propsData) ? propsData : (propsData?.properties ?? []);
        const tens = Array.isArray(tenantsData) ? tenantsData : (tenantsData?.tenants ?? []);
        setHasProperties(props.length > 0);
        setHasTenants(tens.length > 0);
      } catch {
        // non-critical — checklist degrades gracefully; assume empty so dismiss logic can settle
        setHasProperties(false);
        setHasTenants(false);
      } finally {
        if (!cancelled) setBasicsFetched(true);
      }
    })();
    return () => { cancelled = true; };
  }, [dismissed, baseUrl, getAccessToken]);

  const handleDismiss = () => {
    localStorage.setItem(ONBOARDING_DISMISSED_KEY, 'true');
    setDismissed(true);
  };

  // Auto-dismiss once all steps are done
  const allDone = hasProperties && hasTenants && hasSettings;
  useEffect(() => {
    if (allDone) handleDismiss();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone]);

  // While dismissed is true, hasProperties/hasTenants start false until the fetch runs; without
  // basicsFetched we would flash the card then hide once the API confirms basics are complete.
  if (dismissed && (!basicsFetched || !basicsIncomplete)) return null;

  const steps = [
    {
      label: t('portalDashboard.onboarding.step1Label'),
      desc: t('portalDashboard.onboarding.step1Desc'),
      action: t('portalDashboard.onboarding.step1Action'),
      to: withDarkPath(pathname, '/portal/properties'),
      done: hasProperties,
    },
    {
      label: t('portalDashboard.onboarding.step2Label'),
      desc: t('portalDashboard.onboarding.step2Desc'),
      action: t('portalDashboard.onboarding.step2Action'),
      to: withDarkPath(pathname, '/portal/tenants'),
      done: hasTenants,
    },
    {
      label: t('portalDashboard.onboarding.step3Label'),
      desc: t('portalDashboard.onboarding.step3Desc'),
      action: t('portalDashboard.onboarding.step3Action'),
      to: withDarkPath(pathname, '/portal/admin/config'),
      done: hasSettings,
    },
  ];

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2.5, sm: 3 },
        borderRadius: 2,
        borderColor: 'primary.light',
        position: 'relative',
      }}
    >
      {!basicsIncomplete && (
        <IconButton
          type="button"
          size="small"
          color="inherit"
          onClick={handleDismiss}
          aria-label={t('portalDashboard.onboarding.dismissAriaLabel')}
          sx={{ position: 'absolute', top: 8, insetInlineEnd: 8 }}
        >
          <Close fontSize="small" />
        </IconButton>
      )}
      <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 0.5, pr: 4 }}>
        {t('portalDashboard.onboarding.heading')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        {t('portalDashboard.onboarding.subheading')}
      </Typography>
      <Stack spacing={1.5}>
        {steps.map((step, i) => (
          <Stack
            key={i}
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{
              p: 1.5,
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: step.done ? 'success.light' : 'divider',
              bgcolor: step.done ? (theme) => alpha(theme.palette.success.main, 0.06) : 'background.default',
              transition: 'border-color 0.2s, background-color 0.2s',
            }}
          >
            {step.done ? (
              <CheckCircle sx={{ color: 'success.main', flexShrink: 0 }} aria-hidden />
            ) : (
              <RadioButtonUnchecked sx={{ color: 'text.disabled', flexShrink: 0 }} aria-hidden />
            )}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="body2"
                fontWeight={600}
                sx={{ textDecoration: step.done ? 'line-through' : 'none', color: step.done ? 'text.secondary' : 'text.primary' }}
              >
                {step.label}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {step.desc}
              </Typography>
            </Box>
            {!step.done && (
              <Button
                component={RouterLink}
                to={step.to}
                size="small"
                variant="outlined"
                endIcon={<ArrowForward sx={{ fontSize: '0.9rem' }} />}
                sx={{ textTransform: 'none', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}
              >
                {step.action}
              </Button>
            )}
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
};

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
  const { openRequestDetail, isAvailable: requestDetailModalAvailable } = usePortalRequestDetailModal();

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
          role="alert"
          aria-live="assertive"
          sx={{ width: '100%' }}
        >
          {t('portalDashboard.accessDenied')}
        </Alert>
      </Snackbar>

      <Stack spacing={3}>
        {/* Welcome */}
        <Typography variant="h4" component="h1" fontWeight={700}>
          {firstName
            ? t('portalDashboard.welcomeBack', { name: firstName })
            : t('portalDashboard.welcomeGeneric')}
        </Typography>

        {/* Onboarding checklist — landlords without properties or tenants (or settings) */}
        {showDashboard && normalized === Role.LANDLORD && (
          <OnboardingChecklist pathname={pathname} baseUrl={baseUrl} getAccessToken={getAccessToken} />
        )}

        {showDashboard && (
          <>
            {/* Stats */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <StatCard
                label={t('portalDashboard.stats.open')}
                value={stats.open}
                loading={reqStatus === 'loading'}
                to={stats.open > 0 ? withDarkPath(pathname, '/portal/requests?status=open') : undefined}
              />
              <StatCard
                label={t('portalDashboard.stats.inProgress')}
                value={stats.inProgress}
                loading={reqStatus === 'loading'}
                to={
                  stats.inProgress > 0
                    ? withDarkPath(pathname, '/portal/requests?status=inProgress')
                    : undefined
                }
              />
              <StatCard
                label={t('portalDashboard.stats.resolved')}
                value={stats.resolved}
                loading={reqStatus === 'loading'}
                to={stats.resolved > 0 ? withDarkPath(pathname, '/portal/requests?status=resolved') : undefined}
              />
            </Stack>

            {/* Quick Actions */}
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" component="h2" fontWeight={600} gutterBottom>
                {t('portalDashboard.quickActions.heading')}
              </Typography>
              <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap" sx={{ gap: 1.5 }}>
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
                {(normalized === Role.LANDLORD || normalized === Role.ADMIN) && (
                  <Button
                    component={RouterLink}
                    to={withDarkPath(pathname, '/portal/tenants')}
                    type="button"
                    variant="outlined"
                    startIcon={<People />}
                    sx={{ textTransform: 'none' }}
                  >
                    {t('portalDashboard.quickActions.manageTenants')}
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
              </Stack>
            </Paper>

            {/* Recent Requests */}
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6" component="h2" fontWeight={600}>
                  {t('portalDashboard.recentRequests.heading')}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PortalRefreshButton
                    label={t('portalDashboard.actions.refresh')}
                    onClick={() => void loadRequests()}
                    loading={reqStatus === 'loading'}
                  />
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
                    const openInOverlay = Boolean(req.id) && requestDetailModalAvailable;
                    const requestTitle = req.title || t('portalDashboard.recentRequests.noTitle');
                    return (
                      <Card
                        key={req.id}
                        variant="outlined"
                        {...(openInOverlay
                          ? {
                              component: 'div',
                              role: 'button',
                              tabIndex: 0,
                              'aria-label': t('portalDashboard.recentRequests.openRequestAria', {
                                title: requestTitle,
                              }),
                              onClick: () => openRequestDetail(req.id),
                              onKeyDown: (e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  openRequestDetail(req.id);
                                }
                              },
                            }
                          : {
                              component: RouterLink,
                              to: withDarkPath(
                                pathname,
                                `/portal/requests?id=${encodeURIComponent(req.id)}`
                              ),
                            })}
                        sx={{
                          cursor: 'pointer',
                          borderInlineStartWidth: 4,
                          borderInlineStartStyle: 'solid',
                          borderInlineStartColor: tone.borderColor,
                          bgcolor: tone.bgColor,
                          color: 'inherit',
                          textDecoration: 'none',
                          '&:hover': { borderColor: 'primary.main' },
                          transition: 'border-color 0.2s, background-color 0.2s',
                        }}
                      >
                        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            sx={{ flexWrap: 'wrap', gap: 1 }}
                          >
                            <Typography variant="body2" fontWeight={600} noWrap sx={{ flex: 1, minWidth: 0 }}>
                              {requestTitle}
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
                              <Typography variant="caption" color="text.secondary" component="span">
                                {t('portalRequests.labels.reportedBy')}:
                              </Typography>
                              <PortalUserAvatar
                                photoUrl={String(req.submitted_by_profile_photo_url ?? '').trim()}
                                firstName={String(req.submitted_by_first_name ?? '')}
                                lastName={String(req.submitted_by_last_name ?? '')}
                                size={28}
                              />
                              <Typography variant="caption" color="text.secondary" component="span">
                                {requesterName(req, t)}
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
