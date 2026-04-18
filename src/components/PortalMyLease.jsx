import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { usePortalAuth } from '../PortalAuthContext';
import { Role } from '../domain/constants.js';
import { resolveRole, normalizeRole } from '../portalUtils';
import {
  fetchMyLeases,
  giveNotice as apiGiveNotice,
  coSignNotice as apiCoSignNotice,
  withdrawNotice as apiWithdrawNotice,
} from '../lib/portalApiClient';
import PortalFeedbackSnackbar from './PortalFeedbackSnackbar';
import { usePortalFeedback } from '../hooks/usePortalFeedback';
import StatusAlertSlot from './StatusAlertSlot';
import EmptyState from './EmptyState';

const NOTICE_REASONS = ['relocating', 'job', 'purchase', 'early_termination', 'other'];

function toDatePart(dateStr) {
  if (!dateStr) return '';
  return String(dateStr).slice(0, 10);
}

function formatDate(dateStr) {
  const ymd = toDatePart(dateStr);
  if (!ymd) return '';
  try {
    return new Date(ymd + 'T00:00:00').toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(dateStr);
  }
}

function formatAddress(lease) {
  const parts = [lease?.property_street, lease?.property_city, lease?.property_state, lease?.property_zip]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean);
  return parts.join(', ');
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isCurrentLease(lease) {
  const today = todayIso();
  const start = toDatePart(lease?.start_date);
  const end = toDatePart(lease?.end_date);
  if (!start) return false;
  if (start > today) return false;
  if (lease?.month_to_month) return true;
  if (!end) return true;
  return end >= today;
}

function noticeStatusColor(status) {
  switch (status) {
    case 'accepted':
      return 'success';
    case 'rejected':
    case 'withdrawn':
    case 'superseded':
      return 'default';
    case 'pending_tenant':
      return 'warning';
    default:
      return 'info';
  }
}

