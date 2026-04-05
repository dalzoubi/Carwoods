import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { WithAppTheme } from '../testUtils';
import i18n from '../i18n';
import PortalSetup from './PortalSetup';

const authState = {
  authStatus: 'authenticated',
  authError: '',
  account: { name: 'Test User' },
  isAuthenticated: true,
  meStatus: 'ok',
  meData: {
    role: 'TENANT',
    user: {
      first_name: 'Test',
      last_name: 'User',
    },
  },
  meError: '',
  signOut: vi.fn(),
  refreshMe: vi.fn(),
};

vi.mock('../PortalAuthContext', () => ({
  usePortalAuth: () => authState,
  PortalAuthProvider: ({ children }) => children,
}));

describe('PortalSetup sign-out confirmation', () => {
  beforeEach(async () => {
    authState.signOut.mockReset();
    authState.refreshMe.mockReset();
    await i18n.changeLanguage('en');
  });

  it('requires in-app confirmation before signing out', () => {
    render(
      <WithAppTheme>
        <PortalSetup />
      </WithAppTheme>
    );

    fireEvent.click(screen.getByRole('button', { name: /^sign out$/i }));
    const dialog = screen.getByRole('dialog', { name: /sign out\?/i });
    expect(within(dialog).getByText(/are you sure you want to sign out\?/i)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: /^cancel$/i }));
    expect(authState.signOut).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /^sign out$/i }));
    const confirmDialog = screen.getByRole('dialog', { name: /sign out\?/i });
    const callsBeforeConfirm = authState.signOut.mock.calls.length;
    fireEvent.click(within(confirmDialog).getByRole('button', { name: /^sign out$/i }));

    expect(authState.signOut.mock.calls.length).toBeGreaterThan(callsBeforeConfirm);
  });
});
