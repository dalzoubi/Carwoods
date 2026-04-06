import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WithAppTheme } from '../testUtils';
import i18n from '../i18n';
import PortalLoginLanding from './PortalLoginLanding';

const authState = {
  authStatus: 'unauthenticated',
  authError: '',
  account: null,
  isAuthenticated: false,
  meStatus: 'idle',
  meData: null,
  meError: '',
  meErrorStatus: null,
  lockoutReason: null,
  signIn: vi.fn(),
  signInWithProvider: vi.fn(),
  signOut: vi.fn(),
  refreshMe: vi.fn(),
  getAccessToken: vi.fn(),
};

vi.mock('../PortalAuthContext', () => ({
  usePortalAuth: () => authState,
  PortalAuthProvider: ({ children }) => children,
}));

describe('PortalLoginLanding', () => {
  beforeEach(async () => {
    authState.lockoutReason = null;
    authState.authStatus = 'unauthenticated';
    await i18n.changeLanguage('en');
  });

  it('does not show the account-disabled banner by default', () => {
    render(
      <WithAppTheme>
        <PortalLoginLanding />
      </WithAppTheme>
    );
    expect(
      screen.queryByText(/your account has been disabled/i)
    ).not.toBeInTheDocument();
  });

  it('shows the account-disabled error alert when lockoutReason is account_disabled', () => {
    authState.lockoutReason = 'account_disabled';

    render(
      <WithAppTheme>
        <PortalLoginLanding />
      </WithAppTheme>
    );

    expect(
      screen.getByText(/your account has been disabled/i)
    ).toBeInTheDocument();
  });

  it('shows configWarning when authStatus is unconfigured', () => {
    authState.authStatus = 'unconfigured';

    render(
      <WithAppTheme>
        <PortalLoginLanding />
      </WithAppTheme>
    );

    expect(
      screen.getByText(/portal authentication is not configured yet/i)
    ).toBeInTheDocument();
  });

  it('can show both account-disabled and unconfigured alerts simultaneously', () => {
    authState.lockoutReason = 'account_disabled';
    authState.authStatus = 'unconfigured';

    render(
      <WithAppTheme>
        <PortalLoginLanding />
      </WithAppTheme>
    );

    expect(
      screen.getByText(/your account has been disabled/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/portal authentication is not configured yet/i)
    ).toBeInTheDocument();
  });
});
