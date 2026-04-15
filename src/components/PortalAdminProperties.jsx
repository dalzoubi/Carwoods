import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Search from '@mui/icons-material/Search';
import Edit from '@mui/icons-material/Edit';
import Delete from '@mui/icons-material/Delete';
import Add from '@mui/icons-material/Add';
import Sync from '@mui/icons-material/Sync';
import Close from '@mui/icons-material/Close';
import Home from '@mui/icons-material/Home';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { normalizeRole, resolveRole } from '../portalUtils';
import { Role } from '../domain/constants.js';
import { usePortalFeedback } from '../hooks/usePortalFeedback';
import PortalFeedbackSnackbar from './PortalFeedbackSnackbar';
import PortalConfirmDialog from './PortalConfirmDialog';
import {
  listPropertiesApi,
  createPropertyApi,
  updatePropertyApi,
  patchPropertyApi,
  deletePropertyApi,
  restorePropertyApi,
  apiPropertyToDisplay,
} from '../lib/propertiesApiClient';
import StatusAlertSlot from './StatusAlertSlot';
import PortalRefreshButton from './PortalRefreshButton';
import PortalPersonWithAvatar from './PortalPersonWithAvatar';
import { listingFromHarPreviewPayload, parseHarInput } from '../portalHarPreviewParse';
import { fetchElsaSettings, fetchHarPreview, fetchLandlords, patchElsaPropertyPolicy } from '../lib/portalApiClient';
import {
  allowsPropertyApplyVisibilityEdit,
  allowsPropertyElsaAutoSendEdit,
  landlordTierLimits,
  maxPropertiesForLandlord,
} from '../portalTierUtils';

/** Admin: tier cap from landlord row; landlord self: from /me tier limits. */
function maxPropertiesForLandlordContext(isAdmin, landlordUserId, landlordRows, selfLimits) {
  if (isAdmin) {
    const lid = String(landlordUserId ?? '').trim();
    if (!lid) return -1;
    const row = landlordRows.find((l) => l.id === lid);
    if (!row) return -1;
    const n = row.tier_max_properties;
    if (n === null || n === undefined) return -1;
    const num = Number(n);
    return Number.isFinite(num) ? num : -1;
  }
  return maxPropertiesForLandlord(selfLimits);
}

function countActivePropertiesForLandlordInList(allProperties, landlordUserId) {
  const lid = String(landlordUserId ?? '').trim();
  if (!lid) return 0;
  return allProperties.filter(
    (p) => !p.deletedAt && String(p.landlordUserId ?? '').trim() === lid
  ).length;
}

