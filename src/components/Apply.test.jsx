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

  it('links to har.com for submission', () => {
    renderWithRouter(<Apply />);
    const harLinks = screen.getAllByRole('link', { name: /har\.com/i });
    const harLink = harLinks.find((el) => el.getAttribute('href') === 'https://www.har.com') ?? harLinks[0];
    expect(harLink).toHaveAttribute('href', 'https://www.har.com');
    expect(harLink).toHaveAttribute('target', '_blank');
    expect(harLink).toHaveAttribute('rel', 'noopener noreferrer');
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

  it('links to Contact Us', () => {
    renderWithRouter(<Apply />);
    expect(screen.getByRole('link', { name: /contact us/i })).toHaveAttribute('href', '/contact-us');
  });
});
