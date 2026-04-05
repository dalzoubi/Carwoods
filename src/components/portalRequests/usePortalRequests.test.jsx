import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePortalRequests } from './usePortalRequests';

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}

function baseParams(overrides = {}) {
  return {
    baseUrl: 'https://api.example.com',
    isAuthenticated: true,
    isGuest: false,
    isManagement: false,
    meStatus: 'ok',
    account: { idTokenClaims: { email: 'tenant@example.com' } },
    getAccessToken: vi.fn().mockResolvedValue('token-123'),
    t: (key) => key,
    ...overrides,
  };
}

describe('usePortalRequests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads requests and request details on initial mount', async () => {
    global.fetch
      .mockResolvedValueOnce(
        jsonResponse({
          requests: [{ id: 'req-1', title: 'Kitchen leak', current_status_id: 'OPEN' }],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          request: {
            id: 'req-1',
            title: 'Kitchen leak',
            description: 'Water under sink',
            current_status_id: 'OPEN',
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          messages: [{ id: 'msg-1', sender_user_id: 'user-1', body: 'Please help', is_internal: false }],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          attachments: [{ id: 'att-1', original_filename: 'photo.jpg', media_type: 'PHOTO' }],
        })
      );

    const { result } = renderHook(() => usePortalRequests(baseParams()));

    await waitFor(() => {
      expect(result.current.requestsStatus).toBe('ok');
    });

    expect(result.current.requests).toHaveLength(1);
    expect(result.current.selectedRequestId).toBe('req-1');
    expect(result.current.requestDetail?.id).toBe('req-1');
    expect(result.current.threadMessages).toHaveLength(1);
    expect(result.current.attachments).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(4);
  });

  it('handles suggest-reply failure for management users', async () => {
    global.fetch
      .mockResolvedValueOnce(
        jsonResponse({
          requests: [{ id: 'req-9', title: 'Broken AC', current_status_id: 'OPEN' }],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          request: {
            id: 'req-9',
            title: 'Broken AC',
            description: 'No cooling',
            current_status_id: 'OPEN',
          },
        })
      )
      .mockResolvedValueOnce(jsonResponse({ messages: [] }))
      .mockResolvedValueOnce(jsonResponse({ attachments: [] }))
      .mockResolvedValueOnce(jsonResponse({ error: 'upstream_failed' }, 500));

    const { result } = renderHook(() =>
      usePortalRequests(
        baseParams({
          isManagement: true,
          account: { idTokenClaims: { email: 'landlord@example.com' } },
        })
      )
    );

    await waitFor(() => {
      expect(result.current.requestsStatus).toBe('ok');
    });
    expect(result.current.selectedRequestId).toBe('req-9');

    await act(async () => {
      await result.current.onSuggestReply();
    });

    expect(result.current.suggestionStatus).toBe('error');
    expect(result.current.suggestionError).toContain('HTTP 500');
    expect(result.current.suggestionError).toContain('upstream_failed');
  });

  it('surfaces upload intent contract error when storage_path is missing', async () => {
    global.fetch
      .mockResolvedValueOnce(
        jsonResponse({
          requests: [{ id: 'req-2', title: 'Ceiling leak', current_status_id: 'OPEN' }],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          request: {
            id: 'req-2',
            title: 'Ceiling leak',
            description: 'Leak near hallway',
            current_status_id: 'OPEN',
          },
        })
      )
      .mockResolvedValueOnce(jsonResponse({ messages: [] }))
      .mockResolvedValueOnce(jsonResponse({ attachments: [] }))
      .mockResolvedValueOnce(jsonResponse({ upload: { upload_url: 'https://example.invalid/upload' } }));

    const { result } = renderHook(() => usePortalRequests(baseParams()));

    await waitFor(() => {
      expect(result.current.requestsStatus).toBe('ok');
    });

    const file = new File(['file-bytes'], 'photo.jpg', { type: 'image/jpeg' });
    await act(async () => {
      result.current.onAttachmentChange({ target: { files: [file] } });
    });

    await act(async () => {
      await result.current.onAttachmentSubmit({ preventDefault() {} });
    });

    expect(result.current.attachmentStatus).toBe('error');
    expect(result.current.attachmentError).toBe('portalRequests.errors.uploadIntentMissingPath');
  });

  it('surfaces non-2xx upload intent errors with backend error code', async () => {
    global.fetch
      .mockResolvedValueOnce(
        jsonResponse({
          requests: [{ id: 'req-3', title: 'Heater issue', current_status_id: 'OPEN' }],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          request: {
            id: 'req-3',
            title: 'Heater issue',
            description: 'No hot air',
            current_status_id: 'OPEN',
          },
        })
      )
      .mockResolvedValueOnce(jsonResponse({ messages: [] }))
      .mockResolvedValueOnce(jsonResponse({ attachments: [] }))
      .mockResolvedValueOnce(jsonResponse({ error: 'unsupported_mime_type' }, 400));

    const { result } = renderHook(() => usePortalRequests(baseParams()));

    await waitFor(() => {
      expect(result.current.requestsStatus).toBe('ok');
    });

    const file = new File(['not-image'], 'archive.zip', { type: 'application/zip' });
    await act(async () => {
      result.current.onAttachmentChange({ target: { files: [file] } });
    });

    await act(async () => {
      await result.current.onAttachmentSubmit({ preventDefault() {} });
    });

    expect(result.current.attachmentStatus).toBe('error');
    expect(result.current.attachmentError).toContain('HTTP 400');
    expect(result.current.attachmentError).toContain('unsupported_mime_type');
  });
});

