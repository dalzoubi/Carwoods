import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  FormControl,
  FormControlLabel,
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
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import Close from '@mui/icons-material/Close';
import Lock from '@mui/icons-material/Lock';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePortalAuth } from '../PortalAuthContext';
import { hasLandlordAccess } from '../domain/roleUtils.js';
import { isGuestRole, normalizeRole, resolveRole, emailFromAccount } from '../portalUtils';
import { isPortalApiReachable } from '../featureFlags';
import { allowsPayments, landlordTierLimits } from '../portalTierUtils';
import { withDarkPath } from '../routePaths';
import { getLeaseDisplayPhase } from '../lib/leaseDisplayPhase.js';
import {
  fetchLandlordLeases,
  fetchLandlordProperties,
  fetchMyLeases,
  fetchTenants,
} from '../lib/portalApiClient';
import { usePortalPayments } from './portalPayments/usePortalPayments';
import PortalFeedbackSnackbar from './PortalFeedbackSnackbar';
import { usePortalFeedback } from '../hooks/usePortalFeedback';
import StatusAlertSlot from './StatusAlertSlot';
import EmptyState from './EmptyState';
import PortalRefreshButton from './PortalRefreshButton';

const PAYMENT_STATUS_COLOR = {
  PAID: 'success',
  PARTIAL: 'warning',
  OVERDUE: 'error',
  PENDING: 'default',
};

const PAYMENT_METHODS = ['CHECK', 'CASH', 'BANK_TRANSFER', 'ZELLE', 'VENMO', 'OTHER'];

/** Mirrors API CK_payment_entries_payment_type */
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

/** Aligns property/lease id strings (API may send GUIDs with/without braces; selects use string). */
function normalizePropertyKey(id) {
  if (id == null || id === '') return '';
  return String(id).replace(/[{}]/g, '').toLowerCase();
}

function sameLeaseId(a, b) {
  if (a == null || b == null) return false;
  return normalizePropertyKey(a) === normalizePropertyKey(b);
}

/** @param {object | null | undefined} lease */
function leasePropertyIdField(lease) {
  if (!lease || typeof lease !== 'object') return '';
  const v =
    lease.property_id
    ?? lease.Property_Id
    ?? lease.propertyId
    ?? lease.PropertyId;
  return v == null ? '' : String(v);
}

function tenantPropertyIdField(t) {
  if (!t || typeof t !== 'object') return '';
  const v = t.property_id ?? t.Property_Id ?? t.propertyId ?? t.PropertyId;
  return v == null ? '' : String(v);
}

function directoryTenantLabel(t) {
  const first = String(t?.first_name ?? '').trim();
  const last = String(t?.last_name ?? '').trim();
  const name = `${first} ${last}`.trim();
  const email = String(t?.email ?? '').trim();
  return name || email || String(t?.id ?? '').trim() || '—';
}

/**
 * Merge lease-based tenant options (has lease context) with GET /landlord/tenants rows
 * for the same property so the tenant DDL is populated even if lease rows omit ids.
 * @param {{ id: string, label: string }[]} fromLeases
 * @param {object[]} directoryRowsAtProperty
 */
