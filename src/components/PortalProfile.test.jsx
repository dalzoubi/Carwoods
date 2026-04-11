import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WithAppTheme } from '../testUtils';
import i18n from '../i18n';
import PortalProfile from './PortalProfile';
import * as portalApiClient from '../lib/portalApiClient';

const mockAuthState = {
  baseUrl: 'https://api.carwoods.com',
  isAuthenticated: true,
  account: { name: 'Agent User', username: 'agent@carwoods.com' },
  meData: {
    role: 'AI_AGENT',
    user: {
      email: 'agent@carwoods.com',
      first_name: 'Agent',
      last_name: 'Smith',
      phone: '7135551111',
      role: 'AI_AGENT',
      status: 'ACTIVE',
    },
  },
  meStatus: 'ok',
  getAccessToken: vi.fn().mockResolvedValue('mock-token'),
  handleApiForbidden: vi.fn(),
  refreshMe: vi.fn(),
};

vi.mock('../PortalAuthContext', () => ({
  usePortalAuth: () => mockAuthState,
  PortalAuthProvider: ({ children }) => children,
}));

vi.mock('../lib/portalApiClient', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    patchProfile: vi.fn().mockResolvedValue({
      user: { id: 'u1' },
    }),
  };
});

describe('PortalProfile', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockAuthState.baseUrl = 'https://api.carwoods.com';
    mockAuthState.isAuthenticated = true;
    mockAuthState.account = { name: 'Agent User', username: 'agent@carwoods.com' };
    mockAuthState.meData = {
      role: 'AI_AGENT',
      user: {
        email: 'agent@carwoods.com',
        first_name: 'Agent',
        last_name: 'Smith',
        phone: '7135551111',
        role: 'AI_AGENT',
        status: 'ACTIVE',
      },
    };
    mockAuthState.meStatus = 'ok';
    mockAuthState.getAccessToken = vi.fn().mockResolvedValue('mock-token');
    mockAuthState.handleApiForbidden = vi.fn();
    mockAuthState.refreshMe = vi.fn();
    portalApiClient.patchProfile.mockResolvedValue({ user: { id: 'u1' } });
    await i18n.changeLanguage('en');
  });

  it('allows AI_AGENT to edit and save profile changes', async () => {
    render(<WithAppTheme><PortalProfile /></WithAppTheme>);

    const firstNameInput = screen.getByLabelText(/first name/i);
    const saveButton = screen.getByRole('button', { name: /save profile/i });

    expect(firstNameInput).not.toBeDisabled();
    expect(saveButton).toBeDisabled();

    fireEvent.change(firstNameInput, { target: { value: 'Updated' } });
    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(portalApiClient.patchProfile).toHaveBeenCalledWith(
        'https://api.carwoods.com',
        'mock-token',
        expect.objectContaining({
          emailHint: 'agent@carwoods.com',
          email: 'agent@carwoods.com',
          first_name: 'Updated',
          last_name: 'Smith',
          phone: '7135551111',
        })
      );
    });
    expect(await screen.findByText(/profile updated successfully/i)).toBeInTheDocument();
  });

  it('keeps form visible while profile refresh is loading with cached data', () => {
    mockAuthState.meStatus = 'loading';
    render(<WithAppTheme><PortalProfile /></WithAppTheme>);

    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('sends lowercase email when saving profile', async () => {
    render(<WithAppTheme><PortalProfile /></WithAppTheme>);

    const emailInput = screen.getByLabelText(/email/i);
    const saveButton = screen.getByRole('button', { name: /save profile/i });

    fireEvent.change(emailInput, { target: { value: 'AGENT+UPPER@CARWOODS.COM' } });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(portalApiClient.patchProfile).toHaveBeenCalledWith(
        'https://api.carwoods.com',
        'mock-token',
        expect.objectContaining({
          email: 'agent+upper@carwoods.com',
        })
      );
    });
  });

  it('shows friendly duplicate-email message and keeps typed email', async () => {
    portalApiClient.patchProfile.mockRejectedValue({
      status: 409,
      code: 'email_already_in_use',
      message: 'HTTP 409 (email_already_in_use)',
    });

    render(<WithAppTheme><PortalProfile /></WithAppTheme>);

    const firstNameInput = screen.getByLabelText(/first name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const saveButton = screen.getByRole('button', { name: /save profile/i });

    fireEvent.change(firstNameInput, { target: { value: 'Updated' } });
    fireEvent.change(emailInput, { target: { value: 'taken@carwoods.com' } });
    fireEvent.click(saveButton);

    expect(
      await screen.findByText(
        /that email is already in use by another user\./i
      )
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(firstNameInput).toHaveValue('Updated');
      expect(emailInput).toHaveValue('taken@carwoods.com');
      expect(screen.queryByText(/HTTP 409 \(email_already_in_use\)/i)).not.toBeInTheDocument();
    });
  });
});
