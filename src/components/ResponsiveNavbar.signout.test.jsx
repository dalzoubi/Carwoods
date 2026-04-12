import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { WithAppTheme } from '../testUtils';
import i18n from '../i18n';
import ResponsiveNavbar from './ResponsiveNavbar';

const authState = {
  isAuthenticated: true,
  account: { name: 'Test User' },
  meData: {
    role: 'TENANT',
    user: {
      first_name: 'Test',
      last_name: 'User',
      status: 'ACTIVE',
    },
  },
  signIn: vi.fn(),
  signOut: vi.fn(),
};

vi.mock('../PortalAuthContext', () => ({
  usePortalAuth: () => authState,
  PortalAuthProvider: ({ children }) => children,
}));

describe('ResponsiveNavbar sign-out confirmation', () => {
  beforeEach(async () => {
    authState.signIn.mockReset();
    authState.signOut.mockReset();
    await i18n.changeLanguage('en');
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: !query.includes('max-width'),
      media: query,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
  });

  it('opens an in-app dialog and signs out only after confirmation', async () => {
    render(
      <WithAppTheme>
        <ResponsiveNavbar />
      </WithAppTheme>
    );

    fireEvent.click(screen.getByRole('button', { name: /account menu/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^sign out$/i }));

    const dialog = screen.getByRole('dialog', { name: /sign out\?/i });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/are you sure you want to sign out\?/i)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: /^cancel$/i }));
    expect(authState.signOut).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /sign out\?/i })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /account menu/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^sign out$/i }));
    const confirmDialog = screen.getByRole('dialog', { name: /sign out\?/i });
    fireEvent.click(within(confirmDialog).getByRole('button', { name: /^sign out$/i }));

    expect(authState.signOut).toHaveBeenCalledTimes(1);
  });

  it('keeps account menu focused on profile and sign-out actions', () => {
    render(
      <WithAppTheme>
        <ResponsiveNavbar />
      </WithAppTheme>
    );

    fireEvent.click(screen.getByRole('button', { name: /account menu/i }));
    expect(screen.getByRole('menuitem', { name: /profile/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^sign out$/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /workspace/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /requests/i })).not.toBeInTheDocument();
  });

  it('renders Portal as a simple link (portal has its own sidebar)', () => {
    render(
      <WithAppTheme>
        <ResponsiveNavbar />
      </WithAppTheme>
    );

    expect(screen.getByRole('link', { name: /^portal$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /portal menu/i })).not.toBeInTheDocument();
  });
});
