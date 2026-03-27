import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Apply from './Apply';
import { RENTAL_APPLY_PROPERTIES } from '../data/rentalPropertyApplyTiles.generated';

const renderWithRouter = (ui) => render(<BrowserRouter>{ui}</BrowserRouter>);

describe('Apply', () => {
  it('renders heading', () => {
    renderWithRouter(<Apply />);
    expect(screen.getByRole('heading', { name: /how to apply to rent/i })).toBeInTheDocument();
  });

  it('renders steps and links to Selection Criteria and Required Documents', () => {
    renderWithRouter(<Apply />);
    const criteriaLinks = screen.getAllByRole('link', { name: /tenant selection criteria/i });
    const docsLinks = screen.getAllByRole('link', { name: /required documents/i });
    expect(criteriaLinks[0]).toHaveAttribute('href', '/tenant-selection-criteria');
    expect(docsLinks[0]).toHaveAttribute('href', '/application-required-documents');
  });

  it('does not link to the HAR.com homepage; listing details are per-property homedetail URLs', () => {
    renderWithRouter(<Apply />);
    const allLinks = screen.getAllByRole('link');
    expect(allLinks.some((el) => el.getAttribute('href') === 'https://www.har.com')).toBe(false);
    for (const p of RENTAL_APPLY_PROPERTIES) {
      const escaped = p.addressLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const details = screen.getByRole('link', {
        name: new RegExp(`full listing details for ${escaped}`, 'i'),
      });
      expect(details).toHaveAttribute('href', p.harListingUrl);
      expect(details).toHaveAttribute('target', '_blank');
    }
  });

  it('renders rental property tiles from generated HAR data', () => {
    renderWithRouter(<Apply />);
    expect(RENTAL_APPLY_PROPERTIES.length).toBeGreaterThan(0);
    for (const p of RENTAL_APPLY_PROPERTIES) {
      const re = new RegExp(`apply for ${p.addressLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
      const tile = screen.getByRole('link', { name: re });
      expect(tile).toHaveAttribute('href', p.applyUrl);
      expect(tile).toHaveAttribute('target', '_blank');
      expect(tile).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });
});
