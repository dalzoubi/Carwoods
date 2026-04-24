import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import i18n from '../i18n';
import { WithAppTheme } from '../testUtils';
import PortalAdminNotificationOverrides from './PortalAdminNotificationOverrides';
import * as portalApiClient from '../lib/portalApiClient';

const mockAuthState = {
  isAuthenticated: true,
  account: { username: 'admin@example.com' },
  meData: {
    role: 'ADMIN',
    user: { id: 'admin-1', first_name: 'Portal', last_name: 'Admin', role: 'ADMIN', status: 'ACTIVE' },
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
    fetchAdminNotificationOverrides: vi.fn(),
    fetchAdminNotificationOverridesForUser: vi.fn(),
    fetchAdminNotificationFlowDefaults: vi.fn(),
  };
});

function makeOverrideUser(overrides = {}) {
  return {
    user_id: 'user-t1',
    first_name: 'Jane',
    last_name: 'Tenant',
    email: 'jane@example.com',
    role: 'TENANT',
    global: {
      in_app_enabled: true,
      email_enabled: true,
      sms_enabled: false,
      sms_opt_in: false,
    },
    flow_overrides_count: 1,
    ...overrides,
  };
}

const overridesPayload = {
  users: [makeOverrideUser()],
};

const emptyOverridesPayload = { users: [] };

const flowsPayload = {
  flows: [
    {
      event_type_code: 'MAINTENANCE_REQUEST_CREATED',
      label_key: 'notifications.flows.maintenanceRequestCreated',
      info_key: 'notifications.flows.maintenanceRequestCreatedInfo',
      category: 'MAINTENANCE',
      in_app_enabled: true,
      email_enabled: true,
      sms_enabled: false,
      quiet_hours_bypass: false,
      source: 'CODE',
      user_overridable: true,
    },
  ],
};

describe('PortalAdminNotificationOverrides', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('en');
    mockAuthState.meData = {
      role: 'ADMIN',
      user: { id: 'admin-1', first_name: 'Portal', last_name: 'Admin', role: 'ADMIN', status: 'ACTIVE' },
    };
    mockAuthState.isAuthenticated = true;
    mockAuthState.getAccessToken = vi.fn().mockResolvedValue('mock-token');
    mockAuthState.handleApiForbidden = vi.fn();
    portalApiClient.fetchAdminNotificationOverrides.mockResolvedValue(overridesPayload);
    portalApiClient.fetchAdminNotificationFlowDefaults.mockResolvedValue(flowsPayload);
    portalApiClient.fetchAdminNotificationOverridesForUser.mockResolvedValue({ flow_preferences: [] });
  });

  it('shows admin-only error when rendered as TENANT', async () => {
    mockAuthState.meData = {
      role: 'TENANT',
      user: { id: 'tenant-1', first_name: 'T', last_name: 'User', role: 'TENANT', status: 'ACTIVE' },
    };

    render(
      <WithAppTheme>
        <PortalAdminNotificationOverrides />
      </WithAppTheme>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/only admin accounts can view user overrides/i)
      ).toBeInTheDocument();
    });
    expect(portalApiClient.fetchAdminNotificationOverrides).not.toHaveBeenCalled();
  });

  it('loads and renders user rows with override badges for ADMIN', async () => {
    render(
      <WithAppTheme>
        <PortalAdminNotificationOverrides />
      </WithAppTheme>
    );

    await screen.findByText('Jane Tenant');
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText(/1 customized/i)).toBeInTheDocument();
    expect(portalApiClient.fetchAdminNotificationOverrides).toHaveBeenCalledWith(
      'https://api.carwoods.com',
      'mock-token',
      expect.objectContaining({ emailHint: expect.any(String) })
    );
  });

  it('expands a user row to fetch and show per-flow preferences', async () => {
    portalApiClient.fetchAdminNotificationOverridesForUser.mockResolvedValue({
      flow_preferences: [
        {
          event_type_code: 'MAINTENANCE_REQUEST_CREATED',
          in_app_enabled: true,
          email_enabled: false,
          sms_enabled: null,
          updated_at: '2024-06-01T00:00:00Z',
        },
      ],
    });

    render(
      <WithAppTheme>
        <PortalAdminNotificationOverrides />
      </WithAppTheme>
    );

    await screen.findByText('Jane Tenant');

    // The expand button has aria-label "expand" (collapsed state)
    const expandBtn = screen.getByRole('button', { name: 'expand' });
    fireEvent.click(expandBtn);

    await waitFor(() => {
      expect(portalApiClient.fetchAdminNotificationOverridesForUser).toHaveBeenCalledWith(
        'https://api.carwoods.com',
        'mock-token',
        'user-t1',
        expect.objectContaining({ emailHint: expect.any(String) })
      );
    });
    // event_type_code appears in detail table (may appear more than once)
    await waitFor(() => {
      expect(screen.getAllByText('MAINTENANCE_REQUEST_CREATED').length).toBeGreaterThan(0);
    });
  });

  it('shows empty state message when no users match filters', async () => {
    portalApiClient.fetchAdminNotificationOverrides.mockResolvedValue(emptyOverridesPayload);

    render(
      <WithAppTheme>
        <PortalAdminNotificationOverrides />
      </WithAppTheme>
    );

    await waitFor(() => {
      expect(screen.getByText(/no users match these filters/i)).toBeInTheDocument();
    });
  });

  it('shows error alert when fetchAdminNotificationOverrides fails', async () => {
    portalApiClient.fetchAdminNotificationOverrides.mockRejectedValue(
      new Error('API unavailable')
    );
    // catalog fetch can also fail or succeed; avoid cascading noise
    portalApiClient.fetchAdminNotificationFlowDefaults.mockResolvedValue({ flows: [] });

    render(
      <WithAppTheme>
        <PortalAdminNotificationOverrides />
      </WithAppTheme>
    );

    await waitFor(() => {
      expect(screen.getByText(/unable to load user overrides/i)).toBeInTheDocument();
    });
  });
});
