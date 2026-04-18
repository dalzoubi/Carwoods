import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Checkbox,
  Chip,
  Collapse,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
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
import ExitToApp from '@mui/icons-material/ExitToApp';
import Gavel from '@mui/icons-material/Gavel';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ContactPage from '@mui/icons-material/ContactPage';
import PersonAdd from '@mui/icons-material/PersonAdd';
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
  linkTenantToLease,
  unlinkTenantFromLease,
  updateLease,
  deleteLease,
  moveOutLease,
  terminateLease,
  fetchLandlords,
  fetchLandlordProperties,
  fetchLandlordLeases,
  fetchTenant,
} from '../lib/portalApiClient';
import MailtoEmailLink from './MailtoEmailLink';
import PortalConfirmDialog from './PortalConfirmDialog';
import PortalUserAvatar from './PortalUserAvatar';
import PortalPersonWithAvatar from './PortalPersonWithAvatar';
import InlineActionStatus from './InlineActionStatus';
import StatusAlertSlot from './StatusAlertSlot';
import { usePortalFeedback } from '../hooks/usePortalFeedback';
import PortalFeedbackSnackbar from './PortalFeedbackSnackbar';
import PortalRefreshButton from './PortalRefreshButton';
import { buildVCard3, downloadVCard, slugifyVCardFilenameBase, VCARD_ORG_NAME } from '../lib/exportContactCard';
import EmptyState from './EmptyState';
import PeopleOutline from '@mui/icons-material/PeopleOutline';

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

/** Order tenants so everyone at the same property appears in one contiguous block (then by name within the block). */
function groupTenantsByProperty(rows) {
  const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
  const byPid = new Map();
  for (const row of list) {
    const pid = typeof row.property_id === 'string' ? row.property_id.trim() : '';
    const key = pid || '__none__';
    if (!byPid.has(key)) byPid.set(key, []);
    byPid.get(key).push(row);
  }
  const keys = [...byPid.keys()].sort((a, b) => {
    const sampleA = byPid.get(a)[0];
    const sampleB = byPid.get(b)[0];
    const cmp = collator.compare(propertyLabel(sampleA), propertyLabel(sampleB));
    if (cmp !== 0) return cmp;
    return collator.compare(a, b);
  });
  const out = [];
  for (const key of keys) {
    out.push(...sortByTenantLabel(byPid.get(key)));
  }
  return out;
}

function tenantPropertyGroupKey(tenant) {
  return typeof tenant?.property_id === 'string' ? tenant.property_id.trim() : '';
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
    <DialogTitle
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
        py: 1.25,
        pr: 1,
      }}
    >
      <Typography component="span" variant="subtitle1">{title}</Typography>
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

/** Calendar occupancy phase for lease row UI (start/end vs today), independent of API `is_active`. */
function getLeaseDisplayPhase(lease) {
  const today = new Date().toISOString().slice(0, 10);
  const start = lease?.start_date ? toDatePart(lease.start_date) : '';
  if (!start) return 'active';
  if (start > today) return 'future';
  const m2m = Boolean(lease.month_to_month);
  const endRaw = lease.end_date != null ? toDatePart(lease.end_date) : '';
  if (m2m || !endRaw) return 'active';
  if (endRaw < today) return 'expired';
  return 'active';
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
    case 'lease_dates_overlap':
      return t('portalTenants.errors.leaseDatesOverlap');
    case 'property_lease_occupancy_conflict':
      return t('portalTenants.errors.propertyLeaseOccupancyConflict');
    case 'property_lease_overlap':
      return t('portalTenants.errors.propertyLeaseOverlap');
    case 'user_not_found':
      return t('portalTenants.errors.userNotFound');
    case 'not_found':
      return t('portalTenants.errors.userNotFound');
    case 'forbidden':
      return t('portalTenants.errors.accessDenied');
    case 'co_tenant_not_on_shared_lease':
      return t('portalTenants.errors.coTenantNotOnSharedLease');
    case 'cannot_remove_last_leaseholder':
      return t('portalTenants.errors.cannotRemoveLastLeaseholder');
    case 'lease_tenant_not_linked':
      return t('portalTenants.errors.leaseTenantNotLinked');
    case 'no_leases_under_landlord':
      return t('portalTenants.errors.noLeasesUnderLandlord');
    case 'invalid_rent_amount':
      return t('portalTenants.errors.invalidRentAmount');
    case 'landlord_id_required':
      return t('portalTenants.errors.landlordIdRequiredDelete');
    default:
      return t('portalTenants.errors.saveFailed');
  }
}

function parseLeaseTenantUserIds(raw) {
  if (raw == null || raw === '') return [];
  const s = typeof raw === 'string' ? raw : String(raw);
  return s.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
}

/** Matches API `findActiveOccupancyLeaseForProperty` — current ACTIVE occupancy at an address. */
function pickActiveOccupancyLease(leases) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = Array.isArray(leases) ? leases : [];
  const candidates = rows.filter((l) => {
    const st = String(l.status ?? '').toUpperCase();
    if (st !== 'ACTIVE') return false;
    if (l.month_to_month) return true;
    const endRaw = l.end_date != null ? toDatePart(l.end_date) : '';
    if (!endRaw) return true;
    return endRaw >= today;
  });
  candidates.sort((a, b) => String(b.start_date ?? '').localeCompare(String(a.start_date ?? '')));
  return candidates[0] ?? null;
}

/** Other tenant user IDs on the same lease as `tenantId` at `propertyId` (from GET tenant leases payload). */
function findPeerCoTenantIdsAtProperty(tenantLeases, tenantId, propertyId) {
  const pid = typeof propertyId === 'string' ? propertyId.trim() : '';
  const tid = typeof tenantId === 'string' ? tenantId.trim().toLowerCase() : '';
  if (!pid || !tid || !Array.isArray(tenantLeases)) return [];
  const here = tenantLeases.filter((l) => String(l?.property_id ?? '').trim() === pid);
  if (here.length === 0) return [];
  const score = (l) => {
    const phase = getLeaseDisplayPhase(l);
    const st = String(l?.status ?? '').toUpperCase();
    if (phase === 'active') return 2;
    if (st === 'ACTIVE') return 1;
    return 0;
  };
  here.sort((a, b) => {
    const ds = score(b) - score(a);
    if (ds !== 0) return ds;
    return String(b?.start_date ?? '').localeCompare(String(a?.start_date ?? ''));
  });
  const chosen = here[0];
  const ids = parseLeaseTenantUserIds(chosen?.tenant_user_ids);
  return ids.filter((id) => id !== tid);
}

/** @param {number|string|null|undefined} amount */
function formatLeaseRentUsd(amount) {
  if (amount == null || amount === '') return null;
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n);
}

