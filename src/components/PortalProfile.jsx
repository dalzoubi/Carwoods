import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { usePortalAuth } from '../PortalAuthContext';
import { emailFromAccount, isGuestRole, resolveRole } from '../portalUtils';

function endpoint(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
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
  }, [initialForm]);

  const onChange = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaveStatus('idle');
    setSaveError('');
  };

  const onSubmit = async (event) => {
    event.preventDefault();
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
              label={t('portalProfile.fields.email')}
              value={form.email}
              onChange={onChange('email')}
              autoComplete="email"
              required
              disabled={!isAuthenticated || isGuest || !baseUrl || saveStatus === 'saving'}
            />
            <TextField
              label={t('portalProfile.fields.firstName')}
              value={form.firstName}
              onChange={onChange('firstName')}
              autoComplete="given-name"
              disabled={!isAuthenticated || isGuest || !baseUrl || saveStatus === 'saving'}
            />
            <TextField
              label={t('portalProfile.fields.lastName')}
              value={form.lastName}
              onChange={onChange('lastName')}
              autoComplete="family-name"
              disabled={!isAuthenticated || isGuest || !baseUrl || saveStatus === 'saving'}
            />
            <TextField
              label={t('portalProfile.fields.phone')}
              value={form.phone}
              onChange={onChange('phone')}
              autoComplete="tel"
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

