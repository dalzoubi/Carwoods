import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import i18n from '../i18n';
import { WithAppTheme } from '../testUtils';
import PortalAdminLandlords from './PortalAdminLandlords';
import * as portalApiClient from '../lib/portalApiClient';

const mockAuthState = {
  isAuthenticated: true,
  account: { name: 'Portal Admin' },
  meData: {
    role: 'ADMIN',
    user: { first_name: 'Portal', last_name: 'Admin', role: 'ADMIN', status: 'ACTIVE' },
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
    fetchLandlords: vi.fn(),
    createLandlord: vi.fn(),
    patchResource: vi.fn(),
  };
});

const landlordsPayload = {
  landlords: [
    {
      id: 'landlord-1',
      email: 'lana@example.com',
      first_name: 'Lana',
      last_name: 'Lord',
      status: 'ACTIVE',
    },
  ],
};

describe('PortalAdminLandlords', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('en');
    portalApiClient.fetchLandlords.mockResolvedValue(landlordsPayload);
    portalApiClient.createLandlord.mockResolvedValue({ landlord: landlordsPayload.landlords[0] });
    portalApiClient.patchResource.mockResolvedValue({ landlord: landlordsPayload.landlords[0] });
    mockAuthState.getAccessToken = vi.fn().mockResolvedValue('mock-token');
    mockAuthState.handleApiForbidden = vi.fn();
  });

  it('edits an existing landlord and submits patch payload', async () => {
    render(
      <WithAppTheme>
        <PortalAdminLandlords />
      </WithAppTheme>
    );

    await waitFor(() => expect(portalApiClient.fetchLandlords).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.change(screen.getByLabelText(/landlord email/i), {
      target: { value: 'Lana.Updated@Example.com' },
    });
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Lana Updated' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Lord Updated' } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: '713-555-0101' } });

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(portalApiClient.patchResource).toHaveBeenCalledWith(
        'https://api.carwoods.com',
        'mock-token',
        '/api/portal/admin/landlords/landlord-1',
        {
          email: 'lana.updated@example.com',
          first_name: 'Lana Updated',
          last_name: 'Lord Updated',
          phone: '713-555-0101',
        }
      );
    });
  });

  it('shows validation error and blocks edit submit when email is invalid', async () => {
    render(
      <WithAppTheme>
        <PortalAdminLandlords />
      </WithAppTheme>
    );

    await waitFor(() => expect(portalApiClient.fetchLandlords).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.change(screen.getByLabelText(/landlord email/i), { target: { value: 'invalid-email' } });
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
    expect(portalApiClient.patchResource).not.toHaveBeenCalled();
  });
});
