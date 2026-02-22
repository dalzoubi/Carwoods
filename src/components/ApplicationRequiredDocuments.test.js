import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ApplicationRequiredDocuments from './ApplicationRequiredDocuments';

const renderWithRouter = (ui) => render(<BrowserRouter>{ui}</BrowserRouter>);

describe('ApplicationRequiredDocuments', () => {
  it('renders heading', () => {
    renderWithRouter(<ApplicationRequiredDocuments />);
    expect(screen.getByRole('heading', { name: /application required documents/i })).toBeInTheDocument();
  });

  it('contains fair housing statement', () => {
    renderWithRouter(<ApplicationRequiredDocuments />);
    expect(screen.getByText(/we do not discriminate based on race, color, religion, sex, familial status/i)).toBeInTheDocument();
  });

  it('links to tenant selection criteria', () => {
    renderWithRouter(<ApplicationRequiredDocuments />);
    const links = screen.getAllByRole('link', { name: /tenant selection criteria/i });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute('href', '/tenant-selection-criteria');
  });

  it('lists personal identification requirement', () => {
    renderWithRouter(<ApplicationRequiredDocuments />);
    expect(screen.getByText(/personal identification.*all adults 18\+/i)).toBeInTheDocument();
  });

  it('lists Section 8 requirements', () => {
    renderWithRouter(<ApplicationRequiredDocuments />);
    expect(screen.getByText(/section 8.*housing assistance applicants/i)).toBeInTheDocument();
  });
});
