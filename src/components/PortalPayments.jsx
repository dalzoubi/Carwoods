import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { useLocation, useNavigate } from 'react-router-dom';
import { usePortalAuth } from '../PortalAuthContext';
import { hasLandlordAccess } from '../domain/roleUtils.js';
import { isGuestRole, normalizeRole, resolveRole, emailFromAccount } from '../portalUtils';
import { isPortalApiReachable } from '../featureFlags';
import { allowsPayments, landlordTierLimits } from '../portalTierUtils';
import { withDarkPath } from '../routePaths';
import { fetchLandlordLeases, fetchLandlordProperties } from '../lib/portalApiClient';
import { usePortalPayments } from './portalPayments/usePortalPayments';
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

/** Mirrors API CK_lease_payment_entries_payment_type */
const PAYMENT_TYPES = [
  'RENT',
  'SECURITY_DEPOSIT',
  'LATE_FEE',
  'PET_FEE',
  'PARKING',
  'UTILITY',
  'APPLICATION_FEE',
  'ADMIN_FEE',
  'NSF_FEE',
  'MAINTENANCE',
  'OTHER',
];

const leaseDropdownCollator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

/** Lease API may return a calendar date string or ISO datetime — keep labels date-only (no time). */
function coerceToYmd(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const prefix = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (prefix) return prefix[1];
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function formatLeaseDateLabel(value) {
  const ymd = coerceToYmd(value);
  if (!ymd) return '—';
  return formatDate(ymd);
}

function propertyAddressOneLine(property) {
  if (!property) return '';
  const name = String(property.name ?? '').trim();
  const street = String(property.street ?? '').trim();
  const city = String(property.city ?? '').trim();
  const state = String(property.state ?? '').trim();
  const zip = String(property.zip ?? '').trim();
  const addr = [street, city && state ? `${city}, ${state}` : city || state, zip]
    .filter(Boolean)
    .join(' ');
  if (name && addr) return `${name} — ${addr}`;
  return name || addr;
}

/** @param {{ start_date?: string, end_date?: string|null, month_to_month?: boolean } | null} lease */
function paymentsLeaseDateRangeOnly(lease) {
  const start = lease?.start_date;
  const end = lease?.end_date;
  const m2m = Boolean(lease?.month_to_month);
  if (!start) return '';
  const s = formatLeaseDateLabel(start);
  if (m2m && !end) return `${s} – …`;
  if (end) return `${s} – ${formatLeaseDateLabel(end)}`;
  return s;
}

/** tenant_names from API; tolerate driver/casing variants. */
function tenantNamesFromLease(lease) {
  if (!lease || typeof lease !== 'object') return '';
  const raw =
    lease.tenant_names ??
    lease.Tenant_Names ??
    lease.tenantNames ??
    lease.TenantNames;
  return String(raw ?? '').trim();
}

/**
 * Second dropdown: tenant display names (from API) plus lease dates.
 * @param {{ tenant_names?: string|null, start_date?: string, end_date?: string|null, month_to_month?: boolean, id?: string }} lease
 */
function paymentsTenantLeaseDropdownLabel(lease, t) {
  const names = tenantNamesFromLease(lease);
  const range = paymentsLeaseDateRangeOnly(lease);
  const namePart = names || t('portalPayments.labels.noTenantsOnLease');
  const parts = [namePart];
  if (range) parts.push(range);
  return parts.join(' · ');
}

function formatCurrency(value, currency = 'USD') {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { style: 'currency', currency });
}

