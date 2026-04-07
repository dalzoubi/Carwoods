import { PublicClientApplication } from '@azure/msal-browser';

const entraClientId = (import.meta.env.VITE_ENTRA_CLIENT_ID ?? '').trim();
const entraAuthority = (import.meta.env.VITE_ENTRA_AUTHORITY ?? '').trim();
const entraScopeRaw = (import.meta.env.VITE_ENTRA_API_SCOPE ?? '').trim();

export const ENTRA_SCOPES = entraScopeRaw
  .split(/[,\s]+/)
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Login requests include `email` so the ID token carries the user's real
 * email address (critical for CIAM / social-IdP accounts where
 * preferred_username is a synthetic GUID).  `openid` and `profile` are
 * added automatically by MSAL but `email` is not.
 */
export const ENTRA_LOGIN_SCOPES = [
  ...new Set([...ENTRA_SCOPES, 'openid', 'profile', 'email']),
];

export const ENTRA_AUTH_CONFIGURED = Boolean(
  entraClientId && entraAuthority && ENTRA_SCOPES.length > 0
);

export const msalInstance = ENTRA_AUTH_CONFIGURED
  ? new PublicClientApplication({
      auth: {
        clientId: entraClientId,
        authority: entraAuthority,
        redirectUri:
          typeof window !== 'undefined' ? `${window.location.origin}/portal` : undefined,
      },
      cache: {
        cacheLocation: 'sessionStorage',
        storeAuthStateInCookie: false,
      },
    })
  : null;
