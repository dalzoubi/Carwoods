import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { VITE_API_BASE_URL_RESOLVED } from './featureFlags';
import { loadPortalBearerToken, savePortalBearerToken } from './portalAuthStorage';

const PortalAuthContext = createContext(null);

function endpoint(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

export const PortalAuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => loadPortalBearerToken());
  const [meStatus, setMeStatus] = useState('idle');
  const [meData, setMeData] = useState(null);
  const [meError, setMeError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  const baseUrl = VITE_API_BASE_URL_RESOLVED || '';
  const meUrl = baseUrl ? endpoint(baseUrl, '/api/portal/me') : '';

  const saveToken = useCallback((nextToken) => {
    const normalized = (nextToken ?? '').trim();
    setToken(normalized);
    savePortalBearerToken(normalized);
  }, []);

  const clearToken = useCallback(() => {
    setToken('');
    setMeStatus('idle');
    setMeData(null);
    setMeError('');
    savePortalBearerToken('');
  }, []);

  const refreshMe = useCallback(() => {
    setRefreshTick((x) => x + 1);
  }, []);

  useEffect(() => {
    if (!baseUrl || !token) {
      setMeStatus('idle');
      setMeData(null);
      setMeError('');
      return;
    }

    const controller = new AbortController();
    const run = async () => {
      setMeStatus('loading');
      setMeError('');
      try {
        const res = await fetch(meUrl, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
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
  }, [baseUrl, meUrl, refreshTick, token]);

  const value = useMemo(
    () => ({
      baseUrl,
      meUrl,
      token,
      meStatus,
      meData,
      meError,
      saveToken,
      clearToken,
      refreshMe,
    }),
    [baseUrl, clearToken, meData, meError, meStatus, meUrl, refreshMe, saveToken, token]
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

