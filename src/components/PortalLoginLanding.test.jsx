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

  it('shows the sign-in button and no alerts by default', () => {
    render(
      <WithAppTheme>
        <PortalLoginLanding />
      </WithAppTheme>
    );
    expect(screen.queryByText(/your account has been disabled/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/does not have access/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows a spinner and no sign-in button while initializing', () => {
    authState.authStatus = 'initializing';

    render(
      <WithAppTheme>
        <PortalLoginLanding />
      </WithAppTheme>
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText(/initializing auth/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('shows a signing-in spinner and no sign-in button while authenticating', () => {
    authState.authStatus = 'authenticating';

    render(
      <WithAppTheme>
        <PortalLoginLanding />
      </WithAppTheme>
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText(/signing in/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('shows the account-disabled error alert and hides sign-in button', () => {
    authState.lockoutReason = 'account_disabled';

    render(
      <WithAppTheme>
        <PortalLoginLanding />
      </WithAppTheme>
    );

    expect(screen.getByText(/your account has been disabled/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('shows the no-portal-access warning alert and hides sign-in button', () => {
    authState.lockoutReason = 'no_portal_access';

    render(
      <WithAppTheme>
        <PortalLoginLanding />
      </WithAppTheme>
    );

    expect(screen.getByText(/does not have access to this portal/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
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
    // Sign-in button hidden when unconfigured (existing behaviour)
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('shows account-disabled alert even when authStatus is unconfigured', () => {
    authState.lockoutReason = 'account_disabled';
    authState.authStatus = 'unconfigured';

    render(
      <WithAppTheme>
        <PortalLoginLanding />
      </WithAppTheme>
    );

    expect(screen.getByText(/your account has been disabled/i)).toBeInTheDocument();
    expect(
      screen.getByText(/portal authentication is not configured yet/i)
    ).toBeInTheDocument();
  });
});
