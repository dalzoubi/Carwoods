import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Apply from './Apply';

const renderWithRouter = (ui) => render(<BrowserRouter>{ui}</BrowserRouter>);

describe('Apply', () => {
  it('renders heading', () => {
    renderWithRouter(<Apply />);
    expect(screen.getByRole('heading', { name: /how to apply to rent/i })).toBeInTheDocument();
  });

  it('renders steps and links to Selection Criteria and Required Documents', () => {
    renderWithRouter(<Apply />);
    expect(screen.getByRole('link', { name: /tenant selection criteria/i })).toHaveAttribute('href', '/tenant-selection-criteria');
    expect(screen.getByRole('link', { name: /required documents/i })).toHaveAttribute('href', '/application-required-documents');
  });

  it('links to har.com for submission', () => {
    renderWithRouter(<Apply />);
    const harLink = screen.getByRole('link', { name: /har\.com/i });
    expect(harLink).toHaveAttribute('href', 'https://www.har.com');
    expect(harLink).toHaveAttribute('target', '_blank');
    expect(harLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('links to Contact Us', () => {
    renderWithRouter(<Apply />);
    expect(screen.getByRole('link', { name: /contact us/i })).toHaveAttribute('href', '/contact-us');
  });
});
