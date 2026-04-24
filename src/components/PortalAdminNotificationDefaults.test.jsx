import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import i18n from '../i18n';
import { WithAppTheme } from '../testUtils';
import PortalAdminNotificationDefaults from './PortalAdminNotificationDefaults';
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
    fetchAdminNotificationFlowDefaults: vi.fn(),
    patchAdminNotificationFlowDefault: vi.fn(),
    deleteAdminNotificationFlowDefault: vi.fn(),
  };
});

function makeFlow(overrides = {}) {
  return {
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
    ...overrides,
  };
}

const defaultFlowsPayload = {
  flows: [makeFlow()],
};

describe('PortalAdminNotificationDefaults', () => {
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
    portalApiClient.fetchAdminNotificationFlowDefaults.mockResolvedValue(defaultFlowsPayload);
    portalApiClient.patchAdminNotificationFlowDefault.mockResolvedValue({});
    portalApiClient.deleteAdminNotificationFlowDefault.mockResolvedValue({});
  });

  it('shows admin-only error when rendered as LANDLORD', async () => {
    mockAuthState.meData = {
      role: 'LANDLORD',
      user: { id: 'landlord-1', first_name: 'L', last_name: 'Lord', role: 'LANDLORD', status: 'ACTIVE' },
    };

    render(
      <WithAppTheme>
        <PortalAdminNotificationDefaults />
      </WithAppTheme>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/only admin accounts can manage notification defaults/i)
      ).toBeInTheDocument();
    });
    expect(portalApiClient.fetchAdminNotificationFlowDefaults).not.toHaveBeenCalled();
  });

  it('loads and renders notification flow rows for ADMIN', async () => {
    render(
      <WithAppTheme>
        <PortalAdminNotificationDefaults />
      </WithAppTheme>
    );

    // event_type_code appears twice in each row (caption + possibly label fallback)
    await waitFor(() => {
      expect(screen.getAllByText('MAINTENANCE_REQUEST_CREATED').length).toBeGreaterThan(0);
    });
    expect(screen.getByText(/notification defaults/i)).toBeInTheDocument();
    expect(portalApiClient.fetchAdminNotificationFlowDefaults).toHaveBeenCalledWith(
      'https://api.carwoods.com',
      'mock-token',
      expect.objectContaining({ emailHint: expect.any(String) })
    );
  });

  it('toggles an email channel switch and calls patchAdminNotificationFlowDefault', async () => {
    portalApiClient.fetchAdminNotificationFlowDefaults
      .mockResolvedValueOnce(defaultFlowsPayload)
      .mockResolvedValueOnce(defaultFlowsPayload);

    render(
      <WithAppTheme>
        <PortalAdminNotificationDefaults />
      </WithAppTheme>
    );

    await waitFor(() => {
      expect(screen.getAllByText('MAINTENANCE_REQUEST_CREATED').length).toBeGreaterThan(0);
    });

    const emailSwitches = screen.getAllByRole('checkbox', { name: /email/i });
    fireEvent.click(emailSwitches[0]);

    await waitFor(() => {
      expect(portalApiClient.patchAdminNotificationFlowDefault).toHaveBeenCalledWith(
        'https://api.carwoods.com',
        'mock-token',
        'MAINTENANCE_REQUEST_CREATED',
        expect.objectContaining({ email_enabled: false })
      );
    });
  });

  it('calls deleteAdminNotificationFlowDefault when Reset to code default is clicked for ADMIN-sourced flow', async () => {
    const adminFlow = makeFlow({ source: 'ADMIN' });
    portalApiClient.fetchAdminNotificationFlowDefaults
      .mockResolvedValueOnce({ flows: [adminFlow] })
      .mockResolvedValueOnce({ flows: [adminFlow] });

    render(
      <WithAppTheme>
        <PortalAdminNotificationDefaults />
      </WithAppTheme>
    );

    await waitFor(() => {
      expect(screen.getAllByText('MAINTENANCE_REQUEST_CREATED').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /reset to code default/i }));

    await waitFor(() => {
      expect(portalApiClient.deleteAdminNotificationFlowDefault).toHaveBeenCalledWith(
        'https://api.carwoods.com',
        'mock-token',
        'MAINTENANCE_REQUEST_CREATED',
        expect.objectContaining({ emailHint: expect.any(String) })
      );
    });
  });

  it('shows error feedback when fetchAdminNotificationFlowDefaults fails', async () => {
    portalApiClient.fetchAdminNotificationFlowDefaults.mockRejectedValue(
      new Error('API down')
    );

    render(
      <WithAppTheme>
        <PortalAdminNotificationDefaults />
      </WithAppTheme>
    );

    // Wait for the API call to reject, then assert the error text surfaces.
    // StatusAlertSlot renders errors through a MUI Snackbar (open=true after useEffect),
    // so use findByText with a generous timeout to allow the portal content to mount.
    const errorText = await screen.findByText(/unable to load notification defaults/i, {}, { timeout: 3000 });
    expect(errorText).toBeInTheDocument();
  });

  it('surfaces a save error, calls handleApiForbidden, and re-enables the switch', async () => {
    portalApiClient.fetchAdminNotificationFlowDefaults
      .mockResolvedValueOnce(defaultFlowsPayload);
    portalApiClient.patchAdminNotificationFlowDefault.mockRejectedValue(
      new Error('Save failed')
    );

    render(
      <WithAppTheme>
        <PortalAdminNotificationDefaults />
      </WithAppTheme>
    );

    await waitFor(() => {
      expect(screen.getAllByText('MAINTENANCE_REQUEST_CREATED').length).toBeGreaterThan(0);
    });

    const inAppSwitches = screen.getAllByRole('checkbox', { name: /in-app/i });
    fireEvent.click(inAppSwitches[0]);

    await waitFor(() => {
      expect(portalApiClient.patchAdminNotificationFlowDefault).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockAuthState.handleApiForbidden).toHaveBeenCalled();
    });

    const errorText = await screen.findByText(/unable to save notification default/i, {}, { timeout: 3000 });
    expect(errorText).toBeInTheDocument();

    await waitFor(() => {
      const switches = screen.getAllByRole('checkbox', { name: /in-app/i });
      expect(switches[0]).not.toBeDisabled();
    });
  });
});
