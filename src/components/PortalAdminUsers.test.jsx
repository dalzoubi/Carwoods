import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import i18n from '../i18n';
import { WithAppTheme } from '../testUtils';
import PortalAdminUsers from './PortalAdminUsers';
import * as portalApiClient from '../lib/portalApiClient';

const mockAuthState = {
  isAuthenticated: true,
  account: { name: 'Portal Admin', username: 'admin@example.com' },
  meData: {
    role: 'ADMIN',
    user: { id: 'admin-user-1', first_name: 'Portal', last_name: 'Admin', role: 'ADMIN', status: 'ACTIVE' },
  },
  meStatus: 'ok',
  baseUrl: 'https://api.carwoods.com',
  getAccessToken: vi.fn().mockResolvedValue('mock-token'),
  handleApiForbidden: vi.fn(),
};

vi.mock('../PortalAuthContext', () => ({
  usePortalAuth: () => mockAuthState,
  PortalAuthProvider: ({ children }) => children,
}));

vi.mock('../lib/portalApiClient', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchAdminPortalUsers: vi.fn(),
    deleteAdminUser: vi.fn(),
  };
});

function makeUser(overrides = {}) {
  return {
    id: 'user-1',
    first_name: 'Jane',
    last_name: 'Tenant',
    email: 'jane@example.com',
    role: 'TENANT',
    status: 'ACTIVE',
    associated_records: {
      propertyCount: 0,
      leaseCount: 0,
      maintenanceRequestCount: 0,
      documentCount: 0,
      supportTicketCount: 0,
      leaseTenancyCount: 2,
      maintenanceRequestSubmittedCount: 0,
    },
    ...overrides,
  };
}

describe('PortalAdminUsers', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('en');
    mockAuthState.meData = {
      role: 'ADMIN',
      user: { id: 'admin-user-1', first_name: 'Portal', last_name: 'Admin', role: 'ADMIN', status: 'ACTIVE' },
    };
    mockAuthState.meStatus = 'ok';
    mockAuthState.isAuthenticated = true;
    mockAuthState.getAccessToken = vi.fn().mockResolvedValue('mock-token');
    mockAuthState.handleApiForbidden = vi.fn();
    portalApiClient.fetchAdminPortalUsers.mockResolvedValue({ users: [] });
    portalApiClient.deleteAdminUser.mockResolvedValue({ summary: null });
  });

  it('shows admin-only error message when rendered as TENANT', async () => {
    mockAuthState.meData = {
      role: 'TENANT',
      user: { id: 'tenant-1', first_name: 'T', last_name: 'User', role: 'TENANT', status: 'ACTIVE' },
    };

    render(
      <WithAppTheme>
        <PortalAdminUsers />
      </WithAppTheme>
    );

    await waitFor(() => {
      expect(screen.getByText(/only administrators can view this page/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /permanently remove user/i })).not.toBeInTheDocument();
  });

  it('fetches and displays users list for ADMIN', async () => {
    portalApiClient.fetchAdminPortalUsers.mockResolvedValue({
      users: [
        makeUser({ id: 'user-t1', first_name: 'Jane', last_name: 'Tenant', email: 'jane@example.com', role: 'TENANT' }),
        makeUser({ id: 'user-l1', first_name: 'Leo', last_name: 'Landlord', email: 'leo@example.com', role: 'LANDLORD' }),
      ],
    });

    render(
      <WithAppTheme>
        <PortalAdminUsers />
      </WithAppTheme>
    );

    await screen.findByText('Jane Tenant');
    expect(screen.getByText('Leo Landlord')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('leo@example.com')).toBeInTheDocument();
    expect(portalApiClient.fetchAdminPortalUsers).toHaveBeenCalledWith(
      'https://api.carwoods.com',
      'mock-token',
      expect.objectContaining({ includeInactive: true })
    );
  });

  it('opens delete dialog when delete button is clicked on a non-admin user', async () => {
    portalApiClient.fetchAdminPortalUsers.mockResolvedValue({
      users: [makeUser({ id: 'del-user-1', first_name: 'Del', last_name: 'Target', role: 'TENANT' })],
    });

    render(
      <WithAppTheme>
        <PortalAdminUsers />
      </WithAppTheme>
    );

    await screen.findByText('Del Target');

    fireEvent.click(screen.getByRole('button', { name: /permanently remove user/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    // Dialog title includes the user name
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText(/del target/i).length).toBeGreaterThan(0);
  });

  it('calls deleteAdminUser with reason and reloads list on confirm', async () => {
    portalApiClient.fetchAdminPortalUsers.mockResolvedValue({
      users: [makeUser({ id: 'del-user-2', first_name: 'Remove', last_name: 'Me', role: 'LANDLORD' })],
    });
    portalApiClient.deleteAdminUser.mockResolvedValue({ summary: { deleted: true } });

    render(
      <WithAppTheme>
        <PortalAdminUsers />
      </WithAppTheme>
    );

    await screen.findByText('Remove Me');
    fireEvent.click(screen.getByRole('button', { name: /permanently remove user/i }));

    const reasonField = await screen.findByLabelText(/reason for removal/i);
    fireEvent.change(reasonField, { target: { value: 'Account was created by mistake and must be removed.' } });

    // Button text is "Permanently delete" per translation key portalAdminUsers.delete.confirm
    const confirmBtn = screen.getByRole('button', { name: /^permanently delete$/i });
    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(portalApiClient.deleteAdminUser).toHaveBeenCalledWith(
        'https://api.carwoods.com',
        'mock-token',
        'del-user-2',
        expect.objectContaining({ reason: expect.any(String) })
      );
    });
    await waitFor(() => {
      expect(portalApiClient.fetchAdminPortalUsers).toHaveBeenCalledTimes(2);
    });
  });

  it('disables delete button for the currently signed-in admin (self)', async () => {
    portalApiClient.fetchAdminPortalUsers.mockResolvedValue({
      users: [
        makeUser({ id: 'admin-user-1', first_name: 'Portal', last_name: 'Admin', role: 'ADMIN' }),
      ],
    });

    render(
      <WithAppTheme>
        <PortalAdminUsers />
      </WithAppTheme>
    );

    await screen.findByText('Portal Admin');
    const deleteBtn = screen.getByRole('button', { name: /permanently remove user/i });
    expect(deleteBtn).toBeDisabled();
  });

  it('shows snackbar error when fetchAdminPortalUsers fails', async () => {
    portalApiClient.fetchAdminPortalUsers.mockRejectedValue(
      new Error('Network error')
    );

    render(
      <WithAppTheme>
        <PortalAdminUsers />
      </WithAppTheme>
    );

    await waitFor(() => {
      expect(screen.getByText(/could not load users/i)).toBeInTheDocument();
    });
  });
});
