import React from 'react';
import { Button, Stack } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePortalAuth } from '../PortalAuthContext';
import { withDarkPath } from '../routePaths';

/**
 * Inline SVG logos for Google, Apple, and Microsoft.
 * These are rendered as decorative icons (aria-hidden) alongside translated button labels.
 */
function GoogleLogo() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AppleLogo({ isDark }) {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 814 1000" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 376.7 0 248.7 0 122.3c0-72 29.7-123.9 85.5-163.1 47.3-33.4 101.9-48.3 154.5-48.3 75.4 0 135.1 48.3 180.6 48.3 43.7 0 112.7-51.2 196.4-51.2 31.3 0 108.2 3.2 162.5 73.2zm-161.6-60.6c-10.8-60.6-53-99.5-110.3-99.5-13.4 0-26.7 1.9-38.4 5.1 24.4 61.6 76.6 101.5 148.7 94.4z"
        fill={isDark ? '#ffffff' : '#000000'}
      />
    </svg>
  );
}

function MicrosoftLogo() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

function FacebookLogo() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073c0 6.019 4.388 11.009 10.125 11.927v-8.437H7.078v-3.49h3.047V9.413c0-3.017 1.792-4.685 4.533-4.685 1.312 0 2.686.236 2.686.236v2.962h-1.513c-1.491 0-1.956.931-1.956 1.886v2.262h3.328l-.532 3.49h-2.796V24C19.612 23.082 24 18.092 24 12.073z"
        fill="#1877F2"
      />
    </svg>
  );
}

/**
 * Renders individual, branded social sign-in buttons for Google, Apple, and Microsoft,
 * plus a "sign in with any account" fallback.
 *
 * @param {{ disabled?: boolean, compact?: boolean }} props
 */
const SocialSignInButtons = ({ disabled = false, compact = false }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isDark = theme.palette.mode === 'dark';
  const { signIn, signInWithProvider, authStatus } = usePortalAuth();

  const isLoading = authStatus === 'initializing' || authStatus === 'authenticating';
  const isDisabled = disabled || isLoading;
  const redirectToPortalHome = () => navigate(withDarkPath(pathname, '/portal'));

  const buttonSx = {
    justifyContent: 'flex-start',
    gap: 1.5,
    px: 2,
    py: 1,
    textTransform: 'none',
    fontSize: '0.9375rem',
    fontWeight: 500,
    borderColor: 'divider',
    color: 'text.primary',
    backgroundColor: 'background.paper',
    '&:hover': {
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      borderColor: 'text.secondary',
    },
  };

  return (
    <Stack spacing={1.25} sx={{ width: '100%', maxWidth: compact ? 320 : 400 }}>
      <Button
        type="button"
        variant="outlined"
        fullWidth
        sx={buttonSx}
        startIcon={<GoogleLogo />}
        onClick={async () => {
          const didSignIn = await signInWithProvider('google.com');
          if (didSignIn) redirectToPortalHome();
        }}
        disabled={isDisabled}
        aria-label={t('socialSignIn.googleAriaLabel')}
      >
        {t('socialSignIn.google')}
      </Button>

      <Button
        type="button"
        variant="outlined"
        fullWidth
        sx={buttonSx}
        startIcon={<AppleLogo isDark={isDark} />}
        onClick={async () => {
          const didSignIn = await signInWithProvider('apple.com');
          if (didSignIn) redirectToPortalHome();
        }}
        disabled={isDisabled}
        aria-label={t('socialSignIn.appleAriaLabel')}
      >
        {t('socialSignIn.apple')}
      </Button>

      <Button
        type="button"
        variant="outlined"
        fullWidth
        sx={buttonSx}
        startIcon={<MicrosoftLogo />}
        onClick={async () => {
          const didSignIn = await signInWithProvider('microsoft.com');
          if (didSignIn) redirectToPortalHome();
        }}
        disabled={isDisabled}
        aria-label={t('socialSignIn.microsoftAriaLabel')}
      >
        {t('socialSignIn.microsoft')}
      </Button>

      <Button
        type="button"
        variant="outlined"
        fullWidth
        sx={buttonSx}
        startIcon={<FacebookLogo />}
        onClick={async () => {
          const didSignIn = await signInWithProvider('facebook.com');
          if (didSignIn) redirectToPortalHome();
        }}
        disabled={isDisabled}
        aria-label={t('socialSignIn.facebookAriaLabel')}
      >
        {t('socialSignIn.facebook')}
      </Button>

      <Button
        type="button"
        variant="contained"
        fullWidth
        onClick={async () => {
          const didSignIn = await signIn();
          if (didSignIn) redirectToPortalHome();
        }}
        disabled={isDisabled}
        aria-label={t('socialSignIn.anyAccountAriaLabel')}
      >
        {t('socialSignIn.anyAccount')}
      </Button>
    </Stack>
  );
};

export default SocialSignInButtons;
