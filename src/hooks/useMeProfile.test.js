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

  it('returns meStatus ok and meErrorStatus null on success', async () => {
    global.fetch.mockResolvedValueOnce(
      jsonResponse({ role: 'TENANT', user: { status: 'ACTIVE' } })
    );

    const params = baseParams();
    const { result } = renderHook(() => useMeProfile(params));

    await waitFor(() => expect(result.current.meStatus).toBe('ok'));
    expect(result.current.meErrorStatus).toBeNull();
    expect(result.current.meData).toEqual({ role: 'TENANT', user: { status: 'ACTIVE' } });
  });

  it('sets meErrorStatus to 403 when /me returns forbidden', async () => {
    global.fetch.mockResolvedValueOnce(
      jsonResponse({ error: 'forbidden' }, 403)
    );

    const params = baseParams();
    const { result } = renderHook(() => useMeProfile(params));

    await waitFor(() => expect(result.current.meStatus).toBe('error'));
    expect(result.current.meErrorStatus).toBe(403);
    expect(result.current.meError).toContain('HTTP 403');
    expect(result.current.meData).toBeNull();
  });

  it('sets meErrorStatus to 500 on server error', async () => {
    global.fetch.mockResolvedValueOnce(
      jsonResponse({ error: 'internal_error' }, 500)
    );

    const params = baseParams();
    const { result } = renderHook(() => useMeProfile(params));

    await waitFor(() => expect(result.current.meStatus).toBe('error'));
    expect(result.current.meErrorStatus).toBe(500);
  });

  it('sets meErrorStatus to null on network error', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network failure'));

    const params = baseParams();
    const { result } = renderHook(() => useMeProfile(params));

    await waitFor(() => expect(result.current.meStatus).toBe('error'));
    expect(result.current.meErrorStatus).toBeNull();
  });

  it('clears meErrorStatus when authStatus is not authenticated', async () => {
    const params = baseParams({ authStatus: 'unauthenticated' });
    const { result } = renderHook(() => useMeProfile(params));

    await waitFor(() => expect(result.current.meStatus).toBe('idle'));
    expect(result.current.meErrorStatus).toBeNull();
  });
});
