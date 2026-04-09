import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { usePortalAuth } from '../PortalAuthContext';
import { emailFromAccount, isGuestRole, resolveRole } from '../portalUtils';
import { validatePersonBasics, validatePersonField } from '../portalPersonValidation';
import { patchProfile } from '../lib/portalApiClient';
import InlineActionStatus from './InlineActionStatus';
import { usePortalFeedback } from '../hooks/usePortalFeedback';
import PortalFeedbackSnackbar from './PortalFeedbackSnackbar';

function validateProfileForm(form, t) {
  return validatePersonBasics(form, t, {
    keys: {
      firstNameRequired: 'portalProfile.errors.firstNameRequired',
      lastNameRequired: 'portalProfile.errors.lastNameRequired',
      emailRequired: 'portalProfile.errors.emailInvalid',
      emailInvalid: 'portalProfile.errors.emailInvalid',
      phoneInvalid: 'portalProfile.errors.phoneInvalid',
    },
  });
}

function validateProfileFieldSingle(field, value, t) {
  return validatePersonField(field, value, t, {
    keys: {
      firstNameRequired: 'portalProfile.errors.firstNameRequired',
      lastNameRequired: 'portalProfile.errors.lastNameRequired',
      emailRequired: 'portalProfile.errors.emailInvalid',
      emailInvalid: 'portalProfile.errors.emailInvalid',
      phoneInvalid: 'portalProfile.errors.phoneInvalid',
    },
  });
}

function userInitials(firstName, lastName) {
  const f = (firstName || '').trim().charAt(0).toUpperCase();
  const l = (lastName || '').trim().charAt(0).toUpperCase();
  if (f && l) return `${f}${l}`;
  if (f) return f;
  return '?';
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
    handleApiForbidden,
    refreshMe,
  } = usePortalAuth();
  const role = resolveRole(meData, account);
  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveError, setSaveError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const { feedback, showFeedback, closeFeedback } = usePortalFeedback();
  const saveStatusMessage = saveStatus === 'error'
    ? { severity: 'error', text: saveError || t('portalProfile.errors.unknown') }
    : null;

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

  useEffect(() => {
    setForm(initialForm);
    setFieldErrors({});
  }, [initialForm]);
  useEffect(() => {
    if (saveStatus === 'success') {
      showFeedback(t('portalProfile.saved'));
      setSaveStatus('idle');
    }
  }, [saveStatus, showFeedback, t]);

  const onChange = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    setSaveStatus('idle');
    setSaveError('');
  };
  const onBlur = (field) => (event) => {
    const message = validateProfileFieldSingle(field, event.target.value, t);
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
      if (!baseUrl) {
        throw new Error(t('portalProfile.errors.apiUnavailable'));
      }
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      await patchProfile(baseUrl, token, {
        emailHint,
        email: form.email,
        first_name: form.firstName,
        last_name: form.lastName,
        phone: form.phone,
      });
      setSaveStatus('success');
      refreshMe();
    } catch (error) {
      handleApiForbidden(error);
      setSaveStatus('error');
      const msg =
        error && typeof error === 'object' && typeof error.message === 'string'
          ? error.message
          : error instanceof Error
            ? error.message
            : t('portalProfile.errors.unknown');
      setSaveError(msg);
    }
  };

  const isLoading = isAuthenticated && meStatus === 'loading';
  const roleResolved = isAuthenticated && meStatus !== 'loading';
  const isGuest = roleResolved && isGuestRole(role);
  const formDisabled = !isAuthenticated || isGuest || !baseUrl || saveStatus === 'saving';
  const initials = userInitials(form.firstName, form.lastName);

  return (
    <Box>
      <Helmet>
        <title>{t('portalProfile.title')}</title>
        <meta name="description" content={t('portalProfile.metaDescription')} />
      </Helmet>

      <Stack spacing={3}>
        {/* Header with avatar */}
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main', fontSize: '1.25rem' }}>
            {isLoading ? '' : initials}
          </Avatar>
          <Box>
            <Typography variant="h5" component="h2" fontWeight={700}>
              {t('portalProfile.heading')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('portalProfile.intro')}
            </Typography>
          </Box>
        </Stack>

        {!isAuthenticated && <Alert severity="warning">{t('portalProfile.errors.signInRequired')}</Alert>}
        {!baseUrl && <Alert severity="warning">{t('portalProfile.errors.apiUnavailable')}</Alert>}

        <Paper
          variant="outlined"
          component="form"
          onSubmit={onSubmit}
          sx={{ p: 3, borderRadius: 2 }}
        >
          <Stack spacing={2.5}>
            {isGuest && (
              <Alert severity="warning">{t('portalProfile.guestBlocked')}</Alert>
            )}
            {isLoading ? (
              <Stack spacing={2}>
                <Skeleton variant="rounded" height={56} />
                <Skeleton variant="rounded" height={56} />
                <Skeleton variant="rounded" height={56} />
                <Skeleton variant="rounded" height={56} />
              </Stack>
            ) : (
              <>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label={t('portalProfile.fields.firstName')}
                    value={form.firstName}
                    onChange={onChange('firstName')}
                    onBlur={onBlur('firstName')}
                    autoComplete="given-name"
                    required
                    error={Boolean(fieldErrors.firstName)}
                    helperText={fieldErrors.firstName || ' '}
                    disabled={formDisabled}
                    fullWidth
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
                    disabled={formDisabled}
                    fullWidth
                  />
                </Stack>
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
                  disabled={formDisabled}
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
                  disabled={formDisabled}
                />
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  spacing={1}
                  sx={{ flexWrap: 'wrap', rowGap: 1 }}
                >
                  <InlineActionStatus message={saveStatusMessage} />
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={formDisabled || !hasChanges}
                    sx={{ textTransform: 'none' }}
                  >
                    {saveStatus === 'saving' ? t('portalProfile.actions.saving') : t('portalProfile.actions.save')}
                  </Button>
                </Stack>
              </>
            )}
          </Stack>
        </Paper>
      </Stack>
      <PortalFeedbackSnackbar feedback={feedback} onClose={closeFeedback} />
    </Box>
  );
};

export default PortalProfile;
