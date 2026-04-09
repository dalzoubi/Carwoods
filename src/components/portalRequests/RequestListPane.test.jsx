import React from 'react';
import { render, screen } from '@testing-library/react';
import i18n from '../../i18n';
import { WithAppTheme } from '../../testUtils';
import RequestListPane from './RequestListPane';

function makeRequest(id, title, statusCode = 'OPEN', extra = {}) {
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
      makeRequest('r1', 'Kitchen leak', 'OPEN', { landlord_user_id: 'l1' }),
      makeRequest('r2', 'AC issue', 'IN_PROGRESS', { landlord_user_id: 'l2' }),
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
});