function formatPeriod(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(isoDate + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
}

const PortalPayments = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
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
  const showLocked = isManagement && !allowsPayments(landlordTierLimits(meData));

  const { feedback, showFeedback, closeFeedback } = usePortalFeedback();

  // Landlord: property + lease selectors
  const [properties, setProperties] = useState([]);
  const [leaseRows, setLeaseRows] = useState([]);
  const [leasesStatus, setLeasesStatus] = useState('idle');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedLeaseId, setSelectedLeaseId] = useState('');

  const propertiesById = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);

  const propertyOptions = useMemo(() => {
    const ids = [...new Set(leaseRows.map((l) => l.property_id).filter(Boolean))];
    const opts = ids.map((id) => ({
      id,
      label: propertyAddressOneLine(propertiesById.get(id)) || String(id),
    }));
    opts.sort((a, b) => leaseDropdownCollator.compare(a.label, b.label));
    return opts;
  }, [leaseRows, propertiesById]);

  const leasesForProperty = useMemo(() => {
    if (!selectedPropertyId) return [];
    const rows = leaseRows.filter((l) => l.property_id == selectedPropertyId);
    const decorated = rows.map((lease) => ({
      lease,
      label: paymentsTenantLeaseDropdownLabel(lease, t),
    }));
    decorated.sort((a, b) => leaseDropdownCollator.compare(a.label, b.label));
    return decorated.map((d) => d.lease);
  }, [leaseRows, selectedPropertyId, t]);

  const handlePropertyChange = useCallback((e) => {
    const pid = e.target.value;
    setSelectedPropertyId(pid);
    const next = leaseRows.filter((l) => l.property_id == pid);
    if (next.length === 1) setSelectedLeaseId(next[0].id);
    else setSelectedLeaseId('');
  }, [leaseRows]);

  useEffect(() => {
    if (!selectedLeaseId || !selectedPropertyId) return;
    const ok = leasesForProperty.some((l) => l.id == selectedLeaseId);
    if (!ok) setSelectedLeaseId('');
  }, [leasesForProperty, selectedLeaseId, selectedPropertyId]);

  useEffect(() => {
    if (!isManagement || !isPortalApiReachable(baseUrl) || !isAuthenticated || isGuest || meStatus !== 'ok') return;
    let cancelled = false;
    (async () => {
      setLeasesStatus('loading');
      try {
        const token = await getAccessToken();
        const emailHint = emailFromAccount(account);
        const [leasesPayload, propsPayload] = await Promise.all([
          fetchLandlordLeases(baseUrl, token, { emailHint }),
          fetchLandlordProperties(baseUrl, token, { emailHint }),
        ]);
        if (cancelled) return;
        const rows = Array.isArray(leasesPayload?.leases) ? leasesPayload.leases : [];
        const propRows = Array.isArray(propsPayload?.properties) ? propsPayload.properties : [];
        setLeaseRows(rows);
        setProperties(propRows);
        setLeasesStatus('ok');

        const propIds = new Set(rows.map((l) => l.property_id).filter(Boolean));
        let nextPid = '';
        let nextLid = '';
        if (propIds.size === 1 && rows.length === 1) {
          nextPid = rows[0].property_id;
          nextLid = rows[0].id;
        } else if (propIds.size === 1 && rows.length > 1) {
          nextPid = [...propIds][0];
          nextLid = '';
        }
        setSelectedPropertyId(nextPid);
        setSelectedLeaseId(nextLid);
      } catch (err) {
        if (cancelled) return;
        handleApiForbidden(err);
        setLeasesStatus('error');
        setLeaseRows([]);
        setProperties([]);
        setSelectedPropertyId('');
        setSelectedLeaseId('');
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
  } = usePortalPayments({
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
          ? t('portalPayments.feedback.updated')
          : t('portalPayments.feedback.saved')
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
          <title>{t('portalPayments.title')}</title>
          <meta name="description" content={t('portalPayments.metaDescription')} />
        </Helmet>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h5" component="h1" fontWeight={700}>
              {t('portalPayments.heading')}
            </Typography>
          </Box>
          <Paper variant="outlined" sx={{ borderRadius: 2 }}>
            <EmptyState
              icon={<Lock sx={{ fontSize: 56 }} />}
              title={t('portalPayments.lockedTitle')}
              description={t('portalPayments.lockedBody')}
              actionLabel={t('portalPayments.pricingLink')}
              onAction={() => navigate(withDarkPath(pathname, '/pricing'))}
            />
          </Paper>
        </Stack>
      </Box>
    );
  }

  return (
    <Box>
      <Helmet>
        <title>{t('portalPayments.title')}</title>
        <meta name="description" content={t('portalPayments.metaDescription')} />
      </Helmet>

      <Stack spacing={3}>
        <Box>
          <Typography variant="h5" component="h1" fontWeight={700}>
            {t('portalPayments.heading')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isManagement
              ? t('portalPayments.introManagement')
              : t('portalPayments.introTenant')}
          </Typography>
        </Box>

        <StatusAlertSlot
          message={!isPortalApiReachable(baseUrl) ? { severity: 'warning', text: t('portalPayments.errors.apiUnavailable') } : null}
        />
        <StatusAlertSlot
          message={entriesStatus === 'error' ? { severity: 'error', text: entriesError || t('portalPayments.errors.loadFailed') } : null}
        />

        {/* Property + lease selectors (management only) */}
        {isManagement && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} flexWrap="wrap">
            {leasesStatus === 'loading' ? (
              <CircularProgress size={20} />
            ) : leaseRows.length > 0 ? (
              <>
                <FormControl size="small" sx={{ minWidth: 260 }}>
                  <InputLabel id="portal-payments-property-label" shrink>
                    {t('portalPayments.labels.selectProperty')}
                  </InputLabel>
                  <Select
                    labelId="portal-payments-property-label"
                    id="portal-payments-property-select"
                    value={selectedPropertyId}
                    label={t('portalPayments.labels.selectProperty')}
                    onChange={handlePropertyChange}
                    displayEmpty
                    renderValue={(value) => {
                      if (value === '' || value == null) {
                        return (
                          <Typography component="span" variant="body2" color="text.secondary">
                            {t('portalPayments.labels.selectPropertyPlaceholder')}
                          </Typography>
                        );
                      }
                      const opt = propertyOptions.find((p) => p.id == value);
                      return opt?.label ?? '';
                    }}
                  >
                    <MenuItem value="" disabled>{t('portalPayments.labels.selectPropertyPlaceholder')}</MenuItem>
                    {propertyOptions.map((p) => (
                      <MenuItem key={p.id} value={p.id}>{p.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 280 }} disabled={!selectedPropertyId}>
                  <InputLabel id="portal-payments-lease-label" shrink>
                    {t('portalPayments.labels.selectLeaseForProperty')}
                  </InputLabel>
                  <Select
                    labelId="portal-payments-lease-label"
                    id="portal-payments-lease-select"
                    value={selectedLeaseId}
                    label={t('portalPayments.labels.selectLeaseForProperty')}
                    onChange={(e) => setSelectedLeaseId(e.target.value)}
                    displayEmpty
                    renderValue={(value) => {
                      if (value === '' || value == null) {
                        return (
                          <Typography component="span" variant="body2" color="text.secondary">
                            {t('portalPayments.labels.selectLeaseForPropertyPlaceholder')}
                          </Typography>
                        );
                      }
                      const lease = leasesForProperty.find((l) => l.id == value);
                      return lease ? paymentsTenantLeaseDropdownLabel(lease, t) : '';
                    }}
                  >
                    <MenuItem value="" disabled>{t('portalPayments.labels.selectLeaseForPropertyPlaceholder')}</MenuItem>
                    {leasesForProperty.map((l) => (
                      <MenuItem key={l.id} value={l.id}>
                        {paymentsTenantLeaseDropdownLabel(l, t)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </>
            ) : leasesStatus === 'ok' ? (
              <Typography variant="body2" color="text.secondary">
                {t('portalPayments.errors.noLeases')}
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
                {t('portalPayments.actions.addEntry')}
              </Button>
            )}
          </Stack>
        )}

        {/* Payments table */}
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          {entriesStatus === 'loading' && (
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ p: 3 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                {t('portalPayments.loading')}
              </Typography>
            </Stack>
          )}

          {entriesStatus !== 'loading' && entries.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 3 }}>
              {t('portalPayments.empty')}
            </Typography>
          )}

          {entries.length > 0 && (
            <TableContainer>
              <Table size="small" aria-label={t('portalPayments.tableAriaLabel')}>
                <TableHead>
                  <TableRow>
                    <TableCell scope="col">{t('portalPayments.columns.period')}</TableCell>
                    <TableCell scope="col">{t('portalPayments.columns.paymentType')}</TableCell>
                    <TableCell scope="col" align="right">{t('portalPayments.columns.amountDue')}</TableCell>
                    <TableCell scope="col" align="right">{t('portalPayments.columns.amountPaid')}</TableCell>
                    <TableCell scope="col">{t('portalPayments.columns.dueDate')}</TableCell>
                    <TableCell scope="col">{t('portalPayments.columns.paidDate')}</TableCell>
                    <TableCell scope="col">{t('portalPayments.columns.method')}</TableCell>
                    <TableCell scope="col">{t('portalPayments.columns.status')}</TableCell>
                    {isManagement && <TableCell scope="col" />}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id} hover>
                      <TableCell>{formatPeriod(entry.period_start)}</TableCell>
                      <TableCell>
                        {t(`portalPayments.paymentTypes.${entry.payment_type ?? 'RENT'}`, {
                          defaultValue: entry.payment_type ?? 'RENT',
                        })}
                      </TableCell>
                      <TableCell align="right">{formatCurrency(entry.amount_due)}</TableCell>
                      <TableCell align="right">{formatCurrency(entry.amount_paid)}</TableCell>
                      <TableCell>{formatDate(entry.due_date)}</TableCell>
                      <TableCell>{formatDate(entry.paid_date)}</TableCell>
                      <TableCell>
                        {entry.payment_method
                          ? t(`portalPayments.paymentMethods.${entry.payment_method}`, { defaultValue: entry.payment_method })
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={t(`portalPayments.paymentStatus.${entry.payment_status}`, { defaultValue: entry.payment_status })}
                          size="small"
                          color={PAYMENT_STATUS_COLOR[entry.payment_status] ?? 'default'}
                          variant={entry.payment_status === 'PAID' ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      {isManagement && (
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            aria-label={t('portalPayments.actions.editEntry')}
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
              {editingEntryId ? t('portalPayments.dialog.editTitle') : t('portalPayments.dialog.createTitle')}
            </Typography>
            <IconButton size="small" onClick={closeForm} disabled={saveStatus === 'saving'} aria-label={t('portalDialogs.closeForm')}>
              <Close fontSize="small" />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              {saveStatus === 'error' && (
                <Alert severity="error">{saveError || t('portalPayments.errors.saveFailed')}</Alert>
              )}
              <TextField
                label={t('portalPayments.fields.periodStart')}
                type="date"
                value={form.period_start}
                onChange={onFormField('period_start')}
                disabled={saveStatus === 'saving' || !!editingEntryId}
                required={!editingEntryId}
                fullWidth
                InputLabelProps={{ shrink: true }}
                helperText={editingEntryId ? t('portalPayments.fields.periodStartLocked') : t('portalPayments.fields.periodStartHelper')}
              />
              <FormControl
                fullWidth
                disabled={saveStatus === 'saving' || !!editingEntryId}
                required={!editingEntryId}
              >
                <InputLabel id="portal-payments-payment-type-label" shrink>
                  {t('portalPayments.fields.paymentType')}
                </InputLabel>
                <Select
                  labelId="portal-payments-payment-type-label"
                  id="portal-payments-payment-type-select"
                  value={form.payment_type || 'RENT'}
                  label={t('portalPayments.fields.paymentType')}
                  onChange={onFormField('payment_type')}
                >
                  {PAYMENT_TYPES.map((pt) => (
                    <MenuItem key={pt} value={pt}>
                      {t(`portalPayments.paymentTypes.${pt}`, { defaultValue: pt })}
                    </MenuItem>
                  ))}
                </Select>
                {editingEntryId ? (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {t('portalPayments.fields.paymentTypeLocked')}
                  </Typography>
                ) : null}
              </FormControl>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label={t('portalPayments.fields.amountDue')}
                  value={form.amount_due}
                  onChange={onFormField('amount_due')}
                  disabled={saveStatus === 'saving'}
                  required
                  fullWidth
                  inputProps={{ inputMode: 'decimal' }}
                />
                <TextField
                  label={t('portalPayments.fields.amountPaid')}
                  value={form.amount_paid}
                  onChange={onFormField('amount_paid')}
                  disabled={saveStatus === 'saving'}
                  fullWidth
                  inputProps={{ inputMode: 'decimal' }}
                />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label={t('portalPayments.fields.dueDate')}
                  type="date"
                  value={form.due_date}
                  onChange={onFormField('due_date')}
                  disabled={saveStatus === 'saving'}
                  required
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label={t('portalPayments.fields.paidDate')}
                  type="date"
                  value={form.paid_date}
                  onChange={onFormField('paid_date')}
                  disabled={saveStatus === 'saving'}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Stack>
              <FormControl fullWidth disabled={saveStatus === 'saving'}>
                <InputLabel>{t('portalPayments.fields.paymentMethod')}</InputLabel>
                <Select
                  value={form.payment_method}
                  label={t('portalPayments.fields.paymentMethod')}
                  onChange={onFormField('payment_method')}
                >
                  <MenuItem value="">{t('portalPayments.fields.paymentMethodNone')}</MenuItem>
                  {PAYMENT_METHODS.map((m) => (
                    <MenuItem key={m} value={m}>
                      {t(`portalPayments.paymentMethods.${m}`, { defaultValue: m })}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label={t('portalPayments.fields.notes')}
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
              {t('portalPayments.actions.cancel')}
            </Button>
            <Button
              type="button"
              variant="contained"
              onClick={onSaveEntry}
              disabled={
                saveStatus === 'saving'
                || !form.period_start
                || !form.amount_due
                || !form.due_date
                || (!editingEntryId && !form.payment_type)
              }
              startIcon={saveStatus === 'saving' ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {saveStatus === 'saving' ? t('portalPayments.actions.saving') : t('portalPayments.actions.save')}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      <PortalFeedbackSnackbar feedback={feedback} onClose={closeFeedback} />
    </Box>
  );
};

export default PortalPayments;
