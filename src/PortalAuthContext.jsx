import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { EventType, InteractionRequiredAuthError } from '@azure/msal-browser';
import { VITE_API_BASE_URL_RESOLVED } from './featureFlags';
import { ENTRA_AUTH_CONFIGURED, ENTRA_LOGIN_SCOPES, ENTRA_SCOPES, msalInstance } from './entraAuth';
import { Role } from './domain/constants.js';
import {
  hydrateAccountClaims,
  persistIdTokenClaims,
  writeStoredClaimsByHomeAccountId,
} from './lib/portalClaimsStorage';
import { useMeProfile } from './hooks/useMeProfile';

const PortalAuthContext = createContext(null);

const PORTAL_DEV_AUTH = import.meta.env.VITE_PORTAL_DEV_AUTH === 'true';

/** How often (ms) to re-poll /me while a user is authenticated. */
export const ME_POLL_INTERVAL_MS = 5 * 60 * 1000;

const DEV_AUTH_VALUE = PORTAL_DEV_AUTH
  ? {
      baseUrl: '',
      meUrl: '',
      authStatus: 'authenticated',
      authError: '',
      account: { name: 'Dev Landlord', username: 'dev@carwoods.com' },
      isAuthenticated: true,
      meStatus: 'ok',
      meData: {
        role: Role.LANDLORD,
        user: { first_name: 'Dev', last_name: 'Landlord', role: Role.LANDLORD, status: 'ACTIVE' },
      },
      meError: '',
      meErrorStatus: null,
      lockoutReason: null,
      signIn: () => Promise.resolve(true),
      signInWithProvider: () => Promise.resolve(true),
      signOut: () => Promise.resolve(),
      refreshMe: () => {},
      getAccessToken: () => Promise.resolve('dev-token'),
    }
  : null;

