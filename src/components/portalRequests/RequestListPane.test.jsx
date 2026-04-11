import React from 'react';
import { render, screen } from '@testing-library/react';
import i18n from '../../i18n';
import { WithAppTheme } from '../../testUtils';
import RequestListPane from './RequestListPane';

function makeRequest(id, title, statusCode = 'NOT_STARTED', extra = {}) {
  return {
    id,
    title,
    status_code: statusCode,
    status_name: statusCode,
    ...extra,
  };
}

function renderPane(props = {}) {
  const defaultProps = {
    requests: [
      makeRequest('r1', 'Kitchen leak', 'NOT_STARTED', { landlord_user_id: 'l1' }),
      makeRequest('r2', 'AC issue', 'WAITING_ON_VENDOR', { landlord_user_id: 'l2' }),
    ],
    requestsStatus: 'ok',
    requestsError: '',
    selectedRequestId: '',
    onSelectRequest: () => {},
    onReload: () => {},
    reloadDisabled: false,
    ...props,
  };
  return render(
    <WithAppTheme>
      <RequestListPane {...defaultProps} />
    </WithAppTheme>
  );
}

describe('RequestListPane', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('shows landlord filter for admin users', () => {
    renderPane({
      isAdmin: true,
      landlords: [{ id: 'l1', first_name: 'Lana', last_name: 'Lord', email: 'lana@example.com' }],
      landlordsStatus: 'ok',
      selectedLandlordId: '',
      onSelectLandlord: () => {},
    });

    expect(screen.getByText('Filter by landlord')).toBeInTheDocument();
    expect(screen.getByText('All landlords')).toBeInTheDocument();
  });

  it('filters requests by selected landlord for admins', () => {
    renderPane({
      isAdmin: true,
      landlords: [
        { id: 'l1', first_name: 'Lana', last_name: 'Lord', email: 'lana@example.com' },
        { id: 'l2', first_name: 'Leo', last_name: 'Land', email: 'leo@example.com' },
      ],
      landlordsStatus: 'ok',
      selectedLandlordId: 'l1',
      onSelectLandlord: () => {},
    });

    expect(screen.getByText('Kitchen leak')).toBeInTheDocument();
    expect(screen.queryByText('AC issue')).not.toBeInTheDocument();
  });

  it('shows requester role and priority details for management users', () => {
    renderPane({
      isManagement: true,
      requests: [
        makeRequest('r1', 'Kitchen leak', 'NOT_STARTED', {
          priority_name: 'Emergency',
          submitted_by_display_name: 'Jane Tenant',
          submitted_by_role: 'TENANT',
        }),
      ],
    });

    expect(screen.getByText('Emergency')).toBeInTheDocument();
    expect(screen.getByText('Reported by: Jane Tenant')).toBeInTheDocument();
    expect(screen.getByText('Tenant')).toBeInTheDocument();
    expect(screen.getByText(/Updated:/)).toBeInTheDocument();
  });

  it('orders requests by updated date descending', () => {
    renderPane({
      requests: [
        makeRequest('r1', 'Older ticket', 'NOT_STARTED', {
          updated_at: '2026-04-10T10:00:00Z',
        }),
        makeRequest('r2', 'Newer ticket', 'NOT_STARTED', {
          updated_at: '2026-04-10T12:00:00Z',
        }),
      ],
    });

    const newer = screen.getByRole('button', { name: /Newer ticket/i });
    const older = screen.getByRole('button', { name: /Older ticket/i });
    expect(newer.compareDocumentPosition(older) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('does not show empty state pill when there are no requests', () => {
    renderPane({
      requests: [],
      requestsStatus: 'ok',
    });

    expect(screen.queryByText('No requests found for this account.')).not.toBeInTheDocument();
  });

  it('applies grouped status filter from dashboard query param', () => {
    renderPane({
      initialStatusFilter: 'resolved',
      requests: [
        makeRequest('r1', 'Completed request', 'COMPLETE'),
        makeRequest('r2', 'Cancelled request', 'CANCELLED'),
        makeRequest('r3', 'Open request', 'NOT_STARTED'),
      ],
    });

    expect(screen.getByText('Completed request')).toBeInTheDocument();
    expect(screen.getByText('Cancelled request')).toBeInTheDocument();
    expect(screen.queryByText('Open request')).not.toBeInTheDocument();
  });
});

