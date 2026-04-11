import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Switch,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import BlockIcon from '@mui/icons-material/Block';
import EditIcon from '@mui/icons-material/Edit';
import Refresh from '@mui/icons-material/Refresh';
import ReplayIcon from '@mui/icons-material/Replay';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { Role } from '../domain/constants.js';
import { validatePersonBasics, validatePersonField } from '../portalPersonValidation';
import { resolveRole, normalizeRole } from '../portalUtils';
import { fetchLandlords, createLandlord, patchResource } from '../lib/portalApiClient';
import PortalConfirmDialog from './PortalConfirmDialog';
import StatusAlertSlot from './StatusAlertSlot';
import { usePortalFeedback } from '../hooks/usePortalFeedback';
import PortalFeedbackSnackbar from './PortalFeedbackSnackbar';

function toFriendlyErrorMessage(t, fallbackKey) {
  return t(fallbackKey);
}

function displayName(landlord) {
  const first = String(landlord.first_name ?? '').trim();
  const last = String(landlord.last_name ?? '').trim();
  return `${first} ${last}`.trim() || '—';
}

const PortalAdminLandlords = () => {
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
  const canUseModule = isAuthenticated && isAdmin && Boolean(baseUrl);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', phone: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [editingLandlordId, setEditingLandlordId] = useState(null);
  const [editForm, setEditForm] = useState({ email: '', firstName: '', lastName: '', phone: '' });
  const [editFieldErrors, setEditFieldErrors] = useState({});
  const [showInactive, setShowInactive] = useState(false);
  const [submitState, setSubmitState] = useState({ status: 'idle', detail: '' });
  const [landlordsState, setLandlordsState] = useState({ status: 'idle', detail: '', landlords: [] });
  const { feedback, showFeedback, closeFeedback } = usePortalFeedback();

  // Confirmation dialog for toggle active/inactive
  const [confirmDialog, setConfirmDialog] = useState({ open: false, landlordId: null, activate: false, name: '' });

  const loadLandlords = useCallback(async () => {
    if (!canUseModule || !baseUrl) {
      setLandlordsState({ status: 'idle', detail: '', landlords: [] });
      return;
    }
    setLandlordsState((prev) => ({ ...prev, status: 'loading', detail: '' }));
    try {
      const accessToken = await getAccessToken();
      const payload = await fetchLandlords(baseUrl, accessToken, { includeInactive: showInactive });
      setLandlordsState({
        status: 'ok',
        detail: '',
        landlords: Array.isArray(payload?.landlords) ? payload.landlords : [],
      });
    } catch (error) {
      handleApiForbidden(error);
      const detail = toFriendlyErrorMessage(t, 'portalAdminLandlords.errors.loadFailed');
      setLandlordsState({ status: 'error', detail, landlords: [] });
    }
  }, [baseUrl, canUseModule, getAccessToken, handleApiForbidden, showInactive]);

  useEffect(() => {
    void loadLandlords();
  }, [loadLandlords]);

  const formErrors = useMemo(
    () =>
      validatePersonBasics(form, t, {
        keys: {
          firstNameRequired: 'portalAdminLandlords.errors.firstNameRequired',
          lastNameRequired: 'portalAdminLandlords.errors.lastNameRequired',
          emailRequired: 'portalAdminLandlords.errors.emailRequired',
          emailInvalid: 'portalAdminLandlords.errors.emailInvalid',
        },
      }),
    [form, t]
  );
  const isFormValid = Object.keys(formErrors).length === 0;
  const editFormErrors = useMemo(
    () =>
      validatePersonBasics(editForm, t, {
        keys: {
          firstNameRequired: 'portalAdminLandlords.errors.firstNameRequired',
          lastNameRequired: 'portalAdminLandlords.errors.lastNameRequired',
          emailRequired: 'portalAdminLandlords.errors.emailRequired',
          emailInvalid: 'portalAdminLandlords.errors.emailInvalid',
        },
      }),
    [editForm, t]
  );
  const isEditFormValid = Object.keys(editFormErrors).length === 0;
  useEffect(() => {
    if (submitState.status !== 'ok' || !submitState.detail) return;
    showFeedback(submitState.detail, 'success');
    setSubmitState({ status: 'idle', detail: '' });
  }, [showFeedback, submitState]);
  useEffect(() => {
    if (submitState.status === 'error' && submitState.detail) {
      showFeedback(submitState.detail, 'error');
      setSubmitState((prev) => (prev.status === 'error' ? { status: 'idle', detail: '' } : prev));
    }
  }, [showFeedback, submitState]);
  useEffect(() => {
    if (landlordsState.status === 'error' && landlordsState.detail) {
      showFeedback(landlordsState.detail, 'error');
    }
  }, [landlordsState.detail, landlordsState.status, showFeedback]);

  const onToggleActive = async (landlordId, active) => {
    if (!canUseModule || !baseUrl) return;
    setSubmitState({ status: 'saving', detail: '' });
    try {
      const accessToken = await getAccessToken();
      await patchResource(
        baseUrl,
        accessToken,
        `/api/portal/admin/landlords/${landlordId}`,
        { active }
      );
      setSubmitState({
        status: 'ok',
        detail: active
          ? t('portalAdminLandlords.messages.reactivated')
          : t('portalAdminLandlords.messages.deactivated'),
      });
      void loadLandlords();
    } catch (error) {
      handleApiForbidden(error);
      const detail = toFriendlyErrorMessage(t, 'portalAdminLandlords.errors.saveFailed');
      setSubmitState({ status: 'error', detail });
    }
  };

  const openConfirmDialog = (landlord, activate) => {
    setConfirmDialog({
      open: true,
      landlordId: landlord.id,
      activate,
      name: displayName(landlord),
    });
  };

  const handleConfirmToggle = () => {
    const { landlordId, activate } = confirmDialog;
    setConfirmDialog({ open: false, landlordId: null, activate: false, name: '' });
    void onToggleActive(landlordId, activate);
  };

  const onChange = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    if (submitState.status !== 'saving') {
      setSubmitState({ status: 'idle', detail: '' });
    }
  };

  const onBlur = (field) => (event) => {
    const message = validatePersonField(field, event.target.value, t, {
      keys: {
        firstNameRequired: 'portalAdminLandlords.errors.firstNameRequired',
        lastNameRequired: 'portalAdminLandlords.errors.lastNameRequired',
        emailRequired: 'portalAdminLandlords.errors.emailRequired',
        emailInvalid: 'portalAdminLandlords.errors.emailInvalid',
      },
    });
    setFieldErrors((prev) => ({ ...prev, [field]: message }));
  };

  const beginEdit = (landlord) => {
    setEditingLandlordId(landlord.id);
    setEditForm({
      email: String(landlord.email ?? ''),
      firstName: String(landlord.first_name ?? ''),
      lastName: String(landlord.last_name ?? ''),
      phone: String(landlord.phone ?? ''),
    });
    setEditFieldErrors({});
  };

  const cancelEdit = () => {
    setEditingLandlordId(null);
    setEditForm({ email: '', firstName: '', lastName: '', phone: '' });
    setEditFieldErrors({});
  };

  const closeCreateDialog = () => {
    setCreateDialogOpen(false);
    setFieldErrors({});
    setForm({ email: '', firstName: '', lastName: '', phone: '' });
  };

  const onEditChange = (field) => (event) => {
    const value = event.target.value;
    setEditForm((prev) => ({ ...prev, [field]: value }));
    setEditFieldErrors((prev) => ({ ...prev, [field]: '' }));
    if (submitState.status !== 'saving') {
      setSubmitState({ status: 'idle', detail: '' });
    }
  };

  const onEditBlur = (field) => (event) => {
    const message = validatePersonField(field, event.target.value, t, {
      keys: {
        firstNameRequired: 'portalAdminLandlords.errors.firstNameRequired',
        lastNameRequired: 'portalAdminLandlords.errors.lastNameRequired',
        emailRequired: 'portalAdminLandlords.errors.emailRequired',
        emailInvalid: 'portalAdminLandlords.errors.emailInvalid',
      },
    });
    setEditFieldErrors((prev) => ({ ...prev, [field]: message }));
  };

  const onEditSubmit = async (event) => {
    event.preventDefault();
    if (!canUseModule || !baseUrl || !editingLandlordId) return;
    if (!isEditFormValid) {
      setEditFieldErrors(editFormErrors);
      setSubmitState({
        status: 'error',
        detail: t('portalAdminLandlords.errors.validation'),
      });
      return;
    }
    setSubmitState({ status: 'saving', detail: '' });
    try {
      const accessToken = await getAccessToken();
      await patchResource(
        baseUrl,
        accessToken,
        `/api/portal/admin/landlords/${editingLandlordId}`,
        {
          email: editForm.email.trim().toLowerCase(),
          first_name: editForm.firstName.trim(),
          last_name: editForm.lastName.trim(),
          phone: editForm.phone.trim() || null,
        }
      );
      setSubmitState({
        status: 'ok',
        detail: t('portalAdminLandlords.messages.landlordUpdated'),
      });
      cancelEdit();
      void loadLandlords();
    } catch (error) {
      handleApiForbidden(error);
      const detail = toFriendlyErrorMessage(t, 'portalAdminLandlords.errors.saveFailed');
      setSubmitState({ status: 'error', detail });
    }
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!canUseModule || !baseUrl) return;
    if (!isFormValid) {
      setFieldErrors(formErrors);
      setSubmitState({
        status: 'error',
        detail: t('portalAdminLandlords.errors.validation'),
      });
      return;
    }
    const email = form.email.trim().toLowerCase();
    setSubmitState({ status: 'saving', detail: '' });
    try {
      const accessToken = await getAccessToken();
      await createLandlord(baseUrl, accessToken, {
        email,
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        phone: form.phone.trim() || null,
      });
      setSubmitState({
        status: 'ok',
        detail: t('portalAdminLandlords.messages.landlordSaved'),
      });
      setFieldErrors({});
      setForm({ email: '', firstName: '', lastName: '', phone: '' });
      setCreateDialogOpen(false);
      void loadLandlords();
    } catch (error) {
      handleApiForbidden(error);
      const detail = toFriendlyErrorMessage(t, 'portalAdminLandlords.errors.saveFailed');
      setSubmitState({ status: 'error', detail });
    }
  };

  return (
    <Box sx={{ py: 4 }}>
      <Helmet>
        <title>{t('portalAdminLandlords.title')}</title>
        <meta name="description" content={t('portalAdminLandlords.metaDescription')} />
      </Helmet>
      <Stack spacing={2}>
        <Typography variant="h1" sx={{ fontSize: '2rem' }}>
          {t('portalAdminLandlords.heading')}
        </Typography>
        <Typography color="text.secondary">{t('portalAdminLandlords.intro')}</Typography>

        <StatusAlertSlot
          message={!baseUrl ? { severity: 'warning', text: t('portalAdminLandlords.errors.apiUnavailable') } : null}
        />
        <StatusAlertSlot
          message={!isAuthenticated ? { severity: 'warning', text: t('portalAdminLandlords.errors.signInRequired') } : null}
        />
        {isAuthenticated && meStatus !== 'loading' && !isAdmin && (
          <StatusAlertSlot message={{ severity: 'error', text: t('portalAdminLandlords.errors.adminOnly') }} />
        )}

        <Box>
          <Button
            type="button"
            variant="contained"
            startIcon={<AddIcon />}
            disabled={!canUseModule}
            onClick={() => setCreateDialogOpen(true)}
          >
            {t('portalAdminLandlords.form.showForm')}
          </Button>
        </Box>

        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            p: 2.5,
            backgroundColor: 'background.paper',
          }}
        >
          <Stack spacing={1.5}>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Typography variant="h2" sx={{ fontSize: '1.25rem' }}>
                {t('portalAdminLandlords.list.heading')}
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <FormControlLabel
                  control={(
                    <Switch
                      size="small"
                      checked={showInactive}
                      onChange={(event) => setShowInactive(event.target.checked)}
                      disabled={!canUseModule || landlordsState.status === 'loading'}
                    />
                  )}
                  label={t('portalAdminLandlords.list.showInactive')}
                  sx={{ mr: 0 }}
                />
                <Button
                  type="button"
                  size="small"
                  variant="outlined"
                  disabled={!canUseModule || landlordsState.status === 'loading'}
                  onClick={() => void loadLandlords()}
                  startIcon={
                    landlordsState.status === 'loading'
                      ? <CircularProgress size={16} />
                      : <Refresh fontSize="small" />
                  }
                  sx={{ textTransform: 'none' }}
                >
                  {t('portalAdminLandlords.list.refreshLandlordList')}
                </Button>
              </Stack>
            </Stack>
            {landlordsState.status === 'loading' && landlordsState.landlords.length === 0 && (
              <Typography color="text.secondary">{t('portalAdminLandlords.list.loading')}</Typography>
            )}
            <StatusAlertSlot
              message={landlordsState.status === 'error'
                ? { severity: 'error', text: landlordsState.detail }
                : null}
            />
            {landlordsState.status !== 'loading' && landlordsState.landlords.length === 0 && (
              <Typography color="text.secondary">{t('portalAdminLandlords.list.empty')}</Typography>
            )}
            {landlordsState.landlords.map((landlord) => (
              <Box
                key={landlord.id}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1.5,
                  p: 1.5,
                }}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack spacing={0.5}>
                      <Typography sx={{ fontWeight: 600 }}>{landlord.email}</Typography>
                      <Typography color="text.secondary">
                        {t('portalAdminLandlords.list.name')}: {displayName(landlord)}
                      </Typography>
                      <Typography color="text.secondary">
                        {t('portalAdminLandlords.list.status')}: {landlord.status}
                      </Typography>
                    </Stack>
                  </Box>
                  <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end', flexShrink: 0 }}>
                    <IconButton
                      type="button"
                      size="small"
                      onClick={() => beginEdit(landlord)}
                      aria-label={t('portalAdminLandlords.actions.edit')}
                      disabled={!canUseModule || submitState.status === 'saving'}
                      color="primary"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    {String(landlord.status ?? '').toUpperCase() === 'DISABLED' ? (
                      <Tooltip title={t('portalAdminLandlords.actions.reactivate')}>
                        <span>
                          <IconButton
                            type="button"
                            size="small"
                            color="primary"
                            onClick={() => openConfirmDialog(landlord, true)}
                            aria-label={t('portalAdminLandlords.actions.reactivate')}
                            disabled={!canUseModule || submitState.status === 'saving'}
                          >
                            <ReplayIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    ) : (
                      <Tooltip title={t('portalAdminLandlords.actions.deactivate')}>
                        <span>
                          <IconButton
                            type="button"
                            size="small"
                            color="warning"
                            onClick={() => openConfirmDialog(landlord, false)}
                            aria-label={t('portalAdminLandlords.actions.deactivate')}
                            disabled={!canUseModule || submitState.status === 'saving'}
                          >
                            <BlockIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                  </Stack>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Box>
      </Stack>

      <PortalConfirmDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={handleConfirmToggle}
        title={
          confirmDialog.activate
            ? t('portalAdminLandlords.confirmReactivate.title')
            : t('portalAdminLandlords.confirmDeactivate.title')
        }
        body={
          confirmDialog.activate
            ? t('portalAdminLandlords.confirmReactivate.body', { name: confirmDialog.name })
            : t('portalAdminLandlords.confirmDeactivate.body', { name: confirmDialog.name })
        }
        confirmLabel={
          confirmDialog.activate
            ? t('portalAdminLandlords.actions.reactivate')
            : t('portalAdminLandlords.actions.deactivate')
        }
        cancelLabel={t('portalAdminLandlords.actions.cancel')}
        confirmColor={confirmDialog.activate ? 'primary' : 'warning'}
      />
      <Dialog
        open={createDialogOpen}
        onClose={submitState.status === 'saving' ? undefined : closeCreateDialog}
        fullWidth
        maxWidth="sm"
      >
        <Box component="form" onSubmit={onSubmit}>
          <DialogTitle>{t('portalAdminLandlords.form.heading')}</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={1.25}>
              <TextField
                label={t('portalAdminLandlords.form.email')}
                value={form.email}
                onChange={onChange('email')}
                onBlur={onBlur('email')}
                required
                type="email"
                autoComplete="email"
                error={Boolean(fieldErrors.email)}
                helperText={fieldErrors.email || ' '}
                fullWidth
              />
              <TextField
                label={t('portalAdminLandlords.form.firstName')}
                value={form.firstName}
                onChange={onChange('firstName')}
                onBlur={onBlur('firstName')}
                required
                error={Boolean(fieldErrors.firstName)}
                helperText={fieldErrors.firstName || ' '}
                fullWidth
              />
              <TextField
                label={t('portalAdminLandlords.form.lastName')}
                value={form.lastName}
                onChange={onChange('lastName')}
                onBlur={onBlur('lastName')}
                required
                error={Boolean(fieldErrors.lastName)}
                helperText={fieldErrors.lastName || ' '}
                fullWidth
              />
              <TextField
                label={t('portalAdminLandlords.form.phone')}
                value={form.phone}
                onChange={onChange('phone')}
                fullWidth
                autoComplete="tel"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              type="button"
              onClick={closeCreateDialog}
              disabled={submitState.status === 'saving'}
            >
              {t('portalAdminLandlords.actions.cancel')}
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!canUseModule || submitState.status === 'saving' || !isFormValid}
            >
              {submitState.status === 'saving'
                ? t('portalAdminLandlords.form.sending')
                : t('portalAdminLandlords.form.saveLandlord')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      <Dialog
        open={Boolean(editingLandlordId)}
        onClose={submitState.status === 'saving' ? undefined : cancelEdit}
        fullWidth
        maxWidth="sm"
      >
        <Box component="form" onSubmit={onEditSubmit}>
          <DialogTitle>{t('portalAdminLandlords.form.editHeading')}</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={1.25}>
              <TextField
                label={t('portalAdminLandlords.form.email')}
                value={editForm.email}
                onChange={onEditChange('email')}
                onBlur={onEditBlur('email')}
                required
                type="email"
                autoComplete="email"
                error={Boolean(editFieldErrors.email)}
                helperText={editFieldErrors.email || ' '}
                fullWidth
              />
              <TextField
                label={t('portalAdminLandlords.form.firstName')}
                value={editForm.firstName}
                onChange={onEditChange('firstName')}
                onBlur={onEditBlur('firstName')}
                required
                error={Boolean(editFieldErrors.firstName)}
                helperText={editFieldErrors.firstName || ' '}
                fullWidth
              />
              <TextField
                label={t('portalAdminLandlords.form.lastName')}
                value={editForm.lastName}
                onChange={onEditChange('lastName')}
                onBlur={onEditBlur('lastName')}
                required
                error={Boolean(editFieldErrors.lastName)}
                helperText={editFieldErrors.lastName || ' '}
                fullWidth
              />
              <TextField
                label={t('portalAdminLandlords.form.phone')}
                value={editForm.phone}
                onChange={onEditChange('phone')}
                fullWidth
                autoComplete="tel"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              type="button"
              onClick={cancelEdit}
              disabled={submitState.status === 'saving'}
            >
              {t('portalAdminLandlords.actions.cancel')}
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!canUseModule || submitState.status === 'saving' || !isEditFormValid}
            >
              {submitState.status === 'saving'
                ? t('portalAdminLandlords.form.sending')
                : t('portalAdminLandlords.actions.saveChanges')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      <PortalFeedbackSnackbar feedback={feedback} onClose={closeFeedback} />
    </Box>
  );
};

export default PortalAdminLandlords;
