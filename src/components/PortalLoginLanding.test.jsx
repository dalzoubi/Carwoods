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
    authState.isAuthenticated = false;
    authState.meStatus = 'idle';
    try {
      window.localStorage.clear();
    } catch {
      // Ignore in non-browser envs.
    }
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

  it('disables sign-in until the Terms/Privacy agreement is checked', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <WithAppTheme>
        <PortalLoginLanding />
      </WithAppTheme>
    );

    const signInButton = screen.getByRole('button', { name: /sign in/i });
    expect(signInButton).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: /terms of use and privacy policy/i }));

    expect(signInButton).toBeEnabled();
  });

  it('links the agreement to /terms-of-service and /privacy', () => {
    render(
      <WithAppTheme>
        <PortalLoginLanding />
      </WithAppTheme>
    );

    const termsLink = screen.getByRole('link', { name: /terms of use/i });
    const privacyLink = screen.getByRole('link', { name: /privacy policy/i });
    expect(termsLink).toHaveAttribute('href', expect.stringMatching(/\/terms-of-service$/));
    expect(privacyLink).toHaveAttribute('href', expect.stringMatching(/\/privacy$/));
  });

  it('remembers the accepted-terms choice across renders via localStorage', () => {
    window.localStorage.setItem('carwoods.termsAccepted', 'true');

    render(
      <WithAppTheme>
        <PortalLoginLanding />
      </WithAppTheme>
    );

    const agreementCheckbox = screen.getByRole('checkbox', {
      name: /terms of use and privacy policy/i,
    });
    expect(agreementCheckbox).toBeChecked();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled();
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

  it('shows a spinner while authenticated but /me is still loading (prevents flash of portal content)', () => {
    authState.authStatus = 'authenticated';
    authState.isAuthenticated = true;
    authState.meStatus = 'loading';

    render(
      <WithAppTheme>
        <PortalLoginLanding />
      </WithAppTheme>
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
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

  it('renders the "Keep me signed in" checkbox unchecked by default', () => {
    render(
      <WithAppTheme>
        <PortalLoginLanding />
      </WithAppTheme>
    );

    const checkbox = screen.getByRole('checkbox', { name: /keep me signed in/i });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it('passes keepSignedIn=true to signIn when the checkbox is ticked', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    authState.signIn.mockClear();

    render(
      <WithAppTheme>
        <PortalLoginLanding />
      </WithAppTheme>
    );

    await user.click(screen.getByRole('checkbox', { name: /terms of use and privacy policy/i }));
    await user.click(screen.getByRole('checkbox', { name: /keep me signed in/i }));
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(authState.signIn).toHaveBeenCalledWith({ keepSignedIn: true });
  });

  it('passes keepSignedIn=false to signIn when the checkbox is not ticked', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    authState.signIn.mockClear();

    render(
      <WithAppTheme>
        <PortalLoginLanding />
      </WithAppTheme>
    );

    await user.click(screen.getByRole('checkbox', { name: /terms of use and privacy policy/i }));
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(authState.signIn).toHaveBeenCalledWith({ keepSignedIn: false });
  });

  it('shows the idle-timeout notice when the user was signed out due to inactivity', () => {
    authState.lockoutReason = 'idle_timeout';

    render(
      <WithAppTheme>
        <PortalLoginLanding />
      </WithAppTheme>
    );

    expect(screen.getByText(/signed out due to inactivity/i)).toBeInTheDocument();
  });

  it('shows the absolute-timeout notice when the session hit the max lifetime', () => {
    authState.lockoutReason = 'absolute_timeout';

    render(
      <WithAppTheme>
        <PortalLoginLanding />
      </WithAppTheme>
    );

    expect(screen.getByText(/session has expired/i)).toBeInTheDocument();
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
