import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import {
  Alert,
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
  Snackbar,
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
import {
  listPropertiesApi,
  createPropertyApi,
  updatePropertyApi,
  patchPropertyApi,
  deletePropertyApi,
  restorePropertyApi,
  apiPropertyToDisplay,
} from '../lib/propertiesApiClient';
import { listingFromHarPreviewPayload, parseHarInput } from '../portalHarPreviewParse';
import { fetchHarPreview, fetchLandlords } from '../lib/portalApiClient';

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
  syncingHar,
  onEdit,
  onDelete,
  onRestore,
  onToggleVisible,
  onSyncHar,
  t,
}) => {
  const hasPhoto = Boolean(property.photoUrl);
  const isDeleted = Boolean(property.deletedAt);
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
            <Typography variant="caption" color="text.secondary">
              {t('portalAdminProperties.grid.landlord')}: {property.landlordName}
            </Typography>
          )}
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, minHeight: 32 }}>
          <FormControlLabel
            control={(
              <Switch
                size="small"
                checked={Boolean(property.showOnApplyPage)}
                disabled={isDeleted}
                onChange={() => onToggleVisible(property)}
              />
            )}
            label={t('portalAdminProperties.grid.visible')}
            sx={{ m: 0 }}
          />
          {isDeleted ? (
            <Chip label={t('portalAdminProperties.grid.deleted')} size="small" color="warning" variant="outlined" />
          ) : null}
        </Stack>
      </CardContent>
      <Box sx={{ px: 2, pb: 2, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        {isDeleted ? (
          <Tooltip title={t('portalAdminProperties.grid.restoreButton')}>
            <span>
              <IconButton
                type="button"
                size="small"
                color="primary"
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
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [landlords, setLandlords] = useState([]);
  const [landlordsStatus, setLandlordsStatus] = useState('idle'); // idle | loading | ok | error

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteStatus, setDeleteStatus] = useState('idle'); // idle | deleting | error
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoreStatus, setRestoreStatus] = useState('idle'); // idle | restoring | error
  const [visibleToggleTarget, setVisibleToggleTarget] = useState(null);
  const [visibleToggleStatus, setVisibleToggleStatus] = useState('idle'); // idle | saving | error
  const [syncHarTargetId, setSyncHarTargetId] = useState('');
  const fileInputRef = useRef(null);

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
      const rows = await listPropertiesApi(baseUrl, token, { includeDeleted: showDeleted });
      if (signal?.aborted) return;
      setProperties(rows.map(apiPropertyToDisplay));
    } catch (err) {
      if (signal?.aborted) return;
      const msg = err?.code ? `${err.status} (${err.code})` : String(err?.message ?? err);
      setListError(tRef.current('portalAdminProperties.errors.loadFailed', { error: msg }));
    } finally {
      if (!signal?.aborted) setListLoading(false);
    }
  }, [isAuthenticated, baseUrl, showDeleted]);

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

  const showSnack = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

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
  };

  const handleEdit = (property) => {
    setForm(propertyToForm(property));
    setEditingId(property.id);
    setFormOpen(true);
    setHarSearchId(property.harId ?? '');
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
      showSnack(t('portalAdminProperties.messages.deleted'), 'info');
      void refresh();
    } catch (err) {
      const msg = err?.code ? `${err.status} (${err.code})` : String(err?.message ?? err);
      setDeleteStatus('error');
      showSnack(t('portalAdminProperties.errors.deleteFailed', { error: msg }), 'error');
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
      showSnack(t('portalAdminProperties.messages.restored'));
      void refresh();
    } catch (err) {
      const msg = err?.code ? `${err.status} (${err.code})` : String(err?.message ?? err);
      setRestoreStatus('error');
      showSnack(t('portalAdminProperties.errors.restoreFailed', { error: msg }), 'error');
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
      showSnack(t('portalAdminProperties.messages.visibilityUpdated'));
      void refresh();
    } catch (err) {
      const msg = err?.code ? `${err.status} (${err.code})` : String(err?.message ?? err);
      setVisibleToggleStatus('error');
      showSnack(t('portalAdminProperties.errors.visibilityFailed', { error: msg }), 'error');
    }
  };

  const handleSyncHar = async (property) => {
    if (!property?.id || !property?.harId) return;
    setSyncHarTargetId(property.id);
    try {
      const token = await getAccessToken();
      await patchPropertyApi(baseUrl, token, property.id, { refresh_har: true });
      showSnack(t('portalAdminProperties.messages.harSynced'));
      void refresh();
    } catch (err) {
      const msg = err?.code ? `${err.status} (${err.code})` : String(err?.message ?? err);
      showSnack(t('portalAdminProperties.errors.syncHarFailed', { error: msg }), 'error');
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
    try {
      const token = await getAccessToken();
      if (editingId) {
        await updatePropertyApi(baseUrl, token, editingId, record);
        showSnack(t('portalAdminProperties.messages.updated'));
      } else {
        await createPropertyApi(baseUrl, token, record);
        showSnack(t('portalAdminProperties.messages.added'));
      }
      resetForm();
      void refresh();
    } catch (err) {
      const msg = err?.code ? `${err.status} (${err.code})` : String(err?.message ?? err);
      setSubmitStatus('error');
      setSubmitError(t('portalAdminProperties.errors.saveFailed', { error: msg }));
    }
  };

  const filteredProperties = properties.filter((property) => {
    if (visibilityFilter === 'visible' && !property.showOnApplyPage) return false;
    if (visibilityFilter === 'hidden' && property.showOnApplyPage) return false;
    if (visibilityFilter === 'deleted' && !property.deletedAt) return false;
    return true;
  });

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
          <Alert severity="warning">{t('portalAdminProperties.errors.signInRequired')}</Alert>
        )}
        {isAuthenticated && meStatus !== 'loading' && !canManage && (
          <Alert severity="error">{t('portalAdminProperties.errors.landlordOrAdminOnly')}</Alert>
        )}
        {listError && <Alert severity="error">{listError}</Alert>}

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            type="button"
            variant="contained"
            startIcon={<Add />}
            disabled={!canManage}
            onClick={() => {
              setEditingId(null);
              setForm({ ...EMPTY_FORM });
              setFieldErrors({});
              setHarSearchId('');
              setHarStatus('idle');
              setHarMessage('');
              setSubmitStatus('idle');
              setSubmitError('');
              setFormOpen(true);
            }}
          >
            {t('portalAdminProperties.form.showForm')}
          </Button>
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
        </Box>

        {/* Properties Grid */}
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            {t('portalAdminProperties.grid.heading')}
          </Typography>

          {listLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                {t('portalAdminProperties.grid.loading')}
              </Typography>
            </Box>
          ) : filteredProperties.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t('portalAdminProperties.grid.empty')}
            </Typography>
          ) : (
            <Grid container spacing={2}>
              {filteredProperties.map((property) => (
                <Grid item xs={12} sm={6} md={4} key={property.id}>
                  <PropertyCard
                    property={property}
                    isAdmin={isAdmin}
                    syncingHar={syncHarTargetId === property.id}
                    onEdit={handleEdit}
                    onDelete={handleDeleteClick}
                    onRestore={handleRestoreClick}
                    onToggleVisible={handleVisibilityToggleClick}
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
        onClose={resetForm}
        maxWidth="lg"
        fullWidth
        slotProps={{ paper: { sx: { backgroundImage: 'none' } } }}
      >
        <DialogTitle>
          {editingId ? t('portalAdminProperties.form.editDialogTitle') : t('portalAdminProperties.form.addDialogTitle')}
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
              {harMessage && (
                <Alert
                  severity={harStatus === 'found' ? 'success' : 'warning'}
                  sx={{ mt: 1.5 }}
                >
                  {harMessage}
                </Alert>
              )}
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
                    {landlords.map((landlord) => {
                      const first = String(landlord.first_name ?? '').trim();
                      const last = String(landlord.last_name ?? '').trim();
                      const name = `${first} ${last}`.trim() || String(landlord.email ?? '').trim();
                      return (
                        <MenuItem key={landlord.id} value={landlord.id}>
                          {name}
                        </MenuItem>
                      );
                    })}
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

            <FormControlLabel
              control={
                <Switch
                  checked={form.showOnApplyPage}
                  onChange={onChange('showOnApplyPage')}
                />
              }
              label={t('portalAdminProperties.form.showOnApplyPage')}
            />

            {submitError && <Alert severity="error">{submitError}</Alert>}

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
                onClick={resetForm}
              >
                {t('portalAdminProperties.form.cancel')}
              </Button>
            </Stack>
          </Stack>
            </Paper>
          </Stack>
        </DialogContent>
      </Dialog>

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

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PortalAdminProperties;
