import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import {
  Box,
  Button,
  CircularProgress,
  Collapse,
  FormControlLabel,
  Switch,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import Refresh from '@mui/icons-material/Refresh';
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

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '' });
  const [fieldErrors, setFieldErrors] = useState({});
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
      const detail =
        error && typeof error === 'object' && typeof error.message === 'string'
          ? error.message
          : error instanceof Error
            ? error.message
            : 'request_failed';
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
      const detail =
        error && typeof error === 'object' && typeof error.message === 'string'
          ? error.message
          : error instanceof Error
            ? error.message
            : 'request_failed';
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
      });
      setSubmitState({
        status: 'ok',
        detail: t('portalAdminLandlords.messages.landlordSaved'),
      });
      setFieldErrors({});
      setForm({ email: '', firstName: '', lastName: '' });
      setCreateOpen(false);
      void loadLandlords();
    } catch (error) {
      handleApiForbidden(error);
      const detail =
        error && typeof error === 'object' && typeof error.message === 'string'
          ? error.message
          : error instanceof Error
            ? error.message
            : 'request_failed';
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
            variant={createOpen ? 'outlined' : 'contained'}
            startIcon={<AddIcon />}
            disabled={!canUseModule}
            onClick={() => setCreateOpen((prev) => !prev)}
            sx={{ mb: createOpen ? 1 : 0 }}
          >
            {createOpen
              ? t('portalAdminLandlords.form.hideForm')
              : t('portalAdminLandlords.form.showForm')}
          </Button>
          <Collapse in={createOpen} unmountOnExit>
            <Box
              component="form"
              onSubmit={onSubmit}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                p: 2.5,
                backgroundColor: 'background.paper',
              }}
            >
              <Stack spacing={1.5}>
                <Typography variant="h2" sx={{ fontSize: '1.25rem' }}>
                  {t('portalAdminLandlords.form.heading')}
                </Typography>
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
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="flex-end"
                  spacing={1.25}
                  sx={{ flexWrap: 'wrap', rowGap: 1 }}
                >
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={!canUseModule || submitState.status === 'saving' || !isFormValid}
                  >
                    {submitState.status === 'saving'
                      ? t('portalAdminLandlords.form.sending')
                      : t('portalAdminLandlords.form.saveLandlord')}
                  </Button>
                </Stack>
              </Stack>
            </Box>
          </Collapse>
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
                <Stack spacing={0.5}>
                  <Typography sx={{ fontWeight: 600 }}>{landlord.email}</Typography>
                  <Typography color="text.secondary">
                    {t('portalAdminLandlords.list.name')}: {displayName(landlord)}
                  </Typography>
                  <Typography color="text.secondary">
                    {t('portalAdminLandlords.list.status')}: {landlord.status}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ pt: 0.5 }}>
                    {String(landlord.status ?? '').toUpperCase() === 'DISABLED' ? (
                      <Button
                        type="button"
                        size="small"
                        variant="outlined"
                        onClick={() => openConfirmDialog(landlord, true)}
                        disabled={!canUseModule || submitState.status === 'saving'}
                      >
                        {t('portalAdminLandlords.actions.reactivate')}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="small"
                        color="warning"
                        variant="outlined"
                        onClick={() => openConfirmDialog(landlord, false)}
                        disabled={!canUseModule || submitState.status === 'saving'}
                      >
                        {t('portalAdminLandlords.actions.deactivate')}
                      </Button>
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
      <PortalFeedbackSnackbar feedback={feedback} onClose={closeFeedback} />
    </Box>
  );
};

export default PortalAdminLandlords;
