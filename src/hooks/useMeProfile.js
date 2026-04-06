import { useCallback, useEffect, useState } from 'react';
import { emailFromAccount } from '../portalUtils';

/**
 * Fetches /api/portal/me whenever the account is authenticated and a baseUrl
 * is available. Re-fetches when refreshTick changes (triggered by refreshMe).
 *
 * @param {object} params
 * @param {object|null} params.account - Active MSAL account object
 * @param {string} params.authStatus - Current auth status string
 * @param {string} params.baseUrl - API base URL (empty string = disabled)
 * @param {() => Promise<string>} params.getAccessToken - Returns a Bearer token
 * @param {number} params.refreshTick - Increment to trigger a re-fetch
 * @returns {{ meStatus: string, meData: object|null, meError: string }}
 */
export function useMeProfile({ account, authStatus, baseUrl, getAccessToken, refreshTick }) {
  const [meStatus, setMeStatus] = useState('idle');
  const [meData, setMeData] = useState(null);
  const [meError, setMeError] = useState('');

  const clearMe = useCallback(() => {
    setMeStatus('idle');
    setMeData(null);
    setMeError('');
  }, []);

  useEffect(() => {
    const meUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/api/portal/me` : '';

    if (!baseUrl || !meUrl || authStatus !== 'authenticated' || !account) {
      clearMe();
      return;
    }

    const controller = new AbortController();
    const run = async () => {
      setMeStatus('loading');
      setMeError('');
      try {
        const accessToken = await getAccessToken();

        const meHeaders = {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        };
        const hint = emailFromAccount(account);
        if (hint) {
          meHeaders['X-Email-Hint'] = hint;
        }

        const res = await fetch(meUrl, {
          method: 'GET',
          headers: meHeaders,
          credentials: 'omit',
          signal: controller.signal,
        });

        if (!res.ok) {
          let errorCode = '';
          try {
            const payload = await res.json();
            if (payload && typeof payload.error === 'string') {
              errorCode = payload.error;
            }
          } catch {
            // Best-effort parse; keep HTTP status if body is not JSON.
          }
          setMeStatus('error');
          setMeData(null);
          setMeError(errorCode ? `HTTP ${res.status} (${errorCode})` : `HTTP ${res.status}`);
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
  }, [account, authStatus, baseUrl, clearMe, getAccessToken, refreshTick]);

  return { meStatus, meData, meError };
}
