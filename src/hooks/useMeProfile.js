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
 * @returns {{ meStatus: string, meData: object|null, meError: string, meErrorStatus: number|null, meErrorCode: string|null }}
 */
export function useMeProfile({ account, authStatus, baseUrl, getAccessToken, refreshTick }) {
  const [meStatus, setMeStatus] = useState('idle');
  const [meData, setMeData] = useState(null);
  const [meError, setMeError] = useState('');
  const [meErrorStatus, setMeErrorStatus] = useState(null);
  const [meErrorCode, setMeErrorCode] = useState(null);

  const clearMe = useCallback(() => {
    setMeStatus('idle');
    setMeData(null);
    setMeError('');
    setMeErrorStatus(null);
    setMeErrorCode(null);
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
      setMeErrorStatus(null);
      setMeErrorCode(null);
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
        setMeErrorStatus(
          error && typeof error === 'object' && typeof error.status === 'number'
            ? error.status
            : null
        );
        setMeErrorCode(
          error && typeof error === 'object' && typeof error.code === 'string' && error.code
            ? error.code
            : null
        );
      }
    };

    run();
    return () => controller.abort();
  }, [account, authStatus, baseUrl, clearMe, getAccessToken, refreshTick]);

  return { meStatus, meData, meError, meErrorStatus, meErrorCode };
}
