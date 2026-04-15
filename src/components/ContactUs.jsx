import React, { useState, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import MailtoEmailLink from './MailtoEmailLink';
import { useTranslation } from 'react-i18next';
import { VITE_API_BASE_URL_RESOLVED } from '../featureFlags';

const SUBJECTS = [
  { value: 'GENERAL', labelKey: 'contact.subjects.general' },
  { value: 'RENTER', labelKey: 'contact.subjects.renter' },
  { value: 'PROPERTY_OWNER', labelKey: 'contact.subjects.propertyOwner' },
  { value: 'PORTAL_SAAS', labelKey: 'contact.subjects.portalSaas' },
];

const API_BASE = VITE_API_BASE_URL_RESOLVED;

/** Internal sentinel for generic submit failure with support mailto in the alert. */
const SUBMIT_ERROR_SUPPORT_MAILTO = '__contact_support_mailto__';

const ContactUs = () => {
  const { t } = useTranslation();
  const { executeRecaptcha } = useGoogleReCaptcha();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    subject: 'GENERAL',
    message: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const validate = (f) => {
    const e = {};
    if (!f.name.trim()) e.name = t('contact.nameRequired', 'Name is required');
    if (!f.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) {
      e.email = t('contact.emailInvalid', 'Please enter a valid email address');
    }
    if (!f.message.trim()) e.message = t('contact.messageRequired', 'Message is required');
    return e;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setSubmitError('');

    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    try {
      let recaptchaToken = '';
      if (executeRecaptcha) {
        try {
          recaptchaToken = await executeRecaptcha('contact_form');
        } catch {
          // reCAPTCHA not configured in dev — proceed without token
        }
      }

      const resp = await fetch(`${API_BASE}/api/public/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          subject: form.subject,
          message: form.message.trim(),
          recaptchaToken: recaptchaToken || null,
        }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        if (data.error === 'recaptcha_failed') {
          setSubmitError(t('contact.recaptchaError', 'Security check failed. Please try again.'));
        } else if (data.error === 'recaptcha_required') {
          setSubmitError(
            t(
              'contact.recaptchaRequired',
              'Security verification did not complete. Please refresh the page and try again.',
            ),
          );
        } else {
          setSubmitError(SUBMIT_ERROR_SUPPORT_MAILTO);
        }
        return;
      }

      setSubmitted(true);
    } catch {
      setSubmitError(SUBMIT_ERROR_SUPPORT_MAILTO);
    } finally {
      setSubmitting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, executeRecaptcha, t]);

  return (
    <Box component="article" sx={{ maxWidth: 680 }}>
      <Helmet>
        <title>{t('contact.title', 'Carwoods — Contact Us')}</title>
        <meta name="description" content={t('contact.metaDescription', 'Get in touch with the Carwoods team.')} />
      </Helmet>

      <Typography variant="h1" component="h1" sx={{ fontSize: { xs: '1.65rem', sm: '2rem' }, fontWeight: 800, mb: 1 }}>
        {t('contact.heading', 'Contact Us')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 0.5 }}>
        {t('contact.intro', 'Have a question? Fill out the form below and our team will respond within one business day.')}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3 }}>
        {t('contact.dbaNote', 'Carwoods is a DBA of Alzoubi Motors LLC, a Texas limited liability company.')}
      </Typography>

      {submitted ? (
        <Alert severity="success" sx={{ mb: 3 }}>
          <Typography fontWeight={700} gutterBottom>
            {t('contact.successHeading', 'Message Sent')}
          </Typography>
          {t('contact.successBody', "Thank you! We'll be in touch within one business day.")}
        </Alert>
      ) : (
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Stack spacing={2.5}>
            {submitError && (
              <Alert severity="error">
                {submitError === SUBMIT_ERROR_SUPPORT_MAILTO ? (
                  <>
                    {t('contact.errorBodyPrefix')}
                    <MailtoEmailLink email={t('contact.supportEmail')} />
                    {t('contact.errorBodySuffix')}
                  </>
                ) : (
                  submitError
                )}
              </Alert>
            )}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                name="name"
                label={t('contact.nameLabel', 'Your Name')}
                value={form.name}
                onChange={handleChange}
                required
                fullWidth
                error={Boolean(fieldErrors.name)}
                helperText={fieldErrors.name}
                autoComplete="name"
              />
              <TextField
                name="email"
                label={t('contact.emailLabel', 'Email Address')}
                type="email"
                value={form.email}
                onChange={handleChange}
                required
                fullWidth
                error={Boolean(fieldErrors.email)}
                helperText={fieldErrors.email}
                autoComplete="email"
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                name="phone"
                label={t('contact.phoneLabel', 'Phone Number (optional)')}
                value={form.phone}
                onChange={handleChange}
                fullWidth
                autoComplete="tel"
              />
              <FormControl fullWidth required>
                <InputLabel id="subject-label">{t('contact.subjectLabel', 'Subject')}</InputLabel>
                <Select
                  labelId="subject-label"
                  name="subject"
                  value={form.subject}
                  label={t('contact.subjectLabel', 'Subject')}
                  onChange={handleChange}
                >
                  {SUBJECTS.map((s) => (
                    <MenuItem key={s.value} value={s.value}>
                      {t(s.labelKey)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <TextField
              name="message"
              label={t('contact.messageLabel', 'Message')}
              value={form.message}
              onChange={handleChange}
              required
              fullWidth
              multiline
              minRows={5}
              error={Boolean(fieldErrors.message)}
              helperText={fieldErrors.message}
            />

            <Box>
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={submitting}
                startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
                sx={{ textTransform: 'none', fontWeight: 700, px: 3, borderRadius: 2 }}
              >
                {submitting
                  ? t('contact.submitting', 'Sending\u2026')
                  : t('contact.submitButton', 'Send Message')}
              </Button>
              <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1.5 }}>
                {t('contact.recaptchaDisclaimer', 'This form is protected by reCAPTCHA. Google\u2019s')}{' '}
                <Link href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" sx={{ fontSize: 'inherit' }}>
                  {t('contact.recaptchaPrivacy', 'Privacy Policy')}
                </Link>{' '}
                {t('contact.recaptchaAnd', 'and')}{' '}
                <Link href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" sx={{ fontSize: 'inherit' }}>
                  {t('contact.recaptchaTerms', 'Terms of Service')}
                </Link>{' '}
                {t('contact.recaptchaApply', 'apply.')}
              </Typography>
            </Box>
          </Stack>
        </Box>
      )}

      <Divider sx={{ my: 4 }} />

      <Typography variant="body2" color="text.secondary">
        {t('contact.harIntro', 'For brokerage information per Texas law:')}{' '}
        <Link
          href="https://members.har.com/mhf/terms/dispBrokerInfo.cfm?sitetype=aws&cid=735771"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('contact.harAriaLabel', 'View HAR brokerage information (opens in new tab)')}
        >
          {t('contact.harLinkText', 'HAR Brokerage Information')}
        </Link>
      </Typography>
    </Box>
  );
};

export default ContactUs;
