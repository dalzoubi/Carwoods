import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  APPLY_PROPERTIES_SESSION_KEY,
  fetchPublicApplyProperties,
  normalizeApplyPropertyTile,
} from './publicApplyProperties';

const valid = {
  id: 'har-1',
  addressLine: '1 Main St',
  cityStateZip: 'Houston, TX 77001',
  monthlyRentLabel: '$1/mo',
  photoUrl: 'https://example.com/p.jpg',
  harListingUrl: 'https://www.har.com/homedetail/x/1',
  applyUrl: 'https://apply.link/abc',
  detailLines: ['2 Bedroom(s)'],
};

describe('normalizeApplyPropertyTile', () => {
  it('accepts a valid object', () => {
    expect(normalizeApplyPropertyTile(valid)).toEqual(valid);
  });

  it('rejects missing fields', () => {
    const rest = { ...valid };
    delete rest.applyUrl;
    expect(() => normalizeApplyPropertyTile(rest)).toThrow();
  });
});

describe('fetchPublicApplyProperties', () => {
  beforeEach(() => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(APPLY_PROPERTIES_SESSION_KEY);
    }
  });

  it('parses { properties: [] }', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ properties: [valid] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const out = await fetchPublicApplyProperties('https://api.example.com');
      expect(out).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/api/public/apply-properties',
        expect.any(Object)
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('orders properties from cheaper to more expensive by monthlyRentLabel', async () => {
    const expensive = { ...valid, id: 'expensive', monthlyRentLabel: '$2,200/mo' };
    const medium = { ...valid, id: 'medium', monthlyRentLabel: '$1,500/mo' };
    const cheap = { ...valid, id: 'cheap', monthlyRentLabel: '$900/mo' };
    const unknown = { ...valid, id: 'unknown', monthlyRentLabel: 'Call for pricing' };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ properties: [expensive, unknown, cheap, medium] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const out = await fetchPublicApplyProperties('https://api.example.com');
      expect(out.map((item) => item.id)).toEqual(['cheap', 'medium', 'expensive', 'unknown']);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
