import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import i18n from '../../i18n.js';
import { usePortalPayments } from './usePortalPayments';

const fetchPaymentsApi = vi.fn().mockResolvedValue({ entries: [] });

vi.mock('../../lib/portalApiClient', () => ({
  fetchPaymentsApi: (...args) => fetchPaymentsApi(...args),
  createLeasePaymentEntry: vi.fn(),
  updateLeasePaymentEntry: vi.fn(),
  deleteLandlordPaymentEntry: vi.fn(),
}));

vi.mock('../../featureFlags', () => ({
  isPortalApiReachable: () => true,
}));

function baseParams(overrides = {}) {
  return {
    baseUrl: 'https://api.example.com',
    isAuthenticated: true,
    isGuest: false,
    isManagement: false,
    meStatus: 'ok',
    account: { idTokenClaims: { email: 'user@example.com' } },
    getAccessToken: vi.fn().mockResolvedValue('token-123'),
    handleApiForbidden: vi.fn(),
    t: (key) => key,
    ...overrides,
  };
}

describe('usePortalPayments', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.clearAllMocks();
    fetchPaymentsApi.mockResolvedValue({ entries: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('landlord loadEntries sends property_id and optional lease_id (regression: legacy hosts required lease_id)', async () => {
    const params = baseParams({ isManagement: true });
    const { result } = renderHook(() => usePortalPayments(params));

    await act(async () => {
      await result.current.loadEntries({
        propertyId: '  prop-1  ',
        leaseId: 'lease-2',
      });
    });

    await waitFor(() => {
      expect(result.current.entriesStatus).toBe('ok');
    });

    expect(fetchPaymentsApi).toHaveBeenCalledTimes(1);
    expect(fetchPaymentsApi).toHaveBeenCalledWith(
      'https://api.example.com',
      'token-123',
      expect.objectContaining({
        path: '/api/landlord/payments?property_id=prop-1&lease_id=lease-2',
      })
    );
  });

  it('landlord loadEntries sends only property_id when leaseId omitted', async () => {
    const params = baseParams({ isManagement: true });
    const { result } = renderHook(() => usePortalPayments(params));

    await act(async () => {
      await result.current.loadEntries({ propertyId: 'prop-only' });
    });

    await waitFor(() => {
      expect(result.current.entriesStatus).toBe('ok');
    });

    expect(fetchPaymentsApi).toHaveBeenCalledWith(
      'https://api.example.com',
      'token-123',
      expect.objectContaining({
        path: '/api/landlord/payments?property_id=prop-only',
      })
    );
  });

  it('landlord loadEntries does not call API when propertyId is empty after trim', async () => {
    const params = baseParams({ isManagement: true });
    const { result } = renderHook(() => usePortalPayments(params));

    await act(async () => {
      await result.current.loadEntries({ propertyId: '   ' });
    });

    expect(fetchPaymentsApi).not.toHaveBeenCalled();
  });

  it('tenant loadEntries uses portal path and optional property filter', async () => {
    const params = baseParams({ isManagement: false });
    const { result } = renderHook(() => usePortalPayments(params));

    await act(async () => {
      await result.current.loadEntries({ portalPropertyId: 'tenant-prop-1' });
    });

    await waitFor(() => {
      expect(result.current.entriesStatus).toBe('ok');
    });

    expect(fetchPaymentsApi).toHaveBeenCalledWith(
      'https://api.example.com',
      'token-123',
      expect.objectContaining({
        path: '/api/portal/payments?property_id=tenant-prop-1',
      })
    );
  });
});
