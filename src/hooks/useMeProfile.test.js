import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useMeProfile } from './useMeProfile';

function baseParams(overrides = {}) {
  return {
    account: { homeAccountId: 'acc-1', idTokenClaims: { email: 'user@example.com' } },
    authStatus: 'authenticated',
    baseUrl: 'https://api.example.com',
    getAccessToken: vi.fn().mockResolvedValue('test-token'),
    refreshTick: 0,
    ...overrides,
  };
}

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}

describe('useMeProfile', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sets meErrorStatus=403 and meErrorCode=account_disabled on disabled account response', async () => {
    global.fetch.mockResolvedValueOnce(
      jsonResponse({ error: 'account_disabled' }, 403)
    );

    const params = baseParams();
    const { result } = renderHook(() => useMeProfile(params));

    await waitFor(() => expect(result.current.meStatus).toBe('error'));
    expect(result.current.meErrorStatus).toBe(403);
    expect(result.current.meErrorCode).toBe('account_disabled');
    expect(result.current.meError).toContain('HTTP 403');
    expect(result.current.meData).toBeNull();
  });

  it('sets meErrorStatus=403 and meErrorCode=no_portal_access on guest/no-access response', async () => {
    global.fetch.mockResolvedValueOnce(
      jsonResponse({ error: 'no_portal_access' }, 403)
    );

    const params = baseParams();
    const { result } = renderHook(() => useMeProfile(params));

    await waitFor(() => expect(result.current.meStatus).toBe('error'));
    expect(result.current.meErrorStatus).toBe(403);
    expect(result.current.meErrorCode).toBe('no_portal_access');
    expect(result.current.meData).toBeNull();
  });

  it('sets meErrorCode=null on success', async () => {
    global.fetch.mockResolvedValueOnce(
      jsonResponse({ role: 'TENANT', user: { status: 'ACTIVE' } })
    );

    const params = baseParams();
    const { result } = renderHook(() => useMeProfile(params));

    await waitFor(() => expect(result.current.meStatus).toBe('ok'));
    expect(result.current.meErrorCode).toBeNull();
  });

  it('sets meErrorStatus to 500 on server error', async () => {
    global.fetch.mockResolvedValueOnce(
      jsonResponse({ error: 'internal_error' }, 500)
    );

    const params = baseParams();
    const { result } = renderHook(() => useMeProfile(params));

    await waitFor(() => expect(result.current.meStatus).toBe('error'));
    expect(result.current.meErrorStatus).toBe(500);
    expect(result.current.meErrorCode).toBe('internal_error');
  });

  it('sets meErrorStatus to null on network error', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network failure'));

    const params = baseParams();
    const { result } = renderHook(() => useMeProfile(params));

    await waitFor(() => expect(result.current.meStatus).toBe('error'));
    expect(result.current.meErrorStatus).toBeNull();
    expect(result.current.meErrorCode).toBeNull();
  });

  it('clears meErrorStatus and meErrorCode when authStatus is not authenticated', async () => {
    const params = baseParams({ authStatus: 'unauthenticated' });
    const { result } = renderHook(() => useMeProfile(params));

    await waitFor(() => expect(result.current.meStatus).toBe('idle'));
    expect(result.current.meErrorStatus).toBeNull();
    expect(result.current.meErrorCode).toBeNull();
  });
});
