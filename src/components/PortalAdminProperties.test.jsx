import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    deletePropertyApi: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../lib/portalApiClient', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchLandlords: vi.fn().mockResolvedValue({ landlords: [] }),
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
    propertiesApiClient.deletePropertyApi.mockResolvedValue(undefined);
    portalApiClient.fetchLandlords.mockResolvedValue({ landlords: [] });
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
    const { container } = render(
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
    const form = container.querySelector('form');
    fireEvent.submit(form);
    await waitFor(() => {
      expect(screen.getByText(/street address is required/i)).toBeInTheDocument();
    });
  });

  it('calls createPropertyApi and resets form on valid submit', async () => {
    render(<WithAppTheme><PortalAdminProperties /></WithAppTheme>);
    await waitFor(() => expect(propertiesApiClient.listPropertiesApi).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /add property/i }));
    await waitFor(() => expect(screen.getByLabelText(/street address/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/street address/i), { target: { value: '123 Main St' } });
    fireEvent.change(screen.getByLabelText(/city, state, zip/i), { target: { value: 'Houston, TX 77001' } });
    fireEvent.click(screen.getByRole('button', { name: /add property/i }));

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
    expect(screen.getByText(/Landlord:\s+Lana Lord/i)).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: /add property/i }));
    await waitFor(() => {
      expect(propertiesApiClient.createPropertyApi).not.toHaveBeenCalled();
    });

    fireEvent.mouseDown(screen.getByLabelText(/landlord/i));
    fireEvent.click(screen.getByRole('option', { name: /lana lord/i }));
    fireEvent.click(screen.getByRole('button', { name: /add property/i }));

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
    fireEvent.mouseDown(screen.getByLabelText(/landlord/i));
    fireEvent.click(screen.getByRole('option', { name: /ravi ray/i }));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

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
});
