import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { WithAppTheme } from '../testUtils';
import i18n from '../i18n';
import PortalAdminProperties from './PortalAdminProperties';
import * as propertiesApiClient from '../lib/propertiesApiClient';
import * as portalApiClient from '../lib/portalApiClient';

const mockAuthState = {
  isAuthenticated: true,
  account: { name: 'Test Landlord' },
  meData: {
    role: 'LANDLORD',
    user: { first_name: 'Test', last_name: 'Landlord', role: 'LANDLORD', status: 'ACTIVE' },
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

vi.mock('../lib/propertiesApiClient', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    listPropertiesApi: vi.fn().mockResolvedValue([]),
    createPropertyApi: vi.fn().mockResolvedValue({ id: 'db-test-1' }),
    updatePropertyApi: vi.fn().mockResolvedValue({ id: 'db-test-1' }),
    patchPropertyApi: vi.fn().mockResolvedValue({ id: 'db-test-1' }),
    deletePropertyApi: vi.fn().mockResolvedValue(undefined),
    restorePropertyApi: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../lib/portalApiClient', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchLandlords: vi.fn().mockResolvedValue({ landlords: [] }),
    fetchElsaSettings: vi.fn().mockResolvedValue({ properties: [] }),
  };
});

/** Helper: a minimal API row (PropertyRowFull shape) */
function makeApiRow(overrides = {}) {
  return {
    id: 'db-row-1',
    name: null,
    street: '6314 Bonnie Chase Ln',
    city: 'Katy',
    state: 'TX',
    zip: '77449',
    har_listing_id: '8469293',
    listing_source: 'MANUAL',
    apply_visible: true,
    metadata: {
      apply: {
        addressLine: '6314 Bonnie Chase Ln',
        cityStateZip: 'Katy, TX 77449',
        monthlyRentLabel: '$2,100/mo',
        photoUrl: '',
        harListingUrl: '',
        applyUrl: '',
        detailLines: ['3 Bedroom(s)'],
      },
    },
    har_sync_status: null,
    har_sync_error: null,
    har_last_synced_at: null,
    landlord_name: 'Lana Lord',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    deleted_at: null,
    ...overrides,
  };
}

