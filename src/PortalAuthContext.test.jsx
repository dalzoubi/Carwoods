/**
 * Tests for the disabled-account immediate lockout feature.
 *
 * We mock MSAL, useMeProfile, and supporting modules, then render a consumer
 * of PortalAuthContext to verify that a 403 from /me triggers auto-signout
 * with lockoutReason === 'account_disabled'.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import i18n from './i18n';

// vi.hoisted runs before module imports and before vi.mock factories,
// so these objects are available inside the mock factories.
const { mockMsalInstance, meProfileState } = vi.hoisted(() => {
  const meProfileState = {
    meStatus: 'ok',
    meData: { role: 'TENANT', user: { status: 'ACTIVE' } },
    meError: '',
    meErrorStatus: null,
  };

  const mockMsalInstance = {
    initialize: vi.fn().mockResolvedValue(undefined),
    handleRedirectPromise: vi.fn().mockResolvedValue(null),
    getActiveAccount: vi.fn(),
    getAllAccounts: vi.fn().mockReturnValue([]),
    setActiveAccount: vi.fn(),
    clearCache: vi.fn().mockResolvedValue(undefined),
    addEventCallback: vi.fn().mockReturnValue('cb-id'),
    removeEventCallback: vi.fn(),
    acquireTokenSilent: vi.fn().mockResolvedValue({
      accessToken: 'token-abc',
      account: { homeAccountId: 'acc-1' },
      idTokenClaims: {},
    }),
  };

  return { mockMsalInstance, meProfileState };
});

vi.mock('./hooks/useMeProfile', () => ({
  useMeProfile: () => ({ ...meProfileState }),
}));

vi.mock('./entraAuth', () => ({
  ENTRA_AUTH_CONFIGURED: true,
  ENTRA_LOGIN_SCOPES: ['openid'],
  ENTRA_SCOPES: ['api://test/.default'],
  msalInstance: mockMsalInstance,
}));

vi.mock('./lib/portalClaimsStorage', () => ({
  hydrateAccountClaims: (acct) => acct,
  persistIdTokenClaims: vi.fn(),
  writeStoredClaimsByHomeAccountId: vi.fn(),
}));

vi.mock('./featureFlags', () => ({
  VITE_API_BASE_URL_RESOLVED: 'https://api.example.com',
}));

// eslint-disable-next-line import/first
import { PortalAuthProvider, usePortalAuth, ME_POLL_INTERVAL_MS } from './PortalAuthContext';

function Inspector() {
  const ctx = usePortalAuth();
  return (
    <div>
      <span data-testid="authStatus">{ctx.authStatus}</span>
      <span data-testid="lockoutReason">{ctx.lockoutReason ?? 'none'}</span>
    </div>
  );
}

describe('ME_POLL_INTERVAL_MS', () => {
  it('is exported and equals 5 minutes (300 000 ms)', () => {
    expect(typeof ME_POLL_INTERVAL_MS).toBe('number');
    expect(ME_POLL_INTERVAL_MS).toBe(5 * 60 * 1000);
  });
});

describe('PortalAuthContext — disabled-account lockout', () => {
  beforeEach(async () => {
    meProfileState.meStatus = 'ok';
    meProfileState.meData = { role: 'TENANT', user: { status: 'ACTIVE' } };
    meProfileState.meError = '';
    meProfileState.meErrorStatus = null;

    mockMsalInstance.getActiveAccount.mockReturnValue({
      homeAccountId: 'acc-1',
      username: 'user@example.com',
    });
    mockMsalInstance.getAllAccounts.mockReturnValue([
      { homeAccountId: 'acc-1', username: 'user@example.com' },
    ]);
    mockMsalInstance.clearCache.mockClear();
    await i18n.changeLanguage('en');
  });

  it('starts authenticated with no lockoutReason', async () => {
    render(
      <PortalAuthProvider>
        <Inspector />
      </PortalAuthProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId('authStatus').textContent).toBe('authenticated')
    );
    expect(screen.getByTestId('lockoutReason').textContent).toBe('none');
  });

  it('sets lockoutReason=account_disabled and signs out when /me returns 403', async () => {
    meProfileState.meStatus = 'error';
    meProfileState.meData = null;
    meProfileState.meError = 'HTTP 403 (forbidden)';
    meProfileState.meErrorStatus = 403;

    // When clearCache resolves, MSAL no longer has an active account, so
    // any subsequent syncActiveAccount call correctly sees no account.
    mockMsalInstance.clearCache.mockImplementation(async () => {
      mockMsalInstance.getActiveAccount.mockReturnValue(null);
      mockMsalInstance.getAllAccounts.mockReturnValue([]);
    });

    render(
      <PortalAuthProvider>
        <Inspector />
      </PortalAuthProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId('lockoutReason').textContent).toBe('account_disabled')
    );
    await waitFor(() =>
      expect(screen.getByTestId('authStatus').textContent).toBe('unauthenticated')
    );
    expect(mockMsalInstance.clearCache).toHaveBeenCalled();
  });

  it('does NOT sign out for non-403 /me errors', async () => {
    meProfileState.meStatus = 'error';
    meProfileState.meData = null;
    meProfileState.meError = 'HTTP 500 (internal_error)';
    meProfileState.meErrorStatus = 500;

    render(
      <PortalAuthProvider>
        <Inspector />
      </PortalAuthProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId('authStatus').textContent).toBe('authenticated')
    );

    expect(screen.getByTestId('lockoutReason').textContent).toBe('none');
    expect(mockMsalInstance.clearCache).not.toHaveBeenCalled();
  });
});
