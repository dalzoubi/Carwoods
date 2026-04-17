import React, { useState, useEffect } from 'react';
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
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import Close from '@mui/icons-material/Close';
import Lock from '@mui/icons-material/Lock';
import { useLocation } from 'react-router-dom';
import { usePortalAuth } from '../PortalAuthContext';
import { hasLandlordAccess } from '../domain/roleUtils.js';
import { isGuestRole, normalizeRole, resolveRole, emailFromAccount } from '../portalUtils';
import { allowsRentLedger, landlordTierLimits } from '../portalTierUtils';
import { withDarkPath } from '../routePaths';
import { fetchLandlordProperties, fetchRequests } from '../lib/portalApiClient';
import { usePortalRentLedger } from './portalRentLedger/usePortalRentLedger';
import PortalFeedbackSnackbar from './PortalFeedbackSnackbar';
import { usePortalFeedback } from '../hooks/usePortalFeedback';
import StatusAlertSlot from './StatusAlertSlot';
import EmptyState from './EmptyState';

const PAYMENT_STATUS_COLOR = {
  PAID: 'success',
  PARTIAL: 'warning',
  OVERDUE: 'error',
  PENDING: 'default',
};

const PAYMENT_METHODS = ['CHECK', 'CASH', 'BANK_TRANSFER', 'ZELLE', 'VENMO', 'OTHER'];

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

