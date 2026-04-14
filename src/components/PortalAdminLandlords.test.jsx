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
    fetchAdminSubscriptionTiers: vi.fn(),
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
      tier_id: 'tier-starter',
      tier_name: 'STARTER',
      tier_display_name: 'Starter',
    },
  ],
};

const tiersPayload = {
  tiers: [
    { id: 'tier-free', name: 'FREE', display_name: 'Free', is_active: true },
    { id: 'tier-starter', name: 'STARTER', display_name: 'Starter', is_active: true },
    { id: 'tier-pro', name: 'PRO', display_name: 'Pro', is_active: true },
  ],
};

describe('PortalAdminLandlords', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('en');
    portalApiClient.fetchLandlords.mockResolvedValue(landlordsPayload);
    portalApiClient.fetchAdminSubscriptionTiers.mockResolvedValue(tiersPayload);
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

    expect(screen.getByText('Starter')).toBeInTheDocument();

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

  it('creates a landlord with selected subscription tier', async () => {
    render(
      <WithAppTheme>
        <PortalAdminLandlords />
      </WithAppTheme>
    );

    await waitFor(() => expect(portalApiClient.fetchAdminSubscriptionTiers).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /add landlord/i }));

    fireEvent.change(screen.getByLabelText(/landlord email/i), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Ned' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'New' } });

    const planCombo = screen.getByRole('combobox', { name: /subscription plan/i });
    fireEvent.mouseDown(planCombo);
    const starterOption = await screen.findByRole('option', { name: 'Starter' });
    fireEvent.click(starterOption);

    fireEvent.click(screen.getByRole('button', { name: /^save landlord$/i }));

    await waitFor(() => {
      expect(portalApiClient.createLandlord).toHaveBeenCalledWith(
        'https://api.carwoods.com',
        'mock-token',
        expect.objectContaining({
          email: 'new@example.com',
          first_name: 'Ned',
          last_name: 'New',
          tier_id: 'tier-starter',
        })
      );
    });
  });

  it('updates landlord tier via admin tier endpoint', async () => {
    render(
      <WithAppTheme>
        <PortalAdminLandlords />
      </WithAppTheme>
    );

    await waitFor(() => expect(portalApiClient.fetchAdminSubscriptionTiers).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /change subscription plan/i }));

    await waitFor(() => {
      expect(screen.getByText(/subscription plan for lana lord/i)).toBeInTheDocument();
    });

    const combo = screen.getByRole('combobox', { name: /plan/i });
    fireEvent.mouseDown(combo);
    const freeOption = await screen.findByRole('option', { name: 'Free' });
    fireEvent.click(freeOption);

    fireEvent.click(screen.getByRole('button', { name: /^save plan$/i }));

    await waitFor(() => {
      expect(portalApiClient.patchResource).toHaveBeenCalledWith(
        'https://api.carwoods.com',
        'mock-token',
        '/api/portal/admin/landlords/landlord-1/tier',
        { tier_id: 'tier-free' }
      );
    });
  });
});