/** Deleted row: restore only if restoring would not exceed the owner's tier max active properties. */
function canRestoreDeletedProperty(isAdmin, property, landlordRows, selfLimits, allProperties) {
  if (!property?.deletedAt) return false;
  const lid = String(property.landlordUserId ?? '').trim();
  const maxP = maxPropertiesForLandlordContext(isAdmin, lid, landlordRows, selfLimits);
  if (maxP < 0) return true;
  const active = countActivePropertiesForLandlordInList(allProperties, lid);
  return active < maxP;
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function landlordRowLabel(landlord) {
  const first = String(landlord?.first_name ?? '').trim();
  const last = String(landlord?.last_name ?? '').trim();
  return `${first} ${last}`.trim() || String(landlord?.email ?? '').trim();
}

function splitNameForInitials(displayName) {
  const parts = String(displayName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

const EMPTY_FORM = {
  harId: '',
  addressLine: '',
  cityStateZip: '',
  monthlyRentLabel: '',
  photoUrl: '',
  harListingUrl: '',
  applyUrl: '',
  detailLinesText: '',
  showOnApplyPage: true,
  landlordUserId: '',
};

/** Create/edit dialog: can the user toggle Apply-page visibility (false for Free tier / tier limits). */
function isFormApplyPageVisibilityEditable(isAdmin, formLandlordUserId, landlordRows, landlordLimits) {
  if (isAdmin) {
    const lid = String(formLandlordUserId ?? '').trim();
    if (!lid) return true;
    const row = landlordRows.find((l) => l.id === lid);
    if (!row) return true;
    return String(row.tier_name ?? '').toUpperCase() !== 'FREE';
  }
  return allowsPropertyApplyVisibilityEdit(landlordLimits);
}

/** Match PortalAdminProperties `resolveAllowElsaEdit` (used before hooks when building policy map). */
function resolveAllowElsaEditForLandlord(isAdmin, landlordUserId, landlordRows, landlordLimits) {
  if (isAdmin) {
    const lid = String(landlordUserId ?? '').trim();
    if (!lid) return true;
    const row = landlordRows.find((l) => l.id === lid);
    if (!row) return true;
    return String(row.tier_name ?? '').toUpperCase() !== 'FREE';
  }
  return allowsPropertyElsaAutoSendEdit(landlordLimits);
}

/** Free tier: inherit (null) must display as off; paid: null inherits as on. */
function elsaPropertyPolicyDisplayEnabled(isAdmin, landlordUserId, landlordRows, landlordLimits, apiOverride) {
  const allow = resolveAllowElsaEditForLandlord(isAdmin, landlordUserId, landlordRows, landlordLimits);
  if (allow) return apiOverride !== false;
  return apiOverride === true;
}

function propertyToForm(p) {
  return {
    harId: p.harId ?? '',
    addressLine: p.addressLine ?? '',
    cityStateZip: p.cityStateZip ?? '',
    monthlyRentLabel: p.monthlyRentLabel ?? '',
    photoUrl: p.photoUrl ?? '',
    harListingUrl: p.harListingUrl ?? '',
    applyUrl: p.applyUrl ?? '',
    detailLinesText: (p.detailLines ?? []).join('\n'),
    showOnApplyPage: Boolean(p.showOnApplyPage),
    landlordUserId: p.landlordUserId ?? '',
  };
}

function formToRecord(form) {
  return {
    harId: form.harId.trim(),
    addressLine: form.addressLine.trim(),
    cityStateZip: form.cityStateZip.trim(),
    monthlyRentLabel: form.monthlyRentLabel.trim(),
    photoUrl: form.photoUrl.trim(),
    harListingUrl: form.harListingUrl.trim(),
    applyUrl: form.applyUrl.trim(),
    detailLines: form.detailLinesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
    showOnApplyPage: form.showOnApplyPage,
    landlordUserId: form.landlordUserId,
  };
}

function validate(form, t, opts = {}) {
  const isAdmin = Boolean(opts.isAdmin);
  const errors = {};
  if (!form.addressLine.trim()) errors.addressLine = t('portalAdminProperties.errors.addressRequired');
  if (!form.cityStateZip.trim()) errors.cityStateZip = t('portalAdminProperties.errors.cityStateZipRequired');
  if (isAdmin && !String(form.landlordUserId ?? '').trim()) {
    errors.landlordUserId = t('portalAdminProperties.errors.landlordRequired');
  }
  return errors;
}

const PropertyCard = ({
  property,
  isAdmin,
  landlordRow = null,
  allowVisibleEdit = true,
  allowElsaEdit = true,
  allowRestore = true,
  syncingHar,
  onEdit,
  onDelete,
  onRestore,
  onToggleVisible,
  onToggleElsaAutoSend,
  elsaAutoSendEnabled,
  updatingElsaPolicy,
  showElsaAutoSend,
  onSyncHar,
  t,
}) => {
  const hasPhoto = Boolean(property.photoUrl);
  const isDeleted = Boolean(property.deletedAt);
  const nameSplit = splitNameForInitials(property.landlordName);
  const landlordPhotoUrl = String(landlordRow?.profile_photo_url ?? '').trim();
  const landlordFirstName = String(landlordRow?.first_name ?? '').trim() || nameSplit.first;
  const landlordLastName = String(landlordRow?.last_name ?? '').trim() || nameSplit.last;
  return (
    <Card variant="outlined" sx={{ display: 'flex', flexDirection: 'column', height: '100%', borderRadius: 2 }}>
      {hasPhoto ? (
        <CardMedia
          component="img"
          image={property.photoUrl}
          alt={property.addressLine}
          sx={{ height: 160, objectFit: 'cover' }}
        />
      ) : (
        <Box
          sx={{
            height: 160,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'action.hover',
          }}
        >
          <Home sx={{ fontSize: 48, color: 'text.disabled' }} />
        </Box>
      )}
      <CardContent sx={{ flex: 1, pb: 1 }}>
        <Stack spacing={0.5} sx={{ mb: 1 }}>
          <Typography variant="body1" fontWeight={700} noWrap>
            {property.addressLine || '—'}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {property.cityStateZip || '—'}
          </Typography>
          {property.monthlyRentLabel && (
            <Typography variant="body2" fontWeight={600} color="primary.main">
              {property.monthlyRentLabel}
            </Typography>
          )}
          {property.harId && (
            <Typography variant="caption" color="text.disabled">
              {t('portalAdminProperties.grid.harId')}: {property.harId}
            </Typography>
          )}
          {isAdmin && property.landlordName && (
            <PortalPersonWithAvatar
              photoUrl={landlordPhotoUrl}
              firstName={landlordFirstName}
              lastName={landlordLastName}
              size={28}
              alignItems="center"
            >
              <Typography variant="caption" color="text.secondary">
                {t('portalAdminProperties.grid.landlord')}: {property.landlordName}
              </Typography>
            </PortalPersonWithAvatar>
          )}
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, minHeight: 32 }}>
          <Tooltip
            title={!allowVisibleEdit && !isDeleted ? t('portalSubscription.freeTier.featureDisabled') : ''}
          >
            <span>
              <FormControlLabel
                control={(
                  <Switch
                    size="small"
                    checked={Boolean(property.showOnApplyPage)}
                    disabled={isDeleted || !allowVisibleEdit}
                    onChange={() => onToggleVisible(property)}
                  />
                )}
                label={t('portalAdminProperties.grid.visible')}
                sx={{ m: 0 }}
              />
            </span>
          </Tooltip>
          {isDeleted ? (
            <Chip label={t('portalAdminProperties.grid.deleted')} size="small" color="warning" variant="outlined" />
          ) : null}
        </Stack>
        {showElsaAutoSend && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, minHeight: 32 }}>
            <Tooltip
              title={!allowElsaEdit && !isDeleted ? t('portalSubscription.freeTier.featureDisabled') : ''}
            >
              <span>
                <FormControlLabel
                  control={(
                    <Switch
                      size="small"
                      checked={Boolean(elsaAutoSendEnabled)}
                      disabled={isDeleted || updatingElsaPolicy || !allowElsaEdit}
                      onChange={() => onToggleElsaAutoSend(property)}
                    />
                  )}
                  label={t('portalAdminProperties.grid.elsaAutoSend')}
                  sx={{ m: 0 }}
                />
              </span>
            </Tooltip>
          </Stack>
        )}
      </CardContent>
      <Box sx={{ px: 2, pb: 2, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        {isDeleted ? (
          <Tooltip
            title={
              allowRestore
                ? t('portalAdminProperties.grid.restoreButton')
                : t('portalAdminProperties.grid.restoreDisabledAtPropertyCap')
            }
          >
            <span>
              <IconButton
                type="button"
                size="small"
                color="primary"
                disabled={!allowRestore}
                aria-label={t('portalAdminProperties.grid.restoreButton')}
                onClick={() => onRestore(property)}
              >
                <Add fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        ) : null}
        <Tooltip title={t('portalAdminProperties.grid.syncHarButton')}>
          <span>
            <IconButton
              type="button"
              size="small"
              color="primary"
              disabled={isDeleted || !property.harId || syncingHar}
              aria-label={t('portalAdminProperties.grid.syncHarButton')}
              onClick={() => onSyncHar(property)}
            >
              {syncingHar ? <CircularProgress size={16} /> : <Sync fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t('portalAdminProperties.grid.editButton')}>
          <span>
            <IconButton
              type="button"
              size="small"
              disabled={isDeleted}
              aria-label={t('portalAdminProperties.grid.editButton')}
              onClick={() => onEdit(property)}
            >
              <Edit fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t('portalAdminProperties.grid.deleteButton')}>
          <span>
            <IconButton
              type="button"
              size="small"
              color="error"
              disabled={isDeleted}
              aria-label={t('portalAdminProperties.grid.deleteButton')}
              onClick={() => onDelete(property)}
            >
              <Delete fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </Card>
  );
};

