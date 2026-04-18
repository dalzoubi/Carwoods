import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { usePortalAuth } from '../PortalAuthContext';
import { Role } from '../domain/constants.js';
import { resolveRole, normalizeRole } from '../portalUtils';
import {
  fetchLandlordNotices,
  respondToNotice as apiRespondToNotice,
} from '../lib/portalApiClient';
import PortalFeedbackSnackbar from './PortalFeedbackSnackbar';
import { usePortalFeedback } from '../hooks/usePortalFeedback';
import StatusAlertSlot from './StatusAlertSlot';
import EmptyState from './EmptyState';

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

function formatAddress(notice) {
  const parts = [notice?.property_street, notice?.property_city, notice?.property_state, notice?.property_zip]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean);
  return parts.join(', ');
}

function statusColor(status) {
  switch (status) {
    case 'pending_landlord':
      return 'warning';
    case 'pending_tenant':
      return 'info';
    case 'pending_co_signers':
      return 'default';
    default:
      return 'default';
  }
}

const PortalLandlordNotices = () => {
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
  const canUseModule = isAuthenticated && (role === Role.LANDLORD || role === Role.ADMIN) && Boolean(baseUrl);
  const emailHint = meData?.user?.email ?? account?.username ?? '';

  const [state, setState] = useState({ status: 'idle', notices: [] });
  const [respondOpen, setRespondOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const { feedback, showFeedback, closeFeedback } = usePortalFeedback();

  const load = useCallback(async () => {
    if (!canUseModule) {
      setState({ status: 'idle', notices: [] });
      return;
    }
    setState((prev) => ({ ...prev, status: 'loading' }));
    try {
      const accessToken = await getAccessToken();
      const payload = await fetchLandlordNotices(baseUrl, accessToken, { emailHint });
      setState({ status: 'ok', notices: Array.isArray(payload?.notices) ? payload.notices : [] });
    } catch (e) {
      handleApiForbidden(e);
      setState({ status: 'error', notices: [], detail: t('portalLandlordNotices.errors.loadFailed') });
    }
  }, [canUseModule, baseUrl, emailHint, getAccessToken, handleApiForbidden, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleOpenRespond = (notice) => {
    setSelected(notice);
    setRespondOpen(true);
  };

  const accessDenied = isAuthenticated && meStatus !== 'loading' && !canUseModule;
  const actionable = useMemo(
    () => (state.notices || []).filter((n) => n.status === 'pending_landlord'),
    [state.notices]
  );
  const waitingOnOthers = useMemo(
    () => (state.notices || []).filter((n) => n.status !== 'pending_landlord'),
    [state.notices]
  );

  return (
    <Box sx={{ py: 4 }}>
      <Helmet>
        <title>{t('portalLandlordNotices.title')}</title>
        <meta name="description" content={t('portalLandlordNotices.metaDescription')} />
      </Helmet>

      <Stack spacing={3}>
        <Box>
          <Typography variant="h5" component="h1" fontWeight={700}>
            {t('portalLandlordNotices.heading')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('portalLandlordNotices.intro')}
          </Typography>
        </Box>

        {!baseUrl && (
          <StatusAlertSlot
            message={{ severity: 'warning', text: t('portalLandlordNotices.errors.apiUnavailable') }}
          />
        )}
        {accessDenied && (
          <StatusAlertSlot
            message={{ severity: 'error', text: t('portalLandlordNotices.errors.accessDenied') }}
          />
        )}
        {state.status === 'error' && (
          <StatusAlertSlot
            message={{ severity: 'error', text: state.detail ?? t('portalLandlordNotices.errors.loadFailed') }}
          />
        )}

        {state.status === 'loading' && state.notices.length === 0 && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', py: 2 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              {t('portalLandlordNotices.loading')}
            </Typography>
          </Stack>
        )}

        {state.status === 'ok' && state.notices.length === 0 && (
          <Paper variant="outlined" sx={{ borderRadius: 2 }}>
            <EmptyState
              title={t('portalLandlordNotices.empty.title')}
              description={t('portalLandlordNotices.empty.description')}
            />
          </Paper>
        )}

        {actionable.length > 0 && (
          <Box>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
              {t('portalLandlordNotices.sections.actionable')}
            </Typography>
            <Stack spacing={2}>
              {actionable.map((n) => (
                <NoticeCard
                  key={n.id}
                  notice={n}
                  onRespond={() => handleOpenRespond(n)}
                  t={t}
                />
              ))}
            </Stack>
          </Box>
        )}

        {waitingOnOthers.length > 0 && (
          <Box>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
              {t('portalLandlordNotices.sections.waiting')}
            </Typography>
            <Stack spacing={2}>
              {waitingOnOthers.map((n) => (
                <NoticeCard key={n.id} notice={n} t={t} />
              ))}
            </Stack>
          </Box>
        )}
      </Stack>

      <RespondDialog
        open={respondOpen}
        notice={selected}
        onClose={() => setRespondOpen(false)}
        baseUrl={baseUrl}
        getAccessToken={getAccessToken}
        emailHint={emailHint}
        onDone={async (decision) => {
          setRespondOpen(false);
          showFeedback(
            t(`portalLandlordNotices.messages.${decision}`, {
              defaultValue: t('portalLandlordNotices.messages.responded'),
            }),
            'success'
          );
          await load();
        }}
        onError={(e) => {
          handleApiForbidden(e);
          showFeedback(t('portalLandlordNotices.errors.respondFailed'), 'error');
        }}
        t={t}
      />
      <PortalFeedbackSnackbar feedback={feedback} onClose={closeFeedback} />
    </Box>
  );
};

function NoticeCard({ notice, onRespond, t }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, p: { xs: 2, sm: 3 } }}>
      <Stack spacing={1.5}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-start' } }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="h6" component="h2" fontWeight={600}>
                {formatAddress(notice) || t('portalLandlordNotices.noticeLabel')}
              </Typography>
              <Chip
                size="small"
                color={statusColor(notice.status)}
                label={t(`portalLandlordNotices.status.${notice.status}`, { defaultValue: notice.status })}
              />
              {notice.early_termination ? (
                <Chip size="small" color="error" variant="outlined" label={t('portalLandlordNotices.earlyTermination')} />
              ) : null}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('portalLandlordNotices.givenOn', {
                date: formatDate(notice.given_on),
                planned: formatDate(notice.planned_move_out_date),
              })}
            </Typography>
            {notice.reason && (
              <Typography variant="body2" color="text.secondary">
                {t('portalLandlordNotices.reasonLabel')}:{' '}
                {t(`portalLandlordNotices.reasons.${notice.reason}`, { defaultValue: notice.reason })}
                {notice.reason_notes ? ` — ${notice.reason_notes}` : ''}
              </Typography>
            )}
            {notice.counter_proposed_date && (
              <Typography variant="body2" color="text.secondary">
                {t('portalLandlordNotices.counterSent', {
                  date: formatDate(notice.counter_proposed_date),
                  notes: notice.counter_proposed_notes || '',
                })}
              </Typography>
            )}
          </Box>
          {onRespond && (
            <Button variant="contained" color="primary" onClick={onRespond} sx={{ flexShrink: 0 }}>
              {t('portalLandlordNotices.actions.respond')}
            </Button>
          )}
        </Stack>

        {(notice.forwarding_street || notice.forwarding_city) && (
          <>
            <Divider />
            <Box>
              <Typography variant="subtitle2">{t('portalLandlordNotices.forwardingHeading')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {[
                  notice.forwarding_street,
                  notice.forwarding_street2,
                  notice.forwarding_city,
                  notice.forwarding_state,
                  notice.forwarding_zip,
                  notice.forwarding_country,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </Typography>
            </Box>
          </>
        )}
      </Stack>
    </Paper>
  );
}

function RespondDialog({ open, notice, onClose, baseUrl, getAccessToken, emailHint, onDone, onError, t }) {
  const [decision, setDecision] = useState('accept');
  const [counterDate, setCounterDate] = useState('');
  const [counterNotes, setCounterNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setDecision('accept');
      setCounterDate('');
      setCounterNotes('');
      setBusy(false);
    }
  }, [open]);

  const submit = async () => {
    if (!notice?.id) return;
    setBusy(true);
    try {
      const accessToken = await getAccessToken();
      const payload = { emailHint, decision };
      if (decision === 'counter') {
        payload.counter_date = counterDate;
        payload.counter_notes = counterNotes || null;
      }
      await apiRespondToNotice(baseUrl, accessToken, notice.id, payload);
      await onDone?.(decision);
    } catch (e) {
      onError?.(e);
    } finally {
      setBusy(false);
    }
  };

  const valid = decision !== 'counter' || Boolean(counterDate);

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('portalLandlordNotices.respondDialog.title')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {notice && (
            <Alert severity="info">
              {t('portalLandlordNotices.respondDialog.summary', {
                address: formatAddress(notice),
                planned: formatDate(notice.planned_move_out_date),
              })}
            </Alert>
          )}
          <FormControl>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              {t('portalLandlordNotices.respondDialog.decision')}
            </Typography>
            <RadioGroup value={decision} onChange={(e) => setDecision(e.target.value)}>
              <FormControlLabel
                value="accept"
                control={<Radio />}
                label={t('portalLandlordNotices.respondDialog.accept')}
              />
              <FormControlLabel
                value="counter"
                control={<Radio />}
                label={t('portalLandlordNotices.respondDialog.counter')}
              />
              <FormControlLabel
                value="reject"
                control={<Radio />}
                label={t('portalLandlordNotices.respondDialog.reject')}
              />
            </RadioGroup>
          </FormControl>

          {decision === 'counter' && (
            <>
              <TextField
                label={t('portalLandlordNotices.respondDialog.counterDate')}
                type="date"
                value={counterDate}
                onChange={(e) => setCounterDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                required
                fullWidth
              />
              <TextField
                label={t('portalLandlordNotices.respondDialog.counterNotes')}
                value={counterNotes}
                onChange={(e) => setCounterNotes(e.target.value)}
                multiline
                minRows={2}
                fullWidth
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('portalLandlordNotices.actions.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={busy || !valid}
        >
          {busy
            ? t('portalLandlordNotices.actions.saving')
            : t('portalLandlordNotices.actions.submitResponse')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default PortalLandlordNotices;