const PortalMyLease = () => {
  const { t } = useTranslation();
  const {
    baseUrl,
    isAuthenticated,
    account,
    meData,
    meStatus,
    getAccessToken,
    handleApiForbidden,
  } = usePortalAuth();

  const role = normalizeRole(resolveRole(meData, account));
  const canUseModule = isAuthenticated && role === Role.TENANT && Boolean(baseUrl);

  const emailHint = meData?.user?.email ?? account?.username ?? '';
  const [state, setState] = useState({ status: 'idle', leases: [] });
  const [giveOpen, setGiveOpen] = useState(false);
  const [selectedLease, setSelectedLease] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const { feedback, showFeedback, closeFeedback } = usePortalFeedback();

  const load = useCallback(async () => {
    if (!canUseModule) {
      setState({ status: 'idle', leases: [] });
      return;
    }
    setState((prev) => ({ ...prev, status: 'loading' }));
    try {
      const accessToken = await getAccessToken();
      const payload = await fetchMyLeases(baseUrl, accessToken, { emailHint });
      setState({ status: 'ok', leases: Array.isArray(payload?.leases) ? payload.leases : [] });
    } catch (e) {
      handleApiForbidden(e);
      setState({ status: 'error', leases: [], detail: t('portalMyLease.errors.loadFailed') });
    }
  }, [canUseModule, baseUrl, emailHint, getAccessToken, handleApiForbidden, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleOpenGive = (lease) => {
    setSelectedLease(lease);
    setGiveOpen(true);
  };

  const handleCoSign = async (lease) => {
    if (!lease?.live_notice?.id) return;
    setActionBusy(true);
    try {
      const accessToken = await getAccessToken();
      await apiCoSignNotice(baseUrl, accessToken, lease.live_notice.id, { emailHint });
      showFeedback(t('portalMyLease.messages.coSigned'), 'success');
      await load();
    } catch (e) {
      handleApiForbidden(e);
      showFeedback(t('portalMyLease.errors.coSignFailed'), 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleWithdraw = async (lease) => {
    if (!lease?.live_notice?.id) return;
    setActionBusy(true);
    try {
      const accessToken = await getAccessToken();
      await apiWithdrawNotice(baseUrl, accessToken, lease.live_notice.id, { emailHint });
      showFeedback(t('portalMyLease.messages.withdrawn'), 'success');
      await load();
    } catch (e) {
      handleApiForbidden(e);
      showFeedback(t('portalMyLease.errors.withdrawFailed'), 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const activeLeases = useMemo(
    () => (state.leases || []).filter((l) => l.is_active),
    [state.leases]
  );

  const accessDenied = isAuthenticated && meStatus !== 'loading' && !canUseModule;

  return (
    <Box sx={{ py: 4 }}>
      <Helmet>
        <title>{t('portalMyLease.title')}</title>
        <meta name="description" content={t('portalMyLease.metaDescription')} />
      </Helmet>

      <Stack spacing={3}>
        <Box>
          <Typography variant="h5" component="h1" fontWeight={700}>
            {t('portalMyLease.heading')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('portalMyLease.intro')}
          </Typography>
        </Box>

        {!baseUrl && (
          <StatusAlertSlot
            message={{ severity: 'warning', text: t('portalMyLease.errors.apiUnavailable') }}
          />
        )}
        {accessDenied && (
          <StatusAlertSlot
            message={{ severity: 'error', text: t('portalMyLease.errors.accessDenied') }}
          />
        )}
        {state.status === 'error' && (
          <StatusAlertSlot
            message={{ severity: 'error', text: state.detail ?? t('portalMyLease.errors.loadFailed') }}
          />
        )}

        {state.status === 'loading' && state.leases.length === 0 && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', py: 2 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              {t('portalMyLease.loading')}
            </Typography>
          </Stack>
        )}

        {state.status === 'ok' && activeLeases.length === 0 && (
          <Paper variant="outlined" sx={{ borderRadius: 2 }}>
            <EmptyState
              title={t('portalMyLease.empty.title')}
              description={t('portalMyLease.empty.description')}
            />
          </Paper>
        )}

        {activeLeases.map((lease) => {
          const live = lease.live_notice;
          const startFmt = formatDate(lease.start_date) || '—';
          const endFmt = lease.month_to_month
            ? t('portalMyLease.monthToMonth')
            : (formatDate(lease.end_date) || '—');
          return (
            <Paper
              key={lease.id}
              variant="outlined"
              sx={{ borderRadius: 2, p: { xs: 2, sm: 3 } }}
            >
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-start' } }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                      <Typography variant="h6" component="h2" fontWeight={600}>
                        {formatAddress(lease) || t('portalMyLease.leaseLabel')}
                      </Typography>
                      {isCurrentLease(lease) ? (
                        <Chip
                          size="small"
                          color="success"
                          label={t('portalMyLease.currentLease')}
                        />
                      ) : (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={t('portalMyLease.upcomingLease')}
                        />
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {t('portalMyLease.leaseDatesLabel', { start: startFmt, end: endFmt })}
                    </Typography>
                    {typeof lease.rent_amount === 'number' && (
                      <Typography variant="body2" color="text.secondary">
                        {t('portalMyLease.rentAmountLabel', { amount: lease.rent_amount.toFixed(2) })}
                      </Typography>
                    )}
                  </Box>
                  {!live && (
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={() => handleOpenGive(lease)}
                      disabled={actionBusy}
                      sx={{ flexShrink: 0 }}
                    >
                      {t('portalMyLease.actions.giveNotice')}
                    </Button>
                  )}
                </Stack>

                {live && (
                  <>
                    <Divider />
                    <Alert
                      severity={noticeStatusColor(live.status) === 'success' ? 'success' : 'info'}
                      sx={{ '& .MuiAlert-message': { width: '100%' } }}
                    >
                      <Stack spacing={1}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                          <Chip
                            size="small"
                            color={noticeStatusColor(live.status)}
                            label={t(`portalMyLease.noticeStatus.${live.status}`, { defaultValue: live.status })}
                          />
                          <Typography variant="body2">
                            {t('portalMyLease.noticeGivenOn', {
                              date: formatDate(live.given_on),
                              planned: formatDate(live.planned_move_out_date),
                            })}
                          </Typography>
                        </Stack>
                        {live.counter_proposed_date && (
                          <Typography variant="body2">
                            {t('portalMyLease.counterProposed', {
                              date: formatDate(live.counter_proposed_date),
                              notes: live.counter_proposed_notes || '',
                            })}
                          </Typography>
                        )}
                        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                          {lease.my_co_sign_pending && (
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => handleCoSign(lease)}
                              disabled={actionBusy}
                            >
                              {t('portalMyLease.actions.coSign')}
                            </Button>
                          )}
                          {live.given_by_user_id === (meData?.user?.id ?? '') && (
                            <Button
                              variant="outlined"
                              size="small"
                              color="warning"
                              onClick={() => handleWithdraw(lease)}
                              disabled={actionBusy}
                            >
                              {t('portalMyLease.actions.withdraw')}
                            </Button>
                          )}
                        </Stack>
                      </Stack>
                    </Alert>
                  </>
                )}
              </Stack>
            </Paper>
          );
        })}
      </Stack>

      <GiveNoticeDialog
        open={giveOpen}
        lease={selectedLease}
        onClose={() => setGiveOpen(false)}
        baseUrl={baseUrl}
        getAccessToken={getAccessToken}
        emailHint={emailHint}
        onDone={async () => {
          setGiveOpen(false);
          showFeedback(t('portalMyLease.messages.noticeGiven'), 'success');
          await load();
        }}
        onError={(e) => {
          handleApiForbidden(e);
          showFeedback(t('portalMyLease.errors.giveFailed'), 'error');
        }}
        t={t}
      />
      <PortalFeedbackSnackbar feedback={feedback} onClose={closeFeedback} />
    </Box>
  );
};

function GiveNoticeDialog({ open, lease, onClose, baseUrl, getAccessToken, emailHint, onDone, onError, t }) {
  const [plannedMoveOutDate, setPlannedMoveOutDate] = useState('');
  const [reason, setReason] = useState('relocating');
  const [reasonNotes, setReasonNotes] = useState('');
  const [scope, setScope] = useState('all_tenants');
  const [earlyTermination, setEarlyTermination] = useState(false);
  const [forwarding, setForwarding] = useState({
    street: '',
    street2: '',
    city: '',
    state: '',
    zip: '',
    country: '',
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPlannedMoveOutDate('');
      setReason('relocating');
      setReasonNotes('');
      setScope('all_tenants');
      setEarlyTermination(false);
      setForwarding({ street: '', street2: '', city: '', state: '', zip: '', country: '' });
      setBusy(false);
    }
  }, [open]);

  const setFwd = (key) => (e) =>
    setForwarding((prev) => ({ ...prev, [key]: e.target.value }));

  const buildForwardingPayload = () => {
    const trimmed = Object.fromEntries(
      Object.entries(forwarding).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])
    );
    const anyFilled = Object.values(trimmed).some((v) => v);
    if (!anyFilled) return null;
    return {
      forwarding_street: trimmed.street || null,
      forwarding_street2: trimmed.street2 || null,
      forwarding_city: trimmed.city || null,
      forwarding_state: trimmed.state || null,
      forwarding_zip: trimmed.zip || null,
      forwarding_country: trimmed.country || null,
    };
  };

  const submit = async () => {
    if (!lease?.id) return;
    setBusy(true);
    try {
      const accessToken = await getAccessToken();
      await apiGiveNotice(baseUrl, accessToken, lease.id, {
        emailHint,
        given_on: todayIso(),
        planned_move_out_date: plannedMoveOutDate,
        reason,
        reason_notes: reasonNotes || null,
        scope,
        early_termination: earlyTermination,
        forwarding: buildForwardingPayload(),
      });
      await onDone?.();
    } catch (e) {
      onError?.(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('portalMyLease.giveDialog.title')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t('portalMyLease.giveDialog.intro')}
          </Typography>

          <TextField
            label={t('portalMyLease.giveDialog.plannedMoveOut')}
            type="date"
            value={plannedMoveOutDate}
            onChange={(e) => setPlannedMoveOutDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            required
            fullWidth
          />

          <FormControl fullWidth>
            <InputLabel id="reason-label">{t('portalMyLease.giveDialog.reason')}</InputLabel>
            <Select
              labelId="reason-label"
              label={t('portalMyLease.giveDialog.reason')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              {NOTICE_REASONS.map((r) => (
                <MenuItem key={r} value={r}>
                  {t(`portalMyLease.reasons.${r}`, { defaultValue: r })}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label={t('portalMyLease.giveDialog.reasonNotes')}
            value={reasonNotes}
            onChange={(e) => setReasonNotes(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />

          <FormControl>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              {t('portalMyLease.giveDialog.scope')}
            </Typography>
            <RadioGroup value={scope} onChange={(e) => setScope(e.target.value)}>
              <FormControlLabel
                value="all_tenants"
                control={<Radio />}
                label={t('portalMyLease.giveDialog.scopeAllTenants')}
              />
              <FormControlLabel
                value="self_only"
                control={<Radio />}
                label={t('portalMyLease.giveDialog.scopeSelfOnly')}
              />
            </RadioGroup>
          </FormControl>

          <FormControlLabel
            sx={{ ml: 0, alignItems: 'flex-start', '& .MuiFormControlLabel-label': { pt: '9px' } }}
            control={
              <Checkbox
                checked={earlyTermination}
                onChange={(e) => setEarlyTermination(e.target.checked)}
              />
            }
            label={t('portalMyLease.giveDialog.earlyTermination')}
          />

          <Divider />

          <Box>
            <Typography variant="subtitle2">
              {t('portalMyLease.giveDialog.forwardingHeading')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('portalMyLease.giveDialog.forwardingHelp')}
            </Typography>
          </Box>

          <TextField
            label={t('portalMyLease.giveDialog.forwardingStreet')}
            value={forwarding.street}
            onChange={setFwd('street')}
            fullWidth
          />
          <TextField
            label={t('portalMyLease.giveDialog.forwardingStreet2')}
            value={forwarding.street2}
            onChange={setFwd('street2')}
            fullWidth
          />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label={t('portalMyLease.giveDialog.forwardingCity')}
                value={forwarding.city}
                onChange={setFwd('city')}
                fullWidth
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                label={t('portalMyLease.giveDialog.forwardingState')}
                value={forwarding.state}
                onChange={setFwd('state')}
                fullWidth
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                label={t('portalMyLease.giveDialog.forwardingZip')}
                value={forwarding.zip}
                onChange={setFwd('zip')}
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label={t('portalMyLease.giveDialog.forwardingCountry')}
                value={forwarding.country}
                onChange={setFwd('country')}
                fullWidth
              />
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('portalMyLease.actions.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={busy || !plannedMoveOutDate}
        >
          {busy ? t('portalMyLease.actions.saving') : t('portalMyLease.actions.submitNotice')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default PortalMyLease;
