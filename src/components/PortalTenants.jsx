import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Add from '@mui/icons-material/Add';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ExpandLess from '@mui/icons-material/ExpandLess';
import Refresh from '@mui/icons-material/Refresh';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { Role } from '../domain/constants.js';
import { resolveRole, normalizeRole } from '../portalUtils';
import {
  fetchTenants,
  createTenant,
  patchTenantAccess,
  addTenantLease,
  fetchLandlords,
  fetchLandlordProperties,
} from '../lib/portalApiClient';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function displayName(user) {
  const first = String(user?.first_name ?? '').trim();
  const last = String(user?.last_name ?? '').trim();
  return `${first} ${last}`.trim() || '—';
}

function propertyLabel(p) {
  if (!p) return '—';
  const street = p.property_street ?? p.street ?? '';
  const city = p.property_city ?? p.city ?? '';
  const state = p.property_state ?? p.state ?? '';
  const zip = p.property_zip ?? p.zip ?? '';
  return [street, city && state ? `${city}, ${state}` : city || state, zip]
    .filter(Boolean)
    .join(' ');
}

function isActiveStatus(status) {
  return String(status ?? '').toUpperCase() === 'ACTIVE';
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// LeaseRow — shows one lease in the detail panel
// ---------------------------------------------------------------------------

function LeaseRow({ lease, t }) {
  const isActive = lease.is_active;
  const dateRange = lease.month_to_month
    ? `${formatDate(lease.start_date)} — Month-to-month`
    : lease.end_date
      ? `${formatDate(lease.start_date)} – ${formatDate(lease.end_date)}`
      : `${formatDate(lease.start_date)} — no end date`;

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1.5,
        p: 1.5,
        backgroundColor: isActive ? 'action.hover' : 'background.default',
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {propertyLabel(lease)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {dateRange}
          </Typography>
          {lease.notes && (
            <Typography variant="caption" color="text.secondary">
              {lease.notes}
            </Typography>
          )}
        </Box>
        <Chip
          label={isActive ? t('portalTenants.lease.active') : t('portalTenants.lease.ended')}
          size="small"
          color={isActive ? 'success' : 'default'}
          variant={isActive ? 'filled' : 'outlined'}
        />
      </Stack>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// AddLeaseDialog — add a new lease for an existing tenant
// ---------------------------------------------------------------------------

const EMPTY_LEASE_FORM = {
  property_id: '',
  start_date: '',
  end_date: '',
  month_to_month: false,
  notes: '',
};

function AddLeaseDialog({ open, onClose, onSaved, tenantId, properties, t }) {
  const [form, setForm] = useState(EMPTY_LEASE_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitState, setSubmitState] = useState({ status: 'idle', detail: '' });
  const { baseUrl, getAccessToken, account, meData } = usePortalAuth();
  const emailHint = meData?.user?.email ?? account?.username ?? '';

  useEffect(() => {
    if (open) {
      setForm(EMPTY_LEASE_FORM);
      setFieldErrors({});
      setSubmitState({ status: 'idle', detail: '' });
    }
  }, [open]);

  const onChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const errors = {};
    if (!form.property_id) errors.property_id = t('portalTenants.errors.propertyRequired');
    if (!form.start_date) errors.start_date = t('portalTenants.errors.startDateRequired');
    if (!form.month_to_month && form.end_date && form.end_date <= form.start_date) {
      errors.end_date = t('portalTenants.errors.endDateBeforeStart');
    }
    return errors;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setSubmitState({ status: 'saving', detail: '' });
    try {
      const accessToken = await getAccessToken();
      await addTenantLease(baseUrl, accessToken, tenantId, {
        emailHint,
        property_id: form.property_id,
        start_date: form.start_date,
        end_date: form.month_to_month ? null : (form.end_date || null),
        month_to_month: form.month_to_month,
        notes: form.notes || null,
      });
      setSubmitState({ status: 'ok', detail: '' });
      onSaved();
    } catch (error) {
      const detail = error?.message ?? 'request_failed';
      setSubmitState({ status: 'error', detail });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('portalTenants.addLeaseDialog.title')}</DialogTitle>
      <Box component="form" onSubmit={onSubmit}>
        <DialogContent>
          <Stack spacing={2}>
            {submitState.status === 'error' && (
              <Alert severity="error">{submitState.detail}</Alert>
            )}
            <Select
              value={form.property_id}
              onChange={onChange('property_id')}
              displayEmpty
              fullWidth
              error={Boolean(fieldErrors.property_id)}
              size="small"
            >
              <MenuItem value="" disabled>
                {t('portalTenants.form.selectProperty')}
              </MenuItem>
              {properties.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {propertyLabel(p)}
                </MenuItem>
              ))}
            </Select>
            {fieldErrors.property_id && (
              <Typography variant="caption" color="error">
                {fieldErrors.property_id}
              </Typography>
            )}
            <TextField
              label={t('portalTenants.form.startDate')}
              type="date"
              value={form.start_date}
              onChange={onChange('start_date')}
              InputLabelProps={{ shrink: true }}
              required
              fullWidth
              error={Boolean(fieldErrors.start_date)}
              helperText={fieldErrors.start_date || ' '}
              size="small"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.month_to_month}
                  onChange={onChange('month_to_month')}
                  size="small"
                />
              }
              label={t('portalTenants.form.monthToMonth')}
            />
            {!form.month_to_month && (
              <TextField
                label={t('portalTenants.form.endDate')}
                type="date"
                value={form.end_date}
                onChange={onChange('end_date')}
                InputLabelProps={{ shrink: true }}
                fullWidth
                error={Boolean(fieldErrors.end_date)}
                helperText={fieldErrors.end_date || ' '}
                size="small"
              />
            )}
            <TextField
              label={t('portalTenants.form.notes')}
              value={form.notes}
              onChange={onChange('notes')}
              multiline
              rows={2}
              fullWidth
              size="small"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={submitState.status === 'saving'}>
            {t('portalTenants.actions.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={submitState.status === 'saving'}
          >
            {submitState.status === 'saving'
              ? t('portalTenants.actions.saving')
              : t('portalTenants.addLeaseDialog.save')}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// TenantRow — one tenant in the list with expandable lease detail
// ---------------------------------------------------------------------------

function TenantRow({ tenant, properties, onToggleAccess, onLeaseSaved, t }) {
  const [expanded, setExpanded] = useState(false);
  const [leasesState, setLeasesState] = useState({ status: 'idle', leases: [] });
  const [addLeaseOpen, setAddLeaseOpen] = useState(false);
  const { baseUrl, getAccessToken, account, meData } = usePortalAuth();
  const emailHint = meData?.user?.email ?? account?.username ?? '';
  const isActive = isActiveStatus(tenant.status);

  const loadLeases = useCallback(async () => {
    if (!baseUrl) return;
    setLeasesState({ status: 'loading', leases: [] });
    try {
      const accessToken = await getAccessToken();
      const res = await fetch(
        `${baseUrl.replace(/\/$/, '')}/api/landlord/tenants/${encodeURIComponent(tenant.id)}`,
        {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
            ...(emailHint ? { 'X-Email-Hint': emailHint } : {}),
          },
          credentials: 'omit',
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLeasesState({ status: 'ok', leases: Array.isArray(data.leases) ? data.leases : [] });
    } catch (e) {
      setLeasesState({ status: 'error', leases: [] });
    }
  }, [baseUrl, getAccessToken, emailHint, tenant.id]);

  const handleExpand = () => {
    if (!expanded && leasesState.status === 'idle') {
      void loadLeases();
    }
    setExpanded((prev) => !prev);
  };

  const handleLeaseSaved = () => {
    setAddLeaseOpen(false);
    void loadLeases();
    onLeaseSaved();
  };

  const activeLease = useMemo(
    () => leasesState.leases.find((l) => l.is_active),
    [leasesState.leases]
  );

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      {/* Tenant header row */}
      <Box
        sx={{
          p: 1.5,
          backgroundColor: 'background.paper',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography sx={{ fontWeight: 600 }}>{displayName(tenant)}</Typography>
            <Chip
              label={isActive ? t('portalTenants.status.active') : t('portalTenants.status.disabled')}
              size="small"
              color={isActive ? 'success' : 'default'}
              variant={isActive ? 'filled' : 'outlined'}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {tenant.email}
          </Typography>
          {tenant.property_street && (
            <Typography variant="caption" color="text.secondary">
              {propertyLabel(tenant)}
            </Typography>
          )}
        </Box>

        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexShrink: 0 }}>
          {isActive ? (
            <Button
              type="button"
              size="small"
              color="warning"
              variant="outlined"
              onClick={() => onToggleAccess(tenant.id, false)}
            >
              {t('portalTenants.actions.disable')}
            </Button>
          ) : (
            <Button
              type="button"
              size="small"
              variant="outlined"
              onClick={() => onToggleAccess(tenant.id, true)}
            >
              {t('portalTenants.actions.enable')}
            </Button>
          )}
          <Tooltip title={expanded ? t('portalTenants.actions.collapse') : t('portalTenants.actions.expand')}>
            <IconButton size="small" onClick={handleExpand} aria-label={expanded ? t('portalTenants.actions.collapse') : t('portalTenants.actions.expand')}>
              {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Expanded lease detail */}
      <Collapse in={expanded}>
        <Box
          sx={{
            px: 1.5,
            pb: 1.5,
            pt: 1,
            borderTop: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'background.default',
          }}
        >
          <Stack spacing={1}>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="subtitle2" color="text.secondary">
                {t('portalTenants.lease.heading')}
              </Typography>
              <Button
                type="button"
                size="small"
                startIcon={<Add />}
                onClick={() => setAddLeaseOpen(true)}
              >
                {t('portalTenants.actions.addLease')}
              </Button>
            </Stack>

            {leasesState.status === 'loading' && (
              <Stack spacing={0.5}>
                <Skeleton variant="rounded" height={56} />
                <Skeleton variant="rounded" height={56} />
              </Stack>
            )}
            {leasesState.status === 'error' && (
              <Alert severity="error" action={
                <Button size="small" onClick={loadLeases}>{t('portalTenants.actions.retry')}</Button>
              }>
                {t('portalTenants.errors.loadLeasesFailed')}
              </Alert>
            )}
            {leasesState.status === 'ok' && leasesState.leases.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                {t('portalTenants.lease.empty')}
              </Typography>
            )}
            {leasesState.leases.map((lease) => (
              <LeaseRow key={lease.id} lease={lease} t={t} />
            ))}
          </Stack>
        </Box>
      </Collapse>

      <AddLeaseDialog
        open={addLeaseOpen}
        onClose={() => setAddLeaseOpen(false)}
        onSaved={handleLeaseSaved}
        tenantId={tenant.id}
        properties={properties}
        t={t}
      />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// OnboardTenantDialog — create a new tenant with initial lease
// ---------------------------------------------------------------------------

const EMPTY_ONBOARD_FORM = {
  email: '',
  firstName: '',
  lastName: '',
  phone: '',
  property_id: '',
  start_date: '',
  end_date: '',
  month_to_month: false,
  notes: '',
};

function OnboardTenantDialog({ open, onClose, onSaved, properties, t }) {
  const [form, setForm] = useState(EMPTY_ONBOARD_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitState, setSubmitState] = useState({ status: 'idle', detail: '' });
  const { baseUrl, getAccessToken, account, meData } = usePortalAuth();
  const emailHint = meData?.user?.email ?? account?.username ?? '';

  useEffect(() => {
    if (open) {
      setForm(EMPTY_ONBOARD_FORM);
      setFieldErrors({});
      setSubmitState({ status: 'idle', detail: '' });
    }
  }, [open]);

  const onChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const errors = {};
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = t('portalTenants.errors.emailInvalid');
    }
    if (!form.firstName.trim()) errors.firstName = t('portalTenants.errors.firstNameRequired');
    if (!form.lastName.trim()) errors.lastName = t('portalTenants.errors.lastNameRequired');
    if (!form.property_id) errors.property_id = t('portalTenants.errors.propertyRequired');
    if (!form.start_date) errors.start_date = t('portalTenants.errors.startDateRequired');
    if (!form.month_to_month && form.end_date && form.end_date <= form.start_date) {
      errors.end_date = t('portalTenants.errors.endDateBeforeStart');
    }
    return errors;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setSubmitState({ status: 'saving', detail: '' });
    try {
      const accessToken = await getAccessToken();
      await createTenant(baseUrl, accessToken, {
        emailHint,
        email: form.email.trim().toLowerCase(),
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        phone: form.phone.trim() || null,
        property_id: form.property_id,
        lease: {
          start_date: form.start_date,
          end_date: form.month_to_month ? null : (form.end_date || null),
          month_to_month: form.month_to_month,
          notes: form.notes || null,
        },
      });
      setSubmitState({ status: 'ok', detail: '' });
      onSaved();
    } catch (error) {
      const detail = error?.message ?? 'request_failed';
      setSubmitState({ status: 'error', detail });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('portalTenants.onboardDialog.title')}</DialogTitle>
      <Box component="form" onSubmit={onSubmit}>
        <DialogContent>
          <Stack spacing={2}>
            {submitState.status === 'error' && (
              <Alert severity="error">{submitState.detail}</Alert>
            )}

            <Typography variant="subtitle2" color="text.secondary">
              {t('portalTenants.onboardDialog.tenantSection')}
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                label={t('portalTenants.form.firstName')}
                value={form.firstName}
                onChange={onChange('firstName')}
                required
                fullWidth
                error={Boolean(fieldErrors.firstName)}
                helperText={fieldErrors.firstName || ' '}
                size="small"
                autoComplete="given-name"
              />
              <TextField
                label={t('portalTenants.form.lastName')}
                value={form.lastName}
                onChange={onChange('lastName')}
                required
                fullWidth
                error={Boolean(fieldErrors.lastName)}
                helperText={fieldErrors.lastName || ' '}
                size="small"
                autoComplete="family-name"
              />
            </Stack>
            <TextField
              label={t('portalTenants.form.email')}
              value={form.email}
              onChange={onChange('email')}
              required
              type="email"
              fullWidth
              error={Boolean(fieldErrors.email)}
              helperText={fieldErrors.email || ' '}
              size="small"
              autoComplete="email"
            />
            <TextField
              label={t('portalTenants.form.phone')}
              value={form.phone}
              onChange={onChange('phone')}
              fullWidth
              size="small"
              autoComplete="tel"
            />

            <Typography variant="subtitle2" color="text.secondary" sx={{ pt: 1 }}>
              {t('portalTenants.onboardDialog.leaseSection')}
            </Typography>

            <Select
              value={form.property_id}
              onChange={onChange('property_id')}
              displayEmpty
              fullWidth
              error={Boolean(fieldErrors.property_id)}
              size="small"
            >
              <MenuItem value="" disabled>
                {t('portalTenants.form.selectProperty')}
              </MenuItem>
              {properties.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {propertyLabel(p)}
                </MenuItem>
              ))}
            </Select>
            {fieldErrors.property_id && (
              <Typography variant="caption" color="error" sx={{ mt: '-8px !important' }}>
                {fieldErrors.property_id}
              </Typography>
            )}

            <TextField
              label={t('portalTenants.form.startDate')}
              type="date"
              value={form.start_date}
              onChange={onChange('start_date')}
              InputLabelProps={{ shrink: true }}
              required
              fullWidth
              error={Boolean(fieldErrors.start_date)}
              helperText={fieldErrors.start_date || ' '}
              size="small"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.month_to_month}
                  onChange={onChange('month_to_month')}
                  size="small"
                />
              }
              label={t('portalTenants.form.monthToMonth')}
            />
            {!form.month_to_month && (
              <TextField
                label={t('portalTenants.form.endDate')}
                type="date"
                value={form.end_date}
                onChange={onChange('end_date')}
                InputLabelProps={{ shrink: true }}
                fullWidth
                error={Boolean(fieldErrors.end_date)}
                helperText={fieldErrors.end_date || ' '}
                size="small"
              />
            )}
            <TextField
              label={t('portalTenants.form.notes')}
              value={form.notes}
              onChange={onChange('notes')}
              multiline
              rows={2}
              fullWidth
              size="small"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={submitState.status === 'saving'}>
            {t('portalTenants.actions.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={submitState.status === 'saving'}
          >
            {submitState.status === 'saving'
              ? t('portalTenants.actions.saving')
              : t('portalTenants.onboardDialog.save')}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main PortalTenants page
// ---------------------------------------------------------------------------

const PortalTenants = () => {
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
  const isAdmin = role === Role.ADMIN;
  const canUseModule =
    isAuthenticated && (role === Role.LANDLORD || isAdmin) && Boolean(baseUrl);

  // Admin landlord filter
  const [landlords, setLandlords] = useState([]);
  const [selectedLandlordId, setSelectedLandlordId] = useState('');

  // Properties (for dropdown in dialogs)
  const [properties, setProperties] = useState([]);

  // Tenants list
  const [tenantsState, setTenantsState] = useState({ status: 'idle', tenants: [] });

  // Dialogs
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [actionState, setActionState] = useState({ status: 'idle', detail: '' });

  const emailHint = meData?.user?.email ?? account?.username ?? '';

  // Load landlords (admin only)
  const loadLandlords = useCallback(async () => {
    if (!canUseModule || !isAdmin) return;
    try {
      const accessToken = await getAccessToken();
      const payload = await fetchLandlords(baseUrl, accessToken, { includeInactive: false });
      setLandlords(Array.isArray(payload?.landlords) ? payload.landlords : []);
    } catch (e) {
      handleApiForbidden(e);
    }
  }, [baseUrl, canUseModule, isAdmin, getAccessToken, handleApiForbidden]);

  // Load properties visible to actor (or to selected landlord for admin)
  const loadProperties = useCallback(async () => {
    if (!canUseModule || !baseUrl) return;
    try {
      const accessToken = await getAccessToken();
      const payload = await fetchLandlordProperties(baseUrl, accessToken, { emailHint });
      const all = Array.isArray(payload?.properties) ? payload.properties : [];
      // For admin with a selected landlord: filter by that landlord
      if (isAdmin && selectedLandlordId) {
        setProperties(all.filter((p) => p.landlord_user_id === selectedLandlordId || p.created_by === selectedLandlordId));
      } else {
        setProperties(all);
      }
    } catch (e) {
      handleApiForbidden(e);
    }
  }, [baseUrl, canUseModule, getAccessToken, emailHint, isAdmin, selectedLandlordId, handleApiForbidden]);

  // Load tenants
  const loadTenants = useCallback(async () => {
    if (!canUseModule || !baseUrl) {
      setTenantsState({ status: 'idle', tenants: [] });
      return;
    }
    setTenantsState((prev) => ({ ...prev, status: 'loading' }));
    try {
      const accessToken = await getAccessToken();
      const landlordId = isAdmin && selectedLandlordId ? selectedLandlordId : undefined;
      const payload = await fetchTenants(baseUrl, accessToken, { emailHint, landlordId });
      setTenantsState({
        status: 'ok',
        tenants: Array.isArray(payload?.tenants) ? payload.tenants : [],
      });
    } catch (e) {
      handleApiForbidden(e);
      const detail = e?.message ?? 'request_failed';
      setTenantsState({ status: 'error', tenants: [], detail });
    }
  }, [baseUrl, canUseModule, getAccessToken, emailHint, isAdmin, selectedLandlordId, handleApiForbidden]);

  useEffect(() => {
    void loadLandlords();
  }, [loadLandlords]);

  useEffect(() => {
    void loadTenants();
    void loadProperties();
  }, [loadTenants, loadProperties]);

  const handleToggleAccess = async (tenantId, active) => {
    if (!canUseModule) return;
    setActionState({ status: 'saving', detail: '' });
    try {
      const accessToken = await getAccessToken();
      await patchTenantAccess(baseUrl, accessToken, tenantId, { active, emailHint });
      setActionState({
        status: 'ok',
        detail: active
          ? t('portalTenants.messages.tenantEnabled')
          : t('portalTenants.messages.tenantDisabled'),
      });
      void loadTenants();
    } catch (e) {
      handleApiForbidden(e);
      setActionState({ status: 'error', detail: e?.message ?? 'request_failed' });
    }
  };

  const handleOnboarded = () => {
    setOnboardOpen(false);
    setActionState({ status: 'ok', detail: t('portalTenants.messages.tenantOnboarded') });
    void loadTenants();
  };

  const accessDenied = isAuthenticated && meStatus !== 'loading' && !canUseModule;

  return (
    <Box sx={{ py: 4 }}>
      <Helmet>
        <title>{t('portalTenants.title')}</title>
        <meta name="description" content={t('portalTenants.metaDescription')} />
      </Helmet>

      <Stack spacing={2}>
        <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h1" sx={{ fontSize: '2rem' }}>
              {t('portalTenants.heading')}
            </Typography>
            <Typography color="text.secondary">{t('portalTenants.intro')}</Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setOnboardOpen(true)}
            disabled={!canUseModule || (isAdmin && !selectedLandlordId && properties.length === 0)}
          >
            {t('portalTenants.actions.onboardTenant')}
          </Button>
        </Stack>

        {/* Alerts */}
        {!baseUrl && (
          <Alert severity="warning">{t('portalTenants.errors.apiUnavailable')}</Alert>
        )}
        {accessDenied && (
          <Alert severity="error">{t('portalTenants.errors.accessDenied')}</Alert>
        )}
        {actionState.status === 'ok' && (
          <Alert severity="success" onClose={() => setActionState({ status: 'idle', detail: '' })}>
            {actionState.detail}
          </Alert>
        )}
        {actionState.status === 'error' && (
          <Alert severity="error" onClose={() => setActionState({ status: 'idle', detail: '' })}>
            {actionState.detail}
          </Alert>
        )}

        {/* Admin landlord selector */}
        {isAdmin && (
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              p: 2,
              backgroundColor: 'background.paper',
            }}
          >
            <Stack spacing={1.5}>
              <Typography variant="h2" sx={{ fontSize: '1.1rem' }}>
                {t('portalTenants.adminFilter.heading')}
              </Typography>
              <Select
                value={selectedLandlordId}
                onChange={(e) => setSelectedLandlordId(e.target.value)}
                displayEmpty
                size="small"
                fullWidth
              >
                <MenuItem value="">
                  {t('portalTenants.adminFilter.allLandlords')}
                </MenuItem>
                {landlords.map((l) => (
                  <MenuItem key={l.id} value={l.id}>
                    {displayName(l)} — {l.email}
                  </MenuItem>
                ))}
              </Select>
            </Stack>
          </Box>
        )}

        {/* Tenant list */}
        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            p: 2,
            backgroundColor: 'background.paper',
          }}
        >
          <Stack spacing={1.5}>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="h2" sx={{ fontSize: '1.25rem' }}>
                {t('portalTenants.list.heading')}
              </Typography>
              <Tooltip title={t('portalTenants.actions.refresh')}>
                <span>
                  <IconButton
                    size="small"
                    onClick={() => void loadTenants()}
                    disabled={!canUseModule || tenantsState.status === 'loading'}
                    aria-label={t('portalTenants.actions.refresh')}
                  >
                    <Refresh fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>

            {tenantsState.status === 'loading' && (
              <Stack spacing={1}>
                <Skeleton variant="rounded" height={64} />
                <Skeleton variant="rounded" height={64} />
                <Skeleton variant="rounded" height={64} />
              </Stack>
            )}
            {tenantsState.status === 'error' && (
              <Alert severity="error">{tenantsState.detail ?? t('portalTenants.errors.loadFailed')}</Alert>
            )}
            {tenantsState.status === 'ok' && tenantsState.tenants.length === 0 && (
              <Typography color="text.secondary">{t('portalTenants.list.empty')}</Typography>
            )}
            {tenantsState.tenants.map((tenant) => (
              <TenantRow
                key={tenant.id}
                tenant={tenant}
                properties={properties}
                onToggleAccess={handleToggleAccess}
                onLeaseSaved={loadTenants}
                t={t}
              />
            ))}
          </Stack>
        </Box>
      </Stack>

      <OnboardTenantDialog
        open={onboardOpen}
        onClose={() => setOnboardOpen(false)}
        onSaved={handleOnboarded}
        properties={properties}
        t={t}
      />
    </Box>
  );
};

export default PortalTenants;
