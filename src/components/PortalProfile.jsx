import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Paper,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { usePortalAuth } from '../PortalAuthContext';
import { emailFromAccount, isGuestRole, resolveRole } from '../portalUtils';
import { validatePersonBasics, validatePersonField } from '../portalPersonValidation';
import { patchProfile } from '../lib/portalApiClient';
import { usePortalFeedback } from '../hooks/usePortalFeedback';
import PortalFeedbackSnackbar from './PortalFeedbackSnackbar';
import StatusAlertSlot from './StatusAlertSlot';

function validateProfileForm(form, t) {
  return validatePersonBasics(form, t, {
    keys: {
      firstNameRequired: 'portalProfile.errors.firstNameRequired',
      lastNameRequired: 'portalProfile.errors.lastNameRequired',
      emailRequired: 'portalProfile.errors.emailInvalid',
      emailInvalid: 'portalProfile.errors.emailInvalid',
      phoneRequired: 'portalProfile.errors.phoneRequiredForSms',
      phoneInvalid: 'portalProfile.errors.phoneInvalid',
    },
    requirePhone: Boolean(form?.notificationsSmsEnabled),
  });
}

function validateProfileFieldSingle(field, value, t, options = {}) {
  return validatePersonField(field, value, t, {
    keys: {
      firstNameRequired: 'portalProfile.errors.firstNameRequired',
      lastNameRequired: 'portalProfile.errors.lastNameRequired',
      emailRequired: 'portalProfile.errors.emailInvalid',
      emailInvalid: 'portalProfile.errors.emailInvalid',
      phoneRequired: 'portalProfile.errors.phoneRequiredForSms',
      phoneInvalid: 'portalProfile.errors.phoneInvalid',
    },
    requirePhone: Boolean(options.requirePhone),
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
    notificationsEmailEnabled: true,
    notificationsInAppEnabled: true,
    notificationsSmsEnabled: false,
    notificationsSmsOptIn: false,
  });
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveError, setSaveError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [smsOptInConfirmOpen, setSmsOptInConfirmOpen] = useState(false);
  const { feedback, showFeedback, closeFeedback } = usePortalFeedback();

  const initialForm = useMemo(
    () => ({
      email: meData?.user?.email ?? '',
      firstName: meData?.user?.first_name ?? '',
      lastName: meData?.user?.last_name ?? '',
      phone: meData?.user?.phone ?? '',
      notificationsEmailEnabled: meData?.user?.notification_preferences?.email_enabled ?? true,
      notificationsInAppEnabled: meData?.user?.notification_preferences?.in_app_enabled ?? true,
      notificationsSmsEnabled:
        Boolean(meData?.user?.notification_preferences?.sms_enabled)
        && Boolean(meData?.user?.notification_preferences?.sms_opt_in),
      notificationsSmsOptIn:
        Boolean(meData?.user?.notification_preferences?.sms_enabled)
        && Boolean(meData?.user?.notification_preferences?.sms_opt_in),
    }),
    [meData]
  );
  const hasChanges = useMemo(
    () =>
      form.email !== initialForm.email
      || form.firstName !== initialForm.firstName
      || form.lastName !== initialForm.lastName
      || form.phone !== initialForm.phone
      || form.notificationsEmailEnabled !== initialForm.notificationsEmailEnabled
      || form.notificationsInAppEnabled !== initialForm.notificationsInAppEnabled
      || form.notificationsSmsEnabled !== initialForm.notificationsSmsEnabled
      || form.notificationsSmsOptIn !== initialForm.notificationsSmsOptIn,
    [form, initialForm]
  );

  useEffect(() => {
    setForm(initialForm);
    setFieldErrors({});
  }, [initialForm]);
  useEffect(() => {
    if (saveStatus === 'success') {
      showFeedback(t('portalProfile.saved'));
    }
  }, [saveStatus, showFeedback, t]);
  useEffect(() => {
    if (saveStatus === 'error') {
      showFeedback(saveError || t('portalProfile.errors.unknown'), 'error');
    }
  }, [saveError, saveStatus, showFeedback, t]);

  const onChange = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    setSaveStatus('idle');
    setSaveError('');
  };
  const onBlur = (field) => (event) => {
    const message = validateProfileFieldSingle(field, event.target.value, t, {
      requirePhone: Boolean(form.notificationsSmsEnabled),
    });
    setFieldErrors((prev) => ({ ...prev, [field]: message }));
  };
  const onToggle = (field) => (event) => {
    if (field === 'notificationsSmsEnabled') {
      const checked = event.target.checked;
      if (checked) {
        setSmsOptInConfirmOpen(true);
      } else {
        setForm((prev) => ({
          ...prev,
          notificationsSmsEnabled: false,
          notificationsSmsOptIn: false,
        }));
      }
      setSaveStatus('idle');
      setSaveError('');
      return;
    }
    setForm((prev) => ({ ...prev, [field]: event.target.checked }));
    setSaveStatus('idle');
    setSaveError('');
  };
  const confirmSmsOptIn = () => {
    setForm((prev) => ({
      ...prev,
      notificationsSmsEnabled: true,
      notificationsSmsOptIn: true,
    }));
    setSaveStatus('idle');
    setSaveError('');
    setSmsOptInConfirmOpen(false);
  };
  const cancelSmsOptIn = () => {
    setSmsOptInConfirmOpen(false);
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
      const normalizedEmail = form.email.trim().toLowerCase();
      const payload = await patchProfile(baseUrl, token, {
        emailHint,
        email: normalizedEmail,
        first_name: form.firstName,
        last_name: form.lastName,
        phone: form.phone,
        notification_preferences: {
          email_enabled: form.notificationsEmailEnabled,
          in_app_enabled: form.notificationsInAppEnabled,
          sms_enabled: form.notificationsSmsEnabled,
          sms_opt_in: form.notificationsSmsOptIn,
        },
      });
      const savedUser = payload && typeof payload === 'object' ? payload.user : null;
      const savedPreferences = payload && typeof payload === 'object'
        ? payload.notification_preferences
        : null;
      if (savedUser && typeof savedUser === 'object') {
        setForm({
          email: typeof savedUser.email === 'string' ? savedUser.email : form.email,
          firstName: typeof savedUser.first_name === 'string' ? savedUser.first_name : form.firstName,
          lastName: typeof savedUser.last_name === 'string' ? savedUser.last_name : form.lastName,
          phone: typeof savedUser.phone === 'string' ? savedUser.phone : '',
          notificationsEmailEnabled:
            typeof savedPreferences?.email_enabled === 'boolean'
              ? savedPreferences.email_enabled
              : form.notificationsEmailEnabled,
          notificationsInAppEnabled:
            typeof savedPreferences?.in_app_enabled === 'boolean'
              ? savedPreferences.in_app_enabled
              : form.notificationsInAppEnabled,
          notificationsSmsEnabled:
            typeof savedPreferences?.sms_enabled === 'boolean'
              ? savedPreferences.sms_enabled
              : form.notificationsSmsEnabled,
          notificationsSmsOptIn:
            typeof savedPreferences?.sms_opt_in === 'boolean'
              ? savedPreferences.sms_opt_in
              : form.notificationsSmsOptIn,
        });
      }
      setSaveStatus('success');
      refreshMe();
    } catch (error) {
      handleApiForbidden(error);
      if (
        error
        && typeof error === 'object'
        && 'code' in error
      ) {
        if (error.code === 'email_already_in_use') {
          setFieldErrors({});
          setSaveStatus('idle');
          setSaveError('');
          showFeedback(t('portalProfile.errors.emailExists'), 'error');
          return;
        }
        if (error.code === 'sms_phone_required') {
          setFieldErrors((prev) => ({
            ...prev,
            phone: t('portalProfile.errors.phoneRequiredForSms'),
          }));
          setSaveStatus('error');
          setSaveError(t('portalProfile.errors.phoneRequiredForSms'));
          return;
        }
      }
      setSaveStatus('error');
      setSaveError(t('portalProfile.errors.unknown'));
    }
  };

  // Keep existing profile content visible during background /me refreshes.
  const isLoading = isAuthenticated && meStatus === 'loading' && !meData?.user;
  const roleResolved = isAuthenticated && meStatus !== 'loading';
  const isGuest = roleResolved && isGuestRole(role);
  const isProfileDataUnavailable = isAuthenticated && meStatus === 'ok' && !meData?.user;
  const formDisabled =
    !isAuthenticated || isGuest || !baseUrl || isProfileDataUnavailable || saveStatus === 'saving';
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

        <StatusAlertSlot
          message={!isAuthenticated ? { severity: 'warning', text: t('portalProfile.errors.signInRequired') } : null}
        />
        <StatusAlertSlot
          message={!baseUrl ? { severity: 'warning', text: t('portalProfile.errors.apiUnavailable') } : null}
        />
        <StatusAlertSlot
          message={isProfileDataUnavailable ? { severity: 'warning', text: t('portalProfile.dataUnavailable') } : null}
        />

        <Paper
          variant="outlined"
          component="form"
          onSubmit={onSubmit}
          sx={{ p: 3, borderRadius: 2 }}
        >
          <Stack spacing={2.5}>
            <StatusAlertSlot
              message={isGuest ? { severity: 'warning', text: t('portalProfile.guestBlocked') } : null}
            />
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
                <Stack spacing={0.5}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('portalProfile.fields.notificationsHeading')}
                  </Typography>
                  <FormControlLabel
                    control={(
                      <Switch
                        checked={Boolean(form.notificationsEmailEnabled)}
                        onChange={onToggle('notificationsEmailEnabled')}
                        disabled={formDisabled}
                      />
                    )}
                    label={t('portalProfile.fields.notificationsEmail')}
                  />
                  <FormControlLabel
                    control={(
                      <Switch
                        checked={Boolean(form.notificationsInAppEnabled)}
                        onChange={onToggle('notificationsInAppEnabled')}
                        disabled={formDisabled}
                      />
                    )}
                    label={t('portalProfile.fields.notificationsInApp')}
                  />
                  <FormControlLabel
                    control={(
                      <Switch
                        checked={Boolean(form.notificationsSmsEnabled)}
                        onChange={onToggle('notificationsSmsEnabled')}
                        disabled={formDisabled}
                      />
                    )}
                    label={t('portalProfile.fields.notificationsSms')}
                  />
                </Stack>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="flex-end"
                  spacing={1}
                  sx={{ flexWrap: 'wrap', rowGap: 1 }}
                >
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
      <Dialog
        open={smsOptInConfirmOpen}
        onClose={cancelSmsOptIn}
        aria-labelledby="portal-profile-sms-optin-title"
      >
        <DialogTitle id="portal-profile-sms-optin-title">
          {t('portalProfile.smsOptInConfirm.title')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {t('portalProfile.smsOptInConfirm.body')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={cancelSmsOptIn}>
            {t('portalProfile.smsOptInConfirm.cancel')}
          </Button>
          <Button type="button" variant="contained" onClick={confirmSmsOptIn}>
            {t('portalProfile.smsOptInConfirm.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
      <PortalFeedbackSnackbar feedback={feedback} onClose={closeFeedback} />
    </Box>
  );
};

export default PortalProfile;
