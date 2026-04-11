import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import i18n from '../i18n';
import { WithAppTheme } from '../testUtils';
import PortalAdminAttachmentConfig from './PortalAdminAttachmentConfig';
import * as portalApiClient from '../lib/portalApiClient';

const mockAuthState = {
  isAuthenticated: true,
  account: { name: 'Portal Admin' },
  meData: {
    role: 'ADMIN',
    user: { first_name: 'Portal', last_name: 'Admin', role: 'ADMIN', status: 'ACTIVE' },
  },
  baseUrl: 'https://api.carwoods.com',
  getAccessToken: vi.fn().mockResolvedValue('mock-token'),
  handleApiForbidden: vi.fn(),
};

vi.mock('../PortalAuthContext', () => ({
  usePortalAuth: () => mockAuthState,
  PortalAuthProvider: ({ children }) => children,
}));

vi.mock('../lib/portalApiClient', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchAttachmentUploadConfig: vi.fn(),
    fetchLandlords: vi.fn(),
    patchAttachmentUploadGlobalConfig: vi.fn(),
    patchAttachmentUploadLandlordConfig: vi.fn(),
    deleteAttachmentUploadLandlordConfig: vi.fn(),
  };
});

const configPayload = {
  global: {
    id: 'global',
    scope_type: 'GLOBAL',
    landlord_user_id: null,
    max_attachments: 3,
    max_image_bytes: 10 * 1024 * 1024,
    max_video_bytes: 50 * 1024 * 1024,
    max_video_duration_seconds: 10,
    allowed_mime_types: ['image/*', 'video/*'],
    allowed_extensions: ['jpg', 'png', 'mp4'],
    share_enabled: true,
    share_expiry_seconds: 86400,
    malware_scan_required: false,
  },
  overrides: [
    {
      id: 'override-1',
      scope_type: 'LANDLORD',
      landlord_user_id: 'landlord-1',
      max_attachments: 4,
      max_image_bytes: 20 * 1024 * 1024,
      max_video_bytes: 60 * 1024 * 1024,
      max_video_duration_seconds: 20,
      allowed_mime_types: ['image/*', 'video/*'],
      allowed_extensions: ['jpg', 'png', 'mp4'],
      share_enabled: true,
      share_expiry_seconds: 86400,
      malware_scan_required: false,
    },
  ],
};

describe('PortalAdminAttachmentConfig', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('en');
    portalApiClient.fetchAttachmentUploadConfig.mockResolvedValue(configPayload);
    portalApiClient.fetchLandlords.mockResolvedValue({
      landlords: [
        { id: 'landlord-1', first_name: 'Lana', last_name: 'Lord', email: 'lana@example.com' },
      ],
    });
    portalApiClient.patchAttachmentUploadGlobalConfig.mockResolvedValue({ global: configPayload.global });
    portalApiClient.patchAttachmentUploadLandlordConfig.mockResolvedValue({ override: configPayload.overrides[0] });
    portalApiClient.deleteAttachmentUploadLandlordConfig.mockResolvedValue({ deleted: configPayload.overrides[0] });
  });

  it('renders and refreshes attachment configuration data', async () => {
    window.history.pushState({}, 'Attachment tab', '/portal/admin/config?tab=attachments');
    render(
      <WithAppTheme>
        <PortalAdminAttachmentConfig />
      </WithAppTheme>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /attachment configuration/i })).toBeInTheDocument();
    });
    expect(portalApiClient.fetchAttachmentUploadConfig).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    await waitFor(() => {
      expect(portalApiClient.fetchAttachmentUploadConfig).toHaveBeenCalledTimes(2);
    });
    expect(window.location.search).toContain('tab=attachments');
  });

  it('confirms before saving global defaults', async () => {
    render(
      <WithAppTheme>
        <PortalAdminAttachmentConfig />
      </WithAppTheme>
    );

    await waitFor(() => {
      expect(portalApiClient.fetchAttachmentUploadConfig).toHaveBeenCalled();
    });

    const maxAttachmentsInput = screen.getAllByLabelText(/max attachments per request/i)[0];
    fireEvent.change(maxAttachmentsInput, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /save global defaults/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /confirm configuration change/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));

    await waitFor(() => {
      expect(portalApiClient.patchAttachmentUploadGlobalConfig).toHaveBeenCalledWith(
        'https://api.carwoods.com',
        'mock-token',
        expect.objectContaining({
          max_attachments: 5,
          max_image_bytes: 10 * 1024 * 1024,
        })
      );
    });
  });

  it('saves and clears landlord override with confirmation', async () => {
    render(
      <WithAppTheme>
        <PortalAdminAttachmentConfig />
      </WithAppTheme>
    );

    await waitFor(() => {
      expect(portalApiClient.fetchAttachmentUploadConfig).toHaveBeenCalled();
    });

    const overrideMaxAttachmentsInput = screen.getAllByLabelText(/max attachments per request/i)[1];
    fireEvent.change(overrideMaxAttachmentsInput, { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: /save landlord override/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^confirm$/i }));

    await waitFor(() => {
      expect(portalApiClient.patchAttachmentUploadLandlordConfig).toHaveBeenCalledWith(
        'https://api.carwoods.com',
        'mock-token',
        'landlord-1',
        expect.objectContaining({
          max_attachments: 6,
        })
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /clear override/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^confirm$/i }));

    await waitFor(() => {
      expect(portalApiClient.deleteAttachmentUploadLandlordConfig).toHaveBeenCalledWith(
        'https://api.carwoods.com',
        'mock-token',
        'landlord-1',
        expect.objectContaining({ emailHint: expect.any(String) })
      );
    });
  }, 15000);
});
