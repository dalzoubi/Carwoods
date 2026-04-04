import { PublicClientApplication } from '@azure/msal-browser';

const entraClientId = (import.meta.env.VITE_ENTRA_CLIENT_ID ?? '').trim();
const entraAuthority = (import.meta.env.VITE_ENTRA_AUTHORITY ?? '').trim();
const entraScopeRaw = (import.meta.env.VITE_ENTRA_API_SCOPE ?? '').trim();

export const ENTRA_SCOPES = entraScopeRaw
  .split(/[,\s]+/)
  .map((s) => s.trim())
  .filter(Boolean);

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
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false,
      },
    })
  : null;

