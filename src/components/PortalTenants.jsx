import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import {
  Box,
  Button,
  CircularProgress,
  Checkbox,
  Chip,
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
import Close from '@mui/icons-material/Close';
import Delete from '@mui/icons-material/Delete';
import Edit from '@mui/icons-material/Edit';
import Block from '@mui/icons-material/Block';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ExpandLess from '@mui/icons-material/ExpandLess';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { Role } from '../domain/constants.js';
import { resolveRole, normalizeRole } from '../portalUtils';
import {
  fetchTenants,
  createTenant,
  patchTenantAccess,
  updateTenant,
  deleteTenant,
  addTenantLease,
  updateLease,
  deleteLease,
  fetchLandlords,
  fetchLandlordProperties,
} from '../lib/portalApiClient';
import PortalConfirmDialog from './PortalConfirmDialog';
import InlineActionStatus from './InlineActionStatus';
import StatusAlertSlot from './StatusAlertSlot';
import { usePortalFeedback } from '../hooks/usePortalFeedback';
import PortalFeedbackSnackbar from './PortalFeedbackSnackbar';
import PortalRefreshButton from './PortalRefreshButton';

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

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function sortByPropertyLabel(items) {
  return [...items].sort((a, b) => collator.compare(propertyLabel(a), propertyLabel(b)));
}

function sortByLandlordLabel(items) {
  return [...items].sort((a, b) => {
    const aLabel = `${displayName(a)} ${String(a?.email ?? '').trim()}`.trim();
    const bLabel = `${displayName(b)} ${String(b?.email ?? '').trim()}`.trim();
    return collator.compare(aLabel, bLabel);
  });
}

function sortByTenantLabel(items) {
  return [...items].sort((a, b) => {
    const aLabel = `${displayName(a)} ${String(a?.email ?? '').trim()}`.trim();
    const bLabel = `${displayName(b)} ${String(b?.email ?? '').trim()}`.trim();
    return collator.compare(aLabel, bLabel);
  });
}

function normalizeTenantRows(rows) {
  if (!Array.isArray(rows)) return [];
  const byId = new Map();
  const withoutId = [];

  rows.forEach((row) => {
    if (!row || typeof row !== 'object') return;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    if (id) {
      byId.set(id, row);
      return;
    }

    const first = String(row.first_name ?? '').trim();
    const last = String(row.last_name ?? '').trim();
    const email = String(row.email ?? '').trim();
    const hasVisibleContent = Boolean(first || last || email);
    if (hasVisibleContent) {
      withoutId.push(row);
    }
  });

  return [...byId.values(), ...withoutId];
}

function tenantRowKey(tenant, index) {
  if (tenant?.id) return tenant.id;
  const email = typeof tenant?.email === 'string' ? tenant.email.trim() : '';
  if (email) return `email:${email}`;
  const first = String(tenant?.first_name ?? '').trim();
  const last = String(tenant?.last_name ?? '').trim();
  if (first || last) return `name:${first}:${last}:${index}`;
  return `tenant-row:${index}`;
}

function DialogTitleWithClose({ title, onClose, closeLabel, disabled = false }) {
  return (
    <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
      <Typography component="span">{title}</Typography>
      <IconButton
        type="button"
        onClick={onClose}
        disabled={disabled}
        aria-label={closeLabel}
        size="small"
      >
        <Close fontSize="small" />
      </IconButton>
    </DialogTitle>
  );
}

function toDatePart(dateStr) {
  if (!dateStr) return '';
  // The mssql driver returns DATE columns as JS Date objects, which JSON-serialize
  // to full ISO strings ("2024-01-15T00:00:00.000Z"). Slice to YYYY-MM-DD so
  // comparisons, <input type="date"> values, and display formatting all work.
  return String(dateStr).slice(0, 10);
}

function tenantApiErrorMessage(error, t) {
  const code = typeof error?.code === 'string' ? error.code : '';
  switch (code) {
    case 'email_already_in_use':
      return t('portalTenants.errors.emailAlreadyInUse');
    case 'email_belongs_to_admin':
      return t('portalTenants.errors.emailBelongsToAdmin');
    case 'email_belongs_to_landlord':
      return t('portalTenants.errors.emailBelongsToLandlord');
    case 'invalid_phone':
      return t('portalTenants.errors.phoneInvalid');
    case 'active_lease_not_found':
      return t('portalTenants.errors.activeLeaseRequiredForReassign');
    default:
      return t('portalTenants.errors.saveFailed');
  }
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  try {
    // Append local midnight so the displayed day matches the stored date regardless
    // of the user's UTC offset (avoids off-by-one when the stored time is midnight UTC).
    return new Date(toDatePart(dateStr) + 'T00:00:00').toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(dateStr);
  }
}

// ---------------------------------------------------------------------------
// EditLeaseDialog — edit an existing lease
// ---------------------------------------------------------------------------

function EditLeaseDialog({ open, onClose, onSaved, lease, properties, t }) {
  const [form, setForm] = useState({
    property_id: '',
    start_date: '',
    end_date: '',
    month_to_month: false,
    notes: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitState, setSubmitState] = useState({ status: 'idle', detail: '' });
  const [initialForm, setInitialForm] = useState(EMPTY_LEASE_FORM);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const { baseUrl, getAccessToken, account, meData } = usePortalAuth();
  const emailHint = meData?.user?.email ?? account?.username ?? '';
  const submitStatusMessage = submitState.status === 'error'
    ? { severity: 'error', text: submitState.detail }
    : null;
  const sortedProperties = useMemo(() => sortByPropertyLabel(properties), [properties]);

  useEffect(() => {
    if (open && lease) {
      const nextForm = {
        property_id: lease.property_id ?? '',
        start_date: toDatePart(lease.start_date),
        end_date: toDatePart(lease.end_date),
        month_to_month: Boolean(lease.month_to_month),
        notes: lease.notes ?? '',
      };
      setForm(nextForm);
      setInitialForm(nextForm);
      setFieldErrors({});
      setSubmitState({ status: 'idle', detail: '' });
      setDiscardDialogOpen(false);
    }
  }, [open, lease]);
  const hasUnsavedChanges = JSON.stringify(form) !== JSON.stringify(initialForm);
  const handleAttemptClose = () => {
    if (submitState.status === 'saving') return;
    if (hasUnsavedChanges) {
      setDiscardDialogOpen(true);
      return;
    }
    onClose();
  };

  const onChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const errors = {};
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
      await updateLease(baseUrl, accessToken, lease.id, {
        emailHint,
        start_date: form.start_date,
        end_date: form.month_to_month ? null : (form.end_date || null),
        month_to_month: form.month_to_month,
        notes: form.notes || null,
      });
      setSubmitState({ status: 'ok', detail: '' });
      onSaved();
    } catch (error) {
      const detail = tenantApiErrorMessage(error, t);
      setSubmitState({ status: 'error', detail });
    }
  };

  return (
    <Dialog open={open} onClose={handleAttemptClose} maxWidth="sm" fullWidth>
      <DialogTitleWithClose
        title={t('portalTenants.editLeaseDialog.title')}
        onClose={handleAttemptClose}
        closeLabel={t('portalDialogs.closeForm')}
        disabled={submitState.status === 'saving'}
      />
      <Box component="form" onSubmit={onSubmit}>
        <DialogContent>
          <Stack spacing={2}>
            <Select
              value={form.property_id}
              onChange={onChange('property_id')}
              displayEmpty
              fullWidth
              size="small"
              disabled
            >
              <MenuItem value="" disabled>
                {t('portalTenants.form.selectProperty')}
              </MenuItem>
              {sortedProperties.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {propertyLabel(p)}
                </MenuItem>
              ))}
            </Select>
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
          <InlineActionStatus message={submitStatusMessage} />
          <Button type="button" onClick={handleAttemptClose} disabled={submitState.status === 'saving'}>
            {t('portalTenants.actions.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={submitState.status === 'saving'}
          >
            {submitState.status === 'saving'
              ? t('portalTenants.actions.saving')
              : t('portalTenants.editLeaseDialog.save')}
          </Button>
        </DialogActions>
      </Box>
      <PortalConfirmDialog
        open={discardDialogOpen}
        onClose={() => setDiscardDialogOpen(false)}
        onConfirm={() => {
          setDiscardDialogOpen(false);
          onClose();
        }}
        title={t('portalDialogs.unsavedChanges.title')}
        body={t('portalDialogs.unsavedChanges.body')}
        confirmLabel={t('portalDialogs.unsavedChanges.discard')}
        cancelLabel={t('portalDialogs.unsavedChanges.keepEditing')}
        confirmColor="warning"
      />
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// LeaseRow — shows one lease in the detail panel
// ---------------------------------------------------------------------------

function LeaseRow({ lease, properties, onLeaseUpdated, t }) {
  const isActive = lease.is_active;
  const dateRange = lease.month_to_month
    ? `${formatDate(lease.start_date)} — Month-to-month`
    : lease.end_date
      ? `${formatDate(lease.start_date)} – ${formatDate(lease.end_date)}`
      : `${formatDate(lease.start_date)} — no end date`;

  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteState, setDeleteState] = useState({ status: 'idle', detail: '' });
  const { baseUrl, getAccessToken, account, meData } = usePortalAuth();
  const emailHint = meData?.user?.email ?? account?.username ?? '';

  const handleDeleteConfirm = async () => {
    setDeleteState({ status: 'saving', detail: '' });
    try {
      const accessToken = await getAccessToken();
      await deleteLease(baseUrl, accessToken, lease.id, { emailHint });
      setDeleteConfirmOpen(false);
      setDeleteState({ status: 'idle', detail: '' });
      onLeaseUpdated();
    } catch (error) {
      setDeleteState({ status: 'error', detail: tenantApiErrorMessage(error, t) });
    }
  };

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
          {deleteState.status === 'error' && (
            <Typography variant="caption" color="error">
              {deleteState.detail}
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexShrink: 0 }}>
          <Chip
            label={isActive ? t('portalTenants.lease.active') : t('portalTenants.lease.ended')}
            size="small"
            color={isActive ? 'success' : 'default'}
            variant={isActive ? 'filled' : 'outlined'}
          />
          <Tooltip title={t('portalTenants.actions.editLease')}>
            <IconButton
              type="button"
              size="small"
              onClick={() => setEditOpen(true)}
              aria-label={t('portalTenants.actions.editLease')}
            >
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('portalTenants.actions.deleteLease')}>
            <IconButton
              type="button"
              size="small"
              color="error"
              onClick={() => setDeleteConfirmOpen(true)}
              aria-label={t('portalTenants.actions.deleteLease')}
            >
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <EditLeaseDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => { setEditOpen(false); onLeaseUpdated(); }}
        lease={lease}
        properties={properties}
        t={t}
      />

      <PortalConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteConfirm}
        title={t('portalTenants.deleteLeaseConfirm.title')}
        body={t('portalTenants.deleteLeaseConfirm.body')}
        confirmLabel={t('portalTenants.deleteLeaseConfirm.confirm')}
        cancelLabel={t('portalTenants.actions.cancel')}
        loading={deleteState.status === 'saving'}
      />
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
  const [initialForm, setInitialForm] = useState(EMPTY_LEASE_FORM);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const { baseUrl, getAccessToken, account, meData } = usePortalAuth();
  const emailHint = meData?.user?.email ?? account?.username ?? '';
  const submitStatusMessage = submitState.status === 'error'
    ? { severity: 'error', text: submitState.detail }
    : null;
  const sortedProperties = useMemo(() => sortByPropertyLabel(properties), [properties]);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_LEASE_FORM);
      setInitialForm(EMPTY_LEASE_FORM);
      setFieldErrors({});
      setSubmitState({ status: 'idle', detail: '' });
      setDiscardDialogOpen(false);
    }
  }, [open]);
  const hasUnsavedChanges = JSON.stringify(form) !== JSON.stringify(initialForm);
  const handleAttemptClose = () => {
    if (submitState.status === 'saving') return;
    if (hasUnsavedChanges) {
      setDiscardDialogOpen(true);
      return;
    }
    onClose();
  };

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
      const detail = tenantApiErrorMessage(error, t);
      setSubmitState({ status: 'error', detail });
    }
  };

  return (
    <Dialog open={open} onClose={handleAttemptClose} maxWidth="sm" fullWidth>
      <DialogTitleWithClose
        title={t('portalTenants.addLeaseDialog.title')}
        onClose={handleAttemptClose}
        closeLabel={t('portalDialogs.closeForm')}
        disabled={submitState.status === 'saving'}
      />
      <Box component="form" onSubmit={onSubmit}>
        <DialogContent>
          <Stack spacing={2}>
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
              {sortedProperties.map((p) => (
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
          <InlineActionStatus message={submitStatusMessage} />
          <Button type="button" onClick={handleAttemptClose} disabled={submitState.status === 'saving'}>
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
      <PortalConfirmDialog
        open={discardDialogOpen}
        onClose={() => setDiscardDialogOpen(false)}
        onConfirm={() => {
          setDiscardDialogOpen(false);
          onClose();
        }}
        title={t('portalDialogs.unsavedChanges.title')}
        body={t('portalDialogs.unsavedChanges.body')}
        confirmLabel={t('portalDialogs.unsavedChanges.discard')}
        cancelLabel={t('portalDialogs.unsavedChanges.keepEditing')}
        confirmColor="warning"
      />
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// EditTenantDialog — edit basic tenant profile fields
// ---------------------------------------------------------------------------

const EMPTY_EDIT_TENANT_FORM = {
  email: '',
  firstName: '',
  lastName: '',
  phone: '',
  landlord_id: '',
  property_id: '',
};

function EditTenantDialog({
  open,
  onClose,
  onSaved,
  tenant,
  properties,
  landlords,
  isAdmin,
  t,
}) {
  const [form, setForm] = useState(EMPTY_EDIT_TENANT_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitState, setSubmitState] = useState({ status: 'idle', detail: '' });
  const [initialForm, setInitialForm] = useState(EMPTY_EDIT_TENANT_FORM);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const { baseUrl, getAccessToken, account, meData } = usePortalAuth();
  const emailHint = meData?.user?.email ?? account?.username ?? '';
  const submitStatusMessage = submitState.status === 'error'
    ? { severity: 'error', text: submitState.detail }
    : null;

  useEffect(() => {
    if (open && tenant) {
      const nextForm = {
        email: String(tenant.email ?? ''),
        firstName: String(tenant.first_name ?? ''),
        lastName: String(tenant.last_name ?? ''),
        phone: String(tenant.phone ?? ''),
        landlord_id: String(tenant.landlord_id ?? ''),
        property_id: String(tenant.property_id ?? ''),
      };
      setForm(nextForm);
      setInitialForm(nextForm);
      setFieldErrors({});
      setSubmitState({ status: 'idle', detail: '' });
      setDiscardDialogOpen(false);
    }
  }, [open, tenant]);
  const hasUnsavedChanges = JSON.stringify(form) !== JSON.stringify(initialForm);
  const handleAttemptClose = () => {
    if (submitState.status === 'saving') return;
    if (hasUnsavedChanges) {
      setDiscardDialogOpen(true);
      return;
    }
    onClose();
  };

  const onChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const errors = {};
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = t('portalTenants.errors.emailInvalid');
    }
    if (!form.firstName.trim()) errors.firstName = t('portalTenants.errors.firstNameRequired');
    if (!form.lastName.trim()) errors.lastName = t('portalTenants.errors.lastNameRequired');
    if (isAdmin) {
      if (!form.landlord_id) errors.landlord_id = t('portalTenants.errors.landlordRequired');
      if (!form.property_id) errors.property_id = t('portalTenants.errors.propertyRequired');
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
      await updateTenant(baseUrl, accessToken, tenant.id, {
        emailHint,
        email: form.email.trim().toLowerCase(),
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        phone: form.phone.trim() || null,
        property_id: isAdmin ? form.property_id : undefined,
      });
      setSubmitState({ status: 'ok', detail: '' });
      onSaved();
    } catch (error) {
      const detail = tenantApiErrorMessage(error, t);
      setSubmitState({ status: 'error', detail });
    }
  };

  const sortedLandlords = useMemo(() => sortByLandlordLabel(landlords), [landlords]);
  const availableProperties = useMemo(() => {
    const rows = isAdmin
      ? properties.filter((p) => p.landlord_user_id === form.landlord_id || p.created_by === form.landlord_id)
      : properties;
    return sortByPropertyLabel(rows);
  }, [form.landlord_id, isAdmin, properties]);

  return (
    <Dialog open={open} onClose={handleAttemptClose} maxWidth="sm" fullWidth>
      <DialogTitleWithClose
        title={t('portalTenants.editTenantDialog.title')}
        onClose={handleAttemptClose}
        closeLabel={t('portalDialogs.closeForm')}
        disabled={submitState.status === 'saving'}
      />
      <Box component="form" onSubmit={onSubmit}>
        <DialogContent>
          <Stack spacing={2}>
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
            {isAdmin && (
              <>
                <Select
                  value={form.landlord_id}
                  onChange={(e) => {
                    const nextLandlordId = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      landlord_id: nextLandlordId,
                      property_id: '',
                    }));
                    setFieldErrors((prev) => ({
                      ...prev,
                      landlord_id: '',
                      property_id: '',
                    }));
                  }}
                  displayEmpty
                  fullWidth
                  error={Boolean(fieldErrors.landlord_id)}
                  size="small"
                >
                  <MenuItem value="" disabled>
                    {t('portalTenants.form.selectLandlord')}
                  </MenuItem>
                  {sortedLandlords.map((l) => (
                    <MenuItem key={l.id} value={l.id}>
                      {displayName(l)} — {l.email}
                    </MenuItem>
                  ))}
                </Select>
                {fieldErrors.landlord_id && (
                  <Typography variant="caption" color="error" sx={{ mt: '-8px !important' }}>
                    {fieldErrors.landlord_id}
                  </Typography>
                )}
                <Select
                  value={form.property_id}
                  onChange={onChange('property_id')}
                  displayEmpty
                  fullWidth
                  error={Boolean(fieldErrors.property_id)}
                  disabled={!form.landlord_id}
                  size="small"
                >
                  <MenuItem value="" disabled>
                    {t('portalTenants.form.selectProperty')}
                  </MenuItem>
                  {availableProperties.map((p) => (
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
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <InlineActionStatus message={submitStatusMessage} />
          <Button type="button" onClick={handleAttemptClose} disabled={submitState.status === 'saving'}>
            {t('portalTenants.actions.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={submitState.status === 'saving'}
          >
            {submitState.status === 'saving'
              ? t('portalTenants.actions.saving')
              : t('portalTenants.editTenantDialog.save')}
          </Button>
        </DialogActions>
      </Box>
      <PortalConfirmDialog
        open={discardDialogOpen}
        onClose={() => setDiscardDialogOpen(false)}
        onConfirm={() => {
          setDiscardDialogOpen(false);
          onClose();
        }}
        title={t('portalDialogs.unsavedChanges.title')}
        body={t('portalDialogs.unsavedChanges.body')}
        confirmLabel={t('portalDialogs.unsavedChanges.discard')}
        cancelLabel={t('portalDialogs.unsavedChanges.keepEditing')}
        confirmColor="warning"
      />
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// TenantRow — one tenant in the list with expandable lease detail
// ---------------------------------------------------------------------------

function TenantRow({
  tenant,
  properties,
  landlords,
  isAdmin,
  onToggleAccess,
  onDeleteTenant,
  onLeaseSaved,
  onTenantUpdated,
  t,
}) {
  const [expanded, setExpanded] = useState(false);
  const [leasesState, setLeasesState] = useState({ status: 'idle', leases: [] });
  const [addLeaseOpen, setAddLeaseOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [disableConfirmOpen, setDisableConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const { baseUrl, getAccessToken, account, meData } = usePortalAuth();
  const emailHint = meData?.user?.email ?? account?.username ?? '';
  const isActive = isActiveStatus(tenant.status);
  const sortedLeases = useMemo(
    () =>
      [...leasesState.leases].sort((a, b) => {
        const aStart = String(a?.start_date ?? '');
        const bStart = String(b?.start_date ?? '');
        const byStart = bStart.localeCompare(aStart);
        if (byStart !== 0) return byStart;
        return collator.compare(String(a?.id ?? ''), String(b?.id ?? ''));
      }),
    [leasesState.leases]
  );

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

  const handleLeaseUpdated = () => {
    void loadLeases();
    onLeaseSaved();
  };

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
          <Tooltip title={t('portalTenants.actions.editTenant')}>
            <IconButton
              type="button"
              size="small"
              onClick={() => setEditOpen(true)}
              aria-label={t('portalTenants.actions.editTenant')}
            >
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          {isActive ? (
            <Tooltip title={t('portalTenants.actions.disable')}>
              <IconButton
                type="button"
                size="small"
                color="warning"
                onClick={() => setDisableConfirmOpen(true)}
                aria-label={t('portalTenants.actions.disable')}
              >
                <Block fontSize="small" />
              </IconButton>
            </Tooltip>
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
          <Tooltip title={t('portalTenants.actions.deleteTenant')}>
            <IconButton
              type="button"
              size="small"
              color="error"
              onClick={() => setDeleteConfirmOpen(true)}
              aria-label={t('portalTenants.actions.deleteTenant')}
            >
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={expanded ? t('portalTenants.actions.collapse') : t('portalTenants.actions.expand')}>
            <IconButton
              size="small"
              onClick={handleExpand}
              aria-label={expanded ? t('portalTenants.actions.collapse') : t('portalTenants.actions.expand')}
            >
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
              <>
                <StatusAlertSlot
                  message={{ severity: 'error', text: t('portalTenants.errors.loadLeasesFailed') }}
                />
                <Button size="small" onClick={loadLeases}>{t('portalTenants.actions.retry')}</Button>
              </>
            )}
            {leasesState.status === 'ok' && leasesState.leases.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                {t('portalTenants.lease.empty')}
              </Typography>
            )}
            {sortedLeases.map((lease) => (
              <LeaseRow
                key={lease.id}
                lease={lease}
                properties={properties}
                onLeaseUpdated={handleLeaseUpdated}
                t={t}
              />
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
      <EditTenantDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          onTenantUpdated();
        }}
        tenant={tenant}
        properties={properties}
        landlords={landlords}
        isAdmin={isAdmin}
        t={t}
      />

      {/* Disable access confirmation */}
      <PortalConfirmDialog
        open={disableConfirmOpen}
        onClose={() => setDisableConfirmOpen(false)}
        onConfirm={() => { setDisableConfirmOpen(false); onToggleAccess(tenant.id, false); }}
        title={t('portalTenants.disableConfirm.title')}
        body={t('portalTenants.disableConfirm.body', { name: displayName(tenant) })}
        confirmLabel={t('portalTenants.actions.disable')}
        cancelLabel={t('portalTenants.actions.cancel')}
        confirmColor="warning"
      />

      {/* Delete tenant confirmation */}
      <PortalConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => { setDeleteConfirmOpen(false); onDeleteTenant(tenant.id); }}
        title={t('portalTenants.deleteTenantConfirm.title')}
        body={t('portalTenants.deleteTenantConfirm.body', { name: displayName(tenant) })}
        confirmLabel={t('portalTenants.deleteTenantConfirm.confirm')}
        cancelLabel={t('portalTenants.actions.cancel')}
        confirmColor="error"
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
  landlord_id: '',
  property_id: '',
  start_date: '',
  end_date: '',
  month_to_month: false,
  notes: '',
};

function OnboardTenantDialog({
  open,
  onClose,
  onSaved,
  properties,
  landlords,
  isAdmin,
  selectedLandlordId,
  onLandlordChange,
  t,
}) {
  const [form, setForm] = useState(EMPTY_ONBOARD_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitState, setSubmitState] = useState({ status: 'idle', detail: '' });
  const [initialForm, setInitialForm] = useState(EMPTY_ONBOARD_FORM);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const { baseUrl, getAccessToken, account, meData } = usePortalAuth();
  const emailHint = meData?.user?.email ?? account?.username ?? '';
  const submitStatusMessage = submitState.status === 'error'
    ? { severity: 'error', text: submitState.detail }
    : null;

  useEffect(() => {
    if (open) {
      const nextForm = {
        ...EMPTY_ONBOARD_FORM,
        landlord_id: isAdmin ? selectedLandlordId : '',
      };
      setForm(nextForm);
      setInitialForm(nextForm);
      setFieldErrors({});
      setSubmitState({ status: 'idle', detail: '' });
      setDiscardDialogOpen(false);
    }
  }, [open, isAdmin, selectedLandlordId]);
  const hasUnsavedChanges = JSON.stringify(form) !== JSON.stringify(initialForm);
  const handleAttemptClose = () => {
    if (submitState.status === 'saving') return;
    if (hasUnsavedChanges) {
      setDiscardDialogOpen(true);
      return;
    }
    onClose();
  };

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
    if (isAdmin && !form.landlord_id) errors.landlord_id = t('portalTenants.errors.landlordRequired');
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
        landlord_id: form.landlord_id || undefined,
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
      const detail = tenantApiErrorMessage(error, t);
      setSubmitState({ status: 'error', detail });
    }
  };

  const sortedLandlords = useMemo(() => sortByLandlordLabel(landlords), [landlords]);
  const availableProperties = useMemo(() => {
    const rows = isAdmin
      ? properties.filter((p) => p.landlord_user_id === form.landlord_id || p.created_by === form.landlord_id)
      : properties;
    return sortByPropertyLabel(rows);
  }, [form.landlord_id, isAdmin, properties]);

  return (
    <Dialog open={open} onClose={handleAttemptClose} maxWidth="sm" fullWidth>
      <DialogTitleWithClose
        title={t('portalTenants.onboardDialog.title')}
        onClose={handleAttemptClose}
        closeLabel={t('portalDialogs.closeForm')}
        disabled={submitState.status === 'saving'}
      />
      <Box component="form" onSubmit={onSubmit}>
        <DialogContent>
          <Stack spacing={2}>
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

            {isAdmin && (
              <>
                <Select
                  value={form.landlord_id}
                  onChange={(e) => {
                    const nextLandlordId = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      landlord_id: nextLandlordId,
                      property_id: '',
                    }));
                    setFieldErrors((prev) => ({
                      ...prev,
                      landlord_id: '',
                      property_id: '',
                    }));
                    if (typeof onLandlordChange === 'function') {
                      onLandlordChange(nextLandlordId);
                    }
                  }}
                  displayEmpty
                  fullWidth
                  error={Boolean(fieldErrors.landlord_id)}
                  size="small"
                >
                  <MenuItem value="" disabled>
                    {t('portalTenants.form.selectLandlord')}
                  </MenuItem>
                  {sortedLandlords.map((l) => (
                    <MenuItem key={l.id} value={l.id}>
                      {displayName(l)} — {l.email}
                    </MenuItem>
                  ))}
                </Select>
                {fieldErrors.landlord_id && (
                  <Typography variant="caption" color="error" sx={{ mt: '-8px !important' }}>
                    {fieldErrors.landlord_id}
                  </Typography>
                )}
              </>
            )}

            <Select
              value={form.property_id}
              onChange={onChange('property_id')}
              displayEmpty
              fullWidth
              error={Boolean(fieldErrors.property_id)}
              disabled={isAdmin && !form.landlord_id}
              size="small"
            >
              <MenuItem value="" disabled>
                {t('portalTenants.form.selectProperty')}
              </MenuItem>
              {availableProperties.map((p) => (
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
          <InlineActionStatus message={submitStatusMessage} />
          <Button type="button" onClick={handleAttemptClose} disabled={submitState.status === 'saving'}>
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
      <PortalConfirmDialog
        open={discardDialogOpen}
        onClose={() => setDiscardDialogOpen(false)}
        onConfirm={() => {
          setDiscardDialogOpen(false);
          onClose();
        }}
        title={t('portalDialogs.unsavedChanges.title')}
        body={t('portalDialogs.unsavedChanges.body')}
        confirmLabel={t('portalDialogs.unsavedChanges.discard')}
        cancelLabel={t('portalDialogs.unsavedChanges.keepEditing')}
        confirmColor="warning"
      />
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
  const { feedback, showFeedback, closeFeedback } = usePortalFeedback();
  const sortedLandlords = useMemo(() => sortByLandlordLabel(landlords), [landlords]);
  const sortedProperties = useMemo(() => sortByPropertyLabel(properties), [properties]);
  const sortedTenants = useMemo(() => sortByTenantLabel(tenantsState.tenants), [tenantsState.tenants]);

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

  // Load all properties visible to actor
  const loadProperties = useCallback(async () => {
    if (!canUseModule || !baseUrl) return;
    try {
      const accessToken = await getAccessToken();
      const payload = await fetchLandlordProperties(baseUrl, accessToken, { emailHint });
      const all = Array.isArray(payload?.properties) ? payload.properties : [];
      setProperties(all);
    } catch (e) {
      handleApiForbidden(e);
    }
  }, [baseUrl, canUseModule, getAccessToken, emailHint, handleApiForbidden]);

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
        tenants: normalizeTenantRows(payload?.tenants),
      });
    } catch (e) {
      handleApiForbidden(e);
      const detail = t('portalTenants.errors.loadFailed');
      setTenantsState({ status: 'error', tenants: [], detail });
    }
  }, [baseUrl, canUseModule, getAccessToken, emailHint, isAdmin, selectedLandlordId, handleApiForbidden, t]);

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
      setActionState({ status: 'error', detail: tenantApiErrorMessage(e, t) });
    }
  };

  const handleDeleteTenant = async (tenantId) => {
    if (!canUseModule) return;
    setActionState({ status: 'saving', detail: '' });
    try {
      const accessToken = await getAccessToken();
      await deleteTenant(baseUrl, accessToken, tenantId, { emailHint });
      setActionState({
        status: 'ok',
        detail: t('portalTenants.messages.tenantDeleted'),
      });
      void loadTenants();
    } catch (e) {
      handleApiForbidden(e);
      setActionState({ status: 'error', detail: tenantApiErrorMessage(e, t) });
    }
  };

  const handleTenantUpdated = () => {
    setActionState({ status: 'ok', detail: t('portalTenants.messages.tenantUpdated') });
    void loadTenants();
  };

  const handleOnboarded = () => {
    setOnboardOpen(false);
    setActionState({ status: 'ok', detail: t('portalTenants.messages.tenantOnboarded') });
    void loadTenants();
  };
  useEffect(() => {
    if (actionState.status !== 'ok' || !actionState.detail) return;
    showFeedback(actionState.detail, 'success');
    setActionState({ status: 'idle', detail: '' });
  }, [actionState, showFeedback]);

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
            disabled={!canUseModule}
          >
            {t('portalTenants.actions.onboardTenant')}
          </Button>
        </Stack>

        {/* Alerts */}
        {!baseUrl && (
          <StatusAlertSlot
            message={{ severity: 'warning', text: t('portalTenants.errors.apiUnavailable') }}
          />
        )}
        {accessDenied && (
          <StatusAlertSlot message={{ severity: 'error', text: t('portalTenants.errors.accessDenied') }} />
        )}
        <StatusAlertSlot
          message={actionState.status === 'error'
            ? { severity: 'error', text: actionState.detail }
            : null}
        />

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
                {sortedLandlords.map((l) => (
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
              <PortalRefreshButton
                label={t('portalTenants.actions.refresh')}
                onClick={() => void loadTenants()}
                disabled={!canUseModule}
                loading={tenantsState.status === 'loading'}
              />
            </Stack>

            {tenantsState.status === 'loading' && tenantsState.tenants.length === 0 && (
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', py: 1 }}>
                <CircularProgress size={18} />
                <Typography variant="body2" color="text.secondary">
                  {t('portalTenants.list.loading')}
                </Typography>
              </Stack>
            )}
            <StatusAlertSlot
              message={tenantsState.status === 'error'
                ? { severity: 'error', text: tenantsState.detail ?? t('portalTenants.errors.loadFailed') }
                : null}
            />
            {tenantsState.status === 'ok' && tenantsState.tenants.length === 0 && (
              <Typography color="text.secondary">{t('portalTenants.list.empty')}</Typography>
            )}
            {sortedTenants.map((tenant, index) => (
              <TenantRow
                key={tenantRowKey(tenant, index)}
                tenant={tenant}
                properties={sortedProperties}
                landlords={sortedLandlords}
                isAdmin={isAdmin}
                onToggleAccess={handleToggleAccess}
                onDeleteTenant={handleDeleteTenant}
                onLeaseSaved={loadTenants}
                onTenantUpdated={handleTenantUpdated}
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
        properties={sortedProperties}
        landlords={sortedLandlords}
        isAdmin={isAdmin}
        selectedLandlordId={selectedLandlordId}
        onLandlordChange={setSelectedLandlordId}
        t={t}
      />
      <PortalFeedbackSnackbar feedback={feedback} onClose={closeFeedback} />
    </Box>
  );
};

export default PortalTenants;
