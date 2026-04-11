import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import i18n from '../i18n';
import { WithAppTheme } from '../testUtils';
import PortalAdminAiSettings from './PortalAdminAiSettings';

vi.mock('./PortalAdminAiConfig', () => ({
  default: () => <div data-testid="ai-policies-panel">Policies Panel</div>,
}));

vi.mock('./PortalAdminAiAgents', () => ({
  default: () => <div data-testid="ai-agents-panel">Agents Panel</div>,
}));

vi.mock('./PortalAdminAttachmentConfig', () => ({
  default: () => <div data-testid="attachments-panel">Attachments Panel</div>,
}));

function renderSettings(initialPath = '/portal/admin/config') {
  window.history.pushState({}, 'Test page', initialPath);
  return render(
    <WithAppTheme>
      <PortalAdminAiSettings />
    </WithAppTheme>
  );
}

describe('PortalAdminAiSettings', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('renders policies tab by default and switches to agents tab', async () => {
    renderSettings();

    expect(screen.getByTestId('ai-policies-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('ai-agents-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('attachments-panel')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /agents/i }));
    expect(screen.getByTestId('ai-agents-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('ai-policies-panel')).not.toBeInTheDocument();
  });

  it('restores the selected tab from URL query on refresh', async () => {
    renderSettings('/portal/admin/config?tab=attachments');

    expect(screen.getByTestId('attachments-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('ai-policies-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ai-agents-panel')).not.toBeInTheDocument();
  });
});