function mergeTenantUserOptions(fromLeases, directoryRowsAtProperty) {
  const map = new Map();
  for (const o of fromLeases) {
    const k = String(o.id).trim().toLowerCase();
    if (k) map.set(k, o);
  }
  for (const t of directoryRowsAtProperty) {
    const id = String(t.id ?? '').trim();
    if (!id) continue;
    const k = id.toLowerCase();
    if (!map.has(k)) {
      map.set(k, { id, label: directoryTenantLabel(t) });
    }
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
}

/**
 * @param {object} lease
 * @param {string} selectedTenantUserId
 * @param {{ mergedOptionCount: number, mergedOptions: { id: string }[] }} ctx
 */
function leaseMatchesSelectedTenant(lease, selectedTenantUserId, ctx) {
  if (selectedTenantUserId == null || String(selectedTenantUserId).trim() === '') return true;
  const uid = String(selectedTenantUserId).trim().toLowerCase();
  const ids = parseTenantUserIdsFromLease(lease);
  if (ids.length > 0) return ids.includes(uid);
  if (ctx.mergedOptionCount === 1) {
    return String(ctx.mergedOptions[0].id).trim().toLowerCase() === uid;
  }
  return false;
}

/** @param {object | null | undefined} lease */
function rawTenantUserIdsFromLease(lease) {
  if (!lease || typeof lease !== 'object') return '';
  const v =
    lease.tenant_user_ids
    ?? lease.Tenant_User_Ids
    ?? lease.tenantUserIds
    ?? lease.TenantUserIds;
  return v == null ? '' : String(v);
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
 * Lease dropdown: date range + calendar phase (Active / Future / Expired), same as Portal Tenants lease chips.
 * @param {(key: string) => string} t
 */
function paymentsLeaseSelectLabel(lease, t) {
  const range = paymentsLeaseDateRangeOnly(lease);
  const rangePart = range || '—';
  const phase = getLeaseDisplayPhase(lease);
  const phaseKey =
    phase === 'future'
      ? 'portalTenants.lease.future'
      : phase === 'expired'
        ? 'portalTenants.lease.expired'
        : 'portalTenants.lease.active';
  return `${rangePart} (${t(phaseKey)})`;
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

/** @param {object | null | undefined} lease */
function parseTenantUserIdsFromLease(lease) {
  const raw = rawTenantUserIdsFromLease(lease);
  return String(raw ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** @param {object[]} leases */
function tenantUserOptionsFromLeases(leases) {
  const map = new Map();
  for (const lease of leases) {
    const raw = rawTenantUserIdsFromLease(lease);
    const ids = String(raw ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const names = tenantNamesFromLease(lease);
    for (const id of ids) {
      if (!map.has(id)) {
        map.set(id, { id, label: names || id });
      }
    }
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
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
  const [selectedTenantUserId, setSelectedTenantUserId] = useState('');

  const [myLeases, setMyLeases] = useState([]);
  const [selectedPortalPropertyId, setSelectedPortalPropertyId] = useState('');

  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  /** GET /landlord/tenants — supplements tenant user ids when lease list omits `tenant_user_ids`. */
  const [allTenants, setAllTenants] = useState([]);
  /** True when optional fetchTenants failed; lease rows may still carry ids. User can dismiss the hint. */
  const [tenantsDirectorySupplementFailed, setTenantsDirectorySupplementFailed] = useState(false);

  const portalBtnSx = { textTransform: 'none' };

  const propertyOptions = useMemo(() => {
    const opts = (properties || []).map((p) => ({
      id: p.id,
      label: propertyAddressOneLine(p) || String(p.id),
    }));
    opts.sort((a, b) => leaseDropdownCollator.compare(a.label, b.label));
    return opts;
  }, [properties]);

  const leasesForProperty = useMemo(() => {
    if (!selectedPropertyId) return [];
    const pid = normalizePropertyKey(selectedPropertyId);
    const rows = leaseRows.filter((l) => normalizePropertyKey(leasePropertyIdField(l)) === pid);
    const decorated = rows.map((lease) => ({
      lease,
      label: paymentsLeaseSelectLabel(lease, t),
    }));
    decorated.sort((a, b) => leaseDropdownCollator.compare(a.label, b.label));
    return decorated.map((d) => d.lease);
  }, [leaseRows, selectedPropertyId, t]);

  const tenantUserOptionsFromLeaseData = useMemo(
    () => tenantUserOptionsFromLeases(leasesForProperty),
    [leasesForProperty]
  );

  const tenantsForPropertyFromDirectory = useMemo(() => {
    if (!selectedPropertyId) return [];
    const pid = normalizePropertyKey(selectedPropertyId);
    return (allTenants || []).filter(
      (t) => t && normalizePropertyKey(tenantPropertyIdField(t)) === pid
    );
  }, [allTenants, selectedPropertyId]);

  const mergedTenantUserOptions = useMemo(
    () => mergeTenantUserOptions(tenantUserOptionsFromLeaseData, tenantsForPropertyFromDirectory),
    [tenantUserOptionsFromLeaseData, tenantsForPropertyFromDirectory]
  );

  const leaseFilterCtx = useMemo(
    () => ({
      mergedOptionCount: mergedTenantUserOptions.length,
      mergedOptions: mergedTenantUserOptions,
    }),
    [mergedTenantUserOptions]
  );

  /** Leases available in the "Lease" dropdown: after a tenant is chosen, only leases that include that user. */
  const leasesForLeasePicker = useMemo(() => {
    if (!selectedPropertyId) return [];
    if (mergedTenantUserOptions.length > 0 && !selectedTenantUserId) return [];
    if (!selectedTenantUserId) return leasesForProperty;
    const hasAnyTenantIdsOnLeases = leasesForProperty.some(
      (l) => parseTenantUserIdsFromLease(l).length > 0
    );
    if (!hasAnyTenantIdsOnLeases) {
      return leasesForProperty;
    }
    return leasesForProperty.filter((l) => leaseMatchesSelectedTenant(l, selectedTenantUserId, leaseFilterCtx));
  }, [selectedPropertyId, mergedTenantUserOptions, selectedTenantUserId, leasesForProperty, leaseFilterCtx]);

  const leaseSelectDisabled = !selectedPropertyId
    || (mergedTenantUserOptions.length > 0 && !selectedTenantUserId);

  /** For list GET: include a lease_id when possible (legacy hosts that required it). Current API lists by property. */
  const effectiveListLeaseId = useMemo(() => {
    if (selectedLeaseId) return selectedLeaseId;
    if (mergedTenantUserOptions.length > 0 && !selectedTenantUserId) return '';
    if (selectedTenantUserId) {
      const first = leasesForLeasePicker[0];
      return first?.id != null && first.id !== '' ? String(first.id) : '';
    }
    const first = leasesForProperty[0];
    return first?.id != null && first.id !== '' ? String(first.id) : '';
  }, [selectedLeaseId, selectedTenantUserId, leasesForProperty, mergedTenantUserOptions.length, leasesForLeasePicker]);

  const handlePropertyChange = useCallback((e) => {
    const pid = e.target.value;
    setSelectedPropertyId(pid);
    setSelectedLeaseId('');
    setSelectedTenantUserId('');
  }, []);

  const portalPropertyOptions = useMemo(() => {
    const ids = [...new Set(myLeases.map((l) => l.property_id).filter(Boolean))];
    return ids.map((id) => {
      const lease = myLeases.find((l) => l.property_id === id);
      const street = lease?.property_street ? String(lease.property_street) : '';
      const city = lease?.property_city ? String(lease.property_city) : '';
      const st = lease?.property_state ? String(lease.property_state) : '';
      const zip = lease?.property_zip ? String(lease.property_zip) : '';
      const addr = [street, city && st ? `${city}, ${st}` : city || st, zip].filter(Boolean).join(' ');
      return { id, label: addr || id };
    });
  }, [myLeases]);

  useEffect(() => {
    if (!selectedLeaseId || !selectedPropertyId) return;
    const ok = leasesForLeasePicker.some((l) => sameLeaseId(l.id, selectedLeaseId));
    if (!ok) setSelectedLeaseId('');
  }, [leasesForLeasePicker, selectedLeaseId, selectedPropertyId]);

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
        let tenantRows = [];
        setTenantsDirectorySupplementFailed(false);
        try {
          const tp = await fetchTenants(baseUrl, token, { emailHint });
          tenantRows = Array.isArray(tp?.tenants) ? tp.tenants : [];
        } catch {
          setTenantsDirectorySupplementFailed(true);
        }
        if (cancelled) return;
        const rows = Array.isArray(leasesPayload?.leases) ? leasesPayload.leases : [];
        const propRows = Array.isArray(propsPayload?.properties) ? propsPayload.properties : [];
        setLeaseRows(rows);
        setProperties(propRows);
        setAllTenants(tenantRows);
        setLeasesStatus('ok');

        let nextPid = '';
        if (propRows.length === 1) {
          nextPid = propRows[0].id;
        }
        setSelectedPropertyId(nextPid);
        setSelectedLeaseId('');
        setSelectedTenantUserId('');
      } catch (err) {
        if (cancelled) return;
        handleApiForbidden(err);
        setLeasesStatus('error');
        setLeaseRows([]);
        setProperties([]);
        setAllTenants([]);
        setTenantsDirectorySupplementFailed(false);
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
    onFormCheckbox,
    openCreateForm,
    openEditForm,
    closeForm,
    onSaveEntry,
    onDeleteEntry,
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

  const canRefreshEntries =
    isPortalApiReachable(baseUrl) && isAuthenticated && !isGuest && meStatus === 'ok';
  const refreshDisabledManagement = !canRefreshEntries || !selectedPropertyId || leasesStatus === 'loading';
  const refreshDisabledTenant = !canRefreshEntries;

  const handleRefresh = useCallback(async () => {
    if (!canRefreshEntries) return;
    setRefreshing(true);
    try {
      if (isManagement) {
        if (!selectedPropertyId) return;
        await loadEntries({
          propertyId: selectedPropertyId,
          leaseId: effectiveListLeaseId || undefined,
        });
      } else {
        await loadEntries({ portalPropertyId: selectedPortalPropertyId || undefined });
      }
    } finally {
      setRefreshing(false);
    }
  }, [
    canRefreshEntries,
    isManagement,
    loadEntries,
    selectedPropertyId,
    selectedPortalPropertyId,
    effectiveListLeaseId,
  ]);

  // Load when selected property changes (management)
  useEffect(() => {
    if (isManagement && selectedPropertyId) {
      loadEntries({
        propertyId: selectedPropertyId,
        leaseId: effectiveListLeaseId || undefined,
      });
    }
  }, [isManagement, selectedPropertyId, effectiveListLeaseId, loadEntries]);

  // Tenant: my leases for property filter
  useEffect(() => {
    if (isManagement || !isPortalApiReachable(baseUrl) || !isAuthenticated || isGuest || meStatus !== 'ok') return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        const emailHint = emailFromAccount(account);
        const data = await fetchMyLeases(baseUrl, token, { emailHint });
        if (cancelled) return;
        const rows = Array.isArray(data?.leases) ? data.leases : [];
        setMyLeases(rows);
        const propIds = [...new Set(rows.map((l) => l.property_id).filter(Boolean))];
        if (propIds.length === 1) setSelectedPortalPropertyId(propIds[0]);
      } catch (e) {
        if (cancelled) return;
        handleApiForbidden(e);
        setMyLeases([]);
      }
    })();
    return () => { cancelled = true; };
  }, [isManagement, baseUrl, isAuthenticated, isGuest, meStatus, getAccessToken, account, handleApiForbidden]);

  // Tenant: reload payments when property filter changes
  useEffect(() => {
    if (isManagement) return;
    if (!isPortalApiReachable(baseUrl) || !isAuthenticated || isGuest || meStatus !== 'ok') return;
    const p = selectedPortalPropertyId || null;
    loadEntries({ portalPropertyId: p || undefined });
  }, [isManagement, selectedPortalPropertyId, baseUrl, isAuthenticated, isGuest, meStatus, loadEntries]);

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
    ? (Boolean(editingEntryId) || form.property_id !== '')
    : false;

  const handleOpenCreate = () => {
    openCreateForm({
      property_id: selectedPropertyId,
      lease_id: selectedLeaseId,
      tenant_user_id: selectedTenantUserId,
      show_in_tenant_portal: Boolean(selectedLeaseId),
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId || !selectedPropertyId) return;
    try {
      await onDeleteEntry(deleteTargetId, selectedPropertyId, effectiveListLeaseId);
      setDeleteTargetId(null);
      showFeedback(t('portalPayments.feedback.deleted'));
    } catch {
      showFeedback(t('portalPayments.errors.deleteFailed'));
    }
  };

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

        {/* Property + lease selectors (management only) — toolbar + filters match PortalDocuments */}
        {isManagement && (
          <Paper variant="outlined" sx={{ p: 2, backgroundImage: 'none' }}>
            <Stack spacing={1.5}>
              <Stack
                direction="row"
                spacing={1}
                justifyContent="flex-end"
                alignItems="center"
                flexWrap="wrap"
              >
                {selectedPropertyId ? (
                  <Button
                    type="button"
                    variant="contained"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleOpenCreate}
                    sx={portalBtnSx}
                  >
                    {t('portalPayments.actions.addEntry')}
                  </Button>
                ) : null}
                <PortalRefreshButton
                  label={t('portalPayments.actions.refresh')}
                  onClick={() => { void handleRefresh(); }}
                  disabled={refreshDisabledManagement}
                  loading={refreshing}
                />
              </Stack>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, width: '100%' }}>
                {leasesStatus !== 'loading' && propertyOptions.length > 0 ? (
                  <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
                    {t('portalPayments.hints.landlordListScope')}
                  </Typography>
                ) : null}
                {leasesStatus === 'ok' && tenantsDirectorySupplementFailed && propertyOptions.length > 0 ? (
                  <Alert
                    severity="info"
                    variant="outlined"
                    onClose={() => { setTenantsDirectorySupplementFailed(false); }}
                    sx={{ py: 0.5, alignItems: 'center' }}
                  >
                    {t('portalPayments.hints.tenantsDirectorySupplementFailed')}
                  </Alert>
                ) : null}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start' }}>
                {leasesStatus === 'loading' ? (
                  <CircularProgress size={20} />
                ) : propertyOptions.length > 0 ? (
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
                          const opt = propertyOptions.find((p) => p.id === value);
                          return opt?.label ?? '';
                        }}
                      >
                        <MenuItem value="">{t('portalPayments.labels.selectPropertyPlaceholder')}</MenuItem>
                        {propertyOptions.map((p) => (
                          <MenuItem key={p.id} value={p.id}>{p.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ minWidth: 200 }} disabled={!selectedPropertyId}>
                      <InputLabel id="portal-payments-tenant-user-label" shrink>
                        {t('portalPayments.labels.selectTenantUser')}
                      </InputLabel>
                      <Select
                        labelId="portal-payments-tenant-user-label"
                        value={selectedTenantUserId}
                        label={t('portalPayments.labels.selectTenantUser')}
                        onChange={(e) => { setSelectedTenantUserId(e.target.value); setSelectedLeaseId(''); }}
                        displayEmpty
                      >
                        <MenuItem value="">{t('portalPayments.labels.selectTenantUserNone')}</MenuItem>
                        {mergedTenantUserOptions.map((u) => (
                          <MenuItem key={u.id} value={u.id}>{u.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ minWidth: 280 }} disabled={leaseSelectDisabled}>
                      <InputLabel id="portal-payments-lease-label" shrink>
                        {t('portalPayments.labels.selectLeaseForProperty')}
                      </InputLabel>
                      <Select
                        labelId="portal-payments-lease-label"
                        id="portal-payments-lease-select"
                        disabled={leaseSelectDisabled}
                        value={leaseSelectDisabled ? '' : selectedLeaseId}
                        label={t('portalPayments.labels.selectLeaseForProperty')}
                        onChange={(e) => { setSelectedLeaseId(e.target.value); }}
                        displayEmpty
                        renderValue={(value) => {
                          if (leaseSelectDisabled) {
                            return (
                              <Typography component="span" variant="body2" color="text.secondary">
                                {t('portalPayments.hints.leaseSelectTenantFirst')}
                              </Typography>
                            );
                          }
                          if (value === '' || value == null) {
                            return (
                              <Typography component="span" variant="body2" color="text.secondary">
                                {t('portalPayments.labels.selectLeaseOptionalPlaceholder')}
                              </Typography>
                            );
                          }
                          const lease = leasesForProperty.find((l) => sameLeaseId(l.id, value));
                          return lease ? paymentsLeaseSelectLabel(lease, t) : '';
                        }}
                      >
                        <MenuItem value="">{t('portalPayments.labels.selectLeaseOptionalPlaceholder')}</MenuItem>
                        {leasesForLeasePicker.map((l) => (
                          <MenuItem key={l.id} value={l.id}>
                            {paymentsLeaseSelectLabel(l, t)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </>
                ) : leasesStatus === 'ok' ? (
                  <Typography variant="body2" color="text.secondary">
                    {t('portalPayments.errors.noProperties')}
                  </Typography>
                ) : null}
                </Box>
              </Box>
            </Stack>
          </Paper>
        )}

        {!isManagement && (
          <Paper variant="outlined" sx={{ p: 2, backgroundImage: 'none' }}>
            {portalPropertyOptions.length > 1 ? (
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.5}
                alignItems={{ sm: 'center' }}
                justifyContent="space-between"
              >
                <FormControl size="small" sx={{ minWidth: 280, maxWidth: '100%' }}>
                  <InputLabel id="portal-payments-portal-prop-label" shrink>
                    {t('portalPayments.labels.selectProperty')}
                  </InputLabel>
                  <Select
                    labelId="portal-payments-portal-prop-label"
                    value={selectedPortalPropertyId}
                    label={t('portalPayments.labels.selectProperty')}
                    onChange={(e) => setSelectedPortalPropertyId(e.target.value)}
                  >
                    <MenuItem value="">{t('portalPayments.labels.allProperties')}</MenuItem>
                    {portalPropertyOptions.map((p) => (
                      <MenuItem key={p.id} value={p.id}>{p.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <PortalRefreshButton
                  label={t('portalPayments.actions.refresh')}
                  onClick={() => { void handleRefresh(); }}
                  disabled={refreshDisabledTenant}
                  loading={refreshing}
                />
              </Stack>
            ) : (
              <Stack direction="row" justifyContent="flex-end">
                <PortalRefreshButton
                  label={t('portalPayments.actions.refresh')}
                  onClick={() => { void handleRefresh(); }}
                  disabled={refreshDisabledTenant}
                  loading={refreshing}
                />
              </Stack>
            )}
          </Paper>
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
                          <IconButton
                            size="small"
                            aria-label={t('portalPayments.actions.deleteEntry')}
                            onClick={() => setDeleteTargetId(entry.id)}
                          >
                            <DeleteOutline fontSize="small" />
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
              <FormControlLabel
                control={(
                  <Checkbox
                    checked={Boolean(form.show_in_tenant_portal)}
                    onChange={onFormCheckbox('show_in_tenant_portal')}
                    disabled={saveStatus === 'saving'}
                  />
                )}
                label={t('portalPayments.fields.showInTenantPortal')}
              />
              <Typography variant="caption" color="text.secondary" display="block">
                {t('portalPayments.fields.showInTenantPortalHelper')}
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={closeForm} disabled={saveStatus === 'saving'}>
              {t('portalPayments.actions.cancel')}
            </Button>
            <Button
              type="button"
              variant="contained"
              onClick={() => onSaveEntry(
                form.property_id || selectedPropertyId,
                effectiveListLeaseId,
              )}
              disabled={
                saveStatus === 'saving'
                || !form.period_start
                || !form.amount_due
                || !form.due_date
                || (!editingEntryId && !form.payment_type)
                || (!editingEntryId && !form.property_id)
              }
              startIcon={saveStatus === 'saving' ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {saveStatus === 'saving' ? t('portalPayments.actions.saving') : t('portalPayments.actions.save')}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {isManagement && (
        <Dialog
          open={deleteTargetId != null}
          onClose={() => setDeleteTargetId(null)}
          aria-labelledby="portal-payments-delete-title"
        >
          <DialogTitle id="portal-payments-delete-title">
            {t('portalPayments.deleteDialog.title')}
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              {t('portalPayments.deleteDialog.body')}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={() => setDeleteTargetId(null)}>
              {t('portalPayments.actions.cancel')}
            </Button>
            <Button type="button" color="error" variant="contained" onClick={() => void handleConfirmDelete()}>
              {t('portalPayments.deleteDialog.confirm')}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      <PortalFeedbackSnackbar feedback={feedback} onClose={closeFeedback} />
    </Box>
  );
};

export default PortalPayments;
