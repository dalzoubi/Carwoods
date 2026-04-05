import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { usePortalAuth } from '../PortalAuthContext';
import { emailFromAccount, isGuestRole, resolveRole } from '../portalUtils';

function endpoint(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function looksLikePhone(value) {
  if (!value) return true;
  if (!/^[+]?[\d\s().-]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

function validateProfileForm(form, t) {
  const errors = {};

  if (!form.firstName.trim()) {
    errors.firstName = t('portalProfile.errors.firstNameRequired');
  }
  if (!form.lastName.trim()) {
    errors.lastName = t('portalProfile.errors.lastNameRequired');
  }
  if (!looksLikeEmail(form.email.trim())) {
    errors.email = t('portalProfile.errors.emailInvalid');
  }
  if (!looksLikePhone(form.phone.trim())) {
    errors.phone = t('portalProfile.errors.phoneInvalid');
  }

  return errors;
}

function validateProfileField(field, value, t) {
  if (field === 'firstName') {
    return value.trim() ? '' : t('portalProfile.errors.firstNameRequired');
  }
  if (field === 'lastName') {
    return value.trim() ? '' : t('portalProfile.errors.lastNameRequired');
  }
  if (field === 'email') {
    return looksLikeEmail(value.trim()) ? '' : t('portalProfile.errors.emailInvalid');
  }
  if (field === 'phone') {
    return looksLikePhone(value.trim()) ? '' : t('portalProfile.errors.phoneInvalid');
  }
  return '';
}

const PortalProfile = () => {
  const { t } = useTranslation();
  const {
    baseUrl,
    isAuthenticated,
    account,
    meData,
    meStatus,
    getAccessToken,
    refreshMe,
  } = usePortalAuth();
  const role = resolveRole(meData, account);
  const isGuest = isGuestRole(role);
  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveError, setSaveError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const initialForm = useMemo(
    () => ({
      email: meData?.user?.email ?? meData?.email ?? emailFromAccount(account) ?? '',
      firstName: meData?.user?.first_name ?? '',
      lastName: meData?.user?.last_name ?? '',
      phone: meData?.user?.phone ?? '',
    }),
    [account, meData]
  );
  const hasChanges = useMemo(
    () =>
      form.email !== initialForm.email
      || form.firstName !== initialForm.firstName
      || form.lastName !== initialForm.lastName
      || form.phone !== initialForm.phone,
    [form, initialForm]
  );

  const profileEndpoint = useMemo(
    () => (baseUrl ? endpoint(baseUrl, '/api/portal/profile') : ''),
    [baseUrl]
  );

  useEffect(() => {
    setForm(initialForm);
    setFieldErrors({});
  }, [initialForm]);

  const onChange = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    setSaveStatus('idle');
    setSaveError('');
  };
  const onBlur = (field) => (event) => {
    const message = validateProfileField(field, event.target.value, t);
    setFieldErrors((prev) => ({ ...prev, [field]: message }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    const validationErrors = validateProfileForm(form, t);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setSaveStatus('error');
      setSaveError(t('portalProfile.errors.validation'));
      return;
    }
    if (!hasChanges) {
      setSaveStatus('idle');
      setSaveError('');
      return;
    }
    setSaveStatus('saving');
    setSaveError('');
    try {
      if (!isAuthenticated) {
        throw new Error(t('portalProfile.errors.signInRequired'));
      }
      if (!profileEndpoint) {
        throw new Error(t('portalProfile.errors.apiUnavailable'));
      }
      const token = await getAccessToken();
      const hint = emailFromAccount(account);
      const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
      if (hint) {
        headers['X-Email-Hint'] = hint;
      }
      const res = await fetch(profileEndpoint, {
        method: 'PATCH',
        headers,
        credentials: 'omit',
        body: JSON.stringify({
          email: form.email,
          first_name: form.firstName,
          last_name: form.lastName,
          phone: form.phone,
        }),
      });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const payload = await res.json();
          if (typeof payload?.error === 'string') {
            detail = `${detail} (${payload.error})`;
          }
        } catch {
          // Best-effort JSON parse.
        }
        throw new Error(detail);
      }
      setSaveStatus('success');
      refreshMe();
    } catch (error) {
      setSaveStatus('error');
      setSaveError(error instanceof Error ? error.message : t('portalProfile.errors.unknown'));
    }
  };

  return (
    <Box sx={{ py: 4 }}>
      <Helmet>
        <title>{t('portalProfile.title')}</title>
        <meta name="description" content={t('portalProfile.metaDescription')} />
      </Helmet>

      <Stack spacing={2}>
        <Typography variant="h1" sx={{ fontSize: '2rem' }}>
          {t('portalProfile.heading')}
        </Typography>
        <Typography color="text.secondary">{t('portalProfile.intro')}</Typography>

        {!isAuthenticated && <Alert severity="warning">{t('portalProfile.errors.signInRequired')}</Alert>}
        {isAuthenticated && meStatus === 'loading' && <Alert severity="info">{t('portalProfile.loading')}</Alert>}
        {isAuthenticated && isGuest && <Alert severity="warning">{t('portalProfile.guestBlocked')}</Alert>}
        {!baseUrl && <Alert severity="warning">{t('portalProfile.errors.apiUnavailable')}</Alert>}
        {saveStatus === 'error' && <Alert severity="error">{saveError || t('portalProfile.errors.unknown')}</Alert>}
        {saveStatus === 'success' && <Alert severity="success">{t('portalProfile.saved')}</Alert>}

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
          <Stack spacing={2}>
            <TextField
              label={t('portalProfile.fields.firstName')}
              value={form.firstName}
              onChange={onChange('firstName')}
              onBlur={onBlur('firstName')}
              autoComplete="given-name"
              required
              error={Boolean(fieldErrors.firstName)}
              helperText={fieldErrors.firstName || ' '}
              disabled={!isAuthenticated || isGuest || !baseUrl || saveStatus === 'saving'}
            />
            <TextField
              label={t('portalProfile.fields.lastName')}
              value={form.lastName}
              onChange={onChange('lastName')}
              onBlur={onBlur('lastName')}
              autoComplete="family-name"
              required
              error={Boolean(fieldErrors.lastName)}
              helperText={fieldErrors.lastName || ' '}
              disabled={!isAuthenticated || isGuest || !baseUrl || saveStatus === 'saving'}
            />
            <TextField
              label={t('portalProfile.fields.email')}
              value={form.email}
              onChange={onChange('email')}
              onBlur={onBlur('email')}
              autoComplete="email"
              type="email"
              required
              error={Boolean(fieldErrors.email)}
              helperText={fieldErrors.email || ' '}
              disabled={!isAuthenticated || isGuest || !baseUrl || saveStatus === 'saving'}
            />
            <TextField
              label={t('portalProfile.fields.phone')}
              value={form.phone}
              onChange={onChange('phone')}
              onBlur={onBlur('phone')}
              autoComplete="tel"
              type="tel"
              error={Boolean(fieldErrors.phone)}
              helperText={fieldErrors.phone || ' '}
              disabled={!isAuthenticated || isGuest || !baseUrl || saveStatus === 'saving'}
            />
            <Stack direction="row" justifyContent="flex-end">
              <Button
                type="submit"
                variant="contained"
                disabled={!isAuthenticated || isGuest || !baseUrl || saveStatus === 'saving' || !hasChanges}
              >
                {saveStatus === 'saving' ? t('portalProfile.actions.saving') : t('portalProfile.actions.save')}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
};

export default PortalProfile;