function formatCurrency(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function formatPeriod(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(isoDate + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
}

const PortalRentLedger = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
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
  const isGuest = isGuestRole(role);
  const isManagement = hasLandlordAccess(role);
  const showLocked = isManagement && !allowsRentLedger(landlordTierLimits(meData));

  const { feedback, showFeedback, closeFeedback } = usePortalFeedback();

  // Landlord: lease selector
  const [leases, setLeases] = useState([]);
  const [leasesStatus, setLeasesStatus] = useState('idle');
  const [selectedLeaseId, setSelectedLeaseId] = useState('');

  useEffect(() => {
    if (!isManagement || !baseUrl || !isAuthenticated || isGuest || meStatus !== 'ok') return;
    let cancelled = false;
    (async () => {
      setLeasesStatus('loading');
      try {
        const token = await getAccessToken();
        const emailHint = emailFromAccount(account);
        // Re-use the requests lookups to get leases — or fetch from landlord/leases
        const path = '/api/landlord/requests';
        const data = await fetchRequests(baseUrl, token, { path, emailHint });
        if (cancelled) return;
        // Extract unique leases from requests as a quick proxy; real apps would use /api/landlord/leases
        const seen = new Map();
        const rows = Array.isArray(data?.requests) ? data.requests : [];
        for (const r of rows) {
          if (r.lease_id && !seen.has(r.lease_id)) {
            seen.set(r.lease_id, {
              id: r.lease_id,
              label: [r.tenant_name, r.property_address].filter(Boolean).join(' — ') || r.lease_id,
            });
          }
        }
        const leaseList = Array.from(seen.values());
        setLeases(leaseList);
        setLeasesStatus('ok');
        if (leaseList.length > 0) setSelectedLeaseId(leaseList[0].id);
      } catch (err) {
        if (cancelled) return;
        handleApiForbidden(err);
        setLeasesStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [isManagement, baseUrl, isAuthenticated, isGuest, meStatus, getAccessToken, account, handleApiForbidden]);

  const {
    entries,
    entriesStatus,
    entriesError,
    form,
    editingEntryId,
    saveStatus,
    saveError,
    loadEntries,
    onFormField,
    openCreateForm,
    openEditForm,
    closeForm,
    onSaveEntry,
  } = usePortalRentLedger({
    baseUrl,
    isAuthenticated,
    isGuest,
    isManagement,
    meStatus,
    account,
    getAccessToken,
    handleApiForbidden,
    t,
  });

  // Load when selected lease changes (management)
  useEffect(() => {
    if (isManagement && selectedLeaseId) {
      loadEntries({ leaseId: selectedLeaseId });
    }
  }, [isManagement, selectedLeaseId, loadEntries]);

  // Show success feedback
  useEffect(() => {
    if (saveStatus === 'success') {
      showFeedback(
        editingEntryId
          ? t('portalRentLedger.feedback.updated')
          : t('portalRentLedger.feedback.saved')
      );
      closeForm();
    }
  }, [saveStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const dialogOpen = saveStatus === 'idle' || saveStatus === 'saving' || saveStatus === 'error'
    ? (form.lease_id !== '' || editingEntryId !== null)
    : false;

  const handleOpenCreate = () => openCreateForm(selectedLeaseId);

  if (showLocked) {
    return (
      <Box>
        <Helmet>
          <title>{t('portalRentLedger.title')}</title>
          <meta name="description" content={t('portalRentLedger.metaDescription')} />
        </Helmet>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h5" component="h1" fontWeight={700}>
              {t('portalRentLedger.heading')}
            </Typography>
          </Box>
          <Paper variant="outlined" sx={{ borderRadius: 2 }}>
            <EmptyState
              icon={<Lock sx={{ fontSize: 56 }} />}
              title={t('portalRentLedger.lockedTitle')}
              description={t('portalRentLedger.lockedBody')}
              actionLabel={t('portalRentLedger.pricingLink')}
              actionHref={withDarkPath(pathname, '/pricing')}
            />
          </Paper>
        </Stack>
      </Box>
    );
  }

  return (
    <Box>
      <Helmet>
        <title>{t('portalRentLedger.title')}</title>
        <meta name="description" content={t('portalRentLedger.metaDescription')} />
      </Helmet>

      <Stack spacing={3}>
        <Box>
          <Typography variant="h5" component="h1" fontWeight={700}>
            {t('portalRentLedger.heading')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isManagement
              ? t('portalRentLedger.introManagement')
              : t('portalRentLedger.introTenant')}
          </Typography>
        </Box>

        <StatusAlertSlot
          message={!baseUrl ? { severity: 'warning', text: t('portalRentLedger.errors.apiUnavailable') } : null}
        />
        <StatusAlertSlot
          message={entriesStatus === 'error' ? { severity: 'error', text: entriesError || t('portalRentLedger.errors.loadFailed') } : null}
        />

        {/* Lease selector (management only) */}
        {isManagement && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            {leasesStatus === 'loading' ? (
              <CircularProgress size={20} />
            ) : leases.length > 0 ? (
              <FormControl size="small" sx={{ minWidth: 300 }}>
                <InputLabel>{t('portalRentLedger.labels.selectLease')}</InputLabel>
                <Select
                  value={selectedLeaseId}
                  label={t('portalRentLedger.labels.selectLease')}
                  onChange={(e) => setSelectedLeaseId(e.target.value)}
                >
                  {leases.map((l) => (
                    <MenuItem key={l.id} value={l.id}>{l.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : leasesStatus === 'ok' ? (
              <Typography variant="body2" color="text.secondary">
                {t('portalRentLedger.errors.noLeases')}
              </Typography>
            ) : null}

            {isManagement && selectedLeaseId && (
              <Button
                type="button"
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenCreate}
                sx={{ textTransform: 'none' }}
              >
                {t('portalRentLedger.actions.addEntry')}
              </Button>
            )}
          </Stack>
        )}

        {/* Ledger table */}
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          {entriesStatus === 'loading' && (
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ p: 3 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                {t('portalRentLedger.loading')}
              </Typography>
            </Stack>
          )}

          {entriesStatus !== 'loading' && entries.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 3 }}>
              {t('portalRentLedger.empty')}
            </Typography>
          )}

          {entries.length > 0 && (
            <TableContainer>
              <Table size="small" aria-label={t('portalRentLedger.tableAriaLabel')}>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('portalRentLedger.columns.period')}</TableCell>
                    <TableCell align="right">{t('portalRentLedger.columns.amountDue')}</TableCell>
                    <TableCell align="right">{t('portalRentLedger.columns.amountPaid')}</TableCell>
                    <TableCell>{t('portalRentLedger.columns.dueDate')}</TableCell>
                    <TableCell>{t('portalRentLedger.columns.paidDate')}</TableCell>
                    <TableCell>{t('portalRentLedger.columns.method')}</TableCell>
                    <TableCell>{t('portalRentLedger.columns.status')}</TableCell>
                    {isManagement && <TableCell />}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id} hover>
                      <TableCell>{formatPeriod(entry.period_start)}</TableCell>
                      <TableCell align="right">{formatCurrency(entry.amount_due)}</TableCell>
                      <TableCell align="right">{formatCurrency(entry.amount_paid)}</TableCell>
                      <TableCell>{formatDate(entry.due_date)}</TableCell>
                      <TableCell>{formatDate(entry.paid_date)}</TableCell>
                      <TableCell>
                        {entry.payment_method
                          ? t(`portalRentLedger.paymentMethods.${entry.payment_method}`, { defaultValue: entry.payment_method })
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={t(`portalRentLedger.paymentStatus.${entry.payment_status}`, { defaultValue: entry.payment_status })}
                          size="small"
                          color={PAYMENT_STATUS_COLOR[entry.payment_status] ?? 'default'}
                          variant={entry.payment_status === 'PAID' ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      {isManagement && (
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            aria-label={t('portalRentLedger.actions.editEntry')}
                            onClick={() => openEditForm(entry)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Stack>

      {/* Record / Edit payment dialog (management only) */}
      {isManagement && (
        <Dialog open={dialogOpen} onClose={closeForm} fullWidth maxWidth="sm">
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography component="span">
              {editingEntryId ? t('portalRentLedger.dialog.editTitle') : t('portalRentLedger.dialog.createTitle')}
            </Typography>
            <IconButton size="small" onClick={closeForm} disabled={saveStatus === 'saving'} aria-label={t('portalDialogs.closeForm')}>
              <Close fontSize="small" />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              {saveStatus === 'error' && (
                <Alert severity="error">{saveError || t('portalRentLedger.errors.saveFailed')}</Alert>
              )}
              <TextField
                label={t('portalRentLedger.fields.periodStart')}
                type="date"
                value={form.period_start}
                onChange={onFormField('period_start')}
                disabled={saveStatus === 'saving' || !!editingEntryId}
                fullWidth
                InputLabelProps={{ shrink: true }}
                helperText={t('portalRentLedger.fields.periodStartHelper')}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label={t('portalRentLedger.fields.amountDue')}
                  type="number"
                  inputProps={{ min: 0, step: '0.01' }}
                  value={form.amount_due}
                  onChange={onFormField('amount_due')}
                  disabled={saveStatus === 'saving'}
                  fullWidth
                />
                <TextField
                  label={t('portalRentLedger.fields.amountPaid')}
                  type="number"
                  inputProps={{ min: 0, step: '0.01' }}
                  value={form.amount_paid}
                  onChange={onFormField('amount_paid')}
                  disabled={saveStatus === 'saving'}
                  fullWidth
                />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label={t('portalRentLedger.fields.dueDate')}
                  type="date"
                  value={form.due_date}
                  onChange={onFormField('due_date')}
                  disabled={saveStatus === 'saving'}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label={t('portalRentLedger.fields.paidDate')}
                  type="date"
                  value={form.paid_date}
                  onChange={onFormField('paid_date')}
                  disabled={saveStatus === 'saving'}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Stack>
              <FormControl fullWidth disabled={saveStatus === 'saving'}>
                <InputLabel>{t('portalRentLedger.fields.paymentMethod')}</InputLabel>
                <Select
                  value={form.payment_method}
                  label={t('portalRentLedger.fields.paymentMethod')}
                  onChange={onFormField('payment_method')}
                >
                  <MenuItem value="">{t('portalRentLedger.fields.paymentMethodNone')}</MenuItem>
                  {PAYMENT_METHODS.map((m) => (
                    <MenuItem key={m} value={m}>
                      {t(`portalRentLedger.paymentMethods.${m}`, { defaultValue: m })}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label={t('portalRentLedger.fields.notes')}
                value={form.notes}
                onChange={onFormField('notes')}
                disabled={saveStatus === 'saving'}
                fullWidth
                multiline
                minRows={2}
                inputProps={{ maxLength: 500 }}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={closeForm} disabled={saveStatus === 'saving'}>
              {t('portalRentLedger.actions.cancel')}
            </Button>
            <Button
              type="button"
              variant="contained"
              onClick={onSaveEntry}
              disabled={saveStatus === 'saving' || !form.period_start || !form.amount_due || !form.due_date}
              startIcon={saveStatus === 'saving' ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {saveStatus === 'saving' ? t('portalRentLedger.actions.saving') : t('portalRentLedger.actions.save')}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      <PortalFeedbackSnackbar feedback={feedback} onClose={closeFeedback} />
    </Box>
  );
};

export default PortalRentLedger;
