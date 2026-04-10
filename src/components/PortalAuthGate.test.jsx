import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WithAppTheme } from '../testUtils';
import i18n from '../i18n';
import PortalAuthGate from './PortalAuthGate';

const authState = {
  authStatus: 'unauthenticated',
  isAuthenticated: false,
  meStatus: 'idle',
  meData: null,
  signIn: vi.fn(),
  signInWithProvider: vi.fn(),
  signOut: vi.fn(),
  refreshMe: vi.fn(),
  getAccessToken: vi.fn(),
  lockoutReason: null,
  authError: '',
  account: null,
  meError: '',
  meErrorStatus: null,
  meErrorCode: null,
};

vi.mock('../PortalAuthContext', () => ({
  usePortalAuth: () => authState,
  PortalAuthProvider: ({ children }) => children,
}));

describe('PortalAuthGate', () => {
  beforeEach(async () => {
    authState.authStatus = 'unauthenticated';
    authState.isAuthenticated = false;
    authState.meStatus = 'idle';
    authState.lockoutReason = null;
    await i18n.changeLanguage('en');
  });

  it('shows the loading screen while Firebase Auth is initializing', () => {
    authState.authStatus = 'initializing';

    render(
      <WithAppTheme>
        <PortalAuthGate>
          <div>Portal Content</div>
        </PortalAuthGate>
      </WithAppTheme>
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText('Portal Content')).not.toBeInTheDocument();
    // Must NOT show the login landing page features or sign-in button
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/maintenance request/i)).not.toBeInTheDocument();
  });

  it('shows the loading screen while authenticating (sign-in in progress)', () => {
    authState.authStatus = 'authenticating';

    render(
      <WithAppTheme>
        <PortalAuthGate>
          <div>Portal Content</div>
        </PortalAuthGate>
      </WithAppTheme>
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText('Portal Content')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('shows the loading screen while authenticated but /me is still loading', () => {
    authState.authStatus = 'authenticated';
    authState.isAuthenticated = true;
    authState.meStatus = 'loading';

    render(
      <WithAppTheme>
        <PortalAuthGate>
          <div>Portal Content</div>
        </PortalAuthGate>
      </WithAppTheme>
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText('Portal Content')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('shows PortalLoginLanding when unauthenticated (after initializing completes)', () => {
    authState.authStatus = 'unauthenticated';
    authState.isAuthenticated = false;
    authState.meStatus = 'idle';

    render(
      <WithAppTheme>
        <PortalAuthGate>
          <div>Portal Content</div>
        </PortalAuthGate>
      </WithAppTheme>
    );

    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByText('Portal Content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated and /me has loaded', () => {
    authState.authStatus = 'authenticated';
    authState.isAuthenticated = true;
    authState.meStatus = 'ok';

    render(
      <WithAppTheme>
        <PortalAuthGate>
          <div>Portal Content</div>
        </PortalAuthGate>
      </WithAppTheme>
    );

    expect(screen.getByText('Portal Content')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });
});
