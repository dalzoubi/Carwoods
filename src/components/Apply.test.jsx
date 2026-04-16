import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Apply from './Apply';
import { fetchPublicApplyProperties } from '../publicApplyProperties';

/** Shape matches `GET /api/public/apply-properties` tiles; no live API in unit tests. */
const MOCK_APPLY_PROPERTIES = [
  {
    id: 'mock-1',
    addressLine: '100 Mockingbird Ln',
    cityStateZip: 'Houston, TX 77001',
    monthlyRentLabel: '$1,500/mo',
    photoUrl: 'https://example.com/assets/listing-a.jpg',
    harListingUrl: 'https://www.example.com/listings/100-mockingbird-ln',
    applyUrl: 'https://apply.example.com/lease-a',
    detailLines: ['2 Bedroom(s)', '1 Full Bath(s)', '950 Sqft'],
  },
  {
    id: 'mock-2',
    addressLine: '200 Sample Ave',
    cityStateZip: 'Katy, TX 77449',
    monthlyRentLabel: '$1,750/mo',
    photoUrl: 'https://example.com/assets/listing-b.jpg',
    harListingUrl: 'https://www.example.com/listings/200-sample-ave',
    applyUrl: 'https://apply.example.com/lease-b',
    detailLines: ['3 Bedroom(s)', '2 Full Bath(s)', '1,400 Sqft'],
  },
];

// Mock the API fetch module. The factory uses only vi.fn() so hoisting is safe.
vi.mock('../publicApplyProperties', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, fetchPublicApplyProperties: vi.fn() };
});

beforeEach(() => {
  fetchPublicApplyProperties.mockResolvedValue(MOCK_APPLY_PROPERTIES);
});

function mapsSearchUrl(addressLine, cityStateZip) {
  const query = [addressLine, cityStateZip].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

const renderWithRouter = (ui) => render(<HelmetProvider><BrowserRouter>{ui}</BrowserRouter></HelmetProvider>);

describe('Apply', () => {
  it('renders heading', async () => {
    renderWithRouter(<Apply />);
    expect(screen.getByRole('heading', { name: /how to apply to rent/i })).toBeInTheDocument();
    // Wait for async tile fetch to resolve to avoid act() warnings.
    await waitFor(() => expect(fetchPublicApplyProperties).toHaveBeenCalled());
  });

  it('renders steps and links to Selection Criteria and Required Documents', async () => {
    renderWithRouter(<Apply />);
    const criteriaLinks = screen.getAllByRole('link', { name: /tenant selection criteria/i });
    const docsLinks = screen.getAllByRole('link', { name: /required documents/i });
    expect(criteriaLinks[0]).toHaveAttribute('href', '/tenant-selection-criteria');
    expect(docsLinks[0]).toHaveAttribute('href', '/application-required-documents');
    await waitFor(() => expect(fetchPublicApplyProperties).toHaveBeenCalled());
  });

  it('does not link to the HAR.com homepage; listing details are per-property homedetail URLs', async () => {
    renderWithRouter(<Apply />);
    for (const p of MOCK_APPLY_PROPERTIES) {
      const escaped = p.addressLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const details = await screen.findByRole('link', {
        name: new RegExp(`full listing details for ${escaped}`, 'i'),
      });
      expect(details).toHaveAttribute('href', p.harListingUrl);
      expect(details).toHaveAttribute('target', '_blank');
    }
    const allLinks = screen.getAllByRole('link');
    expect(allLinks.some((el) => el.getAttribute('href') === 'https://www.har.com')).toBe(false);
  });

  it('renders rental property tiles from the API', async () => {
    renderWithRouter(<Apply />);
    expect(MOCK_APPLY_PROPERTIES.length).toBeGreaterThan(0);
    for (const p of MOCK_APPLY_PROPERTIES) {
      const re = new RegExp(`apply for ${p.addressLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
      const tile = await screen.findByRole('link', { name: re });
      expect(tile).toHaveAttribute('href', p.applyUrl);
      expect(tile).toHaveAttribute('target', '_blank');
      expect(tile).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('links each property address to Google Maps search in a new tab', async () => {
    renderWithRouter(<Apply />);
    for (const p of MOCK_APPLY_PROPERTIES) {
      const escaped = p.addressLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const mapLink = await screen.findByRole('link', {
        name: new RegExp(`open map for ${escaped}`, 'i'),
      });
      expect(mapLink).toHaveAttribute('href', mapsSearchUrl(p.addressLine, p.cityStateZip));
      expect(mapLink).toHaveAttribute('target', '_blank');
      expect(mapLink).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });
});
