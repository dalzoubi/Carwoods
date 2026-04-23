import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import i18n from '../i18n';
import { WithAppTheme } from '../testUtils';
import PortalAdminCostReport from './PortalAdminCostReport';
import * as portalApiClient from '../lib/portalApiClient';

const mockAuthState = {
  isAuthenticated: true,
  account: { username: 'admin@example.com' },
  meData: {
    role: 'ADMIN',
    user: { first_name: 'Admin', last_name: 'User', role: 'ADMIN', status: 'ACTIVE' },
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
    fetchAdminCostRollup: vi.fn(),
    fetchAdminCostLandlord: vi.fn(),
    fetchAdminCostsPricing: vi.fn(),
    patchAdminCostsPricing: vi.fn(),
  };
});

const rollupPayload = {
  from: '2025-01-01',
  to: '2025-01-31',
  days: 31,
  landlords: [
    {
      landlord_id: '11111111-1111-1111-1111-111111111111',
      landlord_name: 'Test Landlord',
      landlord_email: 'landlord@example.com',
      tier_name: 'PRO',
      per_property_rate: null,
      flat_monthly_rate: 99,
      property_count: 2,
      total_cost_usd: 12.34,
      email_cost_usd: 1,
      sms_cost_usd: 2,
      ai_cost_usd: 3,
      azure_cost_usd: 4,
      estimated_revenue_usd: 100,
      margin_usd: 87.66,
      at_risk: false,
    },
  ],
};

const pricingPayload = {
  pricing: [
    {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      service: 'RESEND_EMAIL',
      unit_type: 'EMAIL',
      rate_usd: 0.001,
      description: 'Resend',
    },
  ],
};

describe('PortalAdminCostReport', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('en');
    portalApiClient.fetchAdminCostRollup.mockResolvedValue(rollupPayload);
    portalApiClient.fetchAdminCostsPricing.mockResolvedValue(pricingPayload);
    mockAuthState.getAccessToken = vi.fn().mockResolvedValue('mock-token');
    mockAuthState.handleApiForbidden = vi.fn();
  });

  it('loads rollup and pricing, and shows translated Pro tier for PRO landlords', async () => {
    render(
      <WithAppTheme>
        <PortalAdminCostReport />
      </WithAppTheme>
    );

    await waitFor(() => {
      expect(portalApiClient.fetchAdminCostRollup).toHaveBeenCalledWith(
        'https://api.carwoods.com',
        'mock-token',
        expect.objectContaining({ emailHint: 'admin@example.com' })
      );
    });

    expect(screen.getByRole('heading', { name: /cost report/i })).toBeInTheDocument();
    expect(screen.getByText('Test Landlord')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();

    await waitFor(() => {
      expect(portalApiClient.fetchAdminCostsPricing).toHaveBeenCalledWith(
        'https://api.carwoods.com',
        'mock-token',
        { emailHint: 'admin@example.com' }
      );
    });
  });
});
