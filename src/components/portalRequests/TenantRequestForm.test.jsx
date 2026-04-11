import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import { WithAppTheme } from '../../testUtils';
import TenantRequestForm from './TenantRequestForm';

function renderForm(props = {}) {
  const defaultProps = {
    tenantForm: {
      category_code: 'PLUMBING',
      priority_code: 'ROUTINE',
      title: 'Kitchen sink leak',
      description: 'Water is dripping under the sink.',
    },
    tenantDefaults: {
      property_address: '123 Main St',
      lease_end_date: '2026-12-31',
    },
    categoryOptions: [{ code: 'PLUMBING', name: 'Plumbing' }],
    priorityOptions: [{ code: 'ROUTINE', name: 'Routine' }],
    lookupsStatus: 'ok',
    lookupsError: '',
    lookupContact: null,
    onTenantField: () => () => {},
    onCreateRequest: (event) => event.preventDefault(),
    onCancel: vi.fn(),
    tenantCreateStatus: 'idle',
    tenantCreateError: '',
    createAttachmentFiles: [],
    onCreateAttachmentChange: vi.fn(),
    onRemoveCreateAttachment: vi.fn(),
    disabled: false,
    hideHeading: false,
    framed: false,
    ...props,
  };

  return {
    ...render(
      <WithAppTheme>
        <TenantRequestForm {...defaultProps} />
      </WithAppTheme>
    ),
    props: defaultProps,
  };
}

describe('TenantRequestForm', () => {
  it('renders cancel next to submit and calls onCancel', async () => {
    await i18n.changeLanguage('en');
    const onCancel = vi.fn();
    renderForm({ onCancel });

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit request' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
