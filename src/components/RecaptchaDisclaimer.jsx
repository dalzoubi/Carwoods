import React from 'react';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';

/**
 * Required branding shown inline on every form that calls executeRecaptcha.
 * We hide Google's floating badge globally (see index.css) to avoid overlap
 * with the portal FloatingHelpButton; Google's policy allows hiding the
 * badge as long as this notice is visible in the user flow.
 */
export default function RecaptchaDisclaimer({ sx }) {
  const { t } = useTranslation();
  return (
    <Typography
      variant="caption"
      color="text.disabled"
      sx={{ display: 'block', mt: 1.5, ...sx }}
    >
      {t('contact.recaptchaDisclaimer')}{' '}
      <Link
        href="https://policies.google.com/privacy"
        target="_blank"
        rel="noopener noreferrer"
        sx={{ fontSize: 'inherit' }}
      >
        {t('contact.recaptchaPrivacy')}
      </Link>{' '}
      {t('contact.recaptchaAnd')}{' '}
      <Link
        href="https://policies.google.com/terms"
        target="_blank"
        rel="noopener noreferrer"
        sx={{ fontSize: 'inherit' }}
      >
        {t('contact.recaptchaTerms')}
      </Link>{' '}
      {t('contact.recaptchaApply')}
    </Typography>
  );
}