function RealPortalAuthProvider({ children }) {
  const [authStatus, setAuthStatus] = useState(
    ENTRA_AUTH_CONFIGURED ? 'initializing' : 'unconfigured'
  );
  const [authError, setAuthError] = useState('');
  const [account, setAccount] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [lockoutReason, setLockoutReason] = useState(null);

  const baseUrl = VITE_API_BASE_URL_RESOLVED || '';
  const meUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/api/portal/me` : '';

  const syncActiveAccount = useCallback(() => {
    if (!msalInstance) {
      setAccount(null);
      setAuthStatus('unconfigured');
      return null;
    }
    const active =
      msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0] ?? null;
    if (active) {
      msalInstance.setActiveAccount(active);
      setAccount(hydrateAccountClaims(active));
      setAuthStatus('authenticated');
      return active;
    }
    setAccount(null);
    setAuthStatus('unauthenticated');
    return null;
  }, []);

  const signInWithProvider = useCallback(async (domainHint) => {
    if (!msalInstance) {
      setAuthStatus('unconfigured');
      return false;
    }
    setAuthStatus('authenticating');
    setAuthError('');
    setLockoutReason(null);
    try {
      const request = {
        scopes: ENTRA_LOGIN_SCOPES,
        prompt: 'select_account',
      };
      if (domainHint) {
        request.extraQueryParameters = { domain_hint: domainHint };
      }
      const result = await msalInstance.loginPopup(request);
      if (result.account) {
        persistIdTokenClaims(result.account, result.idTokenClaims);
        msalInstance.setActiveAccount(result.account);
        setAccount(hydrateAccountClaims(result.account));
      }
      syncActiveAccount();
      setRefreshTick((x) => x + 1);
      return true;
    } catch (error) {
      setAuthStatus('error');
      setAuthError(error instanceof Error ? error.message : 'auth_failed');
      return false;
    }
  }, [syncActiveAccount]);

  const signIn = useCallback(() => signInWithProvider(null), [signInWithProvider]);

  const signOut = useCallback(async () => {
    if (!msalInstance) {
      setAuthStatus('unconfigured');
      return;
    }
    try {
      await msalInstance.clearCache();
    } catch {
      // Best-effort cache clear; local state reset below handles the rest.
    }
    msalInstance.setActiveAccount(null);
    writeStoredClaimsByHomeAccountId({});
    setAccount(null);
    setAuthError('');
    setAuthStatus('unauthenticated');
  }, []);

  const signOutDueToDisabledAccount = useCallback(async () => {
    if (!msalInstance) {
      setAuthStatus('unconfigured');
      return;
    }
    try {
      await msalInstance.clearCache();
    } catch {
      // Best-effort; local state reset below handles the rest.
    }
    msalInstance.setActiveAccount(null);
    writeStoredClaimsByHomeAccountId({});
    setAccount(null);
    setAuthError('');
    setAuthStatus('unauthenticated');
    setLockoutReason('account_disabled');
  }, []);

  const refreshMe = useCallback(() => {
    setRefreshTick((x) => x + 1);
  }, []);

  const getAccessToken = useCallback(async () => {
    if (!msalInstance || !account) {
      throw new Error('auth_unavailable');
    }
    let tokenResponse;
    try {
      tokenResponse = await msalInstance.acquireTokenSilent({
        account,
        scopes: ENTRA_SCOPES,
      });
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        tokenResponse = await msalInstance.acquireTokenPopup({
          account,
          scopes: ENTRA_SCOPES,
        });
      } else {
        throw error;
      }
    }

    persistIdTokenClaims(tokenResponse.account, tokenResponse.idTokenClaims);
    setAccount((prev) => {
      const sourceAccount = tokenResponse.account ?? prev;
      const nextAccount = hydrateAccountClaims(sourceAccount);
      if (!nextAccount) return prev;
      if (
        prev?.homeAccountId === nextAccount.homeAccountId &&
        prev?.idTokenClaims
      ) {
        return prev;
      }
      return nextAccount;
    });
    return tokenResponse.accessToken;
  }, [account]);

  useEffect(() => {
    if (!ENTRA_AUTH_CONFIGURED || !msalInstance) {
      setAuthStatus('unconfigured');
      return;
    }
    let mounted = true;
    let callbackId = null;

    const initialize = async () => {
      setAuthStatus('initializing');
      setAuthError('');
      try {
        await msalInstance.initialize();
        await msalInstance.handleRedirectPromise();
        if (mounted) {
          syncActiveAccount();
        }
      } catch (error) {
        if (!mounted) return;
        setAuthStatus('error');
        setAuthError(error instanceof Error ? error.message : 'auth_init_failed');
      }
    };

    callbackId = msalInstance.addEventCallback((event) => {
      if (
        event.eventType === EventType.LOGIN_SUCCESS ||
        event.eventType === EventType.LOGOUT_SUCCESS
      ) {
        syncActiveAccount();
      }
    });

    initialize();
    return () => {
      mounted = false;
      if (callbackId) {
        msalInstance.removeEventCallback(callbackId);
      }
    };
  }, [syncActiveAccount]);

  const { meStatus, meData, meError, meErrorStatus } = useMeProfile({
    account,
    authStatus,
    baseUrl,
    getAccessToken,
    refreshTick,
  });

  // Auto-lockout: sign out immediately when /me returns 403 (account disabled).
  useEffect(() => {
    if (meStatus === 'error' && meErrorStatus === 403) {
      signOutDueToDisabledAccount();
    }
  }, [meStatus, meErrorStatus, signOutDueToDisabledAccount]);

  // Periodic /me polling while authenticated so a disabled account is detected
  // within ME_POLL_INTERVAL_MS even without navigation or page reload.
  useEffect(() => {
    if (authStatus !== 'authenticated' || !account || !baseUrl) return;
    const id = setInterval(() => {
      setRefreshTick((x) => x + 1);
    }, ME_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [authStatus, account, baseUrl]);

  const value = useMemo(
    () => ({
      baseUrl,
      meUrl,
      authStatus,
      authError,
      account,
      isAuthenticated: authStatus === 'authenticated',
      meStatus,
      meData,
      meError,
      meErrorStatus,
      lockoutReason,
      signIn,
      signInWithProvider,
      signOut,
      refreshMe,
      getAccessToken,
    }),
    [
      account,
      authError,
      authStatus,
      baseUrl,
      lockoutReason,
      meData,
      meError,
      meErrorStatus,
      meStatus,
      meUrl,
      refreshMe,
      getAccessToken,
      signIn,
      signInWithProvider,
      signOut,
    ]
  );

  return <PortalAuthContext.Provider value={value}>{children}</PortalAuthContext.Provider>;
}

export const PortalAuthProvider = ({ children }) => {
  if (DEV_AUTH_VALUE) {
    return <PortalAuthContext.Provider value={DEV_AUTH_VALUE}>{children}</PortalAuthContext.Provider>;
  }
  return <RealPortalAuthProvider>{children}</RealPortalAuthProvider>;
};

export function usePortalAuth() {
  const value = useContext(PortalAuthContext);
  if (!value) {
    throw new Error('usePortalAuth must be used within PortalAuthProvider');
  }
  return value;
}