describe('PortalAdminProperties', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockAuthState.meData = {
      role: 'LANDLORD',
      user: { first_name: 'Test', last_name: 'Landlord', role: 'LANDLORD', status: 'ACTIVE' },
    };
    mockAuthState.getAccessToken = vi.fn().mockResolvedValue('mock-token');
    mockAuthState.handleApiForbidden = vi.fn();
    propertiesApiClient.listPropertiesApi.mockResolvedValue([]);
    propertiesApiClient.createPropertyApi.mockResolvedValue({ id: 'db-test-1' });
    propertiesApiClient.updatePropertyApi.mockResolvedValue({ id: 'db-test-1' });
    propertiesApiClient.patchPropertyApi.mockResolvedValue({ id: 'db-test-1' });
    propertiesApiClient.deletePropertyApi.mockResolvedValue(undefined);
    propertiesApiClient.restorePropertyApi.mockResolvedValue(undefined);
    portalApiClient.fetchLandlords.mockResolvedValue({ landlords: [] });
    portalApiClient.fetchElsaSettings.mockResolvedValue({ properties: [] });
    await i18n.changeLanguage('en');
  });

  it('renders page heading', async () => {
    render(
      <WithAppTheme>
        <PortalAdminProperties />
      </WithAppTheme>
    );
    const headings = screen.getAllByRole('heading', { name: /properties/i });
    expect(headings.length).toBeGreaterThan(0);
    await waitFor(() => expect(propertiesApiClient.listPropertiesApi).toHaveBeenCalled());
  });

  it('shows empty state when no properties', async () => {
    render(
      <WithAppTheme>
        <PortalAdminProperties />
      </WithAppTheme>
    );
    await waitFor(() => {
      expect(screen.getByText(/no properties yet/i)).toBeInTheDocument();
    });
  });

  it('shows validation error when address is missing', async () => {
    render(
      <WithAppTheme>
        <PortalAdminProperties />
      </WithAppTheme>
    );
    await waitFor(() => expect(propertiesApiClient.listPropertiesApi).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /add property/i }));
    await waitFor(() => expect(screen.getByLabelText(/city, state, zip/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/city, state, zip/i), {
      target: { value: 'Houston, TX 77001' },
    });
    const form = document.querySelector('form');
    fireEvent.submit(form);
    await waitFor(() => {
      expect(screen.getByText(/street address is required/i)).toBeInTheDocument();
    });
  });

  it('defaults Visible on Apply page off and disables switch for Free-tier landlord', async () => {
    mockAuthState.meData = {
      role: 'LANDLORD',
      user: {
        first_name: 'Test',
        last_name: 'Landlord',
        role: 'LANDLORD',
        status: 'ACTIVE',
        tier: {
          id: 'tier-free',
          name: 'FREE',
          display_name: 'Free',
          limits: {
            max_properties: 1,
            max_tenants: 5,
            ai_routing_enabled: false,
            csv_export_enabled: false,
            custom_notifications_enabled: false,
            notification_channels: ['in_app'],
            maintenance_request_history_days: 90,
            request_photo_video_attachments_enabled: false,
            property_apply_visibility_editable: false,
            property_elsa_auto_send_editable: false,
          },
        },
      },
    };

    render(<WithAppTheme><PortalAdminProperties /></WithAppTheme>);
    await waitFor(() => expect(propertiesApiClient.listPropertiesApi).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /add property/i }));
    await waitFor(() => expect(screen.getByLabelText(/street address/i)).toBeInTheDocument());

    const applySwitch = screen.getByRole('checkbox', { name: /visible on apply page/i });
    expect(applySwitch).not.toBeChecked();
    expect(applySwitch).toBeDisabled();
  });

  it('defaults Visible on Apply page off for admin when filtered landlord is Free tier', async () => {
    mockAuthState.meData = {
      role: 'ADMIN',
      user: { first_name: 'Portal', last_name: 'Admin', role: 'ADMIN', status: 'ACTIVE' },
    };
    portalApiClient.fetchLandlords.mockResolvedValue({
      landlords: [
        {
          id: 'landlord-free',
          first_name: 'Fran',
          last_name: 'Free',
          email: 'fran@example.com',
          tier_name: 'FREE',
          tier_max_properties: 1,
        },
      ],
    });
    propertiesApiClient.listPropertiesApi.mockResolvedValue([]);

    render(<WithAppTheme><PortalAdminProperties /></WithAppTheme>);
    await waitFor(() => expect(portalApiClient.fetchLandlords).toHaveBeenCalled());

    const landlordFilter = screen.getByLabelText(/filter by landlord/i);
    fireEvent.mouseDown(landlordFilter);
    fireEvent.click(screen.getByRole('option', { name: /fran free/i }));

    fireEvent.click(screen.getByRole('button', { name: /add property/i }));
    await waitFor(() => expect(screen.getByLabelText(/street address/i)).toBeInTheDocument());

    const applySwitch = screen.getByRole('checkbox', { name: /visible on apply page/i });
    expect(applySwitch).not.toBeChecked();
    expect(applySwitch).toBeDisabled();
  });

  it('calls createPropertyApi and resets form on valid submit', async () => {
    render(<WithAppTheme><PortalAdminProperties /></WithAppTheme>);
    await waitFor(() => expect(propertiesApiClient.listPropertiesApi).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /add property/i }));
    await waitFor(() => expect(screen.getByLabelText(/street address/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/street address/i), { target: { value: '123 Main St' } });
    fireEvent.change(screen.getByLabelText(/city, state, zip/i), { target: { value: 'Houston, TX 77001' } });
    fireEvent.click(screen.getByRole('button', { name: /create property/i }));

    await waitFor(() => {
      expect(propertiesApiClient.createPropertyApi).toHaveBeenCalledWith(
        'https://api.carwoods.com',
        'mock-token',
        expect.objectContaining({ addressLine: '123 Main St', cityStateZip: 'Houston, TX 77001' })
      );
    });
  });

  it('shows existing properties in the grid from API', async () => {
    propertiesApiClient.listPropertiesApi.mockResolvedValue([makeApiRow()]);

    render(
      <WithAppTheme>
        <PortalAdminProperties />
      </WithAppTheme>
    );

    await waitFor(() => {
      expect(screen.getByText('6314 Bonnie Chase Ln')).toBeInTheDocument();
    });
    expect(screen.getByText('Katy, TX 77449')).toBeInTheDocument();
    expect(screen.getByText('$2,100/mo')).toBeInTheDocument();
    expect(screen.queryByText(/Landlord:\s+Lana Lord/i)).not.toBeInTheDocument();
  });

  it('lets admin filter the grid by landlord', async () => {
    mockAuthState.meData = {
      role: 'ADMIN',
      user: { first_name: 'Portal', last_name: 'Admin', role: 'ADMIN', status: 'ACTIVE' },
    };
    portalApiClient.fetchLandlords.mockResolvedValue({
      landlords: [
        { id: 'landlord-a', first_name: 'Ann', last_name: 'Admin', email: 'ann@example.com' },
        { id: 'landlord-b', first_name: 'Bob', last_name: 'Boss', email: 'bob@example.com' },
      ],
    });
    propertiesApiClient.listPropertiesApi.mockResolvedValue([
      makeApiRow({
        id: 'p-a',
        landlord_user_id: 'landlord-a',
        landlord_name: 'Ann Admin',
        metadata: {
          apply: {
            addressLine: '111 Alpha St',
            cityStateZip: 'Houston, TX 77001',
            monthlyRentLabel: '',
            photoUrl: '',
            harListingUrl: '',
            applyUrl: '',
            detailLines: [],
          },
        },
      }),
      makeApiRow({
        id: 'p-b',
        landlord_user_id: 'landlord-b',
        landlord_name: 'Bob Boss',
        metadata: {
          apply: {
            addressLine: '222 Beta Rd',
            cityStateZip: 'Houston, TX 77002',
            monthlyRentLabel: '',
            photoUrl: '',
            harListingUrl: '',
            applyUrl: '',
            detailLines: [],
          },
        },
      }),
    ]);

    render(<WithAppTheme><PortalAdminProperties /></WithAppTheme>);
    await waitFor(() => expect(screen.getByText('111 Alpha St')).toBeInTheDocument());
    expect(screen.getByText('222 Beta Rd')).toBeInTheDocument();

    const landlordFilter = screen.getByLabelText(/filter by landlord/i);
    fireEvent.mouseDown(landlordFilter);
    fireEvent.click(screen.getByRole('option', { name: /ann admin/i }));

    await waitFor(() => {
      expect(screen.getByText('111 Alpha St')).toBeInTheDocument();
      expect(screen.queryByText('222 Beta Rd')).not.toBeInTheDocument();
    });
  });

  it('requires landlord selection for admin property create', async () => {
    mockAuthState.meData = {
      role: 'ADMIN',
      user: { first_name: 'Portal', last_name: 'Admin', role: 'ADMIN', status: 'ACTIVE' },
    };
    portalApiClient.fetchLandlords.mockResolvedValue({
      landlords: [{ id: 'landlord-1', first_name: 'Lana', last_name: 'Lord', email: 'lana@example.com' }],
    });

    render(<WithAppTheme><PortalAdminProperties /></WithAppTheme>);
    await waitFor(() => expect(propertiesApiClient.listPropertiesApi).toHaveBeenCalled());
    await waitFor(() => expect(portalApiClient.fetchLandlords).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /add property/i }));
    await waitFor(() => expect(screen.getByLabelText(/street address/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/street address/i), { target: { value: '124 Main St' } });
    fireEvent.change(screen.getByLabelText(/city, state, zip/i), { target: { value: 'Houston, TX 77002' } });
    fireEvent.click(screen.getByRole('button', { name: /create property/i }));
    await waitFor(() => {
      expect(propertiesApiClient.createPropertyApi).not.toHaveBeenCalled();
    });

    const addDialog = await screen.findByRole('dialog');
    fireEvent.mouseDown(within(addDialog).getByLabelText(/landlord/i));
    fireEvent.click(screen.getByRole('option', { name: /lana lord/i }));
    fireEvent.click(screen.getByRole('button', { name: /create property/i }));

    await waitFor(() => {
      expect(propertiesApiClient.createPropertyApi).toHaveBeenCalledWith(
        'https://api.carwoods.com',
        'mock-token',
        expect.objectContaining({
          addressLine: '124 Main St',
          cityStateZip: 'Houston, TX 77002',
          landlordUserId: 'landlord-1',
        })
      );
    });
  });

  it('opens delete confirmation dialog and calls deletePropertyApi on confirm', async () => {
    propertiesApiClient.listPropertiesApi.mockResolvedValue([
      makeApiRow({
        id: 'db-del-1',
        street: '999 Delete Me Dr',
        metadata: {
          apply: {
            addressLine: '999 Delete Me Dr',
            cityStateZip: 'Houston, TX 77001',
            monthlyRentLabel: '',
            photoUrl: '',
            harListingUrl: '',
            applyUrl: '',
            detailLines: [],
          },
        },
        apply_visible: false,
      }),
    ]);

    render(
      <WithAppTheme>
        <PortalAdminProperties />
      </WithAppTheme>
    );

    await waitFor(() => {
      expect(screen.getByText('999 Delete Me Dr')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /delete property\?/i })).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    const confirmBtn = Array.from(dialog.querySelectorAll('button')).find(
      (b) => /^delete$/i.test(b.textContent?.trim())
    );
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(propertiesApiClient.deletePropertyApi).toHaveBeenCalledWith(
        'https://api.carwoods.com',
        'mock-token',
        'db-del-1'
      );
    });
  });

  it('populates form fields for editing when edit button is clicked', async () => {
    propertiesApiClient.listPropertiesApi.mockResolvedValue([
      makeApiRow({
        id: 'db-edit-1',
        street: '42 Edit Ave',
        metadata: {
          apply: {
            addressLine: '42 Edit Ave',
            cityStateZip: 'Houston, TX 77002',
            monthlyRentLabel: '$1,800/mo',
            photoUrl: '',
            harListingUrl: '',
            applyUrl: '',
            detailLines: ['2 Bedroom(s)'],
          },
        },
      }),
    ]);

    render(
      <WithAppTheme>
        <PortalAdminProperties />
      </WithAppTheme>
    );

    await waitFor(() => {
      expect(screen.getByText('42 Edit Ave')).toBeInTheDocument();
    });

    const editBtn = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editBtn);

    await waitFor(() => {
      expect(screen.getByDisplayValue('42 Edit Ave')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Houston, TX 77002')).toBeInTheDocument();
    });
  });

  it('omits landlordUserId from the update payload when a non-admin edits their own property', async () => {
    // Backend rejects PATCH /landlord/properties/:id with `landlord_user_id`
    // in the body for non-admin actors (see updateProperty.ts — throws
    // forbidden when `landlord_user_id_present` and actor is not ADMIN).
    // The portal must therefore strip the field for landlord-self edits.
    propertiesApiClient.listPropertiesApi.mockResolvedValue([
      makeApiRow({
        id: 'db-self-edit-1',
        street: '7 Self Edit Ln',
        landlord_user_id: 'landlord-self',
        landlord_name: 'Test Landlord',
        metadata: {
          apply: {
            addressLine: '7 Self Edit Ln',
            cityStateZip: 'Houston, TX 77004',
            monthlyRentLabel: '$1,500/mo',
            photoUrl: '',
            harListingUrl: '',
            applyUrl: '',
            detailLines: [],
          },
        },
      }),
    ]);

    render(<WithAppTheme><PortalAdminProperties /></WithAppTheme>);
    await waitFor(() => expect(screen.getByText('7 Self Edit Ln')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    await waitFor(() => expect(screen.getByDisplayValue('7 Self Edit Ln')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(propertiesApiClient.updatePropertyApi).toHaveBeenCalledWith(
        'https://api.carwoods.com',
        'mock-token',
        'db-self-edit-1',
        expect.objectContaining({ addressLine: '7 Self Edit Ln', landlordUserId: '' })
      );
    });
  });

  it('allows admin to change landlord on edit', async () => {
    mockAuthState.meData = {
      role: 'ADMIN',
      user: { first_name: 'Portal', last_name: 'Admin', role: 'ADMIN', status: 'ACTIVE' },
    };
    portalApiClient.fetchLandlords.mockResolvedValue({
      landlords: [
        { id: 'landlord-1', first_name: 'Lana', last_name: 'Lord', email: 'lana@example.com' },
        { id: 'landlord-2', first_name: 'Ravi', last_name: 'Ray', email: 'ravi@example.com' },
      ],
    });
    propertiesApiClient.listPropertiesApi.mockResolvedValue([
      makeApiRow({
        id: 'db-edit-landlord-1',
        street: '14 Reassign St',
        landlord_user_id: 'landlord-1',
        landlord_name: 'Lana Lord',
        metadata: {
          apply: {
            addressLine: '14 Reassign St',
            cityStateZip: 'Houston, TX 77003',
            monthlyRentLabel: '$1,900/mo',
            photoUrl: '',
            harListingUrl: '',
            applyUrl: '',
            detailLines: [],
          },
        },
      }),
    ]);

    render(<WithAppTheme><PortalAdminProperties /></WithAppTheme>);
    await waitFor(() => expect(portalApiClient.fetchLandlords).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('14 Reassign St')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const editDialog = await screen.findByRole('dialog');
    fireEvent.mouseDown(within(editDialog).getByLabelText(/landlord/i));
    fireEvent.click(screen.getByRole('option', { name: /ravi ray/i }));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    // Admin landlord reassignment now requires an explicit confirmation.
    const reassignDialog = await screen.findByRole('dialog', { name: /reassign this property/i });
    expect(within(reassignDialog).getByText(/lana lord/i)).toBeInTheDocument();
    expect(within(reassignDialog).getByText(/ravi ray/i)).toBeInTheDocument();
    fireEvent.click(within(reassignDialog).getByRole('button', { name: /reassign property/i }));

    await waitFor(() => {
      expect(propertiesApiClient.updatePropertyApi).toHaveBeenCalledWith(
        'https://api.carwoods.com',
        'mock-token',
        'db-edit-landlord-1',
        expect.objectContaining({
          addressLine: '14 Reassign St',
          cityStateZip: 'Houston, TX 77003',
          landlordUserId: 'landlord-2',
        })
      );
    });
  });

  it('admin can cancel the reassign confirmation and keep the original landlord', async () => {
    mockAuthState.meData = {
      role: 'ADMIN',
      user: { first_name: 'Portal', last_name: 'Admin', role: 'ADMIN', status: 'ACTIVE' },
    };
    portalApiClient.fetchLandlords.mockResolvedValue({
      landlords: [
        { id: 'landlord-1', first_name: 'Lana', last_name: 'Lord', email: 'lana@example.com' },
        { id: 'landlord-2', first_name: 'Ravi', last_name: 'Ray', email: 'ravi@example.com' },
      ],
    });
    propertiesApiClient.listPropertiesApi.mockResolvedValue([
      makeApiRow({
        id: 'db-reassign-cancel-1',
        street: '15 Cancel Ln',
        landlord_user_id: 'landlord-1',
        landlord_name: 'Lana Lord',
        metadata: {
          apply: {
            addressLine: '15 Cancel Ln',
            cityStateZip: 'Houston, TX 77004',
            monthlyRentLabel: '',
            photoUrl: '',
            harListingUrl: '',
            applyUrl: '',
            detailLines: [],
          },
        },
      }),
    ]);

    render(<WithAppTheme><PortalAdminProperties /></WithAppTheme>);
    await waitFor(() => expect(portalApiClient.fetchLandlords).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('15 Cancel Ln')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const editDialog = await screen.findByRole('dialog');
    fireEvent.mouseDown(within(editDialog).getByLabelText(/landlord/i));
    fireEvent.click(screen.getByRole('option', { name: /ravi ray/i }));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    const reassignDialog = await screen.findByRole('dialog', { name: /reassign this property/i });
    fireEvent.click(within(reassignDialog).getByRole('button', { name: /keep current landlord/i }));

    // The reassign should NOT have gone through.
    expect(propertiesApiClient.updatePropertyApi).not.toHaveBeenCalled();
    // Dialog dismissed; edit form still open.
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /reassign this property/i })).not.toBeInTheDocument();
    });
  });

  it('shows the apply-visibility locked hint and blocks the card toggle for Free tier', async () => {
    mockAuthState.meData = {
      role: 'LANDLORD',
      user: {
        first_name: 'Test',
        last_name: 'Landlord',
        role: 'LANDLORD',
        status: 'ACTIVE',
        tier: {
          id: 'tier-free',
          name: 'FREE',
          display_name: 'Free',
          limits: {
            max_properties: 5,
            max_tenants: 5,
            ai_routing_enabled: false,
            csv_export_enabled: false,
            custom_notifications_enabled: false,
            notification_channels: ['in_app'],
            maintenance_request_history_days: 90,
            request_photo_video_attachments_enabled: false,
            property_apply_visibility_editable: false,
            property_elsa_auto_send_editable: false,
          },
        },
      },
    };
    propertiesApiClient.listPropertiesApi.mockResolvedValue([
      makeApiRow({
        id: 'db-locked-1',
        street: '22 Locked Ct',
        apply_visible: true,
        metadata: {
          apply: {
            addressLine: '22 Locked Ct',
            cityStateZip: 'Houston, TX 77005',
            monthlyRentLabel: '',
            photoUrl: '',
            harListingUrl: '',
            applyUrl: '',
            detailLines: [],
          },
        },
      }),
    ]);

    render(<WithAppTheme><PortalAdminProperties /></WithAppTheme>);
    await waitFor(() => expect(screen.getByText('22 Locked Ct')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    await waitFor(() => expect(screen.getByDisplayValue('22 Locked Ct')).toBeInTheDocument());
    expect(
      screen.getByText(/apply-page visibility is not available on this landlord's current plan/i)
    ).toBeInTheDocument();
  });

  it('submit button is enabled for LANDLORD role', async () => {
    render(
      <WithAppTheme>
        <PortalAdminProperties />
      </WithAppTheme>
    );
    await waitFor(() => expect(propertiesApiClient.listPropertiesApi).toHaveBeenCalled());
    const submitBtn = screen.getByRole('button', { name: /add property/i });
    expect(submitBtn).not.toBeDisabled();
  });

  it('shows an error alert when listPropertiesApi fails', async () => {
    propertiesApiClient.listPropertiesApi.mockRejectedValue({ status: 401, code: 'unauthorized', message: 'HTTP 401 (unauthorized)' });

    render(
      <WithAppTheme>
        <PortalAdminProperties />
      </WithAppTheme>
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText(/could not load properties/i)).toBeInTheDocument();
  });

  it('accepts a full HAR URL and calls the API proxy', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        listing: {
          id: 'har-8469293',
          addressLine: '6314 Bonnie Chase Ln',
          cityStateZip: 'Katy, TX 77449',
          monthlyRentLabel: '$2,100/mo',
          photoUrl: '',
          harListingUrl: 'https://www.har.com/homedetail/6314-bonnie-chase-ln-katy-tx-77449/8469293',
          applyUrl: 'https://apply.link/abc123',
          detailLines: ['3 Bedroom(s)'],
        },
      }),
    });

    render(
      <WithAppTheme>
        <PortalAdminProperties />
      </WithAppTheme>
    );

    await waitFor(() => expect(propertiesApiClient.listPropertiesApi).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /add property/i }));
    await waitFor(() => expect(screen.getByLabelText(/har listing id or url/i)).toBeInTheDocument());

    const input = screen.getByLabelText(/har listing id or url/i);
    fireEvent.change(input, {
      target: { value: 'https://www.har.com/homedetail/6314-bonnie-chase-ln-katy-tx-77449/8469293' },
    });

    fireEvent.click(screen.getByRole('button', { name: /search har/i }));

    await waitFor(() => {
      expect(screen.getByText(/listing found/i)).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('har-preview?id=8469293'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer mock-token' }) })
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('6314 Bonnie Chase Ln')).toBeInTheDocument();
    });

    delete global.fetch;
  });

  it('accepts wrapped HAR preview JSON (body.listing)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        body: {
          listing: {
            id: 'har-8469293',
            addressLine: 'Wrapped St',
            cityStateZip: 'Katy, TX',
            monthlyRentLabel: '$1/mo',
            photoUrl: '',
            harListingUrl: 'https://www.har.com/homedetail/x/8469293',
            applyUrl: 'https://apply.link/x',
            detailLines: [],
          },
        },
      }),
    });

    render(
      <WithAppTheme>
        <PortalAdminProperties />
      </WithAppTheme>
    );

    await waitFor(() => expect(propertiesApiClient.listPropertiesApi).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /add property/i }));
    await waitFor(() => expect(screen.getByLabelText(/har listing id or url/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/har listing id or url/i), {
      target: { value: '8469293' },
    });
    fireEvent.click(screen.getByRole('button', { name: /search har/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Wrapped St')).toBeInTheDocument();
    });

    delete global.fetch;
  });

  it('shows invalid-input error when a non-HAR URL is entered', async () => {
    render(
      <WithAppTheme>
        <PortalAdminProperties />
      </WithAppTheme>
    );
    await waitFor(() => expect(propertiesApiClient.listPropertiesApi).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /add property/i }));
    await waitFor(() => expect(screen.getByLabelText(/har listing id or url/i)).toBeInTheDocument());

    const input = screen.getByLabelText(/har listing id or url/i);
    fireEvent.change(input, { target: { value: 'https://example.com/not-a-har-url' } });
    fireEvent.click(screen.getByRole('button', { name: /search har/i }));

    await waitFor(() => {
      expect(screen.getByText(/could not find a numeric listing id/i)).toBeInTheDocument();
    });
  });

  it('shows access-denied message when HAR returns 403', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'har_access_denied', message: 'HAR 8469293: HTTP 403 Forbidden' }),
    });

    render(
      <WithAppTheme>
        <PortalAdminProperties />
      </WithAppTheme>
    );

    await waitFor(() => expect(propertiesApiClient.listPropertiesApi).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /add property/i }));
    await waitFor(() => expect(screen.getByLabelText(/har listing id or url/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/har listing id or url/i), {
      target: { value: '8469293' },
    });
    fireEvent.click(screen.getByRole('button', { name: /search har/i }));

    await waitFor(() => {
      expect(screen.getByText(/har\.com blocked the request/i)).toBeInTheDocument();
    });

    delete global.fetch;
  });

  it('confirms and updates visible toggle from the grid', async () => {
    propertiesApiClient.listPropertiesApi.mockResolvedValue([
      makeApiRow({ id: 'db-vis-1', apply_visible: true }),
    ]);

    render(<WithAppTheme><PortalAdminProperties /></WithAppTheme>);
    await waitFor(() => expect(screen.getByText('6314 Bonnie Chase Ln')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('checkbox', { name: /visible/i }));
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /change visible status\?/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(propertiesApiClient.patchPropertyApi).toHaveBeenCalledWith(
        'https://api.carwoods.com',
        'mock-token',
        'db-vis-1',
        { apply_visible: false }
      );
    });
  });

  it('restores a deleted property from the grid', async () => {
    propertiesApiClient.listPropertiesApi.mockResolvedValue([
      makeApiRow({ id: 'db-restore-1', deleted_at: '2026-04-01T00:00:00Z' }),
    ]);

    render(<WithAppTheme><PortalAdminProperties /></WithAppTheme>);
    await waitFor(() => expect(screen.getByText('6314 Bonnie Chase Ln')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText(/show deleted/i));
    await waitFor(() => expect(propertiesApiClient.listPropertiesApi).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: /restore/i }));
    fireEvent.click(screen.getByRole('button', { name: /^restore$/i }));

    await waitFor(() => {
      expect(propertiesApiClient.restorePropertyApi).toHaveBeenCalledWith(
        'https://api.carwoods.com',
        'mock-token',
        'db-restore-1'
      );
    });
  });

  it('disables restore when at active property cap (Free tier)', async () => {
    mockAuthState.meData = {
      role: 'LANDLORD',
      user: {
        id: 'u-free-cap',
        first_name: 'Test',
        last_name: 'Landlord',
        role: 'LANDLORD',
        status: 'ACTIVE',
        tier: {
          id: 'tier-free',
          name: 'FREE',
          display_name: 'Free',
          limits: {
            max_properties: 1,
            max_tenants: 5,
            ai_routing_enabled: false,
            csv_export_enabled: false,
            custom_notifications_enabled: false,
            notification_channels: ['in_app'],
            maintenance_request_history_days: 90,
            request_photo_video_attachments_enabled: false,
            property_apply_visibility_editable: false,
            property_elsa_auto_send_editable: false,
          },
        },
      },
    };

    propertiesApiClient.listPropertiesApi.mockResolvedValue([
      makeApiRow({
        id: 'db-active-cap',
        landlord_user_id: 'u-free-cap',
        deleted_at: null,
        metadata: {
          apply: {
            addressLine: '100 Active St',
            cityStateZip: 'Houston, TX 77001',
            monthlyRentLabel: '',
            photoUrl: '',
            harListingUrl: '',
            applyUrl: '',
            detailLines: [],
          },
        },
      }),
      makeApiRow({
        id: 'db-deleted-cap',
        landlord_user_id: 'u-free-cap',
        deleted_at: '2026-04-01T00:00:00Z',
        metadata: {
          apply: {
            addressLine: '200 Deleted Ave',
            cityStateZip: 'Houston, TX 77002',
            monthlyRentLabel: '',
            photoUrl: '',
            harListingUrl: '',
            applyUrl: '',
            detailLines: [],
          },
        },
      }),
    ]);

    render(<WithAppTheme><PortalAdminProperties /></WithAppTheme>);
    await waitFor(() => expect(screen.getByText('100 Active St')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(/show deleted/i));
    await waitFor(() => expect(screen.getByText('200 Deleted Ave')).toBeInTheDocument());

    const deletedCard = screen.getByText('200 Deleted Ave').closest('.MuiCard-root');
    expect(deletedCard).toBeTruthy();
    const restoreInCard = within(deletedCard).getByRole('button', { name: /restore/i });
    expect(restoreInCard).toBeDisabled();
  });

  it('syncs property with HAR from card action', async () => {
    propertiesApiClient.listPropertiesApi.mockResolvedValue([
      makeApiRow({ id: 'db-sync-1', har_listing_id: '8469293' }),
    ]);

    render(<WithAppTheme><PortalAdminProperties /></WithAppTheme>);
    await waitFor(() => expect(screen.getByText('6314 Bonnie Chase Ln')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /sync with har/i }));

    await waitFor(() => {
      expect(propertiesApiClient.patchPropertyApi).toHaveBeenCalledWith(
        'https://api.carwoods.com',
        'mock-token',
        'db-sync-1',
        { refresh_har: true }
      );
    });
  });

  it('switches to deleted filter when show deleted is enabled', async () => {
    propertiesApiClient.listPropertiesApi.mockImplementation(async (_baseUrl, _token, opts) => {
      if (opts?.includeDeleted) {
        return [
          makeApiRow({
            id: 'db-active-1',
            deleted_at: null,
            metadata: {
              apply: {
                addressLine: '111 Active St',
                cityStateZip: 'Houston, TX 77001',
                monthlyRentLabel: '',
                photoUrl: '',
                harListingUrl: '',
                applyUrl: '',
                detailLines: [],
              },
            },
          }),
          makeApiRow({
            id: 'db-deleted-1',
            deleted_at: '2026-04-01T00:00:00Z',
            metadata: {
              apply: {
                addressLine: '222 Deleted St',
                cityStateZip: 'Houston, TX 77002',
                monthlyRentLabel: '',
                photoUrl: '',
                harListingUrl: '',
                applyUrl: '',
                detailLines: [],
              },
            },
          }),
        ];
      }
      return [
        makeApiRow({
          id: 'db-active-1',
          deleted_at: null,
          metadata: {
            apply: {
              addressLine: '111 Active St',
              cityStateZip: 'Houston, TX 77001',
              monthlyRentLabel: '',
              photoUrl: '',
              harListingUrl: '',
              applyUrl: '',
              detailLines: [],
            },
          },
        }),
      ];
    });

    render(<WithAppTheme><PortalAdminProperties /></WithAppTheme>);
    await waitFor(() => expect(screen.getByText('111 Active St')).toBeInTheDocument());
    expect(screen.queryByText('222 Deleted St')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/show deleted/i));

    await waitFor(() => {
      expect(screen.getByText('222 Deleted St')).toBeInTheDocument();
    });
    expect(screen.queryByText('111 Active St')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /visibility filter/i })).toHaveTextContent(/deleted only/i);
  });
});
