import { useCallback, useEffect, useState } from 'react';
import { emailFromAccount } from '../portalUtils';
import { fetchMe } from '../lib/portalApiClient';

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
    if (!baseUrl || authStatus !== 'authenticated' || !account) {
      clearMe();
      return;
    }

    const controller = new AbortController();
    const run = async () => {
      setMeStatus('loading');
      setMeError('');
      try {
        const accessToken = await getAccessToken();
        const hint = emailFromAccount(account);
        const payload = await fetchMe(baseUrl, accessToken, hint, controller.signal);
        setMeStatus('ok');
        setMeData(payload ?? null);
      } catch (error) {
        if (controller.signal.aborted) return;
        setMeStatus('error');
        setMeData(null);
        setMeError(
          error && typeof error === 'object' && 'message' in error
            ? error.message
            : error instanceof Error
              ? error.message
              : 'request_failed'
        );
      }
    };

    run();
    return () => controller.abort();
  }, [account, authStatus, baseUrl, clearMe, getAccessToken, refreshTick]);

  return { meStatus, meData, meError };
}