function parseOptionalMonthlyRentInput(raw) {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (s === '') return { ok: true, value: null };
  const n = Number(s.replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0 || n > 999999999.99) return { ok: false };
  return { ok: true, value: Math.round(n * 100) / 100 };
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
    rent_amount: '',
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
        rent_amount:
          lease.rent_amount != null && lease.rent_amount !== ''
            ? String(lease.rent_amount)
            : '',
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
    const rentParsed = parseOptionalMonthlyRentInput(form.rent_amount);
    if (!rentParsed.ok) errors.rent_amount = t('portalTenants.errors.invalidRentAmount');
    return errors;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    const rentParsed = parseOptionalMonthlyRentInput(form.rent_amount);
    setSubmitState({ status: 'saving', detail: '' });
    try {
      const accessToken = await getAccessToken();
      await updateLease(baseUrl, accessToken, lease.id, {
        emailHint,
        start_date: form.start_date,
        end_date: form.month_to_month ? null : (form.end_date || null),
        month_to_month: form.month_to_month,
        notes: form.notes || null,
        rent_amount: rentParsed.ok ? rentParsed.value : null,
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
        <DialogContent sx={{ py: 1.25, px: 3 }}>
          <Stack spacing={1.25}>
            <FormControl fullWidth size="small" disabled>
              <InputLabel shrink>{t('portalTenants.form.selectProperty')}</InputLabel>
              <Select
                value={form.property_id}
                onChange={onChange('property_id')}
                label={t('portalTenants.form.selectProperty')}
                displayEmpty
                notched
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
            </FormControl>
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
              margin="dense"
            />
            <FormControlLabel
              sx={{ my: 0, py: 0 }}
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
                margin="dense"
              />
            )}
            <TextField
              label={t('portalTenants.form.rentAmount')}
              value={form.rent_amount}
              onChange={onChange('rent_amount')}
              placeholder={t('portalTenants.form.rentAmountPlaceholder')}
              fullWidth
              error={Boolean(fieldErrors.rent_amount)}
              helperText={fieldErrors.rent_amount || t('portalTenants.form.rentAmountHelper')}
              size="small"
              margin="dense"
              inputProps={{ inputMode: 'decimal' }}
            />
            <TextField
              label={t('portalTenants.form.notes')}
              value={form.notes}
              onChange={onChange('notes')}
              multiline
              minRows={1}
              maxRows={5}
              fullWidth
              size="small"
              margin="dense"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1 }}>
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
// LinkCoTenantDialog — attach another existing tenant user to this lease
// ---------------------------------------------------------------------------

