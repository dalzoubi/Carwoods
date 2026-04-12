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

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
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

  it('loads requests list and lookups on initial mount without selecting a request', async () => {
    global.fetch
      .mockResolvedValueOnce(
        jsonResponse({
          requests: [{ id: 'req-1', title: 'Kitchen leak', current_status_id: 'NOT_STARTED' }],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({ categories: [], priorities: [], tenant_defaults: null, landlord_contact: null })
      );

    const params = baseParams();
    const { result } = renderHook(() => usePortalRequests(params));

    await waitFor(() => {
      expect(result.current.requestsStatus).toBe('ok');
    });

    expect(result.current.requests).toHaveLength(1);
    expect(result.current.selectedRequestId).toBe('');
    expect(result.current.requestDetail).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('loads request details when initialSelectedRequestId is set (URL deep link)', async () => {
    global.fetch
      .mockResolvedValueOnce(
        jsonResponse({
          requests: [{ id: 'req-1', title: 'Kitchen leak', current_status_id: 'NOT_STARTED' }],
        })
      )
      .mockResolvedValueOnce(
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

    const params = baseParams({ initialSelectedRequestId: 'req-1' });
    const { result } = renderHook(() => usePortalRequests(params));

    await waitFor(() => {
      expect(result.current.requestsStatus).toBe('ok');
    });
    await waitFor(() => {
      expect(result.current.detailStatus).toBe('ok');
    });

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
      initialSelectedRequestId: 'req-a1',
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

  it('loads request audit events for landlord (property-scoped) users', async () => {
    global.fetch
      .mockResolvedValueOnce(
        jsonResponse({
          requests: [{ id: 'req-l1', title: 'Landlord audit', current_status_id: 'NOT_STARTED' }],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({ categories: [], priorities: [], tenant_defaults: null, landlord_contact: null })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          request: {
            id: 'req-l1',
            title: 'Landlord audit',
            description: 'Test',
            current_status_id: 'NOT_STARTED',
          },
        })
      )
      .mockResolvedValueOnce(jsonResponse({ messages: [] }))
      .mockResolvedValueOnce(jsonResponse({ attachments: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          audits: [{ id: 'aud-l1', action: 'UPDATE', entity_id: 'req-l1' }],
        })
      )
      .mockResolvedValueOnce(jsonResponse({ settings: {}, request: { auto_respond_enabled: false } }))
      .mockResolvedValueOnce(jsonResponse({ decisions: [] }));

    const params = baseParams({
      isManagement: true,
      isAdmin: false,
      account: { idTokenClaims: { email: 'landlord@example.com' } },
      initialSelectedRequestId: 'req-l1',
    });
    const { result } = renderHook(() => usePortalRequests(params));

    await waitFor(() => {
      expect(result.current.requestsStatus).toBe('ok');
    });
    await waitFor(() => {
      expect(result.current.auditStatus).toBe('ok');
    });

    expect(result.current.auditEvents).toHaveLength(1);
    expect(result.current.auditEvents[0].id).toBe('aud-l1');
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

    const params = baseParams({ initialSelectedRequestId: 'req-2' });
    const { result } = renderHook(() => usePortalRequests(params));

    await waitFor(() => {
      expect(result.current.requestsStatus).toBe('ok');
    });
    await waitFor(() => {
      expect(result.current.detailStatus).toBe('ok');
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

  it('shows storage not configured as inline attachment error message', async () => {
    global.fetch
      .mockResolvedValueOnce(
        jsonResponse({
          requests: [{ id: 'req-22', title: 'Ceiling leak', current_status_id: 'NOT_STARTED' }],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({ categories: [], priorities: [], tenant_defaults: null, landlord_contact: null })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          request: {
            id: 'req-22',
            title: 'Ceiling leak',
            description: 'Leak near hallway',
            current_status_id: 'NOT_STARTED',
          },
        })
      )
      .mockResolvedValueOnce(jsonResponse({ messages: [] }))
      .mockResolvedValueOnce(jsonResponse({ attachments: [] }))
      .mockResolvedValueOnce(jsonResponse({ error: 'storage_not_configured' }, 422));

    const params = baseParams({ initialSelectedRequestId: 'req-22' });
    const { result } = renderHook(() => usePortalRequests(params));

    await waitFor(() => {
      expect(result.current.requestsStatus).toBe('ok');
    });
    await waitFor(() => {
      expect(result.current.detailStatus).toBe('ok');
    });

    const file = new File(['file-bytes'], 'photo.jpg', { type: 'image/jpeg' });
    await act(async () => {
      result.current.onAttachmentChange({ target: { files: [file] } });
    });

    await act(async () => {
      await result.current.onAttachmentSubmit({ preventDefault() {} });
    });

    expect(result.current.attachmentStatus).toBe('error');
    expect(result.current.attachmentError).toBe('portalRequests.errors.attachmentStorageUnavailable');
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

    const params = baseParams({ initialSelectedRequestId: 'req-3' });
    const { result } = renderHook(() => usePortalRequests(params));

    await waitFor(() => {
      expect(result.current.requestsStatus).toBe('ok');
    });
    await waitFor(() => {
      expect(result.current.detailStatus).toBe('ok');
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
      initialSelectedRequestId: 'req-x1',
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
      .mockResolvedValueOnce(jsonResponse({ audits: [] }))
      .mockResolvedValueOnce(jsonResponse({ settings: {}, request: { auto_respond_enabled: false } }))
      .mockResolvedValueOnce(jsonResponse({ decisions: [] }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ requests: [{ id: 'req-c1', title: 'Leak', status_code: 'CANCELLED' }] }))
      .mockResolvedValueOnce(jsonResponse({ request: { id: 'req-c1', title: 'Leak', status_code: 'CANCELLED' } }))
      .mockResolvedValueOnce(jsonResponse({ messages: [] }))
      .mockResolvedValueOnce(jsonResponse({ attachments: [] }))
      .mockResolvedValueOnce(jsonResponse({ audits: [] }))
      .mockResolvedValueOnce(jsonResponse({ settings: {}, request: { auto_respond_enabled: false } }))
      .mockResolvedValueOnce(jsonResponse({ decisions: [] }));

    const params = baseParams({
      isManagement: true,
      account: { idTokenClaims: { email: 'landlord@example.com' } },
      initialSelectedRequestId: 'req-c1',
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
      .mockResolvedValueOnce(jsonResponse({ audits: [] }))
      .mockResolvedValueOnce(jsonResponse({ settings: {}, request: { auto_respond_enabled: false } }))
      .mockResolvedValueOnce(jsonResponse({ decisions: [] }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ requests: [{ id: 'req-m1', title: 'AC', status_code: 'WAITING_ON_VENDOR' }] }))
      .mockResolvedValueOnce(jsonResponse({ request: { id: 'req-m1', title: 'AC', status_code: 'WAITING_ON_VENDOR' } }))
      .mockResolvedValueOnce(jsonResponse({ messages: [] }))
      .mockResolvedValueOnce(jsonResponse({ attachments: [] }))
      .mockResolvedValueOnce(jsonResponse({ audits: [] }))
      .mockResolvedValueOnce(jsonResponse({ settings: {}, request: { auto_respond_enabled: false } }))
      .mockResolvedValueOnce(jsonResponse({ decisions: [] }));

    const params = baseParams({
      isManagement: true,
      account: { idTokenClaims: { email: 'landlord@example.com' } },
      initialSelectedRequestId: 'req-m1',
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
      .mockResolvedValueOnce(jsonResponse({ audits: [] }))
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
      initialSelectedRequestId: 'req-msg1',
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

  it('does not flip detailStatus to loading during message submit refresh', async () => {
    const delayedDetail = deferred();
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ requests: [{ id: 'req-msg2', title: 'Noise', status_code: 'NOT_STARTED' }] }))
      .mockResolvedValueOnce(
        jsonResponse({ categories: [], priorities: [], tenant_defaults: null, landlord_contact: null })
      )
      .mockResolvedValueOnce(jsonResponse({ request: { id: 'req-msg2', title: 'Noise', status_code: 'NOT_STARTED' } }))
      .mockResolvedValueOnce(jsonResponse({ messages: [] }))
      .mockResolvedValueOnce(jsonResponse({ attachments: [] }))
      .mockResolvedValueOnce(jsonResponse({ audits: [] }))
      .mockResolvedValueOnce(jsonResponse({ settings: {}, request: { auto_respond_enabled: false } }))
      .mockResolvedValueOnce(jsonResponse({ decisions: [] }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockImplementationOnce(() => delayedDetail.promise)
      .mockResolvedValueOnce(jsonResponse({
        messages: [{ id: 'msg-new', sender_display_name: 'Manager', body: 'Thanks', is_internal: false }],
      }))
      .mockResolvedValueOnce(jsonResponse({ attachments: [] }));

    const params = baseParams({
      isManagement: true,
      account: { idTokenClaims: { email: 'landlord@example.com' } },
      initialSelectedRequestId: 'req-msg2',
    });
    const { result } = renderHook(() => usePortalRequests(params));

    await waitFor(() => expect(result.current.selectedRequestId).toBe('req-msg2'));
    expect(result.current.detailStatus).toBe('ok');

    await act(async () => {
      result.current.setMessageForm({ body: 'Please update me', is_internal: false });
    });

    let submitPromise;
    await act(async () => {
      submitPromise = result.current.onMessageSubmit({ preventDefault() {} });
    });

    await waitFor(() => {
      expect(result.current.messageStatus).toBe('saving');
    });
    expect(result.current.detailStatus).toBe('ok');

    delayedDetail.resolve(jsonResponse({ request: { id: 'req-msg2', title: 'Noise', status_code: 'NOT_STARTED' } }));
    await act(async () => {
      await submitPromise;
    });

    expect(result.current.messageStatus).toBe('success');
    expect(result.current.detailStatus).toBe('ok');
  });

  it('resets transient per-request state when selected request changes', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse({
        requests: [
          { id: 'req-r1', title: 'Door issue', status_code: 'NOT_STARTED' },
          { id: 'req-r2', title: 'Pipe issue', status_code: 'NOT_STARTED' },
        ],
      }))
      .mockResolvedValueOnce(
        jsonResponse({ categories: [], priorities: [], tenant_defaults: null, landlord_contact: null })
      )
      .mockResolvedValueOnce(jsonResponse({ request: { id: 'req-r1', title: 'Door issue', status_code: 'NOT_STARTED' } }))
      .mockResolvedValueOnce(jsonResponse({ messages: [] }))
      .mockResolvedValueOnce(jsonResponse({ attachments: [] }))
      .mockResolvedValueOnce(jsonResponse({ error: 'upstream_failed' }, 500));

    const params = baseParams({ initialSelectedRequestId: 'req-r1' });
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

