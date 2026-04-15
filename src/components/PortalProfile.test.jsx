import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    deleteProfilePhoto: vi.fn().mockResolvedValue({}),
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
    portalApiClient.deleteProfilePhoto.mockResolvedValue({});
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

    const emailInput = screen.getByRole('textbox', { name: /email/i });
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
    const emailInput = screen.getByRole('textbox', { name: /email/i });
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

  it('asks for SMS opt-in confirmation before enabling SMS notifications', async () => {
    render(<WithAppTheme><PortalProfile /></WithAppTheme>);

    const smsSwitch = screen.getByRole('checkbox', { name: /sms notifications/i });
    expect(smsSwitch).not.toBeChecked();

    fireEvent.click(smsSwitch);

    expect(
      await screen.findByText(/confirm sms notification opt-in/i)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /yes, i opt in/i }));

    expect(smsSwitch).toBeChecked();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() => {
      expect(portalApiClient.patchProfile).toHaveBeenCalledWith(
        'https://api.carwoods.com',
        'mock-token',
        expect.objectContaining({
          notification_preferences: expect.objectContaining({
            sms_enabled: true,
            sms_opt_in: true,
          }),
        })
      );
    });
  });

  it('asks for confirmation before removing profile photo', async () => {
    mockAuthState.meData = {
      role: 'AI_AGENT',
      user: {
        ...mockAuthState.meData.user,
        profile_photo_url: 'https://example.com/photo.jpg',
      },
    };

    render(<WithAppTheme><PortalProfile /></WithAppTheme>);

    fireEvent.click(screen.getByRole('button', { name: /remove photo/i }));

    const dialog = await screen.findByRole('dialog', { name: /remove profile photo\?/i });
    expect(within(dialog).getByText(/your profile picture will be removed/i)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: /^remove$/i }));

    await waitFor(() => {
      expect(portalApiClient.deleteProfilePhoto).toHaveBeenCalledWith(
        'https://api.carwoods.com',
        'mock-token',
        expect.objectContaining({ emailHint: 'agent@carwoods.com' })
      );
    });
    expect(await screen.findByText(/profile photo removed/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('closes remove photo dialog without deleting when cancelled', async () => {
    mockAuthState.meData = {
      role: 'AI_AGENT',
      user: {
        ...mockAuthState.meData.user,
        profile_photo_url: 'https://example.com/photo.jpg',
      },
    };

    render(<WithAppTheme><PortalProfile /></WithAppTheme>);

    fireEvent.click(screen.getByRole('button', { name: /remove photo/i }));

    const dialog = await screen.findByRole('dialog', { name: /remove profile photo\?/i });
    fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(portalApiClient.deleteProfilePhoto).not.toHaveBeenCalled();
  });

  it('sends SMS disabled when tier disallows SMS even if legacy DB prefs had SMS on', async () => {
    mockAuthState.meData = {
      role: 'TENANT',
      user: {
        email: 'tenant@carwoods.com',
        first_name: 'Terry',
        last_name: 'Tenant',
        phone: '7135552222',
        role: 'TENANT',
        status: 'ACTIVE',
        sms_notifications_allowed: false,
        notification_preferences: {
          email_enabled: true,
          in_app_enabled: true,
          sms_enabled: true,
          sms_opt_in: true,
        },
      },
    };

    render(<WithAppTheme><PortalProfile /></WithAppTheme>);

    const smsSwitch = screen.getByRole('checkbox', { name: /sms notifications/i });
    expect(smsSwitch).not.toBeChecked();

    const firstNameInput = screen.getByLabelText(/first name/i);
    fireEvent.change(firstNameInput, { target: { value: 'Updated' } });
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() => {
      expect(portalApiClient.patchProfile).toHaveBeenCalledWith(
        'https://api.carwoods.com',
        'mock-token',
        expect.objectContaining({
          first_name: 'Updated',
          notification_preferences: expect.objectContaining({
            sms_enabled: false,
            sms_opt_in: false,
          }),
        })
      );
    });
  });

  it('requires mobile phone when SMS notifications are enabled', async () => {
    render(<WithAppTheme><PortalProfile /></WithAppTheme>);

    const phoneInput = screen.getByLabelText(/phone number/i);
    fireEvent.change(phoneInput, { target: { value: '' } });
    fireEvent.blur(phoneInput);

    const smsSwitch = screen.getByRole('checkbox', { name: /sms notifications/i });
    fireEvent.click(smsSwitch);
    fireEvent.click(await screen.findByRole('button', { name: /yes, i opt in/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));

    expect(
      await screen.findByText(/mobile phone is required when sms notifications are enabled\./i)
    ).toBeInTheDocument();
    expect(portalApiClient.patchProfile).not.toHaveBeenCalled();
  });
});
