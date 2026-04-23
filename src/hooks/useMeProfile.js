import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { emailFromAccount } from '../portalUtils';
import { isPortalApiReachable } from '../featureFlags';
import { fetchMe } from '../lib/portalApiClient';

/**
 * Fetches /api/portal/me whenever the account is authenticated and a baseUrl
 * is available.
 * - `refreshTick` — user-driven / sign-in reloads (shows loading).
 * - `silentRefreshTick` — background polls and soft refreshMe calls (no loading flash).
 *
 * @param {object} params
 * @param {object|null} params.account - Active portal auth account object
 * @param {string} params.authStatus - Current auth status string
 * @param {string} params.baseUrl - API base URL (empty string = disabled)
 * @param {() => Promise<string>} params.getAccessToken - Returns a Bearer token
 * @param {number} params.refreshTick - Increment to trigger a loud re-fetch
 * @param {number} [params.silentRefreshTick] - Increment to refresh without loading UI
 * @returns {{ meStatus: string, meData: object|null, meError: string, meErrorStatus: number|null, meErrorCode: string|null }}
 */
function accountStableKey(account) {
  if (!account) return '';
  return [
    account.uid ?? '',
    account.username ?? '',
    account.name ?? '',
    account.photoURL ?? '',
  ].join('\0');
}

export function useMeProfile({
  account,
  authStatus,
  baseUrl,
  getAccessToken,
  refreshTick,
  silentRefreshTick = 0,
}) {
  const [meStatus, setMeStatus] = useState('idle');
  const [meData, setMeData] = useState(null);
  const [meError, setMeError] = useState('');
  const [meErrorStatus, setMeErrorStatus] = useState(null);
  const [meErrorCode, setMeErrorCode] = useState(null);

  const accountKey = useMemo(
    () => accountStableKey(account),
    // identity fields only — full `account` object can be a new ref each render from the auth SDK
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keep in sync with accountStableKey inputs
    [account?.uid, account?.username, account?.name, account?.photoURL]
  );

  const accountRef = useRef(account);
  accountRef.current = account;

  const authStatusRef = useRef(authStatus);
  const baseUrlRef = useRef(baseUrl);
  const accountKeyRef = useRef(accountKey);
  authStatusRef.current = authStatus;
  baseUrlRef.current = baseUrl;
  accountKeyRef.current = accountKey;

  const buildSafeMeErrorMessage = useCallback((error) => {
    const status = error && typeof error === 'object' && typeof error.status === 'number'
      ? error.status
      : null;
    if (typeof status === 'number') {
      return `HTTP ${status}`;
    }
    return 'request_failed';
  }, []);

  const clearMe = useCallback(() => {
    setMeStatus('idle');
    setMeData(null);
    setMeError('');
    setMeErrorStatus(null);
    setMeErrorCode(null);
  }, []);

  useEffect(() => {
    if (!isPortalApiReachable(baseUrl) || authStatus !== 'authenticated' || !accountKey) {
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
        const hint = emailFromAccount(accountRef.current);
        const payload = await fetchMe(baseUrl, accessToken, hint, controller.signal);
        setMeStatus('ok');
        setMeData(payload ?? null);
      } catch (error) {
        if (controller.signal.aborted) return;
        setMeStatus('error');
        setMeData(null);
        setMeError(buildSafeMeErrorMessage(error));
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
  }, [accountKey, authStatus, baseUrl, buildSafeMeErrorMessage, clearMe, getAccessToken, refreshTick]);

  useEffect(() => {
    if (silentRefreshTick === 0) return;
    if (
      !isPortalApiReachable(baseUrlRef.current)
      || authStatusRef.current !== 'authenticated'
      || !accountKeyRef.current
    ) {
      return;
    }

    const controller = new AbortController();
    const run = async () => {
      try {
        const accessToken = await getAccessToken();
        const hint = emailFromAccount(accountRef.current);
        const payload = await fetchMe(baseUrlRef.current, accessToken, hint, controller.signal);
        setMeStatus('ok');
        setMeData(payload ?? null);
        setMeError('');
        setMeErrorStatus(null);
        setMeErrorCode(null);
      } catch (error) {
        if (controller.signal.aborted) return;
        const status =
          error && typeof error === 'object' && typeof error.status === 'number'
            ? error.status
            : null;
        if (status === 403) {
          setMeStatus('error');
          setMeData(null);
          setMeError(buildSafeMeErrorMessage(error));
          setMeErrorStatus(403);
          setMeErrorCode(
            error && typeof error === 'object' && typeof error.code === 'string' && error.code
              ? error.code
              : null
          );
        }
      }
    };

    void run();
    return () => controller.abort();
  }, [silentRefreshTick, buildSafeMeErrorMessage, getAccessToken]);

  return { meStatus, meData, meError, meErrorStatus, meErrorCode };
}
