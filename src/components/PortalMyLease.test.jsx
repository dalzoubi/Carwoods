import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WithAppTheme } from '../testUtils';
import i18n from '../i18n';
import PortalMyLease from './PortalMyLease';
import * as portalApiClient from '../lib/portalApiClient';

const mockAuthState = {
  isAuthenticated: true,
  account: { name: 'Test Tenant', username: 'tenant@carwoods.com' },
  meData: {
    role: 'TENANT',
    user: { id: 'tenant-1', first_name: 'Tara', last_name: 'Tenant', role: 'TENANT', status: 'ACTIVE', email: 'tenant@carwoods.com' },
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
    fetchMyLeases: vi.fn().mockResolvedValue({ leases: [] }),
    giveNotice: vi.fn().mockResolvedValue({ notice: { id: 'n-new' } }),
    coSignNotice: vi.fn().mockResolvedValue({ notice: { id: 'n1' } }),
    withdrawNotice: vi.fn().mockResolvedValue({ notice: { id: 'n1' } }),
  };
});

function makeLease(overrides = {}) {
  return {
    id: 'lease-1',
    is_active: true,
    start_date: '2025-01-01',
    end_date: '2026-01-01',
    month_to_month: false,
    rent_amount: 1800,
    property_street: '100 Main St',
    property_city: 'Houston',
    property_state: 'TX',
    property_zip: '77001',
    tenant_user_ids: 'tenant-1',
    live_notice: null,
    my_co_sign_pending: false,
    ...overrides,
  };
}

describe('PortalMyLease', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockAuthState.isAuthenticated = true;
    mockAuthState.meData.role = 'TENANT';
    mockAuthState.meData.user.role = 'TENANT';
    mockAuthState.meStatus = 'ok';
    mockAuthState.baseUrl = 'https://api.carwoods.com';
    portalApiClient.fetchMyLeases.mockResolvedValue({ leases: [] });
    await i18n.changeLanguage('en');
  });

  it('renders page heading and intro', async () => {
    render(<WithAppTheme><PortalMyLease /></WithAppTheme>);
    await waitFor(() => expect(portalApiClient.fetchMyLeases).toHaveBeenCalled());
    expect(screen.getByText('My lease')).toBeInTheDocument();
  });

  it('shows empty state when tenant has no active leases', async () => {
    render(<WithAppTheme><PortalMyLease /></WithAppTheme>);
    await waitFor(() => {
      expect(screen.getByText(/no active lease/i)).toBeInTheDocument();
    });
  });

  it('renders lease card with Give notice button when no live notice', async () => {
    portalApiClient.fetchMyLeases.mockResolvedValue({ leases: [makeLease()] });
    render(<WithAppTheme><PortalMyLease /></WithAppTheme>);
    await waitFor(() => {
      expect(screen.getByText(/100 Main St/)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /give notice to move out/i })).toBeInTheDocument();
  });

  it('shows withdraw button for the notice author', async () => {
    portalApiClient.fetchMyLeases.mockResolvedValue({
      leases: [makeLease({
        live_notice: {
          id: 'n1',
          status: 'pending_landlord',
          given_by_user_id: 'tenant-1',
          given_on: '2026-04-01',
          planned_move_out_date: '2026-05-15',
        },
      })],
    });
    render(<WithAppTheme><PortalMyLease /></WithAppTheme>);
    await waitFor(() => {
      expect(screen.getByText(/sent to landlord/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /withdraw/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^give notice/i })).not.toBeInTheDocument();
  });

  it('shows co-sign button when my_co_sign_pending is true', async () => {
    portalApiClient.fetchMyLeases.mockResolvedValue({
      leases: [makeLease({
        my_co_sign_pending: true,
        live_notice: {
          id: 'n1',
          status: 'pending_co_signers',
          given_by_user_id: 'tenant-other',
          given_on: '2026-04-01',
          planned_move_out_date: '2026-05-15',
        },
      })],
    });
    render(<WithAppTheme><PortalMyLease /></WithAppTheme>);
    await waitFor(() => {
      expect(screen.getByText(/waiting on co-signers/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /co-sign/i })).toBeInTheDocument();
  });

  it('opens give-notice dialog and submits', async () => {
    portalApiClient.fetchMyLeases.mockResolvedValue({ leases: [makeLease()] });
    render(<WithAppTheme><PortalMyLease /></WithAppTheme>);
    await waitFor(() => expect(screen.getByRole('button', { name: /give notice to move out/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /give notice to move out/i }));

    const dialogTitle = await screen.findByText('Give notice to move out', { selector: 'h2' });
    expect(dialogTitle).toBeInTheDocument();

    const dateInput = document.querySelector('input[type="date"]');
    expect(dateInput).not.toBeNull();
    fireEvent.change(dateInput, { target: { value: '2026-06-01' } });

    fireEvent.click(screen.getByRole('button', { name: /submit notice/i }));

    await waitFor(() => expect(portalApiClient.giveNotice).toHaveBeenCalled());
    const call = portalApiClient.giveNotice.mock.calls[0];
    expect(call[2]).toBe('lease-1');
    expect(call[3].planned_move_out_date).toBe('2026-06-01');
    expect(call[3].scope).toBe('all_tenants');
  });

  it('calls withdrawNotice when withdraw button clicked', async () => {
    portalApiClient.fetchMyLeases.mockResolvedValue({
      leases: [makeLease({
        live_notice: {
          id: 'n1',
          status: 'pending_landlord',
          given_by_user_id: 'tenant-1',
          given_on: '2026-04-01',
          planned_move_out_date: '2026-05-15',
        },
      })],
    });
    render(<WithAppTheme><PortalMyLease /></WithAppTheme>);
    const withdrawBtn = await screen.findByRole('button', { name: /withdraw/i });
    fireEvent.click(withdrawBtn);
    await waitFor(() => expect(portalApiClient.withdrawNotice).toHaveBeenCalled());
    expect(portalApiClient.withdrawNotice.mock.calls[0][2]).toBe('n1');
  });

  it('shows access denied when role is not TENANT', async () => {
    mockAuthState.meData.role = 'LANDLORD';
    mockAuthState.meData.user.role = 'LANDLORD';
    render(<WithAppTheme><PortalMyLease /></WithAppTheme>);
    await waitFor(() => {
      expect(screen.getByText(/don't have access/i)).toBeInTheDocument();
    });
    expect(portalApiClient.fetchMyLeases).not.toHaveBeenCalled();
  });
});
