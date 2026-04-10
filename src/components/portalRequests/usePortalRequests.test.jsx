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
    isAdmin: false,
    meStatus: 'ok',
    account: { idTokenClaims: { email: 'tenant@example.com' } },
    getAccessToken: vi.fn().mockResolvedValue('token-123'),
    handleApiForbidden: vi.fn(),
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
    // Mock order for non-management (isManagement: false):
    // Both useEffect hooks fire concurrently. Effect 1 (loadRequests) and
    // Effect 2 (loadLookups) each call headersBuilder() in the same microtask
    // batch. FIFO resolution means effect 1 consumes mock 1 (list), then
    // effect 2 consumes mock 2 (lookups), then effect 1 continues with
    // mocks 3-5 (detail, messages, attachments).
    global.fetch
      .mockResolvedValueOnce(
        jsonResponse({
          requests: [{ id: 'req-1', title: 'Kitchen leak', current_status_id: 'NOT_STARTED' }],
        })
      )
      .mockResolvedValueOnce(
        // Consumed by loadLookups (effect 2 fires concurrently with effect 1)
        jsonResponse({ categories: [], priorities: [], tenant_defaults: null, landlord_contact: null })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          request: {
            id: 'req-1',
            title: 'Kitchen leak',
            description: 'Water under sink',
            current_status_id: 'NOT_STARTED',
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

    // Pre-create stable params so getAccessToken and account keep the same
    // reference across renders. Recreating them on every render would cause
    // headersBuilder (useMemo on [account, getAccessToken]) to recompute
    // every render, re-triggering useEffect(loadLookups) infinitely → OOM.
    const params = baseParams();
    const { result } = renderHook(() => usePortalRequests(params));

    await waitFor(() => {
      expect(result.current.requestsStatus).toBe('ok');
    });

    expect(result.current.requests).toHaveLength(1);
    expect(result.current.selectedRequestId).toBe('req-1');
    expect(result.current.requestDetail?.id).toBe('req-1');
    expect(result.current.threadMessages).toHaveLength(1);
    expect(result.current.attachments).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(5);
  });

  it('loads request audit events for admin users', async () => {
    global.fetch
      .mockResolvedValueOnce(
        jsonResponse({
          requests: [{ id: 'req-a1', title: 'Audit me', current_status_id: 'NOT_STARTED' }],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({ categories: [], priorities: [], tenant_defaults: null, landlord_contact: null })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          request: {
            id: 'req-a1',
            title: 'Audit me',
            description: 'Test request',
            current_status_id: 'NOT_STARTED',
          },
        })
      )
      .mockResolvedValueOnce(jsonResponse({ messages: [] }))
      .mockResolvedValueOnce(jsonResponse({ attachments: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          audits: [{ id: 'aud-1', action: 'UPDATE', entity_id: 'req-a1' }],
        })
      )
      .mockResolvedValueOnce(jsonResponse({ settings: {}, request: { auto_respond_enabled: false } }))
      .mockResolvedValueOnce(jsonResponse({ decisions: [] }));

    const params = baseParams({
      isManagement: true,
      isAdmin: true,
      account: { idTokenClaims: { email: 'admin@example.com' } },
    });
    const { result } = renderHook(() => usePortalRequests(params));

    await waitFor(() => {
      expect(result.current.requestsStatus).toBe('ok');
    });
    await waitFor(() => {
      expect(result.current.auditStatus).toBe('ok');
    });

    expect(result.current.auditEvents).toHaveLength(1);
    expect(result.current.auditEvents[0].id).toBe('aud-1');
  });

  it('surfaces upload intent contract error when storage_path is missing', async () => {
    global.fetch
      .mockResolvedValueOnce(
        jsonResponse({
          requests: [{ id: 'req-2', title: 'Ceiling leak', current_status_id: 'NOT_STARTED' }],
        })
      )
      .mockResolvedValueOnce(
        // Consumed by loadLookups (runs concurrently for non-management)
        jsonResponse({ categories: [], priorities: [], tenant_defaults: null, landlord_contact: null })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          request: {
            id: 'req-2',
            title: 'Ceiling leak',
            description: 'Leak near hallway',
            current_status_id: 'NOT_STARTED',
          },
        })
      )
      .mockResolvedValueOnce(jsonResponse({ messages: [] }))
      .mockResolvedValueOnce(jsonResponse({ attachments: [] }))
      .mockResolvedValueOnce(jsonResponse({ upload: { upload_url: 'https://example.invalid/upload' } }));

    const params = baseParams();
    const { result } = renderHook(() => usePortalRequests(params));

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

  it('rejects unsupported file types with a client-side error before calling the API', async () => {
    global.fetch
      .mockResolvedValueOnce(
        jsonResponse({
          requests: [{ id: 'req-3', title: 'Heater issue', current_status_id: 'NOT_STARTED' }],
        })
      )
      .mockResolvedValueOnce(
        // Consumed by loadLookups (runs concurrently for non-management)
        jsonResponse({ categories: [], priorities: [], tenant_defaults: null, landlord_contact: null })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          request: {
            id: 'req-3',
            title: 'Heater issue',
            description: 'No hot air',
            current_status_id: 'NOT_STARTED',
          },
        })
      )
      .mockResolvedValueOnce(jsonResponse({ messages: [] }))
      .mockResolvedValueOnce(jsonResponse({ attachments: [] }));

    const params = baseParams();
    const { result } = renderHook(() => usePortalRequests(params));

    await waitFor(() => {
      expect(result.current.requestsStatus).toBe('ok');
    });

    const fetchCallsBefore = global.fetch.mock.calls.length;

    const file = new File(['not-image'], 'archive.zip', { type: 'application/zip' });
    await act(async () => {
      result.current.onAttachmentChange({ target: { files: [file] } });
    });

    await act(async () => {
      await result.current.onAttachmentSubmit({ preventDefault() {} });
    });

    expect(result.current.attachmentStatus).toBe('error');
    expect(result.current.attachmentError).toBe('portalRequests.errors.unsupportedFileType');
    // No additional fetch calls should have been made (client-side rejection)
    expect(global.fetch.mock.calls.length).toBe(fetchCallsBefore);
  });

  it('keeps requestsStatus ok when detail load fails', async () => {
    global.fetch
      .mockResolvedValueOnce(
        jsonResponse({
          requests: [{ id: 'req-x1', title: 'Broken lock', status_code: 'NOT_STARTED' }],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({ categories: [], priorities: [], tenant_defaults: null, landlord_contact: null })
      )
      .mockResolvedValueOnce(jsonResponse({ error: 'upstream_failed' }, 500));

    const params = baseParams({
      isManagement: true,
      account: { idTokenClaims: { email: 'landlord@example.com' } },
    });
    const { result } = renderHook(() => usePortalRequests(params));

    await waitFor(() => {
      expect(result.current.requestsStatus).toBe('ok');
    });
    await waitFor(() => {
      expect(result.current.detailStatus).toBe('error');
    });

    expect(result.current.requests).toHaveLength(1);
    expect(result.current.requestsStatus).toBe('ok');
  });

  it('handles successful cancel flow and refreshes the list', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ requests: [{ id: 'req-c1', title: 'Leak', status_code: 'NOT_STARTED' }] }))
      .mockResolvedValueOnce(
        jsonResponse({ categories: [], priorities: [], tenant_defaults: null, landlord_contact: null })
      )
      .mockResolvedValueOnce(jsonResponse({ request: { id: 'req-c1', title: 'Leak', status_code: 'NOT_STARTED' } }))
      .mockResolvedValueOnce(jsonResponse({ messages: [] }))
      .mockResolvedValueOnce(jsonResponse({ attachments: [] }))
      .mockResolvedValueOnce(jsonResponse({ settings: {}, request: { auto_respond_enabled: false } }))
      .mockResolvedValueOnce(jsonResponse({ decisions: [] }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ requests: [{ id: 'req-c1', title: 'Leak', status_code: 'CANCELLED' }] }))
      .mockResolvedValueOnce(jsonResponse({ request: { id: 'req-c1', title: 'Leak', status_code: 'CANCELLED' } }))
      .mockResolvedValueOnce(jsonResponse({ messages: [] }))
      .mockResolvedValueOnce(jsonResponse({ attachments: [] }))
      .mockResolvedValueOnce(jsonResponse({ settings: {}, request: { auto_respond_enabled: false } }))
      .mockResolvedValueOnce(jsonResponse({ decisions: [] }));

    const params = baseParams({
      isManagement: true,
      account: { idTokenClaims: { email: 'landlord@example.com' } },
    });
    const { result } = renderHook(() => usePortalRequests(params));

    await waitFor(() => expect(result.current.selectedRequestId).toBe('req-c1'));
    await act(async () => {
      await result.current.onCancelRequest();
    });
    await waitFor(() => {
      expect(result.current.requests.length).toBeGreaterThan(0);
    });

    expect(result.current.cancelStatus).toBe('success');
    expect(result.current.requests[0].status_code).toBe('CANCELLED');
  });

  it('handles management status update and includes priority updates', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ requests: [{ id: 'req-m1', title: 'AC', status_code: 'NOT_STARTED' }] }))
      .mockResolvedValueOnce(
        jsonResponse({ categories: [{ code: 'plumbing', name: 'Plumbing' }], priorities: [{ code: 'routine', name: 'Routine' }], tenant_defaults: null, landlord_contact: null })
      )
      .mockResolvedValueOnce(jsonResponse({ request: { id: 'req-m1', title: 'AC', status_code: 'NOT_STARTED' } }))
      .mockResolvedValueOnce(jsonResponse({ messages: [] }))
      .mockResolvedValueOnce(jsonResponse({ attachments: [] }))
      .mockResolvedValueOnce(jsonResponse({ settings: {}, request: { auto_respond_enabled: false } }))
      .mockResolvedValueOnce(jsonResponse({ decisions: [] }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ requests: [{ id: 'req-m1', title: 'AC', status_code: 'WAITING_ON_VENDOR' }] }))
      .mockResolvedValueOnce(jsonResponse({ request: { id: 'req-m1', title: 'AC', status_code: 'WAITING_ON_VENDOR' } }))
      .mockResolvedValueOnce(jsonResponse({ messages: [] }))
      .mockResolvedValueOnce(jsonResponse({ attachments: [] }))
      .mockResolvedValueOnce(jsonResponse({ settings: {}, request: { auto_respond_enabled: false } }))
      .mockResolvedValueOnce(jsonResponse({ decisions: [] }));

    const params = baseParams({
      isManagement: true,
      account: { idTokenClaims: { email: 'landlord@example.com' } },
    });
    const { result } = renderHook(() => usePortalRequests(params));

    await waitFor(() => expect(result.current.requestsStatus).toBe('ok'));
    await act(async () => {
      result.current.onManagementField('status_code')({ target: { value: 'waiting_on_vendor' } });
      result.current.onManagementField('priority_code')({ target: { value: 'routine' } });
    });
    await act(async () => {
      await result.current.onUpdateRequest({ preventDefault() {} });
    });

    expect(result.current.managementUpdateStatus).toBe('success');
    expect(result.current.requests[0].status_code).toBe('WAITING_ON_VENDOR');
    const patchCall = global.fetch.mock.calls.find(([url, init]) => (
      String(url).includes('/api/landlord/requests/req-m1')
      && String(init?.method || '').toUpperCase() === 'PATCH'
    ));
    expect(patchCall).toBeTruthy();
    const payload = JSON.parse(patchCall[1].body);
    expect(payload.status_code).toBe('WAITING_ON_VENDOR');
    expect(payload.priority_code).toBe('routine');
  });

  it('handles message submit success and clears message form', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ requests: [{ id: 'req-msg1', title: 'Noise', status_code: 'NOT_STARTED' }] }))
      .mockResolvedValueOnce(
        jsonResponse({ categories: [], priorities: [], tenant_defaults: null, landlord_contact: null })
      )
      .mockResolvedValueOnce(jsonResponse({ request: { id: 'req-msg1', title: 'Noise', status_code: 'NOT_STARTED' } }))
      .mockResolvedValueOnce(jsonResponse({ messages: [] }))
      .mockResolvedValueOnce(jsonResponse({ attachments: [] }))
      .mockResolvedValueOnce(jsonResponse({ settings: {}, request: { auto_respond_enabled: false } }))
      .mockResolvedValueOnce(jsonResponse({ decisions: [] }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ request: { id: 'req-msg1', title: 'Noise', status_code: 'NOT_STARTED' } }))
      .mockResolvedValueOnce(jsonResponse({
        messages: [{ id: 'msg-new', sender_display_name: 'Manager', body: 'Thanks', is_internal: false }],
      }))
      .mockResolvedValueOnce(jsonResponse({ attachments: [] }));

    const params = baseParams({
      isManagement: true,
      account: { idTokenClaims: { email: 'landlord@example.com' } },
    });
    const { result } = renderHook(() => usePortalRequests(params));

    await waitFor(() => expect(result.current.selectedRequestId).toBe('req-msg1'));
    await act(async () => {
      result.current.setMessageForm({ body: 'Please update me', is_internal: false });
    });
    await act(async () => {
      await result.current.onMessageSubmit({ preventDefault() {} });
    });

    expect(result.current.messageStatus).toBe('success');
    expect(result.current.messageForm.body).toBe('');
    expect(result.current.threadMessages).toHaveLength(1);
  });

  it('resets transient per-request state when selected request changes', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse({
        requests: [
          { id: 'req-r1', title: 'Door issue', status_code: 'NOT_STARTED' },
          { id: 'req-r2', title: 'Pipe issue', status_code: 'NOT_STARTED' },
        ],
      }))
      .mockResolvedValueOnce(jsonResponse({ request: { id: 'req-r1', title: 'Door issue', status_code: 'NOT_STARTED' } }))
      .mockResolvedValueOnce(jsonResponse({ messages: [] }))
      .mockResolvedValueOnce(jsonResponse({ attachments: [] }))
      .mockResolvedValueOnce(jsonResponse({ error: 'upstream_failed' }, 500));

    const params = baseParams();
    const { result } = renderHook(() => usePortalRequests(params));

    await waitFor(() => expect(result.current.requestsStatus).toBe('ok'));
    await act(async () => {
      result.current.setMessageForm({ body: 'Any update?', is_internal: false });
    });
    await act(async () => {
      await result.current.onMessageSubmit({ preventDefault() {} });
    });
    expect(result.current.messageStatus).toBe('error');

    await act(async () => {
      result.current.setSelectedRequestId('req-r2');
    });

    expect(result.current.messageStatus).toBe('idle');
    expect(result.current.messageError).toBe('');
    expect(result.current.attachmentStatus).toBe('idle');
    expect(result.current.cancelStatus).toBe('idle');
  });
});

