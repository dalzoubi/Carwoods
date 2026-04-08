import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import i18n from '../i18n';
import { WithAppTheme } from '../testUtils';
import PortalAdminAiSettings from './PortalAdminAiSettings';

vi.mock('./PortalAdminAiConfig', () => ({
  default: () => <div data-testid="ai-policies-panel">Policies Panel</div>,
}));

vi.mock('./PortalAdminAiAgents', () => ({
  default: () => <div data-testid="ai-agents-panel">Agents Panel</div>,
}));

describe('PortalAdminAiSettings', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('renders policies tab by default and switches to agents tab', async () => {
    render(
      <WithAppTheme>
        <PortalAdminAiSettings />
      </WithAppTheme>
    );

    expect(screen.getByTestId('ai-policies-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('ai-agents-panel')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /agents/i }));
    expect(screen.getByTestId('ai-agents-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('ai-policies-panel')).not.toBeInTheDocument();
  });
});
