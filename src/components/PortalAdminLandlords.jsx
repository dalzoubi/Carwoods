import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  IconButton,
  Switch,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Refresh from '@mui/icons-material/Refresh';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { Role } from '../domain/constants.js';
import { validatePersonBasics, validatePersonField } from '../portalPersonValidation';
import { resolveRole, normalizeRole } from '../portalUtils';
import { fetchLandlords, createLandlord, patchResource } from '../lib/portalApiClient';

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

  const [form, setForm] = useState({ email: '', firstName: '', lastName: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [showInactive, setShowInactive] = useState(false);
  const [submitState, setSubmitState] = useState({ status: 'idle', detail: '' });
  const [landlordsState, setLandlordsState] = useState({ status: 'idle', detail: '', landlords: [] });

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

        {!baseUrl && <Alert severity="warning">{t('portalAdminLandlords.errors.apiUnavailable')}</Alert>}
        {!isAuthenticated && (
          <Alert severity="warning">{t('portalAdminLandlords.errors.signInRequired')}</Alert>
        )}
        {isAuthenticated && meStatus !== 'loading' && !isAdmin && (
          <Alert severity="error">{t('portalAdminLandlords.errors.adminOnly')}</Alert>
        )}

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
            <Stack direction="row" spacing={1.25} sx={{ flexWrap: 'wrap' }}>
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
            {submitState.status === 'error' && <Alert severity="error">{submitState.detail}</Alert>}
            {submitState.status === 'ok' && <Alert severity="success">{submitState.detail}</Alert>}
          </Stack>
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
                <Tooltip title={t('portalAdminLandlords.list.refreshLandlordList')}>
                  <span>
                    <IconButton
                      type="button"
                      size="small"
                      aria-label={t('portalAdminLandlords.list.refreshLandlordList')}
                      disabled={!canUseModule || landlordsState.status === 'loading'}
                      onClick={() => void loadLandlords()}
                    >
                      <Refresh fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </Stack>
            {landlordsState.status === 'loading' && (
              <Typography color="text.secondary">{t('portalAdminLandlords.list.loading')}</Typography>
            )}
            {landlordsState.status === 'error' && <Alert severity="error">{landlordsState.detail}</Alert>}
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
                        onClick={() => void onToggleActive(landlord.id, true)}
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
                        onClick={() => void onToggleActive(landlord.id, false)}
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
    </Box>
  );
};

export default PortalAdminLandlords;
