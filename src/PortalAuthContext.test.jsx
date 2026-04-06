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
    meErrorCode: null,
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

function ForbiddenTrigger() {
  const ctx = usePortalAuth();
  return (
    <div>
      <span data-testid="authStatus">{ctx.authStatus}</span>
      <span data-testid="lockoutReason">{ctx.lockoutReason ?? 'none'}</span>
      <button
        type="button"
        data-testid="trigger403"
        onClick={() => ctx.handleApiForbidden({ status: 403, code: 'forbidden', message: 'HTTP 403 (forbidden)' })}
      >
        trigger 403
      </button>
      <button
        type="button"
        data-testid="trigger500"
        onClick={() => ctx.handleApiForbidden({ status: 500, code: 'internal_error', message: 'HTTP 500' })}
      >
        trigger 500
      </button>
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
    meProfileState.meErrorCode = null;

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

  it('sets lockoutReason=account_disabled when /me returns 403 with account_disabled error code', async () => {
    meProfileState.meStatus = 'error';
    meProfileState.meData = null;
    meProfileState.meError = 'HTTP 403 (account_disabled)';
    meProfileState.meErrorStatus = 403;
    meProfileState.meErrorCode = 'account_disabled';

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

  it('sets lockoutReason=no_portal_access when /me returns 403 with no_portal_access error code', async () => {
    meProfileState.meStatus = 'error';
    meProfileState.meData = null;
    meProfileState.meError = 'HTTP 403 (no_portal_access)';
    meProfileState.meErrorStatus = 403;
    meProfileState.meErrorCode = 'no_portal_access';

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
      expect(screen.getByTestId('lockoutReason').textContent).toBe('no_portal_access')
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
    meProfileState.meErrorCode = 'internal_error';

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

describe('PortalAuthContext — handleApiForbidden', () => {
  beforeEach(async () => {
    meProfileState.meStatus = 'ok';
    meProfileState.meData = { role: 'TENANT', user: { status: 'ACTIVE' } };
    meProfileState.meError = '';
    meProfileState.meErrorStatus = null;
    meProfileState.meErrorCode = null;

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

  it('is exposed in the context value', async () => {
    let capturedHandle;
    function Capture() {
      const ctx = usePortalAuth();
      capturedHandle = ctx.handleApiForbidden;
      return null;
    }
    render(
      <PortalAuthProvider>
        <Capture />
      </PortalAuthProvider>
    );
    await waitFor(() => expect(typeof capturedHandle).toBe('function'));
  });

  it('signs out with account_disabled lockout when called with a 403 error', async () => {
    mockMsalInstance.clearCache.mockImplementation(async () => {
      mockMsalInstance.getActiveAccount.mockReturnValue(null);
      mockMsalInstance.getAllAccounts.mockReturnValue([]);
    });

    const { getByTestId } = render(
      <PortalAuthProvider>
        <ForbiddenTrigger />
      </PortalAuthProvider>
    );

    await waitFor(() =>
      expect(getByTestId('authStatus').textContent).toBe('authenticated')
    );

    getByTestId('trigger403').click();

    await waitFor(() =>
      expect(getByTestId('lockoutReason').textContent).toBe('account_disabled')
    );
    await waitFor(() =>
      expect(getByTestId('authStatus').textContent).toBe('unauthenticated')
    );
    expect(mockMsalInstance.clearCache).toHaveBeenCalled();
  });

  it('does NOT sign out when called with a non-403 error', async () => {
    const { getByTestId } = render(
      <PortalAuthProvider>
        <ForbiddenTrigger />
      </PortalAuthProvider>
    );

    await waitFor(() =>
      expect(getByTestId('authStatus').textContent).toBe('authenticated')
    );

    getByTestId('trigger500').click();

    // Give React time to settle; status should remain authenticated.
    await new Promise((r) => setTimeout(r, 50));

    expect(getByTestId('authStatus').textContent).toBe('authenticated');
    expect(getByTestId('lockoutReason').textContent).toBe('none');
    expect(mockMsalInstance.clearCache).not.toHaveBeenCalled();
  });

  it('does NOT sign out when called with null or a plain Error', async () => {
    let capturedHandle;
    function Capture() {
      const ctx = usePortalAuth();
      capturedHandle = ctx.handleApiForbidden;
      return <span data-testid="authStatus">{ctx.authStatus}</span>;
    }
    render(
      <PortalAuthProvider>
        <Capture />
      </PortalAuthProvider>
    );

    await waitFor(() =>
      expect(capturedHandle).toBeDefined()
    );

    // These should be no-ops (no throw).
    capturedHandle(null);
    capturedHandle(undefined);
    capturedHandle(new Error('network'));
    capturedHandle({ status: 401, code: 'unauthorized' });

    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByTestId('authStatus').textContent).toBe('authenticated');
    expect(mockMsalInstance.clearCache).not.toHaveBeenCalled();
  });
});
