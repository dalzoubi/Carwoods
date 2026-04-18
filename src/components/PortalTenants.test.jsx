import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WithAppTheme } from '../testUtils';
import i18n from '../i18n';
import PortalTenants from './PortalTenants';
import * as portalApiClient from '../lib/portalApiClient';

// ---------------------------------------------------------------------------
// Mock PortalAuthContext
// ---------------------------------------------------------------------------

const mockAuthState = {
  isAuthenticated: true,
  account: { name: 'Test Landlord', username: 'landlord@carwoods.com' },
  meData: {
    role: 'LANDLORD',
    user: { first_name: 'Test', last_name: 'Landlord', role: 'LANDLORD', status: 'ACTIVE', email: 'landlord@carwoods.com' },
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

// ---------------------------------------------------------------------------
// Mock portalApiClient
// ---------------------------------------------------------------------------

vi.mock('../lib/portalApiClient', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchTenants: vi.fn().mockResolvedValue({ tenants: [] }),
    createTenant: vi.fn().mockResolvedValue({ tenant: { id: 'new-tenant-1' }, lease: { id: 'lease-1' } }),
    patchTenantAccess: vi.fn().mockResolvedValue({ tenant: { id: 't1', status: 'DISABLED' } }),
    updateTenant: vi.fn().mockResolvedValue({ tenant: { id: 't1' } }),
    deleteTenant: vi.fn().mockResolvedValue(undefined),
    addTenantLease: vi.fn().mockResolvedValue({ lease: { id: 'lease-2' } }),
    updateLease: vi.fn().mockResolvedValue({ lease: { id: 'lease-1' } }),
    deleteLease: vi.fn().mockResolvedValue(undefined),
    fetchLandlords: vi.fn().mockResolvedValue({ landlords: [] }),
    fetchLandlordProperties: vi.fn().mockResolvedValue({ properties: [] }),
    fetchLandlordLeases: vi.fn().mockResolvedValue({ leases: [] }),
  };
});

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

function makeTenant(overrides = {}) {
  return {
    id: 't1',
    first_name: 'Alice',
    last_name: 'Smith',
    email: 'alice@example.com',
    status: 'ACTIVE',
    property_street: '100 Main St',
    property_city: 'Houston',
    property_state: 'TX',
    property_zip: '77001',
    ...overrides,
  };
}

function makeProperty(overrides = {}) {
  return {
    id: 'prop-1',
    street: '100 Main St',
    city: 'Houston',
    state: 'TX',
    zip: '77001',
    ...overrides,
  };
}