const PortalAdminProperties = () => {
  const { t } = useTranslation();
  const { isAuthenticated, account, meData, meStatus, baseUrl, getAccessToken, handleApiForbidden } = usePortalAuth();

  const role = normalizeRole(resolveRole(meData, account));
  const isAdmin = role === Role.ADMIN;
  const canManage = isAuthenticated && (role === Role.ADMIN || role === Role.LANDLORD);

  const [properties, setProperties] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [visibilityFilter, setVisibilityFilter] = useState('all');

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [editingId, setEditingId] = useState(null);

  const [harSearchId, setHarSearchId] = useState('');
  const [harStatus, setHarStatus] = useState('idle'); // idle | searching | found | not_found | error
  const [harMessage, setHarMessage] = useState('');

  const [submitStatus, setSubmitStatus] = useState('idle'); // idle | saving | error
  const [submitError, setSubmitError] = useState('');
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [landlords, setLandlords] = useState([]);
  const [landlordsStatus, setLandlordsStatus] = useState('idle'); // idle | loading | ok | error
  /** Admin-only: filter grid to one landlord; empty string = all landlords */
  const [adminLandlordFilterId, setAdminLandlordFilterId] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteStatus, setDeleteStatus] = useState('idle'); // idle | deleting | error
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoreStatus, setRestoreStatus] = useState('idle'); // idle | restoring | error
  const [visibleToggleTarget, setVisibleToggleTarget] = useState(null);
  const [visibleToggleStatus, setVisibleToggleStatus] = useState('idle'); // idle | saving | error
  const [syncHarTargetId, setSyncHarTargetId] = useState('');
  const [elsaPropertyPolicyById, setElsaPropertyPolicyById] = useState({});
  const [elsaPolicyTargetId, setElsaPolicyTargetId] = useState('');
  const fileInputRef = useRef(null);
  const formBaselineRef = useRef({ form: EMPTY_FORM, harSearchId: '' });
  const { feedback, showFeedback, closeFeedback } = usePortalFeedback();

  const getAccessTokenRef = useRef(getAccessToken);
  useEffect(() => { getAccessTokenRef.current = getAccessToken; });

  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; });

  const refresh = useCallback(async (signal) => {
    if (!isAuthenticated || !baseUrl) return;
    setListLoading(true);
    setListError('');
    try {
      const token = await getAccessTokenRef.current();
      if (signal?.aborted) return;
      const rows = await listPropertiesApi(baseUrl, token, {
        includeDeleted: showDeleted,
        // Show-deleted should reflect live DB state, not a stale list cache.
        skipCache: showDeleted,
      });
      const policyMap = {};
      const elsaPayload = await fetchElsaSettings(baseUrl, token);
      const propertyPolicies = Array.isArray(elsaPayload?.properties) ? elsaPayload.properties : [];
      const limits = landlordTierLimits(meData);
      for (const row of propertyPolicies) {
        if (row && typeof row.property_id === 'string') {
          const prop = rows.find((p) => p.id === row.property_id);
          const lid = typeof prop?.landlord_user_id === 'string' ? prop.landlord_user_id : '';
          policyMap[row.property_id] = elsaPropertyPolicyDisplayEnabled(
            isAdmin,
            lid,
            landlords,
            limits,
            row.auto_send_enabled_override
          );
        }
      }
      if (signal?.aborted) return;
      setProperties(rows.map(apiPropertyToDisplay));
      setElsaPropertyPolicyById(policyMap);
    } catch {
      if (signal?.aborted) return;
      setListError(tRef.current('portalAdminProperties.errors.loadFailed', {
        error: tRef.current('portalSetup.errors.unknown'),
      }));
    } finally {
      if (!signal?.aborted) setListLoading(false);
    }
  }, [isAuthenticated, baseUrl, showDeleted, isAdmin, landlords, meData]);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated || !baseUrl || !isAdmin) {
      setLandlords([]);
      setLandlordsStatus('idle');
      return () => {
        cancelled = true;
      };
    }
    setLandlordsStatus('loading');
    (async () => {
      try {
        const token = await getAccessToken();
        const payload = await fetchLandlords(baseUrl, token);
        if (cancelled) return;
        const rows = Array.isArray(payload?.landlords) ? payload.landlords : [];
        setLandlords(rows);
        setLandlordsStatus('ok');
      } catch {
        if (cancelled) return;
        setLandlords([]);
        setLandlordsStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, baseUrl, isAdmin, getAccessToken]);

  useEffect(() => {
    if (!isAdmin || !adminLandlordFilterId) return;
    const ids = new Set(landlords.map((l) => l?.id).filter(Boolean));
    if (!ids.has(adminLandlordFilterId)) setAdminLandlordFilterId('');
  }, [isAdmin, adminLandlordFilterId, landlords]);

  const resetForm = () => {
    setForm({
      ...EMPTY_FORM,
      landlordUserId: isAdmin ? '' : EMPTY_FORM.landlordUserId,
    });
    setFieldErrors({});
    setEditingId(null);
    setFormOpen(false);
    setHarSearchId('');
    setHarStatus('idle');
    setHarMessage('');
    setSubmitStatus('idle');
    setSubmitError('');
    setDiscardDialogOpen(false);
  };

  const hasUnsavedChanges = formOpen && (
    JSON.stringify(form) !== JSON.stringify(formBaselineRef.current.form)
    || harSearchId !== formBaselineRef.current.harSearchId
  );

  const handleAttemptCloseForm = () => {
    if (submitStatus === 'saving') return;
    if (hasUnsavedChanges) {
      setDiscardDialogOpen(true);
      return;
    }
    resetForm();
  };

  const handleEdit = (property) => {
    const nextForm = propertyToForm(property);
    const limits = landlordTierLimits(meData);
    if (!isFormApplyPageVisibilityEditable(isAdmin, nextForm.landlordUserId, landlords, limits)) {
      nextForm.showOnApplyPage = false;
    }
    setForm(nextForm);
    setEditingId(property.id);
    setFormOpen(true);
    const nextHarSearchId = property.harId ?? '';
    setHarSearchId(nextHarSearchId);
    formBaselineRef.current = { form: nextForm, harSearchId: nextHarSearchId };
    setHarStatus('idle');
    setHarMessage('');
    setFieldErrors({});
    setSubmitStatus('idle');
    setSubmitError('');
  };

  const handleDeleteClick = (property) => {
    setDeleteTarget(property);
    setDeleteStatus('idle');
  };

  const handleRestoreClick = (property) => {
    setRestoreTarget(property);
    setRestoreStatus('idle');
  };

  const handleVisibilityToggleClick = (property) => {
    setVisibleToggleTarget(property);
    setVisibleToggleStatus('idle');
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteStatus('deleting');
    try {
      const token = await getAccessToken();
      await deletePropertyApi(baseUrl, token, deleteTarget.id);
      setDeleteTarget(null);
      setDeleteStatus('idle');
      showFeedback(t('portalAdminProperties.messages.deleted'), 'info');
      void refresh();
    } catch {
      setDeleteStatus('error');
      showFeedback(t('portalAdminProperties.errors.deleteFailed', {
        error: t('portalSetup.errors.unknown'),
      }), 'error');
    }
  };

  const handleRestoreConfirm = async () => {
    if (!restoreTarget) return;
    setRestoreStatus('restoring');
    try {
      const token = await getAccessToken();
      await restorePropertyApi(baseUrl, token, restoreTarget.id);
      setRestoreTarget(null);
      setRestoreStatus('idle');
      showFeedback(t('portalAdminProperties.messages.restored'));
      void refresh();
    } catch (err) {
      setRestoreStatus('error');
      const code = err && typeof err === 'object' ? err.code : '';
      if (code === 'property_limit_reached') {
        showFeedback(t('portalAdminProperties.errors.restorePropertyLimitReached'), 'error');
      } else {
        showFeedback(t('portalAdminProperties.errors.restoreFailed', {
          error: t('portalSetup.errors.unknown'),
        }), 'error');
      }
    }
  };

  const handleVisibilityToggleConfirm = async () => {
    if (!visibleToggleTarget) return;
    setVisibleToggleStatus('saving');
    try {
      const token = await getAccessToken();
      await patchPropertyApi(baseUrl, token, visibleToggleTarget.id, {
        apply_visible: !Boolean(visibleToggleTarget.showOnApplyPage),
      });
      setVisibleToggleTarget(null);
      setVisibleToggleStatus('idle');
      showFeedback(t('portalAdminProperties.messages.visibilityUpdated'));
      void refresh();
    } catch {
      setVisibleToggleStatus('error');
      showFeedback(t('portalAdminProperties.errors.visibilityFailed', {
        error: t('portalSetup.errors.unknown'),
      }), 'error');
    }
  };

  const handleSyncHar = async (property) => {
    if (!property?.id || !property?.harId) return;
    setSyncHarTargetId(property.id);
    try {
      const token = await getAccessToken();
      await patchPropertyApi(baseUrl, token, property.id, { refresh_har: true });
      showFeedback(t('portalAdminProperties.messages.harSynced'));
      void refresh();
    } catch {
      showFeedback(t('portalAdminProperties.errors.syncHarFailed', {
        error: t('portalSetup.errors.unknown'),
      }), 'error');
    } finally {
      setSyncHarTargetId('');
    }
  };

  const handleHarSearch = async () => {
    const id = parseHarInput(harSearchId);
    if (!id) {
      setHarStatus('not_found');
      setHarMessage(t('portalAdminProperties.harSearch.invalidInput'));
      return;
    }
    if (!baseUrl) {
      setHarStatus('error');
      setHarMessage(t('portalAdminProperties.harSearch.noApiConfigured'));
      return;
    }
    setHarStatus('searching');
    setHarMessage('');
    try {
      const accessToken = await getAccessToken();
      let payload = await fetchHarPreview(baseUrl, accessToken, id);
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch {
          payload = null;
        }
      }
      const tile = listingFromHarPreviewPayload(payload);
      if (!tile) {
        setHarStatus('error');
        setHarMessage(t('portalAdminProperties.harSearch.unexpectedResponse'));
        return;
      }
      setForm((prev) => ({
        ...prev,
        harId: id,
        addressLine: tile.addressLine || prev.addressLine,
        cityStateZip: tile.cityStateZip || prev.cityStateZip,
        monthlyRentLabel: tile.monthlyRentLabel || prev.monthlyRentLabel,
        photoUrl: tile.photoUrl || prev.photoUrl,
        harListingUrl: tile.harListingUrl || prev.harListingUrl,
        applyUrl: tile.applyUrl || prev.applyUrl,
        detailLinesText: Array.isArray(tile.detailLines) && tile.detailLines.length
          ? tile.detailLines.join('\n')
          : prev.detailLinesText,
      }));
      setHarStatus('found');
      setHarMessage(t('portalAdminProperties.harSearch.found'));
    } catch (error) {
      handleApiForbidden(error);
      if (error && typeof error === 'object' && error.status === 404) {
        setHarStatus('not_found');
        setHarMessage(t('portalAdminProperties.harSearch.notFound'));
        return;
      }
      if (error && typeof error === 'object' && error.code === 'har_access_denied') {
        setHarStatus('error');
        setHarMessage(t('portalAdminProperties.harSearch.accessDenied'));
        return;
      }
      setHarStatus('error');
      setHarMessage(t('portalAdminProperties.harSearch.fetchError'));
    }
  };

  const handlePhotoFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setForm((prev) => ({ ...prev, photoUrl: evt.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const onChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const errors = validate(form, t, { isAdmin });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    if (!baseUrl) {
      setSubmitError(t('portalAdminProperties.errors.noApiConfigured'));
      return;
    }
    setSubmitStatus('saving');
    setSubmitError('');
    const record = formToRecord(form);
    const limits = landlordTierLimits(meData);
    const visibilityEditable = isFormApplyPageVisibilityEditable(isAdmin, form.landlordUserId, landlords, limits);
    const recordForApi = visibilityEditable ? record : { ...record, showOnApplyPage: false };
    try {
      const token = await getAccessToken();
      if (editingId) {
        await updatePropertyApi(baseUrl, token, editingId, recordForApi);
        showFeedback(t('portalAdminProperties.messages.updated'));
      } else {
        await createPropertyApi(baseUrl, token, recordForApi);
        showFeedback(t('portalAdminProperties.messages.added'));
      }
      resetForm();
      void refresh();
    } catch {
      setSubmitStatus('error');
      setSubmitError(t('portalAdminProperties.errors.saveFailed', {
        error: t('portalSetup.errors.unknown'),
      }));
    }
  };

  const sortedLandlords = useMemo(
    () =>
      [...landlords].sort((a, b) => collator.compare(landlordRowLabel(a), landlordRowLabel(b))),
    [landlords]
  );

  const myUserId = String(meData?.user?.id ?? '').trim();
  const landlordLimits = useMemo(() => landlordTierLimits(meData), [meData]);

  const applyPageVisibilityEditable = useMemo(
    () => isFormApplyPageVisibilityEditable(isAdmin, form.landlordUserId, sortedLandlords, landlordLimits),
    [isAdmin, form.landlordUserId, sortedLandlords, landlordLimits]
  );

  useEffect(() => {
    if (!formOpen || applyPageVisibilityEditable) return;
    setForm((prev) => (prev.showOnApplyPage ? { ...prev, showOnApplyPage: false } : prev));
  }, [applyPageVisibilityEditable, formOpen]);

  const effectiveLandlordIdForCap = useMemo(() => {
    if (isAdmin) {
      const fromForm = formOpen && !editingId ? String(form.landlordUserId ?? '').trim() : '';
      if (fromForm) return fromForm;
      return String(adminLandlordFilterId ?? '').trim();
    }
    return myUserId;
  }, [isAdmin, formOpen, editingId, form.landlordUserId, adminLandlordFilterId, myUserId]);

  const maxPropsForCap = useMemo(() => {
    if (isAdmin) {
      if (!effectiveLandlordIdForCap) return -1;
      const row = sortedLandlords.find((l) => l.id === effectiveLandlordIdForCap);
      const n = row?.tier_max_properties;
      if (n === null || n === undefined) return -1;
      const num = Number(n);
      return Number.isFinite(num) ? num : -1;
    }
    return maxPropertiesForLandlord(landlordLimits);
  }, [isAdmin, effectiveLandlordIdForCap, sortedLandlords, landlordLimits]);

  const activeCountForCap = useMemo(() => {
    if (!effectiveLandlordIdForCap) {
      if (isAdmin) return 0;
      return properties.filter((p) => !p.deletedAt).length;
    }
    return properties.filter(
      (p) => !p.deletedAt && String(p.landlordUserId ?? '') === effectiveLandlordIdForCap
    ).length;
  }, [properties, effectiveLandlordIdForCap, isAdmin]);

  const atPropertyCap = maxPropsForCap >= 0 && activeCountForCap >= maxPropsForCap;

  const resolveAllowVisibleEdit = useCallback(
    (property) => {
      if (isAdmin) {
        const row = sortedLandlords.find((l) => l.id === property.landlordUserId);
        if (!row) return true;
        return String(row.tier_name ?? '').toUpperCase() !== 'FREE';
      }
      return allowsPropertyApplyVisibilityEdit(landlordLimits);
    },
    [isAdmin, sortedLandlords, landlordLimits]
  );

  const resolveAllowElsaEdit = useCallback(
    (property) => {
      if (isAdmin) {
        const row = sortedLandlords.find((l) => l.id === property.landlordUserId);
        if (!row) return true;
        return String(row.tier_name ?? '').toUpperCase() !== 'FREE';
      }
      return allowsPropertyElsaAutoSendEdit(landlordLimits);
    },
    [isAdmin, sortedLandlords, landlordLimits]
  );

  const resolveAllowRestore = useCallback(
    (property) =>
      canRestoreDeletedProperty(isAdmin, property, sortedLandlords, landlordLimits, properties),
    [isAdmin, sortedLandlords, landlordLimits, properties]
  );

  const handleToggleElsaAutoSend = useCallback(
    async (property) => {
      if (!property?.id) return;
      const allowElsa = resolveAllowElsaEdit(property);
      const raw = elsaPropertyPolicyById[property.id];
      const current = allowElsa ? raw !== false : raw === true;
      setElsaPolicyTargetId(property.id);
      try {
        const token = await getAccessToken();
        await patchElsaPropertyPolicy(baseUrl, token, property.id, {
          auto_send_enabled_override: !current,
          require_review_all: false,
        });
        setElsaPropertyPolicyById((prev) => ({ ...prev, [property.id]: !current }));
        showFeedback(t('portalAdminProperties.messages.elsaPolicyUpdated'));
      } catch {
        showFeedback(t('portalAdminProperties.errors.elsaPolicyFailed', {
          error: t('portalSetup.errors.unknown'),
        }), 'error');
      } finally {
        setElsaPolicyTargetId('');
      }
    },
    [
      baseUrl,
      elsaPropertyPolicyById,
      getAccessToken,
      resolveAllowElsaEdit,
      showFeedback,
      t,
    ]
  );

  const filteredProperties = useMemo(
    () =>
      properties.filter((property) => {
        if (isAdmin && adminLandlordFilterId && property.landlordUserId !== adminLandlordFilterId) {
          return false;
        }
        if (visibilityFilter === 'visible' && !property.showOnApplyPage) return false;
        if (visibilityFilter === 'hidden' && property.showOnApplyPage) return false;
        if (visibilityFilter === 'deleted' && !property.deletedAt) return false;
        return true;
      }),
    [properties, isAdmin, adminLandlordFilterId, visibilityFilter]
  );

  const sortedFilteredProperties = useMemo(
    () =>
      [...filteredProperties].sort((a, b) => {
        const byAddress = collator.compare(String(a?.addressLine ?? ''), String(b?.addressLine ?? ''));
        if (byAddress !== 0) return byAddress;
        const byCityStateZip = collator.compare(String(a?.cityStateZip ?? ''), String(b?.cityStateZip ?? ''));
        if (byCityStateZip !== 0) return byCityStateZip;
        return collator.compare(String(a?.id ?? ''), String(b?.id ?? ''));
      }),
    [filteredProperties]
  );

  const gridEmptyMessage = useMemo(() => {
    if (isAdmin && adminLandlordFilterId && sortedFilteredProperties.length === 0 && properties.length > 0) {
      return t('portalAdminProperties.grid.emptyLandlordFilter');
    }
    return t('portalAdminProperties.grid.empty');
  }, [sortedFilteredProperties.length, properties.length, isAdmin, adminLandlordFilterId, t]);

  return (
    <Box sx={{ py: 4 }}>
      <Helmet>
        <title>{t('portalAdminProperties.title')}</title>
        <meta name="description" content={t('portalAdminProperties.metaDescription')} />
      </Helmet>

      <Stack spacing={3}>
        <Box>
          <Typography variant="h5" component="h2" fontWeight={700} gutterBottom>
            {t('portalAdminProperties.heading')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('portalAdminProperties.intro')}
          </Typography>
        </Box>

        {!isAuthenticated && (
          <StatusAlertSlot
            message={{ severity: 'warning', text: t('portalAdminProperties.errors.signInRequired') }}
          />
        )}
        {isAuthenticated && meStatus !== 'loading' && !canManage && (
          <StatusAlertSlot
            message={{ severity: 'error', text: t('portalAdminProperties.errors.landlordOrAdminOnly') }}
          />
        )}
        <StatusAlertSlot message={listError ? { severity: 'error', text: listError } : null} />

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Tooltip
            title={atPropertyCap ? t('portalSubscription.freeTier.propertyLimitReached') : ''}
          >
            <span>
              <Button
                type="button"
                variant="contained"
                startIcon={<Add />}
                disabled={!canManage || atPropertyCap}
                onClick={() => {
                  setEditingId(null);
                  const landlordIdForForm = isAdmin && adminLandlordFilterId ? adminLandlordFilterId : '';
                  const defaultShowOnApply = isFormApplyPageVisibilityEditable(
                    isAdmin,
                    landlordIdForForm,
                    sortedLandlords,
                    landlordLimits
                  );
                  const nextForm = {
                    ...EMPTY_FORM,
                    landlordUserId: landlordIdForForm,
                    showOnApplyPage: defaultShowOnApply,
                  };
                  setForm(nextForm);
                  setFieldErrors({});
                  setHarSearchId('');
                  formBaselineRef.current = { form: nextForm, harSearchId: '' };
                  setHarStatus('idle');
                  setHarMessage('');
                  setSubmitStatus('idle');
                  setSubmitError('');
                  setFormOpen(true);
                }}
              >
                {t('portalAdminProperties.form.showForm')}
              </Button>
            </span>
          </Tooltip>
          <FormControlLabel
            control={(
              <Switch
                checked={showDeleted}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setShowDeleted(checked);
                  setVisibilityFilter((prev) => {
                    if (checked) return 'deleted';
                    return prev === 'deleted' ? 'all' : prev;
                  });
                }}
              />
            )}
            label={t('portalAdminProperties.grid.showDeleted')}
          />
          <TextField
            select
            label={t('portalAdminProperties.grid.visibilityFilterLabel')}
            value={visibilityFilter}
            onChange={(e) => setVisibilityFilter(e.target.value)}
            size="small"
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="all">{t('portalAdminProperties.grid.visibilityFilterAll')}</MenuItem>
            <MenuItem value="visible">{t('portalAdminProperties.grid.visibilityFilterVisible')}</MenuItem>
            <MenuItem value="hidden">{t('portalAdminProperties.grid.visibilityFilterHidden')}</MenuItem>
            {showDeleted ? (
              <MenuItem value="deleted">{t('portalAdminProperties.grid.visibilityFilterDeleted')}</MenuItem>
            ) : null}
          </TextField>
          {isAdmin ? (
            <TextField
              select
              label={t('portalAdminProperties.grid.landlordFilterLabel')}
              value={adminLandlordFilterId}
              onChange={(e) => setAdminLandlordFilterId(e.target.value)}
              size="small"
              sx={{ minWidth: 260 }}
              disabled={landlordsStatus === 'loading'}
              helperText={
                landlordsStatus === 'error'
                  ? t('portalAdminProperties.grid.landlordFilterLoadError')
                  : ' '
              }
            >
              <MenuItem value="">{t('portalAdminProperties.grid.landlordFilterAll')}</MenuItem>
              {sortedLandlords.map((landlord) => (
                <MenuItem key={landlord.id} value={landlord.id}>
                  <PortalPersonWithAvatar
                    photoUrl={String(landlord.profile_photo_url ?? '').trim()}
                    firstName={landlord.first_name ?? ''}
                    lastName={landlord.last_name ?? ''}
                    size={28}
                    alignItems="center"
                  >
                    <Typography variant="body2" component="span">
                      {landlordRowLabel(landlord)}
                    </Typography>
                  </PortalPersonWithAvatar>
                </MenuItem>
              ))}
            </TextField>
          ) : null}
        </Box>

        {/* Properties Grid */}
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            sx={{ mb: 2 }}
          >
            <Typography variant="h6" fontWeight={600}>
              {t('portalAdminProperties.grid.heading')}
            </Typography>
            <PortalRefreshButton
              label={t('portalAdminProperties.grid.refreshButton')}
              onClick={() => void refresh()}
              disabled={!canManage}
              loading={listLoading}
            />
          </Stack>

          {listLoading && properties.length === 0 ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                {t('portalAdminProperties.grid.loading')}
              </Typography>
            </Box>
          ) : sortedFilteredProperties.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {gridEmptyMessage}
            </Typography>
          ) : (
            <Grid container spacing={2}>
              {sortedFilteredProperties.map((property) => (
                <Grid item xs={12} sm={6} md={4} key={property.id}>
                  <PropertyCard
                    property={property}
                    isAdmin={isAdmin}
                    landlordRow={sortedLandlords.find((l) => l.id === property.landlordUserId) ?? null}
                    allowVisibleEdit={resolveAllowVisibleEdit(property)}
                    allowElsaEdit={resolveAllowElsaEdit(property)}
                    allowRestore={resolveAllowRestore(property)}
                    syncingHar={syncHarTargetId === property.id}
                    onEdit={handleEdit}
                    onDelete={handleDeleteClick}
                    onRestore={handleRestoreClick}
                    onToggleVisible={handleVisibilityToggleClick}
                    onToggleElsaAutoSend={handleToggleElsaAutoSend}
                    elsaAutoSendEnabled={
                      resolveAllowElsaEdit(property)
                        ? elsaPropertyPolicyById[property.id] !== false
                        : elsaPropertyPolicyById[property.id] === true
                    }
                    updatingElsaPolicy={elsaPolicyTargetId === property.id}
                    showElsaAutoSend
                    onSyncHar={handleSyncHar}
                    t={t}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>
      </Stack>

      <Dialog
        open={formOpen}
        onClose={handleAttemptCloseForm}
        maxWidth="lg"
        fullWidth
        slotProps={{ paper: { sx: { backgroundImage: 'none' } } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography component="span">
            {editingId ? t('portalAdminProperties.form.editDialogTitle') : t('portalAdminProperties.form.addDialogTitle')}
          </Typography>
          <IconButton
            type="button"
            size="small"
            onClick={handleAttemptCloseForm}
            disabled={submitStatus === 'saving'}
            aria-label={t('portalDialogs.closeForm')}
          >
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                {t('portalAdminProperties.harSearch.heading')}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-start">
                <TextField
                  label={t('portalAdminProperties.harSearch.harIdLabel')}
                  helperText={t('portalAdminProperties.harSearch.harIdHelperText')}
                  value={harSearchId}
                  onChange={(e) => {
                    setHarSearchId(e.target.value);
                    setHarStatus('idle');
                    setHarMessage('');
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleHarSearch(); } }}
                  placeholder="8469293 or https://www.har.com/homedetail/…/8469293"
                  size="small"
                  sx={{ minWidth: 220, flexShrink: 0 }}
                  slotProps={{
                    input: {
                      endAdornment: harStatus === 'searching' ? (
                        <InputAdornment position="end">
                          <CircularProgress size={18} />
                        </InputAdornment>
                      ) : null,
                    },
                  }}
                />
                <Button
                  type="button"
                  variant="contained"
                  startIcon={<Search />}
                  onClick={() => void handleHarSearch()}
                  disabled={!harSearchId.trim() || harStatus === 'searching'}
                  sx={{ mt: { xs: 0, sm: '4px' }, whiteSpace: 'nowrap' }}
                >
                  {harStatus === 'searching'
                    ? t('portalAdminProperties.harSearch.searching')
                    : t('portalAdminProperties.harSearch.searchButton')}
                </Button>
              </Stack>
              <StatusAlertSlot
                message={harMessage
                  ? { severity: harStatus === 'found' ? 'success' : 'warning', text: harMessage }
                  : null}
              />
            </Paper>

            <Paper
              component="form"
              variant="outlined"
              onSubmit={(e) => void onSubmit(e)}
              sx={{ p: 3, borderRadius: 2 }}
            >
          <Stack spacing={2}>
            <Typography variant="h6" fontWeight={600}>
              {t('portalAdminProperties.form.heading')}
              {editingId && (
                <Chip
                  label={t('portalAdminProperties.grid.editButton')}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ ml: 1.5, verticalAlign: 'middle' }}
                />
              )}
            </Typography>

            <Grid container spacing={2}>
              {isAdmin && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    label={t('portalAdminProperties.form.landlord')}
                    value={form.landlordUserId}
                    onChange={onChange('landlordUserId')}
                    required
                    disabled={landlordsStatus === 'loading' || landlords.length === 0}
                    fullWidth
                    error={Boolean(fieldErrors.landlordUserId)}
                    helperText={
                      fieldErrors.landlordUserId
                        || (landlordsStatus === 'loading'
                          ? t('portalAdminProperties.form.landlordLoading')
                          : landlords.length === 0
                            ? t('portalAdminProperties.form.landlordEmpty')
                            : ' ')
                    }
                  >
                    <MenuItem value="">{t('portalAdminProperties.form.landlordSelect')}</MenuItem>
                    {sortedLandlords.map((landlord) => (
                      <MenuItem key={landlord.id} value={landlord.id}>
                        <PortalPersonWithAvatar
                          photoUrl={String(landlord.profile_photo_url ?? '').trim()}
                          firstName={landlord.first_name ?? ''}
                          lastName={landlord.last_name ?? ''}
                          size={28}
                          alignItems="center"
                        >
                          <Typography variant="body2" component="span">
                            {landlordRowLabel(landlord)}
                          </Typography>
                        </PortalPersonWithAvatar>
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              )}
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t('portalAdminProperties.form.addressLine')}
                  value={form.addressLine}
                  onChange={onChange('addressLine')}
                  required
                  fullWidth
                  error={Boolean(fieldErrors.addressLine)}
                  helperText={fieldErrors.addressLine || ' '}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t('portalAdminProperties.form.cityStateZip')}
                  value={form.cityStateZip}
                  onChange={onChange('cityStateZip')}
                  required
                  fullWidth
                  error={Boolean(fieldErrors.cityStateZip)}
                  helperText={fieldErrors.cityStateZip || ' '}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t('portalAdminProperties.form.monthlyRent')}
                  value={form.monthlyRentLabel}
                  onChange={onChange('monthlyRentLabel')}
                  fullWidth
                  helperText=" "
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t('portalAdminProperties.form.applyUrl')}
                  value={form.applyUrl}
                  onChange={onChange('applyUrl')}
                  fullWidth
                  type="url"
                  helperText=" "
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t('portalAdminProperties.form.harListingUrl')}
                  value={form.harListingUrl}
                  onChange={onChange('harListingUrl')}
                  fullWidth
                  type="url"
                  helperText=" "
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t('portalAdminProperties.form.detailLines')}
                  value={form.detailLinesText}
                  onChange={onChange('detailLinesText')}
                  fullWidth
                  multiline
                  minRows={3}
                  helperText=" "
                />
              </Grid>
            </Grid>

            {/* Photo Section */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {t('portalAdminProperties.form.photo')}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
                <Stack spacing={1} sx={{ flexShrink: 0 }}>
                  <Button
                    type="button"
                    variant="outlined"
                    size="small"
                    onClick={() => fileInputRef.current?.click()}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    {t('portalAdminProperties.form.photoUpload')}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handlePhotoFile}
                    tabIndex={-1}
                  />
                </Stack>
                <TextField
                  label={t('portalAdminProperties.form.photoUrlLabel')}
                  value={form.photoUrl}
                  onChange={onChange('photoUrl')}
                  size="small"
                  fullWidth
                  helperText=" "
                />
              </Stack>
              {form.photoUrl && (
                <Box sx={{ mt: 1.5, position: 'relative', display: 'inline-block' }}>
                  <Box
                    component="img"
                    src={form.photoUrl}
                    alt={t('portalAdminProperties.form.photoPreview')}
                    sx={{
                      height: 120,
                      maxWidth: 200,
                      objectFit: 'cover',
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      display: 'block',
                    }}
                  />
                  <IconButton
                    type="button"
                    size="small"
                    aria-label={t('portalAdminProperties.form.cancel')}
                    onClick={() => setForm((prev) => ({ ...prev, photoUrl: '' }))}
                    sx={{
                      position: 'absolute',
                      top: 4,
                      insetInlineEnd: 4,
                      backgroundColor: 'background.paper',
                      '&:hover': { backgroundColor: 'background.paper' },
                    }}
                  >
                    <Close fontSize="small" />
                  </IconButton>
                </Box>
              )}
            </Box>

            <Tooltip
              title={!applyPageVisibilityEditable ? t('portalSubscription.freeTier.featureDisabled') : ''}
            >
              <span>
                <FormControlLabel
                  control={(
                    <Switch
                      checked={form.showOnApplyPage}
                      onChange={onChange('showOnApplyPage')}
                      disabled={!applyPageVisibilityEditable}
                    />
                  )}
                  label={t('portalAdminProperties.form.showOnApplyPage')}
                />
              </span>
            </Tooltip>

            <StatusAlertSlot message={submitError ? { severity: 'error', text: submitError } : null} />

            <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
              <Button
                type="submit"
                variant="contained"
                disabled={!canManage || submitStatus === 'saving'}
                startIcon={submitStatus === 'saving' ? <CircularProgress size={16} /> : editingId ? null : <Add />}
              >
                {submitStatus === 'saving'
                  ? t('portalAdminProperties.form.saving')
                  : editingId
                    ? t('portalAdminProperties.form.saveChanges')
                    : t('portalAdminProperties.form.createProperty')}
              </Button>
              <Button
                type="button"
                variant="outlined"
                onClick={handleAttemptCloseForm}
              >
                {t('portalAdminProperties.form.cancel')}
              </Button>
            </Stack>
          </Stack>
            </Paper>
          </Stack>
        </DialogContent>
      </Dialog>
      <PortalConfirmDialog
        open={discardDialogOpen}
        onClose={() => setDiscardDialogOpen(false)}
        onConfirm={() => {
          setDiscardDialogOpen(false);
          resetForm();
        }}
        title={t('portalDialogs.unsavedChanges.title')}
        body={t('portalDialogs.unsavedChanges.body')}
        confirmLabel={t('portalDialogs.unsavedChanges.discard')}
        cancelLabel={t('portalDialogs.unsavedChanges.keepEditing')}
        confirmColor="warning"
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => { if (deleteStatus !== 'deleting') setDeleteTarget(null); }}
        slotProps={{ paper: { sx: { backgroundImage: 'none' } } }}
      >
        <DialogTitle>{t('portalAdminProperties.grid.deleteConfirmTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('portalAdminProperties.grid.deleteConfirmBody', {
              address: deleteTarget?.addressLine ?? '',
            })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            type="button"
            onClick={() => setDeleteTarget(null)}
            disabled={deleteStatus === 'deleting'}
          >
            {t('portalAdminProperties.grid.deleteCancel')}
          </Button>
          <Button
            type="button"
            color="error"
            variant="contained"
            disabled={deleteStatus === 'deleting'}
            startIcon={deleteStatus === 'deleting' ? <CircularProgress size={16} /> : null}
            onClick={() => void handleDeleteConfirm()}
          >
            {t('portalAdminProperties.grid.deleteConfirmAction')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(restoreTarget)}
        onClose={() => { if (restoreStatus !== 'restoring') setRestoreTarget(null); }}
        slotProps={{ paper: { sx: { backgroundImage: 'none' } } }}
      >
        <DialogTitle>{t('portalAdminProperties.grid.restoreConfirmTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('portalAdminProperties.grid.restoreConfirmBody', {
              address: restoreTarget?.addressLine ?? '',
            })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            type="button"
            onClick={() => setRestoreTarget(null)}
            disabled={restoreStatus === 'restoring'}
          >
            {t('portalAdminProperties.grid.restoreCancel')}
          </Button>
          <Button
            type="button"
            variant="contained"
            disabled={restoreStatus === 'restoring'}
            startIcon={restoreStatus === 'restoring' ? <CircularProgress size={16} /> : null}
            onClick={() => void handleRestoreConfirm()}
          >
            {t('portalAdminProperties.grid.restoreConfirmAction')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(visibleToggleTarget)}
        onClose={() => { if (visibleToggleStatus !== 'saving') setVisibleToggleTarget(null); }}
        slotProps={{ paper: { sx: { backgroundImage: 'none' } } }}
      >
        <DialogTitle>{t('portalAdminProperties.grid.visibleConfirmTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('portalAdminProperties.grid.visibleConfirmBody', {
              address: visibleToggleTarget?.addressLine ?? '',
              value: visibleToggleTarget?.showOnApplyPage
                ? t('portalAdminProperties.grid.visibilityOffLabel')
                : t('portalAdminProperties.grid.visibilityOnLabel'),
            })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            type="button"
            onClick={() => setVisibleToggleTarget(null)}
            disabled={visibleToggleStatus === 'saving'}
          >
            {t('portalAdminProperties.grid.visibleCancel')}
          </Button>
          <Button
            type="button"
            variant="contained"
            disabled={visibleToggleStatus === 'saving'}
            startIcon={visibleToggleStatus === 'saving' ? <CircularProgress size={16} /> : null}
            onClick={() => void handleVisibilityToggleConfirm()}
          >
            {t('portalAdminProperties.grid.visibleConfirmAction')}
          </Button>
        </DialogActions>
      </Dialog>

      <PortalFeedbackSnackbar feedback={feedback} onClose={closeFeedback} />
    </Box>
  );
};

export default PortalAdminProperties;
