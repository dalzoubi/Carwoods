import { describe, expect, it } from 'vitest';
import { listingFromHarPreviewPayload, parseHarInput } from './portalHarPreviewParse';

const sampleTile = {
  id: 'har-1',
  addressLine: '1 Main',
  cityStateZip: 'Houston, TX',
  monthlyRentLabel: '$1/mo',
  photoUrl: '',
  harListingUrl: 'https://www.har.com/homedetail/x/1',
  applyUrl: 'https://apply.link/x',
  detailLines: [],
};

describe('parseHarInput', () => {
  it('extracts ID from full HAR homedetail URL', () => {
    expect(
      parseHarInput(
        'https://www.har.com/homedetail/6314-bonnie-chase-ln-katy-tx-77449/8469293'
      )
    ).toBe('8469293');
  });

  it('uses URL pathname last numeric segment (handles query/hash)', () => {
    expect(parseHarInput('https://www.har.com/homedetail/slug/12345?utm=x')).toBe('12345');
    expect(parseHarInput('https://www.har.com/homedetail/slug/12345#frag')).toBe('12345');
  });

  it('returns bare numeric string', () => {
    expect(parseHarInput('8469293')).toBe('8469293');
  });

  it('strips BOM and decodes common HTML entities', () => {
    expect(parseHarInput('\uFEFF8469293')).toBe('8469293');
    expect(parseHarInput('&#56;469293')).toBe('8469293');
  });

  it('finds embedded ID in pasted text', () => {
    expect(parseHarInput('See listing 8469293 on HAR')).toBe('8469293');
  });

  it('returns null for URL without numeric listing id', () => {
    expect(parseHarInput('https://example.com/foo')).toBeNull();
  });
});

describe('listingFromHarPreviewPayload', () => {
  it('reads top-level listing', () => {
    expect(listingFromHarPreviewPayload({ listing: sampleTile })).toEqual(sampleTile);
  });

  it('reads nested body.listing', () => {
    expect(listingFromHarPreviewPayload({ body: { listing: sampleTile } })).toEqual(sampleTile);
  });

  it('parses stringified nested JSON', () => {
    const body = JSON.stringify({ listing: sampleTile });
    expect(listingFromHarPreviewPayload({ body })).toEqual(sampleTile);
  });

  it('returns null when missing', () => {
    expect(listingFromHarPreviewPayload({})).toBeNull();
    expect(listingFromHarPreviewPayload(null)).toBeNull();
  });
});