function makeLandlord(overrides = {}) {
  return {
    id: 'l1',
    first_name: 'Lana',
    last_name: 'Lord',
    email: 'lana@example.com',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PortalTenants', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockAuthState.isAuthenticated = true;
    mockAuthState.meData = {
      role: 'LANDLORD',
      user: { first_name: 'Test', last_name: 'Landlord', role: 'LANDLORD', status: 'ACTIVE', email: 'landlord@carwoods.com' },
    };
    mockAuthState.meStatus = 'ok';
    mockAuthState.baseUrl = 'https://api.carwoods.com';
    mockAuthState.getAccessToken = vi.fn().mockResolvedValue('mock-token');
    mockAuthState.handleApiForbidden = vi.fn();
    portalApiClient.fetchTenants.mockResolvedValue({ tenants: [] });
    portalApiClient.fetchLandlords.mockResolvedValue({ landlords: [] });
    portalApiClient.fetchLandlordProperties.mockResolvedValue({ properties: [] });
    await i18n.changeLanguage('en');
  });

  it('renders page heading and intro', async () => {
    render(<WithAppTheme><PortalTenants /></WithAppTheme>);
    await waitFor(() => expect(portalApiClient.fetchTenants).toHaveBeenCalled());
    expect(screen.getByText('Tenants')).toBeInTheDocument();
    expect(screen.getByText(/onboard tenants/i)).toBeInTheDocument();
  });

  it('renders the Onboard Tenant button', async () => {
    render(<WithAppTheme><PortalTenants /></WithAppTheme>);
    await waitFor(() => expect(portalApiClient.fetchTenants).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /onboard tenant/i })).toBeInTheDocument();
  });

  it('calls fetchTenants on mount', async () => {
    render(<WithAppTheme><PortalTenants /></WithAppTheme>);
    await waitFor(() => expect(portalApiClient.fetchTenants).toHaveBeenCalled());
  });

  it('shows empty state when no tenants', async () => {
    render(<WithAppTheme><PortalTenants /></WithAppTheme>);
    await waitFor(() => {
      expect(screen.getByText(/no tenants yet/i)).toBeInTheDocument();
    });
  });

  it('displays tenants returned by the API', async () => {
    portalApiClient.fetchTenants.mockResolvedValue({ tenants: [makeTenant()] });
    render(<WithAppTheme><PortalTenants /></WithAppTheme>);
    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });

  it('filters empty rows and deduplicates tenants by id', async () => {
    portalApiClient.fetchTenants.mockResolvedValue({
      tenants: [
        makeTenant(),
        null,
        {},
        { id: 't1', first_name: 'Alice', last_name: 'Smith', email: 'alice@example.com', status: 'ACTIVE' },
      ],
    });
    render(<WithAppTheme><PortalTenants /></WithAppTheme>);

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });
    expect(screen.queryByText('—')).not.toBeInTheDocument();
    expect(screen.getAllByText('Alice Smith')).toHaveLength(1);
  });

  it('shows "Active" chip for active tenant', async () => {
    portalApiClient.fetchTenants.mockResolvedValue({ tenants: [makeTenant({ status: 'ACTIVE' })] });
    render(<WithAppTheme><PortalTenants /></WithAppTheme>);
    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows "Disabled" chip for disabled tenant', async () => {
    portalApiClient.fetchTenants.mockResolvedValue({ tenants: [makeTenant({ status: 'DISABLED' })] });
    render(<WithAppTheme><PortalTenants /></WithAppTheme>);
    await waitFor(() => {
      expect(screen.getByText('Disabled')).toBeInTheDocument();
    });
  });

  it('shows "Disable access" button for active tenant', async () => {
    portalApiClient.fetchTenants.mockResolvedValue({ tenants: [makeTenant()] });
    render(<WithAppTheme><PortalTenants /></WithAppTheme>);
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /disable access/i })).toBeInTheDocument();
  });

  it('shows "Enable access" button for disabled tenant', async () => {
    portalApiClient.fetchTenants.mockResolvedValue({ tenants: [makeTenant({ status: 'DISABLED' })] });
    render(<WithAppTheme><PortalTenants /></WithAppTheme>);
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /enable access/i })).toBeInTheDocument();
  });

  it('calls patchTenantAccess when "Disable access" is clicked and confirmed', async () => {
    portalApiClient.fetchTenants.mockResolvedValue({ tenants: [makeTenant()] });
    portalApiClient.patchTenantAccess.mockResolvedValue({ tenant: { id: 't1', status: 'DISABLED' } });
    render(<WithAppTheme><PortalTenants /></WithAppTheme>);
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /disable access/i }));

    // Confirm dialog should appear — click the confirm button
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    const dialog = screen.getByRole('dialog');
    const confirmBtn = within(dialog).getByRole('button', { name: /disable access/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(portalApiClient.patchTenantAccess).toHaveBeenCalledWith(
        'https://api.carwoods.com',
        'mock-token',
        't1',
        expect.objectContaining({ active: false })
      );
    });
  });

  it('calls updateTenant when editing a tenant', async () => {
    portalApiClient.fetchTenants.mockResolvedValue({ tenants: [makeTenant()] });
    portalApiClient.updateTenant.mockResolvedValue({
      tenant: {
        id: 't1',
        email: 'alice.updated@example.com',
        first_name: 'Alicia',
        last_name: 'Smith',
        phone: '555-0101',
      },
    });

    render(<WithAppTheme><PortalTenants /></WithAppTheme>);
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /edit tenant/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    const dialog = screen.getByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText(/tenant email/i), {
      target: { value: 'alice.updated@example.com' },
    });
    fireEvent.change(within(dialog).getByLabelText(/first name/i), {
      target: { value: 'Alicia' },
    });
    fireEvent.change(within(dialog).getByLabelText(/phone/i), {
      target: { value: '555-0101' },
    });

    fireEvent.click(within(dialog).getByRole('button', { name: /save tenant/i }));

    await waitFor(() => {
      expect(portalApiClient.updateTenant).toHaveBeenCalledWith(
        'https://api.carwoods.com',
        'mock-token',
        't1',
        expect.objectContaining({
          email: 'alice.updated@example.com',
          first_name: 'Alicia',
          last_name: 'Smith',
          phone: '555-0101',
        })
      );
    });
  });

  it('allows admin to change landlord when editing tenant', async () => {
    mockAuthState.meData = {
      role: 'ADMIN',
      user: { first_name: 'Portal', last_name: 'Admin', role: 'ADMIN', status: 'ACTIVE' },
    };
    portalApiClient.fetchLandlords.mockResolvedValue({
      landlords: [
        makeLandlord({ id: 'l1', first_name: 'Lana', last_name: 'Lord', email: 'lana@example.com' }),
        makeLandlord({ id: 'l2', first_name: 'Milo', last_name: 'Owner', email: 'milo@example.com' }),
      ],
    });
    portalApiClient.fetchLandlordProperties.mockResolvedValue({
      properties: [
        makeProperty({ id: 'prop-1', street: '100 Main St', landlord_user_id: 'l1' }),
        makeProperty({ id: 'prop-2', street: '200 Oak Ave', landlord_user_id: 'l2' }),
      ],
    });
    portalApiClient.fetchTenants.mockResolvedValue({
      tenants: [
        makeTenant({
          landlord_id: 'l1',
          property_id: 'prop-1',
          landlord_email: 'lana@example.com',
        }),
      ],
    });

    render(<WithAppTheme><PortalTenants /></WithAppTheme>);
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /edit tenant/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    const dialog = screen.getByRole('dialog');

    const landlordSelect = within(dialog).getByLabelText(/landlord/i);
    fireEvent.mouseDown(landlordSelect);
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('option', { name: /milo owner/i }));

    const propertySelect = within(dialog).getAllByRole('combobox')[1];
    fireEvent.mouseDown(propertySelect);
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('option', { name: /200 oak ave/i }));

    fireEvent.click(within(dialog).getByRole('button', { name: /save tenant/i }));

    await waitFor(() => {
      expect(portalApiClient.updateTenant).toHaveBeenCalledWith(
        'https://api.carwoods.com',
        'mock-token',
        't1',
        expect.objectContaining({
          property_id: 'prop-2',
        })
      );
    });
  });

  it('shows friendly duplicate email error when editing tenant fails with conflict code', async () => {
    portalApiClient.fetchTenants.mockResolvedValue({ tenants: [makeTenant()] });
    portalApiClient.updateTenant.mockRejectedValue({
      status: 409,
      code: 'email_already_in_use',
      message: 'HTTP 409 (email_already_in_use)',
    });

    render(<WithAppTheme><PortalTenants /></WithAppTheme>);
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /edit tenant/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    const dialog = screen.getByRole('dialog');

    fireEvent.click(within(dialog).getByRole('button', { name: /save tenant/i }));

    await waitFor(() => {
      expect(within(dialog).getByText(/already used by another account/i)).toBeInTheDocument();
    });
  });

  it('shows success message after disabling a tenant', async () => {
    portalApiClient.fetchTenants.mockResolvedValue({ tenants: [makeTenant()] });
    portalApiClient.patchTenantAccess.mockResolvedValue({ tenant: { id: 't1', status: 'DISABLED' } });
    render(<WithAppTheme><PortalTenants /></WithAppTheme>);
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /disable access/i }));

    // Confirm dialog should appear — click the confirm button
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    const dialog = screen.getByRole('dialog');
    const confirmBtn = within(dialog).getByRole('button', { name: /disable access/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText(/tenant access disabled/i)).toBeInTheDocument();
    });
  });

  it('shows API unavailable warning when baseUrl is empty', () => {
    mockAuthState.baseUrl = '';
    render(<WithAppTheme><PortalTenants /></WithAppTheme>);
    expect(screen.getByText(/VITE_API_BASE_URL/i)).toBeInTheDocument();
  });

  it('shows access denied when role is TENANT', async () => {
    mockAuthState.meData = {
      role: 'TENANT',
      user: { first_name: 'Bob', last_name: 'Tenant', role: 'TENANT', status: 'ACTIVE' },
    };
    render(<WithAppTheme><PortalTenants /></WithAppTheme>);
    await waitFor(() => {
      expect(screen.getByText(/only landlord or admin/i)).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Onboard dialog tests
  // ---------------------------------------------------------------------------

  it('opens the onboard tenant dialog when button is clicked', async () => {
    portalApiClient.fetchLandlordProperties.mockResolvedValue({ properties: [makeProperty()] });
    render(<WithAppTheme><PortalTenants /></WithAppTheme>);
    await waitFor(() => expect(portalApiClient.fetchLandlordProperties).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /onboard tenant/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /onboard tenant/i })).toBeInTheDocument();
    });
  });

  it('shows validation errors when submitting empty onboard form', async () => {
    portalApiClient.fetchLandlordProperties.mockResolvedValue({ properties: [makeProperty()] });
    render(<WithAppTheme><PortalTenants /></WithAppTheme>);
    await waitFor(() => expect(portalApiClient.fetchLandlordProperties).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /onboard tenant/i }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Dialogs render into portals; find the form via document instead of container
    const form = document.querySelector('[role="dialog"] form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/enter a valid email/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
  });

  it('shows email validation error for invalid email format', async () => {
    portalApiClient.fetchLandlordProperties.mockResolvedValue({ properties: [makeProperty()] });
    render(<WithAppTheme><PortalTenants /></WithAppTheme>);
    await waitFor(() => expect(portalApiClient.fetchLandlordProperties).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /onboard tenant/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    const dialog = screen.getByRole('dialog');
    const emailInput = within(dialog).getByLabelText(/tenant email/i);
    fireEvent.change(emailInput, { target: { value: 'not-an-email' } });

    const form = document.querySelector('[role="dialog"] form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/enter a valid email/i)).toBeInTheDocument();
    });
  });

  it('calls createTenant with correct payload on valid submit', async () => {
    portalApiClient.fetchLandlordProperties.mockResolvedValue({ properties: [makeProperty()] });
    portalApiClient.createTenant.mockResolvedValue({ tenant: { id: 'new-1' }, lease: { id: 'l1' } });
    render(<WithAppTheme><PortalTenants /></WithAppTheme>);
    await waitFor(() => expect(portalApiClient.fetchLandlordProperties).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /onboard tenant/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    const dialog = screen.getByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText(/tenant email/i), {
      target: { value: 'alice@example.com' },
    });
    fireEvent.change(within(dialog).getByLabelText(/first name/i), {
      target: { value: 'Alice' },
    });
    fireEvent.change(within(dialog).getByLabelText(/last name/i), {
      target: { value: 'Smith' },
    });

    // Select property
    const propertySelect = within(dialog).getByRole('combobox');
    fireEvent.mouseDown(propertySelect);
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('option', { name: /100 main st/i }));

    await waitFor(() => expect(portalApiClient.fetchLandlordLeases).toHaveBeenCalled());
    await waitFor(() => {
      expect(within(dialog).getByLabelText(/lease start date/i)).toBeInTheDocument();
    });

    fireEvent.change(within(dialog).getByLabelText(/lease start date/i), {
      target: { value: '2025-01-01' },
    });
    // Check month-to-month
    fireEvent.click(within(dialog).getByLabelText(/month-to-month/i));

    const saveBtn = within(dialog).getByRole('button', { name: /onboard tenant/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(portalApiClient.createTenant).toHaveBeenCalledWith(
        'https://api.carwoods.com',
        'mock-token',
        expect.objectContaining({
          email: 'alice@example.com',
          first_name: 'Alice',
          last_name: 'Smith',
          property_id: 'prop-1',
        })
      );
    });
  }, 10000);

  it('shows success message after onboarding a tenant', async () => {
    portalApiClient.fetchLandlordProperties.mockResolvedValue({ properties: [makeProperty()] });
    portalApiClient.createTenant.mockResolvedValue({ tenant: { id: 'new-1' }, lease: { id: 'l1' } });
    render(<WithAppTheme><PortalTenants /></WithAppTheme>);
    await waitFor(() => expect(portalApiClient.fetchLandlordProperties).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /onboard tenant/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/tenant email/i), { target: { value: 'alice@example.com' } });
    fireEvent.change(within(dialog).getByLabelText(/first name/i), { target: { value: 'Alice' } });
    fireEvent.change(within(dialog).getByLabelText(/last name/i), { target: { value: 'Smith' } });

    const propertySelect = within(dialog).getByRole('combobox');
    fireEvent.mouseDown(propertySelect);
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('option', { name: /100 main st/i }));

    await waitFor(() => expect(portalApiClient.fetchLandlordLeases).toHaveBeenCalled());
    await waitFor(() => {
      expect(within(dialog).getByLabelText(/lease start date/i)).toBeInTheDocument();
    });

    fireEvent.change(within(dialog).getByLabelText(/lease start date/i), { target: { value: '2025-01-01' } });
    fireEvent.click(within(dialog).getByLabelText(/month-to-month/i));

    const saveBtn = within(dialog).getByRole('button', { name: /onboard tenant/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText(/tenant onboarded successfully/i)).toBeInTheDocument();
    });
  });

  it('shows error alert when createTenant API fails', async () => {
    portalApiClient.fetchLandlordProperties.mockResolvedValue({ properties: [makeProperty()] });
    portalApiClient.createTenant.mockRejectedValue(new Error('server_error'));
    render(<WithAppTheme><PortalTenants /></WithAppTheme>);
    await waitFor(() => expect(portalApiClient.fetchLandlordProperties).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /onboard tenant/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/tenant email/i), { target: { value: 'alice@example.com' } });
    fireEvent.change(within(dialog).getByLabelText(/first name/i), { target: { value: 'Alice' } });
    fireEvent.change(within(dialog).getByLabelText(/last name/i), { target: { value: 'Smith' } });

    const propertySelect = within(dialog).getByRole('combobox');
    fireEvent.mouseDown(propertySelect);
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('option', { name: /100 main st/i }));

    await waitFor(() => expect(portalApiClient.fetchLandlordLeases).toHaveBeenCalled());
    await waitFor(() => {
      expect(within(dialog).getByLabelText(/lease start date/i)).toBeInTheDocument();
    });

    fireEvent.change(within(dialog).getByLabelText(/lease start date/i), { target: { value: '2025-01-01' } });
    fireEvent.click(within(dialog).getByLabelText(/month-to-month/i));

    const saveBtn = within(dialog).getByRole('button', { name: /onboard tenant/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(within(dialog).getByText(/unable to save tenant changes/i)).toBeInTheDocument();
    });
  });

  it('shows error state when fetchTenants fails', async () => {
    portalApiClient.fetchTenants.mockRejectedValue(new Error('network error'));
    render(<WithAppTheme><PortalTenants /></WithAppTheme>);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Admin-specific tests
  // ---------------------------------------------------------------------------

  it('shows landlord filter selector for admin role', async () => {
    mockAuthState.meData = {
      role: 'ADMIN',
      user: { first_name: 'Portal', last_name: 'Admin', role: 'ADMIN', status: 'ACTIVE' },
    };
    portalApiClient.fetchLandlords.mockResolvedValue({
      landlords: [{ id: 'l1', first_name: 'Lana', last_name: 'Lord', email: 'lana@example.com' }],
    });
    render(<WithAppTheme><PortalTenants /></WithAppTheme>);
    await waitFor(() => expect(portalApiClient.fetchLandlords).toHaveBeenCalled());
    expect(screen.getByText(/filter by landlord/i)).toBeInTheDocument();
  });

  it('does not show landlord filter for non-admin role', async () => {
    render(<WithAppTheme><PortalTenants /></WithAppTheme>);
    await waitFor(() => expect(portalApiClient.fetchTenants).toHaveBeenCalled());
    expect(screen.queryByText(/filter by landlord/i)).not.toBeInTheDocument();
  });

  it('passes landlord_id query param when admin filters by landlord', async () => {
    mockAuthState.meData = {
      role: 'ADMIN',
      user: { first_name: 'Portal', last_name: 'Admin', role: 'ADMIN', status: 'ACTIVE' },
    };
    portalApiClient.fetchLandlords.mockResolvedValue({
      landlords: [{ id: 'l1', first_name: 'Lana', last_name: 'Lord', email: 'lana@example.com' }],
    });
    render(<WithAppTheme><PortalTenants /></WithAppTheme>);
    await waitFor(() => expect(portalApiClient.fetchLandlords).toHaveBeenCalled());

    const filterSelect = screen.getAllByRole('combobox')[0];
    fireEvent.mouseDown(filterSelect);
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('option', { name: /lana lord/i }));

    await waitFor(() => {
      expect(portalApiClient.fetchTenants).toHaveBeenCalledWith(
        'https://api.carwoods.com',
        'mock-token',
        expect.objectContaining({ landlordId: 'l1' })
      );
    });
  });

  it('requires landlord selection in admin onboarding and sends landlord_id', async () => {
    mockAuthState.meData = {
      role: 'ADMIN',
      user: { first_name: 'Portal', last_name: 'Admin', role: 'ADMIN', status: 'ACTIVE' },
    };
    portalApiClient.fetchLandlords.mockResolvedValue({ landlords: [makeLandlord()] });
    portalApiClient.fetchLandlordProperties.mockResolvedValue({
      properties: [makeProperty({ landlord_user_id: 'l1' })],
    });
    render(<WithAppTheme><PortalTenants /></WithAppTheme>);
    await waitFor(() => expect(portalApiClient.fetchLandlords).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /onboard tenant/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    const dialog = screen.getByRole('dialog');
    const form = document.querySelector('[role="dialog"] form');
    fireEvent.submit(form);
    await waitFor(() => {
      expect(within(dialog).getByText(/please select a landlord/i)).toBeInTheDocument();
    });

    const landlordSelect = within(dialog).getByLabelText(/landlord/i);
    fireEvent.mouseDown(landlordSelect);
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('option', { name: /lana lord/i }));

    fireEvent.change(within(dialog).getByLabelText(/tenant email/i), {
      target: { value: 'alice@example.com' },
    });
    fireEvent.change(within(dialog).getByLabelText(/first name/i), {
      target: { value: 'Alice' },
    });
    fireEvent.change(within(dialog).getByLabelText(/last name/i), {
      target: { value: 'Smith' },
    });

    const propertySelect = within(dialog).getAllByRole('combobox')[1];
    fireEvent.mouseDown(propertySelect);
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('option', { name: /100 main st/i }));

    await waitFor(() => expect(portalApiClient.fetchLandlordLeases).toHaveBeenCalled());
    await waitFor(() => {
      expect(within(dialog).getByLabelText(/lease start date/i)).toBeInTheDocument();
    });

    fireEvent.change(within(dialog).getByLabelText(/lease start date/i), {
      target: { value: '2025-01-01' },
    });
    fireEvent.click(within(dialog).getByLabelText(/month-to-month/i));
    fireEvent.click(within(dialog).getByRole('button', { name: /onboard tenant/i }));

    await waitFor(() => {
      expect(portalApiClient.createTenant).toHaveBeenCalledWith(
        'https://api.carwoods.com',
        'mock-token',
        expect.objectContaining({
          landlord_id: 'l1',
          property_id: 'prop-1',
        })
      );
    });
  }, 15000);

  // ---------------------------------------------------------------------------
  // Refresh button
  // ---------------------------------------------------------------------------

  it('calls fetchTenants again when refresh button is clicked', async () => {
    render(<WithAppTheme><PortalTenants /></WithAppTheme>);
    await waitFor(() => expect(portalApiClient.fetchTenants).toHaveBeenCalledTimes(1));

    const refreshBtn = screen.getByRole('button', { name: /refresh tenant list/i });
    fireEvent.click(refreshBtn);

    await waitFor(() => expect(portalApiClient.fetchTenants).toHaveBeenCalledTimes(2));
  });

  it('does not render skeleton placeholder rows when refreshing an already loaded list', async () => {
    portalApiClient.fetchTenants
      .mockResolvedValueOnce({ tenants: [makeTenant()] })
      .mockImplementationOnce(() => new Promise(() => {}));

    const { container } = render(<WithAppTheme><PortalTenants /></WithAppTheme>);

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /refresh tenant list/i }));

    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(container.querySelectorAll('.MuiSkeleton-root')).toHaveLength(0);
  });
});
