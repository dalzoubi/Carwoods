import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import HomeWorkOutlined from '@mui/icons-material/HomeWorkOutlined';
import PersonOutline from '@mui/icons-material/PersonOutline';
import Logout from '@mui/icons-material/Logout';
import ArrowBack from '@mui/icons-material/ArrowBack';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { registerAsLandlord } from '../lib/portalApiClient';
import carwoodsLogo from '../assets/carwoods-logo.png';

/**
 * Shown after a first-time authenticated user has no backing profile.
 * Splits the flow explicitly: landlords create their account here; tenants
 * without an invite are told to contact their landlord rather than silently
 * getting a landlord row created for them (which was the prior bug).
 */
const PortalRoleSelectionGate = () => {
  const { t } = useTranslation();
  const {
    baseUrl,
    pendingRegistrationEmail,
    pendingRegistrationFirstName,
    pendingRegistrationLastName,
    getAccessToken,
    refreshMe,
    signOut,
  } = usePortalAuth();

  const [intent, setIntent] = useState(null);
  const [firstName, setFirstName] = useState(pendingRegistrationFirstName || '');
  const [lastName, setLastName] = useState(pendingRegistrationLastName || '');
  const [phone, setPhone] = useState('');
  const [submitStatus, setSubmitStatus] = useState('idle');
  const [submitError, setSubmitError] = useState('');

  const resetToChoice = () => {
    setIntent(null);
    setSubmitError('');
    setSubmitStatus('idle');
  };

  const onLandlordSubmit = async (event) => {
    event.preventDefault();
    if (!baseUrl) {
      setSubmitError(t('portalRoleSelect.errors.apiUnavailable'));
      return;
    }
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn || !ln) {
      setSubmitError(t('portalRoleSelect.errors.nameRequired'));
      return;
    }
    setSubmitStatus('submitting');
    setSubmitError('');
    try {
      const accessToken = await getAccessToken();
      await registerAsLandlord(baseUrl, accessToken, {
        first_name: fn,
        last_name: ln,
        phone: phone.trim() || null,
        emailHint: pendingRegistrationEmail || undefined,
      });
      setSubmitStatus('ok');
      // Re-fetch /me now that the row exists; the provider will render the
      // normal portal instead of this gate on success.
      refreshMe({ force: true });
    } catch (err) {
      setSubmitStatus('error');
      const code = err && typeof err === 'object' && typeof err.code === 'string' ? err.code : '';
      if (code === 'email_already_registered' || code === 'account_already_exists') {
        setSubmitError(t('portalRoleSelect.errors.alreadyRegistered'));
      } else {
        setSubmitError(t('portalRoleSelect.errors.generic'));
      }
    }
  };

  const isSubmitting = submitStatus === 'submitting';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
        p: { xs: 2, sm: 4 },
      }}
    >
      <Helmet>
        <title>{t('portalRoleSelect.title')}</title>
      </Helmet>
      <Paper
        elevation={0}
        sx={{
          maxWidth: 520,
          width: '100%',
          p: { xs: 3, sm: 5 },
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
        }}
      >
        <Stack spacing={3}>
          <Box sx={{ textAlign: 'center' }}>
            <Box
              component="img"
              src={carwoodsLogo}
              alt="Carwoods"
              sx={{
                height: 36,
                mb: 2,
                filter: (theme) => (theme.palette.mode === 'light' ? 'invert(1)' : 'none'),
              }}
            />
            <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
              {t('portalRoleSelect.heading')}
            </Typography>
            {pendingRegistrationEmail && (
              <Typography color="text.secondary" variant="body2" sx={{ mt: 0.75 }}>
                {t('portalRoleSelect.signedInAs', { email: pendingRegistrationEmail })}
              </Typography>
            )}
          </Box>

          {intent === null && (
            <Stack spacing={2}>
              <Typography color="text.secondary">
                {t('portalRoleSelect.prompt')}
              </Typography>
              <Button
                variant="contained"
                size="large"
                startIcon={<HomeWorkOutlined />}
                onClick={() => setIntent('landlord')}
                sx={{ py: 1.5, textTransform: 'none', fontWeight: 600, justifyContent: 'flex-start' }}
              >
                <Stack spacing={0.25} alignItems="flex-start">
                  <span>{t('portalRoleSelect.landlordCta')}</span>
                  <Typography variant="caption" sx={{ opacity: 0.85 }}>
                    {t('portalRoleSelect.landlordSubtext')}
                  </Typography>
                </Stack>
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<PersonOutline />}
                onClick={() => setIntent('tenant')}
                sx={{ py: 1.5, textTransform: 'none', fontWeight: 600, justifyContent: 'flex-start' }}
              >
                <Stack spacing={0.25} alignItems="flex-start">
                  <span>{t('portalRoleSelect.tenantCta')}</span>
                  <Typography variant="caption" color="text.secondary">
                    {t('portalRoleSelect.tenantSubtext')}
                  </Typography>
                </Stack>
              </Button>
              <Divider />
              <Button
                variant="text"
                size="small"
                startIcon={<Logout />}
                onClick={() => signOut()}
                sx={{ textTransform: 'none', alignSelf: 'flex-start' }}
              >
                {t('portalRoleSelect.signOut')}
              </Button>
            </Stack>
          )}

          {intent === 'landlord' && (
            <Box component="form" onSubmit={onLandlordSubmit}>
              <Stack spacing={2}>
                <Typography variant="h6">
                  {t('portalRoleSelect.landlordForm.heading')}
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  {t('portalRoleSelect.landlordForm.subtitle')}
                </Typography>
                {submitError && <Alert severity="error">{submitError}</Alert>}
                <TextField
                  label={t('portalRoleSelect.landlordForm.firstName')}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  autoComplete="given-name"
                  fullWidth
                  disabled={isSubmitting}
                />
                <TextField
                  label={t('portalRoleSelect.landlordForm.lastName')}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  autoComplete="family-name"
                  fullWidth
                  disabled={isSubmitting}
                />
                <TextField
                  label={t('portalRoleSelect.landlordForm.phone')}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  fullWidth
                  disabled={isSubmitting}
                  helperText={t('portalRoleSelect.landlordForm.phoneHelp')}
                />
                <Stack direction="row" spacing={1} justifyContent="space-between">
                  <Button
                    type="button"
                    variant="text"
                    startIcon={<ArrowBack />}
                    onClick={resetToChoice}
                    disabled={isSubmitting}
                    sx={{ textTransform: 'none' }}
                  >
                    {t('portalRoleSelect.back')}
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={isSubmitting}
                    startIcon={isSubmitting ? <CircularProgress size={16} /> : null}
                    sx={{ textTransform: 'none', fontWeight: 600 }}
                  >
                    {isSubmitting
                      ? t('portalRoleSelect.landlordForm.submitting')
                      : t('portalRoleSelect.landlordForm.submit')}
                  </Button>
                </Stack>
              </Stack>
            </Box>
          )}

          {intent === 'tenant' && (
            <Stack spacing={2}>
              <Alert severity="info" icon={<PersonOutline />}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {t('portalRoleSelect.tenantDeadEnd.heading')}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {t('portalRoleSelect.tenantDeadEnd.body')}
                </Typography>
              </Alert>
              <Typography color="text.secondary" variant="body2">
                {t('portalRoleSelect.tenantDeadEnd.note')}
              </Typography>
              <Stack direction="row" spacing={1} justifyContent="space-between">
                <Button
                  type="button"
                  variant="text"
                  startIcon={<ArrowBack />}
                  onClick={resetToChoice}
                  sx={{ textTransform: 'none' }}
                >
                  {t('portalRoleSelect.back')}
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  startIcon={<Logout />}
                  onClick={() => signOut()}
                  sx={{ textTransform: 'none' }}
                >
                  {t('portalRoleSelect.signOut')}
                </Button>
              </Stack>
            </Stack>
          )}
        </Stack>
      </Paper>
    </Box>
  );
};

export default PortalRoleSelectionGate;
