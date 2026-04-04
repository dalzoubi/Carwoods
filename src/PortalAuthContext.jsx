import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { EventType, InteractionRequiredAuthError } from '@azure/msal-browser';
import { VITE_API_BASE_URL_RESOLVED } from './featureFlags';
import { ENTRA_AUTH_CONFIGURED, ENTRA_SCOPES, msalInstance } from './entraAuth';

const PortalAuthContext = createContext(null);

function endpoint(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

export const PortalAuthProvider = ({ children }) => {
  const [authStatus, setAuthStatus] = useState(
    ENTRA_AUTH_CONFIGURED ? 'initializing' : 'unconfigured'
  );
  const [authError, setAuthError] = useState('');
  const [account, setAccount] = useState(null);
  const [meStatus, setMeStatus] = useState('idle');
  const [meData, setMeData] = useState(null);
  const [meError, setMeError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  const baseUrl = VITE_API_BASE_URL_RESOLVED || '';
  const meUrl = baseUrl ? endpoint(baseUrl, '/api/portal/me') : '';

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
      setAccount(active);
      setAuthStatus('authenticated');
      return active;
    }
    setAccount(null);
    setAuthStatus('unauthenticated');
    return null;
  }, []);

  const clearSessionData = useCallback(() => {
    setMeStatus('idle');
    setMeData(null);
    setMeError('');
  }, []);

  const signInWithProvider = useCallback(async (domainHint) => {
    if (!msalInstance) {
      setAuthStatus('unconfigured');
      return;
    }
    setAuthStatus('authenticating');
    setAuthError('');
    try {
      const request = {
        scopes: ENTRA_SCOPES,
        prompt: 'select_account',
      };
      if (domainHint) {
        request.extraQueryParameters = { domain_hint: domainHint };
      }
      const result = await msalInstance.loginPopup(request);
      if (result.account) {
        msalInstance.setActiveAccount(result.account);
        setAccount(result.account);
      }
      syncActiveAccount();
      setRefreshTick((x) => x + 1);
    } catch (error) {
      setAuthStatus('error');
      setAuthError(error instanceof Error ? error.message : 'auth_failed');
    }
  }, [syncActiveAccount]);

  const signIn = useCallback(() => signInWithProvider(null), [signInWithProvider]);

  const signOut = useCallback(async () => {
    if (!msalInstance) {
      setAuthStatus('unconfigured');
      return;
    }
    try {
      await msalInstance.logoutPopup({
        account: msalInstance.getActiveAccount() ?? undefined,
      });
    } catch {
      // Even if logout popup fails, clear local auth state.
    } finally {
      setAccount(null);
      setAuthError('');
      setAuthStatus('unauthenticated');
      clearSessionData();
    }
  }, [clearSessionData]);

  const refreshMe = useCallback(() => {
    setRefreshTick((x) => x + 1);
  }, []);

  useEffect(() => {
    if (!ENTRA_AUTH_CONFIGURED || !msalInstance) {
      setAuthStatus('unconfigured');
      clearSessionData();
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
        event.eventType === EventType.ACQUIRE_TOKEN_SUCCESS ||
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
  }, [clearSessionData, syncActiveAccount]);

  useEffect(() => {
    if (!baseUrl || !meUrl || authStatus !== 'authenticated' || !account || !msalInstance) {
      clearSessionData();
      return;
    }

    const controller = new AbortController();
    const run = async () => {
      setMeStatus('loading');
      setMeError('');
      try {
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

        const res = await fetch(meUrl, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${tokenResponse.accessToken}`,
          },
          credentials: 'omit',
          signal: controller.signal,
        });

        if (!res.ok) {
          setMeStatus('error');
          setMeData(null);
          setMeError(`HTTP ${res.status}`);
          return;
        }
        const payload = await res.json();
        setMeStatus('ok');
        setMeData(payload ?? null);
      } catch (error) {
        if (controller.signal.aborted) return;
        setMeStatus('error');
        setMeData(null);
        setMeError(error instanceof Error ? error.message : 'request_failed');
      }
    };

    run();
    return () => controller.abort();
  }, [account, authStatus, baseUrl, clearSessionData, meUrl, refreshTick]);

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
      signIn,
      signInWithProvider,
      signOut,
      refreshMe,
    }),
    [
      account,
      authError,
      authStatus,
      baseUrl,
      meData,
      meError,
      meStatus,
      meUrl,
      refreshMe,
      signIn,
      signInWithProvider,
      signOut,
    ]
  );

  return <PortalAuthContext.Provider value={value}>{children}</PortalAuthContext.Provider>;
};

export function usePortalAuth() {
  const value = useContext(PortalAuthContext);
  if (!value) {
    throw new Error('usePortalAuth must be used within PortalAuthProvider');
  }
  return value;
}