function LinkCoTenantDialog({
  open,
  onClose,
  lease,
  directoryTenants,
  onLinked,
  t,
}) {
  const [selectedId, setSelectedId] = useState('');
  const [submitState, setSubmitState] = useState({ status: 'idle', detail: '' });
  const { baseUrl, getAccessToken, account, meData } = usePortalAuth();
  const emailHint = meData?.user?.email ?? account?.username ?? '';

  const onLeaseIds = useMemo(
    () => new Set(parseLeaseTenantUserIds(lease?.tenant_user_ids)),
    [lease?.tenant_user_ids],
  );

  const candidates = useMemo(() => {
    const rows = Array.isArray(directoryTenants) ? directoryTenants : [];
    return sortByTenantLabel(
      rows.filter((row) => row?.id && !onLeaseIds.has(String(row.id).trim().toLowerCase())),
    );
  }, [directoryTenants, onLeaseIds]);

  useEffect(() => {
    if (open) {
      setSelectedId('');
      setSubmitState({ status: 'idle', detail: '' });
    }
  }, [open]);

  const submitStatusMessage = submitState.status === 'error'
    ? { severity: 'error', text: submitState.detail }
    : null;

  const handleClose = () => {
    if (submitState.status === 'saving') return;
    onClose();
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!selectedId) {
      setSubmitState({ status: 'error', detail: t('portalTenants.linkCoTenantDialog.noSelection') });
      return;
    }
    setSubmitState({ status: 'saving', detail: '' });
    try {
      const accessToken = await getAccessToken();
      await linkTenantToLease(baseUrl, accessToken, lease.id, {
        emailHint,
        userId: selectedId,
      });
      setSubmitState({ status: 'ok', detail: '' });
      onLinked();
      onClose();
    } catch (error) {
      setSubmitState({ status: 'error', detail: tenantApiErrorMessage(error, t) });
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitleWithClose
        title={t('portalTenants.linkCoTenantDialog.title')}
        onClose={handleClose}
        closeLabel={t('portalDialogs.closeForm')}
        disabled={submitState.status === 'saving'}
      />
      <Box component="form" onSubmit={onSubmit}>
        <DialogContent sx={{ py: 1.25, px: 3 }}>
          <Stack spacing={1.25}>
            <Typography variant="body2" color="text.secondary">
              {propertyLabel(lease)}
            </Typography>
            <FormControl fullWidth size="small" disabled={candidates.length === 0}>
              <InputLabel>{t('portalTenants.linkCoTenantDialog.selectTenant')}</InputLabel>
              <Select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                label={t('portalTenants.linkCoTenantDialog.selectTenant')}
                displayEmpty
              >
                <MenuItem value="">
                  <em>{t('portalTenants.linkCoTenantDialog.selectTenant')}</em>
                </MenuItem>
                {candidates.map((row) => (
                  <MenuItem key={row.id} value={row.id}>
                    {`${displayName(row)} (${String(row.email ?? '').trim()})`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {candidates.length === 0 && (
              <Typography variant="caption" color="text.secondary">
                {t('portalTenants.linkCoTenantDialog.emptyCandidates')}
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1 }}>
          <InlineActionStatus message={submitStatusMessage} />
          <Button type="button" onClick={handleClose} disabled={submitState.status === 'saving'}>
            {t('portalTenants.actions.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={submitState.status === 'saving' || candidates.length === 0}
          >
            {submitState.status === 'saving'
              ? t('portalTenants.actions.saving')
              : t('portalTenants.linkCoTenantDialog.save')}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// LeaseRow — shows one lease in the detail panel
// ---------------------------------------------------------------------------

function LeaseRow({ lease, properties, directoryTenants, onLeaseUpdated, t }) {
  const phase = getLeaseDisplayPhase(lease);
  const isCalendarActive = phase === 'active';
  const leaseChip =
    phase === 'future'
      ? { label: t('portalTenants.lease.future'), color: 'info', variant: 'outlined' }
      : phase === 'expired'
        ? { label: t('portalTenants.lease.expired'), color: 'default', variant: 'outlined' }
        : { label: t('portalTenants.lease.active'), color: 'success', variant: 'filled' };
  const dateRange = lease.month_to_month
    ? `${formatDate(lease.start_date)} — Month-to-month`
    : lease.end_date
      ? `${formatDate(lease.start_date)} – ${formatDate(lease.end_date)}`
      : `${formatDate(lease.start_date)} — no end date`;

  const [editOpen, setEditOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [unlinkConfirm, setUnlinkConfirm] = useState(null);
  const [unlinkState, setUnlinkState] = useState({ status: 'idle', detail: '' });
  const [deleteState, setDeleteState] = useState({ status: 'idle', detail: '' });
  const [moveOutOpen, setMoveOutOpen] = useState(false);
  const [terminateOpen, setTerminateOpen] = useState(false);
  const { baseUrl, getAccessToken, account, meData } = usePortalAuth();
  const emailHint = meData?.user?.email ?? account?.username ?? '';

  const leaseholderIds = useMemo(
    () => parseLeaseTenantUserIds(lease.tenant_user_ids),
    [lease.tenant_user_ids],
  );

  const tenantDirectoryById = useMemo(() => {
    const m = new Map();
    (directoryTenants ?? []).forEach((row) => {
      if (row?.id) m.set(String(row.id).trim().toLowerCase(), row);
    });
    return m;
  }, [directoryTenants]);

  const linkCandidatesCount = useMemo(() => {
    const onLease = new Set(leaseholderIds);
    let n = 0;
    (directoryTenants ?? []).forEach((row) => {
      const id = row?.id ? String(row.id).trim().toLowerCase() : '';
      if (id && !onLease.has(id)) n += 1;
    });
    return n;
  }, [directoryTenants, leaseholderIds]);

  const canRemoveLeaseholders = leaseholderIds.length > 1;

  const handleUnlinkConfirm = async () => {
    if (!unlinkConfirm?.userId) return;
    setUnlinkState({ status: 'saving', detail: '' });
    try {
      const accessToken = await getAccessToken();
      await unlinkTenantFromLease(baseUrl, accessToken, lease.id, unlinkConfirm.userId, { emailHint });
      setUnlinkConfirm(null);
      setUnlinkState({ status: 'idle', detail: '' });
      onLeaseUpdated();
    } catch (error) {
      setUnlinkState({ status: 'error', detail: tenantApiErrorMessage(error, t) });
    }
  };

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
        backgroundColor: isCalendarActive ? 'action.hover' : 'background.default',
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
          {formatLeaseRentUsd(lease.rent_amount) != null && (
            <Typography variant="body2" color="text.secondary">
              {t('portalTenants.lease.monthlyRentLabel', { amount: formatLeaseRentUsd(lease.rent_amount) })}
            </Typography>
          )}
          {lease.notes && (
            <Typography variant="caption" color="text.secondary">
              {lease.notes}
            </Typography>
          )}
          {leaseholderIds.length > 0 && (
            <Box sx={{ mt: 0.75 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                {t('portalTenants.lease.coTenantsLabel')}
              </Typography>
              <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                {leaseholderIds.map((uid) => {
                  const row = tenantDirectoryById.get(uid);
                  const label = row ? displayName(row) : uid.slice(0, 8);
                  return (
                    <Chip
                      key={uid}
                      label={label}
                      size="small"
                      variant="outlined"
                      onDelete={
                        canRemoveLeaseholders
                          ? () => setUnlinkConfirm({ userId: uid, label })
                          : undefined
                      }
                      aria-label={`${t('portalTenants.actions.removeLeaseholder')}: ${label}`}
                    />
                  );
                })}
              </Stack>
            </Box>
          )}
          {(deleteState.status === 'error' || unlinkState.status === 'error') && (
            <Typography variant="caption" color="error">
              {unlinkState.detail || deleteState.detail}
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexShrink: 0 }}>
          <Chip
            label={leaseChip.label}
            size="small"
            color={leaseChip.color}
            variant={leaseChip.variant}
          />
          <Tooltip
            title={
              linkCandidatesCount === 0
                ? t('portalTenants.linkCoTenantDialog.emptyCandidates')
                : t('portalTenants.actions.linkCoTenant')
            }
          >
            <span>
              <IconButton
                type="button"
                size="small"
                color="secondary"
                onClick={() => setLinkOpen(true)}
                disabled={linkCandidatesCount === 0}
                aria-label={t('portalTenants.actions.linkCoTenant')}
              >
                <PersonAdd fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t('portalTenants.actions.editLease')}>
            <IconButton
              type="button"
              size="small"
              color="primary"
              onClick={() => setEditOpen(true)}
              aria-label={t('portalTenants.actions.editLease')}
            >
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('portalTenants.actions.moveOutLease')}>
            <IconButton
              type="button"
              size="small"
              color="warning"
              onClick={() => setMoveOutOpen(true)}
              aria-label={t('portalTenants.actions.moveOutLease')}
            >
              <ExitToApp fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('portalTenants.actions.terminateLease')}>
            <IconButton
              type="button"
              size="small"
              color="error"
              onClick={() => setTerminateOpen(true)}
              aria-label={t('portalTenants.actions.terminateLease')}
            >
              <Gavel fontSize="small" />
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

      <LinkCoTenantDialog
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        lease={lease}
        directoryTenants={directoryTenants}
        onLinked={onLeaseUpdated}
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

      <MoveOutLeaseDialog
        open={moveOutOpen}
        onClose={() => setMoveOutOpen(false)}
        lease={lease}
        baseUrl={baseUrl}
        getAccessToken={getAccessToken}
        emailHint={emailHint}
        onDone={() => { setMoveOutOpen(false); onLeaseUpdated(); }}
        t={t}
      />

      <TerminateLeaseDialog
        open={terminateOpen}
        onClose={() => setTerminateOpen(false)}
        lease={lease}
        baseUrl={baseUrl}
        getAccessToken={getAccessToken}
        emailHint={emailHint}
        onDone={() => { setTerminateOpen(false); onLeaseUpdated(); }}
        t={t}
      />

      <PortalConfirmDialog
        open={unlinkConfirm != null}
        onClose={() => {
          setUnlinkConfirm(null);
          setUnlinkState({ status: 'idle', detail: '' });
        }}
        onConfirm={handleUnlinkConfirm}
        title={t('portalTenants.removeLeaseholderConfirm.title')}
        body={
          unlinkConfirm
            ? t('portalTenants.removeLeaseholderConfirm.body', { name: unlinkConfirm.label })
            : ''
        }
        confirmLabel={t('portalTenants.removeLeaseholderConfirm.confirm')}
        cancelLabel={t('portalTenants.actions.cancel')}
        loading={unlinkState.status === 'saving'}
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
  rent_amount: '',
};

function AddLeaseDialog({
  open,
  onClose,
  onSaved,
  tenantId,
  properties,
  fixedPropertyId,
  tenantName,
  propertyAddressText,
  tenantLeases,
  directoryTenants,
  t,
}) {
  const [form, setForm] = useState(EMPTY_LEASE_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitState, setSubmitState] = useState({ status: 'idle', detail: '' });
  const [initialForm, setInitialForm] = useState(EMPTY_LEASE_FORM);
  const [linkPeersToNewLease, setLinkPeersToNewLease] = useState(false);
  const [initialLinkPeers, setInitialLinkPeers] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const wasOpenRef = useRef(false);
  const { baseUrl, getAccessToken, account, meData } = usePortalAuth();
  const emailHint = meData?.user?.email ?? account?.username ?? '';
  const submitStatusMessage = submitState.status === 'error'
    ? { severity: 'error', text: submitState.detail }
    : null;

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const raw = typeof fixedPropertyId === 'string' ? fixedPropertyId.trim() : '';
      const allowed = new Set((properties ?? []).map((p) => p?.id).filter(Boolean));
      const property_id = raw && allowed.has(raw) ? raw : '';
      const next = { ...EMPTY_LEASE_FORM, property_id };
      setForm(next);
      setInitialForm(next);
      setFieldErrors({});
      setSubmitState({ status: 'idle', detail: '' });
      setDiscardDialogOpen(false);
      setLinkPeersToNewLease(false);
      setInitialLinkPeers(false);
    }
    wasOpenRef.current = open;
  }, [open, fixedPropertyId, properties]);
  const peerCoTenantIds = useMemo(
    () => findPeerCoTenantIdsAtProperty(tenantLeases, tenantId, form.property_id),
    [tenantLeases, tenantId, form.property_id],
  );
  const peerDirectoryById = useMemo(() => {
    const m = new Map();
    (directoryTenants ?? []).forEach((row) => {
      if (row?.id) m.set(String(row.id).trim().toLowerCase(), row);
    });
    return m;
  }, [directoryTenants]);
  const hasUnsavedChanges =
    JSON.stringify(form) !== JSON.stringify(initialForm) || linkPeersToNewLease !== initialLinkPeers;
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
    if (!form.property_id) errors.property_id = t('portalTenants.addLeaseDialog.cannotResolveProperty');
    if (!form.start_date) errors.start_date = t('portalTenants.errors.startDateRequired');
    if (!form.month_to_month && form.end_date && form.end_date <= form.start_date) {
      errors.end_date = t('portalTenants.errors.endDateBeforeStart');
    }
    const rentParsed = parseOptionalMonthlyRentInput(form.rent_amount);
    if (!rentParsed.ok) errors.rent_amount = t('portalTenants.errors.invalidRentAmount');
    return errors;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    const rentParsed = parseOptionalMonthlyRentInput(form.rent_amount);
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
        rent_amount: rentParsed.ok ? rentParsed.value : null,
        ...(linkPeersToNewLease && peerCoTenantIds.length > 0
          ? { link_co_tenant_user_ids: peerCoTenantIds }
          : {}),
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
        <DialogContent sx={{ py: 1.25, px: 3 }}>
          <Stack spacing={1.25}>
            <TextField
              label={t('portalTenants.addLeaseDialog.readOnlyTenant')}
              value={tenantName}
              fullWidth
              size="small"
              margin="dense"
              InputProps={{ readOnly: true }}
            />
            <TextField
              label={t('portalTenants.addLeaseDialog.readOnlyProperty')}
              value={propertyAddressText || '—'}
              fullWidth
              size="small"
              margin="dense"
              InputProps={{ readOnly: true }}
            />
            {Boolean(fieldErrors.property_id) && (
              <Alert severity="warning">{fieldErrors.property_id}</Alert>
            )}
            {peerCoTenantIds.length > 0 && (
              <Stack spacing={0.75}>
                <Typography variant="caption" color="text.secondary">
                  {t('portalTenants.addLeaseDialog.coTenantsOnLeaseHint')}
                </Typography>
                <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                  {peerCoTenantIds.map((uid) => {
                    const row = peerDirectoryById.get(uid);
                    const label = row ? displayName(row) : uid.slice(0, 8);
                    return <Chip key={uid} label={label} size="small" variant="outlined" />;
                  })}
                </Stack>
                <FormControlLabel
                  sx={{ my: 0, alignItems: 'flex-start' }}
                  control={
                    <Checkbox
                      checked={linkPeersToNewLease}
                      onChange={(e) => setLinkPeersToNewLease(e.target.checked)}
                      size="small"
                    />
                  }
                  label={t('portalTenants.addLeaseDialog.linkPeersCheckbox')}
                />
              </Stack>
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
              margin="dense"
            />
            <FormControlLabel
              sx={{ my: 0, py: 0 }}
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
                margin="dense"
              />
            )}
            <TextField
              label={t('portalTenants.form.rentAmount')}
              value={form.rent_amount}
              onChange={onChange('rent_amount')}
              placeholder={t('portalTenants.form.rentAmountPlaceholder')}
              fullWidth
              error={Boolean(fieldErrors.rent_amount)}
              helperText={fieldErrors.rent_amount || t('portalTenants.form.rentAmountHelper')}
              size="small"
              margin="dense"
              inputProps={{ inputMode: 'decimal' }}
            />
            <TextField
              label={t('portalTenants.form.notes')}
              value={form.notes}
              onChange={onChange('notes')}
              multiline
              minRows={1}
              maxRows={5}
              fullWidth
              size="small"
              margin="dense"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1 }}>
          <InlineActionStatus message={submitStatusMessage} />
          <Button type="button" onClick={handleAttemptClose} disabled={submitState.status === 'saving'}>
            {t('portalTenants.actions.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={submitState.status === 'saving' || !form.property_id}
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
        <DialogContent sx={{ py: 1.25, px: 3 }}>
          <Stack spacing={1.25}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                label={t('portalTenants.form.firstName')}
                value={form.firstName}
                onChange={onChange('firstName')}
                required
                fullWidth
                error={Boolean(fieldErrors.firstName)}
                helperText={fieldErrors.firstName || ' '}
                size="small"
                margin="dense"
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
                margin="dense"
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
              margin="dense"
              autoComplete="email"
            />
            <TextField
              label={t('portalTenants.form.phone')}
              value={form.phone}
              onChange={onChange('phone')}
              fullWidth
              size="small"
              margin="dense"
              autoComplete="tel"
            />
            {isAdmin
              && Boolean(initialForm.landlord_id)
              && Boolean(form.landlord_id)
              && initialForm.landlord_id !== form.landlord_id && (
              <Alert severity="warning" sx={{ py: 0.5 }}>
                {t('portalTenants.editTenantDialog.moveLandlordWarning')}
              </Alert>
            )}
            {isAdmin && (
              <>
                <TextField
                  select
                  label={t('portalTenants.form.landlord')}
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
                  required
                  fullWidth
                  size="small"
                  margin="dense"
                  error={Boolean(fieldErrors.landlord_id)}
                  helperText={fieldErrors.landlord_id || ' '}
                >
                  <MenuItem value="" disabled>
                    {t('portalTenants.form.selectLandlord')}
                  </MenuItem>
                  {sortedLandlords.map((l) => (
                    <MenuItem key={l.id} value={l.id}>
                      <PortalPersonWithAvatar
                        photoUrl={String(l.profile_photo_url ?? '').trim()}
                        firstName={l.first_name ?? ''}
                        lastName={l.last_name ?? ''}
                        size={28}
                        alignItems="center"
                      >
                        <Typography variant="body2" component="span">
                          {displayName(l)}
                          {' — '}
                          <MailtoEmailLink email={l.email} color="inherit" noLink sx={{ color: 'inherit' }} />
                        </Typography>
                      </PortalPersonWithAvatar>
                    </MenuItem>
                  ))}
                </TextField>
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
        <DialogActions sx={{ px: 2, py: 1 }}>
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
  allTenants,
  onToggleAccess,
  onDeleteTenant,
  onLeaseSaved,
  leaseDetailRefreshEpoch,
  onTenantUpdated,
  onExportError,
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

  const handleExportContactCard = useCallback(() => {
    const first = String(tenant.first_name ?? '').trim();
    const last = String(tenant.last_name ?? '').trim();
    const email = String(tenant.email ?? '').trim();
    const street = String(tenant.property_street ?? '').trim();
    const city = String(tenant.property_city ?? '').trim();
    const state = String(tenant.property_state ?? '').trim();
    const zip = String(tenant.property_zip ?? '').trim();
    const adr =
      street || city || state || zip
        ? { street, locality: city, region: state, postalCode: zip }
        : null;
    const vcard = buildVCard3({
      firstName: first,
      lastName: last,
      email: tenant.email,
      phone: tenant.phone,
      adr,
      org: VCARD_ORG_NAME,
      title: t('portalTenants.vCard.roleTitle'),
    });
    const ok = downloadVCard(slugifyVCardFilenameBase(first, last, email), vcard);
    if (!ok && typeof onExportError === 'function') {
      onExportError();
    }
  }, [tenant, t, onExportError]);

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

  /** Property to pre-select in Add Lease: same order as lease list (most recent start first). */
  const defaultPropertyIdForAddLease = useMemo(() => {
    const ids = new Set((properties ?? []).map((p) => p?.id).filter(Boolean));
    const valid = (id) => {
      const s = typeof id === 'string' ? id.trim() : '';
      return s && ids.has(s) ? s : '';
    };
    if (leasesState.status === 'ok' && sortedLeases.length > 0) {
      const fromLease = valid(sortedLeases[0].property_id);
      if (fromLease) return fromLease;
    }
    return valid(tenant.property_id);
  }, [leasesState.status, sortedLeases, tenant.property_id, properties]);

  const addLeasePropertyAddressText = useMemo(() => {
    const pid = defaultPropertyIdForAddLease;
    if (!pid) return '';
    const match = (properties ?? []).find((p) => p.id === pid);
    if (match) return propertyLabel(match);
    const fromTenant = propertyLabel(tenant);
    return fromTenant !== '—' ? fromTenant : '';
  }, [defaultPropertyIdForAddLease, properties, tenant]);

  const loadLeases = useCallback(async () => {
    if (!baseUrl) return;
    setLeasesState({ status: 'loading', leases: [] });
    try {
      const accessToken = await getAccessToken();
      const data = await fetchTenant(baseUrl, accessToken, tenant.id, { emailHint });
      setLeasesState({ status: 'ok', leases: Array.isArray(data.leases) ? data.leases : [] });
    } catch (e) {
      setLeasesState({ status: 'error', leases: [] });
    }
  }, [baseUrl, getAccessToken, emailHint, tenant.id]);

  const expandedRef = useRef(false);
  expandedRef.current = expanded;

  useEffect(() => {
    if (!expandedRef.current) {
      setLeasesState({ status: 'idle', leases: [] });
      return;
    }
    void loadLeases();
  }, [leaseDetailRefreshEpoch, loadLeases]);

  const handleExpand = () => {
    if (!expanded && leasesState.status === 'idle') {
      void loadLeases();
    }
    setExpanded((prev) => !prev);
  };

  const handleLeaseSaved = () => {
    setAddLeaseOpen(false);
    onLeaseSaved();
  };

  const handleLeaseUpdated = () => {
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
        <Stack direction="row" spacing={1.5} sx={{ flex: 1, minWidth: 0, alignItems: 'flex-start' }}>
          <PortalUserAvatar
            photoUrl={String(tenant.profile_photo_url ?? '').trim()}
            firstName={tenant.first_name ?? ''}
            lastName={tenant.last_name ?? ''}
            size={44}
            sx={{ flexShrink: 0, mt: 0.125 }}
          />
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
              <MailtoEmailLink email={tenant.email} color="inherit" sx={{ color: 'inherit' }} />
            </Typography>
            {tenant.property_street && (
              <Typography variant="caption" color="text.secondary">
                {propertyLabel(tenant)}
              </Typography>
            )}
          </Box>
        </Stack>

        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexShrink: 0 }}>
          <Tooltip title={t('portalTenants.actions.editTenant')}>
            <IconButton
              type="button"
              size="small"
              color="primary"
              onClick={() => setEditOpen(true)}
              aria-label={t('portalTenants.actions.editTenant')}
            >
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('portalTenants.actions.exportContactCard')}>
            <IconButton
              type="button"
              size="small"
              color="info"
              onClick={handleExportContactCard}
              aria-label={t('portalTenants.actions.exportContactCard')}
            >
              <ContactPage fontSize="small" />
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
              color="success"
              onClick={() => onToggleAccess(tenant.id, true, tenant.landlord_id)}
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
              type="button"
              size="small"
              color="secondary"
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
              {defaultPropertyIdForAddLease ? (
                <Button
                  type="button"
                  size="small"
                  startIcon={<Add />}
                  onClick={() => setAddLeaseOpen(true)}
                >
                  {t('portalTenants.actions.addLease')}
                </Button>
              ) : (
                <Tooltip title={t('portalTenants.addLeaseDialog.addLeaseNeedsPropertyHint')}>
                  <span>
                    <Button type="button" size="small" startIcon={<Add />} disabled>
                      {t('portalTenants.actions.addLease')}
                    </Button>
                  </span>
                </Tooltip>
              )}
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
                directoryTenants={allTenants}
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
        fixedPropertyId={defaultPropertyIdForAddLease}
        tenantName={displayName(tenant)}
        propertyAddressText={addLeasePropertyAddressText}
        tenantLeases={leasesState.status === 'ok' ? leasesState.leases : []}
        directoryTenants={allTenants}
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
        onConfirm={() => {
          setDisableConfirmOpen(false);
          onToggleAccess(tenant.id, false, tenant.landlord_id);
        }}
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
        onConfirm={() => {
          setDeleteConfirmOpen(false);
          onDeleteTenant(tenant.id, tenant.landlord_id);
        }}
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
  rent_amount: '',
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

  const [occupancyLease, setOccupancyLease] = useState(null);
  const [occupancyLeaseLoading, setOccupancyLeaseLoading] = useState(false);

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
      setOccupancyLease(null);
      setOccupancyLeaseLoading(false);
    }
  }, [open, isAdmin, selectedLandlordId]);

  useEffect(() => {
    const pid = typeof form.property_id === 'string' ? form.property_id.trim() : '';
    if (!open || !pid || !baseUrl) {
      setOccupancyLease(null);
      setOccupancyLeaseLoading(false);
      return;
    }
    let cancelled = false;
    setOccupancyLeaseLoading(true);
    setOccupancyLease(null);
    (async () => {
      try {
        const token = await getAccessToken();
        const data = await fetchLandlordLeases(baseUrl, token, { emailHint, propertyId: pid });
        const leases = Array.isArray(data.leases) ? data.leases : [];
        const active = pickActiveOccupancyLease(leases);
        if (!cancelled) {
          setOccupancyLease(active);
          setOccupancyLeaseLoading(false);
        }
      } catch {
        if (!cancelled) {
          setOccupancyLease(null);
          setOccupancyLeaseLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, form.property_id, baseUrl, emailHint, getAccessToken]);
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
    const usingExistingOccupancyLease = Boolean(occupancyLease) && !occupancyLeaseLoading;
    if (!usingExistingOccupancyLease) {
      if (!form.start_date) errors.start_date = t('portalTenants.errors.startDateRequired');
      if (!form.month_to_month && form.end_date && form.end_date <= form.start_date) {
        errors.end_date = t('portalTenants.errors.endDateBeforeStart');
      }
      const rentParsed = parseOptionalMonthlyRentInput(form.rent_amount);
      if (!rentParsed.ok) errors.rent_amount = t('portalTenants.errors.invalidRentAmount');
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
      const usingExistingOccupancyLease = Boolean(occupancyLease) && !occupancyLeaseLoading;
      const rentParsedOnboard = parseOptionalMonthlyRentInput(form.rent_amount);
      const result = await createTenant(baseUrl, accessToken, {
        emailHint,
        email: form.email.trim().toLowerCase(),
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        phone: form.phone.trim() || null,
        landlord_id: form.landlord_id || undefined,
        property_id: form.property_id,
        lease: {
          start_date: usingExistingOccupancyLease ? (occupancyLease.start_date ? toDatePart(occupancyLease.start_date) : '') : form.start_date,
          end_date: usingExistingOccupancyLease
            ? (occupancyLease.month_to_month ? null : (occupancyLease.end_date ? toDatePart(occupancyLease.end_date) : null))
            : (form.month_to_month ? null : (form.end_date || null)),
          month_to_month: usingExistingOccupancyLease ? Boolean(occupancyLease.month_to_month) : form.month_to_month,
          notes: usingExistingOccupancyLease ? null : (form.notes || null),
          ...(!usingExistingOccupancyLease
            ? { rent_amount: rentParsedOnboard.ok ? rentParsedOnboard.value : null }
            : {}),
        },
      });
      setSubmitState({ status: 'ok', detail: '' });
      onSaved(result);
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
        <DialogContent sx={{ py: 1.25, px: 3 }}>
          <Stack spacing={1.25}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ lineHeight: 1.25 }}>
              {t('portalTenants.onboardDialog.tenantSection')}
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                label={t('portalTenants.form.firstName')}
                value={form.firstName}
                onChange={onChange('firstName')}
                required
                fullWidth
                error={Boolean(fieldErrors.firstName)}
                helperText={fieldErrors.firstName || ' '}
                size="small"
                margin="dense"
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
                margin="dense"
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
              margin="dense"
              autoComplete="email"
            />
            <TextField
              label={t('portalTenants.form.phone')}
              value={form.phone}
              onChange={onChange('phone')}
              fullWidth
              size="small"
              margin="dense"
              autoComplete="tel"
            />

            <Typography variant="subtitle2" color="text.secondary" sx={{ lineHeight: 1.25, pt: 0.25 }}>
              {t('portalTenants.onboardDialog.leaseSection')}
            </Typography>

            {isAdmin && (
              <TextField
                select
                label={t('portalTenants.form.landlord')}
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
                required
                fullWidth
                size="small"
                margin="dense"
                error={Boolean(fieldErrors.landlord_id)}
                helperText={fieldErrors.landlord_id || ' '}
              >
                <MenuItem value="" disabled>
                  {t('portalTenants.form.selectLandlord')}
                </MenuItem>
                {sortedLandlords.map((l) => (
                  <MenuItem key={l.id} value={l.id}>
                    <PortalPersonWithAvatar
                      photoUrl={String(l.profile_photo_url ?? '').trim()}
                      firstName={l.first_name ?? ''}
                      lastName={l.last_name ?? ''}
                      size={28}
                      alignItems="center"
                    >
                      <Typography variant="body2" component="span">
                        {displayName(l)}
                        {' — '}
                        <MailtoEmailLink email={l.email} color="inherit" noLink sx={{ color: 'inherit' }} />
                      </Typography>
                    </PortalPersonWithAvatar>
                  </MenuItem>
                ))}
              </TextField>
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

            {Boolean(form.property_id) && occupancyLeaseLoading && (
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', py: 0.5 }}>
                <CircularProgress size={18} />
                <Typography variant="body2" color="text.secondary">
                  {t('portalTenants.onboardDialog.loadingPropertyLease')}
                </Typography>
              </Stack>
            )}

            {Boolean(form.property_id) && occupancyLease && !occupancyLeaseLoading && (
              <>
                <Alert severity="info">{t('portalTenants.onboardDialog.existingLeaseBanner')}</Alert>
                <Typography variant="body2" color="text.secondary">
                  {occupancyLease.month_to_month
                    ? `${formatDate(occupancyLease.start_date)} — ${t('portalTenants.form.monthToMonth')}`
                    : occupancyLease.end_date
                      ? `${formatDate(occupancyLease.start_date)} – ${formatDate(occupancyLease.end_date)}`
                      : `${formatDate(occupancyLease.start_date)} —`}
                </Typography>
              </>
            )}

            {(!form.property_id || (!occupancyLeaseLoading && !occupancyLease)) && (
              <>
                <TextField
                  label={t('portalTenants.form.startDate')}
                  type="date"
                  value={form.start_date}
                  onChange={onChange('start_date')}
                  InputLabelProps={{ shrink: true }}
                  required={Boolean(form.property_id)}
                  fullWidth
                  error={Boolean(fieldErrors.start_date)}
                  helperText={fieldErrors.start_date || ' '}
                  size="small"
                  margin="dense"
                  disabled={Boolean(form.property_id) && occupancyLeaseLoading}
                />
                <FormControlLabel
                  sx={{ my: 0, py: 0 }}
                  control={
                    <Checkbox
                      checked={form.month_to_month}
                      onChange={onChange('month_to_month')}
                      size="small"
                      disabled={Boolean(form.property_id) && occupancyLeaseLoading}
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
                    margin="dense"
                    disabled={Boolean(form.property_id) && occupancyLeaseLoading}
                  />
                )}
                <TextField
                  label={t('portalTenants.form.rentAmount')}
                  value={form.rent_amount}
                  onChange={onChange('rent_amount')}
                  placeholder={t('portalTenants.form.rentAmountPlaceholder')}
                  fullWidth
                  error={Boolean(fieldErrors.rent_amount)}
                  helperText={fieldErrors.rent_amount || t('portalTenants.form.rentAmountHelper')}
                  size="small"
                  margin="dense"
                  inputProps={{ inputMode: 'decimal' }}
                  disabled={Boolean(form.property_id) && occupancyLeaseLoading}
                />
                <TextField
                  label={t('portalTenants.form.notes')}
                  value={form.notes}
                  onChange={onChange('notes')}
                  multiline
                  minRows={1}
                  maxRows={5}
                  fullWidth
                  size="small"
                  margin="dense"
                  disabled={Boolean(form.property_id) && occupancyLeaseLoading}
                />
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1 }}>
          <InlineActionStatus message={submitStatusMessage} />
          <Button type="button" onClick={handleAttemptClose} disabled={submitState.status === 'saving'}>
            {t('portalTenants.actions.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={
              submitState.status === 'saving'
              || (Boolean(form.property_id) && occupancyLeaseLoading)
            }
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
  const sortedTenants = useMemo(() => groupTenantsByProperty(tenantsState.tenants), [tenantsState.tenants]);

  /** Bumps when lease membership changes so every expanded tenant row refetches lease detail (co-tenant rows). */
  const [leaseDetailRefreshEpoch, setLeaseDetailRefreshEpoch] = useState(0);
  const bumpLeaseDetailRefresh = useCallback(() => {
    setLeaseDetailRefreshEpoch((n) => n + 1);
  }, []);

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

  const reloadTenantsAndLeasePanels = useCallback(() => {
    void loadTenants();
    bumpLeaseDetailRefresh();
  }, [loadTenants, bumpLeaseDetailRefresh]);

  useEffect(() => {
    void loadLandlords();
  }, [loadLandlords]);

  useEffect(() => {
    void loadTenants();
    void loadProperties();
  }, [loadTenants, loadProperties]);

  const handleToggleAccess = async (tenantId, active, landlordScopeId) => {
    if (!canUseModule) return;
    setActionState({ status: 'saving', detail: '' });
    try {
      const accessToken = await getAccessToken();
      const rawLandlordId = typeof landlordScopeId === 'string' ? landlordScopeId.trim() : '';
      const payload = {
        active,
        emailHint,
        ...(isAdmin && !active && rawLandlordId ? { landlordId: rawLandlordId } : {}),
      };
      const result = await patchTenantAccess(baseUrl, accessToken, tenantId, payload);
      const scopedOff = Boolean(active === false && result?.scoped_deactivate);
      setActionState({
        status: 'ok',
        detail: active
          ? t('portalTenants.messages.tenantEnabled')
          : scopedOff
            ? t('portalTenants.messages.tenantDeactivatedFromLandlordOnly')
            : t('portalTenants.messages.tenantDisabled'),
      });
      void loadTenants();
    } catch (e) {
      handleApiForbidden(e);
      setActionState({ status: 'error', detail: tenantApiErrorMessage(e, t) });
    }
  };

  const handleDeleteTenant = async (tenantId, landlordScopeId) => {
    if (!canUseModule) return;
    setActionState({ status: 'saving', detail: '' });
    try {
      const accessToken = await getAccessToken();
      const rawLandlordId = typeof landlordScopeId === 'string' ? landlordScopeId.trim() : '';
      const result = await deleteTenant(baseUrl, accessToken, tenantId, {
        emailHint,
        landlordId: isAdmin && rawLandlordId ? rawLandlordId : undefined,
      });
      const disabled = Boolean(result?.disabled_account);
      setActionState({
        status: 'ok',
        detail: disabled
          ? t('portalTenants.messages.tenantRemovedLastLandlord')
          : t('portalTenants.messages.tenantRemovedFromLandlordOnly'),
      });
      void reloadTenantsAndLeasePanels();
    } catch (e) {
      handleApiForbidden(e);
      setActionState({ status: 'error', detail: tenantApiErrorMessage(e, t) });
    }
  };

  const handleTenantUpdated = () => {
    setActionState({ status: 'ok', detail: t('portalTenants.messages.tenantUpdated') });
    void loadTenants();
  };

  const handleOnboarded = (result) => {
    setOnboardOpen(false);
    const detail = result?.lease_reused
      ? t('portalTenants.messages.tenantOnboardedExistingLease')
      : t('portalTenants.messages.tenantOnboarded');
    setActionState({ status: 'ok', detail });
    void reloadTenantsAndLeasePanels();
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
                    <PortalPersonWithAvatar
                      photoUrl={String(l.profile_photo_url ?? '').trim()}
                      firstName={l.first_name ?? ''}
                      lastName={l.last_name ?? ''}
                      size={28}
                      alignItems="center"
                    >
                      <Typography variant="body2" component="span">
                        {displayName(l)}
                        {' — '}
                        <MailtoEmailLink email={l.email} color="inherit" noLink sx={{ color: 'inherit' }} />
                      </Typography>
                    </PortalPersonWithAvatar>
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
                onClick={() => void reloadTenantsAndLeasePanels()}
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
              <EmptyState
                icon={<PeopleOutline sx={{ fontSize: 56 }} />}
                title={t('portalTenants.list.emptyTitle')}
                description={t('portalTenants.list.emptyDescription')}
              />
            )}
            {sortedTenants.map((tenant, index) => (
              <Fragment key={tenantRowKey(tenant, index)}>
                {index > 0
                  && tenantPropertyGroupKey(tenant) !== tenantPropertyGroupKey(sortedTenants[index - 1]) && (
                  <Divider sx={{ my: 1.5 }} role="separator" />
                )}
                <TenantRow
                  tenant={tenant}
                  properties={sortedProperties}
                  landlords={sortedLandlords}
                  isAdmin={isAdmin}
                  allTenants={sortedTenants}
                  onToggleAccess={handleToggleAccess}
                  onDeleteTenant={handleDeleteTenant}
                  onLeaseSaved={reloadTenantsAndLeasePanels}
                  leaseDetailRefreshEpoch={leaseDetailRefreshEpoch}
                  onTenantUpdated={handleTenantUpdated}
                  onExportError={() => showFeedback(t('portalTenants.errors.exportContactCardFailed'), 'error')}
                  t={t}
                />
              </Fragment>
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

// ---------------------------------------------------------------------------
// MoveOutLeaseDialog — finalize end-of-term / mutual move-out
// ---------------------------------------------------------------------------

function MoveOutLeaseDialog({ open, onClose, lease, baseUrl, getAccessToken, emailHint, onDone, t }) {
  const today = new Date().toISOString().slice(0, 10);
  const [endedOn, setEndedOn] = useState(today);
  const [endedReason, setEndedReason] = useState('end_of_term');
  const [finalBalance, setFinalBalance] = useState('');
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [fwd, setFwd] = useState({ street: '', street2: '', city: '', state: '', zip: '' });
  const [state, setState] = useState({ status: 'idle', detail: '' });

  useEffect(() => {
    if (open) {
      setEndedOn(today);
      setEndedReason('end_of_term');
      setFinalBalance('');
      setInspectionNotes('');
      setInternalNotes('');
      setFwd({ street: '', street2: '', city: '', state: '', zip: '' });
      setState({ status: 'idle', detail: '' });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    setState({ status: 'saving', detail: '' });
    try {
      const accessToken = await getAccessToken();
      const trimmed = Object.fromEntries(
        Object.entries(fwd).map(([k, v]) => [k, v.trim().length ? v.trim() : null]),
      );
      const hasForwarding = Object.values(trimmed).some((v) => v !== null);
      await moveOutLease(
        baseUrl,
        accessToken,
        lease.id,
        {
          ended_on: endedOn,
          ended_reason: endedReason,
          final_balance_amount: finalBalance === '' ? null : Number(finalBalance),
          inspection_notes: inspectionNotes || null,
          internal_notes: internalNotes || null,
          forwarding: hasForwarding ? trimmed : null,
        },
        { emailHint },
      );
      onDone();
    } catch (error) {
      setState({ status: 'error', detail: tenantApiErrorMessage(error, t) });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('portalTenants.moveOut.title')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label={t('portalTenants.moveOut.endedOn')}
            type="date"
            value={endedOn}
            onChange={(e) => setEndedOn(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel id="move-out-reason-label">{t('portalTenants.moveOut.reason')}</InputLabel>
            <Select
              labelId="move-out-reason-label"
              value={endedReason}
              label={t('portalTenants.moveOut.reason')}
              onChange={(e) => setEndedReason(e.target.value)}
            >
              <MenuItem value="end_of_term">{t('portalTenants.moveOut.reasonEndOfTerm')}</MenuItem>
              <MenuItem value="mutual">{t('portalTenants.moveOut.reasonMutual')}</MenuItem>
              <MenuItem value="other">{t('portalTenants.moveOut.reasonOther')}</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label={t('portalTenants.moveOut.finalBalance')}
            type="number"
            value={finalBalance}
            onChange={(e) => setFinalBalance(e.target.value)}
            fullWidth
          />
          <TextField
            label={t('portalTenants.moveOut.forwardingStreet')}
            value={fwd.street}
            onChange={(e) => setFwd({ ...fwd, street: e.target.value })}
            fullWidth
          />
          <Stack direction="row" spacing={1}>
            <TextField
              label={t('portalTenants.moveOut.forwardingCity')}
              value={fwd.city}
              onChange={(e) => setFwd({ ...fwd, city: e.target.value })}
              fullWidth
            />
            <TextField
              label={t('portalTenants.moveOut.forwardingState')}
              value={fwd.state}
              onChange={(e) => setFwd({ ...fwd, state: e.target.value })}
              sx={{ width: 100 }}
            />
            <TextField
              label={t('portalTenants.moveOut.forwardingZip')}
              value={fwd.zip}
              onChange={(e) => setFwd({ ...fwd, zip: e.target.value })}
              sx={{ width: 140 }}
            />
          </Stack>
          <TextField
            label={t('portalTenants.moveOut.inspectionNotes')}
            value={inspectionNotes}
            onChange={(e) => setInspectionNotes(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
          <TextField
            label={t('portalTenants.moveOut.internalNotes')}
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
          {state.status === 'error' && <Alert severity="error">{state.detail}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={state.status === 'saving'}>
          {t('portalTenants.actions.cancel')}
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="warning"
          disabled={state.status === 'saving' || !endedOn}
        >
          {t('portalTenants.moveOut.submit')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// TerminateLeaseDialog — eviction or early termination (minimal form; expand later)
// ---------------------------------------------------------------------------

function TerminateLeaseDialog({ open, onClose, lease, baseUrl, getAccessToken, emailHint, onDone, t }) {
  const today = new Date().toISOString().slice(0, 10);
  const [kind, setKind] = useState('early_termination');
  const [endedOn, setEndedOn] = useState(today);
  const [caseNumber, setCaseNumber] = useState('');
  const [judgmentAmount, setJudgmentAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [state, setState] = useState({ status: 'idle', detail: '' });

  useEffect(() => {
    if (open) {
      setKind('early_termination');
      setEndedOn(today);
      setCaseNumber('');
      setJudgmentAmount('');
      setNotes('');
      setState({ status: 'idle', detail: '' });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    setState({ status: 'saving', detail: '' });
    try {
      const accessToken = await getAccessToken();
      await terminateLease(
        baseUrl,
        accessToken,
        lease.id,
        {
          kind,
          ended_on: endedOn,
          ended_notes: notes || null,
          case_number: kind === 'eviction' ? (caseNumber || null) : null,
          judgment_amount:
            kind === 'eviction' && judgmentAmount !== '' ? Number(judgmentAmount) : null,
          eviction_details: kind === 'eviction' ? (notes || null) : null,
        },
        { emailHint },
      );
      onDone();
    } catch (error) {
      setState({ status: 'error', detail: tenantApiErrorMessage(error, t) });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('portalTenants.terminate.title')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <FormControl fullWidth>
            <InputLabel id="terminate-kind-label">{t('portalTenants.terminate.kind')}</InputLabel>
            <Select
              labelId="terminate-kind-label"
              value={kind}
              label={t('portalTenants.terminate.kind')}
              onChange={(e) => setKind(e.target.value)}
            >
              <MenuItem value="early_termination">
                {t('portalTenants.terminate.kindEarlyTermination')}
              </MenuItem>
              <MenuItem value="eviction">{t('portalTenants.terminate.kindEviction')}</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label={t('portalTenants.terminate.endedOn')}
            type="date"
            value={endedOn}
            onChange={(e) => setEndedOn(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          {kind === 'eviction' && (
            <>
              <TextField
                label={t('portalTenants.terminate.caseNumber')}
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
                fullWidth
              />
              <TextField
                label={t('portalTenants.terminate.judgmentAmount')}
                type="number"
                value={judgmentAmount}
                onChange={(e) => setJudgmentAmount(e.target.value)}
                fullWidth
              />
              <Alert severity="warning">{t('portalTenants.terminate.evictionWarning')}</Alert>
            </>
          )}
          <TextField
            label={t('portalTenants.terminate.notes')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
          {state.status === 'error' && <Alert severity="error">{state.detail}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={state.status === 'saving'}>
          {t('portalTenants.actions.cancel')}
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="error"
          disabled={state.status === 'saving' || !endedOn}
        >
          {t('portalTenants.terminate.submit')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default PortalTenants;
