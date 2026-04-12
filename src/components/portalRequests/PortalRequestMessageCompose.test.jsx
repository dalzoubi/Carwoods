import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from '../../i18n';
import { WithAppTheme } from '../../testUtils';
import PortalRequestMessageCompose from './PortalRequestMessageCompose';

describe('PortalRequestMessageCompose', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('shows formatting toolbar when the editor is focused', async () => {
    render(
      <WithAppTheme>
        <PortalRequestMessageCompose value="" onChange={() => {}} label="Message" />
      </WithAppTheme>
    );

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Message' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Bold' })).not.toBeInTheDocument();

    fireEvent.focus(screen.getByRole('textbox', { name: 'Message' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Bold' })).toBeVisible();
    });
  });

  it('does not show toolbar when disabled', async () => {
    render(
      <WithAppTheme>
        <PortalRequestMessageCompose value="" onChange={() => {}} label="Message" disabled />
      </WithAppTheme>
    );

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Message' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Bold' })).not.toBeInTheDocument();
  });
});
